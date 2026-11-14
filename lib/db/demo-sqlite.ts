/**
 * Standalone SQLite SQL Database Service
 * Zero external cloud / Supabase reliance.
 * Uses Node's built-in `node:sqlite` for rock-solid local SQL storage.
 */

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import {
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_PERMISSIONS,
  normalizeRole,
  getRoleDisplayName,
} from "../rbac/permissions"
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

const BUNDLED_DB_FILE = path.join(process.cwd(), "data", "pos_demo.sqlite")
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
const DB_DIR = IS_SERVERLESS ? "/tmp" : path.join(process.cwd(), "data")
const DB_FILE = IS_SERVERLESS ? path.join("/tmp", "pos_demo.sqlite") : BUNDLED_DB_FILE

let dbInstance: any = null

export function getDemoSqliteDb() {
  if (dbInstance) return dbInstance

  try {
    if (IS_SERVERLESS) {
      if (!fs.existsSync(DB_FILE) && fs.existsSync(BUNDLED_DB_FILE)) {
        try {
          fs.copyFileSync(BUNDLED_DB_FILE, DB_FILE)
        } catch {}
      }
    } else {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true })
      }
    }

    // Dynamic require for node:sqlite
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require("node:sqlite")
    dbInstance = new DatabaseSync(DB_FILE)

    // Enable WAL mode & foreign keys for SQLite performance
    try {
      dbInstance.exec("PRAGMA journal_mode = WAL;")
      dbInstance.exec("PRAGMA foreign_keys = ON;")
    } catch {}

    // Ensure reservations table exists
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        party_size INTEGER NOT NULL DEFAULT 2,
        reserved_for TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 90,
        table_id TEXT,
        table_name TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        special_requests TEXT DEFAULT '',
        source TEXT DEFAULT 'staff',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES pos_tables(id)
      );

      CREATE TABLE IF NOT EXISTS pos_uploads (
        filename TEXT PRIMARY KEY,
        mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
        data_base64 TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_system INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        module TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT NOT NULL,
        permission_id TEXT NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        password_hash TEXT,
        role_id TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        last_login_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      );
    `)

    // Ensure roles, permissions, and role_permissions have initial seed
    try {
      const rpCountCheck = dbInstance
        .prepare("SELECT count(*) as cnt FROM role_permissions")
        .get() as { cnt: number }

      if (!rpCountCheck || rpCountCheck.cnt === 0) {
        const insertRole = dbInstance.prepare(
          "INSERT OR REPLACE INTO roles (id, name, description, is_system) VALUES (?, ?, ?, 1)"
        )
        insertRole.run("admin", "Admin", "Full administrative access across restaurant systems")
        insertRole.run("manager", "Manager", "Store management, inventory controls, and financial reports")
        insertRole.run("cashier", "Cashier", "Create orders, process bill payments, and view catalog")
        insertRole.run("kitchen", "Kitchen", "View kitchen order tickets and update prep status")
        insertRole.run("staff", "Staff", "General floor staff with basic ordering permissions")

        const insertPerm = dbInstance.prepare(
          "INSERT OR REPLACE INTO permissions (id, code, module, name, description) VALUES (?, ?, ?, ?, ?)"
        )
        for (const p of SYSTEM_PERMISSIONS) {
          insertPerm.run(p.id, p.code, p.module, p.name, p.description)
        }

        const insertRp = dbInstance.prepare(
          "INSERT OR REPLACE INTO role_permissions (role_id, permission_id) VALUES (?, ?)"
        )
        for (const [roleId, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
          for (const perm of perms) {
            insertRp.run(roleId, perm)
          }
        }
      }
    } catch (rpErr) {
      console.warn("SQLite role_permissions initial seed notice:", rpErr)
    }

    // Check if tables exist, otherwise run schema & seed
    const tableCheck = dbInstance
      .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='pos_products'")
      .get() as { cnt: number }

    if (!tableCheck || tableCheck.cnt === 0) {
      initSchemaAndSeed(dbInstance)
    } else {
      // Ensure all products have real-world database stocks rather than legacy uniform 100
      try {
        const allHundredCheck = dbInstance
          .prepare("SELECT count(*) as cnt FROM pos_products WHERE stock = 100")
          .get() as { cnt: number }
        const totalCheck = dbInstance
          .prepare("SELECT count(*) as cnt FROM pos_products")
          .get() as { cnt: number }
        if (allHundredCheck && totalCheck && allHundredCheck.cnt > 0 && allHundredCheck.cnt === totalCheck.cnt) {
          const updateStockStmt = dbInstance.prepare("UPDATE pos_products SET stock = ? WHERE id = ?")
          for (const p of MOCK_PRODUCTS) {
            updateStockStmt.run(p.stock, p.id)
          }
        }
      } catch {}
    }

    try { dbInstance.exec("ALTER TABLE pos_orders ADD COLUMN idempotency_key TEXT;") } catch {}
    try { dbInstance.exec("ALTER TABLE pos_orders ADD COLUMN is_void INTEGER DEFAULT 0;") } catch {}
    try { dbInstance.exec("ALTER TABLE pos_orders ADD COLUMN void_reason TEXT;") } catch {}
    try { dbInstance.exec("ALTER TABLE pos_orders ADD COLUMN stock_deducted INTEGER DEFAULT 1;") } catch {}

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

function normalizeTableName(name: string): string {
  if (!name) return ""
  let clean = (name || "").trim().toLowerCase()
  clean = clean.replace(/^(dine\s*in\s*[\/-]?\s*)/i, "")
  clean = clean.replace(/\s*\((dine[- ]?in|takeaway)\)\s*$/i, "")
  clean = clean.replace(/^tbl[-_\s]*/i, "table ")
  clean = clean.replace(/^t[-_\s]*(\d+)$/i, "table $1")
  clean = clean.replace(/\btable\s*0+(\d+)\b/i, "table $1")
  return clean.trim()
}

interface DemoMemoryState {
  products: any[]
  categories: MockCategory[]
  tables: any[]
  sessions: any[]
  reservations: any[]
  customers: MockCustomer[]
  orders: any[]
  ingredients: any[]
  uploads: Map<string, { filename: string; mime_type: string; data_base64: string }>
  orderSeq: number
  roles: any[]
}

const globalForDemoMem = globalThis as unknown as {
  __pos_demo_memory_state?: DemoMemoryState
}

function createInitialMemoryState(): DemoMemoryState {
  return {
    products: MOCK_PRODUCTS.map((p) => ({
      ...p,
      cost: p.cost_price,
      category_name: p.category,
      active: true,
      is_archived: false,
    })),
    categories: MOCK_CATEGORIES.map((c) => ({ ...c })),
    tables: MOCK_TABLES.map((t) => ({ ...t })),
    sessions: [],
    reservations: [],
    customers: MOCK_CUSTOMERS.map((c) => ({ ...c })),
    orders: MOCK_HISTORICAL_ORDERS.map((o) => ({ ...o })),
    ingredients: MOCK_INGREDIENTS.map((i) => ({ ...i })),
    uploads: new Map(),
    orderSeq: 100,
    roles: [
      {
        id: "admin",
        name: "Admin",
        description: "Full administrative access across restaurant systems",
        is_system: true,
        permissions: [...DEFAULT_ROLE_PERMISSIONS.admin],
        user_count: 1,
      },
      {
        id: "manager",
        name: "Manager",
        description: "Store management, inventory controls, and financial reports",
        is_system: true,
        permissions: [...DEFAULT_ROLE_PERMISSIONS.manager],
        user_count: 1,
      },
      {
        id: "cashier",
        name: "Cashier",
        description: "Create orders, process bill payments, and view catalog",
        is_system: true,
        permissions: [...DEFAULT_ROLE_PERMISSIONS.cashier],
        user_count: 1,
      },
      {
        id: "kitchen",
        name: "Kitchen",
        description: "View kitchen order tickets and update prep status",
        is_system: true,
        permissions: [...DEFAULT_ROLE_PERMISSIONS.kitchen],
        user_count: 1,
      },
      {
        id: "staff",
        name: "Staff",
        description: "General floor staff with basic ordering permissions",
        is_system: true,
        permissions: [...DEFAULT_ROLE_PERMISSIONS.staff],
        user_count: 1,
      },
    ],
  }
}

function getMemState(): DemoMemoryState {
  if (!globalForDemoMem.__pos_demo_memory_state) {
    globalForDemoMem.__pos_demo_memory_state = createInitialMemoryState()
  }
  return globalForDemoMem.__pos_demo_memory_state
}

function findTableInMemory(mem: DemoMemoryState, idOrName: string): any | null {
  if (!idOrName) return null
  const lower = idOrName.trim().toLowerCase()
  const direct = mem.tables.find((t) => t.id.toLowerCase() === lower || t.name.toLowerCase() === lower)
  if (direct) return direct
  const norm = normalizeTableName(idOrName)
  return mem.tables.find((t) => normalizeTableName(t.name) === norm || t.id.toLowerCase() === norm) || null
}

function findTableInDb(db: any, idOrName: string): any {
  if (!idOrName) return null
  const direct = db.prepare("SELECT * FROM pos_tables WHERE id = ? OR name = ? COLLATE NOCASE").get(idOrName, idOrName)
  if (direct) return direct
  const all = db.prepare("SELECT * FROM pos_tables").all() as any[]
  const norm = normalizeTableName(idOrName)
  return all.find((t: any) => normalizeTableName(t.name) === norm || t.id.toLowerCase() === norm) || null
}

export const DemoDbService = {
  getProducts(filters?: { category?: string; station?: string; activeOnly?: boolean; search?: string }): MockProduct[] {
    const db = getDemoSqliteDb()
    let prods: any[]

    if (!db) {
      const mem = getMemState()
      prods = mem.products
        .filter((p) => !p.is_archived)
        .filter((p) => (filters?.activeOnly ? p.active !== false : true))
        .filter((p) => (filters?.station && filters.station !== "all" ? p.station === filters.station : true))
        .map((p) => ({ ...p }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    } else {
      let query = "SELECT * FROM pos_products WHERE is_archived = 0"
      const params: any[] = []

      if (filters?.activeOnly) {
        query += " AND active = 1"
      }
      if (filters?.station && filters.station !== "all") {
        query += " AND station = ?"
        params.push(filters.station)
      }

      query += " ORDER BY name ASC"
      const rows = db.prepare(query).all(...params) as any[]

      prods = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        sku: r.sku,
        barcode: r.barcode,
        price: Number(r.price),
        cost_price: Number(r.cost_price || 0),
        cost: Number(r.cost_price || 0),
        stock: Number(r.stock || 0),
        category: r.category_name,
        category_name: r.category_name,
        category_id: r.category_id,
        station: r.station as "bar" | "kitchen",
        department: r.department,
        image: r.image,
        description: r.description || "",
        temperature: r.temperature || "none",
        dietary_tags: typeof r.dietary_tags === "string" ? JSON.parse(r.dietary_tags || "[]") : (Array.isArray(r.dietary_tags) ? r.dietary_tags : []),
        active: r.active === 1,
        is_archived: r.is_archived === 1,
        updated_at: r.updated_at,
      }))
    }

    if (filters?.category && filters.category !== "All") {
      const c = filters.category.toLowerCase()
      prods = prods.filter((p: any) => p.category?.toLowerCase() === c || p.category_id === filters.category)
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase()
      prods = prods.filter((p: any) => p.name?.toLowerCase().includes(s) || p.category?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s))
    }

    return prods
  },

  getProductById(idOrName: string): any | null {
    if (!idOrName) return null
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const lower = idOrName.trim().toLowerCase()
      return mem.products.find(
        (p) => !p.is_archived && (p.id === idOrName || p.name?.toLowerCase() === lower || p.sku === idOrName)
      ) || null
    }
    const row = db.prepare(
      "SELECT * FROM pos_products WHERE (id = ? OR name = ? COLLATE NOCASE OR sku = ?) AND is_archived = 0 LIMIT 1"
    ).get(idOrName, idOrName, idOrName) as any
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      barcode: row.barcode,
      price: Number(row.price),
      cost: Number(row.cost_price || 0),
      cost_price: Number(row.cost_price || 0),
      stock: Number(row.stock || 0),
      category: row.category_name,
      category_name: row.category_name,
      category_id: row.category_id,
      station: row.station,
      department: row.department,
      image: row.image,
      description: row.description || "",
      temperature: row.temperature || "none",
      dietary_tags: typeof row.dietary_tags === "string" ? JSON.parse(row.dietary_tags || "[]") : (Array.isArray(row.dietary_tags) ? row.dietary_tags : []),
      active: Boolean(row.active),
      is_archived: Boolean(row.is_archived),
      updated_at: row.updated_at,
    }
  },

  updateProduct(idOrName: string, updates: any): any | null {
    if (!idOrName) return null
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const lower = idOrName.trim().toLowerCase()
      const idx = mem.products.findIndex(
        (p) => p.id === idOrName || p.name?.toLowerCase() === lower || p.sku === idOrName
      )
      if (idx === -1) return null
      const cur = mem.products[idx]
      const updated = {
        ...cur,
        ...(updates.name !== undefined ? { name: String(updates.name).trim() } : {}),
        ...(updates.price !== undefined ? { price: Number(updates.price) || 0 } : {}),
        ...(updates.cost !== undefined || updates.cost_price !== undefined ? {
          cost: Number(updates.cost ?? updates.cost_price ?? 0),
          cost_price: Number(updates.cost ?? updates.cost_price ?? 0),
        } : {}),
        ...(updates.stock !== undefined ? { stock: Number(updates.stock) || 0 } : {}),
        ...(updates.image !== undefined || updates.image_url !== undefined ? { image: String(updates.image ?? updates.image_url ?? "").trim() } : {}),
        ...(updates.category_id !== undefined ? { category_id: updates.category_id || null } : {}),
        ...(updates.category_name !== undefined || updates.category !== undefined ? {
          category: String(updates.category_name ?? updates.category ?? "").trim(),
          category_name: String(updates.category_name ?? updates.category ?? "").trim(),
        } : {}),
        ...(updates.station !== undefined ? { station: updates.station } : {}),
        ...(updates.department !== undefined || updates.department_override !== undefined ? { department: updates.department ?? updates.department_override } : {}),
        ...(updates.description !== undefined ? { description: String(updates.description).trim() } : {}),
        ...(updates.temperature !== undefined ? { temperature: updates.temperature } : {}),
        ...(updates.dietary_tags !== undefined ? { dietary_tags: typeof updates.dietary_tags === "string" ? JSON.parse(updates.dietary_tags || "[]") : (updates.dietary_tags || []) } : {}),
        ...(updates.active !== undefined || updates.is_active !== undefined ? { active: Boolean(updates.active ?? updates.is_active) } : {}),
        ...(updates.is_archived !== undefined ? { is_archived: Boolean(updates.is_archived) } : {}),
        updated_at: new Date().toISOString(),
      }
      mem.products[idx] = updated
      return updated
    }

    // Look up existing product by ID, name, or SKU
    const existing = db.prepare(
      "SELECT * FROM pos_products WHERE id = ? OR name = ? COLLATE NOCASE OR sku = ? LIMIT 1"
    ).get(idOrName, idOrName, idOrName) as any
    if (!existing) return null

    const setClauses: string[] = ["updated_at = CURRENT_TIMESTAMP"]
    const params: any[] = []

    if (updates.name !== undefined) {
      setClauses.push("name = ?")
      params.push(String(updates.name).trim())
    }
    if (updates.price !== undefined) {
      setClauses.push("price = ?")
      params.push(Number(updates.price) || 0)
    }
    if (updates.cost !== undefined || updates.cost_price !== undefined) {
      setClauses.push("cost_price = ?")
      params.push(Number(updates.cost ?? updates.cost_price ?? 0))
    }
    if (updates.stock !== undefined) {
      setClauses.push("stock = ?")
      params.push(Number(updates.stock) || 0)
    }
    if (updates.image !== undefined || updates.image_url !== undefined) {
      const img = String(updates.image ?? updates.image_url ?? "").trim()
      setClauses.push("image = ?")
      params.push(img)
    }
    if (updates.category_id !== undefined) {
      setClauses.push("category_id = ?")
      params.push(updates.category_id || null)
    }
    if (updates.category_name !== undefined || updates.category !== undefined) {
      setClauses.push("category_name = ?")
      params.push(String(updates.category_name ?? updates.category ?? "").trim())
    }
    if (updates.station !== undefined) {
      setClauses.push("station = ?")
      params.push(updates.station)
    }
    if (updates.department !== undefined || updates.department_override !== undefined) {
      setClauses.push("department = ?")
      params.push(updates.department ?? updates.department_override)
    }
    if (updates.description !== undefined) {
      setClauses.push("description = ?")
      params.push(String(updates.description).trim())
    }
    if (updates.temperature !== undefined) {
      setClauses.push("temperature = ?")
      params.push(updates.temperature)
    }
    if (updates.dietary_tags !== undefined) {
      setClauses.push("dietary_tags = ?")
      params.push(typeof updates.dietary_tags === "string" ? updates.dietary_tags : JSON.stringify(updates.dietary_tags || []))
    }
    if (updates.active !== undefined || updates.is_active !== undefined) {
      setClauses.push("active = ?")
      params.push((updates.active ?? updates.is_active) ? 1 : 0)
    }
    if (updates.is_archived !== undefined) {
      setClauses.push("is_archived = ?")
      params.push(updates.is_archived ? 1 : 0)
    }

    params.push(existing.id)
    const sql = `UPDATE pos_products SET ${setClauses.join(", ")} WHERE id = ?`
    db.prepare(sql).run(...params)

    return this.getProductById(existing.id)
  },

  createProduct(data: any): any {
    const db = getDemoSqliteDb()
    const id = data.id || `prod-${Date.now()}`
    const sku = data.sku || `LS-CUSTOM-${Date.now().toString().slice(-4)}`
    const barcode = data.barcode || `890${Date.now().toString().slice(-9)}`
    const price = Number(data.price) || 0
    const costPrice = Number(data.cost ?? data.cost_price ?? 0)
    const stock = Number(data.stock) || 0
    const categoryName = data.category_name || data.category || "General"
    const categoryId = data.category_id || null
    const station = data.station || "kitchen"
    const department = data.department || data.department_override || (station === "bar" ? "Coffee Bar" : "Juice & Food")
    const image = data.image || data.image_url || "/placeholder.svg"
    const description = data.description || ""
    const temperature = data.temperature || "none"
    const dietaryTags = typeof data.dietary_tags === "string" ? data.dietary_tags : JSON.stringify(data.dietary_tags || [])

    if (db) {
      db.prepare(`
        INSERT INTO pos_products (
          id, name, sku, barcode, category_id, category_name, price, cost_price, stock,
          station, department, image, description, temperature, dietary_tags, is_archived, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
      `).run(
        id,
        data.name.trim(),
        sku,
        barcode,
        categoryId,
        categoryName,
        price,
        costPrice,
        stock,
        station,
        department,
        image,
        description,
        temperature,
        dietaryTags
      )
      return this.getProductById(id)
    }

    const newProduct = {
      id,
      name: data.name.trim(),
      sku,
      barcode,
      price,
      cost_price: costPrice,
      cost: costPrice,
      stock,
      category: categoryName,
      category_name: categoryName,
      category_id: categoryId,
      station,
      department,
      image,
      description,
      temperature,
      dietary_tags: Array.isArray(data.dietary_tags) ? data.dietary_tags : [],
      active: true,
      is_archived: false,
      updated_at: new Date().toISOString(),
    }
    getMemState().products.push(newProduct)
    return newProduct
  },

  deleteProduct(idOrName: string): boolean {
    if (!idOrName) return false
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const lower = idOrName.trim().toLowerCase()
      const prod = mem.products.find((p) => p.id === idOrName || p.name?.toLowerCase() === lower)
      if (!prod) return false
      prod.is_archived = true
      prod.active = false
      prod.updated_at = new Date().toISOString()
      return true
    }
    try {
      db.prepare(
        "UPDATE pos_products SET is_archived = 1, active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR name = ? COLLATE NOCASE"
      ).run(idOrName, idOrName)
      return true
    } catch {
      return false
    }
  },

  updateProductStock(productId: string, newStock: number): boolean {
    const db = getDemoSqliteDb()
    if (!db) {
      const prod = getMemState().products.find((p) => p.id === productId)
      if (!prod) return false
      prod.stock = newStock
      prod.updated_at = new Date().toISOString()
      return true
    }
    try {
      db.prepare("UPDATE pos_products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newStock, productId)
      return true
    } catch {
      return false
    }
  },

  getCategories(): MockCategory[] {
    const db = getDemoSqliteDb()
    if (!db) return getMemState().categories.filter((c) => c.is_active)
    const rows = db.prepare("SELECT * FROM pos_categories WHERE is_active = 1 ORDER BY sort_order").all()
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      sort_order: Number(r.sort_order),
      is_active: Boolean(r.is_active),
    }))
  },

  getTables(): any[] {
    const db = getDemoSqliteDb()
    const now = Date.now()

    if (!db) {
      const mem = getMemState()
      return [...mem.tables]
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map((r: any) => {
          const session = mem.sessions
            .filter((s) => (s.table_id === r.id || s.table_id === r.name) && (s.status === "open" || s.status === "bill_requested"))
            .sort((a, b) => new Date(b.seated_at).getTime() - new Date(a.seated_at).getTime())[0]

          const bookings = mem.reservations
            .filter((b) => (b.table_id === r.id || (b.table_name || "").toLowerCase() === r.name.toLowerCase()) && ["pending", "confirmed", "arrived"].includes(b.status))
            .sort((a, b) => new Date(a.reserved_for).getTime() - new Date(b.reserved_for).getTime())

          let heldBooking: any = null
          let nextBooking: any = null
          for (const b of bookings) {
            const start = new Date(b.reserved_for).getTime() - 30 * 60000
            const end = new Date(b.reserved_for).getTime() + (Number(b.duration_minutes) || 90) * 60000
            if (b.status === "arrived" || (now >= start && now <= end)) {
              if (!heldBooking) heldBooking = b
            } else if (new Date(b.reserved_for).getTime() > now && !nextBooking) {
              nextBooking = b
            }
          }
          if (!nextBooking && bookings.length > 0) {
            nextBooking = bookings.find((b) => new Date(b.reserved_for).getTime() > now) || null
          }

          let status = r.status
          if (session) {
            status = session.status === "bill_requested" ? "bill_requested" : "occupied"
          } else if (heldBooking) {
            status = "reserved"
          }

          const orderMatch = session?.notes?.match(/Order\s*#?([A-Za-z0-9-]+)/i)
          const sessionOrderNumber = orderMatch ? orderMatch[1] : undefined

          return {
            id: r.id,
            name: r.name,
            capacity: Number(r.capacity),
            status,
            section: r.section,
            guestName: session?.customer_name || heldBooking?.customer_name || nextBooking?.customer_name || undefined,
            occupiedAt: session?.seated_at || heldBooking?.reserved_for || undefined,
            bookingId: heldBooking?.id || undefined,
            orderNumber: sessionOrderNumber,
            activeSession: session ? {
              id: session.id,
              customer_name: session.customer_name,
              phone: session.phone,
              guest_count: session.guest_count,
              seated_at: session.seated_at,
              status: session.status,
              notes: session.notes,
            } : null,
            heldBooking: heldBooking ? {
              id: heldBooking.id,
              customer_name: heldBooking.customer_name,
              phone: heldBooking.phone,
              party_size: heldBooking.party_size,
              reserved_for: heldBooking.reserved_for,
              duration_minutes: heldBooking.duration_minutes,
              status: heldBooking.status,
            } : null,
            nextBooking: nextBooking ? {
              id: nextBooking.id,
              customer_name: nextBooking.customer_name,
              phone: nextBooking.phone,
              party_size: nextBooking.party_size,
              reserved_for: nextBooking.reserved_for,
              duration_minutes: nextBooking.duration_minutes,
              status: nextBooking.status,
            } : null,
          }
        })
    }

    const rows = db.prepare("SELECT * FROM pos_tables ORDER BY name").all() as any[]

    return rows.map((r: any) => {
      // Find active session
      const session = db.prepare(
        "SELECT * FROM table_sessions WHERE (table_id = ? OR table_id = ?) AND status IN ('open', 'bill_requested') ORDER BY seated_at DESC LIMIT 1"
      ).get(r.id, r.name) as any

      // Find active or upcoming bookings
      const bookings = db.prepare(
        "SELECT * FROM reservations WHERE (table_id = ? OR table_name = ? COLLATE NOCASE) AND status IN ('pending', 'confirmed', 'arrived') ORDER BY reserved_for ASC"
      ).all(r.id, r.name) as any[]

      let heldBooking: any = null
      let nextBooking: any = null

      for (const b of bookings) {
        const start = new Date(b.reserved_for).getTime() - 30 * 60000
        const end = new Date(b.reserved_for).getTime() + (Number(b.duration_minutes) || 90) * 60000
        if (b.status === "arrived" || (now >= start && now <= end)) {
          if (!heldBooking) heldBooking = b
        } else if (new Date(b.reserved_for).getTime() > now && !nextBooking) {
          nextBooking = b
        }
      }

      if (!nextBooking && bookings.length > 0) {
        nextBooking = bookings.find((b) => new Date(b.reserved_for).getTime() > now) || null
      }

      let status = r.status
      if (session) {
        status = session.status === "bill_requested" ? "bill_requested" : "occupied"
      } else if (heldBooking) {
        status = "reserved"
      }

      const orderMatch = session?.notes?.match(/Order\s*#?([A-Za-z0-9-]+)/i)
      const sessionOrderNumber = orderMatch ? orderMatch[1] : undefined

      return {
        id: r.id,
        name: r.name,
        capacity: Number(r.capacity),
        status,
        section: r.section,
        guestName: session?.customer_name || heldBooking?.customer_name || nextBooking?.customer_name || undefined,
        occupiedAt: session?.seated_at || heldBooking?.reserved_for || undefined,
        bookingId: heldBooking?.id || undefined,
        orderNumber: sessionOrderNumber,
        activeSession: session ? {
          id: session.id,
          customer_name: session.customer_name,
          phone: session.phone,
          guest_count: session.guest_count,
          seated_at: session.seated_at,
          status: session.status,
          notes: session.notes,
        } : null,
        heldBooking: heldBooking ? {
          id: heldBooking.id,
          customer_name: heldBooking.customer_name,
          phone: heldBooking.phone,
          party_size: heldBooking.party_size,
          reserved_for: heldBooking.reserved_for,
          duration_minutes: heldBooking.duration_minutes,
          status: heldBooking.status,
        } : null,
        nextBooking: nextBooking ? {
          id: nextBooking.id,
          customer_name: nextBooking.customer_name,
          phone: nextBooking.phone,
          party_size: nextBooking.party_size,
          reserved_for: nextBooking.reserved_for,
          duration_minutes: nextBooking.duration_minutes,
          status: nextBooking.status,
        } : null,
      }
    })
  },

  updateTableStatus(tableId: string, status: string): boolean {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const table = findTableInMemory(mem, tableId)
      if (!table) return false
      table.status = status
      table.updated_at = new Date().toISOString()
      return true
    }
    try {
      db.prepare("UPDATE pos_tables SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR name = ? COLLATE NOCASE").run(status, tableId, tableId)
      return true
    } catch {
      return false
    }
  },

  checkBookingConflict(tableId: string, reservedFor: string, durationMinutes: number, excludeBookingId?: string): any | null {
    const db = getDemoSqliteDb()
    const start = new Date(reservedFor).getTime() - 30 * 60000
    const end = new Date(reservedFor).getTime() + durationMinutes * 60000

    if (!db) {
      const mem = getMemState()
      const table = findTableInMemory(mem, tableId)
      const bookings = mem.reservations.filter(
        (b) =>
          (b.table_id === tableId || (table && (b.table_name || "").toLowerCase() === table.name.toLowerCase())) &&
          ["pending", "confirmed", "arrived"].includes(b.status)
      )
      for (const b of bookings) {
        if (excludeBookingId && b.id === excludeBookingId) continue
        const bStart = new Date(b.reserved_for).getTime() - 30 * 60000
        const bEnd = new Date(b.reserved_for).getTime() + (Number(b.duration_minutes) || 90) * 60000
        if (start < bEnd && bStart < end) {
          return b
        }
      }
      return null
    }

    const bookings = db.prepare(`
      SELECT * FROM reservations
      WHERE (table_id = ? OR table_name = (SELECT name FROM pos_tables WHERE id = ?))
        AND status IN ('pending', 'confirmed', 'arrived')
    `).all(tableId, tableId) as any[]

    for (const b of bookings) {
      if (excludeBookingId && b.id === excludeBookingId) continue
      const bStart = new Date(b.reserved_for).getTime() - 30 * 60000
      const bEnd = new Date(b.reserved_for).getTime() + (Number(b.duration_minutes) || 90) * 60000
      if (start < bEnd && bStart < end) {
        return b
      }
    }
    return null
  },

  getReservations(statusFilter?: string[]): any[] {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      let rows = [...mem.reservations]
      if (statusFilter && statusFilter.length > 0) {
        rows = rows.filter((r) => statusFilter.includes(r.status))
      }
      return rows
        .sort((a, b) => new Date(a.reserved_for).getTime() - new Date(b.reserved_for).getTime())
        .map((r) => ({ ...r }))
    }
    let query = "SELECT * FROM reservations"
    const params: any[] = []
    if (statusFilter && statusFilter.length > 0) {
      const placeholders = statusFilter.map(() => "?").join(",")
      query += ` WHERE status IN (${placeholders})`
      params.push(...statusFilter)
    }
    query += " ORDER BY reserved_for ASC"
    return db.prepare(query).all(...params) as any[]
  },

  getTableSessions(openOnly: boolean = true): any[] {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      let rows = [...mem.sessions]
      if (openOnly) {
        rows = rows.filter((s) => s.status === "open" || s.status === "bill_requested")
      }
      return rows
        .sort((a, b) => new Date(b.seated_at).getTime() - new Date(a.seated_at).getTime())
        .map((s) => {
          const table = findTableInMemory(mem, s.table_id)
          return { ...s, table_name: table?.name || s.table_id }
        })
    }
    let query = `
      SELECT s.*, t.name AS table_name 
      FROM table_sessions s 
      LEFT JOIN pos_tables t ON s.table_id = t.id
    `
    if (openOnly) {
      query += " WHERE s.status IN ('open', 'bill_requested')"
    }
    query += " ORDER BY s.seated_at DESC"
    return db.prepare(query).all() as any[]
  },

  recalculateTableStatus(tableIdOrName: string): any {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const table = findTableInMemory(mem, tableIdOrName)
      if (!table) return null

      const session = mem.sessions
        .filter((s) => (s.table_id === table.id || s.table_id === table.name) && (s.status === "open" || s.status === "bill_requested"))
        .sort((a, b) => new Date(b.seated_at).getTime() - new Date(a.seated_at).getTime())[0]

      let newStatus = "available"
      if (session) {
        newStatus = session.status === "bill_requested" ? "bill_requested" : "occupied"
      } else {
        const now = Date.now()
        const reservations = mem.reservations
          .filter((r) => (r.table_id === table.id || (r.table_name || "").toLowerCase() === table.name.toLowerCase()) && ["pending", "confirmed", "arrived"].includes(r.status))
          .sort((a, b) => new Date(a.reserved_for).getTime() - new Date(b.reserved_for).getTime())

        let isHeld = false
        for (const res of reservations) {
          if (res.status === "arrived") {
            isHeld = true
            break
          }
          const start = new Date(res.reserved_for).getTime() - 30 * 60000
          const end = new Date(res.reserved_for).getTime() + (Number(res.duration_minutes) || 90) * 60000
          if (now >= start && now <= end) {
            isHeld = true
            break
          }
        }

        if (isHeld) {
          newStatus = "reserved"
        } else if (table.status === "cleaning") {
          newStatus = "cleaning"
        } else {
          newStatus = "available"
        }
      }

      table.status = newStatus
      table.updated_at = new Date().toISOString()
      return { ...table }
    }

    const table = findTableInDb(db, tableIdOrName) as any
    if (!table) return null

    const session = db.prepare(
      "SELECT * FROM table_sessions WHERE (table_id = ? OR table_id = ?) AND status IN ('open', 'bill_requested') ORDER BY seated_at DESC LIMIT 1"
    ).get(table.id, table.name) as any

    let newStatus = "available"
    if (session) {
      newStatus = session.status === "bill_requested" ? "bill_requested" : "occupied"
    } else {
      const now = Date.now()
      const reservations = db.prepare(
        "SELECT * FROM reservations WHERE (table_id = ? OR table_name = ? COLLATE NOCASE) AND status IN ('pending', 'confirmed', 'arrived') ORDER BY reserved_for ASC"
      ).all(table.id, table.name) as any[]

      let isHeld = false
      for (const res of reservations) {
        if (res.status === "arrived") {
          isHeld = true
          break
        }
        const start = new Date(res.reserved_for).getTime() - 30 * 60000
        const end = new Date(res.reserved_for).getTime() + (Number(res.duration_minutes) || 90) * 60000
        if (now >= start && now <= end) {
          isHeld = true
          break
        }
      }

      if (isHeld) {
        newStatus = "reserved"
      } else if (table.status === "cleaning") {
        newStatus = "cleaning"
      } else {
        newStatus = "available"
      }
    }

    db.prepare("UPDATE pos_tables SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newStatus, table.id)
    return { ...table, status: newStatus }
  },

  createReservation(data: {
    customer_name: string
    phone: string
    party_size: number
    reserved_for: string
    duration_minutes?: number
    table_id?: string
    table_name?: string
    special_requests?: string
    source?: string
  }): { success: boolean; reservation?: any; error?: string } {
    const db = getDemoSqliteDb()
    const duration = Number(data.duration_minutes) || 90
    const partySize = Number(data.party_size) || 2
    const startMs = new Date(data.reserved_for).getTime()
    if (Number.isNaN(startMs)) {
      return { success: false, error: "Invalid reservation time" }
    }

    if (!db) {
      const mem = getMemState()
      let table: any = null
      if (data.table_id || data.table_name) {
        table = findTableInMemory(mem, data.table_id || data.table_name || "")
      }
      if (!table && data.table_id) {
        return { success: false, error: `Table '${data.table_id}' not found` }
      }
      if (!table) {
        const candidates = [...mem.tables]
          .filter((t) => Number(t.capacity) >= partySize)
          .sort((a, b) => Number(a.capacity) - Number(b.capacity) || String(a.name).localeCompare(String(b.name)))
        for (const cand of candidates) {
          if (!this.checkBookingConflict(cand.id, data.reserved_for, duration)) {
            table = cand
            break
          }
        }
        if (!table) {
          return { success: false, error: "No free table available for that party size and time" }
        }
      }
      if (Number(table.capacity) < partySize) {
        return { success: false, error: `${table.name} seats ${table.capacity} guests (party is ${partySize})` }
      }
      const conflict = this.checkBookingConflict(table.id, data.reserved_for, duration)
      if (conflict) {
        return {
          success: false,
          error: `${table.name} is already booked around that time by ${conflict.customer_name}`,
        }
      }
      const id = `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const nowIso = new Date().toISOString()
      const created = {
        id,
        customer_name: data.customer_name.trim(),
        phone: data.phone.trim(),
        party_size: partySize,
        reserved_for: data.reserved_for,
        duration_minutes: duration,
        table_id: table.id,
        table_name: table.name,
        status: "confirmed",
        special_requests: data.special_requests || "",
        source: data.source || "staff",
        created_at: nowIso,
        updated_at: nowIso,
      }
      mem.reservations.push(created)
      this.recalculateTableStatus(table.id)
      return { success: true, reservation: { ...created } }
    }

    try {
      let table: any = null
      if (data.table_id || data.table_name) {
        table = findTableInDb(db, data.table_id || data.table_name || "")
      }

      if (!table && data.table_id) {
        return { success: false, error: `Table '${data.table_id}' not found` }
      }

      if (!table) {
        const candidates = db.prepare(
          "SELECT * FROM pos_tables WHERE capacity >= ? ORDER BY capacity ASC, name ASC"
        ).all(partySize) as any[]

        for (const cand of candidates) {
          const clash = this.checkBookingConflict(cand.id, data.reserved_for, duration)
          if (!clash) {
            table = cand
            break
          }
        }

        if (!table) {
          return { success: false, error: "No free table available for that party size and time" }
        }
      }

      if (table.capacity < partySize) {
        return { success: false, error: `${table.name} seats ${table.capacity} guests (party is ${partySize})` }
      }

      const conflict = this.checkBookingConflict(table.id, data.reserved_for, duration)
      if (conflict) {
        return {
          success: false,
          error: `${table.name} is already booked around that time by ${conflict.customer_name}`
        }
      }

      const id = `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const nowIso = new Date().toISOString()

      db.prepare(`
        INSERT INTO reservations (
          id, customer_name, phone, party_size, reserved_for, duration_minutes,
          table_id, table_name, status, special_requests, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)
      `).run(
        id,
        data.customer_name.trim(),
        data.phone.trim(),
        partySize,
        data.reserved_for,
        duration,
        table.id,
        table.name,
        data.special_requests || "",
        data.source || "staff",
        nowIso,
        nowIso
      )

      this.recalculateTableStatus(table.id)

      const created = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id)
      return { success: true, reservation: created }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to create reservation" }
    }
  },

  updateReservation(id: string, updates: {
    customer_name?: string
    phone?: string
    party_size?: number
    reserved_for?: string
    duration_minutes?: number
    table_id?: string
    table_name?: string
    status?: string
    special_requests?: string
  }): { success: boolean; reservation?: any; error?: string } {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const existing = mem.reservations.find((r) => r.id === id)
      if (!existing) return { success: false, error: "Reservation not found" }

      const oldTableId = existing.table_id
      let targetTableId = oldTableId
      let targetTableName = existing.table_name

      if (updates.table_id || updates.table_name) {
        const found = findTableInMemory(mem, updates.table_id || updates.table_name || "")
        if (found) {
          targetTableId = found.id
          targetTableName = found.name
        }
      }

      const reservedFor = updates.reserved_for || existing.reserved_for
      const duration = updates.duration_minutes !== undefined ? Number(updates.duration_minutes) : existing.duration_minutes
      const status = updates.status || existing.status

      if (["pending", "confirmed", "arrived"].includes(status)) {
        const conflict = this.checkBookingConflict(targetTableId, reservedFor, duration, id)
        if (conflict) {
          return {
            success: false,
            error: `${targetTableName} is already booked around that time by ${conflict.customer_name}`,
          }
        }
      }

      if (updates.customer_name !== undefined) existing.customer_name = updates.customer_name.trim()
      if (updates.phone !== undefined) existing.phone = updates.phone.trim()
      if (updates.party_size !== undefined) existing.party_size = Number(updates.party_size)
      existing.reserved_for = reservedFor
      existing.duration_minutes = duration
      existing.table_id = targetTableId
      existing.table_name = targetTableName
      existing.status = status
      if (updates.special_requests !== undefined) existing.special_requests = updates.special_requests
      existing.updated_at = new Date().toISOString()

      if (oldTableId) this.recalculateTableStatus(oldTableId)
      if (targetTableId && targetTableId !== oldTableId) this.recalculateTableStatus(targetTableId)

      return { success: true, reservation: { ...existing } }
    }

    try {
      const existing = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id) as any
      if (!existing) return { success: false, error: "Reservation not found" }

      const oldTableId = existing.table_id
      let targetTableId = oldTableId
      let targetTableName = existing.table_name

      if (updates.table_id || updates.table_name) {
        const found = findTableInDb(db, updates.table_id || updates.table_name || "")
        if (found) {
          targetTableId = found.id
          targetTableName = found.name
        }
      }

      const reservedFor = updates.reserved_for || existing.reserved_for
      const duration = updates.duration_minutes !== undefined ? Number(updates.duration_minutes) : existing.duration_minutes
      const status = updates.status || existing.status

      if (["pending", "confirmed", "arrived"].includes(status)) {
        const conflict = this.checkBookingConflict(targetTableId, reservedFor, duration, id)
        if (conflict) {
          return {
            success: false,
            error: `${targetTableName} is already booked around that time by ${conflict.customer_name}`
          }
        }
      }

      db.prepare(`
        UPDATE reservations SET
          customer_name = COALESCE(?, customer_name),
          phone = COALESCE(?, phone),
          party_size = COALESCE(?, party_size),
          reserved_for = ?,
          duration_minutes = ?,
          table_id = ?,
          table_name = ?,
          status = ?,
          special_requests = COALESCE(?, special_requests),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        updates.customer_name?.trim() || null,
        updates.phone?.trim() || null,
        updates.party_size !== undefined ? Number(updates.party_size) : null,
        reservedFor,
        duration,
        targetTableId,
        targetTableName,
        status,
        updates.special_requests !== undefined ? updates.special_requests : null,
        id
      )

      if (oldTableId) this.recalculateTableStatus(oldTableId)
      if (targetTableId && targetTableId !== oldTableId) this.recalculateTableStatus(targetTableId)

      const updated = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id)
      return { success: true, reservation: updated }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update reservation" }
    }
  },

  cancelReservation(id: string): { success: boolean; error?: string } {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const res = mem.reservations.find((r) => r.id === id)
      if (!res) return { success: false, error: "Reservation not found" }
      res.status = "cancelled"
      res.updated_at = new Date().toISOString()
      if (res.table_id) this.recalculateTableStatus(res.table_id)
      return { success: true }
    }
    try {
      const res = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id) as any
      if (!res) return { success: false, error: "Reservation not found" }

      db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id)
      if (res.table_id) {
        this.recalculateTableStatus(res.table_id)
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to cancel reservation" }
    }
  },

  seatReservation(id: string, guestCount?: number): { success: boolean; session?: any; error?: string } {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const res = mem.reservations.find((r) => r.id === id)
      if (!res) return { success: false, error: "Reservation not found" }

      const table = findTableInMemory(mem, res.table_id || res.table_name)
      if (!table) return { success: false, error: "Table assigned to reservation does not exist" }

      const existingSession = mem.sessions.find(
        (s) => (s.table_id === table.id || s.table_id === table.name) && (s.status === "open" || s.status === "bill_requested")
      )
      if (existingSession) {
        return { success: false, error: `Cannot seat: Table ${table.name} is already occupied` }
      }

      const session = {
        id: `ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        table_id: table.id,
        customer_name: res.customer_name,
        phone: res.phone,
        guest_count: guestCount || res.party_size || 2,
        seated_at: new Date().toISOString(),
        status: "open",
        notes: res.special_requests || "Seated from reservation",
      }
      mem.sessions.push(session)
      res.status = "seated"
      res.updated_at = new Date().toISOString()
      table.status = "occupied"
      table.updated_at = new Date().toISOString()
      return { success: true, session: { ...session } }
    }
    try {
      const res = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id) as any
      if (!res) return { success: false, error: "Reservation not found" }

      const table = findTableInDb(db, res.table_id || res.table_name) as any
      if (!table) return { success: false, error: "Table assigned to reservation does not exist" }

      const existingSession = db.prepare(
        "SELECT * FROM table_sessions WHERE (table_id = ? OR table_id = ?) AND status IN ('open', 'bill_requested')"
      ).get(table.id, table.name)
      if (existingSession) {
        return { success: false, error: `Cannot seat: Table ${table.name} is already occupied` }
      }

      const sessionId = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const guests = guestCount || res.party_size || 2

      db.prepare(`
        INSERT INTO table_sessions (id, table_id, customer_name, phone, guest_count, seated_at, status, notes)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'open', ?)
      `).run(sessionId, table.id, res.customer_name, res.phone, guests, res.special_requests || "Seated from reservation")

      db.prepare("UPDATE reservations SET status = 'seated', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id)
      db.prepare("UPDATE pos_tables SET status = 'occupied', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(table.id)

      const session = db.prepare("SELECT * FROM table_sessions WHERE id = ?").get(sessionId)
      return { success: true, session }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to seat reservation" }
    }
  },

  seatWalkIn(tableIdOrName: string, guestInfo?: {
    customer_name?: string
    phone?: string
    guest_count?: number
    notes?: string
  }): { success: boolean; session?: any; error?: string; message?: string } {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      let table = findTableInMemory(mem, tableIdOrName)
      if (!table) {
        const cleanName = (tableIdOrName || "Table").trim()
        table = {
          id: `tbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: cleanName,
          capacity: 4,
          status: "occupied",
          section: "Indoor",
        }
        mem.tables.push(table)
      }

      const existingSession = mem.sessions.find(
        (s) => (s.table_id === table.id || s.table_id === table.name) && (s.status === "open" || s.status === "bill_requested")
      )
      if (existingSession) {
        return { success: false, error: `Cannot seat: Table ${table.name} is already occupied.` }
      }

      const newSession = {
        id: `ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        table_id: table.id,
        customer_name: guestInfo?.customer_name?.trim() || "Walk-in",
        phone: guestInfo?.phone || null,
        guest_count: guestInfo?.guest_count || 2,
        seated_at: new Date().toISOString(),
        status: "open",
        notes: guestInfo?.notes || "Walk-in seated",
      }
      mem.sessions.push(newSession)
      table.status = "occupied"
      table.updated_at = new Date().toISOString()
      return { success: true, session: { ...newSession } }
    }
    try {
      let table = findTableInDb(db, tableIdOrName) as any
      if (!table) {
        const cleanName = (tableIdOrName || "Table").trim()
        const newId = `tbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        db.prepare(
          "INSERT INTO pos_tables (id, name, capacity, status) VALUES (?, ?, 4, 'occupied')"
        ).run(newId, cleanName)
        table = { id: newId, name: cleanName, capacity: 4, status: "occupied" }
      }

      const existingSession = db.prepare(
        "SELECT * FROM table_sessions WHERE (table_id = ? OR table_id = ?) AND status IN ('open', 'bill_requested')"
      ).get(table.id, table.name)
      if (existingSession) {
        return { success: false, error: `Cannot seat: Table ${table.name} is already occupied.` }
      }

      const sessionId = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const guests = guestInfo?.guest_count || 2
      const customerName = guestInfo?.customer_name?.trim() || "Walk-in"

      db.prepare(`
        INSERT INTO table_sessions (id, table_id, customer_name, phone, guest_count, seated_at, status, notes)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'open', ?)
      `).run(sessionId, table.id, customerName, guestInfo?.phone || null, guests, guestInfo?.notes || "Walk-in seated")

      db.prepare("UPDATE pos_tables SET status = 'occupied', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(table.id)

      const session = db.prepare("SELECT * FROM table_sessions WHERE id = ?").get(sessionId)
      return { success: true, session }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to seat walk-in guests" }
    }
  },

  occupyTable(tableIdOrName: string, info?: {
    orderNumber?: string
    orderTotal?: number
    guestName?: string
    department?: string
  }): { success: boolean; session?: any; table?: any; error?: string } {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      let table = findTableInMemory(mem, tableIdOrName)
      if (!table) {
        const cleanName = (tableIdOrName || "Table").trim()
        table = {
          id: `tbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: cleanName,
          capacity: 4,
          status: "occupied",
          section: "Indoor",
        }
        mem.tables.push(table)
      }

      const existingSession = mem.sessions
        .filter((s) => (s.table_id === table.id || s.table_id === table.name) && (s.status === "open" || s.status === "bill_requested"))
        .sort((a, b) => new Date(b.seated_at).getTime() - new Date(a.seated_at).getTime())[0]

      const customerName = info?.guestName?.trim() || "Dine-in Guest"
      const noteText = info?.orderNumber ? `Order #${info.orderNumber}` : "Dine-in occupied"

      let session: any
      if (existingSession) {
        existingSession.customer_name = customerName || existingSession.customer_name
        existingSession.notes = noteText
        existingSession.status = "open"
        session = existingSession
      } else {
        session = {
          id: `ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          table_id: table.id,
          customer_name: customerName,
          guest_count: table.capacity || 2,
          seated_at: new Date().toISOString(),
          status: "open",
          notes: noteText,
        }
        mem.sessions.push(session)
      }

      table.status = "occupied"
      table.updated_at = new Date().toISOString()
      return { success: true, session: { ...session }, table: { ...table, status: "occupied" } }
    }
    try {
      let table = findTableInDb(db, tableIdOrName) as any
      if (!table) {
        const cleanName = (tableIdOrName || "Table").trim()
        const newId = `tbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        db.prepare(
          "INSERT INTO pos_tables (id, name, capacity, status) VALUES (?, ?, 4, 'occupied')"
        ).run(newId, cleanName)
        table = { id: newId, name: cleanName, capacity: 4, status: "occupied" }
      }

      const existingSession = db.prepare(
        "SELECT * FROM table_sessions WHERE (table_id = ? OR table_id = ?) AND status IN ('open', 'bill_requested') ORDER BY seated_at DESC LIMIT 1"
      ).get(table.id, table.name) as any

      const customerName = info?.guestName?.trim() || "Dine-in Guest"
      const noteText = info?.orderNumber ? `Order #${info.orderNumber}` : "Dine-in occupied"

      let sessionId: string
      if (existingSession) {
        sessionId = existingSession.id
        db.prepare(
          "UPDATE table_sessions SET customer_name = COALESCE(?, customer_name), notes = ?, status = 'open' WHERE id = ?"
        ).run(customerName, noteText, sessionId)
      } else {
        sessionId = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        db.prepare(`
          INSERT INTO table_sessions (id, table_id, customer_name, guest_count, seated_at, status, notes)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'open', ?)
        `).run(sessionId, table.id, customerName, table.capacity || 2, noteText)
      }

      db.prepare("UPDATE pos_tables SET status = 'occupied', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(table.id)

      const session = db.prepare("SELECT * FROM table_sessions WHERE id = ?").get(sessionId)
      return { success: true, session, table: { ...table, status: "occupied" } }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to occupy table" }
    }
  },

  releaseTable(tableIdOrName: string): { success: boolean; status?: string; error?: string } {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const table = findTableInMemory(mem, tableIdOrName)
      if (!table) return { success: true, status: "available" }

      for (const s of mem.sessions) {
        if ((s.table_id === table.id || s.table_id === table.name) && (s.status === "open" || s.status === "bill_requested")) {
          s.status = "closed"
        }
      }
      const updated = this.recalculateTableStatus(table.id)
      return { success: true, status: updated?.status || "available" }
    }
    try {
      const table = findTableInDb(db, tableIdOrName) as any
      if (!table) {
        return { success: true, status: "available" }
      }

      db.prepare(
        "UPDATE table_sessions SET status = 'closed' WHERE (table_id = ? OR table_id = ?) AND status IN ('open', 'bill_requested')"
      ).run(table.id, table.name)

      const updated = this.recalculateTableStatus(table.id)
      return { success: true, status: updated?.status || "available" }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to release table" }
    }
  },

  getCustomers(): MockCustomer[] {
    const db = getDemoSqliteDb()
    if (!db) return getMemState().customers.map((c) => ({ ...c }))
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

  getOrders(filters?: {
    startDate?: string
    endDate?: string
    status?: string
    paymentMethod?: string
    station?: string
    orderType?: string
    search?: string
  }): MockOrder[] {
    const db = getDemoSqliteDb()
    if (!db) {
      let rows = getMemState().orders.map((o: any) => ({ ...o }))
      if (filters?.startDate) {
        const startIso = filters.startDate.includes("T") ? filters.startDate : `${filters.startDate}T00:00:00.000Z`
        rows = rows.filter((o) => String(o.created_at) >= startIso)
      }
      if (filters?.endDate) {
        const endIso = filters.endDate.includes("T") ? filters.endDate : `${filters.endDate}T23:59:59.999Z`
        rows = rows.filter((o) => String(o.created_at) <= endIso)
      }
      if (filters?.status && filters.status !== "all") {
        rows = rows.filter((o) => o.status === filters.status)
      }
      if (filters?.paymentMethod && filters.paymentMethod !== "all") {
        rows = rows.filter((o) => o.payment_method === filters.paymentMethod)
      }
      if (filters?.orderType && filters.orderType !== "all") {
        rows = rows.filter((o) => o.order_type === filters.orderType)
      }
      if (filters?.station && filters.station !== "all") {
        rows = rows.filter((o) => (o.items || []).some((i: any) => i.station === filters.station))
      }
      if (filters?.search) {
        const s = filters.search.toLowerCase()
        rows = rows.filter(
          (o) =>
            String(o.order_number || "").toLowerCase().includes(s) ||
            String(o.table_name || "").toLowerCase().includes(s) ||
            String(o.receipt_number || "").toLowerCase().includes(s) ||
            String(o.cashier_name || "").toLowerCase().includes(s)
        )
      }
      return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    let query = "SELECT * FROM pos_orders WHERE 1=1"
    const params: any[] = []

    if (filters?.startDate) {
      const startIso = filters.startDate.includes("T") ? filters.startDate : `${filters.startDate}T00:00:00.000Z`
      query += " AND created_at >= ?"
      params.push(startIso)
    }
    if (filters?.endDate) {
      const endIso = filters.endDate.includes("T") ? filters.endDate : `${filters.endDate}T23:59:59.999Z`
      query += " AND created_at <= ?"
      params.push(endIso)
    }
    if (filters?.status && filters.status !== "all") {
      query += " AND status = ?"
      params.push(filters.status)
    }
    if (filters?.paymentMethod && filters.paymentMethod !== "all") {
      query += " AND payment_method = ?"
      params.push(filters.paymentMethod)
    }
    if (filters?.orderType && filters.orderType !== "all") {
      query += " AND order_type = ?"
      params.push(filters.orderType)
    }
    if (filters?.search) {
      query += " AND (LOWER(order_number) LIKE ? OR LOWER(table_name) LIKE ? OR LOWER(receipt_number) LIKE ? OR LOWER(cashier_name) LIKE ?)"
      const s = `%${filters.search.toLowerCase()}%`
      params.push(s, s, s, s)
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

      if (filters?.station && filters.station !== "all") {
        if (!items.some((i: any) => i.station === filters.station)) continue
      }

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

  getOrderByIdOrNumber(idOrNumber: string): any | null {
    if (!idOrNumber) return null
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const found = mem.orders.find((o) => o.id === idOrNumber || o.order_number === idOrNumber)
      if (!found) return null
      return {
        ...found,
        is_void: Boolean(found.is_void),
        items: (found.items || []).map((i: any) => ({
          ...i,
          product_name_snapshot: i.name,
          unit_price_snapshot: Number(i.price || 0),
        })),
        tickets: found.tickets || [],
      }
    }
    try {
      const row = db.prepare("SELECT * FROM pos_orders WHERE id = ? OR order_number = ? LIMIT 1").get(idOrNumber, idOrNumber) as any
      if (!row) return null
      const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(row.id) as any[]
      return {
        ...row,
        subtotal: Number(row.subtotal || 0),
        service_charge: Number(row.service_charge || 0),
        service_charge_rate: Number(row.service_charge_rate || 0),
        discount: Number(row.discount || 0),
        tax: Number(row.tax || 0),
        total: Number(row.total || 0),
        cash_received: Number(row.cash_received || 0),
        change_amount: Number(row.change_amount || 0),
        is_void: Boolean(row.is_void),
        items: items.map((i: any) => ({
          id: i.id,
          product_id: i.product_id,
          name: i.product_name,
          product_name_snapshot: i.product_name,
          price: Number(i.unit_price),
          unit_price_snapshot: Number(i.unit_price),
          quantity: Number(i.quantity),
          line_total: Number(i.line_total),
          station: i.station,
          item_status: i.item_status,
          notes: i.notes,
        })),
        tickets: [],
      }
    } catch {
      return null
    }
  },

  updateOrder(idOrNumber: string, updates: Record<string, any>): any | null {
    if (!idOrNumber) return null
    const ALLOWED_FIELDS = new Set([
      "status",
      "payment_status",
      "kitchen_status",
      "bar_status",
      "payment_method",
      "notes",
      "subtotal",
      "service_charge",
      "discount",
      "tax",
      "total",
      "cash_received",
      "change_amount",
      "is_void",
      "void_reason",
    ])
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const idx = mem.orders.findIndex((o) => o.id === idOrNumber || o.order_number === idOrNumber)
      if (idx === -1) return null
      const target = mem.orders[idx]
      for (const [key, val] of Object.entries(updates)) {
        if (!ALLOWED_FIELDS.has(key)) continue
        target[key] = val
      }
      target.updated_at = new Date().toISOString()
      return this.getOrderByIdOrNumber(target.id)
    }
    try {
      const setClauses: string[] = ["updated_at = CURRENT_TIMESTAMP"]
      const params: any[] = []
      for (const [key, val] of Object.entries(updates)) {
        if (!ALLOWED_FIELDS.has(key)) continue
        setClauses.push(`${key} = ?`)
        params.push(typeof val === "object" && val !== null ? JSON.stringify(val) : val)
      }
      if (setClauses.length > 1) {
        params.push(idOrNumber, idOrNumber)
        db.prepare(`UPDATE pos_orders SET ${setClauses.join(", ")} WHERE id = ? OR order_number = ?`).run(...params)
      }
      return this.getOrderByIdOrNumber(idOrNumber)
    } catch {
      return null
    }
  },

  createOrder(order: MockOrder): boolean {
    const db = getDemoSqliteDb()
    const idempotencyKey = (order as any).idempotency_key

    if (!db) {
      const mem = getMemState()
      if (idempotencyKey) {
        const dup = mem.orders.find((o) => o.idempotency_key === idempotencyKey)
        if (dup) return true
      }

      const normalizedItems = (order.items || []).map((item: any) => ({
        id: item.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product_id: item.product_id || item.id || null,
        name: item.name || "Item",
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        line_total: item.line_total != null ? Number(item.line_total) : Number(item.price || 0) * Number(item.quantity || 1),
        station: item.station || "kitchen",
        category: item.category || "General",
        notes: item.notes || "",
      }))

      const existingIdx = mem.orders.findIndex(
        (o) => (order.id && o.id === order.id) || (order.order_number && o.order_number === order.order_number)
      )

      const deductProductStock = (pId: string | null, name: string, qty: number) => {
        if (qty <= 0) return
        const prod = mem.products.find((p) => (pId && p.id === pId) || (name && p.name?.toLowerCase() === name.toLowerCase()))
        if (prod) {
          prod.stock = Math.max(0, Number(prod.stock || 0) - qty)
        }
      }

      if (existingIdx !== -1) {
        const existing = mem.orders[existingIdx]
        const wasDeducted = Boolean(existing.stock_deducted)
        const oldQtyMap = new Map<string, number>()
        for (const oldItem of existing.items || []) {
          const k = String(oldItem.product_id || oldItem.id || oldItem.name)
          oldQtyMap.set(k, (oldQtyMap.get(k) || 0) + Number(oldItem.quantity || 1))
        }

        existing.subtotal = Number(order.subtotal || 0)
        existing.service_charge = Number(order.service_charge || 0)
        existing.discount = Number(order.discount || 0)
        existing.tax = Number(order.tax || 0)
        existing.total = Number(order.total || 0)
        existing.payment_method = order.payment_method || existing.payment_method || "cash"
        if (order.split_payments) existing.split_payments = order.split_payments
        existing.cash_received = order.cash_received != null ? Number(order.cash_received) : Number(order.total || 0)
        existing.change_amount = Number(order.change_amount || 0)
        existing.status = order.status || "paid"
        existing.payment_status = order.payment_status || (existing.status === "open" ? "unpaid" : "paid")
        existing.kitchen_status = order.kitchen_status || existing.kitchen_status || "pending"
        existing.bar_status = order.bar_status || existing.bar_status || "pending"
        if (normalizedItems.length > 0) {
          existing.items = normalizedItems
        }
        existing.stock_deducted = true
        existing.updated_at = new Date().toISOString()

        if (!wasDeducted) {
          for (const item of normalizedItems) {
            deductProductStock(item.product_id, item.name, item.quantity)
          }
        } else if (normalizedItems.length > 0) {
          for (const item of normalizedItems) {
            const k = String(item.product_id || item.id || item.name)
            const prevQty = oldQtyMap.get(k) || 0
            if (item.quantity > prevQty) {
              deductProductStock(item.product_id, item.name, item.quantity - prevQty)
            }
          }
        }
        return true
      }

      const newOrder = {
        id: order.id || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        order_number: order.order_number,
        receipt_number: order.receipt_number || `LS-RC-${String(order.order_number || "").replace(/^LS-/, "")}`,
        table_name: order.table_name || "Takeaway",
        cashier_name: order.cashier_name || "Staff",
        department: order.department || "Juice & Food",
        order_type: order.order_type || "dine_in",
        items: normalizedItems,
        subtotal: Number(order.subtotal || 0),
        service_charge: Number(order.service_charge || 0),
        service_charge_rate: Number(order.service_charge_rate || 0),
        discount: Number(order.discount || 0),
        tax: Number(order.tax || 0),
        total: Number(order.total || 0),
        payment_method: order.payment_method || "cash",
        split_payments: order.split_payments,
        cash_received: order.cash_received != null ? Number(order.cash_received) : Number(order.total || 0),
        change_amount: Number(order.change_amount || 0),
        status: order.status || "paid",
        payment_status: order.payment_status || (String(order.status) === "open" ? "unpaid" : "paid"),
        kitchen_status: order.kitchen_status || "pending",
        bar_status: order.bar_status || "pending",
        customer_name: order.customer_name || "Walk-in",
        customer_id: order.customer_id,
        idempotency_key: idempotencyKey || undefined,
        stock_deducted: true,
        is_void: false,
        created_at: order.created_at || new Date().toISOString(),
      }
      mem.orders.unshift(newOrder)

      const seqMatch = String(order.order_number || "").match(/^LS-(\d+)$/)
      if (seqMatch) {
        mem.orderSeq = Math.max(mem.orderSeq || 100, Number(seqMatch[1]))
      }

      for (const item of normalizedItems) {
        deductProductStock(item.product_id, item.name, item.quantity)
      }
      return true
    }

    try {
      // Idempotency check: if idempotency_key already committed, return immediately
      if (idempotencyKey) {
        const existing = db.prepare("SELECT id FROM pos_orders WHERE idempotency_key = ?").get(idempotencyKey)
        if (existing) {
          return true
        }
      }

      // Check if updating an existing order (e.g. paying an open tab)
      const existingOrder = db.prepare("SELECT id, status, stock_deducted FROM pos_orders WHERE id = ? OR order_number = ?").get(order.id, order.order_number) as any
      const wasDeducted = Boolean(existingOrder && existingOrder.stock_deducted)

      if (existingOrder) {
        const prevItems = db.prepare("SELECT product_id, product_name, quantity FROM order_items WHERE order_id = ?").all(existingOrder.id) as any[]
        const prevQtyMap = new Map<string, number>()
        for (const pi of prevItems) {
          const k = String(pi.product_id || pi.product_name)
          prevQtyMap.set(k, (prevQtyMap.get(k) || 0) + Number(pi.quantity || 1))
        }

        db.prepare(`
          UPDATE pos_orders SET
            subtotal = ?, service_charge = ?, discount = ?, tax = ?, total = ?,
            payment_method = ?, split_payments = ?, cash_received = ?, change_amount = ?,
            status = ?, payment_status = ?, kitchen_status = ?, bar_status = ?,
            stock_deducted = 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          order.subtotal || 0,
          order.service_charge || 0,
          order.discount || 0,
          order.tax || 0,
          order.total || 0,
          order.payment_method || "cash",
          order.split_payments ? JSON.stringify(order.split_payments) : null,
          order.cash_received != null ? order.cash_received : (order.total || 0),
          order.change_amount || 0,
          order.status || "paid",
          order.payment_status || (String(order.status) === "open" ? "unpaid" : "paid"),
          order.kitchen_status || "pending",
          order.bar_status || "pending",
          existingOrder.id
        )

        if ((order.items || []).length > 0) {
          db.prepare("DELETE FROM order_items WHERE order_id = ?").run(existingOrder.id)
          const insertItem = db.prepare(`
            INSERT INTO order_items (
              id, order_id, product_id, product_name, unit_price, quantity, line_total, station, category, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          for (const item of order.items) {
            const lineTotal = item.line_total != null ? item.line_total : ((item.price || 0) * (item.quantity || 1))
            const pId = item.product_id || (item as any).id || null
            insertItem.run(
              item.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              existingOrder.id,
              pId,
              item.name || "Item",
              item.price || 0,
              item.quantity || 1,
              lineTotal,
              item.station || "kitchen",
              item.category || "General",
              item.notes || null
            )
          }
        }

        // Only deduct stock for newly added quantities (or full if not previously deducted)
        const updateStockStmt = db.prepare(`
          UPDATE pos_products SET stock = MAX(0, stock - ?) WHERE id = ? OR name = ?
        `)
        for (const item of (order.items || [])) {
          const pId = item.product_id || (item as any).id || null
          const qty = Number(item.quantity || 1)
          const prevQty = wasDeducted ? (prevQtyMap.get(String(pId || item.name)) || 0) : 0
          const delta = qty - prevQty
          if (delta > 0 && (pId || item.name)) {
            updateStockStmt.run(delta, pId || "", item.name || "")
          }
        }
        return true
      }

      const orderId = order.id || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const insertOrder = db.prepare(`
        INSERT INTO pos_orders (
          id, order_number, receipt_number, table_name, cashier_name, department, order_type,
          subtotal, service_charge, service_charge_rate, discount, tax, total,
          payment_method, split_payments, cash_received, change_amount,
          status, payment_status, kitchen_status, bar_status, customer_name, customer_id,
          idempotency_key, stock_deducted, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, 1, ?
        )
      `)

      insertOrder.run(
        orderId,
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
        order.payment_status || (String(order.status) === "open" ? "unpaid" : "paid"),
        order.kitchen_status || "pending",
        order.bar_status || "pending",
        order.customer_name || "Walk-in",
        order.customer_id || null,
        idempotencyKey || null,
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
          orderId,
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

  voidOrder(orderIdOrNumber: string, reason = "Voided by staff"): boolean {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      const order = mem.orders.find((o) => o.id === orderIdOrNumber || o.order_number === orderIdOrNumber)
      if (!order) return false
      if (order.is_void) return true

      if (order.stock_deducted) {
        for (const item of order.items || []) {
          const prod = mem.products.find(
            (p) => (item.product_id && p.id === item.product_id) || (item.name && p.name?.toLowerCase() === item.name.toLowerCase())
          )
          if (prod) {
            prod.stock = Number(prod.stock || 0) + Number(item.quantity || 1)
          }
        }
      }

      order.status = "cancelled"
      order.payment_status = "void"
      order.is_void = true
      order.void_reason = reason
      order.stock_deducted = false
      order.updated_at = new Date().toISOString()
      return true
    }
    try {
      const order = db.prepare("SELECT * FROM pos_orders WHERE id = ? OR order_number = ?").get(orderIdOrNumber, orderIdOrNumber) as any
      if (!order) return false
      if (order.is_void) return true

      if (order.stock_deducted) {
        const items = db.prepare("SELECT product_id, product_name, quantity FROM order_items WHERE order_id = ?").all(order.id) as any[]
        const restoreStock = db.prepare("UPDATE pos_products SET stock = stock + ? WHERE id = ? OR name = ?")
        for (const item of items) {
          restoreStock.run(item.quantity || 1, item.product_id, item.product_name)
        }
      }

      db.prepare(`
        UPDATE pos_orders
        SET status = 'cancelled', payment_status = 'void', is_void = 1, void_reason = ?, stock_deducted = 0
        WHERE id = ?
      `).run(reason, order.id)

      return true
    } catch (err) {
      console.error("Failed to void order in SQLite:", err)
      return false
    }
  },

  getIngredients(): any[] {
    const db = getDemoSqliteDb()
    if (!db) {
      return getMemState().ingredients
        .filter((i: any) => !i.is_archived)
        .map((i: any) => ({ ...i }))
    }
    try {
      let rows = db.prepare("SELECT * FROM ingredients WHERE is_active = 1 ORDER BY name ASC").all() as any[]
      if (rows.length === 0) {
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO ingredients (id, sku, name, category_id, current_stock, base_unit, reorder_level, cost_per_unit, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `)
        for (const ing of MOCK_INGREDIENTS) {
          insertStmt.run(
            ing.id,
            ing.sku,
            ing.name,
            (ing as any).category_id || null,
            ing.current_stock ?? (ing as any).current_stock_base ?? 0,
            ing.base_unit,
            ing.reorder_level ?? (ing as any).reorder_level_base ?? 0,
            ing.cost_per_unit ?? 0
          )
        }
        rows = db.prepare("SELECT * FROM ingredients WHERE is_active = 1 ORDER BY name ASC").all() as any[]
      }
      const mockById = new Map(MOCK_INGREDIENTS.map((i: any) => [i.id, i]))
      return rows.map((r: any) => {
        const mock: any = mockById.get(r.id)
        const stockVal = Number(r.current_stock ?? 0)
        const reorderVal = Number(r.reorder_level ?? 0)
        return {
          id: r.id,
          sku: r.sku,
          name: r.name,
          category_id: r.category_id || null,
          category: mock?.category || "Pantry",
          dimension: mock?.dimension || (r.base_unit === "ml" ? "volume" : r.base_unit === "g" ? "weight" : "count"),
          base_unit: r.base_unit,
          default_purchase_unit: mock?.default_purchase_unit || r.base_unit,
          current_stock: stockVal,
          current_stock_base: stockVal,
          par_level_base: mock?.par_level_base ?? reorderVal * 3,
          reorder_level: reorderVal,
          reorder_level_base: reorderVal,
          reorder_qty_base: mock?.reorder_qty_base ?? reorderVal * 2,
          cost_per_unit: Number(r.cost_per_unit ?? 0),
          is_perishable: mock?.is_perishable ?? true,
          is_active: Boolean(r.is_active),
          is_archived: false,
          version: 1,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }
      })
    } catch {
      return getMemState().ingredients.map((i: any) => ({ ...i }))
    }
  },

  createIngredient(data: any): any {
    const db = getDemoSqliteDb()
    const id = data.id || crypto.randomUUID()
    const sku = data.sku || `ING-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
    const nowIso = new Date().toISOString()
    const stockVal = Number(data.current_stock_base ?? data.current_stock ?? 0)
    const reorderVal = Number(data.reorder_level_base ?? data.reorder_level ?? 0)

    const created = {
      id,
      sku,
      name: String(data.name || "").trim(),
      category_id: data.category_id || null,
      category: data.category || "Pantry",
      dimension: data.dimension || (data.base_unit === "ml" ? "volume" : data.base_unit === "g" ? "weight" : "count"),
      base_unit: data.base_unit || "pcs",
      default_purchase_unit: data.default_purchase_unit || data.base_unit || "pcs",
      current_stock: stockVal,
      current_stock_base: stockVal,
      par_level_base: Number(data.par_level_base ?? reorderVal * 3),
      reorder_level: reorderVal,
      reorder_level_base: reorderVal,
      reorder_qty_base: Number(data.reorder_qty_base ?? reorderVal * 2),
      cost_per_unit: Number(data.cost_per_unit ?? 0),
      is_perishable: data.is_perishable !== false,
      is_active: true,
      is_archived: false,
      version: 1,
      created_at: nowIso,
      updated_at: nowIso,
    }

    if (!db) {
      getMemState().ingredients.push(created)
      return { ...created }
    }

    try {
      db.prepare(`
        INSERT INTO ingredients (id, sku, name, category_id, current_stock, base_unit, reorder_level, cost_per_unit, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        created.id,
        created.sku,
        created.name,
        created.category_id,
        created.current_stock_base,
        created.base_unit,
        created.reorder_level_base,
        created.cost_per_unit
      )
    } catch (err) {
      console.warn("DemoDbService.createIngredient SQLite warning:", err)
    }
    return created
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

  getNextOrderNumber(): { orderNumber: string; receiptNumber: string; seq: number } {
    const db = getDemoSqliteDb()
    if (!db) {
      const mem = getMemState()
      let maxOrderSeq = mem.orderSeq || 100
      for (const o of mem.orders) {
        const m = String(o.order_number || "").match(/^LS-(\d+)$/)
        if (m) maxOrderSeq = Math.max(maxOrderSeq, Number(m[1]))
      }
      mem.orderSeq = maxOrderSeq + 1
      const seq = mem.orderSeq
      const formatted = String(seq).padStart(6, "0")
      return { orderNumber: `LS-${formatted}`, receiptNumber: `LS-RC-${formatted}`, seq }
    }
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS system_sequences (
          name TEXT PRIMARY KEY,
          current_val INTEGER NOT NULL DEFAULT 100
        );
      `)
      const row = db.prepare("SELECT current_val FROM system_sequences WHERE name = 'pos_orders'").get() as any
      if (!row) {
        const maxRow = db.prepare(`
          SELECT MAX(CAST(substr(order_number, 4) AS INTEGER)) as max_seq FROM pos_orders WHERE order_number LIKE 'LS-%'
        `).get() as any
        let maxCoffee = { max_seq: 0 }
        try {
          maxCoffee = db.prepare(`
            SELECT MAX(CAST(substr(bill_number, 4) AS INTEGER)) as max_seq FROM coffee_bills WHERE bill_number LIKE 'LS-%'
          `).get() as any
        } catch {}
        const initSeq = Math.max(100, Number(maxRow?.max_seq || 100), Number(maxCoffee?.max_seq || 100))
        db.prepare("INSERT INTO system_sequences (name, current_val) VALUES ('pos_orders', ?)").run(initSeq)
      }
      const updated = db.prepare(
        "UPDATE system_sequences SET current_val = current_val + 1 WHERE name = 'pos_orders' RETURNING current_val"
      ).get() as any
      const seq = updated?.current_val || 101
      const formatted = String(seq).padStart(6, "0")
      return { orderNumber: `LS-${formatted}`, receiptNumber: `LS-RC-${formatted}`, seq }
    } catch {
      const mem = getMemState()
      mem.orderSeq = (mem.orderSeq || 100) + 1
      const seq = mem.orderSeq
      const formatted = String(seq).padStart(6, "0")
      return { orderNumber: `LS-${formatted}`, receiptNumber: `LS-RC-${formatted}`, seq }
    }
  },

  resetDatabase(): boolean {
    globalForDemoMem.__pos_demo_memory_state = createInitialMemoryState()
    const db = getDemoSqliteDb()
    if (!db) return true
    try {
      db.exec(`
        DELETE FROM order_items;
        DELETE FROM station_tickets;
        DELETE FROM pos_orders;
        DELETE FROM pos_products;
        DELETE FROM pos_categories;
        DELETE FROM reservations;
        DELETE FROM table_sessions;
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

  saveUpload(filename: string, mimeType: string, base64Data: string): boolean {
    if (!filename || !base64Data) return false
    const db = getDemoSqliteDb()
    if (!db) {
      getMemState().uploads.set(filename, {
        filename,
        mime_type: mimeType || "image/jpeg",
        data_base64: base64Data,
      })
      return true
    }
    try {
      db.prepare(`
        INSERT INTO pos_uploads (filename, mime_type, data_base64, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(filename) DO UPDATE SET
          mime_type = excluded.mime_type,
          data_base64 = excluded.data_base64,
          created_at = CURRENT_TIMESTAMP
      `).run(filename, mimeType || "image/jpeg", base64Data)
      return true
    } catch (err) {
      console.warn("DemoDbService.saveUpload error:", err)
      return false
    }
  },

  getUpload(filename: string): { filename: string; mime_type: string; data_base64: string } | null {
    if (!filename) return null
    const db = getDemoSqliteDb()
    if (!db) {
      return getMemState().uploads.get(filename) || null
    }
    try {
      const row = db.prepare(
        "SELECT filename, mime_type, data_base64 FROM pos_uploads WHERE filename = ? LIMIT 1"
      ).get(filename) as any
      return row || null
    } catch (err) {
      console.warn("DemoDbService.getUpload error:", err)
      return null
    }
  },

  // =========================================================================
  // RBAC ROLES & PERMISSIONS
  // =========================================================================
  getRoles(): any[] {
    const buildFallback = () => getMemState().roles.map((r) => ({ ...r, permissions: [...r.permissions] }))

    const db = getDemoSqliteDb()
    if (!db) return buildFallback()

    try {
      const roles = db.prepare("SELECT * FROM roles ORDER BY is_system DESC, name ASC").all() as any[]
      if (!roles || roles.length === 0) return buildFallback()

      let rpRows: any[] = []
      try {
        rpRows = db.prepare("SELECT role_id, permission_id FROM role_permissions").all() as any[]
      } catch {}

      let userCounts: any[] = []
      try {
        userCounts = db.prepare("SELECT role_id, count(*) as cnt FROM app_users WHERE is_active = 1 GROUP BY role_id").all() as any[]
      } catch {}

      const countMap = new Map<string, number>()
      for (const u of userCounts) {
        countMap.set(u.role_id, Number(u.cnt))
      }

      return roles.map((r: any) => {
        const canonical = normalizeRole(r.name || r.id)
        let perms = rpRows
          .filter((rp: any) => rp.role_id === r.id || rp.role_id === canonical || rp.role_id === `role-${canonical}`)
          .map((rp: any) => rp.permission_id)

        if (perms.length === 0 && DEFAULT_ROLE_PERMISSIONS[canonical]) {
          perms = [...DEFAULT_ROLE_PERMISSIONS[canonical]]
        }

        const userCount = countMap.get(r.id) ?? 0

        return {
          id: r.id,
          name: r.name,
          description: r.description || "",
          is_system: Boolean(r.is_system),
          permissions: perms,
          user_count: userCount,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }
      })
    } catch (err) {
      console.warn("DemoDbService.getRoles error:", err)
      return buildFallback()
    }
  },

  getRoleById(roleId: string): any | null {
    const roles = this.getRoles()
    const cleanId = (roleId || "").trim().toLowerCase()
    const norm = normalizeRole(cleanId)
    return (
      roles.find(
        (r: any) =>
          r.id.toLowerCase() === cleanId ||
          r.id.toLowerCase() === `role-${cleanId}` ||
          `role-${r.id.toLowerCase()}` === cleanId ||
          r.name.toLowerCase() === cleanId ||
          normalizeRole(r.id) === norm ||
          normalizeRole(r.name) === norm
      ) || null
    )
  },

  updateRolePermissions(roleId: string, permissions: string[]): any {
    const db = getDemoSqliteDb()
    const cleanId = (roleId || "").trim()
    const norm = normalizeRole(cleanId)
    const effectiveId =
      cleanId === "role-admin" || cleanId === "admin" ? "admin"
      : cleanId === "role-manager" || cleanId === "manager" ? "manager"
      : cleanId === "role-cashier" || cleanId === "cashier" ? "cashier"
      : cleanId === "role-kitchen" || cleanId === "kitchen" ? "kitchen"
      : cleanId === "role-staff" || cleanId === "staff" ? "staff"
      : cleanId

    const validCodes = new Set(SYSTEM_PERMISSIONS.map((p) => p.code))
    const filteredPerms = permissions.filter((p) => validCodes.has(p))

    if (db) {
      try {
        let role = db.prepare("SELECT * FROM roles WHERE id = ? OR id = ? OR LOWER(name) = ?").get(effectiveId, cleanId, norm) as any
        if (!role) {
          db.prepare("INSERT OR REPLACE INTO roles (id, name, description, is_system) VALUES (?, ?, ?, 1)").run(
            effectiveId,
            getRoleDisplayName(norm),
            `${getRoleDisplayName(norm)} role`,
            1
          )
          role = { id: effectiveId, name: getRoleDisplayName(norm), description: "", is_system: 1 }
        }

        const targetId = role.id

        db.prepare("DELETE FROM role_permissions WHERE role_id = ? OR role_id = ?").run(targetId, cleanId)

        const insertStmt = db.prepare("INSERT OR REPLACE INTO role_permissions (role_id, permission_id) VALUES (?, ?)")
        for (const p of filteredPerms) {
          insertStmt.run(targetId, p)
        }

        try {
          db.prepare("UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(targetId)
        } catch {}

        return {
          id: targetId,
          name: role.name,
          description: role.description || "",
          is_system: Boolean(role.is_system),
          permissions: filteredPerms,
          user_count: 1,
        }
      } catch (err) {
        console.warn("DemoDbService.updateRolePermissions error:", err)
      }
    }

    const memRoles = getMemState().roles
    const memRole = memRoles.find(
      (r) => r.id === effectiveId || r.id === cleanId || r.name.toLowerCase() === cleanId.toLowerCase()
    )
    if (memRole) {
      memRole.permissions = filteredPerms
      memRole.updated_at = new Date().toISOString()
      return { ...memRole, permissions: [...memRole.permissions] }
    }

    return {
      id: effectiveId,
      name: getRoleDisplayName(norm),
      description: "",
      is_system: true,
      permissions: filteredPerms,
      user_count: 1,
    }
  },

  createRole(params: { name: string; description?: string; permissions: string[] }): any {
    const db = getDemoSqliteDb()
    const name = params.name.trim()
    const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-") + "-" + Date.now().toString(36)
    const validCodes = new Set(SYSTEM_PERMISSIONS.map((p) => p.code))
    const filteredPerms = (params.permissions || []).filter((p) => validCodes.has(p))

    if (db) {
      try {
        db.prepare("INSERT INTO roles (id, name, description, is_system) VALUES (?, ?, ?, 0)").run(
          id,
          name,
          params.description || ""
        )
        const insertStmt = db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)")
        for (const p of filteredPerms) {
          insertStmt.run(id, p)
        }
      } catch (err) {
        console.warn("DemoDbService.createRole db error:", err)
      }
    }

    const created = {
      id,
      name,
      description: params.description || "",
      is_system: false,
      permissions: filteredPerms,
      user_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (!db) {
      getMemState().roles.push(created)
    }
    return created
  },

  updateRole(id: string, params: { name?: string; description?: string }): any {
    const db = getDemoSqliteDb()
    const existing = this.getRoleById(id)
    if (!existing) throw new Error("Role not found.")

    const nextName = params.name !== undefined ? params.name.trim() : existing.name
    const nextDesc = params.description !== undefined ? params.description.trim() : existing.description

    if (db) {
      try {
        db.prepare("UPDATE roles SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
          nextName,
          nextDesc,
          existing.id
        )
      } catch (err) {
        console.warn("DemoDbService.updateRole db error:", err)
      }
    } else {
      const memRole = getMemState().roles.find((r) => r.id === existing.id)
      if (memRole) {
        memRole.name = nextName
        memRole.description = nextDesc
        memRole.updated_at = new Date().toISOString()
      }
    }

    return {
      ...existing,
      name: nextName,
      description: nextDesc,
      updated_at: new Date().toISOString(),
    }
  },

  deleteRole(id: string): void {
    const db = getDemoSqliteDb()
    const existing = this.getRoleById(id)
    if (!existing) throw new Error("Role not found.")
    if (existing.is_system) throw new Error(`System role "${existing.name}" cannot be deleted.`)

    if (db) {
      try {
        db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(existing.id)
        db.prepare("DELETE FROM roles WHERE id = ?").run(existing.id)
      } catch (err) {
        console.warn("DemoDbService.deleteRole db error:", err)
      }
    } else {
      const mem = getMemState()
      mem.roles = mem.roles.filter((r) => r.id !== existing.id)
    }
  },
}
