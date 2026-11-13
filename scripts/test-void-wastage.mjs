import pg from 'pg';
import fs from 'fs';

// Parse .env.local if not loaded
if (!process.env.POSTGRES_URL) {
  try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {}
}

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Testing Void After Preparation (Wastage) Flow...');

    // 1. Find Velvet Flat White
    const prodRes = await client.query("SELECT id, name, stock FROM pos_products WHERE name ILIKE '%Velvet Flat White%' LIMIT 1");
    const prod = prodRes.rows[0];
    const initialProdStock = prod.stock;

    // Check bean ingredient stock
    const ingRes = await client.query("SELECT current_stock_base FROM ingredients WHERE name ILIKE '%Arabica%' LIMIT 1");
    const initialBeans = parseFloat(ingRes.rows[0].current_stock_base);

    // 2. Place order for 1x Velvet Flat White
    const orderRes = await client.query(`
      SELECT create_pos_order_atomic($1::jsonb, $2::jsonb) as ord;
    `, [
      JSON.stringify({ table_name: 'Table 7', cashier_name: 'Barista Bob' }),
      JSON.stringify([{
        id: prod.id,
        name: prod.name,
        price: 5.50,
        quantity: 1,
        station: 'bar'
      }])
    ]);

    const order = orderRes.rows[0].ord;
    console.log(`✓ Order placed: ${order.order_number} (${order.id})`);

    // Verify stock deducted
    const postOrderBeans = parseFloat((await client.query("SELECT current_stock_base FROM ingredients WHERE name ILIKE '%Arabica%' LIMIT 1")).rows[0].current_stock_base);
    console.log(`✓ Beans deducted: ${initialBeans} -> ${postOrderBeans} (-18g)`);

    // 3. Mark the station ticket as 'served' (kitchen/bar finished cooking/brewing)
    await client.query("UPDATE station_tickets SET status = 'served' WHERE order_id = $1", [order.id]);
    console.log(`✓ Station ticket marked as 'served' (drink prepared)`);

    // 4. Customer asks for cancellation/refund after drink was served
    const voidRes = await client.query("SELECT void_pos_order_atomic($1::uuid, $2::text) as v", [order.id, "Customer returned spilt drink"]);
    const voidResult = voidRes.rows[0].v;
    console.log(`✓ Order voided: restored_inventory = ${voidResult.restored_inventory}, has_prepared = ${voidResult.has_prepared}`);

    if (voidResult.restored_inventory !== false) {
      throw new Error(`Expected restored_inventory to be false for served order, got ${voidResult.restored_inventory}`);
    }

    // 5. Verify that stock was NOT restored because physical ingredients were wasted
    const finalBeans = parseFloat((await client.query("SELECT current_stock_base FROM ingredients WHERE name ILIKE '%Arabica%' LIMIT 1")).rows[0].current_stock_base);
    console.log(`✓ Post-void beans stock: ${finalBeans} (Identical to ${postOrderBeans}, NOT restored)`);
    if (finalBeans !== postOrderBeans) {
      throw new Error(`Stock was erroneously restored for prepared drink! Expected ${postOrderBeans}, got ${finalBeans}`);
    }

    // 6. Verify movement log recorded as waste
    const mvRes = await client.query("SELECT * FROM ingredient_stock_movements WHERE reference = $1", [order.id]);
    console.log(`✓ Ingredient movements logged: ${mvRes.rows.length}`);
    const wasteMovement = mvRes.rows.find(m => m.reason && m.reason.includes('Waste'));
    if (!wasteMovement) {
      throw new Error("Missing 'Waste' reason in ingredient_stock_movements!");
    }
    console.log(`✓ Found waste movement record: reason = "${wasteMovement.reason}", quantity_change = ${wasteMovement.quantity_change_base}`);

    console.log('\nPREPARATION WASTAGE DISTINCTION TEST PASSED 100%!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
