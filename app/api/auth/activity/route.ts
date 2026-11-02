import { NextRequest, NextResponse } from "next/server"
import { hasValidOrigin } from "@/lib/coffee/auth"

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 })
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } })
}