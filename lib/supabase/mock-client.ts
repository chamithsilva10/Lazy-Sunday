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
import { getBrowserSession } from "./client"
import { SYSTEM_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "../rbac/permissions"

// Local in-memory caches
let localProducts: MockProduct[] = MOCK_PRODUCTS.map((p) => ({
  ...p,
  active: true,
  is_active: true,
  is_archived: false,
}))

let localCategories: MockCategory[] = [...MOCK_CATEGORIES]
let localTables: MockTable[] = [...MOCK_TABLES]
let localOrders: MockOrder[] = [...MOCK_HISTORICAL_ORDERS]
let localSessions: any[] = []
let localReservations: any[] = []

const TABLE_STORAGE_KEYS: Record<string, string> = {
  pos_products: "pos_shared_products",
  pos_categories: "pos_shared_categories",
  pos_tables: "pos_shared_tables",
  pos_orders: "pos_shared_orders",
  table_sessions: "pos_shared_sessions",
  reservations: "pos_shared_bookings",
  customers: "pos_shared_customers",
  coffee_bills: "pos_coffee_bills",
  coffee_products: "pos_shared_products",
  ingredients: "pos_shared_ingredients",
  ingredient_categories: "pos_shared_ingredient_categories",
  recipe_items: "pos_shared_recipes",
  inventory_movements: "pos_shared_movements",
  purchases: "pos_shared_purchases",
  wastage: "pos_shared_wastage",
  stock_adjustments: "pos_shared_adjustments",
  expenses: "pos_shared_expenses",
  app_users: "pos_app_users",
  roles: "pos_roles",
}

const DEFAULT_MOCK_ROLES = [
  { id: "admin", name: "Admin", is_system: true, permissions: DEFAULT_ROLE_PERMISSIONS.admin || [] },
  { id: "manager", name: "Manager", is_system: true, permissions: DEFAULT_ROLE_PERMISSIONS.manager || [] },
  { id: "cashier", name: "Cashier", is_system: true, permissions: DEFAULT_ROLE_PERMISSIONS.cashier || [] },
  { id: "kitchen", name: "Kitchen", is_system: true, permissions: DEFAULT_ROLE_PERMISSIONS.kitchen || [] },
  { id: "bar", name: "Bar", is_system: true, permissions: DEFAULT_ROLE_PERMISSIONS.bar || [] },
]

const DEFAULT_MOCK_USERS = [
  { id: "usr-admin-1", username: "admin", full_name: "Alexa Pheloung", email: "admin@posdemo.com", role_id: "admin", is_active: true },
  { id: "usr-manager-1", username: "manager", full_name: "Elena Rostova", email: "manager@posdemo.com", role_id: "manager", is_active: true },
  { id: "usr-cashier-1", username: "cashier", full_name: "Alex Rivera", email: "cashier@posdemo.com", role_id: "cashier", is_active: true },
  { id: "usr-kitchen-1", username: "kitchen", full_name: "Chef Marco Silva", email: "kitchen@posdemo.com", role_id: "kitchen", is_active: true },
  { id: "usr-bar-1", username: "bar", full_name: "Barista Sam", email: "bar@posdemo.com", role_id: "bar", is_active: true },
]

function getTableData(tableName: string): any[] {
  const key = TABLE_STORAGE_KEYS[tableName]
  if (key && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          if (tableName === "recipe_items") {
            const flattened: any[] = []
            Object.entries(parsed).forEach(([productId, items]: [string, any]) => {
              if (Array.isArray(items)) {
                items.forEach((it) => flattened.push({ ...it, product_id: productId }))
              }
            })
            if (flattened.length > 0) return flattened
          }
        }
      }
    } catch {}
  }

  // Fallbacks from in-memory / mock seeds:
  if (tableName === "pos_products") return localProducts
  if (tableName === "pos_categories") return localCategories
  if (tableName === "pos_tables") return localTables
  if (tableName === "pos_orders") return localOrders
  if (tableName === "table_sessions") return localSessions
  if (tableName === "reservations") return localReservations
  if (tableName === "customers") return MOCK_CUSTOMERS
  if (tableName === "app_users") return DEFAULT_MOCK_USERS
  if (tableName === "roles") return DEFAULT_MOCK_ROLES
  if (tableName === "permissions") return SYSTEM_PERMISSIONS
  if (tableName === "role_permissions") {
    const list: any[] = []
    DEFAULT_MOCK_ROLES.forEach((r) => {
      r.permissions.forEach((pCode) => list.push({ role_id: r.id, permission_id: pCode }))
    })
    return list
  }
  return []
}

