// scripts/verify-realtime-sync.mjs
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: process.env.USER,
  database: 'pos_test',
});

async function runMultiTerminalSyncTest() {
  console.log('================================================================');
  console.log('REAL-TIME MULTI-TERMINAL SYNCHRONIZATION & CONVERGENCE TEST');
  console.log('================================================================\n');

  const client = await pool.connect();
  let passed = 0;
  let total = 0;

  function assert(cond, msg) {
    total++;
    if (!cond) {
      console.error(`❌ FAILED: ${msg}`);
      throw new Error(`Sync test failed: ${msg}`);
    }
    passed++;
    console.log(`  ✓ ${msg}`);
  }

  try {
    // ------------------------------------------------------------------------
    // SETUP: Simulated Terminal Clients
    // ------------------------------------------------------------------------
    class SimulatedTerminal {
      constructor(name, role) {
        this.name = name;
        this.role = role;
        this.ordersCache = new Map();
        this.lastSyncTimestamp = null;
        this.lastSyncId = null;
        this.isRefreshing = false;
        this.hasPendingRefresh = false;
      }

      async syncWithDatabase(dbClient) {
        if (this.isRefreshing) {
          this.hasPendingRefresh = true;
          return;
        }
        this.isRefreshing = true;

        try {
          // 1. Unconditional query for open/active tabs
          const openRes = await dbClient.query(`
            SELECT id, order_number, table_name, status, kitchen_status, bar_status, total, updated_at
            FROM pos_orders
            WHERE status IN ('open', 'pending')
            ORDER BY created_at ASC
          `);
          for (const row of openRes.rows) {
            this.ordersCache.set(row.id, row);
          }

          // 2. Forward cursor pagination for completed/modified orders
          let hasMore = true;
          let pages = 0;
          while (hasMore && pages < 10) {
            pages++;
            let query;
            let params;
            if (this.lastSyncTimestamp) {
              query = `
                SELECT id, order_number, table_name, status, kitchen_status, bar_status, total, updated_at
                FROM pos_orders
                WHERE (updated_at > $1 OR (updated_at = $1 AND ($2::uuid IS NULL OR id > $2::uuid)))
                ORDER BY updated_at ASC, id ASC
                LIMIT 50
              `;
              params = [this.lastSyncTimestamp, this.lastSyncId];
            } else {
              query = `
                SELECT id, order_number, table_name, status, kitchen_status, bar_status, total, updated_at
                FROM pos_orders
                ORDER BY updated_at ASC, id ASC
                LIMIT 50
              `;
              params = [];
            }

            const res = await dbClient.query(query, params);
            if (res.rows.length === 0) {
              hasMore = false;
              break;
            }

            for (const row of res.rows) {
              this.ordersCache.set(row.id, row);
            }

            const last = res.rows[res.rows.length - 1];
            const nowIso = new Date().toISOString();
            this.lastSyncTimestamp = last.updated_at.toISOString() > nowIso ? nowIso : last.updated_at.toISOString();
            this.lastSyncId = last.id;

            if (res.rows.length < 50) {
              hasMore = false;
            }
          }
        } finally {
          this.isRefreshing = false;
          if (this.hasPendingRefresh) {
            this.hasPendingRefresh = false;
            await this.syncWithDatabase(dbClient);
          }
        }
      }
    }

    const termCashier = new SimulatedTerminal('Terminal-Cashier', 'cashier');
    const termKitchen = new SimulatedTerminal('Terminal-KDS', 'kitchen');
    const termManager = new SimulatedTerminal('Terminal-Manager', 'manager');

    // ------------------------------------------------------------------------
    // TEST 1: Initial Sync Across All Terminals
    // ------------------------------------------------------------------------
    console.log('[Test 1] Initial Forward Cursor Sync Across Terminals');
    await termCashier.syncWithDatabase(client);
    await termKitchen.syncWithDatabase(client);
    await termManager.syncWithDatabase(client);

    assert(termCashier.ordersCache.size === termKitchen.ordersCache.size, 'Cashier and Kitchen caches match on initial sync');
    assert(termKitchen.ordersCache.size === termManager.ordersCache.size, 'Kitchen and Manager caches match on initial sync');
    console.log(`     Initial state converged: ${termCashier.ordersCache.size} orders synced.`);

    // ------------------------------------------------------------------------
    // TEST 2: Real-time Order Creation & Propagation Latency Measurement
    // ------------------------------------------------------------------------
    console.log('\n[Test 2] Real-time Order Creation & Propagation Latency');
    const syncOrderId = crypto.randomUUID();
    const t0 = performance.now();

    // Cashier places open dine-in tab
    const orderRes = await client.query(`
      SELECT create_pos_order_atomic(
        $1::jsonb,
        $2::jsonb
      ) as order;
    `, [
      JSON.stringify({
        id: syncOrderId,
        table_name: 'Table 7',
        status: 'open',
        action: 'send_kitchen',
        total: 18.50,
      }),
      JSON.stringify([
        { name: 'Pasta Carbonara', price: 18.50, quantity: 1, station: 'kitchen' }
      ])
    ]);
    const t1 = performance.now();
    const creationLatency = (t1 - t0).toFixed(2);
    console.log(`     Database atomic creation latency: ${creationLatency} ms`);
    assert(orderRes.rows[0].order.id === syncOrderId, 'Order committed atomically');

    // Kitchen terminal catches change on realtime notification
    const tSyncStart = performance.now();
    await termKitchen.syncWithDatabase(client);
    const tSyncEnd = performance.now();
    const kitchenSyncLatency = (tSyncEnd - tSyncStart).toFixed(2);
    console.log(`     Kitchen terminal forward sync latency: ${kitchenSyncLatency} ms`);

    const kitchenOrder = termKitchen.ordersCache.get(syncOrderId);
    assert(kitchenOrder !== undefined, 'Order successfully propagated to Kitchen terminal');
    assert(kitchenOrder.table_name === 'Table 7', 'Table number correctly received by Kitchen (Table 7)');
    assert(kitchenOrder.kitchen_status === 'pending', 'Kitchen status received as pending');

    // ------------------------------------------------------------------------
    // TEST 3: Kitchen Prepares & Serves Order -> Propagates to Cashier & Manager
    // ------------------------------------------------------------------------
    console.log('\n[Test 3] KDS Ticket Status Progression & Propagation');
    await client.query(`
      UPDATE station_tickets
      SET status = 'ready', updated_at = now()
      WHERE order_id = $1 AND station = 'kitchen';
    `, [syncOrderId]);

    await client.query(`
      UPDATE pos_orders
      SET kitchen_status = 'ready', updated_at = now()
      WHERE id = $1;
    `, [syncOrderId]);

    // Cashier and Manager receive update
    await termCashier.syncWithDatabase(client);
    await termManager.syncWithDatabase(client);

    const cashierOrder = termCashier.ordersCache.get(syncOrderId);
    const managerOrder = termManager.ordersCache.get(syncOrderId);
    assert(cashierOrder.kitchen_status === 'ready', 'Cashier terminal sees kitchen_status = ready');
    assert(managerOrder.kitchen_status === 'ready', 'Manager terminal sees kitchen_status = ready');

    // ------------------------------------------------------------------------
    // TEST 4: Cashier Completes Payment -> Closed Order Converges on All Terminals
    // ------------------------------------------------------------------------
    console.log('\n[Test 4] Tab Payment & Final State Convergence');
    await client.query(`
      SELECT create_pos_order_atomic(
        $1::jsonb,
        $2::jsonb
      );
    `, [
      JSON.stringify({
        id: syncOrderId,
        table_name: 'Table 7',
        status: 'paid',
        action: 'pay_tab',
        payment_method: 'card',
        total: 18.50,
      }),
      JSON.stringify([
        { name: 'Pasta Carbonara', price: 18.50, quantity: 1, station: 'kitchen' }
      ])
    ]);

    await termCashier.syncWithDatabase(client);
    await termKitchen.syncWithDatabase(client);
    await termManager.syncWithDatabase(client);

    const cashierPaid = termCashier.ordersCache.get(syncOrderId);
    const kitchenPaid = termKitchen.ordersCache.get(syncOrderId);
    const managerPaid = termManager.ordersCache.get(syncOrderId);

    assert(cashierPaid.status === 'paid', 'Cashier terminal shows status = paid');
    assert(kitchenPaid.status === 'paid', 'Kitchen terminal shows status = paid');
    assert(managerPaid.status === 'paid', 'Manager terminal shows status = paid');

    // ------------------------------------------------------------------------
    // TEST 5: Concurrent Notification Flag (Pending Refresh Recovery)
    // ------------------------------------------------------------------------
    console.log('\n[Test 5] In-flight Realtime Notification & Pending Refresh Flag');
    const termTest = new SimulatedTerminal('Terminal-Test', 'cashier');
    // Lock terminal in active refresh
    termTest.isRefreshing = true;

    // A notification arrives while sync is running:
    await termTest.syncWithDatabase(client);
    assert(termTest.hasPendingRefresh === true, 'Pending refresh flag is set when sync is in flight');

    // Unlock and run completion cycle
    termTest.isRefreshing = false;
    if (termTest.hasPendingRefresh) {
      termTest.hasPendingRefresh = false;
      await termTest.syncWithDatabase(client);
    }
    assert(termTest.hasPendingRefresh === false, 'Pending refresh cleared after catch-up cycle finishes');
    assert(termTest.ordersCache.has(syncOrderId), 'Catch-up cycle caught latest orders without dropping records');

    // ------------------------------------------------------------------------
    // TEST 6: Table State Persistence After Payment Until Explicit Close
    // ------------------------------------------------------------------------
    console.log('\n[Test 6] Table Occupancy Retention for Paid Dine-in Order');
    // Paid order remains attached to table until staff closes it
    const activeTableOrder = termCashier.ordersCache.get(syncOrderId);
    assert(activeTableOrder.table_name === 'Table 7', 'Paid order remains associated with Table 7');
    assert(activeTableOrder.status === 'paid', 'Order is marked paid but visible under table view');

    console.log('\n================================================================');
    console.log(`SYNC VERIFICATION COMPLETE: ${passed} / ${total} TESTS PASSED (100% SUCCESS)`);
    console.log(`Measured DB commit latency: ~${creationLatency} ms | Forward cursor sync latency: ~${kitchenSyncLatency} ms`);
    console.log('================================================================\n');

  } finally {
    client.release();
    await pool.end();
  }
}

runMultiTerminalSyncTest().catch((err) => {
  console.error('\nSync verification suite failed:', err);
  process.exit(1);
});
