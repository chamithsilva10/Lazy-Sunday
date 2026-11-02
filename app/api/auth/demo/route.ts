import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const response = NextResponse.json({ error: "This sign-in method is disabled." }, { status: 410 })
  response.cookies.delete("pos-demo-session")
  return response
}