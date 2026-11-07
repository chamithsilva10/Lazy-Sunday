import { NextResponse } from "next/server"
import { DemoDbService } from "@/lib/db/demo-sqlite"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const statusParam = searchParams.get("status")
    const statusFilter = statusParam ? statusParam.split(",") : undefined
    const reservations = DemoDbService.getReservations(statusFilter)
    return NextResponse.json({ success: true, reservations })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action = "create", id } = body

    if (action === "create") {
      const res = DemoDbService.createReservation({
        customer_name: body.customer_name,
        phone: body.phone,
        party_size: Number(body.party_size) || 2,
        reserved_for: body.reserved_for,
        duration_minutes: Number(body.duration_minutes) || 90,
        table_id: body.table_id,
        table_name: body.table_name,
        special_requests: body.special_requests || "",
        source: body.source || "staff",
      })

      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 409 })
      }
      return NextResponse.json({ success: true, reservation: res.reservation })
    }

    if (action === "update" || action === "reschedule") {
      if (!id) {
        return NextResponse.json({ success: false, error: "Reservation ID is required" }, { status: 400 })
      }

      const res = DemoDbService.updateReservation(id, {
        customer_name: body.customer_name,
        phone: body.phone,
        party_size: body.party_size !== undefined ? Number(body.party_size) : undefined,
        reserved_for: body.reserved_for,
        duration_minutes: body.duration_minutes !== undefined ? Number(body.duration_minutes) : undefined,
        table_id: body.table_id,
        table_name: body.table_name,
        status: body.status,
        special_requests: body.special_requests,
      })

      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 409 })
      }
      return NextResponse.json({ success: true, reservation: res.reservation })
    }

    if (action === "seat") {
      if (!id) {
        return NextResponse.json({ success: false, error: "Reservation ID is required" }, { status: 400 })
      }
      const res = DemoDbService.seatReservation(id, body.guestCount ? Number(body.guestCount) : undefined)
      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 409 })
      }
      return NextResponse.json({ success: true, session: res.session })
    }

    if (action === "cancel") {
      if (!id) {
        return NextResponse.json({ success: false, error: "Reservation ID is required" }, { status: 400 })
      }
      const res = DemoDbService.cancelReservation(id)
      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    if (action === "status") {
      if (!id || !body.status) {
        return NextResponse.json({ success: false, error: "Reservation ID and status required" }, { status: 400 })
      }
      const res = DemoDbService.updateReservation(id, { status: body.status })
      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 })
      }
      return NextResponse.json({ success: true, reservation: res.reservation })
    }

    return NextResponse.json({ success: false, error: `Unknown action '${action}'` }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
