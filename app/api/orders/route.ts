import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeStaff, createStaffSupabaseClient, hasValidOrigin } from "@/lib/coffee/auth"
import { determineItemStation } from "@/lib/station-routing"
import { isDemoMode } from "@/lib/config/demo"
import { MOCK_HISTORICAL_ORDERS } from "@/lib/mock/pos-mock-data"
import { DemoDbService } from "@/lib/db/demo-sqlite"

export const dynamic = "force-dynamic"

const orderItemSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().optional(),
  name: z.string().min(1).max(200),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1).max(500),
  category: z.string().optional(),
  department: z.string().optional(),
  station: z.enum(["kitchen", "bar", "none"]).optional(),
  notes: z.string().max(500).optional(),
  image: z.string().optional(),
  stock: z.coerce.number().optional(),
  round: z.coerce.number().optional(),
})

const splitPaymentItemSchema = z.object({
  id: z.string().optional(),
  method: z.string(),
  amount: z.coerce.number().min(0),
  tendered: z.coerce.number().optional(),
  change_due: z.coerce.number().optional(),
  reference: z.string().optional(),
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
})

const orderCreateSchema = z.object({
  id: z.string().optional(),
  order_number: z.string().optional(),
  receipt_number: z.string().optional(),
  table_name: z.string().default("Takeaway"),
  cashier_name: z.string().default("Staff"),
  department: z.string().default("Juice & Food"),
  order_type: z.enum(["dine_in", "takeaway", "delivery", "coffee_bar"]).default("dine_in"),
  items: z.array(orderItemSchema).min(1),
  subtotal: z.coerce.number().min(0),
  service_charge: z.coerce.number().default(0),
  service_charge_rate: z.coerce.number().default(0),
  discount: z.coerce.number().default(0),
  tax: z.coerce.number().default(0),
  total: z.coerce.number().min(0),
  payment_method: z.string().default("cash"),
  split_payments: z.array(splitPaymentItemSchema).optional(),
  cash_received: z.coerce.number().optional(),
  change_amount: z.coerce.number().optional(),
  status: z.enum(["open", "paid", "completed", "refunded", "cancelled"]).default("paid"),
  notes: z.string().max(1000).optional(),
})

// In-memory fallback for offline/development mode
const memoryOrders: any[] = [...MOCK_HISTORICAL_ORDERS]

