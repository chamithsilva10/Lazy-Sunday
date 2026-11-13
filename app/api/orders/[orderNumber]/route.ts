import { NextRequest, NextResponse } from "next/server"
import { authorizeStaff, createStaffSupabaseClient, hasValidOrigin } from "@/lib/coffee/auth"
import { PosDatabase } from "@/lib/db/pos-database"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200) {
    return NextResponse.json(
      { success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status }
    )
  }

  try {
    const { orderNumber } = await params
    const supabase = createStaffSupabaseClient(request)

    if (supabase) {
      try {
        let orderQuery = supabase
          .from("pos_orders")
          .select(`
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
          `)

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderNumber)
        if (isUuid) {
          orderQuery = orderQuery.or(`order_number.eq.${orderNumber},id.eq.${orderNumber}`)
        } else {
          orderQuery = orderQuery.eq("order_number", orderNumber)
        }

        const { data, error } = await orderQuery.maybeSingle()
        if (!error && data) {
          return NextResponse.json({ success: true, order: data })
        }
      } catch (sbErr) {
        console.warn("Supabase single order query warning:", sbErr)
      }
    }

    // Authoritative PostgreSQL fallback
    const order = await PosDatabase.getOrderByIdOrNumber(orderNumber)
    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      order,
      items: order.order_items || order.items || [],
      station_tickets: order.station_tickets || [],
    })
  } catch (error: any) {
    console.warn("GET /api/orders/[orderNumber] error:", error?.message || error)
    return NextResponse.json({ success: false, error: "Unable to load order." }, { status: 500 })
  }
}

// Void or update an order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 })
  }

  const auth = await authorizeStaff(request, "manager")
  if (auth.status !== 200 || !auth.identity) {
    return NextResponse.json(
      { success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status }
    )
  }

  try {
    const { orderNumber } = await params
    const body = await request.json()

    // Soft delete / void with atomic stock reversal
    if (body.action === "void") {
      let orderId = orderNumber
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderNumber)
      if (!isUuid) {
        const found = await PosDatabase.getOrderByIdOrNumber(orderNumber)
        if (found?.id) orderId = found.id
      }

      const restoreInventory = typeof body.restore_inventory === "boolean" ? body.restore_inventory : undefined
      const voided = await PosDatabase.voidOrderAtomic(orderId, body.reason || "Voided by manager", restoreInventory)
      if (!voided) {
        return NextResponse.json({ success: false, error: "Failed to void order in database." }, { status: 400 })
      }

      return NextResponse.json({ success: true, order: voided })
    }

    // General update
    const updatePayload: Record<string, any> = {}
    if (body.status) updatePayload.status = body.status
    if (body.payment_status) updatePayload.payment_status = body.payment_status
    if (body.notes) updatePayload.notes = body.notes

    const updated = await PosDatabase.updateOrder(orderNumber, updatePayload)
    if (!updated) {
      return NextResponse.json({ success: false, error: "Order not found or update failed." }, { status: 404 })
    }

    return NextResponse.json({ success: true, order: updated })
  } catch (error: any) {
    console.warn("PATCH /api/orders/[orderNumber] error:", error?.message || error)
    return NextResponse.json({ success: false, error: error.message || "Unable to update order." }, { status: 500 })
  }
}

export const POST = PATCH

