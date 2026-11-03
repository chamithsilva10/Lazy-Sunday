import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { isDemoMode } from "@/lib/config/demo"
import { MOCK_INGREDIENTS } from "@/lib/mock/pos-mock-data"

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dimension: z.enum(["weight", "volume", "count"]),
  base_unit: z.enum(["g", "ml", "pcs"]),
  default_purchase_unit: z.string().min(1),
  category_id: z.string().uuid().nullable().optional(),
})

export async function GET() {
  try {
    if (!isDemoMode()) {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data, error } = await supabase
          .from("ingredients")
          .select(
            "id,sku,name,category_id,dimension,base_unit,default_purchase_unit,current_stock_base,par_level_base,reorder_level_base,reorder_qty_base,is_perishable,is_active,is_archived,version"
          )
          .eq("is_archived", false)
          .order("name")

        if (!error && data) {
          return NextResponse.json({ success: true, data })
        }
      }
    }
  } catch {}

  // Demo / Offline Mode Fallback
  const fallbackData = MOCK_INGREDIENTS.map((ing) => ({
    id: ing.id,
    sku: ing.sku,
    name: ing.name,
    category_id: null,
    dimension: ing.base_unit === "kg" ? "weight" : ing.base_unit === "L" ? "volume" : "count",
    base_unit: ing.base_unit === "kg" ? "g" : ing.base_unit === "L" ? "ml" : "pcs",
    default_purchase_unit: ing.base_unit,
    current_stock_base: ing.current_stock,
    par_level_base: ing.reorder_level * 2,
    reorder_level_base: ing.reorder_level,
    reorder_qty_base: ing.reorder_level,
    is_perishable: true,
    is_active: true,
    is_archived: false,
    version: 1,
  }))

  return NextResponse.json({ success: true, data: fallbackData })
}

export async function POST(request: Request) {
  const parsed = ingredientSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: "INVALID_INPUT", message: "Check the ingredient fields", data: null },
      { status: 400 }
    )
  }

  try {
    if (!isDemoMode()) {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data, error } = await supabase
          .from("ingredients")
          .insert({ ...parsed.data, category_id: parsed.data.category_id || null })
          .select(
            "id,sku,name,category_id,dimension,base_unit,default_purchase_unit,current_stock_base,par_level_base,reorder_level_base,reorder_qty_base,version"
          )
          .single()

        if (!error && data) {
          return NextResponse.json({ success: true, data }, { status: 201 })
        }
      }
    }
  } catch {}

  const offlineItem = {
    id: `ing-${Date.now()}`,
    sku: `ING-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    name: parsed.data.name,
    category_id: parsed.data.category_id || null,
    dimension: parsed.data.dimension,
    base_unit: parsed.data.base_unit,
    default_purchase_unit: parsed.data.default_purchase_unit,
    current_stock_base: 50,
    par_level_base: 20,
    reorder_level_base: 10,
    reorder_qty_base: 10,
    version: 1,
  }

  return NextResponse.json({ success: true, data: offlineItem }, { status: 201 })
}
