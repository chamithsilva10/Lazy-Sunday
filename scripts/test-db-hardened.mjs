// scripts/test-db-hardened.mjs
import pg from 'pg';
import crypto from 'node:crypto';
const { Pool } = pg;

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: process.env.USER,
  database: 'pos_test',
});

async function run() {
  const client = await pool.connect();
  console.log('Testing PostgreSQL hardened core functions...\n');

  try {
    // 0. Setup fresh product and recipe ingredients
    const prodRes = await client.query(`
      INSERT INTO pos_products (name, price, stock, track_stock, station)
      VALUES ('Test Espresso', 3.50, 10, true, 'bar')
      RETURNING id, name, stock;
    `);
    const prodId = prodRes.rows[0].id;
    console.log(`✓ Product created: ${prodId} with initial stock: 10`);

    const prod2Res = await client.query(`
      INSERT INTO pos_products (name, price, stock, track_stock, station)
      VALUES ('Test Croissant', 4.00, 5, true, 'kitchen')
      RETURNING id, name, stock;
    `);
    const prod2Id = prod2Res.rows[0].id;
    console.log(`✓ Product 2 created: ${prod2Id} with initial stock: 5`);

    // 1. Create open dine-in tab with 2 Espressos
    const order1Id = crypto.randomUUID();
    const idemKey1 = 'idem-test-' + Date.now();
    const openRes = await client.query(`
      SELECT create_pos_order_atomic(
        $1::jsonb,
        $2::jsonb
      ) as order;
    `, [
      JSON.stringify({
        id: order1Id,
        idempotency_key: idemKey1,
        table_name: 'Table 1',
        status: 'open',
        action: 'send_kitchen',
        subtotal: 7.00,
        total: 7.70,
        service_charge: 0.70
      }),
      JSON.stringify([
        { id: prodId, name: 'Test Espresso', price: 3.50, quantity: 2, station: 'bar' }
      ])
    ]);
    console.log(`✓ Open tab created. Bill: ${openRes.rows[0].order.order_number}`);

    // Check stock after open tab
    const stockAfterOpen = (await client.query(`SELECT stock FROM pos_products WHERE id = $1`, [prodId])).rows[0].stock;
    console.log(`✓ Stock after open tab: ${stockAfterOpen} (expected 8)`);
    if (stockAfterOpen !== 8) throw new Error(`Expected stock 8, got ${stockAfterOpen}`);

    // 2. Pay the existing tab with SAME items (NO new items)
    const payRes = await client.query(`
      SELECT create_pos_order_atomic(
        $1::jsonb,
        $2::jsonb
      ) as order;
    `, [
      JSON.stringify({
        id: order1Id,
        table_name: 'Table 1',
        status: 'paid',
        action: 'pay_tab',
        subtotal: 7.00,
        total: 7.70,
        payment_method: 'cash'
      }),
      JSON.stringify([
        { id: prodId, name: 'Test Espresso', price: 3.50, quantity: 2, station: 'bar' }
      ])
    ]);
    const stockAfterPay = (await client.query(`SELECT stock FROM pos_products WHERE id = $1`, [prodId])).rows[0].stock;
    console.log(`✓ Stock after paying tab: ${stockAfterPay} (expected 8 - NO DOUBLE DEDUCTION!)`);
    if (stockAfterPay !== 8) throw new Error(`Double deduction detected! Stock is ${stockAfterPay}`);

    // 3. Add items to an open tab: create new tab with 1 Croissant, then add 1 more Croissant
    const order2Id = crypto.randomUUID();
    await client.query(`
      SELECT create_pos_order_atomic($1::jsonb, $2::jsonb);
    `, [
      JSON.stringify({ id: order2Id, table_name: 'Table 2', status: 'open', action: 'send_kitchen' }),
      JSON.stringify([{ id: prod2Id, name: 'Test Croissant', price: 4.00, quantity: 1 }])
    ]);
    let croissStock = (await client.query(`SELECT stock FROM pos_products WHERE id = $1`, [prod2Id])).rows[0].stock;
    console.log(`✓ Croissant stock after 1 ordered: ${croissStock} (expected 4)`);
    if (croissStock !== 4) throw new Error(`Expected 4, got ${croissStock}`);

    // Now waiter adds 1 more Croissant (total 2)
    await client.query(`
      SELECT create_pos_order_atomic($1::jsonb, $2::jsonb);
    `, [
      JSON.stringify({ id: order2Id, table_name: 'Table 2', status: 'open', action: 'add_items' }),
      JSON.stringify([{ id: prod2Id, name: 'Test Croissant', price: 4.00, quantity: 2 }])
    ]);
    croissStock = (await client.query(`SELECT stock FROM pos_products WHERE id = $1`, [prod2Id])).rows[0].stock;
    console.log(`✓ Croissant stock after adding 1 more: ${croissStock} (expected 3 - only delta deducted!)`);
    if (croissStock !== 3) throw new Error(`Expected 3, got ${croissStock}`);

    // 4. Idempotency retry: retry order 1 with exact same idempotency_key
    const retryRes = await client.query(`
      SELECT create_pos_order_atomic($1::jsonb, $2::jsonb) as order;
    `, [
      JSON.stringify({ idempotency_key: idemKey1, total: 7.70 }),
      JSON.stringify([{ id: prodId, name: 'Test Espresso', price: 3.50, quantity: 2 }])
    ]);
    console.log(`✓ Idempotency returned committed order: ${retryRes.rows[0].order.id}`);
    const stockAfterRetry = (await client.query(`SELECT stock FROM pos_products WHERE id = $1`, [prodId])).rows[0].stock;
    if (stockAfterRetry !== 8) throw new Error(`Idempotency re-deducted stock! Stock: ${stockAfterRetry}`);

    // 5. Oversell prevention
    let oversellCaught = false;
    try {
      await client.query(`
        SELECT create_pos_order_atomic($1::jsonb, $2::jsonb);
      `, [
        JSON.stringify({ table_name: 'Takeaway' }),
        JSON.stringify([{ id: prod2Id, name: 'Test Croissant', price: 4.00, quantity: 10 }]) // only 3 left!
      ]);
    } catch (e) {
      oversellCaught = true;
      console.log(`✓ Oversell prevented with message: "${e.message}"`);
    }
    if (!oversellCaught) throw new Error('Expected oversell error but none was thrown!');

    // 6. Void order 1: restore stock
    console.log(`Voiding order 1 (${order1Id})...`);
    await client.query(`SELECT void_pos_order_atomic($1::uuid, 'Customer cancelled');`, [order1Id]);
    const stockAfterVoid = (await client.query(`SELECT stock FROM pos_products WHERE id = $1`, [prodId])).rows[0].stock;
    console.log(`✓ Stock after void: ${stockAfterVoid} (expected 10 - restored!)`);
    if (stockAfterVoid !== 10) throw new Error(`Expected stock 10 after void, got ${stockAfterVoid}`);

    // Idempotent void call
    await client.query(`SELECT void_pos_order_atomic($1::uuid, 'Repeat void');`, [order1Id]);
    const stockAfterRepeatVoid = (await client.query(`SELECT stock FROM pos_products WHERE id = $1`, [prodId])).rows[0].stock;
    if (stockAfterRepeatVoid !== 10) throw new Error(`Repeat void altered stock!`);
    console.log(`✓ Repeat void is safely idempotent`);

    // 7. Offline provisional number mapping
    const offlineRes = await client.query(`
      SELECT create_pos_order_atomic($1::jsonb, $2::jsonb) as order;
    `, [
      JSON.stringify({ order_number: 'OFFLINE-TERM2-0042', table_name: 'Takeaway' }),
      JSON.stringify([{ id: prodId, name: 'Test Espresso', price: 3.50, quantity: 1 }])
    ]);
    const offlineOrder = offlineRes.rows[0].order;
    console.log(`✓ Offline provisional mapped: ${offlineOrder.offline_ref} -> ${offlineOrder.order_number}`);
    if (offlineOrder.offline_ref !== 'OFFLINE-TERM2-0042' || !offlineOrder.order_number.startsWith('LS-')) {
      throw new Error(`Failed to map offline provisional number correctly!`);
    }

    // 8. Deadlock prevention: concurrent orders with reverse product order
    console.log('Testing deadlock prevention with reverse cart product orders in parallel...');
    const p1 = pool.connect().then(async (c) => {
      try {
        await c.query('BEGIN');
        await c.query(`SELECT create_pos_order_atomic($1::jsonb, $2::jsonb);`, [
          JSON.stringify({ table_name: 'Takeaway' }),
          JSON.stringify([
            { id: prodId, name: 'Test Espresso', price: 3.50, quantity: 1 },
            { id: prod2Id, name: 'Test Croissant', price: 4.00, quantity: 1 }
          ])
        ]);
        await c.query('COMMIT');
      } finally {
        c.release();
      }
    });

    const p2 = pool.connect().then(async (c) => {
      try {
        await c.query('BEGIN');
        await c.query(`SELECT create_pos_order_atomic($1::jsonb, $2::jsonb);`, [
          JSON.stringify({ table_name: 'Takeaway' }),
          JSON.stringify([
            // Reversed order!
            { id: prod2Id, name: 'Test Croissant', price: 4.00, quantity: 1 },
            { id: prodId, name: 'Test Espresso', price: 3.50, quantity: 1 }
          ])
        ]);
        await c.query('COMMIT');
      } finally {
        c.release();
      }
    });

    await Promise.all([p1, p2]);
    console.log(`✓ Concurrent transactions with reversed cart orders completed without deadlock!`);

    console.log('\nALL DATABASE CORE TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
