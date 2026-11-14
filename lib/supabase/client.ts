import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import { isDemoMode } from "../config/demo"
import { createMockSupabaseClient } from "./mock-client"

export type BrowserSession = {
  access_token: string
  expires_at: number
  user: { id: string; email?: string }
  role: "cashier" | "manager" | "admin"
}

let sessionCache: BrowserSession | null = null
let negativeCacheUntil = 0
let inflight: Promise<BrowserSession | null> | null = null
let client: SupabaseClient | null = null
let refreshTimer: ReturnType<typeof setTimeout> | undefined

function supabaseConfig() {
  if (isDemoMode()) {
    return null
  }
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  let key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  return url && key ? { url, key } : null
}

export function isSupabaseConfigured() {
  if (isDemoMode()) return true
  return supabaseConfig() !== null
}

/**
 * The auth cookies are HttpOnly, so the browser can't read the session itself.
 * Ask the server for the (short-lived) access token and cache it.
 */
export async function getBrowserSession(force = false): Promise<BrowserSession | null> {
  const now = Date.now() / 1000
  if (!force && sessionCache && sessionCache.expires_at - 60 > now) return sessionCache
  if (!force && !sessionCache && Date.now() < negativeCacheUntil) return null
  if (inflight) return inflight

  inflight = fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
    .then(async (response) => {
      if (response.status === 401 || response.status === 403) {
        sessionCache = null
        negativeCacheUntil = Date.now() + 5000
        return null
      }
      if (!response.ok) throw new Error(`Session request failed (${response.status})`)
      const next = (await response.json()) as (BrowserSession & { authenticated?: boolean })
      if (!next || (!next.access_token && !next.user) || next.authenticated === false) {
        sessionCache = null
        negativeCacheUntil = Date.now() + 5000
        return null
      }
      negativeCacheUntil = 0
      sessionCache = next
      scheduleRealtimeRefresh(next)
      return next
    })
    .catch(() => {
      negativeCacheUntil = Date.now() + 5000
      return (sessionCache && sessionCache.expires_at > Date.now() / 1000 ? sessionCache : null)
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

// Keep long-lived realtime sockets authorised by pushing a fresh token before expiry.
function scheduleRealtimeRefresh(session: BrowserSession) {
  if (typeof window === "undefined") return
  if (refreshTimer) clearTimeout(refreshTimer)
  const wait = Math.max(30_000, (session.expires_at - Date.now() / 1000 - 120) * 1000)
  refreshTimer = setTimeout(() => {
    void getBrowserSession(true).then((fresh) => {
      if (fresh && client) void client.realtime.setAuth(fresh.access_token)
    })
  }, wait)
}

function createAuthShim() {
  const authTarget = {
    getUser: async () => {
      try {
        const session = await getBrowserSession()
        if (!session?.user) {
          return { data: { user: null }, error: null }
        }
        return {
          data: {
            user: {
              id: session.user.id,
              email: session.user.email || "",
              aud: "authenticated",
              role: session.role,
              app_metadata: { role: session.role },
              user_metadata: { role: session.role },
              created_at: new Date().toISOString(),
            },
          },
          error: null,
        }
      } catch {
        return { data: { user: null }, error: null }
      }
    },
    getSession: async () => {
      try {
        const session = await getBrowserSession()
        if (!session) {
          return { data: { session: null }, error: null }
        }
        return {
          data: {
            session: {
              access_token: session.access_token,
              token_type: "bearer",
              expires_in: session.expires_at - Math.floor(Date.now() / 1000),
              expires_at: session.expires_at,
              refresh_token: "",
              user: {
                id: session.user.id,
                email: session.user.email || "",
                aud: "authenticated",
                role: session.role,
                app_metadata: { role: session.role },
                user_metadata: { role: session.role },
                created_at: new Date().toISOString(),
              },
            },
          },
          error: null,
        }
      } catch {
        return { data: { session: null }, error: null }
      }
    },
    onAuthStateChange: (callback?: (event: string, session: any) => void) => {
      return {
        data: {
          subscription: {
            id: "browser-auth-sub",
            callback,
            unsubscribe: () => {},
          },
        },
      }
    },
    signOut: async () => {
      sessionCache = null
      negativeCacheUntil = 0
      try {
        await fetch("/api/auth/logout", { method: "POST" })
      } catch {}
      return { error: null }
    },
    refreshSession: async () => {
      const session = await getBrowserSession(true)
      return {
        data: {
          session: session ? { access_token: session.access_token } : null,
          user: session?.user || null,
        },
        error: null,
      }
    },
    setSession: async () => ({ data: { session: null, user: null }, error: null }),
  }

  return new Proxy(authTarget, {
    get: (target: any, prop: string | symbol) => {
      if (prop in target) return target[prop]
      if (typeof prop === "string") {
        return async () => ({ data: null, error: null })
      }
      return undefined
    },
  })
}

function createOfflineClient() {
  // Returned when Supabase isn't configured so screens degrade to empty data instead of crashing.
  const empty = { data: [], error: null }
  const chain: any = new Proxy(function () {}, {
    get: (_target, prop) => {
      if (prop === "then") return (resolve: (value: unknown) => unknown) => Promise.resolve(empty).then(resolve)
      return () => chain
    },
    apply: () => chain,
  })
  return {
    auth: createAuthShim(),
    from: () => chain,
    rpc: async () => ({ data: null, error: new Error("Supabase URL not configured") }),
    channel: () => ({ on() { return this }, subscribe() { return this } }),
    removeChannel: async () => "ok",
    realtime: { setAuth: async () => {} },
  } as unknown as SupabaseClient
}

/**
 * Shared browser data client. Requests are authorised with the staff access
 * token from `/api/auth/session`, so Row Level Security and realtime see the
 * signed-in user instead of `anon`.
 */
export function createClient(): SupabaseClient {
  if (client) return client
  if (isDemoMode()) {
    client = createMockSupabaseClient() as unknown as SupabaseClient
    return client
  }
  const config = supabaseConfig()
  if (!config) {
    client = createOfflineClient()
    return client
  }
  const rawClient = createSupabaseClient(config.url, config.key, {
    accessToken: async () => {
      const session = await getBrowserSession()
      const token = session?.access_token
      if (token && typeof token === "string" && token.split(".").length === 3) {
        return token
      }
      return config.key
    },
    realtime: { params: { eventsPerSecond: 10 } },
  })

  // Prevent @supabase/supabase-js from throwing when accessing supabase.auth with accessToken option
  Object.defineProperty(rawClient, "auth", {
    value: createAuthShim(),
    configurable: true,
    writable: true,
    enumerable: true,
  })

  client = rawClient
  return client
}
