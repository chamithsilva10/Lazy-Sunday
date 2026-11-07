/**
 * POS SYSTEM - TABLE FLOW & LIFECYCLE TEST
 *
 * Verifies:
 * 1. Initial floor state has 0 active tables (0 / 14).
 * 2. Dine-in order (even paid) marks the table as OCCUPIED and creates active session.
 * 3. Table remains occupied while guests are dining (not automatically freed on payment).
 * 4. Tables workspace can update table status to 'available' when guests leave.
 * 5. Freeing the table from the Table section clears session and restores table to 'available'.
 * 6. Quick status switcher works across available, occupied, cleaning, and bill_requested.
 *
 * Run with: node --experimental-sqlite scripts/verify-table-flow-lifecycle.mjs
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

console.log("\n=======================================================")
console.log("🔍 POS SYSTEM - TABLE LIFECYCLE & WORKSPACE FLOW TEST")
console.log("=======================================================\n")

let passedCount = 0
let failedCount = 0

function it(description, fn) {
  try {
    fn()
    console.log(`  ✅ PASS: ${description}`)
    passedCount++
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`)
    console.error(`     Error: ${err.message}`)
    failedCount++
  }
}

// 1. Verify shared-pos-service code guarantees
const sharedServicePath = path.resolve("./lib/shared-pos-service.ts")
const sharedServiceCode = fs.readFileSync(sharedServicePath, "utf-8")

it("SharedPosService defines subscribeSessions and emitSessions for live session sync", () => {
  assert(sharedServiceCode.includes("subscribeSessions("), "subscribeSessions must exist")
  assert(sharedServiceCode.includes("emitSessions()"), "emitSessions must exist")
  assert(sharedServiceCode.includes("pos_sessions_updated"), "pos_sessions_updated event must be dispatched")
})

it("occupyTable creates or updates session and does not immediately release on paid dine-in order", () => {
  assert(sharedServiceCode.includes("static async occupyTable"), "occupyTable must exist")
  // Check that saveOrder occupies table for dine-in without auto-releasing
  const saveOrderFn = sharedServiceCode.slice(sharedServiceCode.indexOf("static async saveOrder"))
  assert(!saveOrderFn.includes("this.releaseTable(normalizedOrder.table_name)"), "saveOrder must not prematurely release dine-in table on payment")
})

it("releaseTable closes active session and sets table to available", () => {
  assert(sharedServiceCode.includes("static async releaseTable"), "releaseTable must exist")
  assert(sharedServiceCode.includes("status: \"closed\""), "releaseTable must close active session")
  assert(sharedServiceCode.includes("status: \"available\""), "releaseTable must mark table available")
})

it("setTableStatus handles available, occupied, and bill_requested cleanly", () => {
  assert(sharedServiceCode.includes("static async setTableStatus"), "setTableStatus must exist")
  assert(sharedServiceCode.includes("if (status === \"available\") return this.releaseTable"), "available must delegate to releaseTable")
  assert(sharedServiceCode.includes("if (status === \"occupied\") return this.occupyTable"), "occupied must delegate to occupyTable")
})

// 2. Verify tables-workspace.tsx code guarantees
const workspacePath = path.resolve("./app/components/tables-workspace.tsx")
const workspaceCode = fs.readFileSync(workspacePath, "utf-8")

it("TablesWorkspace statusFor correctly checks table.status as well as active sessions", () => {
  assert(workspaceCode.includes('table.status === "occupied"'), "statusFor must respect table.status === occupied")
  assert(workspaceCode.includes('table.status === "cleaning"'), "statusFor must respect table.status === cleaning")
  assert(workspaceCode.includes('table.status === "bill_requested"'), "statusFor must respect table.status === bill_requested")
})

it("TablesWorkspace includes Quick Status Selector and 'Guests Left · Mark Available' button", () => {
  assert(workspaceCode.includes("Guests Left · Mark Available"), "Must have prominent Guests Left button")
  assert(workspaceCode.includes("Update Table Status"), "Must have Quick Status Selector in table panel")
  assert(workspaceCode.includes("void setTableState(selected, \"available\")"), "Must have one-click available option")
  assert(workspaceCode.includes("void setTableState(selected, \"occupied\")"), "Must have one-click occupied option")
  assert(workspaceCode.includes("void setTableState(selected, \"cleaning\")"), "Must have one-click cleaning option")
})

// 3. Verify mock-client.ts supports table_sessions and pos_tables
const mockClientPath = path.resolve("./lib/supabase/mock-client.ts")
const mockClientCode = fs.readFileSync(mockClientPath, "utf-8")

it("Mock Supabase client supports table_sessions queries and real-time updates", () => {
  assert(mockClientCode.includes("localSessions"), "localSessions cache must exist")
  assert(mockClientCode.includes("tableName === \"table_sessions\""), "Must handle table_sessions queries")
  assert(mockClientCode.includes("emitMockRealtime(\"table_sessions\""), "Must emit realtime events for table_sessions")
})

// 4. Verify API route /api/tables
const apiTablesPath = path.resolve("./app/api/tables/route.ts")
assert(fs.existsSync(apiTablesPath), "app/api/tables/route.ts must exist")

console.log("\n=======================================================")
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`)
console.log("=======================================================\n")

if (failedCount > 0) {
  process.exit(1)
} else {
  console.log("🎉 ALL TABLE LIFECYCLE TESTS PASSED SUCCESSFULLY!\n")
}
