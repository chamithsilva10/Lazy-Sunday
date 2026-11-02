import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeStaff, createStaffSupabaseClient, hasValidOrigin } from "@/lib/coffee/auth"
import { CoffeeStorageService } from "@/lib/coffee/storage"
import { writeSecurityAudit } from "@/lib/coffee/security"

const billUpdateSchema = z.object({
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
  }).strict()).min(1).max(100).optional(),
  discount: z.coerce.number().finite().min(0).max(100000).optional(),
  tax: z.coerce.number().finite().min(0).max(100000).optional(),
  payment_method: z.enum(["cash", "card", "transfer", "qr"]).optional(),
  notes: z.string().trim().max(1000).optional(),
  table_name: z.string().trim().max(80).optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200) {
    return NextResponse.json({ success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." }, { status: auth.status })
  }
  try {
    const { id } = await params
    const bill = await CoffeeStorageService.getBillById(id, createStaffSupabaseClient(request))
    if (!bill) {
      return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true, bill })
  } catch (error: any) {
    console.error("Coffee bill read failed", error)
    return NextResponse.json({ success: false, error: "Unable to load bill." }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
  const auth = await authorizeStaff(request, "manager")
  if (auth.status !== 200) {
    return NextResponse.json({ success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." }, { status: auth.status })
  }
  if (!auth.identity) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 })
  try {
    const { id } = await params
    const parsed = billUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid bill data." }, { status: 400 })
    const supabase = createStaffSupabaseClient(request)
    const existing = await CoffeeStorageService.getBillById(id, supabase)
    if (!existing) return NextResponse.json({ success: false, error: "Bill not found." }, { status: 404 })
    const { data: products, error: productsError } = await supabase!
      .from("coffee_products")
      .select("id,name,size,price,status")
    if (productsError || !products) throw productsError || new Error("Product lookup failed")

    const itemInputs = parsed.data.items || existing.items
    const productsById = new Map(products.map((product: any) => [product.id, product]))
    const items = itemInputs.map((item) => {
      const product = productsById.get(item.coffee_product_id || item.id)
      if (!product || product.status !== "active") return null
      return {
        id: product.id,
        coffee_product_id: product.id,
        item_name: product.name,
        size: product.size || "Regular",
        quantity: item.quantity,
        unit_price: Number(product.price),
        line_total: Number(product.price) * item.quantity,
      }
    })
    if (items.some((item) => item === null)) {
      return NextResponse.json({ success: false, error: "One or more items are unavailable." }, { status: 400 })
    }
    const safeItems = items as NonNullable<(typeof items)[number]>[]
    const subtotal = safeItems.reduce((sum, item) => sum + item.line_total, 0)
    const discount = parsed.data.discount ?? existing.discount
    const tax = parsed.data.tax ?? existing.tax
    if (discount > subtotal) return NextResponse.json({ success: false, error: "Invalid bill discount." }, { status: 400 })
    const update = {
      customer_name: parsed.data.customer_name ?? existing.customer_name,
      customer_phone: parsed.data.customer_phone ?? existing.customer_phone,
      items: safeItems,
      subtotal,
      discount,
      tax,
      grand_total: Math.max(0, subtotal - discount + tax),
      payment_method: parsed.data.payment_method ?? existing.payment_method,
      notes: parsed.data.notes ?? existing.notes,
    }
    const updated = await CoffeeStorageService.updateBill(id, update, supabase)
    if (!updated) {
      return NextResponse.json({ success: false, error: "Bill not found." }, { status: 404 })
    }

    await writeSecurityAudit(request, "bill_updated", auth.identity.userId, id, {
      total: update.grand_total,
      discount,
      fields: Object.keys(parsed.data),
    })
    return NextResponse.json({ success: true, bill: updated })
  } catch (error: any) {
    console.error("Coffee bill update failed", error)
    return NextResponse.json({ success: false, error: "Unable to update bill." }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200 || !auth.identity) {
    return NextResponse.json({ success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." }, { status: auth.status })
  }

  try {
    const parsed = z.object({
      bar_status: z.enum(["pending", "preparing", "ready", "served"]),
    }).strict().safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid ticket status." }, { status: 400 })

    const { id } = await params
    const supabase = createStaffSupabaseClient(request)
    const { data, error } = await supabase!.rpc("update_coffee_bar_ticket_status", {
      p_bill_id: id,
      p_status: parsed.data.bar_status,
    })
    if (error) throw error
    if (!data) return NextResponse.json({ success: false, error: "Bill not found." }, { status: 404 })

    await writeSecurityAudit(request, "bar_ticket_status_updated", auth.identity.userId, id, {
      status: parsed.data.bar_status,
    })
    return NextResponse.json({ success: true, bar_status: parsed.data.bar_status })
  } catch (error: any) {
    console.error("Coffee bar ticket update failed", error)
    return NextResponse.json({ success: false, error: "Unable to update bar ticket." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
  const auth = await authorizeStaff(request, "manager")
  if (auth.status !== 200) {
    return NextResponse.json({ success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." }, { status: auth.status })
  }
  if (!auth.identity) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 })
  try {
    const { id } = await params
    await CoffeeStorageService.deleteBill(id, createStaffSupabaseClient(request))
    await writeSecurityAudit(request, "bill_voided", auth.identity.userId, id)
    return NextResponse.json({ success: true, message: "Coffee bill deleted successfully" })
  } catch (error: any) {
    console.error("Coffee bill delete failed", error)
    return NextResponse.json({ success: false, error: "Unable to delete bill." }, { status: 500 })
  }
}
