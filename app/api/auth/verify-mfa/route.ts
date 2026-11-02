import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hasValidOrigin } from "@/lib/coffee/auth"
import { checkLoginThrottle, recordLoginAttempt, requestIp, writeSecurityAudit } from "@/lib/coffee/security"
import { refreshSessionMarker, setSessionCookie, SESSION_COOKIE_NAME } from "@/lib/coffee/session"

const verificationSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict()

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid verification code." }, { status: 400 })
  }
  const parsed = verificationSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid verification code." }, { status: 400 })

  const sessionCookies: { name: string; value: string; options: Record<string, unknown> }[] = []
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => sessionCookies.push({ name, value, options })),
    },
  })
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  const identifier = user.email || user.id
  const ip = requestIp(request)
  try {
    if (await checkLoginThrottle(identifier, ip)) {
      await writeSecurityAudit(request, "mfa_rate_limited", user.id)
      return NextResponse.json({ error: "Invalid verification code." }, { status: 429 })
    }
  } catch (error) {
    console.error("MFA throttle check failed", error)
    return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError || !profile || !["manager", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Invalid verification code." }, { status: 401 })
  }

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
  const factor = factors?.totp?.find((candidate) => candidate.status === "verified")
  if (factorsError || !factor) return NextResponse.json({ error: "Account security is not configured." }, { status: 403 })

  const { error: verificationError } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data.code,
  })
  if (verificationError) {
    try {
      await recordLoginAttempt(identifier, ip, false)
      await writeSecurityAudit(request, "mfa_failed", user.id)
    } catch (error) {
      console.error("MFA failure could not be audited", error)
      return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 })
    }
    return NextResponse.json({ error: "Invalid verification code." }, { status: 401 })
  }

  try {
    await recordLoginAttempt(identifier, ip, true)
    await writeSecurityAudit(request, "login_succeeded", user.id)
  } catch (error) {
    console.error("MFA login could not be audited", error)
    await supabase.auth.signOut()
    return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 })
  }

  const response = NextResponse.json({ success: true })
  sessionCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  }))
  const sessionMarker = await refreshSessionMarker(request.cookies.get(SESSION_COOKIE_NAME)?.value)
  if (!sessionMarker) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  setSessionCookie(response, sessionMarker)
  response.headers.set("Cache-Control", "no-store")
  return response
}