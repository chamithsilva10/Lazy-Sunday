export type InventoryDimension = "weight" | "volume" | "count"
export type BaseUnit = "g" | "ml" | "pcs"
export type InventoryRole = "admin" | "manager" | "cashier"

export type Ingredient = {
  id: string
  sku?: string | null
  name: string
  category_id?: string | null
  category_name?: string | null
  dimension: InventoryDimension
  base_unit: BaseUnit
  default_purchase_unit: string
  current_stock_base: number
  par_level_base: number
  reorder_level_base: number
  reorder_qty_base: number
  avg_cost_per_base_minor?: number | null
  last_cost_per_base_minor?: number | null
  is_perishable?: boolean
  expiry_date?: string | null
  supplier_id?: string | null
  is_active?: boolean
  is_archived?: boolean
  version?: number
}

export type InventoryEnvelope<T> = { success: boolean; code?: string; message?: string; data: T }
export type InventoryStatus = "ok" | "low" | "critical" | "out" | "expiring"
export type StockMovement = { id: string; ingredient_id: string; type: string; qty_base: number; reason?: string | null; created_at: string; actor?: string | null; ref_type?: string | null; ref_id?: string | null }
export type Purchase = { id: string; supplier_id?: string | null; purchased_at: string; invoice_no?: string | null; total_minor: number; status: "draft" | "posted" | "voided"; supplier_name?: string | null }

export function inventoryStatus(item: Ingredient): InventoryStatus {
  if (item.current_stock_base <= 0) return "out"
  if (item.expiry_date && new Date(item.expiry_date).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 3) return "expiring"
  if (item.current_stock_base <= item.reorder_level_base * 0.5) return "critical"
  if (item.current_stock_base <= item.reorder_level_base) return "low"
  return "ok"
}

export function canViewCosts(role: InventoryRole) { return role === "admin" || role === "manager" }
export function canManageStock(role: InventoryRole) { return role === "admin" || role === "manager" }
export function canEditRecipes(role: InventoryRole) { return role === "admin" }
