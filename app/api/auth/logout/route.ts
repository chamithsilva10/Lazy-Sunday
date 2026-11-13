import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"
import { hasValidOrigin } from "@/lib/coffee/auth"
import { writeSecurityAudit } from "@/lib/coffee/security"
import { SESSION_COOKIE_NAME } from "@/lib/coffee/session"

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" })
  response.cookies.set("pos-local-user", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" })
  response.cookies.set("pos-staff-role", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" })
  response.cookies.set("pos-staff-user", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" })
  response.headers.set("Cache-Control", "no-store")

  if (!url || !key) return response
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, {
        ...options,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      })),
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    try {
      await writeSecurityAudit(request, "logout", user.id)
    } catch (error) {
      console.error("Logout security event could not be recorded", error)
      return NextResponse.json({ error: "Logout is temporarily unavailable." }, { status: 503 })
    }
  }
  await supabase.auth.signOut({ scope: "local" })
  response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" })
  response.headers.set("Cache-Control", "no-store")
  return response
}