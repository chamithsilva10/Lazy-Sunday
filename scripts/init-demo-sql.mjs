/**
 * Standalone SQL Database Initializer & Tester
 * Usage: node scripts/init-demo-sql.mjs
 */

import { DatabaseSync } from "node:sqlite"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const dataDir = path.join(rootDir, "data")
const dbFile = path.join(dataDir, "pos_demo.sqlite")

console.log("=== Initializing Isolated Demo SQL Database ===")
console.log(`Database target path: ${dbFile}`)

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new DatabaseSync(dbFile)
db.exec("PRAGMA journal_mode = WAL;")
db.exec("PRAGMA foreign_keys = ON;")

const schemaPath = path.join(rootDir, "demo_schema.sql")
const seedPath = path.join(rootDir, "demo_seed.sql")

if (fs.existsSync(schemaPath)) {
  console.log("Executing schema: demo_schema.sql...")
  const schemaSql = fs.readFileSync(schemaPath, "utf-8")
  db.exec(schemaSql)
} else {
  console.error("Schema file not found!")
  process.exit(1)
}

if (fs.existsSync(seedPath)) {
  console.log("Executing seed: demo_seed.sql...")
  const seedSql = fs.readFileSync(seedPath, "utf-8")
  db.exec(seedSql)
} else {
  console.error("Seed file not found!")
  process.exit(1)
}

const productsCount = db.prepare("SELECT count(*) as cnt FROM pos_products").get()
const categoriesCount = db.prepare("SELECT count(*) as cnt FROM pos_categories").get()
const tablesCount = db.prepare("SELECT count(*) as cnt FROM pos_tables").get()
const ordersCount = db.prepare("SELECT count(*) as cnt FROM pos_orders").get()
const customersCount = db.prepare("SELECT count(*) as cnt FROM customers").get()
const usersCount = db.prepare("SELECT count(*) as cnt FROM app_users").get()

console.log("\n--- Database Verification Summary ---")
console.log(`✓ Products:    ${productsCount.cnt}`)
console.log(`✓ Categories:  ${categoriesCount.cnt}`)
console.log(`✓ Tables:      ${tablesCount.cnt}`)
console.log(`✓ Orders:      ${ordersCount.cnt}`)
console.log(`✓ Customers:   ${customersCount.cnt}`)
console.log(`✓ Staff Users: ${usersCount.cnt}`)
console.log("\nSQL Database successfully provisioned and ready for client demo!\n")
