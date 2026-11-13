// scripts/test-recipe-lifecycle.mjs
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/pos_test'
});

async function run() {
  const client = await pool.connect();
  console.log('Testing Recipe Ingredient Lifecycle...\n');

  try {
    // 1. Get Velvet Flat White
    const prodRes = await client.query("SELECT id, name, stock FROM pos_products WHERE name = 'Velvet Flat White'");
    if (prodRes.rows.length === 0) {
      throw new Error('Velvet Flat White not found');
    }
    const prod = prodRes.rows[0];
    console.log(`✓ Product found: ${prod.name} (${prod.id}), Stock: ${prod.stock}`);

    // 2. Read recipe components
    const recipeRes = await client.query(`
      SELECT ri.id, ri.ingredient_id, ri.quantity_base, i.name as ingredient_name, i.current_stock_base, i.base_unit
      FROM recipe_items ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE ri.product_id = $1
    `, [prod.id]);

    console.log('Recipe Items:');
    for (const r of recipeRes.rows) {
      console.log(`  - ${r.ingredient_name}: ${r.quantity_base} ${r.base_unit} per item (Current stock: ${r.current_stock_base} ${r.base_unit})`);
    }

    const initialStocks = new Map();
    for (const r of recipeRes.rows) {
      initialStocks.set(r.ingredient_id, parseFloat(r.current_stock_base));
    }

    // 3. Create an order for 2 Velvet Flat Whites
    const qtyOrdered = 2;
    console.log(`\nPlacing order for ${qtyOrdered}x ${prod.name}...`);
    const orderRes = await client.query(`
      SELECT create_pos_order_atomic($1::jsonb, $2::jsonb) as ord;
    `, [
      JSON.stringify({ table_name: 'Table 5', cashier_name: 'Barista Alice' }),
      JSON.stringify([{
        id: prod.id,
        name: prod.name,
        price: 5.50,
        quantity: qtyOrdered,
        station: 'bar'
      }])
    ]);

    const order = orderRes.rows[0].ord;
    console.log(`✓ Order placed: ${order.order_number} (UUID: ${order.id})`);

    // 4. Verify deductions
    console.log('\nChecking ingredient deductions:');
    for (const r of recipeRes.rows) {
      const currentRes = await client.query('SELECT current_stock_base FROM ingredients WHERE id = $1', [r.ingredient_id]);
      const currentStock = parseFloat(currentRes.rows[0].current_stock_base);
      const expectedStock = initialStocks.get(r.ingredient_id) - (parseFloat(r.quantity_base) * qtyOrdered);
      console.log(`  - ${r.ingredient_name}: Was ${initialStocks.get(r.ingredient_id)}, Now ${currentStock} (Expected ${expectedStock})`);
      if (Math.abs(currentStock - expectedStock) > 0.001) {
        throw new Error(`Stock mismatch for ${r.ingredient_name}: expected ${expectedStock}, got ${currentStock}`);
      }
    }
    console.log('✓ All recipe ingredients deducted accurately!');

    // 5. Verify movement logs
    const movements = await client.query('SELECT * FROM ingredient_stock_movements WHERE reference = $1', [order.id]);
    console.log(`✓ Movement log recorded ${movements.rows.length} ingredient movements for order ${order.order_number}`);

    // 6. Void the order
    console.log('\nVoiding the order...');
    await client.query('SELECT void_pos_order_atomic($1::uuid, $2::text)', [order.id, 'Customer cancellation']);
    console.log('✓ Order voided successfully');

    // 7. Verify stock restored
    console.log('\nChecking ingredient restoration:');
    for (const r of recipeRes.rows) {
      const currentRes = await client.query('SELECT current_stock_base FROM ingredients WHERE id = $1', [r.ingredient_id]);
      const restoredStock = parseFloat(currentRes.rows[0].current_stock_base);
      const expectedStock = initialStocks.get(r.ingredient_id);
      console.log(`  - ${r.ingredient_name}: Restored to ${restoredStock} (Expected ${expectedStock})`);
      if (Math.abs(restoredStock - expectedStock) > 0.001) {
        throw new Error(`Stock restoration mismatch for ${r.ingredient_name}: expected ${expectedStock}, got ${restoredStock}`);
      }
    }
    console.log('✓ All recipe ingredients fully restored upon void!');

    console.log('\nRECIPE INGREDIENT DEDUCTION & VOID RESTORATION TEST PASSED 100%!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
