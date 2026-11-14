export interface Permission {
  id: string
  code: string
  module: string
  name: string
  description: string
}

export interface Role {
  id: string
  name: string
  description?: string
  is_system: boolean
  permissions: string[] // array of permission codes/ids
  user_count?: number
  created_at?: string
  updated_at?: string
}

export interface AppUser {
  id: string
  username: string
  full_name: string
  email?: string
  password_hash?: string
  role_id: string
  role?: Role
  is_active: boolean
  last_login_at?: string | null
  created_at?: string
  updated_at?: string
}

export const PERMISSION_MODULES = [
  "Orders",
  "Payments",
  "Kitchen",
  "Products",
  "Inventory",
  "Reports",
  "Customers & CRM",
  "Expenses",
  "Users & Roles",
  "Settings",
] as const

export type PermissionModule = typeof PERMISSION_MODULES[number]

export const SYSTEM_PERMISSIONS: Permission[] = [
  // Orders Module
  {
    id: "orders.create",
    code: "orders.create",
    module: "Orders",
    name: "Create Orders",
    description: "Initiate new dine-in, takeaway, and coffee orders",
  },
  {
    id: "orders.view",
    code: "orders.view",
    module: "Orders",
    name: "View Orders",
    description: "Browse historical and active customer order records",
  },
  {
    id: "orders.edit",
    code: "orders.edit",
    module: "Orders",
    name: "Edit Orders",
    description: "Modify line items, quantities, or tables on open tabs",
  },
  {
    id: "orders.cancel",
    code: "orders.cancel",
    module: "Orders",
    name: "Cancel Orders",
    description: "Cancel active unpaid orders and release dining tables",
  },
  {
    id: "orders.refund",
    code: "orders.refund",
    module: "Orders",
    name: "Refund Orders",
    description: "Authorize and process customer transaction refunds",
  },

  // Payments Module
  {
    id: "payments.process",
    code: "payments.process",
    module: "Payments",
    name: "Process Payment",
    description: "Accept cash, card, and QR payments to close bills",
  },
  {
    id: "payments.discount",
    code: "payments.discount",
    module: "Payments",
    name: "Apply Discounts",
    description: "Authorize promotional or staff discounts on bills",
  },
  {
    id: "payments.receipt",
    code: "payments.receipt",
    module: "Payments",
    name: "Print Receipts",
    description: "Generate customer receipts and tax invoices",
  },

  // Kitchen Module
  {
    id: "kitchen.view",
    code: "kitchen.view",
    module: "Kitchen",
    name: "View Kitchen Queue",
    description: "Access KOT/BOT live queues and active prep tickets",
  },
  {
    id: "kitchen.update_status",
    code: "kitchen.update_status",
    module: "Kitchen",
    name: "Update Order Status",
    description: "Advance tickets to Preparing, Ready, and Served",
  },

  // Products Module
  {
    id: "products.view",
    code: "products.view",
    module: "Products",
    name: "View Products",
    description: "Browse catalog items, pricing, and menu categories",
  },
  {
    id: "products.create",
    code: "products.create",
    module: "Products",
    name: "Create Products",
    description: "Add new beverages, dishes, and merchandise",
  },
  {
    id: "products.edit",
    code: "products.edit",
    module: "Products",
    name: "Edit Products",
    description: "Update prices, descriptions, and category tags",
  },
  {
    id: "products.delete",
    code: "products.delete",
    module: "Products",
    name: "Delete Products",
    description: "Archive or permanently delete products from menu",
  },

  // Inventory Module
  {
    id: "inventory.view",
    code: "inventory.view",
    module: "Inventory",
    name: "View Inventory",
    description: "Inspect ingredient levels and stock valuations",
  },
  {
    id: "inventory.update",
    code: "inventory.update",
    module: "Inventory",
    name: "Update Inventory",
    description: "Log stock receipts, spoilage, and stocktakes",
  },

  // Reports Module
  {
    id: "reports.view",
    code: "reports.view",
    module: "Reports",
    name: "View Reports",
    description: "Analyze daily sales, category breakdowns, and revenue",
  },
  {
    id: "reports.export",
    code: "reports.export",
    module: "Reports",
    name: "Export Reports",
    description: "Download CSV and PDF reports for bookkeeping",
  },

  // Users & Roles Module
  {
    id: "users.manage",
    code: "users.manage",
    module: "Users & Roles",
    name: "Manage Users",
    description: "Create, edit, deactivate, and delete staff accounts",
  },
  {
    id: "roles.manage",
    code: "roles.manage",
    module: "Users & Roles",
    name: "Manage Roles",
    description: "Create custom roles and customize permission matrices",
  },

  // Settings Module
  {
    id: "settings.view",
    code: "settings.view",
    module: "Settings",
    name: "View Settings",
    description: "Inspect business profile, tax rates, and peripherals",
  },
  {
    id: "settings.edit",
    code: "settings.edit",
    module: "Settings",
    name: "Edit Settings",
    description: "Configure tax rules, service charges, and system preferences",
  },

  // Customers & CRM Module
  {
    id: "customers.view",
    code: "customers.view",
    module: "Customers & CRM",
    name: "View Customers",
    description: "Access customer database, points balance, and purchase history",
  },
  {
    id: "customers.manage",
    code: "customers.manage",
    module: "Customers & CRM",
    name: "Manage Customers & Credit",
    description: "Create profiles, issue promo codes, and settle customer credit",
  },

  // Expenses Module
  {
    id: "expenses.manage",
    code: "expenses.manage",
    module: "Expenses",
    name: "Manage Expenses",
    description: "Log operational expenditures, utility bills, and supplier payments",
  },
]

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: SYSTEM_PERMISSIONS.map((p) => p.code),
  manager: SYSTEM_PERMISSIONS.map((p) => p.code).filter((c) => c !== "roles.manage"),
  cashier: [
    "orders.create",
    "orders.view",
    "payments.process",
    "payments.receipt",
    "products.view",
    "customers.view",
    "customers.manage",
    "expenses.manage",
  ],
  kitchen: [
    "kitchen.view",
    "kitchen.update_status",
  ],
  staff: [
    "orders.view",
    "products.view",
  ],
}

