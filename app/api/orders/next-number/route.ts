import { NextRequest, NextResponse } from "next/server"
import { authorizeStaff, createStaffSupabaseClient } from "@/lib/coffee/auth"
import { PosDatabase } from "@/lib/db/pos-database"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200) {
    return NextResponse.json(
      { success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status }
    )
  }

  try {
    const supabase = createStaffSupabaseClient(request)

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc("get_next_bill_numbers")
        if (!error && data && data.order_number) {
          return NextResponse.json({
            success: true,
            orderNumber: data.order_number,
            receiptNumber: data.receipt_number,
            seq: Number(data.seq) || 101,
          })
        }
      } catch (err) {
        console.warn("get_next_bill_numbers RPC warning:", err)
      }
    }

    // Direct PostgreSQL atomic database sequence
    const billNumbers = await PosDatabase.getNextBillNumbers()
    return NextResponse.json({
      success: true,
      orderNumber: billNumbers.orderNumber,
      receiptNumber: billNumbers.receiptNumber,
      seq: billNumbers.seq,
    })
  } catch (error: any) {
    console.error("GET /api/orders/next-number failed", error)
    return NextResponse.json({ success: false, error: "Failed to generate bill number" }, { status: 500 })
  }
}
