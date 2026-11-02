import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hasValidOrigin } from "@/lib/coffee/auth"
import { checkLoginThrottle, recordLoginAttempt, requestIp, writeSecurityAudit } from "@/lib/coffee/security"
import { createSessionMarker, setSessionCookie, SESSION_COOKIE_NAME } from "@/lib/coffee/session"
import { RbacService } from "@/lib/rbac/rbac-service"
import { isDemoMode } from "@/lib/config/demo"

const loginSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(1024),
}).strict()

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const emailDomain = process.env.STAFF_AUTH_EMAIL_DOMAIN || "posdemo.com"

  if (!url || !key || isDemoMode()) {
    const rawUsername = parsed.data.username.trim().toLowerCase()
    const appUser = await RbacService.authenticateUser(rawUsername, parsed.data.password)
    if (!appUser) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 })
    }
    if (!appUser.is_active) {
      return NextResponse.json(
        { error: "This account has been deactivated. Please contact an administrator." },
        { status: 403 }
      )
    }

    const role = appUser.role_id
    const success = NextResponse.json({ success: true, mfaRequired: false, role })
    const cookieOptions = {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      maxAge: 8 * 60 * 60,
    }

    success.cookies.set("pos-local-user", "true", cookieOptions)
    success.cookies.set("pos-staff-role", role, cookieOptions)
    success.cookies.set("pos-staff-user", appUser.username, cookieOptions)

    if (process.env.SESSION_COOKIE_SECRET && process.env.SESSION_COOKIE_SECRET.length >= 32) {
      setSessionCookie(success, await createSessionMarker())
    } else {
      success.cookies.set(SESSION_COOKIE_NAME, "local-session", cookieOptions)
    }

    success.headers.set("Cache-Control", "no-store")
    return success
  }

  const identifiers = parsed.data.username.includes("@")
    ? [parsed.data.username.toLowerCase()]
    : [
        `${parsed.data.username.toLowerCase()}@${emailDomain.toLowerCase()}`,
        `${parsed.data.username.toLowerCase()}@posdemo.com`,
      ].filter((value, index, values) => values.indexOf(value) === index)
  const identifier = identifiers[0]
  const ip = requestIp(request)

  try {
    if (await checkLoginThrottle(identifier, ip)) {
      await writeSecurityAudit(request, "login_rate_limited", null)
      return NextResponse.json({ error: "Invalid username or password." }, {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "900" },
      })
    }
  } catch (error) {
    // Rate limiting is defense-in-depth; a missing optional security RPC must not block valid staff sign-in.
    console.warn("Login throttle check unavailable", error)
  }

  const sessionCookies: { name: string; value: string; options: Record<string, unknown> }[] = []
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value, options }) => sessionCookies.push({ name, value, options }))
      },
    },
  })

  let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] = { user: null, session: null }
  let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"] = null
  for (const candidate of identifiers) {
    const result = await supabase.auth.signInWithPassword({
      email: candidate,
      password: parsed.data.password,
    })
    if (!result.error && result.data.user) {
      data = result.data
      error = null
      break
    }
    error = result.error
  }
  if (error || !data.user) {
    const rawUsername = parsed.data.username.trim().toLowerCase()
    const appUser = await RbacService.authenticateUser(rawUsername, parsed.data.password)
    if (appUser) {
      if (!appUser.is_active) {
        return NextResponse.json(
          { error: "This account has been deactivated. Please contact an administrator." },
          { status: 403 }
        )
      }
      const role = appUser.role_id
      const success = NextResponse.json({ success: true, mfaRequired: false, role })
      const cookieOptions = {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict" as const,
        maxAge: 8 * 60 * 60,
      }
      success.cookies.set("pos-local-user", "true", cookieOptions)
      success.cookies.set("pos-staff-role", role, cookieOptions)
      success.cookies.set("pos-staff-user", appUser.username, cookieOptions)
      if (process.env.SESSION_COOKIE_SECRET && process.env.SESSION_COOKIE_SECRET.length >= 32) {
        setSessionCookie(success, await createSessionMarker())
      } else {
        success.cookies.set(SESSION_COOKIE_NAME, "local-session", cookieOptions)
      }
      success.headers.set("Cache-Control", "no-store")
      return success
    }

    try {
      await recordLoginAttempt(identifier, ip, false)
      await writeSecurityAudit(request, "login_failed", null)
    } catch (auditError) {
      console.error("Failed login security event could not be recorded", auditError)
    }
    return NextResponse.json({ error: "Invalid username or password." }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    })
  }

  // Read the profile through the authenticated client so this route never
  // depends on a service-role key from a different Supabase project.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle()
  if (profileError || !profile || !["cashier", "manager", "admin"].includes(profile.role)) {
    await supabase.auth.signOut()
    try {
      await recordLoginAttempt(identifier, ip, false)
      await writeSecurityAudit(request, "login_failed", null)
    } catch (auditError) {
      console.error("Failed login security event could not be recorded", auditError)
    }
    return NextResponse.json({ error: "Invalid username or password." }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const role = profile.role as "cashier" | "manager" | "admin"
  let mfaRequired = false
  if (role !== "cashier") {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const verifiedTotp = factors?.totp?.some((factor) => factor.status === "verified")
      if (verifiedTotp) {
        mfaRequired = true
      }
    } catch {
      mfaRequired = false
    }
  }

  try {
    await recordLoginAttempt(identifier, ip, true)
    if (!mfaRequired) await writeSecurityAudit(request, "login_succeeded", data.user.id)
  } catch (auditError) {
    console.error("Successful login security event could not be recorded", auditError)
  }

  const success = NextResponse.json({ success: true, mfaRequired })
  sessionCookies.forEach(({ name, value, options }) => {
    success.cookies.set(name, value, {
      ...options,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    })
  })
  if (process.env.SESSION_COOKIE_SECRET && process.env.SESSION_COOKIE_SECRET.length >= 32) {
    setSessionCookie(success, await createSessionMarker())
  }
  success.headers.set("Cache-Control", "no-store")
  return success
}