function setTableData(tableName: string, data: any[]) {
  const key = TABLE_STORAGE_KEYS[tableName]
  if (key && typeof window !== "undefined") {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch {}
  }

  // Update in-memory caches
  if (tableName === "pos_products") localProducts = data
  else if (tableName === "pos_categories") localCategories = data
  else if (tableName === "pos_tables") localTables = data
  else if (tableName === "pos_orders") localOrders = data
  else if (tableName === "table_sessions") localSessions = data
  else if (tableName === "reservations") localReservations = data

  // Notify mock realtime subscribers & DOM event listeners
  if (tableName === "table_sessions") {
    emitMockRealtime("table_sessions", { eventType: "UPDATE", data })
  } else {
    emitMockRealtime(tableName, { eventType: "UPDATE", data })
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("pos_realtime_" + tableName, { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_sync", { detail: { type: tableName, data } }))

      if (tableName === "pos_orders" || tableName === "coffee_bills") {
        window.dispatchEvent(new CustomEvent("pos_orders_updated"))
        window.dispatchEvent(new CustomEvent("pos_realtime_orders", { detail: data }))
      } else if (tableName === "pos_products") {
        window.dispatchEvent(new CustomEvent("pos_products_updated"))
      } else if (tableName === "pos_tables") {
        window.dispatchEvent(new CustomEvent("pos_tables_updated"))
      } else if (tableName === "table_sessions") {
        window.dispatchEvent(new CustomEvent("pos_sessions_updated"))
      } else if (tableName === "reservations") {
        window.dispatchEvent(new CustomEvent("pos_bookings_updated"))
      } else if (tableName === "customers") {
        window.dispatchEvent(new CustomEvent("pos_realtime_customers", { detail: data }))
      } else if (tableName === "ingredients" || tableName === "recipe_items" || tableName === "inventory_movements") {
        window.dispatchEvent(new CustomEvent("pos_realtime_inventory"))
        window.dispatchEvent(new CustomEvent("pos_realtime_ingredients"))
      } else if (tableName === "app_users" || tableName === "roles" || tableName === "role_permissions") {
        window.dispatchEvent(new CustomEvent("pos_realtime_rbac"))
        window.dispatchEvent(new CustomEvent("pos_rbac_sync"))
      }

      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel("pos_realtime_sync")
        bc.postMessage({ type: tableName, data })
        bc.close()
      }
    } catch {}
  }
}

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
  private pendingUpdate: any = null
  private pendingDelete = false

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
    this.filters.push((item) => {
      if (field === "is_archived" && value === false) {
        return item.is_archived !== true
      }
      if ((field === "active" || field === "is_active") && value === true) {
        return item.active !== false && item.is_active !== false
      }
      return item[field] === value
    })
    return this
  }

  neq(field: string, value: any) {
    this.filters.push((item) => {
      if (field === "is_archived" && value === true) {
        return item.is_archived !== true
      }
      return item[field] !== value
    })
    return this
  }

  ilike(field: string, pattern: string) {
    const clean = pattern.replace(/%/g, "").trim().toLowerCase()
    this.filters.push((item) => String(item[field] || "").toLowerCase().includes(clean))
    return this
  }

  or(condition: string) {
    this.filters.push((item) => {
      const parts = condition.split(",")
      return parts.some((p) => {
        const [f, op, val] = p.split(".")
        if (!f || !op) return true
        if (op === "eq") return String(item[f]) === String(val)
        if (op === "ilike") return String(item[f] || "").toLowerCase().includes((val || "").toLowerCase())
        return true
      })
    })
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
    const current = [...getTableData(this.tableName)]
    const newItems: any[] = []

    for (const r of arr) {
      const item: any = { ...r }
      if (!item.id) {
        const prefix =
          this.tableName === "pos_products"
            ? "prod-"
            : this.tableName === "pos_orders"
            ? "ord-"
            : this.tableName === "reservations"
            ? "res-"
            : this.tableName === "table_sessions"
            ? "sess-"
            : "item-"
        item.id = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      }
      if (this.tableName === "pos_products") {
        item.sku = item.sku || `SKU-${Date.now().toString().slice(-4)}`
        item.barcode = item.barcode || `BC-${Date.now().toString().slice(-6)}`
        item.price = Number(item.price || 0)
        item.stock = Number(item.stock || 0)
        item.active = item.active !== false
        item.is_archived = item.is_archived === true
      }
      newItems.push(item)
    }

    const updated = [...newItems, ...current]
    setTableData(this.tableName, updated)
    return { data: Array.isArray(records) ? newItems : newItems[0], error: null }
  }

  async upsert(records: any | any[], options?: { onConflict?: string }) {
    const arr = Array.isArray(records) ? records : [records]
    const conflict = options?.onConflict || (this.tableName === "pos_orders" ? "order_number" : "id")
    const current = [...getTableData(this.tableName)]

    for (const r of arr) {
      const idx = current.findIndex((item) => {
        if (conflict && item[conflict] && r[conflict]) {
          return String(item[conflict]).toLowerCase() === String(r[conflict]).toLowerCase()
        }
        if (item.id && r.id) {
          return String(item.id) === String(r.id)
        }
        if (item.name && r.name) {
          return String(item.name).trim().toLowerCase() === String(r.name).trim().toLowerCase()
        }
        return false
      })

      if (idx >= 0) {
        current[idx] = { ...current[idx], ...r }
      } else {
        current.unshift(r)
      }
    }

    setTableData(this.tableName, current)
    return { data: Array.isArray(records) ? arr : arr[0], error: null }
  }

  update(updates: any) {
    this.pendingUpdate = updates
    return this
  }

  delete() {
    this.pendingDelete = true
    return this
  }

  private async execute() {
    const current = getTableData(this.tableName)

    if (this.pendingUpdate) {
      const updates = this.pendingUpdate
      let updatedItems: any[] = []
      let matched = false

      const nextList = current.map((item) => {
        const matchFilter = this.filters.length > 0 && this.filters.every((f) => f(item))
        const matchId = updates.id && item.id === updates.id
        const matchName = updates.name && item.name && item.name.trim().toLowerCase() === String(updates.name).trim().toLowerCase()

        if (this.filters.length === 0 || matchFilter || matchId || matchName) {
          matched = true
          const up = { ...item, ...updates }
          updatedItems.push(up)
          return up
        }
        return item
      })

      if (!matched && updates.name && this.tableName === "pos_products") {
        const newItem: MockProduct = {
          id: updates.id || `prod-${Date.now()}`,
          name: updates.name,
          sku: updates.sku || `SKU-${Date.now().toString().slice(-4)}`,
          barcode: updates.barcode || `BC-${Date.now().toString().slice(-6)}`,
          price: Number(updates.price || 0),
          cost_price: Number(updates.cost_price || updates.cost || 0),
          stock: Number(updates.stock || 0),
          category: updates.category || "General",
          category_id: updates.category_id || "cat-1",
          station: updates.station || "kitchen",
          department: updates.department || "Juice & Food",
          image: updates.image || "/placeholder.svg",
          description: updates.description || "",
          active: updates.active !== false && updates.is_active !== false,
          is_archived: updates.is_archived === true,
        }
        nextList.unshift(newItem)
        updatedItems.push(newItem)
      }

      setTableData(this.tableName, nextList)
      return { data: updatedItems.length > 0 ? updatedItems : [updates], error: null }
    }

    if (this.pendingDelete) {
      const remaining = current.filter((item) => !this.filters.every((f) => f(item)))
      setTableData(this.tableName, remaining)
      return { data: null, error: null }
    }

    let filtered = current.filter((item) => this.filters.every((f) => f(item)))

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
    rpc: async (fn: string, _params: any) => {
      if (fn === "deduct_order_inventory") {
        return { data: { success: true }, error: null }
      }
      return { data: null, error: null }
    },
    channel: (_channelName: string) => {
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
      onAuthStateChange: (_cb?: any) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: async () => ({ error: null }),
    },
  } as any
}
