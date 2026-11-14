"use client"

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react"
import {
  CanonicalRole,
  canAdjustStock,
  canManageCategories,
  canManageProducts,
  canManageRoles,
  canManageTables,
  canManageUsers,
  getRoleDisplayName,
  normalizeRole,
} from "@/lib/rbac/permissions"

export interface UserSession {
  id: string
  username: string
  full_name: string
  email?: string
}

export interface PermissionsContextType {
  user: UserSession | null
  role: CanonicalRole
  rawRole: string
  roleLabel: string
  permissions: string[]
  loading: boolean
  isAuthenticated: boolean
  hasPermission: (permission: string | string[]) => boolean
  canAccessView: (view: string) => boolean
  canManageProducts: boolean
  canManageCategories: boolean
  canManageTables: boolean
  canAdjustStock: boolean
  canManageUsers: boolean
  canManageRoles: boolean
  refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType>({
  user: null,
  role: "cashier",
  rawRole: "cashier",
  roleLabel: "Cashier",
  permissions: [],
  loading: true,
  isAuthenticated: false,
  hasPermission: () => false,
  canAccessView: () => false,
  canManageProducts: false,
  canManageCategories: false,
  canManageTables: false,
  canAdjustStock: false,
  canManageUsers: false,
  canManageRoles: false,
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
  const [user, setUser] = useState<UserSession | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("pos_cached_user")
        if (cached) return JSON.parse(cached)
      } catch {}
    }
    return null
  })

  // Least privilege default until server verifies identity, preserving cached role on reload
  const [role, setRole] = useState<CanonicalRole>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("pos_cached_role")
        if (cached) return normalizeRole(cached)
      } catch {}
    }
    return "cashier"
  })

  const [rawRole, setRawRole] = useState<string>("cashier")
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" })
      if (response.status === 401 || response.status === 403) {
        setUser(null)
        setRole("cashier")
        setRawRole("cashier")
        setPermissions([])
        setIsAuthenticated(false)
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("pos_cached_role")
            localStorage.removeItem("pos_cached_user")
          } catch {}
        }
        setLoading(false)
        return
      }

      if (!response.ok) {
        // Transient network or server error: do not revoke existing state
        setLoading(false)
        return
      }

      const data = await response.json()
      if (data.authenticated === false) {
        setUser(null)
        setRole("cashier")
        setRawRole("cashier")
        setPermissions([])
        setIsAuthenticated(false)
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("pos_cached_role")
            localStorage.removeItem("pos_cached_user")
          } catch {}
        }
        setLoading(false)
        return
      }

      if (data.user) {
        const userObj: UserSession = {
          id: data.user.id,
          username: data.user.username || data.user.email?.split("@")[0] || "staff",
          full_name: data.user.full_name || data.user.username || "Staff Member",
          email: data.user.email,
        }
        setUser(userObj)
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("pos_cached_user", JSON.stringify(userObj))
          } catch {}
        }
      }

      const canonical = normalizeRole(data.role || data.role_id)
      setRole(canonical)
      setRawRole(data.role || data.role_id || canonical)
      setIsAuthenticated(true)

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("pos_cached_role", canonical)
        } catch {}
      }

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
      const norm = normalizeRole(role)
      if (norm === "admin" || permissions.includes("*")) return true
      if (Array.isArray(permission)) {
        return permission.some((p) => permissions.includes(p))
      }
      return permissions.includes(permission)
    },
    [role, permissions]
  )

  const canAccessView = useCallback(
    (view: string): boolean => {
      const norm = normalizeRole(role)
      if (norm === "admin" || permissions.includes("*")) return true
      const required = VIEW_PERMISSION_MAP[view]
      if (!required || required.length === 0) return true
      return required.some((perm) => permissions.includes(perm))
    },
    [role, permissions]
  )

  const roleLabel = useMemo(() => getRoleDisplayName(role), [role])
  const canManageProductsVal = useMemo(() => canManageProducts(role, permissions), [role, permissions])
  const canManageCategoriesVal = useMemo(() => canManageCategories(role, permissions), [role, permissions])
  const canManageTablesVal = useMemo(() => canManageTables(role, permissions), [role, permissions])
  const canAdjustStockVal = useMemo(() => canAdjustStock(role, permissions), [role, permissions])
  const canManageUsersVal = useMemo(() => canManageUsers(role, permissions), [role, permissions])
  const canManageRolesVal = useMemo(() => canManageRoles(role, permissions), [role, permissions])

  return (
    <PermissionsContext.Provider
      value={{
        user,
        role,
        rawRole,
        roleLabel,
        permissions,
        loading,
        isAuthenticated,
        hasPermission,
        canAccessView,
        canManageProducts: canManageProductsVal,
        canManageCategories: canManageCategoriesVal,
        canManageTables: canManageTablesVal,
        canAdjustStock: canAdjustStockVal,
        canManageUsers: canManageUsersVal,
        canManageRoles: canManageRolesVal,
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
