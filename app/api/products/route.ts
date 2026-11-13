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
  stock: z.coerce.number().int().min(0).default(50),
  category_id: z.string().uuid().nullable().optional(),
  category: z.string().trim().max(80).optional(),
  station: z.enum(["kitchen", "bar", "none"]).optional(),
  image: z.string().trim().max(2048).optional(),
  description: z.string().trim().max(1000).optional(),
  temperature: z.enum(["hot", "iced", "cold", "none"]).default("none"),
  dietary_tags: z.array(z.string()).default([]),
  department: z.string().trim().max(80).optional(),
  active: z.boolean().default(true),
  track_stock: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") || undefined
    const station = searchParams.get("station") || undefined
    const activeOnly = searchParams.get("activeOnly") === "true"
    const search = searchParams.get("search")?.trim().toLowerCase() || undefined

    const products = await PosDatabase.getProducts({
      category,
      station,
      activeOnly,
      search,
    })

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

  const auth = await authorizeStaff(request, "admin")
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
      stock,
      category_id,
      category,
      station,
      image,
      description,
      temperature,
      dietary_tags,
      department,
      active,
      track_stock,
    } = parsed.data

    const determinedStation = station || determineItemStation({ name, category, department })

    const product = await PosDatabase.createProduct({
      name,
      price: Number(price),
      cost: Number(cost),
      stock: Number(stock),
      category_id: category_id || null,
      station: determinedStation,
      image: image?.trim() || "/placeholder.svg",
      description: description?.trim() || "",
      temperature,
      dietary_tags,
      department: department || (determinedStation === "bar" ? "Coffee Bar" : "Juice & Food"),
      active,
      track_stock,
    })

    return NextResponse.json({ success: true, product }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/products failed", error)
    return NextResponse.json({ success: false, error: error.message || "Unable to create product." }, { status: 500 })
  }
}
