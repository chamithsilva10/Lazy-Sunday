/**
 * Mock Supabase Client
 * Intercepts all Supabase SDK queries and routes them to isolated in-memory & local mock data.
 * Zero production network traffic, zero credentials leakage.
 */

import {
  MOCK_CATEGORIES,
  MOCK_PRODUCTS,
  MOCK_TABLES,
  MOCK_CUSTOMERS,
  MOCK_HISTORICAL_ORDERS,
  MockProduct,
  MockOrder,
  MockTable,
  MockCategory,
} from "../mock/pos-mock-data"
import { getBrowserSession, BrowserSession } from "./client"

// Local in-memory caches
let localProducts: MockProduct[] = [...MOCK_PRODUCTS]
let localCategories: MockCategory[] = [...MOCK_CATEGORIES]
let localTables: MockTable[] = [...MOCK_TABLES]
let localOrders: MockOrder[] = [...MOCK_HISTORICAL_ORDERS]
let localSessions: any[] = []
let localReservations: any[] = []
const realtimeListeners = new Map<string, Set<(payload: any) => void>>()

function emitMockRealtime(event: string, payload: any) {
  const listeners = realtimeListeners.get(event)
  if (listeners) {
    listeners.forEach((fn) => {
      try {
        fn(payload)
      } catch {}
    })
  }
}

class MockQueryBuilder {
  private tableName: string
  private filters: Array<(item: any) => boolean> = []
  private sortField: string | null = null
  private sortAsc = true
  private limitCount: number | null = null
  private selectedFields: string[] | null = null

  constructor(tableName: string) {
    this.tableName = tableName
  }

  select(fields = "*") {
    if (fields !== "*") {
      this.selectedFields = fields.split(",").map((f) => f.trim().split(" ")[0])
    }
    return this
  }

  eq(field: string, value: any) {
    this.filters.push((item) => item[field] === value)
    return this
  }

  neq(field: string, value: any) {
    this.filters.push((item) => item[field] !== value)
    return this
  }

  in(field: string, values: any[]) {
    this.filters.push((item) => values.includes(item[field]))
    return this
  }

  gte(field: string, value: any) {
    this.filters.push((item) => item[field] >= value)
    return this
  }

