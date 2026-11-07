import { NextResponse } from "next/server"
import { DemoDbService } from "@/lib/db/demo-sqlite"
import { MOCK_TABLES } from "@/lib/mock/pos-mock-data"

export async function GET() {
  try {
    const tables = DemoDbService.getTables()
    return NextResponse.json({
      success: true,
      tables: tables && tables.length > 0 ? tables : MOCK_TABLES,
    })
  } catch (error) {
    return NextResponse.json({ success: true, tables: MOCK_TABLES })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tableId, tableName, status } = body

    if (!status) {
      return NextResponse.json({ success: false, error: "Status is required" }, { status: 400 })
    }

    const targetId = tableId || tableName
    if (!targetId) {
      return NextResponse.json({ success: false, error: "Table identifier is required" }, { status: 400 })
    }

    const updated = DemoDbService.updateTableStatus(targetId, status)
    return NextResponse.json({ success: true, updated, status })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
