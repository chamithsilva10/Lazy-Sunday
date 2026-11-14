import { NextResponse } from "next/server"
import { PosDatabase } from "@/lib/db/pos-database"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const tables = await PosDatabase.getTables()
    const sessions = await PosDatabase.getTableSessions()
    const reservations = await PosDatabase.getReservations(["pending", "confirmed", "arrived"])

    return NextResponse.json({
      success: true,
      tables,
      sessions,
      reservations,
    })
  } catch (error: any) {
    console.error("GET /api/tables failed:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to load tables." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, tableId, tableName, status, guestInfo, orderNumber, orderTotal, guestName, department } = body
    const targetId = tableId || tableName

    // Takeaway or Delivery orders do not occupy physical floor dining tables
    if (!targetId || targetId.toLowerCase().includes("takeaway") || targetId.toLowerCase().includes("delivery")) {
      return NextResponse.json({ success: true, status: "available", message: "Takeaway/delivery does not occupy physical tables." })
    }

    if (action === "occupy") {
      if (!targetId) {
        return NextResponse.json({ success: false, error: "Table identifier is required" }, { status: 400 })
      }
      const res = await PosDatabase.occupyTable(targetId, {
        orderNumber,
        orderTotal,
        guestName,
        department,
      })
      if (!res.success) {
        return NextResponse.json({ success: true, status: "occupied", message: res.error || "Fallback table occupation" })
      }
      return NextResponse.json({ ...res })
    }

    if (action === "seat" || action === "seat_walkin") {
      if (!targetId) {
        return NextResponse.json({ success: false, error: "Table identifier is required" }, { status: 400 })
      }
      const res = await PosDatabase.seatWalkIn(targetId, guestInfo)
      if (!res.success) {
        const isConflict = res.error?.toLowerCase().includes("already occupied")
        return NextResponse.json(
          { success: false, error: res.error || "Unable to seat table" },
          { status: isConflict ? 409 : 400 }
        )
      }
      return NextResponse.json({ ...res })
    }

    if (action === "release") {
      if (!targetId) {
        return NextResponse.json({ success: false, error: "Table identifier is required" }, { status: 400 })
      }
      const res = await PosDatabase.releaseTable(targetId)
      if (!res.success) {
        return NextResponse.json({ success: true, status: "available", message: res.error || "Fallback table release" })
      }
      return NextResponse.json({ ...res })
    }

    if (!status) {
      return NextResponse.json({ success: false, error: "Status is required" }, { status: 400 })
    }

    if (!targetId) {
      return NextResponse.json({ success: false, error: "Table identifier is required" }, { status: 400 })
    }

    const updated = await PosDatabase.updateTableStatus(targetId, status)
    return NextResponse.json({ success: true, updated, status })
  } catch (error: any) {
    console.error("POST /api/tables failed:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
