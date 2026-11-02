/**
 * Standalone SQLite SQL Database Service
 * Zero external cloud / Supabase reliance.
 * Uses Node's built-in `node:sqlite` for rock-solid local SQL storage.
 */

import fs from "node:fs"
import path from "node:path"
import {
  MOCK_CATEGORIES,
  MOCK_PRODUCTS,
  MOCK_CUSTOMERS,
  MOCK_TABLES,
  MOCK_INGREDIENTS,
  MOCK_HISTORICAL_ORDERS,
  MockProduct,
  MockOrder,
  MockCustomer,
  MockTable,
  MockCategory,
} from "../mock/pos-mock-data"

const DB_DIR = path.join(process.cwd(), "data")
const DB_FILE = path.join(DB_DIR, "pos_demo.sqlite")

let dbInstance: any = null

export function getDemoSqliteDb() {
  if (dbInstance) return dbInstance

  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }

    // Dynamic require for node:sqlite
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require("node:sqlite")
    dbInstance = new DatabaseSync(DB_FILE)

    // Enable WAL mode & foreign keys for SQLite performance
    dbInstance.exec("PRAGMA journal_mode = WAL;")
    dbInstance.exec("PRAGMA foreign_keys = ON;")

    // Check if tables exist, otherwise run schema & seed
    const tableCheck = dbInstance
      .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='pos_products'")
      .get() as { cnt: number }

    if (!tableCheck || tableCheck.cnt === 0) {
      initSchemaAndSeed(dbInstance)
    }

    return dbInstance
  } catch (err) {
    console.error("Failed to initialize SQLite database:", err)
    return null
  }
}

function initSchemaAndSeed(db: any) {
  const schemaPath = path.join(process.cwd(), "demo_schema.sql")
  const seedPath = path.join(process.cwd(), "demo_seed.sql")

  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, "utf-8")
    db.exec(schemaSql)
  }

  if (fs.existsSync(seedPath)) {
    const seedSql = fs.readFileSync(seedPath, "utf-8")
    db.exec(seedSql)
  }

  // Ensure all MOCK_PRODUCTS are inserted
  const insertProductStmt = db.prepare(`
    INSERT OR REPLACE INTO pos_products (
      id, name, sku, barcode, category_id, category_name, price, cost_price, stock, station, department, image, description, temperature, dietary_tags
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `)

  for (const p of MOCK_PRODUCTS) {
    insertProductStmt.run(
      p.id,
      p.name,
      p.sku,
      p.barcode,
      p.category_id,
      p.category,
      p.price,
      p.cost_price,
      p.stock,
      p.station,
      p.department,
      p.image,
      p.description,
      p.temperature || "none",
      JSON.stringify(p.dietary_tags || [])
    )
  }
}

// ---------------------------------------------------------------------------
// Typed Database Accessors
// ---------------------------------------------------------------------------

