import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeStaff, createStaffSupabaseClient, hasValidOrigin } from "@/lib/coffee/auth"

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

      if (error) throw error
      if (!data) return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 })

      return NextResponse.json({ success: true, order: data })
    }

    return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 })
  } catch (error: any) {
    console.warn("GET /api/orders/[orderNumber] note:", error?.message || error)
    return NextResponse.json({ success: false, error: "Unable to load order." }, { status: 500 })
  }
}

// Void or update an order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
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
    const supabase = createStaffSupabaseClient(request)

    if (!supabase) {
      return NextResponse.json({ success: true, message: "Order updated locally" })
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderNumber)

    // Soft delete / void
    if (body.action === "void") {
      let voidQuery = supabase
        .from("pos_orders")
        .update({
          status: "cancelled",
          payment_status: "void",
          is_void: true,
          void_reason: body.reason || "Voided by manager",
          updated_at: new Date().toISOString(),
        })

      voidQuery = isUuid
        ? voidQuery.or(`order_number.eq.${orderNumber},id.eq.${orderNumber}`)
        : voidQuery.eq("order_number", orderNumber)

      const { data, error } = await voidQuery.select().maybeSingle()

      if (error) throw error
      return NextResponse.json({ success: true, order: data })
    }

    // General update
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (body.status) updatePayload.status = body.status
    if (body.payment_status) updatePayload.payment_status = body.payment_status
    if (body.notes) updatePayload.notes = body.notes

    let updateQuery = supabase
      .from("pos_orders")
      .update(updatePayload)

    updateQuery = isUuid
      ? updateQuery.or(`order_number.eq.${orderNumber},id.eq.${orderNumber}`)
      : updateQuery.eq("order_number", orderNumber)

    const { data, error } = await updateQuery.select().maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, order: data })
  } catch (error: any) {
    console.warn("PATCH /api/orders/[orderNumber] note:", error?.message || error)
    return NextResponse.json({ success: false, error: "Unable to update order." }, { status: 500 })
  }
}
