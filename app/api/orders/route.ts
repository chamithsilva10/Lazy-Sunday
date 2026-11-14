import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeStaff, createStaffSupabaseClient, hasValidOrigin } from "@/lib/coffee/auth"
import { determineItemStation } from "@/lib/station-routing"
import { PosDatabase } from "@/lib/db/pos-database"

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
  idempotency_key: z.string().optional(),
  action: z.string().optional(),
})

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
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const status = searchParams.get("status") || undefined
    const station = searchParams.get("station") || undefined
    const orderType = searchParams.get("order_type") || undefined
    const paymentMethod = searchParams.get("payment_method") || undefined
    const search = searchParams.get("search")?.trim().toLowerCase() || undefined

    const supabase = createStaffSupabaseClient(request)

    if (supabase) {
      try {
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
              ready_at,
              served_at
            )
          `,
            { count: "exact" }
          )
          .order("created_at", { ascending: false })

        if (startDate) {
          query = query.gte("created_at", new Date(`${startDate}T00:00:00.000Z`).toISOString())
        }
        if (endDate) {
          query = query.lte("created_at", new Date(`${endDate}T23:59:59.999Z`).toISOString())
        }
        if (status && status !== "all") {
          query = query.eq("status", status)
        }
        if (paymentMethod && paymentMethod !== "all") {
          query = query.eq("payment_method", paymentMethod)
        }
        if (orderType && orderType !== "all") {
          query = query.eq("order_type", orderType)
        }
        if (search) {
          query = query.or(
            `order_number.ilike.%${search}%,table_name.ilike.%${search}%,receipt_number.ilike.%${search}%,cashier_name.ilike.%${search}%`
          )
        }

        if (!returnAll) {
          const from = (page - 1) * limit
          const to = from + limit - 1
          query = query.range(from, to)
        }

        const { data, count, error } = await query
        if (!error && data) {
          const formattedOrders = data.map((o: any) => ({
            id: o.id,
            order_number: o.order_number,
            receipt_number: o.receipt_number,
            table_name: o.table_name,
            cashier_name: o.cashier_name,
            department: o.department,
            order_type: o.order_type,
            subtotal: Number(o.subtotal) || 0,
            service_charge: Number(o.service_charge) || 0,
            service_charge_rate: Number(o.service_charge_rate) || 0,
            discount: Number(o.discount) || 0,
            tax: Number(o.tax) || 0,
            total: Number(o.total) || 0,
            payment_method: o.payment_method,
            payment_status: o.payment_status || "paid",
            cash_received: Number(o.cash_received) || 0,
            change_amount: Number(o.change_amount) || 0,
            status: o.status,
            kitchen_status: o.kitchen_status || "pending",
            bar_status: o.bar_status || "pending",
            notes: o.notes || "",
            created_at: o.created_at,
            updated_at: o.updated_at,
            items: (o.order_items || []).map((i: any) => ({
              id: i.id,
              product_id: i.product_id,
              name: i.product_name_snapshot,
              price: Number(i.unit_price_snapshot) || 0,
              quantity: Number(i.quantity) || 1,
              line_total: Number(i.line_total) || 0,
              station: i.station,
              item_status: i.item_status,
              notes: i.notes || "",
            })),
            tickets: o.station_tickets || [],
          }))

          const total = count ?? formattedOrders.length
          const totalPages = returnAll ? 1 : Math.ceil(total / limit)

          return NextResponse.json({
            success: true,
            orders: formattedOrders,
            pagination: {
              page: returnAll ? 1 : page,
              limit: returnAll ? total : limit,
              total,
              totalPages,
            },
          })
        }
      } catch (sbErr) {
        console.warn("Supabase orders query fallback to direct PG:", sbErr)
      }
    }

    // Authoritative PostgreSQL query
    const dbResult = await PosDatabase.getOrders({
      startDate,
      endDate,
      status,
      paymentMethod,
      station,
      orderType,
      search,
      page,
      limit,
      returnAll,
    })

    return NextResponse.json({
      success: true,
      orders: dbResult.orders,
      pagination: {
        page: returnAll ? 1 : page,
        limit: returnAll ? dbResult.total : limit,
        total: dbResult.total,
        totalPages: dbResult.totalPages,
      },
    })
  } catch (error: any) {
    console.error("GET /api/orders failed", error)
    return NextResponse.json({ success: false, error: "Unable to load orders." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 })
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

    const orderData = parsed.data

    // If order_number is missing, generate atomic bill sequence numbers from PostgreSQL
    if (!orderData.order_number) {
      const billNumbers = await PosDatabase.getNextBillNumbers()
      orderData.order_number = billNumbers.orderNumber
      orderData.receipt_number = billNumbers.receiptNumber
    } else if (!orderData.receipt_number) {
      orderData.receipt_number = `LS-RC-${orderData.order_number.replace(/^LS-/, "")}`
    }

    // Format items with station determination
    const formattedItems = orderData.items.map((i) => {
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

    const supabase = createStaffSupabaseClient(request)

    if (supabase) {
      try {
        const { data: atomicResult, error: rpcError } = await supabase.rpc("create_pos_order_atomic", {
          p_order: {
            id: orderData.id,
            order_number: orderData.order_number,
            receipt_number: orderData.receipt_number,
            table_name: orderData.table_name,
            cashier_name: orderData.cashier_name,
            department: orderData.department,
            order_type: orderData.order_type,
            subtotal: orderData.subtotal,
            service_charge: orderData.service_charge,
            service_charge_rate: orderData.service_charge_rate,
            discount: orderData.discount,
            tax: orderData.tax,
            total: orderData.total,
            payment_method: orderData.payment_method,
            split_payments: orderData.split_payments,
            cash_received: orderData.cash_received,
            change_amount: orderData.change_amount,
            status: orderData.status,
            notes: orderData.notes || (orderData.split_payments?.length ? JSON.stringify({ split_payments: orderData.split_payments }) : ""),
            idempotency_key: orderData.idempotency_key,
            action: orderData.action,
          },
          p_items: formattedItems,
        })

        if (rpcError) {
          console.warn("create_pos_order_atomic Supabase RPC error, fallback to PosDatabase:", rpcError)
        } else if (atomicResult) {
          return NextResponse.json({ success: true, order: atomicResult }, { status: 201 })
        }
      } catch (rpcErr: any) {
        console.warn("create_pos_order_atomic Supabase RPC error, trying direct PG:", rpcErr)
      }
    }

    // Authoritative PostgreSQL transaction execution or SQLite fallback
    const atomicResult = await PosDatabase.createOrderAtomic(
      {
        id: orderData.id,
        order_number: orderData.order_number,
        receipt_number: orderData.receipt_number,
        table_name: orderData.table_name,
        cashier_name: orderData.cashier_name,
        department: orderData.department,
        order_type: orderData.order_type,
        subtotal: orderData.subtotal,
        service_charge: orderData.service_charge,
        service_charge_rate: orderData.service_charge_rate,
        discount: orderData.discount,
        tax: orderData.tax,
        total: orderData.total,
        payment_method: orderData.payment_method,
        split_payments: orderData.split_payments,
        cash_received: orderData.cash_received,
        change_amount: orderData.change_amount,
        status: orderData.status,
        notes: orderData.notes || (orderData.split_payments?.length ? JSON.stringify({ split_payments: orderData.split_payments }) : ""),
        idempotency_key: orderData.idempotency_key,
        action: orderData.action,
      },
      formattedItems
    )

    if (atomicResult) {
      return NextResponse.json({ success: true, order: atomicResult }, { status: 201 })
    }

    // Graceful fallback
    const fallbackOrder = {
      ...orderData,
      id: orderData.id || `ord-${Date.now()}`,
      created_at: new Date().toISOString(),
      offline: true,
    }
    return NextResponse.json({ success: true, order: fallbackOrder, offline: true }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/orders failed, returning offline fallback:", error)
    return NextResponse.json({
      success: true,
      offline: true,
      order: {
        id: `ord-${Date.now()}`,
        status: "paid",
        created_at: new Date().toISOString(),
      },
    }, { status: 201 })
  }
}
