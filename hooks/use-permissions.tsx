"use client"

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react"

export interface UserSession {
  id: string
  username: string
  full_name: string
  email?: string
}

export interface PermissionsContextType {
  user: UserSession | null
  role: string
  permissions: string[]
  loading: boolean
  hasPermission: (permission: string | string[]) => boolean
  canAccessView: (view: string) => boolean
  refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType>({
  user: null,
  role: "cashier",
  permissions: [],
  loading: true,
  hasPermission: () => false,
  canAccessView: () => false,
  refreshPermissions: async () => {},
})

// Mapping between main views and required permissions
const VIEW_PERMISSION_MAP: Record<string, string[]> = {
  POS: ["orders.create", "products.view"],
  Orders: ["orders.view"],
  Tables: ["orders.view", "orders.create"],
  Inventory: ["inventory.view"],
  Products: ["products.view"],
  Kitchen: ["kitchen.view"],
  Bar: ["kitchen.view"],
  Reports: ["reports.view"],
  Customers: ["customers.view", "orders.view"],
  CoffeeProducts: ["products.view"],
  CoffeeBill: ["orders.create", "payments.process"],
  CoffeeReport: ["reports.view"],
  Users: ["users.manage"],
  Roles: ["roles.manage"],
  Audit: ["roles.manage"],
  UserGuide: [],
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null)
  const [role, setRole] = useState<string>("admin")
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" })
      if (!response.ok) {
        setLoading(false)
        return
      }
      const data = await response.json()
      if (data.user) {
        setUser({
          id: data.user.id,
          username: data.user.username || data.user.email?.split("@")[0] || "staff",
          full_name: data.user.full_name || data.user.username || "Staff Member",
          email: data.user.email,
        })
      }
      if (data.role) setRole(data.role)
      if (Array.isArray(data.permissions)) {
        setPermissions(data.permissions)
      }
    } catch (err) {
      console.warn("Failed to fetch RBAC session", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSession()

    const handleSync = () => {
      void fetchSession()
    }

    let bc: BroadcastChannel | null = null
    if (typeof window !== "undefined") {
      window.addEventListener("pos_realtime_rbac", handleSync)
      window.addEventListener("pos_rbac_sync", handleSync)
      try {
        if ("BroadcastChannel" in window) {
          bc = new BroadcastChannel("pos_realtime_sync")
          bc.onmessage = (event) => {
            const { type } = event.data || {}
            if (type === "rbac" || type === "users" || type === "roles") {
              void fetchSession()
            }
          }
        }
      } catch {}
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("pos_realtime_rbac", handleSync)
        window.removeEventListener("pos_rbac_sync", handleSync)
      }
      if (bc) {
        try {
          bc.close()
        } catch {}
      }
    }
  }, [fetchSession])

  const hasPermission = useCallback(
    (permission: string | string[]): boolean => {
      if (role === "admin" || permissions.includes("*")) return true
      if (Array.isArray(permission)) {
        return permission.some((p) => permissions.includes(p))
      }
      return permissions.includes(permission)
    },
    [role, permissions]
  )

  const canAccessView = useCallback(
    (view: string): boolean => {
      if (role === "admin" || permissions.includes("*")) return true
      const required = VIEW_PERMISSION_MAP[view]
      if (!required || required.length === 0) return true
      return required.some((perm) => permissions.includes(perm))
    },
    [role, permissions]
  )

  return (
    <PermissionsContext.Provider
      value={{
        user,
        role,
        permissions,
        loading,
        hasPermission,
        canAccessView,
        refreshPermissions: fetchSession,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  return useContext(PermissionsContext)
}
