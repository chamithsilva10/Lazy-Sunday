import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeStaff, createStaffSupabaseClient, hasValidOrigin } from "@/lib/coffee/auth"

export const dynamic = "force-dynamic"

const productUpdateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  price: z.coerce.number().finite().min(0).max(1000000).optional(),
  cost: z.coerce.number().finite().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  category_id: z.string().uuid().nullable().optional(),
  station: z.enum(["kitchen", "bar", "none"]).optional(),
  image: z.string().trim().max(2048).optional(),
  description: z.string().trim().max(1000).optional(),
  temperature: z.enum(["hot", "iced", "none"]).optional(),
  dietary_tags: z.array(z.string()).optional(),
  department: z.string().trim().max(80).optional(),
  active: z.boolean().optional(),
  track_stock: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, "No update fields provided")

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createStaffSupabaseClient(request)

    if (supabase) {
      const { data, error } = await supabase
        .from("pos_products")
        .select("*")
        .eq("id", id)
        .maybeSingle()

      if (error) throw error
      if (!data) return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 })

      return NextResponse.json({ success: true, product: data })
    }

    return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 })
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
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
  }

  const auth = await authorizeStaff(request, "admin")
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

    const supabase = createStaffSupabaseClient(request)
    const updateData: Record<string, any> = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    }

    if (parsed.data.department) {
      updateData.department_override = parsed.data.department
      delete updateData.department
    }

    if (supabase) {
      const { data, error } = await supabase
        .from("pos_products")
        .update(updateData)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      if (!data) return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 })

      return NextResponse.json({ success: true, product: data })
    }

    return NextResponse.json({
      success: true,
      product: { id, ...updateData },
    })
  } catch (error: any) {
    console.error("PUT/PATCH /api/products/[id] failed", error)
    return NextResponse.json({ success: false, error: "Unable to update product." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 })
  }

  const auth = await authorizeStaff(request, "admin")
  if (auth.status !== 200 || !auth.identity) {
    return NextResponse.json(
      { success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status }
    )
  }

  try {
    const { id } = await params
    const supabase = createStaffSupabaseClient(request)

    if (supabase) {
      // Soft-delete to preserve foreign keys on order_items
      const { data, error } = await supabase
        .from("pos_products")
        .update({
          is_archived: true,
          active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, message: "Product archived successfully", product: data })
    }

    return NextResponse.json({ success: true, message: "Product archived locally" })
  } catch (error: any) {
    console.error("DELETE /api/products/[id] failed", error)
    return NextResponse.json({ success: false, error: "Unable to delete product." }, { status: 500 })
  }
}
