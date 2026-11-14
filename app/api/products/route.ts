import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeStaff, hasValidOrigin } from "@/lib/coffee/auth"
import { determineItemStation } from "@/lib/station-routing"
import { PosDatabase } from "@/lib/db/pos-database"

export const dynamic = "force-dynamic"

const productCreateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  price: z.coerce.number().finite().min(0).max(1000000),
  cost: z.coerce.number().finite().min(0).default(0),
  cost_price: z.coerce.number().finite().min(0).optional(),
  stock: z.coerce.number().int().min(0).default(50),
  category_id: z.string().nullable().optional(),
  category: z.string().trim().max(120).optional(),
  category_name: z.string().trim().max(120).optional(),
  station: z.enum(["kitchen", "bar", "none"]).optional(),
  image: z.string().trim().max(10000000).optional(),
  image_url: z.string().trim().max(10000000).optional(),
  description: z.string().trim().max(1000).optional(),
  temperature: z.enum(["hot", "iced", "cold", "none"]).default("none"),
  dietary_tags: z.array(z.string()).default([]),
  department: z.string().trim().max(80).optional(),
  department_override: z.string().trim().max(80).optional(),
  active: z.boolean().default(true),
  is_active: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  track_stock: z.boolean().default(true),
}).passthrough()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") || undefined
    const station = searchParams.get("station") || undefined
    const activeOnly = searchParams.get("activeOnly") === "true"
    const search = searchParams.get("search")?.trim().toLowerCase() || undefined

    let products = await PosDatabase.getProducts({
      category,
      station,
      activeOnly,
      search,
    })

    // Check pos_product_overrides cookie (for serverless environments where SQLite in /tmp is container-local)
    const rawCookie = request.cookies.get("pos_product_overrides")?.value
    if (rawCookie) {
      try {
        const overrides = JSON.parse(decodeURIComponent(rawCookie))
        if (overrides && typeof overrides === "object") {
          products = products.map((p: any) => {
            const o = overrides[p.id] || overrides[p.name] || overrides[(p.name || "").trim().toLowerCase()]
            if (o) {
              return {
                ...p,
                price: o.price !== undefined ? Number(o.price) : p.price,
                stock: o.stock !== undefined ? Number(o.stock) : p.stock,
                image: o.image || p.image,
                updated_at: o.updated_at || p.updated_at,
              }
            }
            return p
          })
        }
      } catch {}
    }

    return NextResponse.json({ success: true, products })
  } catch (error: any) {
    console.error("GET /api/products failed:", error)
    return NextResponse.json({ success: false, error: "Unable to load products." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    const json = await request.json()
    const parsed = productCreateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid product data.", details: parsed.error.format() }, { status: 400 })
    }

    const {
      name,
      price,
      cost,
      cost_price,
      stock,
      category_id,
      category,
      category_name,
      station,
      image,
      image_url,
      description,
      temperature,
      dietary_tags,
      department,
      department_override,
      active,
      track_stock,
    } = parsed.data

    const effectiveCategory = category_name || category
    const effectiveDepartment = department || department_override
    const determinedStation = station || determineItemStation({ name, category: effectiveCategory, department: effectiveDepartment })

    const product = await PosDatabase.createProduct({
      name,
      price: Number(price),
      cost: Number(cost_price ?? cost ?? 0),
      cost_price: Number(cost_price ?? cost ?? 0),
      stock: Number(stock),
      category_id: category_id || null,
      category_name: effectiveCategory || "General",
      category: effectiveCategory || "General",
      station: determinedStation,
      image: image?.trim() || image_url?.trim() || "/placeholder.svg",
      description: description?.trim() || "",
      temperature,
      dietary_tags,
      department: effectiveDepartment || (determinedStation === "bar" ? "Coffee Bar" : "Juice & Food"),
      active,
      track_stock,
    })

    return NextResponse.json({ success: true, product }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/products failed", error)
    return NextResponse.json({ success: false, error: error.message || "Unable to create product." }, { status: 500 })
  }
}