export const DemoDbService = {
  getProducts(): MockProduct[] {
    const db = getDemoSqliteDb()
    if (!db) return MOCK_PRODUCTS
    const rows = db.prepare("SELECT * FROM pos_products WHERE is_archived = 0 AND active = 1 ORDER BY name").all()
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      barcode: r.barcode,
      price: Number(r.price),
      cost_price: Number(r.cost_price || 0),
      stock: Number(r.stock || 0),
      category: r.category_name,
      category_id: r.category_id,
      station: r.station as "bar" | "kitchen",
      department: r.department,
      image: r.image,
      description: r.description || "",
      temperature: r.temperature,
      dietary_tags: typeof r.dietary_tags === "string" ? JSON.parse(r.dietary_tags || "[]") : [],
    }))
  },

  updateProductStock(productId: string, newStock: number): boolean {
    const db = getDemoSqliteDb()
    if (!db) return false
    try {
      db.prepare("UPDATE pos_products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newStock, productId)
      return true
    } catch {
      return false
    }
  },

  getCategories(): MockCategory[] {
    const db = getDemoSqliteDb()
    if (!db) return MOCK_CATEGORIES
    const rows = db.prepare("SELECT * FROM pos_categories WHERE is_active = 1 ORDER BY sort_order").all()
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      sort_order: Number(r.sort_order),
      is_active: Boolean(r.is_active),
    }))
  },

  getTables(): MockTable[] {
    const db = getDemoSqliteDb()
    if (!db) return MOCK_TABLES
    const rows = db.prepare("SELECT * FROM pos_tables ORDER BY name").all()
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      capacity: Number(r.capacity),
      status: r.status,
      section: r.section,
    }))
  },

  updateTableStatus(tableId: string, status: string): boolean {
    const db = getDemoSqliteDb()
    if (!db) return false
    try {
      db.prepare("UPDATE pos_tables SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR name = ?").run(status, tableId, tableId)
      return true
    } catch {
      return false
    }
  },

  getCustomers(): MockCustomer[] {
    const db = getDemoSqliteDb()
    if (!db) return MOCK_CUSTOMERS
    const rows = db.prepare("SELECT * FROM customers ORDER BY total_spent DESC").all()
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      phone: r.phone || "",
      email: r.email || "",
      address: r.address || "",
      notes: r.notes || "",
      credit_limit: Number(r.credit_limit || 0),
      current_credit: Number(r.current_credit || 0),
      loyalty_points: Number(r.loyalty_points || 0),
      vip: Boolean(r.vip),
      total_orders: Number(r.total_orders || 0),
      total_spent: Number(r.total_spent || 0),
      created_at: r.created_at,
    }))
  },

  getOrders(filters?: { startDate?: string; endDate?: string; status?: string; paymentMethod?: string }): MockOrder[] {
    const db = getDemoSqliteDb()
    if (!db) return MOCK_HISTORICAL_ORDERS

    let query = "SELECT * FROM pos_orders WHERE 1=1"
    const params: any[] = []

    if (filters?.startDate) {
      query += " AND created_at >= ?"
      params.push(filters.startDate)
    }
    if (filters?.endDate) {
      query += " AND created_at <= ?"
      params.push(filters.endDate)
    }
    if (filters?.status && filters.status !== "all") {
      query += " AND status = ?"
      params.push(filters.status)
    }
    if (filters?.paymentMethod && filters.paymentMethod !== "all") {
      query += " AND payment_method = ?"
      params.push(filters.paymentMethod)
    }

    query += " ORDER BY created_at DESC"
    const orderRows = db.prepare(query).all(...params)

    // Attach items
    const orders: MockOrder[] = []
    const itemStmt = db.prepare("SELECT * FROM order_items WHERE order_id = ?")

    for (const o of orderRows as any[]) {
      const items = itemStmt.all(o.id).map((i: any) => ({
        id: i.id,
        product_id: i.product_id,
        name: i.product_name,
        price: Number(i.unit_price),
        quantity: Number(i.quantity),
        line_total: Number(i.line_total),
        station: i.station as "bar" | "kitchen",
        category: i.category || "",
        notes: i.notes || "",
      }))

      let splitPayments: any[] | undefined = undefined
      if (o.split_payments) {
        try {
          splitPayments = JSON.parse(o.split_payments)
        } catch {}
      }

      orders.push({
        id: o.id,
        order_number: o.order_number,
        receipt_number: o.receipt_number,
        table_name: o.table_name || "Takeaway",
        cashier_name: o.cashier_name,
        department: o.department,
        order_type: o.order_type,
        items,
        subtotal: Number(o.subtotal),
        service_charge: Number(o.service_charge),
        service_charge_rate: Number(o.service_charge_rate),
        discount: Number(o.discount),
        tax: Number(o.tax),
        total: Number(o.total),
        payment_method: o.payment_method,
        split_payments: splitPayments,
        cash_received: Number(o.cash_received),
        change_amount: Number(o.change_amount),
        status: o.status,
        payment_status: o.payment_status,
        kitchen_status: o.kitchen_status,
        bar_status: o.bar_status,
        customer_name: o.customer_name || "Walk-in",
        customer_id: o.customer_id,
        created_at: o.created_at,
      })
    }

    return orders
  },

  createOrder(order: MockOrder): boolean {
    const db = getDemoSqliteDb()
    if (!db) return false
    try {
      const insertOrder = db.prepare(`
        INSERT INTO pos_orders (
          id, order_number, receipt_number, table_name, cashier_name, department, order_type,
          subtotal, service_charge, service_charge_rate, discount, tax, total,
          payment_method, split_payments, cash_received, change_amount,
          status, payment_status, kitchen_status, bar_status, customer_name, customer_id, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?
        )
      `)

      insertOrder.run(
        order.id || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        order.order_number,
        order.receipt_number || `RC-${order.order_number}`,
        order.table_name || "Takeaway",
        order.cashier_name || "Staff",
        order.department || "Juice & Food",
        order.order_type || "dine_in",
        order.subtotal || 0,
        order.service_charge || 0,
        order.service_charge_rate || 0,
        order.discount || 0,
        order.tax || 0,
        order.total || 0,
        order.payment_method || "cash",
        order.split_payments ? JSON.stringify(order.split_payments) : null,
        order.cash_received != null ? order.cash_received : (order.total || 0),
        order.change_amount || 0,
        order.status || "paid",
        order.payment_status || "paid",
        order.kitchen_status || "pending",
        order.bar_status || "pending",
        order.customer_name || "Walk-in",
        order.customer_id || null,
        order.created_at || new Date().toISOString()
      )

      // Insert line items
      const insertItem = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_name, unit_price, quantity, line_total, station, category, notes
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)

      const updateStockStmt = db.prepare(`
        UPDATE pos_products SET stock = MAX(0, stock - ?) WHERE id = ? OR name = ?
      `)

      for (const item of (order.items || [])) {
        const lineTotal = item.line_total != null ? item.line_total : ((item.price || 0) * (item.quantity || 1))
        const pId = item.product_id || (item as any).id || null
        insertItem.run(
          item.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          order.id,
          pId,
          item.name || "Item",
          item.price || 0,
          item.quantity || 1,
          lineTotal,
          item.station || "kitchen",
          item.category || "General",
          item.notes || null
        )

        // Decrement product inventory
        if (pId) {
          updateStockStmt.run(item.quantity || 1, pId, item.name || "")
        }
      }

      return true
    } catch (err) {
      console.error("Failed to insert order into SQLite:", err)
      return false
    }
  },

  runRawQuery(sql: string, params: any[] = []): any {
    const db = getDemoSqliteDb()
    if (!db) return { error: "Database not available" }
    try {
      const trimmed = sql.trim().toUpperCase()
      if (trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA")) {
        const rows = db.prepare(sql).all(...params)
        return { success: true, count: rows.length, data: rows }
      } else {
        const result = db.prepare(sql).run(...params)
        return { success: true, changes: result.changes, lastInsertRowid: result.lastInsertRowid }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  },

  resetDatabase(): boolean {
    const db = getDemoSqliteDb()
    if (!db) return false
    try {
      db.exec(`
        DELETE FROM order_items;
        DELETE FROM station_tickets;
        DELETE FROM pos_orders;
        DELETE FROM pos_products;
        DELETE FROM pos_categories;
        DELETE FROM pos_tables;
        DELETE FROM customers;
        DELETE FROM app_users;
        DELETE FROM roles;
      `)
      initSchemaAndSeed(db)
      return true
    } catch (err) {
      console.error("Failed to reset SQLite database:", err)
      return false
    }
  },
}
