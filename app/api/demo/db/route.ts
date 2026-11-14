import { NextRequest, NextResponse } from "next/server"
import { DemoDbService, getDemoSqliteDb } from "@/lib/db/demo-sqlite"
import { isDemoMode } from "@/lib/config/demo"
import { authorizeStaff, hasValidOrigin } from "@/lib/coffee/auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo mode is not active." }, { status: 403 })
  }

  const auth = await authorizeStaff(request, "admin")
  if (auth.status !== 200) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status }
    )
  }

  const db = getDemoSqliteDb()
  if (!db) {
    return NextResponse.json({
      status: "connected",
      engine: "In-Memory Store (SQLite unavailable)",
      database: "memory",
      tables: {
        pos_products: DemoDbService.getProducts().length,
        pos_categories: DemoDbService.getCategories().length,
        pos_tables: DemoDbService.getTables().length,
        pos_orders: DemoDbService.getOrders().length,
        customers: DemoDbService.getCustomers().length,
        roles: DemoDbService.getRoles().length,
      },
    })
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
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
  }

  const auth = await authorizeStaff(request, "admin")
  if (auth.status !== 200) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status }
    )
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
