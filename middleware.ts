import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { refreshSessionMarker, setSessionCookie, SESSION_COOKIE_NAME } from "@/lib/coffee/session"
import { isDemoMode } from "@/lib/config/demo"

const publicPaths = new Set(["/auth/login", "/api/auth/login", "/api/auth/demo", "/api/auth/session", "/menu", "/api/tables"])
const publicGetPrefixes = ["/api/coffee/products", "/api/coffee/bills", "/api/products", "/api/tables"]

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  response.headers.set("Content-Security-Policy", contentSecurityPolicy())
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  }
  return response
}

function contentSecurityPolicy() {
  const upgradeDirective = process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : ""
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: data: blob:",
    "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https: http: data: blob:",
    "style-src 'self' 'unsafe-inline' https: http:",
    "style-src-elem 'self' 'unsafe-inline' https: http:",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data: https: http:",
    "frame-src 'self' data: blob: about: https: http:",
    "worker-src 'self' blob:",
    `connect-src 'self' https: wss: http: ws:${upgradeDirective}`,
  ].join("; ")
}

function unauthenticatedResponse(request: NextRequest) {
  const response = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ error: "Authentication required." }, { status: 401 })
    : NextResponse.redirect(new URL("/auth/login", request.url))
  request.cookies.getAll().forEach(({ name }) => {
    if (name === SESSION_COOKIE_NAME || name.startsWith("sb-")) {
      response.cookies.set(name, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "strict" })
    }
  })
  return withSecurityHeaders(response)
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const nextResponse = () => {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("Content-Security-Policy", contentSecurityPolicy())
    return NextResponse.next({ request: { headers: requestHeaders } })
  }
  const isPublicGet = request.method === "GET" && publicGetPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "?"))
  if (publicPaths.has(pathname) || isPublicGet) return withSecurityHeaders(nextResponse())

  if (isDemoMode()) {
    const rawRole = request.cookies.get("pos-staff-role")?.value
    const localUser = request.cookies.get("pos-local-user")?.value
    const hasLocalAuth = (rawRole === "admin" || rawRole === "manager" || rawRole === "cashier" || rawRole === "kitchen" || rawRole === "staff") || localUser === "true"
    if (!hasLocalAuth) {
      return unauthenticatedResponse(request)
    }
    return withSecurityHeaders(nextResponse())
  }

  let response = nextResponse()
  try {
    const rawRole = request.cookies.get("pos-staff-role")?.value
    const localUser = request.cookies.get("pos-local-user")?.value
    const hasLocalAuth = (rawRole === "admin" || rawRole === "manager" || rawRole === "cashier") || localUser === "true"

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = nextResponse()
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          }))
        },
      },
    })

    const { data: { user }, error } = await supabase.auth.getUser()

    if ((error || !user) && !hasLocalAuth) {
      return unauthenticatedResponse(request)
    }
    if (process.env.SESSION_COOKIE_SECRET && process.env.SESSION_COOKIE_SECRET.length >= 32) {
      const sessionMarker = await refreshSessionMarker(request.cookies.get(SESSION_COOKIE_NAME)?.value)
      if (!sessionMarker && !hasLocalAuth) return unauthenticatedResponse(request)
      if (sessionMarker) setSessionCookie(response, sessionMarker)
    }
  } catch {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(NextResponse.json({ error: "Authentication unavailable." }, { status: 503 }))
    }
    return withSecurityHeaders(NextResponse.redirect(new URL("/auth/login", request.url)))
  }

  return withSecurityHeaders(response)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
