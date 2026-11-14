import { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { isDemoMode } from "../config/demo"
import { SESSION_COOKIE_NAME, verifyAndExtractSession } from "./session"

export type StaffRole = "cashier" | "manager" | "admin" | "kitchen" | "staff" | "waiter"

export type StaffIdentity = {
  userId: string
  role: StaffRole
  email: string | undefined
}

const validRoles: StaffRole[] = ["cashier", "manager", "admin", "kitchen", "staff", "waiter"]

const rolePermissions: Record<StaffRole, StaffRole[]> = {
  cashier: ["cashier"],
  kitchen: ["cashier", "kitchen"],
  staff: ["cashier", "staff", "waiter"],
  waiter: ["cashier", "waiter", "staff"],
  manager: ["cashier", "kitchen", "staff", "waiter", "manager"],
  admin: ["cashier", "kitchen", "staff", "waiter", "manager", "admin"],
}

export function createStaffSupabaseClient(request?: NextRequest) {
  if (isDemoMode()) {
    return null
  }
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!url || (!serviceKey && !anonKey)) {
    return null
  }

  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
  }

  if (request) {
    return createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    })
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

export async function getStaffIdentity(request: NextRequest): Promise<StaffIdentity | null> {
  // 1. Verify signed HMAC session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (sessionCookie) {
    const verified = await verifyAndExtractSession(sessionCookie)
    if (verified && validRoles.includes(verified.role as StaffRole)) {
      return {
        userId: verified.userId,
        role: verified.role as StaffRole,
        email: `${verified.username}@posdemo.com`,
      }
    }
    return null
  }

  // 2. Check Supabase Auth session if present
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!isDemoMode() && url && anonKey) {
    try {
      const cookieSupabase = createServerClient(url, anonKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      })
      const { data: { user }, error: authError } = await cookieSupabase.auth.getUser()
      if (!authError && user) {
        const { data: profile } = await cookieSupabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()
        if (profile && validRoles.includes(profile.role as StaffRole)) {
          return { userId: user.id, role: profile.role as StaffRole, email: user.email }
        }
      }
    } catch {}
  }

  return null
}

export async function authorizeStaff(
  request: NextRequest,
  minimumRole: StaffRole = "cashier",
): Promise<{ identity: StaffIdentity | null; status: 200 | 401 | 403 }> {
  const identity = await getStaffIdentity(request)
  if (!identity) return { identity: null, status: 401 }
  if (!rolePermissions[identity.role].includes(minimumRole)) return { identity, status: 403 }
  return { identity, status: 200 }
}

export function hasValidOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (!origin) return true

  try {
    const originUrl = new URL(origin)
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    const requestHost = forwardedHost || request.headers.get("host") || new URL(request.nextUrl).host
    const isSameHost = originUrl.host === requestHost
    const isVercelPreview = originUrl.host === "v0.app"
      || originUrl.host.endsWith(".v0.app")
      || originUrl.host.endsWith(".v0.dev")
      || originUrl.host.endsWith(".vusercontent.net")
      || originUrl.host.endsWith(".vercel.app")

    // The v0 preview proxy can present the public preview origin while the
    // route sees an internal host. Keep same-origin checks for normal requests
    // and explicitly trust only known Vercel preview hosts for this endpoint.
    return (originUrl.protocol === "http:" || originUrl.protocol === "https:")
      && (isSameHost || isVercelPreview)
  } catch {
    return false
  }
}

/**
 * Checks if the request is made by an authenticated user with 'admin' role.
 * Inspects Supabase auth session + profiles table, or staff authorization headers.
 */
export async function verifyAdminRole(request: NextRequest): Promise<{ isAdmin: boolean; error?: string }> {
  const { identity } = await authorizeStaff(request, "admin")
  return identity?.role === "admin"
    ? { isAdmin: true }
    : { isAdmin: false, error: "Unauthorized or insufficient permissions." }
}
