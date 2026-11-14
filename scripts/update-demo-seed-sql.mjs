import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { CATEGORIES_DATA, PRODUCTS_DATA } from "./seed-new-lazy-sunday-menu.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

let sql = `-- ============================================================================
-- POS DEMO SQL SEED DATA - LAZY SUNDAY PURE 41-ITEM MENU
-- Pre-populates SQLite database with 13 categories and 41 products
-- ============================================================================

-- 1. Roles
INSERT OR REPLACE INTO roles (id, name, description, is_system) VALUES
('admin', 'Admin', 'Full administrative access across restaurant systems', 1),
('manager', 'Manager', 'Store management, inventory controls, and financial reports', 1),
('cashier', 'Cashier', 'Create orders, process bill payments, and view catalog', 1),
('kitchen', 'Kitchen', 'View kitchen order tickets and update prep status', 1),
('staff', 'Staff', 'General floor staff with basic ordering permissions', 1);

-- 2. Staff Users
INSERT OR REPLACE INTO app_users (id, username, full_name, email, password_hash, role_id, is_active) VALUES
('usr-001', 'admin', 'Alexa Pheloung (Administrator)', 'alexa@lazysunday.com', 'demo_hash_admin', 'admin', 1),
('usr-002', 'manager', 'Elena Rostova (Store Manager)', 'manager@posdemo.com', 'demo_hash_manager', 'manager', 1),
('usr-003', 'cashier', 'Alex Rivera (Head Cashier)', 'cashier@posdemo.com', 'demo_hash_cashier', 'cashier', 1),
('usr-004', 'kitchen', 'Marco Silva (Head Chef)', 'kitchen@posdemo.com', 'demo_hash_kitchen', 'kitchen', 1);

-- 3. Categories (13 total)
`

const catInserts = CATEGORIES_DATA.map((c) =>
  `('${c.id}', '${c.name.replace(/'/g, "''")}', ${c.sort_order}, 1)`
).join(",\n")
sql += `INSERT OR REPLACE INTO pos_categories (id, name, sort_order, is_active) VALUES\n${catInserts};\n\n-- 4. Products (41 total: 26 Bar, 15 Kitchen)\n`

const prodInserts = PRODUCTS_DATA.map((p, idx) => {
  const id = `prod-${101 + idx}`
  const catObj = CATEGORIES_DATA.find((c) => c.name === p.category_name)
  const catId = catObj ? catObj.id : "cat-coffee"
  const sku = `LS-${p.station === "bar" ? "BAR" : "KIT"}-${String(idx + 1).padStart(3, "0")}`
  const barcode = `890100100${String(idx + 1).padStart(3, "0")}`
  const tags = JSON.stringify(p.dietary_tags || []).replace(/'/g, "''")
  const desc = (p.description || "").replace(/'/g, "''")
  const name = p.name.replace(/'/g, "''")

  return `('${id}', '${name}', '${sku}', '${barcode}', '${catId}', '${p.category_name.replace(/'/g, "''")}', ${p.price}, ${p.cost}, 100, '${p.station}', '${p.department}', '${p.image}', '${desc}', '${p.temperature}', '${tags}')`
}).join(",\n")

sql += `INSERT OR REPLACE INTO pos_products (id, name, sku, barcode, category_id, category_name, price, cost_price, stock, station, department, image, description, temperature, dietary_tags) VALUES\n${prodInserts};\n\n`

sql += `-- 5. Tables
INSERT OR REPLACE INTO pos_tables (id, name, capacity, status, section) VALUES
('tbl-1', 'Table 1', 2, 'available', 'Indoor'),
('tbl-2', 'Table 2', 4, 'available', 'Indoor'),
('tbl-3', 'Table 3', 4, 'available', 'Indoor'),
('tbl-4', 'Table 4', 6, 'available', 'Indoor'),
('tbl-5', 'Table 5', 2, 'available', 'Indoor'),
('tbl-6', 'Table 6', 4, 'available', 'Indoor'),
('tbl-7', 'Terrace 1', 2, 'available', 'Terrace'),
('tbl-8', 'Terrace 2', 4, 'available', 'Terrace'),
('tbl-9', 'Terrace 3', 4, 'available', 'Terrace'),
('tbl-10', 'Terrace 4', 6, 'available', 'Terrace'),
('tbl-11', 'VIP Lounge', 8, 'available', 'VIP Lounge'),
('tbl-12', 'Bar Counter 1', 1, 'available', 'Bar'),
('tbl-13', 'Bar Counter 2', 1, 'available', 'Bar'),
('tbl-14', 'Bar Counter 3', 1, 'available', 'Bar');

-- 6. Clean Orders & Items (Clean State - 0 initial orders)
DELETE FROM order_items;
DELETE FROM station_tickets;
DELETE FROM pos_orders;
`

fs.writeFileSync(path.join(rootDir, "demo_seed.sql"), sql, "utf-8")
console.log("✓ Successfully generated demo_seed.sql with 13 categories, 41 products, and 0 orders!")
