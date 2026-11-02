import { NextRequest, NextResponse } from "next/server"
import { authorizeStaff, createStaffSupabaseClient } from "@/lib/coffee/auth"
import { CoffeeStorageService } from "@/lib/coffee/storage"

export async function GET(request: NextRequest) {
  const auth = await authorizeStaff(request, "manager")
  if (auth.status !== 200) {
    return NextResponse.json({ success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const productId = searchParams.get("productId") || undefined
    const paymentMethod = searchParams.get("paymentMethod") || undefined

    const report = await CoffeeStorageService.generateReport({
      startDate,
      endDate,
      productId,
      paymentMethod,
    }, createStaffSupabaseClient(request))

    return NextResponse.json({ success: true, report })
  } catch (error: any) {
    console.error("Coffee report generation failed", error)
    return NextResponse.json({ success: false, error: "Unable to generate report." }, { status: 500 })
  }
}
