import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { CoffeeStorageService } from "@/lib/coffee/storage"
import { authorizeStaff, createStaffSupabaseClient, hasValidOrigin } from "@/lib/coffee/auth"
import { writeSecurityAudit } from "@/lib/coffee/security"
import { PosDatabase } from "@/lib/db/pos-database"

const productUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().max(80).optional(),
  size: z.string().trim().max(40).optional(),
  price: z.number().finite().min(0).max(1000000).optional(),
  image_url: z.string().trim().max(2048).optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200 || !auth.identity) {
    return NextResponse.json({ success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." }, { status: auth.status })
  }

  try {
    const { id } = await params
    const parsed = productUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid product data." }, { status: 400 })

    const updated = await CoffeeStorageService.updateProduct(id, parsed.data, createStaffSupabaseClient(request))

    // Also sync update to central POS database
    try {
      await PosDatabase.updateProduct(id, {
        name: parsed.data.name,
        price: parsed.data.price,
        image: parsed.data.image_url,
        category_name: parsed.data.category,
      })
    } catch {}

    if (!updated) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })
    }

    await writeSecurityAudit(request, "product_updated", auth.identity.userId, id, { fields: Object.keys(parsed.data) })
    const res = NextResponse.json({ success: true, product: updated })

    // Also update pos_product_overrides cookie so serverless GET /api/products reflects updates
    try {
      const rawCookie = request.cookies.get("pos_product_overrides")?.value
      let overrides: Record<string, any> = {}
      if (rawCookie) {
        try { overrides = JSON.parse(decodeURIComponent(rawCookie)) } catch {}
      }
      const overrideData: Record<string, any> = {
        price: parsed.data.price,
        updated_at: new Date().toISOString(),
      }
      if (parsed.data.image_url && !parsed.data.image_url.startsWith("data:") && parsed.data.image_url.length < 500) {
        overrideData.image = parsed.data.image_url
      }
      overrides[id] = overrideData
      if (parsed.data.name) {
        overrides[parsed.data.name.trim().toLowerCase()] = overrideData
      }
      res.cookies.set("pos_product_overrides", encodeURIComponent(JSON.stringify(overrides)), {
        path: "/",
        maxAge: 86400 * 30,
        sameSite: "lax",
        httpOnly: false,
      })
    } catch {}

    return res
  } catch (error: any) {
    console.error("Coffee product update failed", error)
    return NextResponse.json({ success: false, error: "Unable to update product." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
  // Enforce Admin role on backend (403 for non-admins)
  const auth = await authorizeStaff(request, "admin")
  if (auth.status !== 200 || !auth.identity) {
    return NextResponse.json({ success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." }, { status: auth.status })
  }

  try {
    const { id } = await params
    await CoffeeStorageService.deleteProduct(id, createStaffSupabaseClient(request))
    await writeSecurityAudit(request, "product_deleted", auth.identity.userId, id)
    return NextResponse.json({ success: true, message: "Coffee product deleted successfully" })
  } catch (error: any) {
    console.error("Coffee product delete failed", error)
    return NextResponse.json({ success: false, error: "Unable to delete product." }, { status: 500 })
  }
}
