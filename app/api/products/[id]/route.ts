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
  image: z.string().trim().max(5000000).optional(),
  image_url: z.string().trim().max(5000000).optional(),
  description: z.string().trim().max(1000).optional(),
  temperature: z.enum(["hot", "iced", "cold", "none"]).optional(),
  dietary_tags: z.array(z.string()).optional(),
  department: z.string().trim().max(80).optional(),
  department_override: z.string().trim().max(80).optional(),
  active: z.boolean().optional(),
  track_stock: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, "No update fields provided")

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

    const updated = await PosDatabase.updateProduct(id, payload)
    if (!updated) {
      return NextResponse.json({ success: false, error: "Product not found or update failed." }, { status: 404 })
    }

    return NextResponse.json({ success: true, product: updated })
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
