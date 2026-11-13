import pg from "pg"
import crypto from "node:crypto"

const { Pool } = pg

// Maintain a singleton connection pool across serverless warm invocations
const globalForPg = globalThis as unknown as {
  posPgPool?: pg.Pool
}

function getConnectionString(): string {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL
  if (process.env.POSTGRES_URL_NON_POOLING) return process.env.POSTGRES_URL_NON_POOLING
  // Default local fallback if environment variables are not yet loaded
  return "postgresql://postgres:postgres@127.0.0.1:5432/pos_test"
}

export function getPgPool(): pg.Pool {
  if (!globalForPg.posPgPool) {
    const connStr = getConnectionString()
    const isLocal = connStr.includes("127.0.0.1") || connStr.includes("localhost")
    globalForPg.posPgPool = new Pool({
      connectionString: connStr,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }
  return globalForPg.posPgPool
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return `${salt}:${derivedKey.toString("hex")}`
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) return false
  const parts = storedHash.split(":")
  if (parts.length !== 2) return false
  const [salt, key] = parts
  const derivedKey = crypto.scryptSync(password, salt, 64)
  const keyBuffer = Buffer.from(key, "hex")
  if (derivedKey.length !== keyBuffer.length) return false
  return crypto.timingSafeEqual(derivedKey, keyBuffer)
}

function isUuid(val?: string | null): boolean {
  if (!val) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
}

export const PosDatabase = {
  // =========================================================================
  // BILL NUMBER GENERATION (ATOMIC POSTGRESQL SEQUENCE)
  // =========================================================================
  async getNextBillNumbers(): Promise<{ orderNumber: string; receiptNumber: string; seq: number }> {
    const pool = getPgPool()
    const res = await pool.query("SELECT get_next_bill_numbers() AS data")
    const row = res.rows[0]?.data || res.rows[0]
    return {
      orderNumber: row.order_number,
      receiptNumber: row.receipt_number,
      seq: Number(row.seq) || 101,
    }
  },

  // =========================================================================
  // ATOMIC ORDER CREATION & VOID
  // =========================================================================
  async createOrderAtomic(order: any, items: any[]): Promise<any> {
    const pool = getPgPool()
    const res = await pool.query(
      "SELECT create_pos_order_atomic($1::jsonb, $2::jsonb) AS result",
      [JSON.stringify(order), JSON.stringify(items)]
    )
    return res.rows[0]?.result
  },

  async voidOrderAtomic(orderId: string, reason: string, restoreInventory?: boolean): Promise<any> {
    const pool = getPgPool()
    let uuidVal = orderId
    if (!isUuid(orderId)) {
      const found = await this.getOrderByIdOrNumber(orderId)
      if (found?.id) uuidVal = found.id
    }
    const res = await pool.query(
      "SELECT void_pos_order_atomic($1::uuid, $2::text, $3::boolean) AS result",
      [uuidVal, reason, typeof restoreInventory === "boolean" ? restoreInventory : null]
    )
    return res.rows[0]?.result
  },

  // =========================================================================
  // ORDERS QUERY & RETRIEVAL
  // =========================================================================
  async getOrders(filters: {
    startDate?: string
    endDate?: string
    status?: string
    paymentMethod?: string
    station?: string
    orderType?: string
    search?: string
    page?: number
    limit?: number
    returnAll?: boolean
  }): Promise<{ orders: any[]; total: number; totalPages: number }> {
    const pool = getPgPool()
    const conditions: string[] = []
    const params: any[] = []
    let pIdx = 1

    if (filters.startDate) {
      conditions.push(`o.created_at >= $${pIdx++}`)
      params.push(new Date(`${filters.startDate}T00:00:00.000Z`).toISOString())
    }
    if (filters.endDate) {
      conditions.push(`o.created_at <= $${pIdx++}`)
      params.push(new Date(`${filters.endDate}T23:59:59.999Z`).toISOString())
    }
    if (filters.status && filters.status !== "all") {
      conditions.push(`o.status = $${pIdx++}`)
      params.push(filters.status)
    }
    if (filters.paymentMethod && filters.paymentMethod !== "all") {
      conditions.push(`o.payment_method = $${pIdx++}`)
      params.push(filters.paymentMethod)
    }
    if (filters.orderType && filters.orderType !== "all") {
      conditions.push(`o.order_type = $${pIdx++}`)
      params.push(filters.orderType)
    }
    if (filters.search) {
      conditions.push(`(
        o.order_number ILIKE $${pIdx} OR
        o.table_name ILIKE $${pIdx} OR
        o.receipt_number ILIKE $${pIdx} OR
        o.cashier_name ILIKE $${pIdx}
      )`)
      params.push(`%${filters.search}%`)
      pIdx++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const countRes = await pool.query(`SELECT COUNT(*) AS total FROM pos_orders o ${whereClause}`, params)
    const total = parseInt(countRes.rows[0]?.total || "0", 10)

    const limit = filters.limit ? Math.max(1, Math.min(500, filters.limit)) : 50
    const page = filters.page ? Math.max(1, filters.page) : 1
    const offset = (page - 1) * limit
    const totalPages = filters.returnAll ? 1 : Math.ceil(total / limit)

    let query = `
      SELECT
        o.*,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', oi.id,
                'product_id', oi.product_id,
                'name', oi.product_name_snapshot,
                'product_name_snapshot', oi.product_name_snapshot,
                'price', oi.unit_price_snapshot,
                'unit_price_snapshot', oi.unit_price_snapshot,
                'quantity', oi.quantity,
                'line_total', oi.line_total,
                'station', oi.station,
                'item_status', oi.item_status,
                'notes', oi.notes
              )
            )
            FROM order_items oi
            WHERE oi.order_id = o.id
          ),
          '[]'::jsonb
        ) AS items,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', st.id,
                'station', st.station,
                'status', st.status,
                'sent_at', st.sent_at,
                'ready_at', st.ready_at,
                'served_at', st.served_at
              )
            )
            FROM station_tickets st
            WHERE st.order_id = o.id
          ),
          '[]'::jsonb
        ) AS tickets
      FROM pos_orders o
      ${whereClause}
      ORDER BY o.created_at DESC
    `

    if (!filters.returnAll) {
      query += ` LIMIT $${pIdx++} OFFSET $${pIdx++}`
      params.push(limit, offset)
    }

    const res = await pool.query(query, params)
    return {
      orders: res.rows,
      total,
      totalPages,
    }
  },

  async getOrderByIdOrNumber(idOrNumber: string): Promise<any | null> {
    const pool = getPgPool()
    const isId = isUuid(idOrNumber)
    const query = `
      SELECT
        o.*,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', oi.id,
                'product_id', oi.product_id,
                'name', oi.product_name_snapshot,
                'product_name_snapshot', oi.product_name_snapshot,
                'price', oi.unit_price_snapshot,
                'unit_price_snapshot', oi.unit_price_snapshot,
                'quantity', oi.quantity,
                'line_total', oi.line_total,
                'station', oi.station,
                'item_status', oi.item_status,
                'notes', oi.notes
              )
            )
            FROM order_items oi
            WHERE oi.order_id = o.id
          ),
          '[]'::jsonb
        ) AS items,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', st.id,
                'station', st.station,
                'status', st.status,
                'sent_at', st.sent_at,
                'ready_at', st.ready_at,
                'served_at', st.served_at
              )
            )
            FROM station_tickets st
            WHERE st.order_id = o.id
          ),
          '[]'::jsonb
        ) AS tickets
      FROM pos_orders o
      WHERE ${isId ? "o.id = $1 OR o.order_number = $1" : "o.order_number = $1"}
      LIMIT 1
    `
    const res = await pool.query(query, [idOrNumber])
    return res.rows[0] || null
  },

  async updateOrder(idOrNumber: string, updates: Record<string, any>): Promise<any | null> {
    const pool = getPgPool()
    const isId = isUuid(idOrNumber)
    const setClauses: string[] = ["updated_at = now()"]
    const params: any[] = []
    let pIdx = 1

    for (const [key, val] of Object.entries(updates)) {
      if (key === "id" || key === "order_number" || key === "created_at" || key === "items" || key === "tickets") continue
      setClauses.push(`${key} = $${pIdx++}`)
      params.push(val)
    }

    params.push(idOrNumber)
    const whereCond = isId ? `id = $${pIdx} OR order_number = $${pIdx}` : `order_number = $${pIdx}`

    const query = `
      UPDATE pos_orders
      SET ${setClauses.join(", ")}
      WHERE ${whereCond}
      RETURNING *
    `
    const res = await pool.query(query, params)
    return res.rows[0] || null
  },

  // =========================================================================
  // TABLES & FLOOR MANAGEMENT
  // =========================================================================
  async getTables(): Promise<any[]> {
    const pool = getPgPool()
    const tablesRes = await pool.query("SELECT * FROM pos_tables ORDER BY name ASC")
    const tables = tablesRes.rows

    const sessionsRes = await pool.query(`
      SELECT * FROM table_sessions
      WHERE status IN ('open', 'bill_requested')
      ORDER BY seated_at DESC
    `)
    const sessions = sessionsRes.rows

    const bookingsRes = await pool.query(`
      SELECT * FROM reservations
      WHERE status IN ('pending', 'confirmed', 'arrived')
      ORDER BY reserved_for ASC
    `)
    const bookings = bookingsRes.rows

    const now = Date.now()

    return tables.map((t: any) => {
      const session = sessions.find((s: any) => s.table_id === t.id)
      const tableBookings = bookings.filter((b: any) => b.table_id === t.id)

      let heldBooking: any = null
      let nextBooking: any = null

      for (const b of tableBookings) {
        const start = new Date(b.reserved_for).getTime() - 30 * 60000
        const end = new Date(b.reserved_for).getTime() + (Number(b.duration_minutes) || 90) * 60000
        if (b.status === "arrived" || (now >= start && now <= end)) {
          if (!heldBooking) heldBooking = b
        } else if (new Date(b.reserved_for).getTime() > now && !nextBooking) {
          nextBooking = b
        }
      }

      if (!nextBooking && tableBookings.length > 0) {
        nextBooking = tableBookings.find((b: any) => new Date(b.reserved_for).getTime() > now) || null
      }

      let status = t.status
      if (session) {
        status = session.status === "bill_requested" ? "bill_requested" : "occupied"
      } else if (heldBooking) {
        status = "reserved"
      }

      const orderMatch = session?.notes?.match(/Order\s*#?([A-Za-z0-9-]+)/i)
      const sessionOrderNumber = orderMatch ? orderMatch[1] : undefined

      return {
        id: t.id,
        name: t.name,
        capacity: Number(t.capacity) || 2,
        status,
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

  async getTableSessions(openOnly = true): Promise<any[]> {
    const pool = getPgPool()
    const query = openOnly
      ? "SELECT * FROM table_sessions WHERE status IN ('open', 'bill_requested') ORDER BY seated_at DESC"
      : "SELECT * FROM table_sessions ORDER BY seated_at DESC"
    const res = await pool.query(query)
    return res.rows
  },

  async getReservations(statusFilter?: string[]): Promise<any[]> {
    const pool = getPgPool()
    let query = "SELECT r.*, t.name as table_name FROM reservations r LEFT JOIN pos_tables t ON r.table_id = t.id"
    const params: any[] = []
    if (statusFilter && statusFilter.length > 0) {
      query += " WHERE r.status = ANY($1)"
      params.push(statusFilter)
    }
    query += " ORDER BY r.reserved_for ASC"
    const res = await pool.query(query, params)
    return res.rows
  },

  async findTable(tableIdOrName: string): Promise<any | null> {
    const pool = getPgPool()
    if (!tableIdOrName) return null
    if (isUuid(tableIdOrName)) {
      const byId = await pool.query("SELECT * FROM pos_tables WHERE id = $1", [tableIdOrName])
      if (byId.rows.length > 0) return byId.rows[0]
    }
    const clean = tableIdOrName.trim()
    const byName = await pool.query("SELECT * FROM pos_tables WHERE LOWER(name) = LOWER($1)", [clean])
    if (byName.rows.length > 0) return byName.rows[0]

    // Handle "Table 4" vs "Table 04", "tbl-4" etc.
    const matchNum = clean.match(/\d+/)
    if (matchNum) {
      const num = parseInt(matchNum[0], 10)
      const padded = `Table ${num < 10 ? "0" + num : num}`
      const unpadded = `Table ${num}`
      const byAlt = await pool.query(
        "SELECT * FROM pos_tables WHERE LOWER(name) = LOWER($1) OR LOWER(name) = LOWER($2)",
        [padded, unpadded]
      )
      if (byAlt.rows.length > 0) return byAlt.rows[0]
    }
    return null
  },

  async occupyTable(tableIdOrName: string, info?: {
    orderNumber?: string
    orderTotal?: number
    guestName?: string
    department?: string
  }): Promise<{ success: boolean; session?: any; table?: any; error?: string }> {
    const pool = getPgPool()
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const table = await this.findTable(tableIdOrName)
      if (!table) {
        await client.query("ROLLBACK")
        return { success: false, error: `Table '${tableIdOrName}' not found.` }
      }

      const existingSession = (await client.query(
        "SELECT * FROM table_sessions WHERE table_id = $1 AND status IN ('open', 'bill_requested') ORDER BY seated_at DESC LIMIT 1",
        [table.id]
      )).rows[0]

      const customerName = info?.guestName?.trim() || "Dine-in Guest"
      const noteText = info?.orderNumber ? `Order #${info.orderNumber}` : "Dine-in occupied"

      let sessionId: string
      if (existingSession) {
        sessionId = existingSession.id
        await client.query(
          "UPDATE table_sessions SET customer_name = COALESCE($1, customer_name), notes = $2, status = 'open' WHERE id = $3",
          [customerName, noteText, sessionId]
        )
      } else {
        sessionId = crypto.randomUUID()
        await client.query(`
          INSERT INTO table_sessions (id, table_id, customer_name, guest_count, seated_at, status, notes)
          VALUES ($1, $2, $3, $4, now(), 'open', $5)
        `, [sessionId, table.id, customerName, table.capacity || 2, noteText])
      }

      await client.query("UPDATE pos_tables SET status = 'occupied' WHERE id = $1", [table.id])
      await client.query("COMMIT")

      const session = (await pool.query("SELECT * FROM table_sessions WHERE id = $1", [sessionId])).rows[0]
      return { success: true, session, table: { ...table, status: "occupied" } }
    } catch (err: any) {
      await client.query("ROLLBACK")
      return { success: false, error: err.message || "Failed to occupy table" }
    } finally {
      client.release()
    }
  },

  async seatWalkIn(tableIdOrName: string, guestInfo?: {
    customer_name?: string
    phone?: string
    guest_count?: number
    notes?: string
  }): Promise<{ success: boolean; session?: any; error?: string }> {
    const pool = getPgPool()
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const table = await this.findTable(tableIdOrName)
      if (!table) {
        await client.query("ROLLBACK")
        return { success: false, error: `Table '${tableIdOrName}' not found.` }
      }

      const existingSession = (await client.query(
        "SELECT * FROM table_sessions WHERE table_id = $1 AND status IN ('open', 'bill_requested') LIMIT 1",
        [table.id]
      )).rows[0]

      if (existingSession) {
        await client.query("ROLLBACK")
        return { success: false, error: `Cannot seat: Table ${table.name} is already occupied.` }
      }

      const sessionId = crypto.randomUUID()
      const guests = guestInfo?.guest_count || 2
      const customerName = guestInfo?.customer_name?.trim() || "Walk-in"

      await client.query(`
        INSERT INTO table_sessions (id, table_id, customer_name, phone, guest_count, seated_at, status, notes)
        VALUES ($1, $2, $3, $4, $5, now(), 'open', $6)
      `, [sessionId, table.id, customerName, guestInfo?.phone || null, guests, guestInfo?.notes || "Walk-in seated"])

      await client.query("UPDATE pos_tables SET status = 'occupied' WHERE id = $1", [table.id])
      await client.query("COMMIT")

      const session = (await pool.query("SELECT * FROM table_sessions WHERE id = $1", [sessionId])).rows[0]
      return { success: true, session }
    } catch (err: any) {
      await client.query("ROLLBACK")
      return { success: false, error: err.message || "Failed to seat walk-in guests" }
    } finally {
      client.release()
    }
  },

  async releaseTable(tableIdOrName: string): Promise<{ success: boolean; status?: string; error?: string }> {
    const pool = getPgPool()
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const table = await this.findTable(tableIdOrName)
      if (!table) {
        await client.query("ROLLBACK")
        return { success: false, error: `Table '${tableIdOrName}' not found.` }
      }

      await client.query(
        "UPDATE table_sessions SET status = 'closed', closed_at = now() WHERE table_id = $1 AND status IN ('open', 'bill_requested')",
        [table.id]
      )

      await client.query("UPDATE pos_tables SET status = 'available' WHERE id = $1", [table.id])
      await client.query("COMMIT")
      return { success: true, status: "available" }
    } catch (err: any) {
      await client.query("ROLLBACK")
      return { success: false, error: err.message || "Failed to release table" }
    } finally {
      client.release()
    }
  },

  async updateTableStatus(tableIdOrName: string, status: string): Promise<boolean> {
    const pool = getPgPool()
    const table = await this.findTable(tableIdOrName)
    if (!table) return false
    await pool.query("UPDATE pos_tables SET status = $1 WHERE id = $2", [status, table.id])
    return true
  },

  async checkBookingConflict(tableId: string, reservedFor: string, durationMinutes: number, excludeBookingId?: string): Promise<any | null> {
    const pool = getPgPool()
    const start = new Date(reservedFor).getTime() - 30 * 60000
    const end = new Date(reservedFor).getTime() + durationMinutes * 60000

    let query = `
      SELECT * FROM reservations
      WHERE table_id = $1 AND status IN ('pending', 'confirmed', 'arrived', 'seated')
    `
    const params: any[] = [tableId]
    if (excludeBookingId) {
      query += " AND id <> $2"
      params.push(excludeBookingId)
    }

    const res = await pool.query(query, params)
    for (const b of res.rows) {
      const bStart = new Date(b.reserved_for).getTime() - 30 * 60000
      const bEnd = new Date(b.reserved_for).getTime() + (Number(b.duration_minutes) || 90) * 60000
      if (start < bEnd && bStart < end) {
        return b
      }
    }
    return null
  },

  async createReservation(data: {
    customer_name: string
    phone: string
    party_size: number
    reserved_for: string
    duration_minutes?: number
    table_id?: string
    table_name?: string
    special_requests?: string
    source?: string
  }): Promise<{ success: boolean; reservation?: any; error?: string }> {
    const pool = getPgPool()
    try {
      const duration = Number(data.duration_minutes) || 90
      const partySize = Number(data.party_size) || 2
      const startMs = new Date(data.reserved_for).getTime()
      if (Number.isNaN(startMs)) {
        return { success: false, error: "Invalid reservation time." }
      }

      let table: any = null
      if (data.table_id || data.table_name) {
        table = await this.findTable(data.table_id || data.table_name || "")
      }

      if (!table && data.table_id) {
        return { success: false, error: `Table '${data.table_id}' not found.` }
      }

      if (!table) {
        const candidates = (await pool.query(
          "SELECT * FROM pos_tables WHERE capacity >= $1 ORDER BY capacity ASC, name ASC",
          [partySize]
        )).rows

        for (const cand of candidates) {
          const clash = await this.checkBookingConflict(cand.id, data.reserved_for, duration)
          if (!clash) {
            table = cand
            break
          }
        }

        if (!table) {
          return { success: false, error: "No free table available for that party size and time." }
        }
      }

      if (table.capacity < partySize) {
        return { success: false, error: `${table.name} seats ${table.capacity} guests (party is ${partySize}).` }
      }

      const conflict = await this.checkBookingConflict(table.id, data.reserved_for, duration)
      if (conflict) {
        return { success: false, error: `${table.name} is already booked around that time by ${conflict.customer_name}.` }
      }

      const id = crypto.randomUUID()
      const insertRes = await pool.query(`
        INSERT INTO reservations (
          id, customer_name, phone, party_size, reserved_for, duration_minutes,
          table_id, status, special_requests, source, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', $8, $9, now(), now())
        RETURNING *
      `, [
        id,
        data.customer_name.trim(),
        data.phone.trim(),
        partySize,
        data.reserved_for,
        duration,
        table.id,
        data.special_requests || "",
        data.source || "staff",
      ])

      return { success: true, reservation: { ...insertRes.rows[0], table_name: table.name } }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to create reservation" }
    }
  },

  async updateReservation(id: string, updates: {
    customer_name?: string
    phone?: string
    party_size?: number
    reserved_for?: string
    duration_minutes?: number
    table_id?: string
    table_name?: string
    status?: string
    special_requests?: string
  }): Promise<{ success: boolean; reservation?: any; error?: string }> {
    const pool = getPgPool()
    try {
      const existing = (await pool.query("SELECT * FROM reservations WHERE id = $1", [id])).rows[0]
      if (!existing) return { success: false, error: "Reservation not found" }

      let targetTableId = existing.table_id
      if (updates.table_id || updates.table_name) {
        const found = await this.findTable(updates.table_id || updates.table_name || "")
        if (found) targetTableId = found.id
      }

      const targetTime = updates.reserved_for || existing.reserved_for
      const targetDuration = updates.duration_minutes !== undefined ? Number(updates.duration_minutes) : existing.duration_minutes

      if (targetTableId) {
        const clash = await this.checkBookingConflict(targetTableId, targetTime, targetDuration, id)
        if (clash) {
          return { success: false, error: `Table is already booked at that time by ${clash.customer_name}` }
        }
      }

      const updateRes = await pool.query(`
        UPDATE reservations
        SET customer_name = COALESCE($1, customer_name),
            phone = COALESCE($2, phone),
            party_size = COALESCE($3, party_size),
            reserved_for = COALESCE($4, reserved_for),
            duration_minutes = COALESCE($5, duration_minutes),
            table_id = $6,
            status = COALESCE($7, status),
            special_requests = COALESCE($8, special_requests),
            updated_at = now()
        WHERE id = $9
        RETURNING *
      `, [
        updates.customer_name,
        updates.phone,
        updates.party_size,
        updates.reserved_for,
        updates.duration_minutes,
        targetTableId,
        updates.status,
        updates.special_requests,
        id,
      ])

      return { success: true, reservation: updateRes.rows[0] }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update reservation" }
    }
  },

  async seatReservation(id: string, guestCount?: number): Promise<{ success: boolean; session?: any; error?: string }> {
    const pool = getPgPool()
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const res = (await client.query("SELECT * FROM reservations WHERE id = $1", [id])).rows[0]
      if (!res) {
        await client.query("ROLLBACK")
        return { success: false, error: "Reservation not found" }
      }

      if (!res.table_id) {
        await client.query("ROLLBACK")
        return { success: false, error: "Reservation does not have an assigned table." }
      }

      const table = (await client.query("SELECT * FROM pos_tables WHERE id = $1", [res.table_id])).rows[0]
      if (!table) {
        await client.query("ROLLBACK")
        return { success: false, error: "Assigned table does not exist." }
      }

      const existingSession = (await client.query(
        "SELECT * FROM table_sessions WHERE table_id = $1 AND status IN ('open', 'bill_requested') LIMIT 1",
        [table.id]
      )).rows[0]

      if (existingSession) {
        await client.query("ROLLBACK")
        return { success: false, error: `Cannot seat: Table ${table.name} is already occupied.` }
      }

      const sessionId = crypto.randomUUID()
      const guests = guestCount || res.party_size || 2

      await client.query(`
        INSERT INTO table_sessions (id, table_id, customer_name, phone, guest_count, seated_at, status, notes)
        VALUES ($1, $2, $3, $4, $5, now(), 'open', $6)
      `, [sessionId, table.id, res.customer_name, res.phone, guests, res.special_requests || "Seated from reservation"])

      await client.query("UPDATE reservations SET status = 'seated', updated_at = now() WHERE id = $1", [id])
      await client.query("UPDATE pos_tables SET status = 'occupied' WHERE id = $1", [table.id])
      await client.query("COMMIT")

      const session = (await pool.query("SELECT * FROM table_sessions WHERE id = $1", [sessionId])).rows[0]
      return { success: true, session }
    } catch (err: any) {
      await client.query("ROLLBACK")
      return { success: false, error: err.message || "Failed to seat reservation" }
    } finally {
      client.release()
    }
  },

  async cancelReservation(id: string): Promise<{ success: boolean; error?: string }> {
    const pool = getPgPool()
    try {
      const res = await pool.query("UPDATE reservations SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING *", [id])
      if (res.rows.length === 0) return { success: false, error: "Reservation not found" }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to cancel reservation" }
    }
  },

  // =========================================================================
  // PRODUCTS & CATEGORIES
  // =========================================================================
  async getProducts(filters?: {
    category?: string
    station?: string
    activeOnly?: boolean
    search?: string
  }): Promise<any[]> {
    const pool = getPgPool()
    let query = `
      SELECT
        p.id,
        p.name,
        p.price,
        p.cost,
        p.stock,
        p.category_id,
        p.image,
        p.description,
        p.temperature,
        p.dietary_tags,
        p.department_override,
        p.station,
        p.active,
        p.is_archived,
        p.sort_order,
        p.created_at,
        p.updated_at,
        c.name as category_name
      FROM pos_products p
      LEFT JOIN pos_categories c ON p.category_id = c.id
      WHERE p.is_archived = false
    `
    const params: any[] = []
    let pIdx = 1

    if (filters?.activeOnly) {
      query += ` AND p.active = true`
    }
    if (filters?.station && filters.station !== "all") {
      query += ` AND p.station = $${pIdx++}`
      params.push(filters.station)
    }

    query += ` ORDER BY p.sort_order ASC, p.name ASC`
    const res = await pool.query(query, params)

    let products = res.rows.map((p: any) => ({
      id: String(p.id),
      name: p.name,
      price: Number(p.price) || 0,
      cost: Number(p.cost) || 0,
      stock: Number(p.stock) || 0,
      category: p.category_name || "General",
      category_id: p.category_id,
      image: p.image || "/placeholder.svg",
      description: p.description || "",
      temperature: p.temperature || "none",
      dietary_tags: Array.isArray(p.dietary_tags) ? p.dietary_tags : [],
      department: p.department_override || (p.station === "bar" ? "Coffee Bar" : "Juice & Food"),
      station: p.station || "kitchen",
      active: p.active !== false,
      track_stock: p.track_stock !== false,
      updated_at: p.updated_at,
    }))

    if (filters?.category && filters.category !== "All") {
      products = products.filter((p) => p.category.toLowerCase() === filters.category!.toLowerCase())
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase()
      products = products.filter((p) => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s))
    }

    return products
  },

  async getProductById(id: string): Promise<any | null> {
    const pool = getPgPool()
    const res = await pool.query("SELECT * FROM pos_products WHERE id = $1 AND is_archived = false", [id])
    return res.rows[0] || null
  },

  async createProduct(data: any): Promise<any> {
    const pool = getPgPool()
    const id = data.id || crypto.randomUUID()
    const nowIso = new Date().toISOString()
    const res = await pool.query(`
      INSERT INTO pos_products (
        id, name, price, cost, stock, category_id, station, image,
        description, temperature, dietary_tags, department_override,
        active, track_stock, is_archived, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false, $15, $15)
      RETURNING *
    `, [
      id,
      data.name,
      data.price,
      data.cost || 0,
      data.stock || 50,
      data.category_id || null,
      data.station || "kitchen",
      data.image || "/placeholder.svg",
      data.description || "",
      data.temperature || "none",
      data.dietary_tags || [],
      data.department || (data.station === "bar" ? "Coffee Bar" : "Juice & Food"),
      data.active !== false,
      data.track_stock !== false,
      nowIso,
    ])
    return res.rows[0]
  },

  async updateProduct(id: string, updates: any): Promise<any | null> {
    const pool = getPgPool()
    const setClauses: string[] = ["updated_at = now()"]
    const params: any[] = []
    let pIdx = 1

    for (const [key, val] of Object.entries(updates)) {
      if (key === "id" || key === "created_at") continue
      const col = key === "department" ? "department_override" : key
      setClauses.push(`${col} = $${pIdx++}`)
      params.push(val)
    }

    params.push(id)
    const query = `
      UPDATE pos_products
      SET ${setClauses.join(", ")}
      WHERE id = $${pIdx}
      RETURNING *
    `
    const res = await pool.query(query, params)
    return res.rows[0] || null
  },

  async deleteProduct(id: string): Promise<any | null> {
    const pool = getPgPool()
    const res = await pool.query(`
      UPDATE pos_products
      SET is_archived = true, active = false, updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [id])
    return res.rows[0] || null
  },

  async getCategories(): Promise<any[]> {
    const pool = getPgPool()
    const res = await pool.query("SELECT * FROM pos_categories WHERE is_active = true ORDER BY sort_order ASC")
    return res.rows
  },

  // =========================================================================
  // INVENTORY & INGREDIENTS
  // =========================================================================
  async getIngredients(): Promise<any[]> {
    const pool = getPgPool()
    const res = await pool.query(`
      SELECT
        id, sku, name, category_id, dimension, base_unit, default_purchase_unit,
        current_stock_base, par_level_base, reorder_level_base, reorder_qty_base,
        is_perishable, is_active, is_archived, version, created_at, updated_at
      FROM ingredients
      WHERE is_archived = false
      ORDER BY name ASC
    `)
    return res.rows
  },

  async createIngredient(data: any): Promise<any> {
    const pool = getPgPool()
    const id = data.id || crypto.randomUUID()
    const sku = data.sku || `ING-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
    const res = await pool.query(`
      INSERT INTO ingredients (
        id, sku, name, category_id, dimension, base_unit, default_purchase_unit,
        current_stock_base, par_level_base, reorder_level_base, reorder_qty_base,
        is_perishable, is_active, is_archived, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, false, 1, now(), now())
      RETURNING *
    `, [
      id,
      sku,
      data.name,
      data.category_id || null,
      data.dimension,
      data.base_unit,
      data.default_purchase_unit,
      data.current_stock_base || 0,
      data.par_level_base || 0,
      data.reorder_level_base || 0,
      data.reorder_qty_base || 0,
      data.is_perishable !== false,
    ])
    return res.rows[0]
  },

  // =========================================================================
  // ROLES & USERS (RBAC)
  // =========================================================================
  async getRoles(): Promise<any[]> {
    const pool = getPgPool()
    const rolesRes = await pool.query("SELECT * FROM roles ORDER BY is_system DESC, name ASC")
    const rpRes = await pool.query("SELECT role_id, permission_id FROM role_permissions")
    const usersRes = await pool.query("SELECT role_id FROM app_users WHERE is_active = true")

    return rolesRes.rows.map((r: any) => {
      const perms = rpRes.rows.filter((rp: any) => rp.role_id === r.id).map((rp: any) => rp.permission_id)
      const userCount = usersRes.rows.filter((u: any) => u.role_id === r.id).length
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        is_system: Boolean(r.is_system),
        permissions: perms,
        user_count: userCount,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }
    })
  },

  async getUsers(): Promise<any[]> {
    const pool = getPgPool()
    const roles = await this.getRoles()
    const rolesMap = new Map(roles.map((r: any) => [r.id, r]))

    const usersRes = await pool.query("SELECT * FROM app_users ORDER BY created_at ASC")
    return usersRes.rows.map((u: any) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      password_hash: u.password_hash,
      role_id: u.role_id,
      role: rolesMap.get(u.role_id),
      is_active: Boolean(u.is_active),
      last_login_at: u.last_login_at,
      created_at: u.created_at,
      updated_at: u.updated_at,
    }))
  },

  async getUserByUsername(username: string): Promise<any | null> {
    const pool = getPgPool()
    const roles = await this.getRoles()
    const rolesMap = new Map(roles.map((r: any) => [r.id, r]))

    const clean = username.trim().toLowerCase()
    const res = await pool.query("SELECT * FROM app_users WHERE LOWER(username) = $1 LIMIT 1", [clean])
    const u = res.rows[0]
    if (!u) return null

    return {
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      password_hash: u.password_hash,
      role_id: u.role_id,
      role: rolesMap.get(u.role_id),
      is_active: Boolean(u.is_active),
      last_login_at: u.last_login_at,
      created_at: u.created_at,
      updated_at: u.updated_at,
    }
  },

  async authenticateUser(username: string, password: string): Promise<any | null> {
    const user = await this.getUserByUsername(username)
    if (!user || !user.is_active) return null

    if (user.password_hash && verifyPassword(password, user.password_hash)) {
      const pool = getPgPool()
      void pool.query("UPDATE app_users SET last_login_at = now() WHERE id = $1", [user.id])
      return user
    }

    // Default seed passwords fallback (accepts Welcome123, welcome123, Welcome123! or specific role defaults)
    const isWelcome = password === "Welcome123" || password === "welcome123" || password === "Welcome123!"
    if (
      (user.username === "admin" && (isWelcome || password === "admin123")) ||
      (user.username === "manager" && (isWelcome || password === "manager123")) ||
      (user.username === "cashier" && (isWelcome || password === "cashier123")) ||
      (user.username === "kitchen" && (isWelcome || password === "kitchen123")) ||
      (user.username === "staff" && (isWelcome || password === "staff123"))
    ) {
      const pool = getPgPool()
      void pool.query("UPDATE app_users SET last_login_at = now() WHERE id = $1", [user.id])
      return user
    }

    return null
  },

  async createUser(params: {
    username: string
    full_name: string
    email?: string
    password: string
    role_id: string
  }): Promise<any> {
    const pool = getPgPool()
    const username = params.username.trim().toLowerCase()
    const existing = await this.getUserByUsername(username)
    if (existing) {
      throw new Error(`Username "${username}" is already taken.`)
    }

    const id = crypto.randomUUID()
    const passwordHash = hashPassword(params.password)
    const email = params.email?.trim() || `${username}@posdemo.com`

    const res = await pool.query(`
      INSERT INTO app_users (id, username, full_name, email, password_hash, role_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, now(), now())
      RETURNING *
    `, [id, username, params.full_name.trim(), email, passwordHash, params.role_id])

    return res.rows[0]
  },
}