  lte(field: string, value: any) {
    this.filters.push((item) => item[field] <= value)
    return this
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.sortField = field
    this.sortAsc = options?.ascending !== false
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  async single() {
    const res = await this.execute()
    return { data: res.data?.[0] || null, error: res.data?.[0] ? null : new Error("Row not found") }
  }

  async maybeSingle() {
    const res = await this.execute()
    return { data: res.data?.[0] || null, error: null }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async insert(records: any | any[], _options?: any) {
    const arr = Array.isArray(records) ? records : [records]
    if (this.tableName === "pos_products") {
      for (const r of arr) {
        const item: MockProduct = {
          id: r.id || `prod-${Date.now()}`,
          name: r.name,
          sku: r.sku || `SKU-${Date.now().toString().slice(-4)}`,
          barcode: r.barcode || `BC-${Date.now().toString().slice(-6)}`,
          price: Number(r.price || 0),
          cost_price: Number(r.cost_price || 0),
          stock: Number(r.stock || 0),
          category: r.category || "General",
          category_id: r.category_id || "cat-1",
          station: r.station || "kitchen",
          department: r.department || "Juice & Food",
          image: r.image || "/latte-coffee.png",
          description: r.description || "",
        }
        localProducts.unshift(item)
      }
      emitMockRealtime("pos_products", { eventType: "INSERT", new: arr[0] })
    } else if (this.tableName === "pos_orders") {
      for (const r of arr) {
        localOrders.unshift(r)
      }
      emitMockRealtime("pos_orders", { eventType: "INSERT", new: arr[0] })
    } else if (this.tableName === "pos_tables") {
      for (const r of arr) {
        localTables.push(r)
      }
    } else if (this.tableName === "table_sessions") {
      for (const r of arr) {
        localSessions.unshift(r)
      }
      emitMockRealtime("table_sessions", { eventType: "INSERT", new: arr[0] })
    } else if (this.tableName === "reservations") {
      for (const r of arr) {
        if (!r.id) {
          r.id = "res-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6)
        }
        localReservations.unshift(r)
      }
      emitMockRealtime("reservations", { eventType: "INSERT", new: arr[0] })
    }
    return { data: Array.isArray(records) ? arr : arr[0], error: null }
  }

  async upsert(records: any | any[], options?: { onConflict?: string }) {
    const arr = Array.isArray(records) ? records : [records]
    if (this.tableName === "pos_orders") {
      for (const r of arr) {
        const conflict = options?.onConflict || "order_number"
        const idx = localOrders.findIndex((o) => (o as any)[conflict] === r[conflict])
        if (idx >= 0) {
          localOrders[idx] = { ...localOrders[idx], ...r }
        } else {
          localOrders.unshift(r)
        }
      }
      emitMockRealtime("pos_orders", { eventType: "UPDATE", new: arr[0] })
    } else if (this.tableName === "pos_products") {
      for (const r of arr) {
        const idx = localProducts.findIndex((p) => p.id === r.id || p.name === r.name)
        if (idx >= 0) {
          localProducts[idx] = { ...localProducts[idx], ...r }
        } else {
          localProducts.unshift(r)
        }
      }
    } else if (this.tableName === "pos_tables") {
      for (const r of arr) {
        const idx = localTables.findIndex((t) => t.id === r.id || t.name === r.name)
        if (idx >= 0) {
          localTables[idx] = { ...localTables[idx], ...r }
        } else {
          localTables.push(r)
        }
      }
    } else if (this.tableName === "table_sessions") {
      for (const r of arr) {
        const idx = localSessions.findIndex((s) => s.id === r.id || (s.table_id === r.table_id && s.status !== "closed"))
        if (idx >= 0) {
          localSessions[idx] = { ...localSessions[idx], ...r }
        } else {
          localSessions.unshift(r)
        }
      }
      emitMockRealtime("table_sessions", { eventType: "UPDATE", new: arr[0] })
    } else if (this.tableName === "reservations") {
      for (const r of arr) {
        const idx = localReservations.findIndex((b) => b.id === r.id)
        if (idx >= 0) {
          localReservations[idx] = { ...localReservations[idx], ...r }
        } else {
          localReservations.unshift(r)
        }
      }
      emitMockRealtime("reservations", { eventType: "UPDATE", new: arr[0] })
    }
    return { data: Array.isArray(records) ? arr : arr[0], error: null }
  }

  async update(updates: any) {
    if (this.tableName === "pos_products") {
      localProducts = localProducts.map((p) => {
        if (this.filters.every((f) => f(p))) {
          return { ...p, ...updates }
        }
        return p
      })
      emitMockRealtime("pos_products", { eventType: "UPDATE", new: updates })
    } else if (this.tableName === "pos_tables") {
      localTables = localTables.map((t) => {
        if (this.filters.every((f) => f(t))) {
          return { ...t, ...updates }
        }
        return t
      })
      emitMockRealtime("pos_tables", { eventType: "UPDATE", new: updates })
    } else if (this.tableName === "pos_orders") {
      localOrders = localOrders.map((o) => {
        if (this.filters.every((f) => f(o))) {
          return { ...o, ...updates }
        }
        return o
      })
      emitMockRealtime("pos_orders", { eventType: "UPDATE", new: updates })
    } else if (this.tableName === "table_sessions") {
      localSessions = localSessions.map((s) => {
        if (this.filters.every((f) => f(s))) {
          return { ...s, ...updates }
        }
        return s
      })
      emitMockRealtime("table_sessions", { eventType: "UPDATE", new: updates })
    } else if (this.tableName === "reservations") {
      localReservations = localReservations.map((b) => {
        if (this.filters.every((f) => f(b))) {
          return { ...b, ...updates }
        }
        return b
      })
      emitMockRealtime("reservations", { eventType: "UPDATE", new: updates })
    }
    return { data: updates, error: null }
  }

  async delete() {
    if (this.tableName === "pos_products") {
      localProducts = localProducts.filter((p) => !this.filters.every((f) => f(p)))
    } else if (this.tableName === "pos_tables") {
      localTables = localTables.filter((t) => !this.filters.every((f) => f(t)))
    } else if (this.tableName === "table_sessions") {
      localSessions = localSessions.filter((s) => !this.filters.every((f) => f(s)))
    } else if (this.tableName === "reservations") {
      localReservations = localReservations.filter((b) => !this.filters.every((f) => f(b)))
    }
    return { data: null, error: null }
  }

  private async execute() {
    let source: any[] = []
    if (this.tableName === "pos_products") {
      source = [...localProducts]
    } else if (this.tableName === "pos_categories") {
      source = [...localCategories]
    } else if (this.tableName === "pos_tables") {
      source = [...localTables]
    } else if (this.tableName === "pos_orders") {
      source = [...localOrders]
    } else if (this.tableName === "table_sessions") {
      source = [...localSessions]
    } else if (this.tableName === "reservations") {
      source = [...localReservations]
    } else if (this.tableName === "customers") {
      source = [...MOCK_CUSTOMERS]
    } else if (this.tableName === "coffee_bills") {
      source = []
    } else {
      source = []
    }

    let filtered = source.filter((item) => this.filters.every((f) => f(item)))

    if (this.sortField) {
      filtered.sort((a, b) => {
        const valA = a[this.sortField!]
        const valB = b[this.sortField!]
        if (valA < valB) return this.sortAsc ? -1 : 1
        if (valA > valB) return this.sortAsc ? 1 : -1
        return 0
      })
    }

    if (this.limitCount != null) {
      filtered = filtered.slice(0, this.limitCount)
    }

    return { data: filtered, error: null }
  }

  then(resolve: (value: any) => any, reject?: (reason: any) => any) {
    return this.execute().then(resolve, reject)
  }
}

export function createMockSupabaseClient() {
  return {
    from: (table: string) => new MockQueryBuilder(table),
    rpc: async (fn: string, params: any) => {
      if (fn === "deduct_order_inventory") {
        return { data: { success: true }, error: null }
      }
      return { data: null, error: null }
    },
    channel: (channelName: string) => {
      const channelObj = {
        on: (event: string, filter: any, callback: (payload: any) => void) => {
          const key = filter?.table || event
          if (!realtimeListeners.has(key)) {
            realtimeListeners.set(key, new Set())
          }
          realtimeListeners.get(key)!.add(callback)
          return channelObj
        },
        subscribe: (cb?: (status: string) => void) => {
          if (cb) setTimeout(() => cb("SUBSCRIBED"), 10)
          return channelObj
        },
      }
      return channelObj
    },
    removeChannel: async () => "ok",
    auth: {
      getUser: async () => {
        const session = await getBrowserSession()
        const user = session?.user || {
          id: "demo-cashier-id",
          email: "cashier@posdemo.com",
        }
        return {
          data: {
            user: {
              ...user,
              role: session?.role || "cashier",
              app_metadata: { role: session?.role || "cashier" },
              user_metadata: { role: session?.role || "cashier" },
              created_at: new Date().toISOString(),
            },
          },
          error: null,
        }
      },
      getSession: async () => {
        const session = await getBrowserSession()
        return {
          data: {
            session: {
              access_token: session?.access_token || "mock-demo-jwt-token",
              expires_at: Math.floor(Date.now() / 1000) + 86400,
              user: session?.user || { id: "demo-cashier-id", email: "cashier@posdemo.com" },
            },
          },
          error: null,
        }
      },
      onAuthStateChange: (cb?: any) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: async () => ({ error: null }),
    },
  } as any
}
