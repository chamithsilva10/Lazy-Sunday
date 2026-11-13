import { NextResponse } from "next/server"
import { z } from "zod"
import { PosDatabase } from "@/lib/db/pos-database"

export const dynamic = "force-dynamic"

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dimension: z.enum(["weight", "volume", "count"]),
  base_unit: z.enum(["g", "ml", "pcs"]),
  default_purchase_unit: z.string().min(1),
  category_id: z.string().uuid().nullable().optional(),
})

export async function GET() {
  try {
    const data = await PosDatabase.getIngredients()
    return NextResponse.json({ success: true, data, ingredients: data })
  } catch (error: any) {
    console.error("GET /api/inventory/ingredients failed:", error)
    return NextResponse.json({ success: false, error: "Unable to load ingredients." }, { status: 500 })
  }
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
    const created = await PosDatabase.createIngredient({
      ...parsed.data,
      category_id: parsed.data.category_id || null,
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/inventory/ingredients failed:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to create ingredient." }, { status: 500 })
  }
}
