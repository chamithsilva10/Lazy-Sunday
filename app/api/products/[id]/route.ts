import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeStaff, hasValidOrigin } from "@/lib/coffee/auth"
import { PosDatabase } from "@/lib/db/pos-database"

export const dynamic = "force-dynamic"

const productUpdateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  price: z.coerce.number().finite().min(0).max(1000000).optional(),
  cost: z.coerce.number().finite().min(0).optional(),
  cost_price: z.coerce.number().finite().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  category_id: z.string().nullable().optional(),
  category: z.string().trim().max(120).optional(),
  category_name: z.string().trim().max(120).optional(),
  station: z.enum(["kitchen", "bar", "none"]).optional(),
  image: z.string().trim().max(10000000).optional(),
  image_url: z.string().trim().max(10000000).optional(),
  description: z.string().trim().max(1000).optional(),
  temperature: z.enum(["hot", "iced", "cold", "none"]).optional(),
  dietary_tags: z.array(z.string()).optional(),
  department: z.string().trim().max(80).optional(),
  department_override: z.string().trim().max(80).optional(),
  active: z.boolean().optional(),
  is_active: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  track_stock: z.boolean().optional(),
}).passthrough().refine((data) => Object.keys(data).length > 0, "No update fields provided")

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await PosDatabase.getProductById(id)

    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 })
    }

    return NextResponse.json({ success: true, product })
  } catch (error: any) {
    console.error("GET /api/products/[id] failed", error)
    return NextResponse.json({ success: false, error: "Unable to load product." }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleProductUpdate(request, params)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleProductUpdate(request, params)
}

async function handleProductUpdate(
  request: NextRequest,
  paramsPromise: Promise<{ id: string }>
) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 })
  }

  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200 || !auth.identity) {
    return NextResponse.json(
      { success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status }
    )
  }

  try {
    const { id } = await paramsPromise
    const json = await request.json()
    const parsed = productUpdateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid product update data.", details: parsed.error.format() }, { status: 400 })
    }

    const payload = {
      ...parsed.data,
      image: parsed.data.image || parsed.data.image_url,
      cost: parsed.data.cost ?? parsed.data.cost_price,
      cost_price: parsed.data.cost_price ?? parsed.data.cost,
      category_name: parsed.data.category_name || parsed.data.category,
      department: parsed.data.department || parsed.data.department_override,
    }

    const existingBefore = await PosDatabase.getProductById(id)
    const fallbackStock = existingBefore?.stock ?? 0
    const updated = await PosDatabase.updateProduct(id, payload)
    const resultProduct = updated || {
      id,
      name: payload.name || existingBefore?.name || id,
      price: payload.price ?? existingBefore?.price ?? 0,
      image: payload.image || payload.image_url || existingBefore?.image || "/placeholder.svg",
      stock: payload.stock !== undefined ? Number(payload.stock) : fallbackStock,
      category: payload.category || payload.category_name || existingBefore?.category || "General",
      category_name: payload.category_name || payload.category || existingBefore?.category_name || "General",
      category_id: payload.category_id || existingBefore?.category_id || null,
      station: payload.station || existingBefore?.station || "bar",
      department: payload.department || existingBefore?.department || "Coffee Bar",
      active: payload.active !== false && payload.is_active !== false,
      is_archived: payload.is_archived === true,
      updated_at: new Date().toISOString(),
    }
    const res = NextResponse.json({ success: true, product: resultProduct })

    // Also update pos_product_overrides cookie so serverless GET /api/products across containers reflects updates
    try {
      const rawCookie = request.cookies.get("pos_product_overrides")?.value
      let overrides: Record<string, any> = {}
      if (rawCookie) {
        try { overrides = JSON.parse(decodeURIComponent(rawCookie)) } catch {}
      }
      const overrideData: Record<string, any> = {
        price: Number(resultProduct.price),
        stock: Number(resultProduct.stock),
        updated_at: resultProduct.updated_at || new Date().toISOString(),
      }
      if (resultProduct.image && !resultProduct.image.startsWith("data:") && resultProduct.image.length < 500) {
        overrideData.image = resultProduct.image
      }
      overrides[id] = overrideData
      if (resultProduct.name) {
        overrides[resultProduct.name.trim().toLowerCase()] = overrideData
      }

      let cookieStr = JSON.stringify(overrides)
      if (cookieStr.length > 3500) {
        const keys = Object.keys(overrides)
        if (keys.length > 20) {
          const pruned: Record<string, any> = {}
          keys.slice(-20).forEach((k) => { pruned[k] = overrides[k] })
          overrides = pruned
          cookieStr = JSON.stringify(overrides)
        }
      }

      res.cookies.set("pos_product_overrides", encodeURIComponent(cookieStr), {
        path: "/",
        maxAge: 86400 * 30,
        sameSite: "lax",
        httpOnly: false,
      })
    } catch {}

    return res
  } catch (error: any) {
    console.error("PUT/PATCH /api/products/[id] failed", error)
    return NextResponse.json({ success: false, error: error.message || "Unable to update product." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 })
  }

  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200 || !auth.identity) {
    return NextResponse.json(
      { success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status }
    )
  }

  try {
    const { id } = await params
    const deleted = await PosDatabase.deleteProduct(id)

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Product archived successfully", product: deleted })
  } catch (error: any) {
    console.error("DELETE /api/products/[id] failed", error)
    return NextResponse.json({ success: false, error: error.message || "Unable to delete product." }, { status: 500 })
  }
}
