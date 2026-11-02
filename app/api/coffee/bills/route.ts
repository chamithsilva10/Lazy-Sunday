import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeStaff, createStaffSupabaseClient, hasValidOrigin } from "@/lib/coffee/auth"
import { CoffeeStorageService } from "@/lib/coffee/storage"
import { writeSecurityAudit } from "@/lib/coffee/security"

const billSchema = z.object({
  bill_number: z.string().max(40).optional(),
  table_name: z.string().trim().max(80).optional(),
  customer_name: z.string().trim().max(120).optional(),
  customer_phone: z.string().trim().max(40).optional(),
  items: z.array(z.object({
    id: z.string().max(100).optional(),
    coffee_product_id: z.string().min(1).max(100).optional(),
    item_name: z.string().max(120).optional(),
    size: z.string().max(40).optional(),
    quantity: z.coerce.number().int().min(1).max(500),
    unit_price: z.coerce.number().optional(),
    line_total: z.coerce.number().optional(),
  }).strict()).min(1).max(100),
  discount: z.coerce.number().finite().min(0).max(100000).default(0),
  tax: z.coerce.number().finite().min(0).max(100000).default(0),
  payment_method: z.enum(["cash", "card", "transfer", "qr"]).default("cash"),
  notes: z.string().trim().max(1000).optional(),
}).strict()

export async function GET(request: NextRequest) {
  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200) {
    return NextResponse.json({ success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." }, { status: auth.status })
  }
  try {
    const supabase = createStaffSupabaseClient(request)
    if (request.nextUrl.searchParams.get("forBar") === "true") {
      const { data, error } = await supabase!.rpc("get_active_coffee_bar_tickets")
      // The legacy coffee tables/functions may not exist after the unified
      // catalog migration. Keep the main POS available in that case.
      if (error) {
        console.error("Coffee bar tickets unavailable", error)
        return NextResponse.json({ success: true, bills: [] })
      }

      const ticketMap = new Map<string, any>()
      for (const row of data || []) {
        let ticket = ticketMap.get(row.id)
        if (!ticket) {
          ticket = {
            id: String(row.id),
            bill_number: String(row.bill_number),
            bill_date: row.bill_date,
            table_name: row.table_name || "Takeaway",
            bar_status: row.bar_status,
            subtotal: Number(row.subtotal) || 0,
            discount: Number(row.discount) || 0,
            tax: Number(row.tax) || 0,
            grand_total: Number(row.grand_total) || 0,
            payment_method: row.payment_method || "cash",
            created_at: row.created_at,
            items: [],
          }
          ticketMap.set(row.id, ticket)
        }
        if (row.item_id) {
          ticket.items.push({
            id: String(row.item_id),
            coffee_product_id: row.coffee_product_id,
            item_name: String(row.item_name || "Coffee item"),
            size: String(row.size || "Regular"),
            quantity: Number(row.quantity) || 0,
            unit_price: Number(row.unit_price) || 0,
            line_total: Number(row.line_total) || 0,
          })
        }
      }
      return NextResponse.json({ success: true, bills: Array.from(ticketMap.values()) })
    }

    const [bills, nextBillNumber] = await Promise.all([
      CoffeeStorageService.getBills(supabase),
      CoffeeStorageService.getNextBillNumber(supabase),
    ])
    return NextResponse.json({ success: true, bills, nextBillNumber })
  } catch {
    return NextResponse.json({ success: true, bills: [], nextBillNumber: "CB-1001" })
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200 || !auth.identity) {
    return NextResponse.json({ success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." }, { status: auth.status })
  }
  try {
    const parsed = billSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid bill data." }, { status: 400 })
    const { table_name, customer_name, customer_phone, items, discount, tax, payment_method, notes } = parsed.data
    if (discount > 0 && auth.identity.role === "cashier") {
      return NextResponse.json({ success: false, error: "Manager approval is required for discounts." }, { status: 403 })
    }

    const supabase = createStaffSupabaseClient(request)
    const products = await CoffeeStorageService.getActiveProducts(supabase)
    const productsById = new Map(products.map((product) => [product.id, product]))
    const billItems = items.map((item) => {
      const productId = item.coffee_product_id || item.id
      const product = productId ? productsById.get(productId) : undefined
      if (!product || product.status !== "active") return null
      return {
        id: product.id,
        coffee_product_id: product.id,
        item_name: product.name,
        size: product.size || "Regular",
        quantity: item.quantity,
        unit_price: product.price,
        line_total: product.price * item.quantity,
      }
    })
    if (billItems.some((item) => item === null)) {
      return NextResponse.json({ success: false, error: "One or more items are unavailable." }, { status: 400 })
    }

    const bill_number = await CoffeeStorageService.getNextBillNumber(supabase, true)
    const subtotal = billItems.reduce((sum, item) => sum + (item?.line_total || 0), 0)
    if (discount > subtotal) return NextResponse.json({ success: false, error: "Invalid bill discount." }, { status: 400 })
    const grand_total = Math.max(0, subtotal - discount + tax)

    const savedBill = await CoffeeStorageService.saveBill({
      bill_number,
      bill_date: new Date().toISOString(),
      table_name: table_name || "Takeaway",
      bar_status: "pending",
      customer_name: customer_name || "",
      customer_phone: customer_phone || "",
      items: billItems as NonNullable<(typeof billItems)[number]>[],
      subtotal,
      discount,
      tax,
      grand_total,
      payment_method,
      notes: notes || "",
      cashier_id: auth.identity.userId,
    }, supabase)

    await writeSecurityAudit(request, "bill_created", auth.identity.userId, savedBill.id, {
      total: grand_total,
      discount,
      itemCount: items.length,
    })
    return NextResponse.json({ success: true, bill: savedBill }, { status: 201 })
  } catch (error: any) {
    console.error("Coffee bill create failed", error)
    return NextResponse.json({ success: false, error: "Unable to create bill." }, { status: 500 })
  }
}