export async function GET(request: NextRequest) {
  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200) {
    return NextResponse.json(
      { success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.max(1, Math.min(500, parseInt(searchParams.get("limit") || "50", 10)))
    const returnAll = searchParams.get("all") === "true"
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")
    const station = searchParams.get("station") // "kitchen" | "bar"
    const orderType = searchParams.get("order_type")
    const paymentMethod = searchParams.get("payment_method")
    const search = searchParams.get("search")?.trim().toLowerCase()

    const supabase = createStaffSupabaseClient(request)

    if (supabase && !isDemoMode()) {
      // Build Supabase query with NO hidden default filters
      let query = supabase
        .from("pos_orders")
        .select(
          `
          *,
          order_items (
            id,
            product_id,
            product_name_snapshot,
            unit_price_snapshot,
            quantity,
            line_total,
            notes,
            station,
            item_status,
            created_at
          ),
          station_tickets (
            id,
            station,
            status,
            sent_at,
            ready_at
          )
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })

      // Date Range Filters (inclusive start of day to end of day)
      if (startDate) {
        const startIso = new Date(`${startDate}T00:00:00.000Z`).toISOString()
        query = query.gte("created_at", startIso)
      }
      if (endDate) {
        const endIso = new Date(`${endDate}T23:59:59.999Z`).toISOString()
        query = query.lte("created_at", endIso)
      }

      // Status Filter
      if (status && status !== "all") {
        if (status === "active") {
          query = query.neq("status", "open").neq("status", "completed").neq("status", "refunded").neq("status", "cancelled")
        } else {
          query = query.eq("status", status)
        }
      }

      // Order Type / Department Filter
      if (orderType && orderType !== "all") {
        query = query.eq("order_type", orderType)
      }

      // Payment Method Filter
      if (paymentMethod && paymentMethod !== "all") {
        query = query.eq("payment_method", paymentMethod)
      }

      // Search Filter
      if (search) {
        query = query.or(`order_number.ilike.%${search}%,receipt_number.ilike.%${search}%,table_name.ilike.%${search}%,cashier_name.ilike.%${search}%`)
      }

      // Server-side Pagination
      if (!returnAll) {
        const from = (page - 1) * limit
        const to = from + limit - 1
        query = query.range(from, to)
      }

      const { data, count, error } = await query

      if (error) throw error

      let orders = (data || []).map((o: any) => {
        // Map order_items back to items format for frontend backwards compatibility
        const items = Array.isArray(o.order_items) && o.order_items.length > 0
          ? o.order_items.map((i: any) => ({
              id: i.product_id || i.id,
              name: i.product_name_snapshot,
              price: Number(i.unit_price_snapshot) || 0,
              quantity: Number(i.quantity) || 1,
              category: i.station === "bar" ? "Coffee Bar" : "Kitchen",
              station: i.station,
              notes: i.notes,
              status: i.item_status,
            }))
          : Array.isArray(o.items)
          ? o.items
          : []

        return {
          ...o,
          items,
          split_payments: Array.isArray(o.split_payments)
            ? o.split_payments
            : (typeof o.notes === "string" && o.notes.includes("split_payments")
              ? (() => { try { return JSON.parse(o.notes).split_payments } catch { return undefined } })()
              : undefined),
          subtotal: Number(o.subtotal) || 0,
          service_charge: Number(o.service_charge) || 0,
          discount: Number(o.discount) || 0,
          tax: Number(o.tax) || 0,
          total: Number(o.total) || 0,
          cash_received: o.cash_received != null ? Number(o.cash_received) : undefined,
          change_amount: o.change_amount != null ? Number(o.change_amount) : undefined,
        }
      })

      // Station filter (in-memory if not already filtered)
      if (station && station !== "all") {
        orders = orders.filter((o: any) => {
          return Array.isArray(o.items) && o.items.some((i: any) => determineItemStation(i) === station)
        })
      }

      const total = count != null ? count : orders.length
      const totalPages = returnAll ? 1 : Math.ceil(total / limit)

      return NextResponse.json({
        success: true,
        orders,
        pagination: {
          page: returnAll ? 1 : page,
          limit: returnAll ? total : limit,
          total,
          totalPages,
        },
      })
    }

    // Offline / Demo SQLite fallback: query SQLite database or memoryOrders
    const sqliteOrders = DemoDbService.getOrders({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status: status || undefined,
      paymentMethod: paymentMethod || undefined,
    })
    let filtered = sqliteOrders.length > 0 ? sqliteOrders : [...memoryOrders]

    if (startDate) {
      const startT = new Date(`${startDate}T00:00:00.000Z`).getTime()
      filtered = filtered.filter((o) => new Date(o.created_at).getTime() >= startT)
    }
    if (endDate) {
      const endT = new Date(`${endDate}T23:59:59.999Z`).getTime()
      filtered = filtered.filter((o) => new Date(o.created_at).getTime() <= endT)
    }
    if (status && status !== "all") {
      filtered = filtered.filter((o) => o.status === status)
    }
    if (paymentMethod && paymentMethod !== "all") {
      filtered = filtered.filter((o) => o.payment_method === paymentMethod)
    }
    if (search) {
      filtered = filtered.filter(
        (o) =>
          String(o.order_number).toLowerCase().includes(search) ||
          String(o.table_name).toLowerCase().includes(search) ||
          String(o.receipt_number).toLowerCase().includes(search)
      )
    }

    const total = filtered.length
    const totalPages = returnAll ? 1 : Math.ceil(total / limit)
    const paged = returnAll ? filtered : filtered.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      success: true,
      orders: paged,
      pagination: {
        page: returnAll ? 1 : page,
        limit: returnAll ? total : limit,
        total,
        totalPages,
      },
    })
  } catch (error: any) {
    console.error("GET /api/orders failed", error)
    return NextResponse.json({ success: false, error: "Unable to load orders." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
  }

  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200 || !auth.identity) {
    return NextResponse.json(
      { success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status }
    )
  }

  try {
    const json = await request.json()
    const parsed = orderCreateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid order data.", details: parsed.error.format() }, { status: 400 })
    }

    const {
      id,
      order_number,
      receipt_number,
      table_name,
      cashier_name,
      department,
      order_type,
      items,
      subtotal,
      service_charge,
      service_charge_rate,
      discount,
      tax,
      total,
      payment_method,
      split_payments,
      cash_received,
      change_amount,
      status,
      notes,
    } = parsed.data

    const supabase = createStaffSupabaseClient(request)

    // Format items with station determination
    const formattedItems = items.map((i) => {
      const itemStation = i.station || determineItemStation(i)
      return {
        id: i.id || i.product_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        station: itemStation,
        category: i.category,
        notes: i.notes || "",
      }
    })

    if (supabase && !isDemoMode()) {
      // 1. Try atomic database transaction RPC
      try {
        const { data: atomicResult, error: rpcError } = await supabase.rpc("create_pos_order_atomic", {
          p_order: {
            id,
            order_number,
            receipt_number,
            table_name,
            cashier_name,
            department,
            order_type,
            subtotal,
            service_charge,
            discount,
            tax,
            total,
            payment_method,
            cash_received,
            change_amount,
            status,
            notes,
          },
          p_items: formattedItems,
        })

        if (!rpcError && atomicResult) {
          return NextResponse.json({ success: true, order: atomicResult }, { status: 201 })
        }
      } catch (rpcErr) {
        console.warn("create_pos_order_atomic RPC not available, using direct atomic transaction fallback", rpcErr)
      }

      // 2. Direct atomic insert with manual rollback fallback
      const hasKitchen = formattedItems.some((i) => i.station === "kitchen")
      const hasBar = formattedItems.some((i) => i.station === "bar")
      const orderId = id || crypto.randomUUID()
      const finalOrderNumber = order_number || `LS-${Date.now().toString().slice(-6)}`

      let newOrder: any = null
      try {
        const { data: upsertData, error: orderError } = await supabase
          .from("pos_orders")
          .upsert(
            {
              id: orderId,
              order_number: finalOrderNumber,
              receipt_number: receipt_number || `RC-${finalOrderNumber}`,
              table_name,
              cashier_name,
              department,
              order_type,
              subtotal,
              service_charge,
              discount,
              tax,
              total,
              payment_method,
              split_payments: split_payments || [],
              cash_received: cash_received || total,
              change_amount: change_amount || 0,
              status,
              payment_status: status === "open" ? "unpaid" : "paid",
              kitchen_status: hasKitchen ? "pending" : "served",
              bar_status: hasBar ? "pending" : "served",
              notes: split_payments && split_payments.length > 0
                ? JSON.stringify({ split_payments, notes: notes || "" })
                : (notes || ""),
              items: formattedItems,
              stock_deducted: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "order_number" }
          )
          .select()
          .maybeSingle()

        if (upsertData) {
          newOrder = upsertData
        } else if (orderError) {
          console.warn("Supabase pos_orders upsert warning in /api/orders:", orderError)
          // Fallback attempt without split_payments
          const fallbackPayload: any = {
            order_number: finalOrderNumber,
            receipt_number: receipt_number || `RC-${finalOrderNumber}`,
            table_name,
            cashier_name,
            department,
            order_type,
            subtotal,
            service_charge,
            discount,
            tax,
            total,
            payment_method,
            cash_received: cash_received || total,
            change_amount: change_amount || 0,
            status,
            payment_status: status === "open" ? "unpaid" : "paid",
            kitchen_status: hasKitchen ? "pending" : "served",
            bar_status: hasBar ? "pending" : "served",
            notes: split_payments && split_payments.length > 0
              ? JSON.stringify({ split_payments, notes: notes || "" })
              : (notes || ""),
            items: formattedItems,
            stock_deducted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          const { data: retryData } = await supabase
            .from("pos_orders")
            .upsert(fallbackPayload, { onConflict: "order_number" })
            .select()
            .maybeSingle()
          if (retryData) newOrder = retryData
        }
      } catch (upsertEx) {
        console.warn("Exception during pos_orders upsert in /api/orders:", upsertEx)
      }

      if (!newOrder) {
        newOrder = {
          id: orderId,
          order_number: finalOrderNumber,
          receipt_number: receipt_number || `RC-${finalOrderNumber}`,
          table_name,
          cashier_name,
          department,
          order_type,
          subtotal,
          service_charge,
          discount,
          tax,
          total,
          payment_method,
          split_payments: split_payments || [],
          cash_received: cash_received || total,
          change_amount: change_amount || 0,
          status,
          payment_status: status === "open" ? "unpaid" : "paid",
          kitchen_status: hasKitchen ? "pending" : "served",
          bar_status: hasBar ? "pending" : "served",
          notes: notes || "",
          items: formattedItems,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }

      // Insert normalized order_items
      if (newOrder.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(newOrder.id)) {
        try {
          const orderItemInserts = formattedItems.map((item) => ({
            order_id: newOrder.id,
            product_id: item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id) ? item.id : null,
            product_name_snapshot: item.name,
            unit_price_snapshot: item.price,
            quantity: item.quantity,
            station: item.station,
            notes: item.notes,
            item_status: "pending",
          }))
          await supabase.from("order_items").insert(orderItemInserts)
        } catch (e) {
          console.warn("Could not insert order_items", e)
        }

        // Create station tickets
        if (hasKitchen) {
          try {
            await supabase.from("station_tickets").upsert(
              { order_id: newOrder.id, ticket_number: `${finalOrderNumber}-K`, station: "kitchen", status: "pending" },
              { onConflict: "order_id,station" }
            )
          } catch {}
        }
        if (hasBar) {
          try {
            await supabase.from("station_tickets").upsert(
              { order_id: newOrder.id, ticket_number: `${finalOrderNumber}-B`, station: "bar", status: "pending" },
              { onConflict: "order_id,station" }
            )
          } catch {}
        }

        // Trigger inventory deduction
        try {
          void supabase.rpc("deduct_order_inventory", { p_order_id: newOrder.id })
        } catch {}
      }

      memoryOrders.unshift(newOrder)
      return NextResponse.json({ success: true, order: newOrder }, { status: 201 })
    }

    // Offline / Local save
    const localOrder = {
      id: id || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      order_number: order_number || `LS-${(memoryOrders.length + 101).toString().padStart(6, "0")}`,
      receipt_number: receipt_number || `LS-RC-${(memoryOrders.length + 101).toString().padStart(6, "0")}`,
      table_name,
      cashier_name,
      department,
      order_type,
      items: formattedItems,
      subtotal,
      service_charge,
      service_charge_rate,
      discount,
      tax,
      total,
      payment_method,
      cash_received: cash_received || total,
      change_amount: change_amount || 0,
      status,
      kitchen_status: formattedItems.some((i) => i.station === "kitchen") ? "pending" : "served",
      bar_status: formattedItems.some((i) => i.station === "bar") ? "pending" : "served",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    memoryOrders.unshift(localOrder)
    try {
      DemoDbService.createOrder(localOrder as any)
    } catch {}

    return NextResponse.json({ success: true, order: localOrder }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/orders failed", error)
    return NextResponse.json({ success: false, error: "Unable to create order.", message: error.message }, { status: 500 })
  }
}
