// Comprehensive test for POS Dine-In Order -> Occupied Table -> Close Table workflow
const BASE_URL = process.env.TEST_URL || "http://localhost:3005"

async function run() {
  console.log("=== Testing POS Dine-in & Close Table Flow ===")

  // 1. Initial GET /api/tables
  const res1 = await fetch(`${BASE_URL}/api/tables`)
  if (!res1.ok) throw new Error(`GET /api/tables failed: ${res1.status}`)
  const data1 = await res1.json()
  console.log(`✓ Fetched ${data1.tables.length} tables from server.`)

  const table6 = data1.tables.find(t => t.name.replace(/Table 0?(\d+)/i, 'Table $1') === 'Table 6' || t.name.toLowerCase() === 'table 06')
  const testTableName = table6 ? table6.name : "Table 06"
  if (!table6) throw new Error(`Could not find ${testTableName}`)
  console.log(`✓ Initial status of ${testTableName}: ${table6.status}`)

  // Ensure it's released first
  if (table6.status !== "available") {
    console.log(`Releasing ${testTableName} to start clean...`)
    await fetch(`${BASE_URL}/api/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release", tableId: table6.id, tableName: table6.name }),
    })
  }

  // 2. Occupy Table 6 with a new Dine-in Order
  const orderNumber = `ORD-TEST-${Date.now().toString().slice(-4)}`
  console.log(`Occupying ${testTableName} with order ${orderNumber}...`)
  const occupyRes = await fetch(`${BASE_URL}/api/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "occupy",
      tableId: table6.id,
      tableName: table6.name,
      orderNumber,
      orderTotal: 3200,
      guestName: "Guest Dining Party",
      department: "Juice & Food",
    }),
  })
  const occupyData = await occupyRes.json()
  if (!occupyData.success) throw new Error(`Occupy failed: ${JSON.stringify(occupyData)}`)
  console.log(`✓ Server response for occupy: table status is ${occupyData.table.status}`)

  // 3. Verify GET /api/tables reflects Occupied & linked order
  const res2 = await fetch(`${BASE_URL}/api/tables`)
  const data2 = await res2.json()
  const table6After = data2.tables.find(t => t.name.toLowerCase() === testTableName.toLowerCase())
  if (!table6After) throw new Error(`${testTableName} missing in response`)
  if (table6After.status !== "occupied") {
    throw new Error(`Expected ${testTableName} to be occupied, got ${table6After.status}`)
  }
  if (table6After.orderNumber !== orderNumber) {
    throw new Error(`Expected orderNumber ${orderNumber}, got ${table6After.orderNumber}`)
  }
  console.log(`✓ GET /api/tables confirms ${testTableName} is OCCUPIED with Order #${table6After.orderNumber}`)

  // 4. Close Table 6 (Customers leave)
  console.log(`Closing ${testTableName} (guests left)...`)
  const releaseRes = await fetch(`${BASE_URL}/api/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "release",
      tableId: table6.id,
      tableName: table6.name,
    }),
  })
  const releaseData = await releaseRes.json()
  if (!releaseData.success) throw new Error(`Release failed: ${JSON.stringify(releaseData)}`)
  console.log(`✓ Server response for release/close: status is ${releaseData.status}`)

  // 5. Verify GET /api/tables reflects Available again
  const res3 = await fetch(`${BASE_URL}/api/tables`)
  const data3 = await res3.json()
  const table6Freed = data3.tables.find(t => t.name.toLowerCase() === testTableName.toLowerCase())
  if (table6Freed.status !== "available") {
    throw new Error(`Expected ${testTableName} to be available, got ${table6Freed.status}`)
  }
  if (table6Freed.orderNumber) {
    throw new Error(`Expected orderNumber to be cleared from table, got ${table6Freed.orderNumber}`)
  }
  console.log(`✓ GET /api/tables confirms ${testTableName} is now AVAILABLE and free for new orders`)

  console.log("=== All Tests Passed Successfully! ===")
}

run().catch(err => {
  console.error("Test failed:", err)
  process.exit(1)
})
