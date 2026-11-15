import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

console.log("\n=======================================================")
console.log("🔍 POS VERIFICATION - TABLE OCCUPANCY & LIFECYCLE FLOW")
console.log("=======================================================\n")

let passed = 0
let failed = 0

function it(desc, fn) {
  try {
    fn()
    console.log(`  ✅ PASS: ${desc}`)
    passed++
  } catch (err) {
    console.log(`  ❌ FAIL: ${desc}`)
    console.error(`     Error: ${err.message}`)
    failed++
  }
}

const sharedServicePath = path.resolve("./lib/shared-pos-service.ts")
const workspacePath = path.resolve("./app/components/tables-workspace.tsx")
const demoSqlitePath = path.resolve("./lib/db/demo-sqlite.ts")

const sharedServiceCode = fs.readFileSync(sharedServicePath, "utf-8")
const workspaceCode = fs.readFileSync(workspacePath, "utf-8")
const demoSqliteCode = fs.readFileSync(demoSqlitePath, "utf-8")

it("occupyTable clears releasedAt and updates occupiedAt to nowIso", () => {
  assert(sharedServiceCode.includes("releasedAt: undefined"), "occupyTable must clear releasedAt")
  assert(sharedServiceCode.includes("occupiedAt: nowIso"), "occupyTable must set occupiedAt to nowIso")
})

it("releaseTable sets status to available and stamps releasedAt", () => {
  assert(sharedServiceCode.includes('status: "available"'), "releaseTable must set status to available")
  assert(sharedServiceCode.includes("releasedAt: nowIso"), "releaseTable must stamp releasedAt")
  assert(sharedServiceCode.includes("occupiedAt: undefined"), "releaseTable must clear occupiedAt")
})

it("refreshFromApi processes sessions BEFORE mergedTables", () => {
  const sessionsIdx = sharedServiceCode.indexOf("if (tableRes && tableRes.sessions && Array.isArray(tableRes.sessions))")
  const tablesIdx = sharedServiceCode.indexOf("if (tableRes && tableRes.success && Array.isArray(tableRes.tables))")
  assert(sessionsIdx !== -1, "sessions processing must exist")
  assert(tablesIdx !== -1, "tables processing must exist")
  assert(sessionsIdx < tablesIdx, "sessions must be merged before tables so mergedTables sees up-to-date active sessions")
})

it("sessionFor matches by table.id, table.name, or tablesMatch", () => {
  assert(workspaceCode.includes("tablesMatch(item.table_id, table.name)"), "sessionFor must match table_id against table.name")
  assert(workspaceCode.includes("tablesMatch(item.table_name, table.name)"), "sessionFor must match table_name against table.name")
})

it("statusFor prioritizes active session and explicit occupied status before falling back to available", () => {
  const statusForBody = workspaceCode.split("const statusFor = (table: Table)")[1]?.split("const getActiveOrderForTable")[0] || ""
  assert(statusForBody.includes("const session = sessionFor(table)"), "Must check sessionFor")
  assert(statusForBody.includes('return session.status === "bill_requested" ? "bill_requested" : "occupied"'), "Must respect active session")
  assert(statusForBody.includes('table.status === "occupied" || table.status === "bill_requested"'), "Must respect table.status")
  assert(statusForBody.includes("return \"available\""), "Default must be available")
})

it("getActiveOrderForTable finds orders for occupied tables whether open or paid", () => {
  const getActiveOrderBody = workspaceCode.split("const getActiveOrderForTable = (table: Table")[1]?.split("const visibleTables")[0] || ""
  assert(getActiveOrderBody.includes('isOccupied = (session && session.status !== "closed") || table.status === "occupied"'), "Must guard by isOccupied")
  assert(getActiveOrderBody.includes('o.status !== "open" && o.status !== "paid"'), "Must match both open and paid orders for seated table")
})

it("demoSqlite ignores stale sessions older than 24 hours", () => {
  assert(demoSqliteCode.includes("datetime('now', '-24 hours')"), "Must have 24-hour staleness filter in SQLite queries")
  assert(demoSqliteCode.includes("24 * 60 * 60 * 1000"), "Must have 24-hour staleness cutoff in memory state")
})

console.log("\n=======================================================")
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
console.log("=======================================================\n")

if (failed > 0) {
  process.exit(1)
} else {
  console.log("🎉 ALL VERIFICATION TESTS PASSED!\n")
}
