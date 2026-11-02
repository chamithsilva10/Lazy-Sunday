import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeStaff, createStaffSupabaseClient, hasValidOrigin } from "@/lib/coffee/auth"

export const dynamic = "force-dynamic"

const ticketStatusSchema = z.object({
  station: z.enum(["kitchen", "bar"]),
  status: z.enum(["pending", "preparing", "ready", "served"]),
}).strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
  }

  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200) {
    return NextResponse.json(
      { success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status },
    )
  }

  try {
    const parsed = ticketStatusSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid ticket status." }, { status: 400 })
    }

    const { orderNumber } = await params
    if (!orderNumber || orderNumber.length > 80) {
      return NextResponse.json({ success: false, error: "Invalid order number." }, { status: 400 })
    }

    const supabase = createStaffSupabaseClient(request)
    if (!supabase) {
      return NextResponse.json({ success: true, status: parsed.data.status, offline: true })
    }

    const { station, status } = parsed.data
    const field = station === "bar" ? "bar_status" : "kitchen_status"
    const nowIso = new Date().toISOString()

    // 1. Fetch current order
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderNumber)
    let orderQuery = supabase
      .from("pos_orders")
      .select("id, order_number, kitchen_status, bar_status, status, items")
    if (isUuid) {
      orderQuery = orderQuery.or(`order_number.eq.${orderNumber},id.eq.${orderNumber}`)
    } else {
      orderQuery = orderQuery.eq("order_number", orderNumber)
    }
    const { data: existing } = await orderQuery.maybeSingle()

    if (!existing) {
      return NextResponse.json({
        success: true,
        order_number: orderNumber,
        station,
        status,
        offline: true,
      })
    }

    const nextKitchen = station === "kitchen" ? status : existing.kitchen_status
    const nextBar = station === "bar" ? status : existing.bar_status
    const allServed = (nextKitchen === "served" || !nextKitchen) && (nextBar === "served" || !nextBar)

    const updatePayload: Record<string, any> = {
      [field]: status,
      updated_at: nowIso,
    }

    if (allServed && (existing.status === "paid" || existing.status === "completed")) {
      updatePayload.status = "completed"
    }

    // Update pos_orders
    await supabase
      .from("pos_orders")
      .update(updatePayload)
      .eq("id", existing.id)

    // 2. Update station_tickets table
    const ticketTimestampField =
      status === "preparing" ? "preparing_at" : status === "ready" ? "ready_at" : status === "served" ? "served_at" : null

    const ticketUpdatePayload: Record<string, any> = {
      status,
    }
    if (ticketTimestampField) {
      ticketUpdatePayload[ticketTimestampField] = nowIso
    }

    await supabase
      .from("station_tickets")
      .update(ticketUpdatePayload)
      .eq("order_id", existing.id)
      .eq("station", station)

    // 3. Update order_items table for items of that station
    await supabase
      .from("order_items")
      .update({ item_status: status, updated_at: nowIso })
      .eq("order_id", existing.id)
      .eq("station", station)

    return NextResponse.json({
      success: true,
      order_number: existing.order_number,
      station,
      status,
      order_status: updatePayload.status || existing.status,
    })
  } catch (error: any) {
    console.warn("POS ticket status update note:", error?.message || error)
    return NextResponse.json({ success: true, offline: true, status: "pending" })
  }
}