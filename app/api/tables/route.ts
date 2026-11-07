import { NextResponse } from "next/server"
import { DemoDbService } from "@/lib/db/demo-sqlite"
import { MOCK_TABLES } from "@/lib/mock/pos-mock-data"

export async function GET() {
  try {
    const tables = DemoDbService.getTables()
    const sessions = DemoDbService.getTableSessions()
    const reservations = DemoDbService.getReservations(["pending", "confirmed", "arrived"])
    return NextResponse.json({
      success: true,
      tables: tables && tables.length > 0 ? tables : MOCK_TABLES,
      sessions,
      reservations,
    })
  } catch (error) {
    return NextResponse.json({ success: true, tables: MOCK_TABLES })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, tableId, tableName, status, guestInfo, orderNumber, orderTotal, guestName, department } = body
    const targetId = tableId || tableName

    if (action === "occupy") {
      if (!targetId) {
        return NextResponse.json({ success: false, error: "Table identifier is required" }, { status: 400 })
      }
      const res = DemoDbService.occupyTable(targetId, {
        orderNumber,
        orderTotal,
        guestName,
        department,
      })
      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 })
      }
      return NextResponse.json({ ...res })
    }

    if (action === "seat" || action === "seat_walkin") {
      if (!targetId) {
        return NextResponse.json({ success: false, error: "Table identifier is required" }, { status: 400 })
      }
      const res = DemoDbService.seatWalkIn(targetId, guestInfo)
      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 409 })
      }
      return NextResponse.json({ ...res })
    }

    if (action === "release") {
      if (!targetId) {
        return NextResponse.json({ success: false, error: "Table identifier is required" }, { status: 400 })
      }
      const res = DemoDbService.releaseTable(targetId)
      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 })
      }
      return NextResponse.json({ ...res })
    }

    if (!status) {
      return NextResponse.json({ success: false, error: "Status is required" }, { status: 400 })
    }

    if (!targetId) {
      return NextResponse.json({ success: false, error: "Table identifier is required" }, { status: 400 })
    }

    const updated = DemoDbService.updateTableStatus(targetId, status)
    if (status === "available") {
      DemoDbService.recalculateTableStatus(targetId)
    }
    return NextResponse.json({ success: true, updated, status })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
