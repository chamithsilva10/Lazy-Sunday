import { NextRequest, NextResponse } from "next/server"
import { authorizeStaff, createStaffSupabaseClient } from "@/lib/coffee/auth"
import { isDemoMode } from "@/lib/config/demo"
import { DemoDbService } from "@/lib/db/demo-sqlite"

export const dynamic = "force-dynamic"

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
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const paymentMethod = searchParams.get("paymentMethod")
    const station = searchParams.get("station") // "all" | "kitchen" | "bar"
    const department = searchParams.get("department") // "all" | "Juice & Food" | "Coffee Bar"
    const staffName = searchParams.get("staff")

    const supabase = createStaffSupabaseClient(request)

    let orders: any[] = []

    if (isDemoMode() || !supabase) {
      orders = DemoDbService.getOrders({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        paymentMethod: paymentMethod || undefined,
      })
    } else {
      let query = supabase
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
          )
        `)
        .order("created_at", { ascending: false })

      // Timezone-correct date filters (inclusive start-of-day to end-of-day)
      if (startDate) {
        const startIso = new Date(`${startDate}T00:00:00.000Z`).toISOString()
        query = query.gte("created_at", startIso)
      }
      if (endDate) {
        const endIso = new Date(`${endDate}T23:59:59.999Z`).toISOString()
        query = query.lte("created_at", endIso)
      }

      if (paymentMethod && paymentMethod !== "all") {
        query = query.eq("payment_method", paymentMethod)
      }

      if (department && department !== "all") {
        query = query.eq("department", department)
      }

      const { data, error } = await query
      if (error) throw error
      orders = data || []
    }

    // Process items for each order
    const processedOrders = orders.map((o: any) => {
      const items = Array.isArray(o.order_items) && o.order_items.length > 0
        ? o.order_items.map((i: any) => ({
            id: i.product_id || i.id,
            name: i.product_name_snapshot,
            price: Number(i.unit_price_snapshot) || 0,
            quantity: Number(i.quantity) || 1,
            line_total: Number(i.line_total) || (Number(i.unit_price_snapshot) * Number(i.quantity)),
            station: i.station || "kitchen",
            category: i.station === "bar" ? "Coffee & Bar" : "Kitchen Menu",
          }))
        : Array.isArray(o.items)
        ? o.items.map((i: any) => {
            let itemStation = i.station
            if (!itemStation) {
              itemStation =
                /\b(bar|coffee|tea|juice|smoothie)\b/i.test(i.category || "") ||
                /\b(coffee|latte|tea|juice|cooler)\b/i.test(i.name)
                  ? "bar"
                  : "kitchen"
            }
            return {
              id: i.id,
              name: i.name,
              price: Number(i.price) || 0,
              quantity: Number(i.quantity) || 1,
              line_total: (Number(i.price) || 0) * (Number(i.quantity) || 1),
              station: itemStation,
              category: i.category || (itemStation === "bar" ? "Coffee & Bar" : "Kitchen Menu"),
            }
          })
        : []

      return {
        ...o,
        items,
        subtotal: Number(o.subtotal) || 0,
        service_charge: Number(o.service_charge) || 0,
        discount: Number(o.discount) || 0,
        tax: Number(o.tax) || 0,
        total: Number(o.total) || 0,
      }
    })

    // Separate voids/refunds from positive sales
    const validOrders = processedOrders.filter(
      (o: any) => o.status !== "refunded" && o.status !== "cancelled" && !o.is_void
    )
    const voidOrders = processedOrders.filter((o: any) => o.is_void || o.status === "cancelled")
    const refundOrders = processedOrders.filter((o: any) => o.status === "refunded")

    // Filter by station if specified
    const stationFilteredOrders = station && station !== "all"
      ? validOrders.filter((o: any) => o.items.some((i: any) => i.station === station))
      : validOrders

    // Aggregations
    let totalSales = 0
    let totalItemsSold = 0
    let totalServiceCharge = 0
    let totalTax = 0
    let totalDiscount = 0
    let cashSales = 0
    let cardSales = 0
    let qrSales = 0

    let kitchenRevenue = 0
    let kitchenItemsSold = 0
    let barRevenue = 0
    let barItemsSold = 0

    const productMap = new Map<string, { category: string; station: string; qty: number; revenue: number }>()
    const categoryMap = new Map<string, { itemCount: number; revenue: number }>()
    const dailyMap = new Map<string, { billCount: number; revenue: number; serviceCharge: number }>()
    const hourlyMap = new Map<string, { billCount: number; revenue: number }>()
    const staffMap = new Map<string, { billCount: number; revenue: number }>()

    for (const order of stationFilteredOrders) {
      totalSales += order.total
      totalServiceCharge += order.service_charge
      totalTax += order.tax
      totalDiscount += order.discount

      let splitList = Array.isArray(order.split_payments) && order.split_payments.length > 0 ? order.split_payments : null
      if (!splitList && typeof order.notes === "string" && order.notes.includes("split_payments")) {
        try {
          const parsed = JSON.parse(order.notes)
          if (Array.isArray(parsed.split_payments)) splitList = parsed.split_payments
        } catch {}
      }

      if (splitList && splitList.length > 0) {
        for (const sp of splitList) {
          const m = String(sp.method || "").toLowerCase()
          const amt = Number(sp.amount) || 0
          if (m === "cash") cashSales += amt
          else if (m === "card") cardSales += amt
          else qrSales += amt
        }
      } else {
        if (order.payment_method === "cash") cashSales += order.total
        else if (order.payment_method === "card") cardSales += order.total
        else qrSales += order.total
      }

      // Daily Breakdown
      const dateKey = new Date(order.created_at).toISOString().split("T")[0]
      const currentDay = dailyMap.get(dateKey) || { billCount: 0, revenue: 0, serviceCharge: 0 }
      dailyMap.set(dateKey, {
        billCount: currentDay.billCount + 1,
        revenue: currentDay.revenue + order.total,
        serviceCharge: currentDay.serviceCharge + order.service_charge,
      })

      // Hourly Breakdown
      const hourKey = `${new Date(order.created_at).getHours().toString().padStart(2, "0")}:00`
      const currentHour = hourlyMap.get(hourKey) || { billCount: 0, revenue: 0 }
      hourlyMap.set(hourKey, {
        billCount: currentHour.billCount + 1,
        revenue: currentHour.revenue + order.total,
      })

      // Staff Breakdown
      const staff = order.cashier_name || "Staff"
      const currentStaff = staffMap.get(staff) || { billCount: 0, revenue: 0 }
      staffMap.set(staff, {
        billCount: currentStaff.billCount + 1,
        revenue: currentStaff.revenue + order.total,
      })

      // Items breakdown
      for (const item of order.items) {
        // If station filter active, only count items of that station
        if (station && station !== "all" && item.station !== station) {
          continue
        }

        totalItemsSold += item.quantity

        if (item.station === "kitchen") {
          kitchenRevenue += item.line_total
          kitchenItemsSold += item.quantity
        } else {
          barRevenue += item.line_total
          barItemsSold += item.quantity
        }

        const prodName = item.name
        const existing = productMap.get(prodName) || {
          category: item.category || "General",
          station: item.station || "kitchen",
          qty: 0,
          revenue: 0,
        }
        productMap.set(prodName, {
          category: existing.category,
          station: existing.station,
          qty: existing.qty + item.quantity,
          revenue: existing.revenue + item.line_total,
        })

        const cat = item.category || "General"
        const existingCat = categoryMap.get(cat) || { itemCount: 0, revenue: 0 }
        categoryMap.set(cat, {
          itemCount: existingCat.itemCount + item.quantity,
          revenue: existingCat.revenue + item.line_total,
        })
      }
    }

    const productSales = Array.from(productMap.entries())
      .map(([name, stat]) => ({
        productName: name,
        category: stat.category,
        station: stat.station,
        quantitySold: stat.qty,
        totalRevenue: stat.revenue,
        percentageOfSales: totalSales > 0 ? Math.round((stat.revenue / totalSales) * 100) : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)

    const categorySales = Array.from(categoryMap.entries())
      .map(([cat, stat]) => ({
        category: cat,
        itemCount: stat.itemCount,
        totalRevenue: stat.revenue,
        percentageOfSales: totalSales > 0 ? Math.round((stat.revenue / totalSales) * 100) : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)

    const dailySummaries = Array.from(dailyMap.entries())
      .map(([date, stat]) => ({
        date,
        billCount: stat.billCount,
        totalRevenue: stat.revenue,
        totalServiceCharge: stat.serviceCharge,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const hourlySummaries = Array.from(hourlyMap.entries())
      .map(([hour, stat]) => ({
        hour,
        billCount: stat.billCount,
        totalRevenue: stat.revenue,
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour))

    const staffSummaries = Array.from(staffMap.entries())
      .map(([staff, stat]) => ({
        staff,
        billCount: stat.billCount,
        totalRevenue: stat.revenue,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)

    return NextResponse.json({
      success: true,
      report: {
        totalSales,
        billCount: stationFilteredOrders.length,
        totalItemsSold,
        averageBillValue: stationFilteredOrders.length > 0 ? Math.round(totalSales / stationFilteredOrders.length) : 0,
        totalServiceCharge,
        totalTax,
        totalDiscount,
        netSales: totalSales - totalServiceCharge - totalTax,
        paymentBreakdown: {
          cashSales,
          cardSales,
          qrSales,
        },
        stationBreakdown: {
          kitchenRevenue,
          kitchenItemsSold,
          barRevenue,
          barItemsSold,
        },
        productSales,
        categorySales,
        dailySummaries,
        hourlySummaries,
        staffSummaries,
        voidsAndRefunds: {
          voidCount: voidOrders.length,
          voidTotal: voidOrders.reduce((sum: number, o: any) => sum + o.total, 0),
          refundCount: refundOrders.length,
          refundTotal: refundOrders.reduce((sum: number, o: any) => sum + o.total, 0),
        },
        filteredOrders: stationFilteredOrders,
      },
    })
  } catch (error: any) {
    console.error("GET /api/reports failed", error)
    return NextResponse.json({ success: false, error: "Unable to generate report." }, { status: 500 })
  }
}
