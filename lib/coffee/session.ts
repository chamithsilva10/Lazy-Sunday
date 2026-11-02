import { NextResponse } from "next/server"

export const SESSION_COOKIE_NAME = "pos-session-state"
const idleTimeoutMs = 10 * 60 * 1000
const absoluteTimeoutMs = 8 * 60 * 60 * 1000
const encoder = new TextEncoder()

async function sign(payload: string) {
  const secret = process.env.SESSION_COOKIE_SECRET
  if (!secret || secret.length < 32) throw new Error("Session signing is not configured")
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function verify(payload: string, signature: string) {
  const secret = process.env.SESSION_COOKIE_SECRET
  if (!secret || !/^[0-9a-f]{64}$/.test(signature)) return false
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  )
  const signatureBytes = Uint8Array.from(signature.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16))
  return crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(payload))
}

export async function createSessionMarker(issuedAt = Date.now(), lastActivity = issuedAt) {
  const payload = `${issuedAt}.${lastActivity}`
  return `${payload}.${await sign(payload)}`
}

export async function refreshSessionMarker(value: string | undefined, now = Date.now()) {
  if (!value) return null
  const [issuedValue, activityValue, signature, extra] = value.split(".")
  const issuedAt = Number(issuedValue)
  const lastActivity = Number(activityValue)
  if (extra !== undefined || !Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(lastActivity)) return null
  if (issuedAt > now || lastActivity > now || now - issuedAt > absoluteTimeoutMs || now - lastActivity > idleTimeoutMs) return null
  const payload = `${issuedAt}.${lastActivity}`
  if (!await verify(payload, signature)) return null
  return createSessionMarker(issuedAt, now)
}

export function setSessionCookie(response: NextResponse, value: string) {
  response.cookies.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  })
}