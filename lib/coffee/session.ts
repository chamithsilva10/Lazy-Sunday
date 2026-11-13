// lib/coffee/session.ts
import { NextResponse } from "next/server"

export const SESSION_COOKIE_NAME = "pos-session-state"
const idleTimeoutMs = 30 * 60 * 1000 // 30 minutes idle timeout
const absoluteTimeoutMs = 8 * 60 * 60 * 1000 // 8 hours absolute shift timeout
const encoder = new TextEncoder()

export interface SessionData {
  userId: string
  username: string
  role: string
  issuedAt: number
  lastActivity: number
}

function getSigningSecret(): string {
  const secret = process.env.SESSION_COOKIE_SECRET || "demo-pos-client-session-key-32-chars-minimum"
  if (secret.length < 32) {
    throw new Error("Session signing secret must be at least 32 characters")
  }
  return secret
}

async function sign(payload: string): Promise<string> {
  const secret = getSigningSecret()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function verify(payload: string, signature: string): Promise<boolean> {
  const secret = getSigningSecret()
  if (!/^[0-9a-f]{64}$/.test(signature)) return false
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  )
  const signatureBytes = Uint8Array.from(signature.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16))
  return crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(payload))
}

export async function createSessionMarker(
  user?: { userId?: string; username?: string; role?: string },
  issuedAt = Date.now(),
  lastActivity = issuedAt
): Promise<string> {
  const meta = {
    uid: user?.userId || "user",
    usr: user?.username || "staff",
    rol: user?.role || "cashier",
    iat: issuedAt,
    act: lastActivity,
  }
  const payloadJson = Buffer.from(JSON.stringify(meta)).toString("base64url")
  const payload = `v2.${payloadJson}`
  const signature = await sign(payload)
  return `${payload}.${signature}`
}

export async function verifyAndExtractSession(
  value: string | undefined,
  now = Date.now()
): Promise<SessionData | null> {
  if (!value) return null

  // v2 format: v2.<base64url>.<signature>
  if (value.startsWith("v2.")) {
    const parts = value.split(".")
    if (parts.length !== 3) return null
    const [, payloadBase64, signature] = parts
    const payload = `v2.${payloadBase64}`
    if (!(await verify(payload, signature))) return null

    try {
      const parsed = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf-8"))
      const issuedAt = Number(parsed.iat)
      const lastActivity = Number(parsed.act)
      if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(lastActivity)) return null
      if (issuedAt > now || lastActivity > now) return null
      if (now - issuedAt > absoluteTimeoutMs || now - lastActivity > idleTimeoutMs) return null

      return {
        userId: parsed.uid,
        username: parsed.usr,
        role: parsed.rol,
        issuedAt,
        lastActivity,
      }
    } catch {
      return null
    }
  }

  // v1 format: <issuedAt>.<lastActivity>.<signature>
  const parts = value.split(".")
  if (parts.length !== 3) return null
  const [issuedValue, activityValue, signature] = parts
  const issuedAt = Number(issuedValue)
  const lastActivity = Number(activityValue)
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(lastActivity)) return null
  if (issuedAt > now || lastActivity > now || now - issuedAt > absoluteTimeoutMs || now - lastActivity > idleTimeoutMs) return null
  const payload = `${issuedAt}.${lastActivity}`
  if (!(await verify(payload, signature))) return null

  return {
    userId: "v1-user",
    username: "staff",
    role: "cashier",
    issuedAt,
    lastActivity,
  }
}

export async function refreshSessionMarker(value: string | undefined, now = Date.now()): Promise<string | null> {
  const session = await verifyAndExtractSession(value, now)
  if (!session) return null
  return createSessionMarker(
    { userId: session.userId, username: session.username, role: session.role },
    session.issuedAt,
    now
  )
}

export function setSessionCookie(response: NextResponse, value: string) {
  response.cookies.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(absoluteTimeoutMs / 1000),
  })
}
