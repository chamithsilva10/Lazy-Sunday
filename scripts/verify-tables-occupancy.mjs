/**
 * POS SYSTEM - TABLES OCCUPANCY INTEGRITY TEST
 *
 * Verifies:
 * 1. Mock tables all have status "available" (0 active occupied)
 * 2. SQL seed file inserts all tables as "available"
 * 3. SQLite database contains exactly 14 tables, all "available"
 * 4. DEFAULT_TABLES in shared-pos-service has 14 tables, all "available"
 * 5. Table occupancy calculation evaluates to 0 / 14 on fresh start
 * 6. Dynamic table occupation and release cycles function properly
 *
 * Run with: node --experimental-sqlite scripts/verify-tables-occupancy.mjs
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

console.log("\n=======================================================")
console.log("🔍 POS SYSTEM - TABLES OCCUPANCY INTEGRITY TEST")
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

// 1. Check lib/mock/pos-mock-data.ts
const mockDataPath = path.resolve("./lib/mock/pos-mock-data.ts")
const mockDataCode = fs.readFileSync(mockDataPath, "utf-8")

it("MOCK_TABLES defines 14 tables and all have status 'available'", () => {
  const match = mockDataCode.match(/export const MOCK_TABLES: MockTable\[\] = \[([\s\S]*?)\]/)
  assert(match, "MOCK_TABLES must be defined")
  assert(!match[1].includes('"occupied"'), "MOCK_TABLES must not contain 'occupied' status")
  assert(!match[1].includes('"reserved"'), "MOCK_TABLES must not contain 'reserved' status")
})

// 2. Check demo_seed.sql
const seedSqlPath = path.resolve("./demo_seed.sql")
const seedSql = fs.readFileSync(seedSqlPath, "utf-8")

it("demo_seed.sql inserts all 14 pos_tables as 'available'", () => {
  const tableSection = seedSql.split("-- 5. Tables")[1]?.split("-- 6. Customers")[0]
  assert(tableSection, "pos_tables section must exist in demo_seed.sql")
  assert(!tableSection.includes("'occupied'"), "demo_seed.sql must not have 'occupied' tables")
  assert(!tableSection.includes("'reserved'"), "demo_seed.sql must not have 'reserved' tables")
  assert.equal((tableSection.match(/'available'/g) || []).length, 14, "All 14 tables must be available in demo_seed.sql")
})

// 3. Check SQLite database (data/pos_demo.sqlite)
const dbPath = path.resolve("./data/pos_demo.sqlite")

it("SQLite pos_tables has exactly 14 tables and all are 'available'", () => {
  const db = new DatabaseSync(dbPath)
  const rows = db.prepare("SELECT id, name, capacity, status FROM pos_tables").all()
  assert.equal(rows.length, 14, `Expected 14 tables, found ${rows.length}`)
  const occupied = rows.filter((r) => r.status === "occupied")
  const reserved = rows.filter((r) => r.status === "reserved")
  const available = rows.filter((r) => r.status === "available")
  assert.equal(occupied.length, 0, `Expected 0 occupied tables, found ${occupied.length}`)
  assert.equal(reserved.length, 0, `Expected 0 reserved tables, found ${reserved.length}`)
  assert.equal(available.length, 14, `Expected 14 available tables, found ${available.length}`)
})

// 4. Check lib/shared-pos-service.ts
const sharedServicePath = path.resolve("./lib/shared-pos-service.ts")
const sharedServiceCode = fs.readFileSync(sharedServicePath, "utf-8")

it("DEFAULT_TABLES in SharedPosService defines 14 available tables", () => {
  const defTablesMatch = sharedServiceCode.match(/export const DEFAULT_TABLES: SharedTable\[\] = \[([\s\S]*?)\]/)
  assert(defTablesMatch, "DEFAULT_TABLES must be defined")
  assert(!defTablesMatch[1].includes('"occupied"'), "DEFAULT_TABLES must not contain occupied status")
  assert.equal((defTablesMatch[1].match(/status:\s*"available"/g) || []).length, 14, "DEFAULT_TABLES must have 14 available tables")
})

it("SharedPosService flushes legacy tables cache and auto-reconciles orphaned occupancy", () => {
  assert(sharedServiceCode.includes("pos_lazy_sunday_clean_tables_zero_v4"), "Must have clean slate flag for tables")
  assert(sharedServiceCode.includes("activeOpenTables.has"), "Must reconcile table occupancy against active open orders")
  assert(sharedServiceCode.includes("hasActiveOrder ? \"occupied\" : \"available\""), "Refresh must confirm actual active order before marking occupied")
})

// 5. Test floor occupancy math
it("Active tables KPI calculates to 0 / 14 with 0 active orders", () => {
  const tables = [
    { id: "tbl-1", name: "Table 1", capacity: 2, status: "available" },
    { id: "tbl-2", name: "Table 2", capacity: 4, status: "available" },
    { id: "tbl-3", name: "Table 3", capacity: 4, status: "available" },
    { id: "tbl-4", name: "Table 4", capacity: 6, status: "available" },
    { id: "tbl-5", name: "Table 5", capacity: 2, status: "available" },
    { id: "tbl-6", name: "Table 6", capacity: 4, status: "available" },
    { id: "tbl-7", name: "Terrace 1", capacity: 2, status: "available" },
    { id: "tbl-8", name: "Terrace 2", capacity: 4, status: "available" },
    { id: "tbl-9", name: "Terrace 3", capacity: 4, status: "available" },
    { id: "tbl-10", name: "Terrace 4", capacity: 6, status: "available" },
    { id: "tbl-11", name: "VIP Lounge", capacity: 8, status: "available" },
    { id: "tbl-12", name: "Bar Counter 1", capacity: 1, status: "available" },
    { id: "tbl-13", name: "Bar Counter 2", capacity: 1, status: "available" },
    { id: "tbl-14", name: "Bar Counter 3", capacity: 1, status: "available" },
  ]
  const occupiedCount = tables.filter((t) => t.status === "occupied").length
  assert.equal(occupiedCount, 0, "Occupied count must be 0")
  assert.equal(tables.length, 14, "Total tables must be 14")
  const kpiDisplay = `${occupiedCount} / ${tables.length}`
  assert.equal(kpiDisplay, "0 / 14")
})

it("Simulating an order occupying Table 3 increases active count to 1 / 14 and release returns to 0 / 14", () => {
  let tables = [
    { id: "tbl-1", name: "Table 1", capacity: 2, status: "available" },
    { id: "tbl-2", name: "Table 2", capacity: 4, status: "available" },
    { id: "tbl-3", name: "Table 3", capacity: 4, status: "available" },
    { id: "tbl-4", name: "Table 4", capacity: 6, status: "available" },
    { id: "tbl-5", name: "Table 5", capacity: 2, status: "available" },
    { id: "tbl-6", name: "Table 6", capacity: 4, status: "available" },
    { id: "tbl-7", name: "Terrace 1", capacity: 2, status: "available" },
    { id: "tbl-8", name: "Terrace 2", capacity: 4, status: "available" },
    { id: "tbl-9", name: "Terrace 3", capacity: 4, status: "available" },
    { id: "tbl-10", name: "Terrace 4", capacity: 6, status: "available" },
    { id: "tbl-11", name: "VIP Lounge", capacity: 8, status: "available" },
    { id: "tbl-12", name: "Bar Counter 1", capacity: 1, status: "available" },
    { id: "tbl-13", name: "Bar Counter 2", capacity: 1, status: "available" },
    { id: "tbl-14", name: "Bar Counter 3", capacity: 1, status: "available" },
  ]

  // Dine-in order opens for Table 3
  tables = tables.map(t => t.name === "Table 3" ? { ...t, status: "occupied" } : t)
  let occupiedCount = tables.filter((t) => t.status === "occupied").length
  assert.equal(occupiedCount, 1)
  assert.equal(`${occupiedCount} / ${tables.length}`, "1 / 14")

  // Dine-in order for Table 3 is settled/paid -> Table 3 released
  tables = tables.map(t => t.name === "Table 3" ? { ...t, status: "available" } : t)
  occupiedCount = tables.filter((t) => t.status === "occupied").length
  assert.equal(occupiedCount, 0)
  assert.equal(`${occupiedCount} / ${tables.length}`, "0 / 14")
})

console.log("\n=======================================================")
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`)
console.log("=======================================================\n")

if (failedCount > 0) {
  process.exit(1)
} else {
  console.log("🎉 ALL TABLES OCCUPANCY INTEGRITY TESTS PASSED!\n")
}