// ============================================================================
// CANONICAL ROLES & NORMALIZATION
// ============================================================================
export type CanonicalRole = "admin" | "manager" | "cashier" | "kitchen" | "staff" | "viewer"

/**
 * Normalizes any role identifier, database ID (e.g. 'role-admin'),
 * display label, or raw string into a canonical lowercase role slug.
 */
export function normalizeRole(raw?: string | null): CanonicalRole {
  if (!raw) return "cashier"
  const clean = String(raw).trim().toLowerCase()
  if (
    clean === "admin" ||
    clean === "role-admin" ||
    clean === "role_admin" ||
    clean === "administrator" ||
    clean.startsWith("role-admin") ||
    clean.startsWith("role_admin") ||
    clean.includes("admin")
  ) {
    return "admin"
  }
  if (
    clean === "manager" ||
    clean === "role-manager" ||
    clean === "role_manager" ||
    clean.startsWith("role-manager") ||
    clean.includes("manager")
  ) {
    return "manager"
  }
  if (
    clean === "cashier" ||
    clean === "role-cashier" ||
    clean === "role_cashier" ||
    clean.startsWith("role-cashier") ||
    clean.includes("cashier")
  ) {
    return "cashier"
  }
  if (
    clean === "kitchen" ||
    clean === "role-kitchen" ||
    clean === "role_kitchen" ||
    clean.startsWith("role-kitchen") ||
    clean.includes("kitchen") ||
    clean.includes("chef")
  ) {
    return "kitchen"
  }
  if (
    clean === "staff" ||
    clean === "role-staff" ||
    clean === "role_staff" ||
    clean.startsWith("role-staff") ||
    clean.includes("staff") ||
    clean.includes("waiter")
  ) {
    return "staff"
  }
  if (
    clean === "viewer" ||
    clean === "guest" ||
    clean === "anonymous" ||
    clean === "unauthorized" ||
    clean.includes("viewer") ||
    clean.includes("guest")
  ) {
    return "viewer"
  }
  const stripped = clean.replace(/^role[-_]/, "")
  if (stripped === "admin") return "admin"
  if (stripped === "manager") return "manager"
  if (stripped === "cashier") return "cashier"
  if (stripped === "kitchen") return "kitchen"
  if (stripped === "staff") return "staff"
  if (stripped === "viewer") return "viewer"
  return "viewer"
}

/**
 * Formats a clean human-readable title for a role (e.g. "Admin", "Manager").
 * Never displays raw database IDs like "Role-admin".
 */
export function getRoleDisplayName(raw?: string | null): string {
  const norm = normalizeRole(raw)
  return norm.charAt(0).toUpperCase() + norm.slice(1)
}

// ============================================================================
// CENTRALIZED CAPABILITY CHECKS
// ============================================================================

/**
 * Determines whether a user has permission to add, edit, or delete products.
 * Admin, manager, and cashier roles have product management permission in POS,
 * as well as any user with specific product management permissions or wildcard.
 */
export function canManageProducts(role?: string | null, permissions: string[] = []): boolean {
  const norm = normalizeRole(role)
  if (norm === "admin" || norm === "manager" || norm === "cashier") return true
  if (
    permissions.includes("*") ||
    permissions.includes("products.create") ||
    permissions.includes("products.edit") ||
    permissions.includes("products.manage") ||
    permissions.includes("products.delete")
  ) {
    return true
  }
  return false
}

/**
 * Determines whether a user has permission to add categories.
 */
export function canManageCategories(role?: string | null, permissions: string[] = []): boolean {
  const norm = normalizeRole(role)
  if (norm === "admin" || norm === "manager" || norm === "cashier") return true
  if (
    permissions.includes("*") ||
    permissions.includes("products.create") ||
    permissions.includes("products.manage")
  ) {
    return true
  }
  return false
}

/**
 * Determines whether a user has permission to configure dining tables.
 */
export function canManageTables(role?: string | null, permissions: string[] = []): boolean {
  const norm = normalizeRole(role)
  if (norm === "admin" || norm === "manager") return true
  if (
    permissions.includes("*") ||
    permissions.includes("tables.manage") ||
    permissions.includes("orders.cancel")
  ) {
    return true
  }
  return false
}

/**
 * Determines whether a user can adjust stock levels.
 */
export function canAdjustStock(role?: string | null, permissions: string[] = []): boolean {
  const norm = normalizeRole(role)
  if (norm === "admin" || norm === "manager" || norm === "cashier") return true
  if (
    permissions.includes("*") ||
    permissions.includes("inventory.update") ||
    permissions.includes("inventory.view")
  ) {
    return true
  }
  return false
}

/**
 * Determines whether a user can manage staff accounts.
 */
export function canManageUsers(role?: string | null, permissions: string[] = []): boolean {
  const norm = normalizeRole(role)
  if (norm === "admin") return true
  if (permissions.includes("*") || permissions.includes("users.manage")) return true
  return false
}

/**
 * Determines whether a user can configure RBAC roles and permissions.
 */
export function canManageRoles(role?: string | null, permissions: string[] = []): boolean {
  const norm = normalizeRole(role)
  if (norm === "admin") return true
  if (permissions.includes("*") || permissions.includes("roles.manage")) return true
  return false
}

