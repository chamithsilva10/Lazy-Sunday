import pg from 'pg';
import fs from 'fs';
import assert from 'node:assert/strict';

// Load .env.local
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
const BASE_URL = process.env.TEST_URL || 'http://localhost:3005';

async function run() {
  const client = await pool.connect();
  let passed = 0;
  let total = 0;

  function it(name, fn) {
    total++;
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     ${err.message}`);
        throw err;
      }
    })();
  }

  console.log('================================================================');
  console.log('🧪 VERIFYING POS BUSINESS RULES, DISCOUNTS, PAYMENTS & RECONCILIATION');
  console.log('================================================================\n');

  try {
    // ------------------------------------------------------------------------
    // 1. Authenticate Cashier & Manager
    // ------------------------------------------------------------------------
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' })
    });
    assert.strictEqual(loginRes.status, 200);
    const cashierCookies = loginRes.headers.getSetCookie().map(c => c.split(';')[0].trim()).join('; ');

    const mgrLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.strictEqual(mgrLoginRes.status, 200);
    const mgrCookies = mgrLoginRes.headers.getSetCookie().map(c => c.split(';')[0].trim()).join('; ');

    // ------------------------------------------------------------------------
    // 2. Partial and Split Payments (Cash + Card, Tendered > Total)
    // ------------------------------------------------------------------------
    console.log('--- 1. Partial & Split Payments ---');

    await it('Split payment: 1000 Cash (tendered 1500, change 500) + 1000 Card = 2000 Total', async () => {
      const splitLines = [
        { id: 'split-1', method: 'cash', amount: 1000, tendered: 1500, change_due: 500 },
        { id: 'split-2', method: 'card', amount: 1000, reference: 'TX-CARD-9912' }
      ];

      const res = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cashierCookies },
        body: JSON.stringify({
          table_name: 'Takeaway',
          order_type: 'takeaway',
          cashier_name: 'Cashier Alice',
          subtotal: 2000,
          total: 2000,
          payment_method: 'split',
          split_payments: splitLines,
          cash_received: 1500,
          change_amount: 500,
          status: 'paid',
          items: [{ name: 'Assorted Pastries', price: 2000, quantity: 1, station: 'kitchen' }]
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(Number(data.order.total), 2000);
      assert.strictEqual(Number(data.order.cash_received), 1500);
      assert.strictEqual(Number(data.order.change_amount), 500);
      assert.strictEqual(data.order.payment_method, 'split');

      // Verify in DB
      const dbRow = (await client.query("SELECT * FROM pos_orders WHERE id = $1", [data.order.id])).rows[0];
      assert.strictEqual(Number(dbRow.total), 2000);
      assert.strictEqual(Number(dbRow.cash_received), 1500);
      assert.strictEqual(Number(dbRow.change_amount), 500);
      const parsedNotes = JSON.parse(dbRow.notes);
      assert(Array.isArray(parsedNotes.split_payments));
      assert.strictEqual(parsedNotes.split_payments.length, 2);
      assert.strictEqual(parsedNotes.split_payments[0].method, 'cash');
      assert.strictEqual(parsedNotes.split_payments[0].amount, 1000);
      assert.strictEqual(parsedNotes.split_payments[1].method, 'card');
      assert.strictEqual(parsedNotes.split_payments[1].reference, 'TX-CARD-9912');
    });

    // ------------------------------------------------------------------------
    // 3. Discounts, Service Charges, and Taxes
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Discounts, Service Charges & Tax Interactions ---');

    await it('Discount calculation: Subtotal 1000 - Discount 100 + Service Charge 10% (90) = Total 990', async () => {
      const subtotal = 1000;
      const discount = 100; // 10%
      const serviceChargeRate = 0.10;
      const serviceCharge = (subtotal - discount) * serviceChargeRate; // 90
      const total = subtotal - discount + serviceCharge; // 990

      const res = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cashierCookies },
        body: JSON.stringify({
          table_name: 'Table 4',
          order_type: 'dine_in',
          cashier_name: 'Cashier Alice',
          subtotal,
          discount,
          service_charge: serviceCharge,
          service_charge_rate: serviceChargeRate,
          tax: 0,
          total,
          payment_method: 'cash',
          cash_received: 1000,
          change_amount: 10,
          status: 'paid',
          items: [{ name: 'Main Course Special', price: 1000, quantity: 1, station: 'kitchen' }]
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(Number(data.order.subtotal), 1000);
      assert.strictEqual(Number(data.order.discount), 100);
      assert.strictEqual(Number(data.order.service_charge), 90);
      assert.strictEqual(Number(data.order.total), 990);
      assert.strictEqual(Number(data.order.change_amount), 10);
    });

    // ------------------------------------------------------------------------
    // 4. Rounding & Exact Change Due
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Rounding & Change Calculation ---');

    await it('Change calculation: Total 750, Tendered 1000 -> Change due 250', async () => {
      const res = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cashierCookies },
        body: JSON.stringify({
          table_name: 'Takeaway',
          order_type: 'takeaway',
          cashier_name: 'Cashier Alice',
          subtotal: 750,
          total: 750,
          payment_method: 'cash',
          cash_received: 1000,
          change_amount: 250,
          status: 'paid',
          items: [{ name: 'Ceylon Cinnamon Tea', price: 750, quantity: 1, station: 'bar' }]
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(Number(data.order.cash_received), 1000);
      assert.strictEqual(Number(data.order.change_amount), 250);
      assert.strictEqual(Number(data.order.total), 750);
    });

    // ------------------------------------------------------------------------
    // 5. Reports Reconciliation Against Database
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Reports & Analytics Database Reconciliation ---');

    await it('GET /api/reports totalSales matches authoritative SELECT SUM(total)', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`${BASE_URL}/api/reports?startDate=${today}&endDate=${today}`, {
        headers: { 'Cookie': mgrCookies }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      const reportTotalSales = data.report.totalSales;

      // Query raw database directly for today
      const dbAggregate = await client.query(`
        SELECT 
          COALESCE(SUM(total), 0) as total_sales,
          COUNT(*) as bill_count
        FROM pos_orders
        WHERE is_void = false
          AND status IN ('paid', 'completed')
          AND created_at >= (CURRENT_DATE at time zone 'UTC')
      `);
      const expectedDbTotal = parseFloat(dbAggregate.rows[0].total_sales);
      const expectedDbCount = parseInt(dbAggregate.rows[0].bill_count, 10);

      console.log(`     Report Total Sales: ${reportTotalSales} | DB Direct SUM(total): ${expectedDbTotal}`);
      console.log(`     Report Bill Count: ${data.report.billCount} | DB Direct COUNT(*): ${expectedDbCount}`);

      assert(Math.abs(reportTotalSales - expectedDbTotal) < 0.01, `Report totalSales (${reportTotalSales}) must reconcile with DB (${expectedDbTotal})`);
      assert.strictEqual(data.report.billCount, expectedDbCount, `Report bill count (${data.report.billCount}) must match DB count (${expectedDbCount})`);
    });

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passed} / ${total} BUSINESS RULES & CALCULATIONS VERIFIED!`);
    console.log('================================================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
