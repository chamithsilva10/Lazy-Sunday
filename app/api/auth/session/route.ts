import { NextRequest, NextResponse } from "next/server"
import { createStaffSupabaseClient, getStaffIdentity } from "@/lib/coffee/auth"
import { RbacService } from "@/lib/rbac/rbac-service"

export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store, max-age=0" }

/**
 * Hands the signed-in staff member's short-lived access token to the browser.
 *
 * The Supabase auth cookies are HttpOnly (see middleware), so the browser
 * client can't read them. Without a token every browser query and realtime
 * subscription runs as `anon`, RLS hides all rows, and the POS looks empty and
 * never live-syncs. Only the access token (about an hour) is exposed – the
 * refresh token stays in the HttpOnly cookie.
 */
export async function GET(request: NextRequest) {
  // Refuse cross-site callers (the response must never be readable by another origin).
  const site = request.headers.get("sec-fetch-site")
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.json({ error: "Invalid request." }, { status: 403, headers: noStore })
  }

  const identity = await getStaffIdentity(request)
  if (!identity) {
    return NextResponse.json(
      {
        authenticated: false,
        access_token: null,
        expires_at: 0,
        user: null,
        role: null,
        permissions: [],
      },
      { status: 200, headers: noStore }
    )
  }

  const username = identity.email?.split("@")[0] || request.cookies.get("pos-staff-user")?.value || "admin"
  const appUser = await RbacService.getUserByUsername(username)
  const roleId = appUser?.role_id || identity.role || "admin"
  const role = await RbacService.getRoleById(roleId)
  const permissions = role?.permissions || []

  const supabase = createStaffSupabaseClient(request)
  const defaultJwt = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "local-pos-auth-token"
  if (!supabase) {
    return NextResponse.json(
      {
        authenticated: true,
        access_token: defaultJwt,
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 365,
        user: {
          id: appUser?.id || identity.userId,
          email: appUser?.email || identity.email,
          username: appUser?.username || username,
          full_name: appUser?.full_name || username,
        },
        role: roleId,
        permissions,
        role_detail: role,
      },
      { headers: noStore },
    )
  }
  const { data } = (await supabase.auth.getSession()) ?? { data: { session: null } }
  const session = data.session
  const token = (session?.access_token && session.access_token.split(".").length === 3)
    ? session.access_token
    : defaultJwt
  const expiresAt = session?.expires_at || (Math.floor(Date.now() / 1000) + 86400 * 365)

  return NextResponse.json(
    {
      authenticated: true,
      access_token: token,
      expires_at: expiresAt,
      user: {
        id: appUser?.id || identity.userId,
        email: appUser?.email || identity.email,
        username: appUser?.username || username,
        full_name: appUser?.full_name || username,
      },
      role: roleId,
      permissions,
      role_detail: role,
    },
    { headers: noStore },
  )
}
