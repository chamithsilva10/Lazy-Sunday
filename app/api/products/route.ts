import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeStaff, createStaffSupabaseClient, hasValidOrigin } from "@/lib/coffee/auth"
import { determineItemStation } from "@/lib/station-routing"

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
  temperature: z.enum(["hot", "iced", "none"]).default("none"),
  dietary_tags: z.array(z.string()).default([]),
  department: z.string().trim().max(80).optional(),
  active: z.boolean().default(true),
  track_stock: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const station = searchParams.get("station")
    const activeOnly = searchParams.get("activeOnly") === "true"
    const search = searchParams.get("search")?.trim().toLowerCase()

    const supabase = createStaffSupabaseClient(request)

    if (supabase) {
      let query = supabase
        .from("pos_products")
        .select(`
          id,
          name,
          price,
          cost,
          stock,
          category_id,
          image,
          description,
          temperature,
          dietary_tags,
          department_override,
          station,
          active,
          is_archived,
          sort_order,
          created_at,
          updated_at,
          pos_categories (
            id,
            name
          )
        `)
        .eq("is_archived", false)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })

      if (activeOnly) {
        query = query.eq("active", true)
      }

      if (station && station !== "all") {
        query = query.eq("station", station)
      }

      const { data, error } = await query

      if (error) throw error

      let products = (data || []).map((p: any) => ({
        id: String(p.id),
        name: p.name,
        price: Number(p.price) || 0,
        cost: Number(p.cost) || 0,
        stock: Number(p.stock) || 0,
        category: p.pos_categories?.name || "General",
        category_id: p.category_id,
        image: p.image || "/placeholder.svg",
        description: p.description || "",
        temperature: p.temperature || "none",
        dietary_tags: p.dietary_tags || [],
        department: p.department_override || (p.station === "bar" ? "Coffee Bar" : "Juice & Food"),
        station: p.station || (p.department_override && /bar/i.test(p.department_override) ? "bar" : "kitchen"),
        active: p.active !== false,
        track_stock: p.track_stock !== false,
        updated_at: p.updated_at,
      }))

      if (category && category !== "All") {
        products = products.filter((p) => p.category.toLowerCase() === category.toLowerCase())
      }

      if (search) {
        products = products.filter(
          (p) => p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search)
        )
      }

      return NextResponse.json({ success: true, products })
    }

    return NextResponse.json({ success: true, products: [] })
  } catch (error: any) {
    console.error("GET /api/products failed", error)
    return NextResponse.json({ success: false, error: "Unable to load products." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
      station,
      image,
      description,
      temperature,
      dietary_tags,
      department,
      active,
      track_stock,
    } = parsed.data

    const supabase = createStaffSupabaseClient(request)

    // Determine station
    const determinedStation = station || determineItemStation({
      name,
      department,
      category: parsed.data.category,
    })

    if (supabase) {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from("pos_products")
        .insert({
          name: name.trim(),
          price: Number(price),
          cost: Number(cost),
          stock: Number(stock),
          category_id: category_id || null,
          station: determinedStation,
          image: image?.trim() || "/placeholder.svg",
          description: description?.trim() || "",
          temperature,
          dietary_tags,
          department_override: department || (determinedStation === "bar" ? "Coffee Bar" : "Juice & Food"),
          active,
          track_stock,
          is_archived: false,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, product: data }, { status: 201 })
    }

    const offlineProduct = {
      id: `prod-${Date.now()}`,
      name,
      price,
      cost,
      stock,
      category_id,
      station: determinedStation,
      image: image || "/placeholder.svg",
      active,
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({ success: true, product: offlineProduct }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/products failed", error)
    return NextResponse.json({ success: false, error: "Unable to create product." }, { status: 500 })
  }
}
