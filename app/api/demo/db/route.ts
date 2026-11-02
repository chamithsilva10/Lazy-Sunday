import { NextRequest, NextResponse } from "next/server"
import { DemoDbService, getDemoSqliteDb } from "@/lib/db/demo-sqlite"
import { isDemoMode } from "@/lib/config/demo"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo mode is not active." }, { status: 403 })
  }

  const db = getDemoSqliteDb()
  if (!db) {
    return NextResponse.json({ error: "SQLite database not initialized." }, { status: 500 })
  }

  try {
    const productsCount = db.prepare("SELECT count(*) as cnt FROM pos_products").get()?.cnt || 0
    const categoriesCount = db.prepare("SELECT count(*) as cnt FROM pos_categories").get()?.cnt || 0
    const tablesCount = db.prepare("SELECT count(*) as cnt FROM pos_tables").get()?.cnt || 0
    const ordersCount = db.prepare("SELECT count(*) as cnt FROM pos_orders").get()?.cnt || 0
    const customersCount = db.prepare("SELECT count(*) as cnt FROM customers").get()?.cnt || 0
    const usersCount = db.prepare("SELECT count(*) as cnt FROM app_users").get()?.cnt || 0

    return NextResponse.json({
      status: "connected",
      engine: "SQLite (node:sqlite)",
      database: "pos_demo.sqlite",
      tables: {
        pos_products: productsCount,
        pos_categories: categoriesCount,
        pos_tables: tablesCount,
        pos_orders: ordersCount,
        customers: customersCount,
        app_users: usersCount,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo mode is not active." }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    if (body.action === "reset") {
      const ok = DemoDbService.resetDatabase()
      return NextResponse.json({ success: ok, message: "Demo database reset to initial mock seed." })
    }

    if (body.query && typeof body.query === "string") {
      const result = DemoDbService.runRawQuery(body.query, body.params || [])
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
