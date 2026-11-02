import { createClient } from "@supabase/supabase-js"
import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import { NextRequest } from "next/server"
import { isDemoMode } from "../config/demo"

function createServiceClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!url || !key) throw new Error("Server security services are not configured")
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

function hashIdentifier(value: string) {
  const secret = process.env.LOGIN_RATE_LIMIT_SECRET || process.env.SUPABASE_JWT_SECRET || "default_pos_rate_limit_secret_key_32bytes_long"
  return createHmac("sha256", secret).update(value).digest("hex")
}

export function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const candidate = forwarded || request.headers.get("x-real-ip") || "unknown"
  return isIP(candidate) ? candidate : "unknown"
}

export async function checkLoginThrottle(username: string, ip: string) {
  if (isDemoMode()) return false
  const client = createServiceClient()
  const { data, error } = await client.rpc("is_login_throttled", {
    p_username_hash: hashIdentifier(`username:${username}`),
    p_ip_hash: hashIdentifier(`ip:${ip}`),
  })
  if (error) throw error
  return Boolean(data)
}

export async function recordLoginAttempt(username: string, ip: string, succeeded: boolean) {
  if (isDemoMode()) return ""
  const client = createServiceClient()
  const usernameHash = hashIdentifier(`username:${username}`)
  const ipHash = hashIdentifier(`ip:${ip}`)
  const { error } = await client.rpc("record_login_attempt", {
    p_username_hash: usernameHash,
    p_ip_hash: ipHash,
    p_succeeded: succeeded,
  })
  if (error) throw error
  return usernameHash
}

function isUuid(val?: string | null): boolean {
  if (!val) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val)
}

export async function writeSecurityAudit(
  request: NextRequest,
  action: string,
  actorUserId: string | null,
  targetId: string | null = null,
  metadata: Record<string, unknown> = {},
) {
  if (isDemoMode()) return
  try {
    const client = createServiceClient()
    const ip = requestIp(request)
    const validActorId = isUuid(actorUserId) ? actorUserId : null
    const auditMetadata = isUuid(actorUserId)
      ? metadata
      : { ...metadata, local_actor: actorUserId || "anonymous" }

    const { error } = await client.from("security_audit_log").insert({
      actor_user_id: validActorId,
      action,
      target_id: targetId,
      ip_address: ip === "unknown" ? null : ip,
      user_agent: request.headers.get("user-agent")?.slice(0, 1024) || null,
      metadata: auditMetadata,
    })
    if (error) {
      console.warn("Security audit write warning:", error.message)
    }
  } catch (err: any) {
    console.warn("Security audit not recorded:", err?.message || err)
  }
}

export async function readSecurityAudit(filters: {
  action?: string
  from?: string
  to?: string
  limit: number
  offset: number
}) {
  let query = createServiceClient()
    .from("security_audit_log")
    .select("id,actor_user_id,action,target_id,ip_address,user_agent,metadata,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1)

  if (filters.action) query = query.eq("action", filters.action)
  if (filters.from) query = query.gte("created_at", filters.from)
  if (filters.to) query = query.lte("created_at", filters.to)

  const { data, count, error } = await query
  if (error) throw error
  return { entries: data || [], total: count || 0 }
}
