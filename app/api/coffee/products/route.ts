import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { CoffeeStorageService } from "@/lib/coffee/storage"
import { authorizeStaff, createStaffSupabaseClient, hasValidOrigin } from "@/lib/coffee/auth"
import { writeSecurityAudit } from "@/lib/coffee/security"

const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80).optional(),
  size: z.string().trim().max(40).optional(),
  price: z.number().finite().min(0).max(1000000),
  image_url: z.string().trim().max(2048).optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).strict()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") === "true"

    const supabase = createStaffSupabaseClient(request)
    const products = activeOnly
      ? await CoffeeStorageService.getActiveProducts(supabase)
      : await CoffeeStorageService.getProducts(supabase)

    return NextResponse.json({ success: true, products })
  } catch {
    return NextResponse.json({ success: true, products: [] })
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
  // Enforce Admin role on backend (403 for non-admins)
  const auth = await authorizeStaff(request, "admin")
  if (auth.status !== 200 || !auth.identity) {
    return NextResponse.json({ success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." }, { status: auth.status })
  }

  try {
    const parsed = productSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid product data." }, { status: 400 })
    const { name, category, size, price, image_url, status } = parsed.data

    const created = await CoffeeStorageService.addProduct({
      name: name.trim(),
      category: category?.trim() || "Espresso",
      size: size?.trim() || "Regular",
      price: Number(price),
      image_url: image_url?.trim() || "/latte-coffee.png",
      status: status === "inactive" ? "inactive" : "active",
    }, createStaffSupabaseClient(request))

    await writeSecurityAudit(request, "product_created", auth.identity.userId, created.id)
    return NextResponse.json({ success: true, product: created }, { status: 201 })
  } catch (error: any) {
    console.error("Coffee product create failed", error)
    return NextResponse.json({ success: false, error: "Unable to create product." }, { status: 500 })
  }
}
