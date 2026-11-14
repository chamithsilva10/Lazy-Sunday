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
    `)

    // Check if tables exist, otherwise run schema & seed
    const tableCheck = dbInstance
      .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='pos_products'")
      .get() as { cnt: number }

    if (!tableCheck || tableCheck.cnt === 0) {
      initSchemaAndSeed(dbInstance)
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
    if (!db) return MOCK_PRODUCTS

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

    let prods = rows.map((r: any) => ({
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
    const db = getDemoSqliteDb()
    if (!db || !idOrName) return null
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
    const db = getDemoSqliteDb()
    if (!db || !idOrName) return null

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
    }

    return this.getProductById(id) || {
      id,
      name: data.name.trim(),
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
    }
  },

  deleteProduct(idOrName: string): boolean {
    const db = getDemoSqliteDb()
    if (!db || !idOrName) return false
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

  getTables(): any[] {
    const db = getDemoSqliteDb()
    if (!db) return MOCK_TABLES
    const rows = db.prepare("SELECT * FROM pos_tables ORDER BY name").all() as any[]
    const now = Date.now()

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
    if (!db) return false
    try {
      db.prepare("UPDATE pos_tables SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR name = ? COLLATE NOCASE").run(status, tableId, tableId)
      return true
    } catch {
      return false
    }
  },

  checkBookingConflict(tableId: string, reservedFor: string, durationMinutes: number, excludeBookingId?: string): any | null {
    const db = getDemoSqliteDb()
    if (!db) return null
    const start = new Date(reservedFor).getTime() - 30 * 60000
    const end = new Date(reservedFor).getTime() + durationMinutes * 60000

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
    if (!db) return []
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
    if (!db) return []
    let query = "SELECT * FROM table_sessions"
    if (openOnly) {
      query += " WHERE status IN ('open', 'bill_requested')"
    }
    query += " ORDER BY seated_at DESC"
    return db.prepare(query).all() as any[]
  },

  recalculateTableStatus(tableIdOrName: string): any {
    const db = getDemoSqliteDb()
    if (!db) return null
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
    if (!db) return { success: false, error: "Database not available" }

    try {
      const duration = Number(data.duration_minutes) || 90
      const partySize = Number(data.party_size) || 2
      const startMs = new Date(data.reserved_for).getTime()
      if (Number.isNaN(startMs)) {
        return { success: false, error: "Invalid reservation time" }
      }

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
    if (!db) return { success: false, error: "Database not available" }

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
    if (!db) return { success: false, error: "Database not available" }
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
    if (!db) return { success: false, error: "Database not available" }
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
      const cleanName = (tableIdOrName || "Table").trim()
      const newSession = {
        id: `ses-${Date.now()}`,
        table_id: tableIdOrName,
        customer_name: guestInfo?.customer_name || "Walk-in",
        phone: guestInfo?.phone || null,
        guest_count: guestInfo?.guest_count || 2,
        seated_at: new Date().toISOString(),
        status: "open",
        notes: guestInfo?.notes || "Walk-in seated",
      }
      return { success: true, session: newSession }
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
        return { success: true, session: existingSession, message: `Table ${table.name} is already seated` }
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
      const cleanName = (tableIdOrName || "Table").trim()
      const newSession = {
        id: `ses-${Date.now()}`,
        table_id: tableIdOrName,
        customer_name: info?.guestName || "Dine-in Guest",
        guest_count: 2,
        seated_at: new Date().toISOString(),
        status: "open",
        notes: info?.orderNumber ? `Order #${info.orderNumber}` : "Dine-in occupied",
      }
      return { success: true, session: newSession, table: { id: tableIdOrName, name: cleanName, status: "occupied" } }
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
    if (!db) return { success: true, status: "available" }
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
      // Idempotency check: if idempotency_key already committed, return immediately
      const idempotencyKey = (order as any).idempotency_key
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
        db.prepare(`
          UPDATE pos_orders SET
            subtotal = ?, service_charge = ?, discount = ?, tax = ?, total = ?,
            payment_method = ?, split_payments = ?, cash_received = ?, change_amount = ?,
            status = ?, payment_status = ?, kitchen_status = ?, bar_status = ?,
            stock_deducted = 1
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
          order.payment_status || "paid",
          order.kitchen_status || "pending",
          order.bar_status || "pending",
          existingOrder.id
        )

        // Only deduct stock if not already deducted!
        if (!wasDeducted) {
          const updateStockStmt = db.prepare(`
            UPDATE pos_products SET stock = MAX(0, stock - ?) WHERE id = ? OR name = ?
          `)
          for (const item of (order.items || [])) {
            const pId = item.product_id || (item as any).id || null
            if (pId) {
              updateStockStmt.run(item.quantity || 1, pId, item.name || "")
            }
          }
        }
        return true
      }

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

  voidOrder(orderIdOrNumber: string, reason = "Voided by staff"): boolean {
    const db = getDemoSqliteDb()
    if (!db) return false
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
      const seq = 101
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
      const seq = 101
      const formatted = String(seq).padStart(6, "0")
      return { orderNumber: `LS-${formatted}`, receiptNumber: `LS-RC-${formatted}`, seq }
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
}
