"use client"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { resolveProductImage, PRODUCT_IMAGE_MAP } from "@/lib/product-images"
import { determineItemStation } from "@/lib/station-routing"

export interface SharedTable {
  id: string
  name: string
  capacity: number
  status: "available" | "occupied" | "cleaning" | "reserved" | "bill_requested"
  department?: "Juice & Food" | "Coffee Bar"
  orderNumber?: string
  orderTotal?: number
  guestName?: string
  occupiedAt?: string
  releasedAt?: string
  bookingId?: string
}

export interface SharedBooking {
  id: string
  customer_name: string
  phone: string
  party_size: number
  reserved_for: string
  duration_minutes: number
  table_id?: string
  table_name: string
  status: "pending" | "confirmed" | "arrived" | "seated" | "completed" | "cancelled" | "no_show"
  special_requests?: string
  source?: string
  created_at?: string
}

export interface SharedSession {
  id: string
  table_id: string
  table_name: string
  customer_name: string
  phone?: string | null
  guest_count: number
  seated_at: string
  status: "open" | "bill_requested" | "closed"
  notes?: string
}

export interface SharedCategory {
  id: string
  name: string
  sort_order?: number
}

export interface SharedProduct {
  id: string
  name: string
  price: number
  category: string
  category_id?: string
  image: string
  stock: number
  description?: string
  temperature?: "hot" | "iced" | "none"
  dietary_tags?: string[]
  department?: string
  station?: "kitchen" | "bar" | "none"
  active?: boolean
  is_archived?: boolean
  user_customized?: boolean
  updated_at?: string
}

export interface SharedOrderItem {
  id: string
  name: string
  price: number
  quantity: number
  category?: string
  image?: string
  stock?: number
  department?: string
  station?: "kitchen" | "bar" | "none"
  round?: number
  notes?: string
}

export interface SplitPaymentLine {
  id?: string
  method: "cash" | "card" | "qr" | "bank_transfer" | "credit" | string
  amount: number
  tendered?: number
  change_due?: number
  reference?: string
  customer_id?: string
  customer_name?: string
}

export interface SharedOrder {
  id: string
  order_number: string
  receipt_number: string
  table_name: string
  cashier_name: string
  department?: "Juice & Food" | "Coffee Bar" | string
  items: SharedOrderItem[]
  subtotal: number
  service_charge: number
  service_charge_rate: number
  discount: number
  total: number
  payment_method: "cash" | "card" | "qr" | "transfer" | "bank_transfer" | "credit" | "split" | string
  split_payments?: SplitPaymentLine[]
  cash_received?: number
  change_amount?: number
  status: "open" | "paid" | "completed" | "refunded" | "cancelled" | string
  payment_status?: "paid" | "unpaid" | "refunded" | string
  kitchen_status?: "pending" | "preparing" | "ready" | "served"
  bar_status?: "pending" | "preparing" | "ready" | "served"
  ticket_source?: "coffee_bill"
  created_at: string
  order_type?: "dine_in" | "takeaway" | "delivery"
  delivery_info?: {
    customer_name?: string
    phone?: string
    address?: string
    notes?: string
  }
  customer_id?: string
  customer_name?: string
  promo_code?: string
  bank_reference?: string
  branch_id?: string
  notes?: string
  tax?: number
  action?: string
  idempotency_key?: string
  stock_deducted?: boolean
  offline_ref?: string
}

export interface SharedCustomer {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  notes?: string
  loyalty_points: number
  credit_balance: number
  credit_limit: number
  vip: boolean
  created_at: string
}

export interface SharedCreditTransaction {
  id: string
  customer_id: string
  type: "credit_added" | "payment_received"
  amount: number
  order_id?: string
  reference?: string
  notes?: string
  created_at: string
}

export interface SharedCustomerFeedback {
  id: string
  customer_id?: string
  customer_name: string
  rating: number
  comment: string
  table_name?: string
  order_id?: string
  created_at: string
}

export interface SharedPromoOffer {
  id: string
  code: string
  discount_type: "percentage" | "fixed"
  discount_value: number
  min_spend?: number
  valid_until?: string
  active: boolean
  usage_count: number
}

export interface SharedSupplier {
  id: string
  name: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  category?: string
  payment_terms?: string
  balance_payable?: number
  notes?: string
  created_at: string
}

export interface SharedWastageItem {
  id: string
  item_type: "ingredient" | "product"
  item_id: string
  item_name: string
  quantity: number
  unit: string
  cost_loss: number
  reason: "expired" | "damaged" | "burnt_spilled" | "quality_issue" | "prep_error" | "other"
  reported_by: string
  created_at: string
}

export interface SharedStockAdjustment {
  id: string
  ingredient_id: string
  ingredient_name: string
  previous_stock: number
  new_stock: number
  difference: number
  unit: string
  reason: "physical_count" | "shrinkage" | "supplier_shortfall" | "calibration" | "other"
  adjusted_by: string
  created_at: string
}

export interface SharedExpense {
  id: string
  category: "Rent" | "Utilities" | "Salaries" | "Supplies" | "Maintenance" | "Marketing" | "Gas" | "Other"
  description: string
  amount: number
  payment_method: "cash" | "bank_transfer" | "card"
  paid_to: string
  date: string
  recorded_by: string
  receipt_ref?: string
  created_at: string
}

export interface SharedBranch {
  id: string
  name: string
  code: string
  address: string
  phone: string
  is_main: boolean
}

export interface SharedMovement {
  id: string
  product_id: string
  product_name: string
  department: "Juice & Food" | "Coffee Bar"
  quantity_change: number
  reason: string
  created_at: string
}

export interface SharedIngredientCategory {
  id: string
  name: string
  sort_order?: number
}

export interface SharedIngredient {
  id: string
  name: string
  dimension: "weight" | "volume" | "count"
  base_unit: "g" | "ml" | "pcs"
  default_purchase_unit: string
  current_stock_base: number
  reorder_level_base: number
  category_id: string | null
}

export interface SharedRecipeItem {
  ingredient_id: string
  ingredient_name?: string
  quantity_base: number
  quantity?: number
  unit?: string
}

export const INVENTORY_CONVERSION_FACTORS: Record<string, number> = {
  // Volume (base unit: ml)
  ml: 1,
  milliliter: 1,
  millilitre: 1,
  l: 1000,
  liter: 1000,
  litre: 1000,
  ltr: 1000,
  // Weight (base unit: g)
  g: 1,
  gram: 1,
  gm: 1,
  kg: 1000,
  kilogram: 1000,
  mg: 0.001,
  // Count (base unit: pcs)
  pc: 1,
  pcs: 1,
  piece: 1,
  pieces: 1,
  unit: 1,
  units: 1,
  dozen: 12,
  doz: 12,
  tray: 30,
  pack: 1,
  packs: 1,
  box: 1,
  boxes: 1,
}

export function toBaseUnits(qty: number | string, unit?: string): number {
  const cleanQty =
    typeof qty === "number"
      ? (Number.isFinite(qty) ? qty : 0)
      : Number(String(qty || "").trim().replace(",", ".")) || 0
  const cleanUnit = String(unit || "").toLowerCase().trim()
  const factor = INVENTORY_CONVERSION_FACTORS[cleanUnit] ?? 1
  return cleanQty * factor
}

export function formatStockDisplay(qtyBase: number, baseUnit?: string): string {
  const val = Number(qtyBase) || 0
  const u = String(baseUnit || "").toLowerCase().trim()
  const trim = (n: number) => {
    const rounded = Math.round(n * 100) / 100
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "")
  }
  if (u === "ml" || u === "l" || u === "liter" || u === "litre") {
    if (Math.abs(val) >= 1000) {
      return `${trim(val / 1000)} L`
    }
    return `${trim(val)} ml`
  }
  if (u === "g" || u === "kg") {
    if (Math.abs(val) >= 1000) {
      return `${trim(val / 1000)} kg`
    }
    return `${trim(val)} g`
  }
  return `${trim(val)} ${baseUnit || "pcs"}`
}

export interface SharedPurchaseItem {
  id?: string
  ingredient_id: string
  quantity: number
  unit: string
  quantity_base: number
  unit_price_minor: number
  total_price_minor: number
}

export interface SharedPurchase {
  id: string
  supplier_name?: string | null
  status: "draft" | "posted" | "void"
  total_minor: number
  created_at: string
  purchase_items: SharedPurchaseItem[]
}

const TABLES_KEY = "pos_shared_tables"
const BOOKINGS_KEY = "pos_shared_bookings"
const SESSIONS_KEY = "pos_shared_sessions"
const PRODUCTS_KEY = "pos_shared_products"
const CATEGORIES_KEY = "pos_shared_categories"
const ORDERS_KEY = "pos_shared_orders"
const MOVEMENTS_KEY = "pos_shared_movements"
const INGREDIENTS_KEY = "pos_shared_ingredients"
const INGREDIENT_CATEGORIES_KEY = "pos_shared_ingredient_categories"
const RECIPES_KEY = "pos_shared_recipes"
const PURCHASES_KEY = "pos_shared_purchases"
const CUSTOMERS_KEY = "pos_shared_customers"
const FEEDBACK_KEY = "pos_shared_feedback"
const PROMOS_KEY = "pos_shared_promos"
const SUPPLIERS_KEY = "pos_shared_suppliers"
const WASTAGE_KEY = "pos_shared_wastage"
const ADJUSTMENTS_KEY = "pos_shared_adjustments"
const EXPENSES_KEY = "pos_shared_expenses"
const BRANCHES_KEY = "pos_shared_branches"
const ACTIVE_BRANCH_KEY = "pos_shared_active_branch"
const POLL_MS = 60000

export const DEFAULT_TABLES: SharedTable[] = [
  { id: "tbl-1", name: "Table 1", capacity: 2, status: "available" },
  { id: "tbl-2", name: "Table 2", capacity: 4, status: "available" },
  { id: "tbl-3", name: "Table 3", capacity: 4, status: "available" },
  { id: "tbl-4", name: "Table 4", capacity: 6, status: "available" },
  { id: "tbl-5", name: "Table 5", capacity: 2, status: "available" },
  { id: "tbl-6", name: "Table 6", capacity: 4, status: "available" },
  { id: "tbl-7", name: "Terrace 1", capacity: 2, status: "available" },
  { id: "tbl-8", name: "Terrace 2", capacity: 4, status: "available" },
  { id: "tbl-9", name: "Terrace 3", capacity: 4, status: "available" },
  { id: "tbl-10", name: "Terrace 4", capacity: 6, status: "available" },
  { id: "tbl-11", name: "VIP Lounge", capacity: 8, status: "available" },
  { id: "tbl-12", name: "Bar Counter 1", capacity: 1, status: "available" },
  { id: "tbl-13", name: "Bar Counter 2", capacity: 1, status: "available" },
  { id: "tbl-14", name: "Bar Counter 3", capacity: 1, status: "available" },
]

export const DEFAULT_CATEGORIES: SharedCategory[] = [
  {
    "id": "cat-coffee-hot-drinks",
    "name": "Coffee & Hot Drinks",
    "sort_order": 1
  },
  {
    "id": "cat-cold-drinks",
    "name": "Cold Drinks",
    "sort_order": 2
  },
  {
    "id": "cat-meals",
    "name": "Meals",
    "sort_order": 3
  },
  {
    "id": "cat-salads",
    "name": "Salads",
    "sort_order": 4
  },
  {
    "id": "cat-bakery-desserts",
    "name": "Bakery & Desserts",
    "sort_order": 5
  }
]

export const DEFAULT_INGREDIENT_CATEGORIES: SharedIngredientCategory[] = [
  {
    "id": "ing-cat-coffee-tea",
    "name": "Coffee & Teas",
    "sort_order": 1
  },
  {
    "id": "ing-cat-dairy",
    "name": "Dairy & Alternatives",
    "sort_order": 2
  },
  {
    "id": "ing-cat-beverages",
    "name": "Beverages & Sodas",
    "sort_order": 3
  },
  {
    "id": "ing-cat-produce",
    "name": "Produce & Fresh Herbs",
    "sort_order": 4
  },
  {
    "id": "ing-cat-meat",
    "name": "Meat & Poultry",
    "sort_order": 5
  },
  {
    "id": "ing-cat-bakery-dry",
    "name": "Bakery & Dry Goods",
    "sort_order": 6
  }
]

export const DEFAULT_INGREDIENTS: SharedIngredient[] = [
  {
    "id": "ing-espresso-beans",
    "name": "Espresso Coffee Beans",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 15000,
    "reorder_level_base": 3000,
    "category_id": "ing-cat-coffee-tea"
  },
  {
    "id": "ing-v60-beans",
    "name": "Single Origin V60 Coffee Beans",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 5000,
    "reorder_level_base": 1000,
    "category_id": "ing-cat-coffee-tea"
  },
  {
    "id": "ing-matcha-powder",
    "name": "Ceremonial Matcha Powder",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "g",
    "current_stock_base": 2000,
    "reorder_level_base": 500,
    "category_id": "ing-cat-coffee-tea"
  },
  {
    "id": "ing-cocoa-powder",
    "name": "Artisanal Cocoa / Chocolate",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 5000,
    "reorder_level_base": 1000,
    "category_id": "ing-cat-coffee-tea"
  },
  {
    "id": "ing-black-tea",
    "name": "Ceylon Breakfast Tea Leaves",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 3000,
    "reorder_level_base": 500,
    "category_id": "ing-cat-coffee-tea"
  },
  {
    "id": "ing-green-tea",
    "name": "Green Tea Leaves",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 2000,
    "reorder_level_base": 400,
    "category_id": "ing-cat-coffee-tea"
  },
  {
    "id": "ing-lemongrass-ginger",
    "name": "Dried Lemongrass & Ginger",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 2000,
    "reorder_level_base": 400,
    "category_id": "ing-cat-coffee-tea"
  },
  {
    "id": "ing-chai-spices",
    "name": "Chai Spice Blend",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 2500,
    "reorder_level_base": 500,
    "category_id": "ing-cat-coffee-tea"
  },
  {
    "id": "ing-cow-milk",
    "name": "Fresh Cow Milk",
    "dimension": "volume",
    "base_unit": "ml",
    "default_purchase_unit": "l",
    "current_stock_base": 40000,
    "reorder_level_base": 10000,
    "category_id": "ing-cat-dairy"
  },
  {
    "id": "ing-oat-milk",
    "name": "Oat Milk",
    "dimension": "volume",
    "base_unit": "ml",
    "default_purchase_unit": "l",
    "current_stock_base": 20000,
    "reorder_level_base": 5000,
    "category_id": "ing-cat-dairy"
  },
  {
    "id": "ing-coconut-milk",
    "name": "Coconut Milk",
    "dimension": "volume",
    "base_unit": "ml",
    "default_purchase_unit": "l",
    "current_stock_base": 15000,
    "reorder_level_base": 4000,
    "category_id": "ing-cat-dairy"
  },
  {
    "id": "ing-butter",
    "name": "Salted Butter",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 5000,
    "reorder_level_base": 1500,
    "category_id": "ing-cat-dairy"
  },
  {
    "id": "ing-ice-cream",
    "name": "Vanilla Bean Ice Cream",
    "dimension": "volume",
    "base_unit": "ml",
    "default_purchase_unit": "l",
    "current_stock_base": 8000,
    "reorder_level_base": 2000,
    "category_id": "ing-cat-dairy"
  },
  {
    "id": "ing-cheddar",
    "name": "Aged Cheddar Cheese",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 4000,
    "reorder_level_base": 1000,
    "category_id": "ing-cat-dairy"
  },
  {
    "id": "ing-feta",
    "name": "Feta Cheese",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 3000,
    "reorder_level_base": 800,
    "category_id": "ing-cat-dairy"
  },
  {
    "id": "ing-soda-water",
    "name": "Soda Water",
    "dimension": "volume",
    "base_unit": "ml",
    "default_purchase_unit": "l",
    "current_stock_base": 30000,
    "reorder_level_base": 8000,
    "category_id": "ing-cat-beverages"
  },
  {
    "id": "ing-sozo-pani-dodang",
    "name": "SOZO Pani Dodang & Sea Salt",
    "dimension": "count",
    "base_unit": "pcs",
    "default_purchase_unit": "pcs",
    "current_stock_base": 48,
    "reorder_level_base": 12,
    "category_id": "ing-cat-beverages"
  },
  {
    "id": "ing-sozo-ginger-lemonade",
    "name": "SOZO Ginger Lemonade",
    "dimension": "count",
    "base_unit": "pcs",
    "default_purchase_unit": "pcs",
    "current_stock_base": 48,
    "reorder_level_base": 12,
    "category_id": "ing-cat-beverages"
  },
  {
    "id": "ing-sozo-iced-tea",
    "name": "SOZO Peach & Mango Iced Tea",
    "dimension": "count",
    "base_unit": "pcs",
    "default_purchase_unit": "pcs",
    "current_stock_base": 48,
    "reorder_level_base": 12,
    "category_id": "ing-cat-beverages"
  },
  {
    "id": "ing-sozo-salted-coconut",
    "name": "SOZO Salted Coconut & Lime Sparkling",
    "dimension": "count",
    "base_unit": "pcs",
    "default_purchase_unit": "pcs",
    "current_stock_base": 48,
    "reorder_level_base": 12,
    "category_id": "ing-cat-beverages"
  },
  {
    "id": "ing-sozo-sparkling-water",
    "name": "SOZO Sparkling Water",
    "dimension": "count",
    "base_unit": "pcs",
    "default_purchase_unit": "pcs",
    "current_stock_base": 60,
    "reorder_level_base": 15,
    "category_id": "ing-cat-beverages"
  },
  {
    "id": "ing-king-coconuts",
    "name": "Fresh King Coconuts",
    "dimension": "count",
    "base_unit": "pcs",
    "default_purchase_unit": "pcs",
    "current_stock_base": 35,
    "reorder_level_base": 10,
    "category_id": "ing-cat-produce"
  },
  {
    "id": "ing-limes",
    "name": "Fresh Limes",
    "dimension": "count",
    "base_unit": "pcs",
    "default_purchase_unit": "pcs",
    "current_stock_base": 80,
    "reorder_level_base": 20,
    "category_id": "ing-cat-produce"
  },
  {
    "id": "ing-pineapples",
    "name": "Fresh Pineapples",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 8000,
    "reorder_level_base": 2000,
    "category_id": "ing-cat-produce"
  },
  {
    "id": "ing-mint",
    "name": "Fresh Mint Leaves",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "g",
    "current_stock_base": 1000,
    "reorder_level_base": 300,
    "category_id": "ing-cat-produce"
  },
  {
    "id": "ing-passionfruit",
    "name": "Passionfruit Pulp",
    "dimension": "volume",
    "base_unit": "ml",
    "default_purchase_unit": "l",
    "current_stock_base": 5000,
    "reorder_level_base": 1500,
    "category_id": "ing-cat-produce"
  },
  {
    "id": "ing-mangoes",
    "name": "Ripe Mangoes",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 10000,
    "reorder_level_base": 2500,
    "category_id": "ing-cat-produce"
  },
  {
    "id": "ing-bananas",
    "name": "Fresh Bananas",
    "dimension": "count",
    "base_unit": "pcs",
    "default_purchase_unit": "pcs",
    "current_stock_base": 50,
    "reorder_level_base": 15,
    "category_id": "ing-cat-produce"
  },
  {
    "id": "ing-mushrooms",
    "name": "Button & Oyster Mushrooms",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 4000,
    "reorder_level_base": 1000,
    "category_id": "ing-cat-produce"
  },
  {
    "id": "ing-mixed-greens",
    "name": "Salad Mixed Greens",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 3500,
    "reorder_level_base": 1000,
    "category_id": "ing-cat-produce"
  },
  {
    "id": "ing-karipincha",
    "name": "Fresh Curry Leaves (Karipincha)",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "g",
    "current_stock_base": 800,
    "reorder_level_base": 200,
    "category_id": "ing-cat-produce"
  },
  {
    "id": "ing-bacon",
    "name": "Smoked Bacon Rashers",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 6000,
    "reorder_level_base": 1500,
    "category_id": "ing-cat-meat"
  },
  {
    "id": "ing-chicken",
    "name": "Chicken Breast Fillets",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 8000,
    "reorder_level_base": 2000,
    "category_id": "ing-cat-meat"
  },
  {
    "id": "ing-eggs",
    "name": "Farm Fresh Eggs",
    "dimension": "count",
    "base_unit": "pcs",
    "default_purchase_unit": "pcs",
    "current_stock_base": 120,
    "reorder_level_base": 30,
    "category_id": "ing-cat-meat"
  },
  {
    "id": "ing-sourdough",
    "name": "Sourdough Bread Slices",
    "dimension": "count",
    "base_unit": "pcs",
    "default_purchase_unit": "pcs",
    "current_stock_base": 60,
    "reorder_level_base": 15,
    "category_id": "ing-cat-bakery-dry"
  },
  {
    "id": "ing-hashbrowns",
    "name": "Hashbrown Patties",
    "dimension": "count",
    "base_unit": "pcs",
    "default_purchase_unit": "pcs",
    "current_stock_base": 50,
    "reorder_level_base": 15,
    "category_id": "ing-cat-bakery-dry"
  },
  {
    "id": "ing-fries",
    "name": "French Fries",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 10000,
    "reorder_level_base": 2500,
    "category_id": "ing-cat-bakery-dry"
  },
  {
    "id": "ing-fusilli",
    "name": "Fusilli Pasta",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 5000,
    "reorder_level_base": 1500,
    "category_id": "ing-cat-bakery-dry"
  },
  {
    "id": "ing-chickpeas",
    "name": "Cooked Chickpeas",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 4000,
    "reorder_level_base": 1000,
    "category_id": "ing-cat-bakery-dry"
  },
  {
    "id": "ing-pesto",
    "name": "Basil Pesto Sauce",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 2500,
    "reorder_level_base": 600,
    "category_id": "ing-cat-bakery-dry"
  },
  {
    "id": "ing-peanut-butter",
    "name": "Peanut Butter",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 3000,
    "reorder_level_base": 800,
    "category_id": "ing-cat-bakery-dry"
  },
  {
    "id": "ing-rolled-oats",
    "name": "Rolled Oats",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 5000,
    "reorder_level_base": 1000,
    "category_id": "ing-cat-bakery-dry"
  },
  {
    "id": "ing-choc-chips",
    "name": "Dark Chocolate Chips",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 4000,
    "reorder_level_base": 1000,
    "category_id": "ing-cat-bakery-dry"
  },
  {
    "id": "ing-pancake-mix",
    "name": "Pancake Flour & Batter Mix",
    "dimension": "weight",
    "base_unit": "g",
    "default_purchase_unit": "kg",
    "current_stock_base": 6000,
    "reorder_level_base": 1500,
    "category_id": "ing-cat-bakery-dry"
  }
]

export const DEFAULT_RECIPES: Record<string, SharedRecipeItem[]> = {
  "prod-101": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    }
  ],
  "Ristretto": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    }
  ],
  "prod-102": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    }
  ],
  "Espresso": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    }
  ],
  "prod-103": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    }
  ],
  "Long Black": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    }
  ],
  "prod-104": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 180
    }
  ],
  "Flat White": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 180
    }
  ],
  "prod-105": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 160
    }
  ],
  "Cappuccino": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 160
    }
  ],
  "prod-106": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 220
    }
  ],
  "Latte": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 220
    }
  ],
  "prod-107": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    },
    {
      "ingredient_id": "ing-cocoa-powder",
      "quantity_base": 30
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 200
    }
  ],
  "Mocha": [
    {
      "ingredient_id": "ing-espresso-beans",
      "quantity_base": 18
    },
    {
      "ingredient_id": "ing-cocoa-powder",
      "quantity_base": 30
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 200
    }
  ],
  "prod-108": [
    {
      "ingredient_id": "ing-v60-beans",
      "quantity_base": 15
    }
  ],
  "V60 Pour Over": [
    {
      "ingredient_id": "ing-v60-beans",
      "quantity_base": 15
    }
  ],
  "prod-109": [
    {
      "ingredient_id": "ing-matcha-powder",
      "quantity_base": 5
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 200
    }
  ],
  "Matcha Latte": [
    {
      "ingredient_id": "ing-matcha-powder",
      "quantity_base": 5
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 200
    }
  ],
  "prod-110": [
    {
      "ingredient_id": "ing-cocoa-powder",
      "quantity_base": 40
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 220
    }
  ],
  "Chocolate": [
    {
      "ingredient_id": "ing-cocoa-powder",
      "quantity_base": 40
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 220
    }
  ],
  "prod-111": [
    {
      "ingredient_id": "ing-black-tea",
      "quantity_base": 3
    }
  ],
  "Ceylon Breakfast": [
    {
      "ingredient_id": "ing-black-tea",
      "quantity_base": 3
    }
  ],
  "prod-112": [
    {
      "ingredient_id": "ing-green-tea",
      "quantity_base": 3
    }
  ],
  "Green Tea": [
    {
      "ingredient_id": "ing-green-tea",
      "quantity_base": 3
    }
  ],
  "prod-113": [
    {
      "ingredient_id": "ing-lemongrass-ginger",
      "quantity_base": 4
    }
  ],
  "Ginger & Lemongrass": [
    {
      "ingredient_id": "ing-lemongrass-ginger",
      "quantity_base": 4
    }
  ],
  "prod-114": [
    {
      "ingredient_id": "ing-chai-spices",
      "quantity_base": 4
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 150
    }
  ],
  "Chai": [
    {
      "ingredient_id": "ing-chai-spices",
      "quantity_base": 4
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 150
    }
  ],
  "prod-115": [
    {
      "ingredient_id": "ing-matcha-powder",
      "quantity_base": 5
    },
    {
      "ingredient_id": "ing-mangoes",
      "quantity_base": 120
    }
  ],
  "Mango Matcha": [
    {
      "ingredient_id": "ing-matcha-powder",
      "quantity_base": 5
    },
    {
      "ingredient_id": "ing-mangoes",
      "quantity_base": 120
    }
  ],
  "prod-116": [
    {
      "ingredient_id": "ing-king-coconuts",
      "quantity_base": 1
    }
  ],
  "King Coconut": [
    {
      "ingredient_id": "ing-king-coconuts",
      "quantity_base": 1
    }
  ],
  "prod-117": [
    {
      "ingredient_id": "ing-limes",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-soda-water",
      "quantity_base": 200
    }
  ],
  "House Lime Soda": [
    {
      "ingredient_id": "ing-limes",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-soda-water",
      "quantity_base": 200
    }
  ],
  "prod-118": [
    {
      "ingredient_id": "ing-pineapples",
      "quantity_base": 80
    },
    {
      "ingredient_id": "ing-mint",
      "quantity_base": 5
    },
    {
      "ingredient_id": "ing-soda-water",
      "quantity_base": 180
    }
  ],
  "House Pineapple & Mint Soda": [
    {
      "ingredient_id": "ing-pineapples",
      "quantity_base": 80
    },
    {
      "ingredient_id": "ing-mint",
      "quantity_base": 5
    },
    {
      "ingredient_id": "ing-soda-water",
      "quantity_base": 180
    }
  ],
  "prod-119": [
    {
      "ingredient_id": "ing-passionfruit",
      "quantity_base": 40
    },
    {
      "ingredient_id": "ing-soda-water",
      "quantity_base": 200
    }
  ],
  "Passion Soda": [
    {
      "ingredient_id": "ing-passionfruit",
      "quantity_base": 40
    },
    {
      "ingredient_id": "ing-soda-water",
      "quantity_base": 200
    }
  ],
  "prod-120": [
    {
      "ingredient_id": "ing-mangoes",
      "quantity_base": 150
    },
    {
      "ingredient_id": "ing-bananas",
      "quantity_base": 1
    },
    {
      "ingredient_id": "ing-coconut-milk",
      "quantity_base": 100
    }
  ],
  "Mango Smoothie": [
    {
      "ingredient_id": "ing-mangoes",
      "quantity_base": 150
    },
    {
      "ingredient_id": "ing-bananas",
      "quantity_base": 1
    },
    {
      "ingredient_id": "ing-coconut-milk",
      "quantity_base": 100
    }
  ],
  "prod-121": [
    {
      "ingredient_id": "ing-peanut-butter",
      "quantity_base": 50
    },
    {
      "ingredient_id": "ing-bananas",
      "quantity_base": 1
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 200
    }
  ],
  "Peanut Butter Shake": [
    {
      "ingredient_id": "ing-peanut-butter",
      "quantity_base": 50
    },
    {
      "ingredient_id": "ing-bananas",
      "quantity_base": 1
    },
    {
      "ingredient_id": "ing-cow-milk",
      "quantity_base": 200
    }
  ],
  "prod-122": [
    {
      "ingredient_id": "ing-sozo-pani-dodang",
      "quantity_base": 1
    }
  ],
  "Pani Dodang & Sea Salt": [
    {
      "ingredient_id": "ing-sozo-pani-dodang",
      "quantity_base": 1
    }
  ],
  "prod-123": [
    {
      "ingredient_id": "ing-sozo-ginger-lemonade",
      "quantity_base": 1
    }
  ],
  "Ginger Lemonade": [
    {
      "ingredient_id": "ing-sozo-ginger-lemonade",
      "quantity_base": 1
    }
  ],
  "prod-124": [
    {
      "ingredient_id": "ing-sozo-iced-tea",
      "quantity_base": 1
    }
  ],
  "Peach & Mango Iced Tea": [
    {
      "ingredient_id": "ing-sozo-iced-tea",
      "quantity_base": 1
    }
  ],
  "prod-125": [
    {
      "ingredient_id": "ing-sozo-salted-coconut",
      "quantity_base": 1
    }
  ],
  "Salted Coconut & Lime Sparkling": [
    {
      "ingredient_id": "ing-sozo-salted-coconut",
      "quantity_base": 1
    }
  ],
  "prod-126": [
    {
      "ingredient_id": "ing-sozo-sparkling-water",
      "quantity_base": 1
    }
  ],
  "Sparkling Water": [
    {
      "ingredient_id": "ing-sozo-sparkling-water",
      "quantity_base": 1
    }
  ],
  "prod-127": [
    {
      "ingredient_id": "ing-mushrooms",
      "quantity_base": 150
    },
    {
      "ingredient_id": "ing-sourdough",
      "quantity_base": 2
    }
  ],
  "Creamy Mushrooms": [
    {
      "ingredient_id": "ing-mushrooms",
      "quantity_base": 150
    },
    {
      "ingredient_id": "ing-sourdough",
      "quantity_base": 2
    }
  ],
  "prod-128": [
    {
      "ingredient_id": "ing-bacon",
      "quantity_base": 100
    },
    {
      "ingredient_id": "ing-eggs",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-sourdough",
      "quantity_base": 2
    }
  ],
  "Bacon and Eggs": [
    {
      "ingredient_id": "ing-bacon",
      "quantity_base": 100
    },
    {
      "ingredient_id": "ing-eggs",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-sourdough",
      "quantity_base": 2
    }
  ],
  "prod-129": [
    {
      "ingredient_id": "ing-eggs",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-sourdough",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-karipincha",
      "quantity_base": 5
    }
  ],
  "Sri Lankan Chili Scramble": [
    {
      "ingredient_id": "ing-eggs",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-sourdough",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-karipincha",
      "quantity_base": 5
    }
  ],
  "prod-130": [
    {
      "ingredient_id": "ing-pancake-mix",
      "quantity_base": 150
    },
    {
      "ingredient_id": "ing-butter",
      "quantity_base": 20
    }
  ],
  "Pancakes": [
    {
      "ingredient_id": "ing-pancake-mix",
      "quantity_base": 150
    },
    {
      "ingredient_id": "ing-butter",
      "quantity_base": 20
    }
  ],
  "prod-131": [
    {
      "ingredient_id": "ing-chicken",
      "quantity_base": 180
    },
    {
      "ingredient_id": "ing-sourdough",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-fries",
      "quantity_base": 150
    }
  ],
  "Grilled Chicken Sandwich": [
    {
      "ingredient_id": "ing-chicken",
      "quantity_base": 180
    },
    {
      "ingredient_id": "ing-sourdough",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-fries",
      "quantity_base": 150
    }
  ],
  "prod-132": [
    {
      "ingredient_id": "ing-hashbrowns",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-bacon",
      "quantity_base": 60
    },
    {
      "ingredient_id": "ing-eggs",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-cheddar",
      "quantity_base": 30
    }
  ],
  "Hashbrown-Crust Bacon & Egg Quiche": [
    {
      "ingredient_id": "ing-hashbrowns",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-bacon",
      "quantity_base": 60
    },
    {
      "ingredient_id": "ing-eggs",
      "quantity_base": 2
    },
    {
      "ingredient_id": "ing-cheddar",
      "quantity_base": 30
    }
  ],
  "prod-133": [
    {
      "ingredient_id": "ing-mixed-greens",
      "quantity_base": 120
    }
  ],
  "Roast Vegetable Salad": [
    {
      "ingredient_id": "ing-mixed-greens",
      "quantity_base": 120
    }
  ],
  "prod-134": [
    {
      "ingredient_id": "ing-fusilli",
      "quantity_base": 100
    },
    {
      "ingredient_id": "ing-pesto",
      "quantity_base": 30
    }
  ],
  "Pesto Pasta Salad": [
    {
      "ingredient_id": "ing-fusilli",
      "quantity_base": 100
    },
    {
      "ingredient_id": "ing-pesto",
      "quantity_base": 30
    }
  ],
  "prod-135": [
    {
      "ingredient_id": "ing-chickpeas",
      "quantity_base": 120
    },
    {
      "ingredient_id": "ing-mixed-greens",
      "quantity_base": 60
    }
  ],
  "Chickpea Salad": [
    {
      "ingredient_id": "ing-chickpeas",
      "quantity_base": 120
    },
    {
      "ingredient_id": "ing-mixed-greens",
      "quantity_base": 60
    }
  ],
  "prod-136": [
    {
      "ingredient_id": "ing-feta",
      "quantity_base": 25
    }
  ],
  "Savoury Muffin": [
    {
      "ingredient_id": "ing-feta",
      "quantity_base": 25
    }
  ],
  "prod-137": [
    {
      "ingredient_id": "ing-bananas",
      "quantity_base": 1
    },
    {
      "ingredient_id": "ing-choc-chips",
      "quantity_base": 25
    }
  ],
  "Banana Chocolate Chip Muffin": [
    {
      "ingredient_id": "ing-bananas",
      "quantity_base": 1
    },
    {
      "ingredient_id": "ing-choc-chips",
      "quantity_base": 25
    }
  ],
  "prod-138": [
    {
      "ingredient_id": "ing-butter",
      "quantity_base": 20
    }
  ],
  "Sweet Scone with Tropical Jam & Cream": [
    {
      "ingredient_id": "ing-butter",
      "quantity_base": 20
    }
  ],
  "prod-139": [
    {
      "ingredient_id": "ing-cheddar",
      "quantity_base": 20
    },
    {
      "ingredient_id": "ing-karipincha",
      "quantity_base": 5
    }
  ],
  "Cheese Scone with Karipincha Butter": [
    {
      "ingredient_id": "ing-cheddar",
      "quantity_base": 20
    },
    {
      "ingredient_id": "ing-karipincha",
      "quantity_base": 5
    }
  ],
  "prod-140": [
    {
      "ingredient_id": "ing-rolled-oats",
      "quantity_base": 80
    }
  ],
  "Oaty Ginger Slice": [
    {
      "ingredient_id": "ing-rolled-oats",
      "quantity_base": 80
    }
  ],
  "prod-141": [
    {
      "ingredient_id": "ing-cocoa-powder",
      "quantity_base": 40
    },
    {
      "ingredient_id": "ing-ice-cream",
      "quantity_base": 100
    }
  ],
  "Chocolate Brownie with Ice Cream": [
    {
      "ingredient_id": "ing-cocoa-powder",
      "quantity_base": 40
    },
    {
      "ingredient_id": "ing-ice-cream",
      "quantity_base": 100
    }
  ]
}

export const DEFAULT_PRODUCTS: SharedProduct[] = [
  {
    "id": "prod-101",
    "name": "Ristretto",
    "price": 500,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "/uploads/prod_1794637814975_5gmi8.jpg",
    "stock": 45,
    "description": "Short, concentrated espresso extraction with a sweet, rich profile.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-102",
    "name": "Espresso",
    "price": 500,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "/uploads/prod_1794639566380_84t95.jpg",
    "stock": 55,
    "description": "Full-bodied single origin espresso shot with thick golden crema.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-103",
    "name": "Long Black",
    "price": 650,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80",
    "stock": 32,
    "description": "Double shot espresso poured over hot or iced mineral water.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-104",
    "name": "Flat White",
    "price": 750,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80",
    "stock": 28,
    "description": "Velvety textured micro-foam over a double ristretto shot.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-105",
    "name": "Cappuccino",
    "price": 750,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80",
    "stock": 38,
    "description": "Harmonious balance of espresso, steamed milk, and airy foam.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-106",
    "name": "Latte",
    "price": 800,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "/latte-coffee.png",
    "stock": 42,
    "description": "Smooth espresso with gently steamed milk and a light foam cap.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-107",
    "name": "Mocha",
    "price": 950,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=600&q=80",
    "stock": 24,
    "description": "Espresso blended with artisanal dark chocolate and steamed milk.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-108",
    "name": "V60 Pour Over",
    "price": 1100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80",
    "stock": 15,
    "description": "Single-origin pour over filter brew showcasing delicate florals and fruit notes.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-109",
    "name": "Matcha Latte",
    "price": 950,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
    "stock": 19,
    "description": "Ceremonial grade Japanese green tea whisked with silky steamed milk.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-110",
    "name": "Chocolate",
    "price": 900,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=600&q=80",
    "stock": 26,
    "description": "Rich melted cocoa crafted into decadent hot chocolate or iced chocolate.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-111",
    "name": "Ceylon Breakfast",
    "price": 400,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
    "stock": 60,
    "description": "High-grown Nuwara Eliya whole leaf black tea with robust malty character.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-112",
    "name": "Green Tea",
    "price": 450,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=600&q=80",
    "stock": 35,
    "description": "Clean, fresh steamed whole-leaf green tea rich in antioxidants.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-113",
    "name": "Ginger & Lemongrass",
    "price": 450,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80",
    "stock": 28,
    "description": "Soothing natural herbal infusion of sun-dried lemongrass stalks and spicy ginger.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-114",
    "name": "Chai",
    "price": 650,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "image": "https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80",
    "stock": 22,
    "description": "Aromatic black tea brewed with crushed cardamoms, cinnamon, cloves, and milk.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Coffee Bar",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-115",
    "name": "Mango Matcha",
    "price": 1050,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
    "stock": 14,
    "description": "Chilled tropical mango puree layered with iced ceremonial matcha.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-116",
    "name": "King Coconut",
    "price": 450,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80",
    "stock": 18,
    "description": "Naturally sweet, isotonic fresh Sri Lankan thambili water served chilled.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-117",
    "name": "House Lime Soda",
    "price": 650,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    "stock": 30,
    "description": "Freshly squeezed garden lime with bubbly soda water and pure cane syrup.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-118",
    "name": "House Pineapple & Mint Soda",
    "price": 750,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80",
    "stock": 25,
    "description": "Crushed sweet pineapple and muddled garden mint topped with sparkling soda.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-119",
    "name": "Passion Soda",
    "price": 750,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    "stock": 22,
    "description": "Tangy tropical passionfruit pulp, lime, and crisp sparkling soda.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-120",
    "name": "Mango Smoothie",
    "price": 950,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80",
    "stock": 16,
    "description": "Thick, creamy blend of ripe tropical mangoes, banana, and chilled coconut milk.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-121",
    "name": "Peanut Butter Shake",
    "price": 1100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80",
    "stock": 12,
    "description": "Roasted artisanal peanut butter, banana, dairy milk, and dark honey.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-122",
    "name": "Pani Dodang & Sea Salt",
    "price": 750,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "/glass-of-orange-juice.png",
    "stock": 20,
    "description": "Indigenous sweet orange infused with a subtle touch of natural sea salt.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-123",
    "name": "Ginger Lemonade",
    "price": 750,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    "stock": 24,
    "description": "Fiery organic Sri Lankan ginger balanced with zesty lemon and sparkling spring water.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-124",
    "name": "Peach & Mango Iced Tea",
    "price": 800,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "/iced-tea.png",
    "stock": 26,
    "description": "Cold brewed Ceylon black tea with natural orchard peach and luscious mango.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-125",
    "name": "Salted Coconut & Lime Sparkling",
    "price": 800,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80",
    "stock": 15,
    "description": "Refreshing sparkling king coconut nectar with tangy lime and pinch of sea salt.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-126",
    "name": "Sparkling Water",
    "price": 500,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "image": "/bottled-water.png",
    "stock": 45,
    "description": "Pure chilled carbonated mineral spring water with crisp effervescence.",
    "temperature": "iced",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Bar & Beverages",
    "station": "bar",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-127",
    "name": "Creamy Mushrooms",
    "price": 1800,
    "category": "Meals",
    "category_id": "cat-meals",
    "image": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
    "stock": 14,
    "description": "Sautéed button & oyster mushrooms in garlic herb cream, served with Sourdough or Hashbrowns.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Kitchen Meals",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-128",
    "name": "Bacon and Eggs",
    "price": 1900,
    "category": "Meals",
    "category_id": "cat-meals",
    "image": "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
    "stock": 20,
    "description": "Crispy smoked bacon with two eggs (Scrambled / Fried) and choice of Sourdough or Hashbrowns.",
    "temperature": "none",
    "dietary_tags": [],
    "department": "Kitchen Meals",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-129",
    "name": "Sri Lankan Chili Scramble",
    "price": 1750,
    "category": "Meals",
    "category_id": "cat-meals",
    "image": "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
    "stock": 16,
    "description": "Soft eggs scrambled with green chilies, shallots, curry leaves, and toasted sourdough.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Kitchen Meals",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-130",
    "name": "Pancakes",
    "price": 1600,
    "category": "Meals",
    "category_id": "cat-meals",
    "image": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&q=80",
    "stock": 22,
    "description": "Golden buttermilk pancake stack served with fresh tropical fruit, whipped butter, and kithul treacle.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Kitchen Meals",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-131",
    "name": "Grilled Chicken Sandwich",
    "price": 1950,
    "category": "Meals",
    "category_id": "cat-meals",
    "image": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80",
    "stock": 15,
    "description": "Herb-marinated chicken breast, garlic aioli, tomato, and baby greens on sourdough with Fries or Salad.",
    "temperature": "none",
    "dietary_tags": [],
    "department": "Kitchen Meals",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-132",
    "name": "Hashbrown-Crust Bacon & Egg Quiche",
    "price": 1850,
    "category": "Meals",
    "category_id": "cat-meals",
    "image": "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
    "stock": 11,
    "description": "Golden shredded potato crust filled with savory smoked bacon, eggs, and aged cheddar with Fries or Salad.",
    "temperature": "none",
    "dietary_tags": [],
    "department": "Kitchen Meals",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-133",
    "name": "Roast Vegetable Salad",
    "price": 1750,
    "category": "Salads",
    "category_id": "cat-salads",
    "image": "/vibrant-mixed-salad.png",
    "stock": 14,
    "description": "Oven-roasted pumpkin, sweet potato, bell peppers, mixed greens, toasted pumpkin seeds, and balsamic glaze.",
    "temperature": "none",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Kitchen Salads",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-134",
    "name": "Pesto Pasta Salad",
    "price": 1850,
    "category": "Salads",
    "category_id": "cat-salads",
    "image": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80",
    "stock": 18,
    "description": "Fusilli pasta tossed in fresh basil cashew pesto, cherry tomatoes, baby spinach, and parmesan shavings.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Kitchen Salads",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-135",
    "name": "Chickpea Salad",
    "price": 1650,
    "category": "Salads",
    "category_id": "cat-salads",
    "image": "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",
    "stock": 17,
    "description": "Crisp cucumbers, spiced chickpeas, Kalamata olives, fresh herbs, and zesty lemon tahini dressing.",
    "temperature": "none",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "department": "Kitchen Salads",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-136",
    "name": "Savoury Muffin",
    "price": 650,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "image": "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80",
    "stock": 9,
    "description": "Freshly baked savory muffin loaded with baby spinach, sweet corn, and crumbled feta cheese.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Bakery & Desserts",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-137",
    "name": "Banana Chocolate Chip Muffin",
    "price": 600,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "image": "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80",
    "stock": 8,
    "description": "Moist ripe banana muffin baked with dark Belgian chocolate chips and cinnamon crumble.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Bakery & Desserts",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-138",
    "name": "Sweet Scone with Tropical Jam & Cream",
    "price": 650,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    "stock": 12,
    "description": "Traditional butter scone served warm with house-made tropical passion-mango jam and clotted cream.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Bakery & Desserts",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-139",
    "name": "Cheese Scone with Karipincha Butter",
    "price": 650,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    "stock": 10,
    "description": "Golden sharp cheddar cheese scone served with fragrant house-whipped curry leaf (karipincha) butter.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Bakery & Desserts",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-140",
    "name": "Oaty Ginger Slice",
    "price": 750,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    "stock": 16,
    "description": "Toasted rolled oats and golden syrup slice topped with spicy candied ginger icing.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Bakery & Desserts",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  },
  {
    "id": "prod-141",
    "name": "Chocolate Brownie with Ice Cream",
    "price": 850,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "image": "/chocolate-brownie.png",
    "stock": 14,
    "description": "Warm fudgy dark chocolate brownie dusted with cocoa, paired with a scoop of vanilla bean ice cream.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "department": "Bakery & Desserts",
    "station": "kitchen",
    "active": true,
    "is_archived": false
  }
]

export const DEFAULT_INITIAL_ORDERS: SharedOrder[] = []

export const DEFAULT_CUSTOMERS: SharedCustomer[] = []

export const DEFAULT_PROMOS: SharedPromoOffer[] = []

export const DEFAULT_FEEDBACK: SharedCustomerFeedback[] = []

export const DEFAULT_SUPPLIERS: SharedSupplier[] = []

export const DEFAULT_WASTAGE: SharedWastageItem[] = []

export const DEFAULT_ADJUSTMENTS: SharedStockAdjustment[] = []

export const DEFAULT_EXPENSES: SharedExpense[] = []

export const DEFAULT_BRANCHES: SharedBranch[] = [
  {
    id: "branch-hiri-main",
    name: "Beach Front Terminal (Main)",
    code: "TERM-01",
    address: "Beach Road, Main Bay",
    phone: "+94 41 225 8899",
    is_main: true,
  },
  {
    id: "branch-hiri-roastery",
    name: "Coffee Roastery & Espresso Bar",
    code: "ROAST-02",
    address: "Point Road Station",
    phone: "+94 41 225 8890",
    is_main: false,
  },
  {
    id: "branch-mirissa",
    name: "Harbor Lounge & Poke Bar",
    code: "LOUNGE-01",
    address: "Beachfront Harbor",
    phone: "+94 41 227 3344",
    is_main: false,
  },
]

type Listener<T> = (data: T) => void

export function normalizeTableName(str?: string | null): string {
  if (!str) return ""
  let clean = str.trim().toLowerCase()
  clean = clean.replace(/^(dine\s*in\s*[\/-]?\s*)/i, "")
  clean = clean.replace(/\s*\((dine[- ]?in|takeaway)\)\s*$/i, "")
  clean = clean.replace(/^tbl[-_\s]*/i, "table ")
  clean = clean.replace(/^t[-_\s]*(\d+)$/i, "table $1")
  clean = clean.replace(/\btable\s*0+(\d+)\b/i, "table $1")
  return clean.trim()
}

export function tablesMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const normA = normalizeTableName(a)
  const normB = normalizeTableName(b)
  if (normA === normB) return true
  const numA = normA.match(/\d+/)?.[0]
  const numB = normB.match(/\d+/)?.[0]
  if (numA && numB && numA === numB) {
    if (normA.startsWith("table") && normB.startsWith("table")) return true
  }
  return false
}

const isTakeaway = (name?: string) => !name || name.trim().toLowerCase() === "takeaway"
const sameName = (a: string, b: string) => {
  if (!a || !b) return false
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true
  return tablesMatch(a, b)
}

export class SharedPosService {
  private static tablesCache: SharedTable[] = DEFAULT_TABLES.map((t) => ({ ...t }))
  private static bookingsCache: SharedBooking[] = []
  private static sessionsCache: SharedSession[] = []
  private static productsCache: SharedProduct[] = DEFAULT_PRODUCTS.map((p) => ({ ...p }))
  private static categoriesCache: SharedCategory[] = DEFAULT_CATEGORIES.map((c) => ({ ...c }))
  private static ordersCache: SharedOrder[] = []
  private static ingredientsCache: SharedIngredient[] = DEFAULT_INGREDIENTS.map((i) => ({ ...i }))
  private static ingredientCategoriesCache: SharedIngredientCategory[] = DEFAULT_INGREDIENT_CATEGORIES.map((c) => ({ ...c }))
  private static recipesCache: Record<string, SharedRecipeItem[]> = { ...DEFAULT_RECIPES }
  private static purchasesCache: SharedPurchase[] = []
  private static customersCache: SharedCustomer[] = []
  private static promosCache: SharedPromoOffer[] = []
  private static feedbackCache: SharedCustomerFeedback[] = []
  private static suppliersCache: SharedSupplier[] = []
  private static wastageCache: SharedWastageItem[] = []
  private static adjustmentsCache: SharedStockAdjustment[] = []
  private static expensesCache: SharedExpense[] = []
  private static branchesCache: SharedBranch[] = []
  private static activeBranchId: string = "branch-hiri-main"

  private static tableListeners = new Set<Listener<SharedTable[]>>()
  private static bookingListeners = new Set<Listener<SharedBooking[]>>()
  private static sessionListeners = new Set<Listener<SharedSession[]>>()
  private static productListeners = new Set<Listener<SharedProduct[]>>()
  private static categoryListeners = new Set<Listener<SharedCategory[]>>()
  private static orderListeners = new Set<Listener<SharedOrder[]>>()
  private static ingredientListeners = new Set<Listener<SharedIngredient[]>>()
  private static ingredientCategoryListeners = new Set<Listener<SharedIngredientCategory[]>>()
  private static recipeListeners = new Set<Listener<Record<string, SharedRecipeItem[]>>>()
  private static purchaseListeners = new Set<Listener<SharedPurchase[]>>()
  private static customerListeners = new Set<Listener<SharedCustomer[]>>()
  private static promoListeners = new Set<Listener<SharedPromoOffer[]>>()
  private static feedbackListeners = new Set<Listener<SharedCustomerFeedback[]>>()
  private static supplierListeners = new Set<Listener<SharedSupplier[]>>()
  private static wastageListeners = new Set<Listener<SharedWastageItem[]>>()
  private static adjustmentListeners = new Set<Listener<SharedStockAdjustment[]>>()
  private static expenseListeners = new Set<Listener<SharedExpense[]>>()
  private static branchListeners = new Set<Listener<SharedBranch[]>>()
  private static isRefreshing = false
  private static lastRefreshTime = 0
  private static isRefreshingApi = false
  private static lastApiRefreshTime = 0
  private static apiRefreshPromise: Promise<void> | null = null

  private static emitCustomers() {
    const data = [...this.customersCache]
    this.customerListeners.forEach((fn) => { try { fn(data) } catch {} })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_customers", { detail: data }))
    }
  }

  private static emitPromos() {
    const data = [...this.promosCache]
    this.promoListeners.forEach((fn) => { try { fn(data) } catch {} })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_promos", { detail: data }))
    }
  }

  private static emitFeedback() {
    const data = [...this.feedbackCache]
    this.feedbackListeners.forEach((fn) => { try { fn(data) } catch {} })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_feedback", { detail: data }))
    }
  }

  private static emitSuppliers() {
    const data = [...this.suppliersCache]
    this.supplierListeners.forEach((fn) => { try { fn(data) } catch {} })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_suppliers", { detail: data }))
    }
  }

  private static emitWastage() {
    const data = [...this.wastageCache]
    this.wastageListeners.forEach((fn) => { try { fn(data) } catch {} })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_wastage", { detail: data }))
    }
  }

  private static emitAdjustments() {
    const data = [...this.adjustmentsCache]
    this.adjustmentListeners.forEach((fn) => { try { fn(data) } catch {} })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_adjustments", { detail: data }))
    }
  }

  private static emitExpenses() {
    const data = [...this.expensesCache]
    this.expenseListeners.forEach((fn) => { try { fn(data) } catch {} })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_expenses", { detail: data }))
    }
  }

  private static emitBranches() {
    const data = [...this.branchesCache]
    this.branchListeners.forEach((fn) => { try { fn(data) } catch {} })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_branches", { detail: data }))
    }
  }

  private static emitIngredients() {
    const data = [...this.ingredientsCache]
    this.ingredientListeners.forEach((fn) => {
      try { fn(data) } catch {}
    })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_ingredients", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_inventory", { detail: data }))
    }
  }

  private static emitIngredientCategories() {
    const data = [...this.ingredientCategoriesCache]
    this.ingredientCategoryListeners.forEach((fn) => {
      try { fn(data) } catch {}
    })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_ingredient_categories", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_inventory", { detail: data }))
    }
  }

  private static emitRecipes() {
    const data = { ...this.recipesCache }
    this.recipeListeners.forEach((fn) => {
      try { fn(data) } catch {}
    })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_recipes", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_inventory", { detail: data }))
    }
  }

  private static emitPurchases() {
    const data = [...this.purchasesCache]
    this.purchaseListeners.forEach((fn) => {
      try { fn(data) } catch {}
    })
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_realtime_purchases", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_inventory", { detail: data }))
    }
  }

  private static channel: any = null
  private static timer: any = undefined
  private static bc: BroadcastChannel | null = null
  private static initialized = false
  private static lastOrdersSyncTimestamp: string | null = null
  private static lastOrdersSyncId: string | null = null
  private static isRefreshingOrders = false
  private static hasPendingOrdersRefresh = false
  private static sharedNextSeq = 100

  private static isBrowser() {
    return typeof window !== "undefined"
  }

  // --- Broadcast sync helper ------------------------------------------------
  private static broadcast(type: string, data?: unknown) {
    if (!this.isBrowser()) return
    try {
      if ("BroadcastChannel" in window) {
        if (!this.bc) {
          this.bc = new BroadcastChannel("pos_realtime_sync")
        }
        this.bc.postMessage({ type, data, timestamp: Date.now() })
      }
    } catch {}
    window.dispatchEvent(new CustomEvent("pos_realtime_" + type, { detail: data }))
    window.dispatchEvent(new CustomEvent("pos_realtime_sync", { detail: { type, data } }))
  }

  public static broadcastRbac(data?: unknown) {
    this.broadcast("rbac", data)
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_rbac_sync", { detail: data }))
    }
  }

  // --- Initialize caches from storage --------------------------------------
  public static init() {
    if (this.initialized || !this.isBrowser()) return
    this.initialized = true

    // Clean-slate purge for Lazy Sunday 41-product menu and clean inventory/orders
    const LAZY_SUNDAY_5CATS_FLAG = "pos_lazy_sunday_5cats_41prods_v2"
    if (this.isBrowser() && localStorage.getItem(LAZY_SUNDAY_5CATS_FLAG) !== "true") {
      try {
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS))
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES))
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(DEFAULT_INGREDIENTS))
        localStorage.setItem(INGREDIENT_CATEGORIES_KEY, JSON.stringify(DEFAULT_INGREDIENT_CATEGORIES))
        localStorage.setItem(RECIPES_KEY, JSON.stringify(DEFAULT_RECIPES))
        localStorage.removeItem(ORDERS_KEY)
        localStorage.removeItem(PURCHASES_KEY)
        localStorage.removeItem(WASTAGE_KEY)
        localStorage.removeItem(ADJUSTMENTS_KEY)
        localStorage.removeItem("pos_coffee_bills")
        localStorage.removeItem("pos_mock_orders")
        localStorage.setItem(ORDERS_KEY, "[]")
        localStorage.setItem(LAZY_SUNDAY_5CATS_FLAG, "true")
      } catch {}
    }

    const PURE_ZERO_V7_FLAG = "pos_pure_zero_products_v7"
    if (this.isBrowser() && localStorage.getItem(PURE_ZERO_V7_FLAG) !== "true") {
      try {
        localStorage.removeItem(PRODUCTS_KEY)
        localStorage.removeItem(CATEGORIES_KEY)
        localStorage.removeItem(ORDERS_KEY)
        localStorage.removeItem(INGREDIENTS_KEY)
        localStorage.removeItem(RECIPES_KEY)
        localStorage.removeItem(PURCHASES_KEY)
        localStorage.removeItem(WASTAGE_KEY)
        localStorage.removeItem(ADJUSTMENTS_KEY)
        localStorage.removeItem("pos_coffee_bills")
        localStorage.removeItem("pos_mock_orders")
        localStorage.setItem(PRODUCTS_KEY, "[]")
        localStorage.setItem(CATEGORIES_KEY, "[]")
        localStorage.setItem(ORDERS_KEY, "[]")
        localStorage.setItem(INGREDIENTS_KEY, "[]")
        localStorage.setItem(PURE_ZERO_V7_FLAG, "true")
      } catch {}
    }

    const LAZY_SUNDAY_MENU_V5_FLAG = "pos_lazy_sunday_menu_41_pure_v5"
    if (this.isBrowser() && localStorage.getItem(LAZY_SUNDAY_MENU_V5_FLAG) !== "true") {
      try {
        localStorage.removeItem(PRODUCTS_KEY)
        localStorage.removeItem(CATEGORIES_KEY)
        localStorage.removeItem(ORDERS_KEY)
        localStorage.removeItem(INGREDIENTS_KEY)
        localStorage.removeItem(RECIPES_KEY)
        localStorage.removeItem(PURCHASES_KEY)
        localStorage.removeItem(WASTAGE_KEY)
        localStorage.removeItem(ADJUSTMENTS_KEY)
        localStorage.removeItem("pos_coffee_bills")
        localStorage.removeItem("pos_mock_orders")
        localStorage.setItem(LAZY_SUNDAY_MENU_V5_FLAG, "true")
      } catch {}
    }

    // Clean-slate purge for Lazy Sunday tables & bookings to guarantee 0/14 active tables on fresh start
    const LAZY_SUNDAY_TABLES_CLEAN_FLAG = "pos_lazy_sunday_clean_tables_zero_v4"
    if (this.isBrowser() && localStorage.getItem(LAZY_SUNDAY_TABLES_CLEAN_FLAG) !== "true") {
      try {
        localStorage.removeItem(BOOKINGS_KEY)
        localStorage.removeItem(SESSIONS_KEY)
        localStorage.setItem(TABLES_KEY, JSON.stringify(DEFAULT_TABLES.map((t) => ({ ...t, status: "available" }))))
        localStorage.setItem(LAZY_SUNDAY_TABLES_CLEAN_FLAG, "true")
      } catch {}
    }

    // Tables
    try {
      const rawTables = localStorage.getItem(TABLES_KEY)
      this.tablesCache = rawTables ? JSON.parse(rawTables) : DEFAULT_TABLES.map((t) => ({ ...t }))
      if (!Array.isArray(this.tablesCache) || this.tablesCache.length !== 14 || this.tablesCache.some((t) => t.id === "1")) {
        this.tablesCache = DEFAULT_TABLES.map((t) => ({ ...t, status: "available" }))
        if (this.isBrowser()) {
          try { localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache)) } catch {}
        }
      }
    } catch {
      this.tablesCache = DEFAULT_TABLES.map((t) => ({ ...t }))
    }

    // Bookings
    try {
      const rawBookings = localStorage.getItem(BOOKINGS_KEY)
      this.bookingsCache = rawBookings ? JSON.parse(rawBookings) : []
    } catch {
      this.bookingsCache = []
    }

    // Sync table reserved status from active upcoming bookings
    const now = Date.now()
    for (const b of this.bookingsCache) {
      const start = new Date(b.reserved_for).getTime()
      const end = start + (b.duration_minutes || 90) * 60000
      if (["pending", "confirmed", "arrived"].includes(b.status) && end > now) {
        this.tablesCache = this.tablesCache.map((t) => {
          const match = t.id === b.table_id || sameName(t.name, b.table_name)
          if (match && t.status !== "occupied" && t.status !== "bill_requested") {
            return {
              ...t,
              status: "reserved" as const,
              guestName: b.customer_name,
              occupiedAt: b.reserved_for,
              bookingId: b.id,
            }
          }
          return t
        })
      }
    }

    // Sessions
    try {
      const rawSessions = localStorage.getItem(SESSIONS_KEY)
      this.sessionsCache = rawSessions ? JSON.parse(rawSessions) : []
    } catch {
      this.sessionsCache = []
    }

    // Products
    try {
      const rawProducts = this.isBrowser() ? localStorage.getItem(PRODUCTS_KEY) : null
      if (rawProducts !== null) {
        const parsed = JSON.parse(rawProducts)
        const existing: SharedProduct[] = Array.isArray(parsed) ? parsed : []
        const existingIds = new Set(existing.map((p) => p.id))
        const existingNames = new Set(existing.map((p) => (p.name || "").trim().toLowerCase()))
        const missing = DEFAULT_PRODUCTS.filter(
          (dp) => !existingIds.has(dp.id) && !existingNames.has(dp.name.trim().toLowerCase())
        )
        const combined = [...existing, ...missing]
        // Ensure strictly unique by id
        const seenIds = new Set<string>()
        this.productsCache = combined.filter((p) => {
          if (!p || !p.id || seenIds.has(p.id)) return false
          seenIds.add(p.id)
          return true
        })

        // One-time migration: reconcile legacy uniform stock (100 across all products) with authentic database stock
        const migrationKey = "pos_stock_seeded_v3"
        const hasMigrated = this.isBrowser() && localStorage.getItem(migrationKey) === "true"
        let cacheModified = false

        if (!hasMigrated && this.isBrowser()) {
          const allHundred = existing.length > 0 && existing.every((p) => Number(p.stock) === 100)
          if (allHundred) {
            const defStockMap = new Map(DEFAULT_PRODUCTS.map((dp) => [dp.id, dp.stock]))
            const defNameStockMap = new Map(DEFAULT_PRODUCTS.map((dp) => [dp.name.trim().toLowerCase(), dp.stock]))
            this.productsCache = this.productsCache.map((p) => {
              const defStock = defStockMap.get(p.id) ?? defNameStockMap.get((p.name || "").trim().toLowerCase())
              if (defStock !== undefined) {
                cacheModified = true
                return { ...p, stock: defStock }
              }
              return p
            })
          }
          try {
            localStorage.setItem(migrationKey, "true")
          } catch {}
        }

        if ((missing.length > 0 || cacheModified) && this.isBrowser()) {
          try {
            localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
          } catch {}
        }
      } else {
        this.productsCache = DEFAULT_PRODUCTS.map((p) => ({ ...p }))
        if (this.isBrowser()) {
          try {
            localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
          } catch {}
        }
      }
    } catch {
      this.productsCache = DEFAULT_PRODUCTS.map((p) => ({ ...p }))
    }

    // Categories
    try {
      const rawCategories = this.isBrowser() ? localStorage.getItem(CATEGORIES_KEY) : null
      if (rawCategories !== null) {
        const parsed = JSON.parse(rawCategories)
        const existing: SharedCategory[] = Array.isArray(parsed) ? parsed : []
        const existingNames = new Set(existing.map((c) => (c.name || "").trim().toLowerCase()))
        const missing = DEFAULT_CATEGORIES.filter((dc) => !existingNames.has(dc.name.trim().toLowerCase()))
        this.categoriesCache = [...existing, ...missing]
        if (missing.length > 0 && this.isBrowser()) {
          try {
            localStorage.setItem(CATEGORIES_KEY, JSON.stringify(this.categoriesCache))
          } catch {}
        }
      } else {
        this.categoriesCache = DEFAULT_CATEGORIES.map((c) => ({ ...c }))
        if (this.isBrowser()) {
          try {
            localStorage.setItem(CATEGORIES_KEY, JSON.stringify(this.categoriesCache))
          } catch {}
        }
      }
    } catch {
      this.categoriesCache = DEFAULT_CATEGORIES.map((c) => ({ ...c }))
    }

    // Clean-slate purge for Lazy Sunday: purge all legacy demo/previous orders across all storage keys
    const LAZY_SUNDAY_ORDERS_PURGED_FLAG = "pos_lazy_sunday_clean_orders_zero_v3"
    const hasPurgedLazySundayOrders = this.isBrowser() && localStorage.getItem(LAZY_SUNDAY_ORDERS_PURGED_FLAG) === "true"

    if (this.isBrowser() && !hasPurgedLazySundayOrders) {
      try {
        localStorage.removeItem("pos_coffee_bills")
        localStorage.removeItem("pos_mock_orders")
        localStorage.setItem(ORDERS_KEY, JSON.stringify([]))
        localStorage.setItem(LAZY_SUNDAY_ORDERS_PURGED_FLAG, "true")
      } catch {}
    }

    // Orders - Load baseline initial orders, existing stored orders, and coffee bills
    try {
      const rawOrders = localStorage.getItem(ORDERS_KEY)
      const parsed = rawOrders ? JSON.parse(rawOrders) : []
      const orderMap = new Map<string, SharedOrder>()

      // 1. Seed baseline orders
      DEFAULT_INITIAL_ORDERS.forEach((o) => orderMap.set(o.order_number || o.id, { ...o }))

      // 2. Merge existing pos_shared_orders
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((o) => orderMap.set(o.order_number || o.id, o))
      }

      // 3. Merge existing coffee bills from pos_coffee_bills
      try {
        const rawCoffee = localStorage.getItem("pos_coffee_bills")
        if (rawCoffee) {
          const parsedCoffee = JSON.parse(rawCoffee)
          if (Array.isArray(parsedCoffee)) {
            parsedCoffee.forEach((cb: any) => {
              const key = cb.bill_number || `coffee:${cb.id}`
              if (!orderMap.has(key)) {
                orderMap.set(key, {
                  id: `coffee:${cb.id}`,
                  order_number: cb.bill_number,
                  receipt_number: cb.bill_number,
                  table_name: cb.table_name || "Takeaway",
                  cashier_name: "Coffee Bar",
                  department: "Coffee Bar",
                  items: (cb.items || []).map((it: any) => ({
                    id: it.id || it.coffee_product_id,
                    name: it.item_name,
                    price: it.unit_price,
                    quantity: it.quantity,
                    category: "Coffee Bar",
                  })),
                  subtotal: cb.subtotal || 0,
                  service_charge: cb.tax || 0,
                  service_charge_rate: 0,
                  discount: cb.discount || 0,
                  total: cb.grand_total || cb.subtotal || 0,
                  payment_method: cb.payment_method === "transfer" ? "qr" : (cb.payment_method || "cash"),
                  status: "paid",
                  bar_status: cb.bar_status || "served",
                  kitchen_status: "served",
                  ticket_source: "coffee_bill",
                  created_at: cb.created_at || cb.bill_date || new Date().toISOString(),
                })
              }
            })
          }
        }
      } catch {}

      this.ordersCache = Array.from(orderMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      try {
        localStorage.setItem(ORDERS_KEY, JSON.stringify(this.ordersCache))
      } catch {}
    } catch {
      this.ordersCache = DEFAULT_INITIAL_ORDERS.map((o) => ({ ...o }))
    }

    // Reconcile table occupancy with actual active open orders and active table sessions
    const activeOpenTables = new Set(
      this.ordersCache
        .filter((o) => o.status === "open" && o.table_name && !isTakeaway(o.table_name))
        .map((o) => o.table_name.toLowerCase())
    )
    const activeSessionTableKeys = new Set<string>()
    this.sessionsCache
      .filter((s) => s.status === "open" || s.status === "bill_requested")
      .forEach((s) => {
        if (s.table_id) activeSessionTableKeys.add(String(s.table_id).toLowerCase())
        if (s.table_name) activeSessionTableKeys.add(String(s.table_name).toLowerCase())
      })

    let tablesNeedSync = false
    this.tablesCache = this.tablesCache.map((tbl) => {
      const isActuallyActive =
        activeOpenTables.has(tbl.name.toLowerCase()) ||
        activeSessionTableKeys.has(tbl.id.toLowerCase()) ||
        activeSessionTableKeys.has(tbl.name.toLowerCase())
      if (tbl.status === "occupied" && !isActuallyActive) {
        tablesNeedSync = true
        return { ...tbl, status: "available", orderNumber: undefined, orderTotal: undefined, guestName: undefined, occupiedAt: undefined }
      }
      return tbl
    })
    if (tablesNeedSync && this.isBrowser()) {
      try { localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache)) } catch {}
    }

    // Check if legacy bulk mock data across all modules needs to be purged
    const BULK_PURGED_FLAG = "pos_clean_slate_v8"
    const hasPurged = this.isBrowser() && localStorage.getItem(BULK_PURGED_FLAG) === "true"

    if (this.isBrowser() && !hasPurged) {
      try {
        localStorage.setItem(CUSTOMERS_KEY, JSON.stringify([]))
        localStorage.setItem(PROMOS_KEY, JSON.stringify([]))
        localStorage.setItem(FEEDBACK_KEY, JSON.stringify([]))
        localStorage.setItem(SUPPLIERS_KEY, JSON.stringify([]))
        localStorage.setItem(WASTAGE_KEY, JSON.stringify([]))
        localStorage.setItem(ADJUSTMENTS_KEY, JSON.stringify([]))
        localStorage.setItem(EXPENSES_KEY, JSON.stringify([]))
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify([]))
        localStorage.setItem(RECIPES_KEY, JSON.stringify({}))
        localStorage.setItem(PURCHASES_KEY, JSON.stringify([]))
        const rawO = localStorage.getItem(ORDERS_KEY)
        if (rawO) {
          const parsedO = JSON.parse(rawO)
          if (Array.isArray(parsedO)) {
            const cleanO = parsedO.filter((o: any) => !String(o.id || "").startsWith("ord-sample-"))
            localStorage.setItem(ORDERS_KEY, JSON.stringify(cleanO))
            this.ordersCache = cleanO
          }
        }
        localStorage.setItem(BULK_PURGED_FLAG, "true")
      } catch {}
      this.customersCache = []
      this.promosCache = []
      this.feedbackCache = []
      this.suppliersCache = []
      this.wastageCache = []
      this.adjustmentsCache = []
      this.expensesCache = []
      this.ingredientsCache = []
      this.recipesCache = {}
      this.purchasesCache = []
    } else {
      // Ingredients
      try {
        const rawIng = this.isBrowser() ? localStorage.getItem(INGREDIENTS_KEY) : null
        if (rawIng !== null) {
          const parsed = JSON.parse(rawIng)
          this.ingredientsCache = Array.isArray(parsed) ? parsed : []
        } else {
          this.ingredientsCache = []
        }
      } catch {
        this.ingredientsCache = []
      }

      // Recipes
      try {
        const rawRec = this.isBrowser() ? localStorage.getItem(RECIPES_KEY) : null
        if (rawRec !== null) {
          const parsed = JSON.parse(rawRec)
          this.recipesCache = parsed && typeof parsed === "object" ? parsed : {}
        } else {
          this.recipesCache = {}
        }
      } catch {
        this.recipesCache = {}
      }

      // Purchases
      try {
        const rawPur = this.isBrowser() ? localStorage.getItem(PURCHASES_KEY) : null
        this.purchasesCache = rawPur ? JSON.parse(rawPur) : []
      } catch {
        this.purchasesCache = []
      }
    }

    // Ingredient Categories
    try {
      const rawIngCat = this.isBrowser() ? localStorage.getItem(INGREDIENT_CATEGORIES_KEY) : null
      if (rawIngCat !== null) {
        const parsed = JSON.parse(rawIngCat)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasLegacy = parsed.some((c: any) => c.id && String(c.id).startsWith("ing-cat-"))
          if (hasLegacy) {
            this.ingredientCategoriesCache = DEFAULT_INGREDIENT_CATEGORIES.map((c) => ({ ...c }))
            if (this.isBrowser()) {
              try {
                localStorage.setItem(INGREDIENT_CATEGORIES_KEY, JSON.stringify(this.ingredientCategoriesCache))
              } catch {}
            }
          } else {
            this.ingredientCategoriesCache = parsed
          }
        } else {
          this.ingredientCategoriesCache = DEFAULT_INGREDIENT_CATEGORIES.map((c) => ({ ...c }))
        }
      } else {
        this.ingredientCategoriesCache = DEFAULT_INGREDIENT_CATEGORIES.map((c) => ({ ...c }))
        if (this.isBrowser()) {
          try {
            localStorage.setItem(INGREDIENT_CATEGORIES_KEY, JSON.stringify(this.ingredientCategoriesCache))
          } catch {}
        }
      }
    } catch {
      this.ingredientCategoriesCache = DEFAULT_INGREDIENT_CATEGORIES.map((c) => ({ ...c }))
    }

    // Customers
    try {
      const raw = this.isBrowser() ? localStorage.getItem(CUSTOMERS_KEY) : null
      if (raw !== null) {
        const parsed = JSON.parse(raw)
        this.customersCache = Array.isArray(parsed) ? parsed : []
      } else {
        this.customersCache = DEFAULT_CUSTOMERS.map((c) => ({ ...c }))
        if (this.isBrowser()) {
          try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customersCache)) } catch {}
        }
      }
    } catch {
      this.customersCache = DEFAULT_CUSTOMERS.map((c) => ({ ...c }))
    }

    // Promos
    try {
      const raw = this.isBrowser() ? localStorage.getItem(PROMOS_KEY) : null
      if (raw !== null) {
        const parsed = JSON.parse(raw)
        this.promosCache = Array.isArray(parsed) ? parsed : []
      } else {
        this.promosCache = DEFAULT_PROMOS.map((p) => ({ ...p }))
        if (this.isBrowser()) {
          try { localStorage.setItem(PROMOS_KEY, JSON.stringify(this.promosCache)) } catch {}
        }
      }
    } catch {
      this.promosCache = DEFAULT_PROMOS.map((p) => ({ ...p }))
    }

    // Feedback
    try {
      const raw = this.isBrowser() ? localStorage.getItem(FEEDBACK_KEY) : null
      if (raw !== null) {
        const parsed = JSON.parse(raw)
        this.feedbackCache = Array.isArray(parsed) ? parsed : []
      } else {
        this.feedbackCache = DEFAULT_FEEDBACK.map((f) => ({ ...f }))
        if (this.isBrowser()) {
          try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(this.feedbackCache)) } catch {}
        }
      }
    } catch {
      this.feedbackCache = DEFAULT_FEEDBACK.map((f) => ({ ...f }))
    }

    // Suppliers
    try {
      const raw = this.isBrowser() ? localStorage.getItem(SUPPLIERS_KEY) : null
      if (raw !== null) {
        const parsed = JSON.parse(raw)
        this.suppliersCache = Array.isArray(parsed) ? parsed : []
      } else {
        this.suppliersCache = DEFAULT_SUPPLIERS.map((s) => ({ ...s }))
        if (this.isBrowser()) {
          try { localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(this.suppliersCache)) } catch {}
        }
      }
    } catch {
      this.suppliersCache = DEFAULT_SUPPLIERS.map((s) => ({ ...s }))
    }

    // Wastage
    try {
      const raw = this.isBrowser() ? localStorage.getItem(WASTAGE_KEY) : null
      if (raw !== null) {
        const parsed = JSON.parse(raw)
        this.wastageCache = Array.isArray(parsed) ? parsed : []
      } else {
        this.wastageCache = DEFAULT_WASTAGE.map((w) => ({ ...w }))
        if (this.isBrowser()) {
          try { localStorage.setItem(WASTAGE_KEY, JSON.stringify(this.wastageCache)) } catch {}
        }
      }
    } catch {
      this.wastageCache = DEFAULT_WASTAGE.map((w) => ({ ...w }))
    }

    // Adjustments
    try {
      const raw = this.isBrowser() ? localStorage.getItem(ADJUSTMENTS_KEY) : null
      if (raw !== null) {
        const parsed = JSON.parse(raw)
        this.adjustmentsCache = Array.isArray(parsed) ? parsed : []
      } else {
        this.adjustmentsCache = DEFAULT_ADJUSTMENTS.map((a) => ({ ...a }))
        if (this.isBrowser()) {
          try { localStorage.setItem(ADJUSTMENTS_KEY, JSON.stringify(this.adjustmentsCache)) } catch {}
        }
      }
    } catch {
      this.adjustmentsCache = DEFAULT_ADJUSTMENTS.map((a) => ({ ...a }))
    }

    // Expenses
    try {
      const raw = this.isBrowser() ? localStorage.getItem(EXPENSES_KEY) : null
      if (raw !== null) {
        const parsed = JSON.parse(raw)
        this.expensesCache = Array.isArray(parsed) ? parsed : []
      } else {
        this.expensesCache = DEFAULT_EXPENSES.map((e) => ({ ...e }))
        if (this.isBrowser()) {
          try { localStorage.setItem(EXPENSES_KEY, JSON.stringify(this.expensesCache)) } catch {}
        }
      }
    } catch {
      this.expensesCache = DEFAULT_EXPENSES.map((e) => ({ ...e }))
    }

    // Branches
    try {
      const raw = this.isBrowser() ? localStorage.getItem(BRANCHES_KEY) : null
      if (raw !== null) {
        const parsed = JSON.parse(raw)
        this.branchesCache = Array.isArray(parsed) ? parsed : []
      } else {
        this.branchesCache = DEFAULT_BRANCHES.map((b) => ({ ...b }))
        if (this.isBrowser()) {
          try { localStorage.setItem(BRANCHES_KEY, JSON.stringify(this.branchesCache)) } catch {}
        }
      }
      const rawActive = this.isBrowser() ? localStorage.getItem(ACTIVE_BRANCH_KEY) : null
      if (rawActive) this.activeBranchId = rawActive
    } catch {
      this.branchesCache = DEFAULT_BRANCHES.map((b) => ({ ...b }))
    }

    // Cross-tab BroadcastChannel listener
    try {
      if ("BroadcastChannel" in window) {
        this.bc = new BroadcastChannel("pos_realtime_sync")
        this.bc.onmessage = (event) => {
          const { type } = event.data || {}
          if (type === "tables" || type === "bookings" || type === "sessions") {
            this.reloadTablesAndBookings()
          } else if (type === "products" || type === "categories") {
            this.reloadProductsAndCategories()
          } else if (type === "orders") {
            this.reloadOrders()
          } else if (type === "ingredients" || type === "ingredient_categories" || type === "recipes" || type === "purchases" || type === "inventory") {
            this.reloadInventory()
          } else if (type === "customers") {
            this.reloadCustomers()
          } else if (type === "promos") {
            this.reloadPromos()
          } else if (type === "feedback") {
            this.reloadFeedback()
          } else if (type === "suppliers") {
            this.reloadSuppliers()
          } else if (type === "wastage") {
            this.reloadWastage()
          } else if (type === "adjustments") {
            this.reloadAdjustments()
          } else if (type === "expenses") {
            this.reloadExpenses()
          } else if (type === "branches") {
            this.reloadBranches()
          } else if (type === "rbac" || type === "users" || type === "roles") {
            window.dispatchEvent(new CustomEvent("pos_realtime_rbac", { detail: event.data?.data }))
            window.dispatchEvent(new CustomEvent("pos_rbac_sync", { detail: event.data?.data }))
          }
        }
      }
    } catch {}

    // Cross-tab storage event fallback
    window.addEventListener("storage", (e) => {
      if (e.key === TABLES_KEY || e.key === BOOKINGS_KEY || e.key === SESSIONS_KEY) {
        this.reloadTablesAndBookings()
      } else if (e.key === PRODUCTS_KEY || e.key === CATEGORIES_KEY) {
        this.reloadProductsAndCategories()
      } else if (e.key === ORDERS_KEY) {
        this.reloadOrders()
      } else if (e.key === INGREDIENTS_KEY || e.key === INGREDIENT_CATEGORIES_KEY || e.key === RECIPES_KEY || e.key === PURCHASES_KEY) {
        this.reloadInventory()
      } else if (e.key === CUSTOMERS_KEY) {
        this.reloadCustomers()
      } else if (e.key === PROMOS_KEY) {
        this.reloadPromos()
      } else if (e.key === FEEDBACK_KEY) {
        this.reloadFeedback()
      } else if (e.key === SUPPLIERS_KEY) {
        this.reloadSuppliers()
      } else if (e.key === WASTAGE_KEY) {
        this.reloadWastage()
      } else if (e.key === ADJUSTMENTS_KEY) {
        this.reloadAdjustments()
      } else if (e.key === EXPENSES_KEY) {
        this.reloadExpenses()
      } else if (e.key === BRANCHES_KEY || e.key === ACTIVE_BRANCH_KEY) {
        this.reloadBranches()
      }
    })

    // Cloud Realtime Subscription
    this.startCloudRealtime()
  }

  private static reloadCustomers() {
    try {
      const raw = localStorage.getItem(CUSTOMERS_KEY)
      if (raw) this.customersCache = JSON.parse(raw)
      this.emitCustomers()
    } catch {}
  }

  private static reloadPromos() {
    try {
      const raw = localStorage.getItem(PROMOS_KEY)
      if (raw) this.promosCache = JSON.parse(raw)
      this.emitPromos()
    } catch {}
  }

  private static reloadFeedback() {
    try {
      const raw = localStorage.getItem(FEEDBACK_KEY)
      if (raw) this.feedbackCache = JSON.parse(raw)
      this.emitFeedback()
    } catch {}
  }

  private static reloadSuppliers() {
    try {
      const raw = localStorage.getItem(SUPPLIERS_KEY)
      if (raw) this.suppliersCache = JSON.parse(raw)
      this.emitSuppliers()
    } catch {}
  }

  private static reloadWastage() {
    try {
      const raw = localStorage.getItem(WASTAGE_KEY)
      if (raw) this.wastageCache = JSON.parse(raw)
      this.emitWastage()
    } catch {}
  }

  private static reloadAdjustments() {
    try {
      const raw = localStorage.getItem(ADJUSTMENTS_KEY)
      if (raw) this.adjustmentsCache = JSON.parse(raw)
      this.emitAdjustments()
    } catch {}
  }

  private static reloadExpenses() {
    try {
      const raw = localStorage.getItem(EXPENSES_KEY)
      if (raw) this.expensesCache = JSON.parse(raw)
      this.emitExpenses()
    } catch {}
  }

  private static reloadBranches() {
    try {
      const raw = localStorage.getItem(BRANCHES_KEY)
      if (raw) this.branchesCache = JSON.parse(raw)
      const rawActive = localStorage.getItem(ACTIVE_BRANCH_KEY)
      if (rawActive) this.activeBranchId = rawActive
      this.emitBranches()
    } catch {}
  }

  private static reloadInventory() {
    try {
      const ing = localStorage.getItem(INGREDIENTS_KEY)
      if (ing) this.ingredientsCache = JSON.parse(ing)
      const cat = localStorage.getItem(INGREDIENT_CATEGORIES_KEY)
      if (cat) this.ingredientCategoriesCache = JSON.parse(cat)
      const rec = localStorage.getItem(RECIPES_KEY)
      if (rec) this.recipesCache = JSON.parse(rec)
      const pur = localStorage.getItem(PURCHASES_KEY)
      if (pur) this.purchasesCache = JSON.parse(pur)
      this.emitIngredients()
      this.emitIngredientCategories()
      this.emitRecipes()
      this.emitPurchases()
      window.dispatchEvent(new CustomEvent("pos_realtime_inventory"))
    } catch {}
  }

  private static reloadTablesAndBookings() {
    try {
      const t = localStorage.getItem(TABLES_KEY)
      if (t) this.tablesCache = JSON.parse(t)
      const b = localStorage.getItem(BOOKINGS_KEY)
      if (b) this.bookingsCache = JSON.parse(b)
      const s = localStorage.getItem(SESSIONS_KEY)
      if (s) this.sessionsCache = JSON.parse(s)
      this.emitTables()
      this.emitBookings()
      this.emitSessions()
    } catch {}
  }

  private static reloadProductsAndCategories() {
    try {
      const p = localStorage.getItem(PRODUCTS_KEY)
      if (p) this.productsCache = JSON.parse(p)
      const c = localStorage.getItem(CATEGORIES_KEY)
      if (c) this.categoriesCache = JSON.parse(c)
      this.emitProducts()
      this.emitCategories()
    } catch {}
  }

  private static reloadOrders() {
    try {
      const rawOrders = localStorage.getItem(ORDERS_KEY)
      const parsed = rawOrders ? JSON.parse(rawOrders) : []
      const orderMap = new Map<string, SharedOrder>()

      // 1. Seed baseline orders
      DEFAULT_INITIAL_ORDERS.forEach((o) => orderMap.set(o.order_number || o.id, { ...o }))

      // 2. Merge existing pos_shared_orders
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((o) => orderMap.set(o.order_number || o.id, o))
      }

      // 3. Merge existing coffee bills from pos_coffee_bills
      try {
        const rawCoffee = localStorage.getItem("pos_coffee_bills")
        if (rawCoffee) {
          const parsedCoffee = JSON.parse(rawCoffee)
          if (Array.isArray(parsedCoffee)) {
            parsedCoffee.forEach((cb: any) => {
              const key = cb.bill_number || `coffee:${cb.id}`
              if (!orderMap.has(key)) {
                orderMap.set(key, {
                  id: `coffee:${cb.id}`,
                  order_number: cb.bill_number,
                  receipt_number: cb.bill_number,
                  table_name: cb.table_name || "Takeaway",
                  cashier_name: "Coffee Bar",
                  department: "Coffee Bar",
                  items: (cb.items || []).map((it: any) => ({
                    id: it.id || it.coffee_product_id,
                    name: it.item_name,
                    price: it.unit_price,
                    quantity: it.quantity,
                    category: "Coffee Bar",
                  })),
                  subtotal: cb.subtotal || 0,
                  service_charge: cb.tax || 0,
                  service_charge_rate: 0,
                  discount: cb.discount || 0,
                  total: cb.grand_total || cb.subtotal || 0,
                  payment_method: cb.payment_method === "transfer" ? "qr" : (cb.payment_method || "cash"),
                  status: "paid",
                  bar_status: cb.bar_status || "served",
                  kitchen_status: "served",
                  ticket_source: "coffee_bill",
                  created_at: cb.created_at || cb.bill_date || new Date().toISOString(),
                })
              }
            })
          }
        }
      } catch {}

      this.ordersCache = Array.from(orderMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      this.emitOrders()
    } catch {}
  }

  private static startCloudRealtime() {
    if (!this.isBrowser() || this.timer || !isSupabaseConfigured()) return
    void this.refresh()
    void this.refreshIngredientsFromCloud()
    void this.refreshRecipesFromCloud()
    const supabase = createClient()
    let refreshDebounce: any = null
    const debouncedRefresh = () => {
      if (refreshDebounce) clearTimeout(refreshDebounce)
      refreshDebounce = setTimeout(() => void this.refresh(), 250)
    }

    let prodDebounce: any = null
    const debouncedProducts = () => {
      if (prodDebounce) clearTimeout(prodDebounce)
      prodDebounce = setTimeout(() => void this.refreshProductsFromCloud(), 250)
    }

    let orderDebounce: any = null
    const debouncedOrders = () => {
      if (this.isRefreshingOrders) {
        this.hasPendingOrdersRefresh = true
        return
      }
      if (orderDebounce) clearTimeout(orderDebounce)
      orderDebounce = setTimeout(() => void this.refreshOrdersFromCloud(), 250)
    }

    let ingDebounce: any = null
    const debouncedIngredients = () => {
      if (ingDebounce) clearTimeout(ingDebounce)
      ingDebounce = setTimeout(() => void this.refreshIngredientsFromCloud(), 250)
    }

    let recDebounce: any = null
    const debouncedRecipes = () => {
      if (recDebounce) clearTimeout(recDebounce)
      recDebounce = setTimeout(() => void this.refreshRecipesFromCloud(), 250)
    }

    try {
      this.channel = supabase
        .channel("pos-shared-cloud-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "pos_tables" }, debouncedRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, debouncedRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, debouncedRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "pos_products" }, debouncedProducts)
        .on("postgres_changes", { event: "*", schema: "public", table: "pos_categories" }, debouncedProducts)
        .on("postgres_changes", { event: "*", schema: "public", table: "pos_orders" }, debouncedOrders)
        .on("postgres_changes", { event: "*", schema: "public", table: "coffee_bills" }, debouncedOrders)
        .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, debouncedIngredients)
        .on("postgres_changes", { event: "*", schema: "public", table: "recipe_items" }, debouncedRecipes)
        .on("postgres_changes", { event: "*", schema: "public", table: "app_users" }, () => this.broadcastRbac())
        .on("postgres_changes", { event: "*", schema: "public", table: "roles" }, () => this.broadcastRbac())
        .on("postgres_changes", { event: "*", schema: "public", table: "role_permissions" }, () => this.broadcastRbac())
        .subscribe()
    } catch {}
    this.timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void this.refresh()
    }, POLL_MS)
  }

  // --- Subscriptions --------------------------------------------------------
  static subscribe(listener: Listener<SharedTable[]>): () => void {
    return this.subscribeTables(listener)
  }

  static subscribeTables(listener: Listener<SharedTable[]>): () => void {
    this.init()
    this.tableListeners.add(listener)
    listener(this.tablesCache)
    return () => {
      this.tableListeners.delete(listener)
    }
  }

  static subscribeBookings(listener: Listener<SharedBooking[]>): () => void {
    this.init()
    this.bookingListeners.add(listener)
    listener(this.bookingsCache)
    return () => {
      this.bookingListeners.delete(listener)
    }
  }

  static subscribeSessions(listener: Listener<SharedSession[]>): () => void {
    this.init()
    this.sessionListeners.add(listener)
    listener(this.sessionsCache)
    return () => {
      this.sessionListeners.delete(listener)
    }
  }

  static subscribeProducts(listener: Listener<SharedProduct[]>): () => void {
    this.init()
    this.productListeners.add(listener)
    listener(this.productsCache)
    return () => {
      this.productListeners.delete(listener)
    }
  }

  static subscribeCategories(listener: Listener<SharedCategory[]>): () => void {
    this.init()
    this.categoryListeners.add(listener)
    listener(this.categoriesCache)
    return () => {
      this.categoryListeners.delete(listener)
    }
  }

  static subscribeOrders(listener: Listener<SharedOrder[]>): () => void {
    this.init()
    this.orderListeners.add(listener)
    listener(this.ordersCache)
    return () => {
      this.orderListeners.delete(listener)
    }
  }

  private static emitTables() {
    const data = [...this.tablesCache]
    this.tableListeners.forEach((l) => l(data))
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_tables_updated", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_tables", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_sync", { detail: { type: "tables", data } }))
    }
  }

  private static emitBookings() {
    const data = [...this.bookingsCache]
    this.bookingListeners.forEach((l) => l(data))
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_bookings_updated", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_bookings", { detail: data }))
    }
  }

  private static emitSessions() {
    const data = [...this.sessionsCache]
    this.sessionListeners.forEach((l) => l(data))
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_sessions_updated", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_sessions", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_sync", { detail: { type: "sessions", data } }))
    }
  }

  private static emitProducts() {
    const data = [...this.productsCache]
    this.productListeners.forEach((l) => l(data))
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_products_updated", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_products", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_sync", { detail: { type: "products", data } }))
    }
  }

  private static emitCategories() {
    const data = [...this.categoriesCache]
    this.categoryListeners.forEach((l) => l(data))
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_categories_updated", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_categories", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_sync", { detail: { type: "categories", data } }))
    }
  }

  private static emitOrders() {
    const data = [...this.ordersCache]
    this.orderListeners.forEach((l) => l(data))
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent("pos_orders_updated", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_orders", { detail: data }))
      window.dispatchEvent(new CustomEvent("pos_realtime_sync", { detail: { type: "orders", data } }))
    }
  }

  // --- TABLE APIS -----------------------------------------------------------
  static getTables(): SharedTable[] {
    this.init()
    return this.tablesCache
  }

  static async refreshFromApi(force = false): Promise<void> {
    if (!this.isBrowser()) return
    const now = Date.now()
    if (!force) {
      if (this.isRefreshingApi && this.apiRefreshPromise) {
        return this.apiRefreshPromise
      }
      if (now - this.lastApiRefreshTime < 2500) {
        return Promise.resolve()
      }
    }

    this.isRefreshingApi = true
    this.lastApiRefreshTime = now

    this.apiRefreshPromise = (async () => {
      try {
        const [tableRes, bookingRes] = await Promise.all([
          fetch("/api/tables").then((r) => r.json()).catch(() => null),
          fetch("/api/tables/bookings").then((r) => r.json()).catch(() => null),
        ])

        let tablesChanged = false
        let bookingsChanged = false
        let sessionsChanged = false

        if (tableRes && tableRes.success && Array.isArray(tableRes.tables)) {
          const mergedTables: SharedTable[] = tableRes.tables.map((r: any) => {
            const tableId = String(r.id)
            const tableName = String(r.name)
            const local = this.tablesCache.find((t) => t.id === tableId || sameName(t.name, tableName))

            const localSession = this.sessionsCache.find(
              (s) => (s.table_id === tableId || sameName(s.table_name, tableName)) && s.status !== "closed"
            )

            // 1. If table was explicitly released locally, PRESERVE local available state
            if (local && local.status === "available" && local.releasedAt) {
              return {
                ...local,
                capacity: Number(r.capacity) || local.capacity || 2,
              }
            }

            // 2. If table is occupied locally with an active session or order, PRESERVE it!
            if (local && (local.status === "occupied" || local.status === "bill_requested") && (localSession || local.orderNumber)) {
              return {
                ...local,
                capacity: Number(r.capacity) || local.capacity || 2,
              }
            }

            if (localSession) {
              return {
                id: tableId,
                name: tableName,
                capacity: Number(r.capacity) || local?.capacity || 2,
                status: localSession.status === "bill_requested" ? "bill_requested" : "occupied",
                guestName: localSession.customer_name || local?.guestName,
                occupiedAt: localSession.seated_at || local?.occupiedAt,
                orderNumber: local?.orderNumber,
                orderTotal: local?.orderTotal,
                department: local?.department,
                bookingId: r.bookingId || local?.bookingId,
                releasedAt: undefined,
              }
            }

            return {
              id: tableId,
              name: tableName,
              capacity: Number(r.capacity) || 2,
              status: r.status,
              guestName: r.guestName ?? local?.guestName,
              occupiedAt: r.occupiedAt ?? local?.occupiedAt,
              bookingId: r.bookingId ?? local?.bookingId,
              department: r.department ?? local?.department,
              orderNumber: r.orderNumber ?? local?.orderNumber,
              orderTotal: r.orderTotal ?? local?.orderTotal,
              releasedAt: local?.releasedAt,
            }
          })

          // Also preserve any dynamic tables created locally that are not in server list
          for (const local of this.tablesCache) {
            if (!mergedTables.some((m) => m.id === local.id || sameName(m.name, local.name))) {
              mergedTables.push(local)
            }
          }

          if (JSON.stringify(mergedTables) !== JSON.stringify(this.tablesCache)) {
            this.tablesCache = mergedTables
            try { localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache)) } catch {}
            tablesChanged = true
          }
        }

        if (bookingRes && bookingRes.success && Array.isArray(bookingRes.reservations)) {
          const newBookings = bookingRes.reservations.map((b: any) => ({
            id: String(b.id),
            customer_name: b.customer_name,
            phone: b.phone,
            party_size: Number(b.party_size) || 2,
            reserved_for: b.reserved_for,
            duration_minutes: Number(b.duration_minutes) || 90,
            table_id: String(b.table_id || ""),
            table_name: b.table_name || this.tablesCache.find((t) => t.id === String(b.table_id))?.name || "Table",
            status: b.status,
            special_requests: b.special_requests || "",
            source: b.source || "staff",
            created_at: b.created_at,
          }))
          if (JSON.stringify(newBookings) !== JSON.stringify(this.bookingsCache)) {
            this.bookingsCache = newBookings
            try { localStorage.setItem(BOOKINGS_KEY, JSON.stringify(this.bookingsCache)) } catch {}
            bookingsChanged = true
          }
        }

        if (tableRes && tableRes.sessions && Array.isArray(tableRes.sessions)) {
          const serverSessions = tableRes.sessions.map((s: any) => ({
            id: String(s.id),
            table_id: String(s.table_id),
            table_name: s.table_name || this.tablesCache.find((t) => t.id === String(s.table_id))?.name || "Table",
            customer_name: s.customer_name,
            phone: s.phone,
            guest_count: Number(s.guest_count) || 2,
            seated_at: s.seated_at,
            status: s.status,
            notes: s.notes || "",
          }))

          // Merge: Keep all local active sessions (status !== 'closed') unless the server explicitly returned them as closed
          const mergedSessions = [...serverSessions]
          for (const localSess of this.sessionsCache) {
            if (localSess.status === "closed") continue
            const inServer = serverSessions.find((s: any) => s.id === localSess.id)
            if (!inServer) {
              mergedSessions.push(localSess)
            }
          }

          if (JSON.stringify(mergedSessions) !== JSON.stringify(this.sessionsCache)) {
            this.sessionsCache = mergedSessions
            try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessionsCache)) } catch {}
            sessionsChanged = true
          }
        }

        // Only emit if data ACTUALLY changed!
        if (tablesChanged) this.emitTables()
        if (bookingsChanged) this.emitBookings()
        if (sessionsChanged) this.emitSessions()
      } catch (err) {
        console.error("refreshFromApi failed:", err)
      } finally {
        this.isRefreshingApi = false
        this.apiRefreshPromise = null
      }
    })()

    return this.apiRefreshPromise
  }

  static async refresh(): Promise<void> {
    this.init()
    if (!this.isBrowser()) return
    if (!isSupabaseConfigured()) {
      await this.refreshFromApi()
      return
    }
    const now = Date.now()
    if (this.isRefreshing || now - this.lastRefreshTime < 2500) return
    this.isRefreshing = true
    this.lastRefreshTime = now
    try {
      const supabase = createClient()
      const [{ data: rows }, { data: sessions }, { data: bookings }] = await Promise.all([
        supabase.from("pos_tables").select("id,name,capacity,status").order("name"),
        supabase.from("table_sessions").select("id,table_id,customer_name,phone,guest_count,seated_at,status,notes").in("status", ["open", "bill_requested"]),
        supabase.from("reservations").select("*").in("status", ["pending", "confirmed", "arrived"]).order("reserved_for"),
      ])

      if (rows && Array.isArray(rows) && rows.length > 0) {
        const sessionByTable = new Map<string, any>()
        for (const s of (sessions as any[]) || []) sessionByTable.set(String(s.table_id), s)

        const bookingByTable = new Map<string, any>()
        const now = Date.now()
        for (const b of (bookings as any[]) || []) {
          const start = new Date(b.reserved_for).getTime()
          const end = start + (b.duration_minutes || 90) * 60000
          if (["pending", "confirmed", "arrived"].includes(b.status) && end > now) {
            if (b.table_id) bookingByTable.set(String(b.table_id), b)
            if (b.table_name) bookingByTable.set(b.table_name.toLowerCase(), b)
          }
        }

        const previous = new Map(this.tablesCache.map((t) => [t.id, t]))
        this.tablesCache = rows.map((row: any) => {
          const session = sessionByTable.get(String(row.id)) || sessionByTable.get(row.name.toLowerCase())
          const booking = bookingByTable.get(String(row.id)) || bookingByTable.get(row.name.toLowerCase())
          const prev = previous.get(String(row.id))

          let status: SharedTable["status"] = "available"
          if (session) {
            status = session.status === "bill_requested" ? "bill_requested" : "occupied"
          } else if (booking) {
            status = "reserved"
          } else if (row.status === "cleaning") {
            status = "cleaning"
          } else if (row.status === "occupied") {
            const hasActiveOrder =
              this.ordersCache.some((o) => o.status === "open" && sameName(o.table_name, row.name)) ||
              this.sessionsCache.some(
                (s) => (s.table_id === String(row.id) || sameName(s.table_name, row.name)) && s.status !== "closed"
              )
            status = hasActiveOrder ? "occupied" : "available"
          } else if (row.status === "reserved" || prev?.status === "reserved") {
            status = "reserved"
          }

          return {
            id: String(row.id),
            name: row.name,
            capacity: Number(row.capacity) || 2,
            status,
            department: status === "occupied" ? prev?.department : undefined,
            orderNumber: status === "occupied" ? prev?.orderNumber : undefined,
            orderTotal: status === "occupied" ? prev?.orderTotal : undefined,
            guestName: session?.customer_name || booking?.customer_name || (status === "reserved" ? prev?.guestName : undefined),
            occupiedAt: session?.seated_at || (booking ? booking.reserved_for : (status === "reserved" ? prev?.occupiedAt : undefined)),
            bookingId: booking?.id || (status === "reserved" ? prev?.bookingId : undefined),
          }
        })
        localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
        this.emitTables()
      }

      if (bookings && Array.isArray(bookings)) {
        this.bookingsCache = bookings.map((b: any) => ({
          id: String(b.id),
          customer_name: b.customer_name,
          phone: b.phone,
          party_size: Number(b.party_size) || 2,
          reserved_for: b.reserved_for,
          duration_minutes: Number(b.duration_minutes) || 90,
          table_id: String(b.table_id),
          table_name: b.table_name || this.tablesCache.find((t) => t.id === String(b.table_id))?.name || "Table",
          status: b.status,
          special_requests: b.special_requests || "",
          source: b.source || "staff",
          created_at: b.created_at,
        }))
        localStorage.setItem(BOOKINGS_KEY, JSON.stringify(this.bookingsCache))
        this.emitBookings()
      }

      if (sessions && Array.isArray(sessions)) {
        this.sessionsCache = sessions.map((s: any) => ({
          id: String(s.id),
          table_id: String(s.table_id),
          table_name: this.tablesCache.find((t) => t.id === String(s.table_id))?.name || "Table",
          customer_name: s.customer_name,
          phone: s.phone,
          guest_count: Number(s.guest_count) || 2,
          seated_at: s.seated_at,
          status: s.status,
          notes: s.notes,
        }))
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessionsCache))
      }
    } catch {} finally {
      this.isRefreshing = false
    }
  }

  static async occupyTable(
    tableName: string,
    department: "Juice & Food" | "Coffee Bar" = "Juice & Food",
    orderNumber?: string,
    orderTotal?: number,
    guestName?: string,
  ) {
    this.init()
    if (isTakeaway(tableName)) return
    let table: SharedTable | undefined = this.tablesCache.find((t) => sameName(t.name, tableName))
    if (!table) {
      const cleanName = tableName.trim()
      const newTable: SharedTable = {
        id: `tbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        capacity: 4,
        status: "occupied",
      }
      this.tablesCache = [...this.tablesCache, newTable]
      table = newTable
    }

    const nowIso = new Date().toISOString()
    this.tablesCache = this.tablesCache.map((t) =>
      sameName(t.name, tableName)
        ? {
            ...t,
            status: "occupied",
            department,
            orderNumber: orderNumber || t.orderNumber,
            orderTotal: orderTotal !== undefined ? orderTotal : t.orderTotal,
            guestName: guestName || t.guestName || "Dine-in Guest",
            occupiedAt: t.occupiedAt || nowIso,
          }
        : t,
    )

    // Save or update active session
    const existingSession = this.sessionsCache.find(
      (s) => (s.table_id === table.id || sameName(s.table_name, table.name)) && s.status !== "closed"
    )
    if (!existingSession) {
      const newSession: SharedSession = {
        id: "ses-" + Date.now(),
        table_id: table.id,
        table_name: table.name,
        customer_name: guestName || "Walk-in Guest",
        guest_count: table.capacity,
        seated_at: nowIso,
        status: "open",
        notes: orderNumber ? `Order #${orderNumber}` : "",
      }
      this.sessionsCache = [newSession, ...this.sessionsCache]
    } else {
      this.sessionsCache = this.sessionsCache.map((s) =>
        s.id === existingSession.id
          ? {
              ...s,
              status: "open",
              customer_name: guestName || s.customer_name,
              notes: orderNumber ? `Order #${orderNumber}` : s.notes,
            }
          : s
      )
    }

    if (this.isBrowser()) {
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessionsCache))
        localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
      } catch {}
    }
    this.emitTables()
    this.emitSessions()
    this.broadcast("tables")
    this.broadcast("sessions")

    try {
      if (this.isBrowser()) {
        await fetch("/api/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "occupy",
            tableId: table.id,
            tableName: table.name,
            orderNumber,
            orderTotal,
            guestName: guestName || "Dine-in Guest",
            department,
          }),
        }).catch(() => {})
      }
      const supabase = createClient()
      void supabase.from("pos_tables").update({ status: "occupied" }).eq("id", table.id)
      void supabase.from("table_sessions").upsert({
        table_id: table.id,
        customer_name: guestName || "Dine-in Guest",
        guest_count: table.capacity,
        seated_at: nowIso,
        status: "open",
        notes: orderNumber ? `Order #${orderNumber}` : "",
      })
    } catch {}
  }

  static async releaseTable(tableName: string) {
    this.init()
    if (isTakeaway(tableName)) return "available"
    const table = this.tablesCache.find((t) => sameName(t.name, tableName))
    if (!table) return "available"

    const nowIso = new Date().toISOString()

    // 1. Immediately update local state so UI updates with ZERO lag
    this.tablesCache = this.tablesCache.map((t) =>
      sameName(t.name, tableName)
        ? {
            ...t,
            status: "available",
            releasedAt: nowIso,
            occupiedAt: undefined,
            department: undefined,
            orderNumber: undefined,
            orderTotal: undefined,
            guestName: undefined,
            bookingId: undefined,
          }
        : t,
    )

    this.sessionsCache = this.sessionsCache.map((s) =>
      (s.table_id === table.id || sameName(s.table_name, table.name)) && s.status !== "closed"
        ? { ...s, status: "closed" as const, closed_at: nowIso }
        : s,
    )

    if (this.isBrowser()) {
      try {
        localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessionsCache))
      } catch {}
    }
    this.emitTables()
    this.emitSessions()
    this.broadcast("tables")
    this.broadcast("sessions")

    // 2. Persist to API and Supabase
    let serverStatus = "available"
    if (this.isBrowser()) {
      try {
        const res = await fetch("/api/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "release", tableId: table.id, tableName: table.name }),
        })
        const data = await res.json()
        if (data.status) serverStatus = data.status
      } catch {}
    }

    try {
      const supabase = createClient()
      void supabase.from("pos_tables").update({ status: "available" }).eq("id", table.id)
      void supabase
        .from("table_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("table_id", table.id)
        .in("status", ["open", "bill_requested"])
    } catch {}

    return serverStatus
  }

  static async setTableStatus(tableIdOrName: string, status: SharedTable["status"]) {
    this.init()
    const table = this.tablesCache.find((t) => t.id === tableIdOrName || sameName(t.name, tableIdOrName))
    if (!table) return
    if (status === "available") return this.releaseTable(table.name)
    if (status === "occupied") return this.occupyTable(table.name)

    const nowIso = new Date().toISOString()
    this.tablesCache = this.tablesCache.map((t) =>
      t.id === table.id ? { ...t, status, releasedAt: status === "cleaning" ? nowIso : t.releasedAt } : t
    )

    if (status === "bill_requested") {
      this.sessionsCache = this.sessionsCache.map((s) =>
        (s.table_id === table.id || sameName(s.table_name, table.name)) && s.status !== "closed"
          ? { ...s, status: "bill_requested" as const }
          : s
      )
      if (this.isBrowser()) {
        try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessionsCache)) } catch {}
      }
      this.emitSessions()
      this.broadcast("sessions")
    }

    if (this.isBrowser()) {
      try { localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache)) } catch {}
    }
    this.emitTables()
    this.broadcast("tables")

    try {
      if (this.isBrowser()) {
        fetch("/api/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId: table.id, tableName: table.name, status }),
        }).catch(() => {})
      }
      const supabase = createClient()
      void supabase.from("pos_tables").update({ status }).eq("id", table.id)
    } catch {}
  }

  static async addTable(name: string, capacity: number) {
    this.init()
    const clean = name.trim()
    if (!clean) throw new Error("Table name is required")
    if (this.tablesCache.find((t) => sameName(t.name, clean))) throw new Error(`${clean} already exists`)

    const newTable: SharedTable = {
      id: "tbl-" + Date.now(),
      name: clean,
      capacity,
      status: "available",
    }
    this.tablesCache = [...this.tablesCache, newTable]
    localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
    this.emitTables()
    this.broadcast("tables")

    if (isSupabaseConfigured()) {
      try {
        await createClient().from("pos_tables").insert({ name: clean, capacity, status: "available" })
        await this.refresh()
      } catch {}
    }
  }

  // --- BOOKINGS / RESERVATIONS APIS ----------------------------------------
  static getBookings(): SharedBooking[] {
    this.init()
    return this.bookingsCache
  }

  static getSessions(): SharedSession[] {
    this.init()
    return this.sessionsCache
  }

  static async addBooking(booking: Omit<SharedBooking, "id">) {
    this.init()
    if (this.isBrowser()) {
      const res = await fetch("/api/tables/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...booking }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create booking")
      }
      await this.refreshFromApi()
      this.broadcast("bookings")
      this.broadcast("tables")
      return data.reservation
    }

    const newBooking: SharedBooking = {
      ...booking,
      id: "res-" + Date.now(),
      created_at: new Date().toISOString(),
    }
    this.bookingsCache = [newBooking, ...this.bookingsCache]
    return newBooking
  }

  static async updateBooking(id: string, updates: Partial<SharedBooking>) {
    this.init()
    if (this.isBrowser()) {
      const res = await fetch("/api/tables/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, ...updates }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update booking")
      }
      await this.refreshFromApi()
      this.broadcast("bookings")
      this.broadcast("tables")
      return data.reservation
    }
  }

  static async rescheduleBooking(id: string, tableId: string, tableName: string, reservedFor: string, durationMinutes?: number) {
    return this.updateBooking(id, {
      table_id: tableId,
      table_name: tableName,
      reserved_for: reservedFor,
      duration_minutes: durationMinutes,
    })
  }

  static async seatBooking(id: string, guestCount?: number) {
    this.init()
    if (this.isBrowser()) {
      const res = await fetch("/api/tables/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seat", id, guestCount }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to seat booking")
      }
      await this.refreshFromApi()
      this.broadcast("bookings")
      this.broadcast("tables")
      this.broadcast("sessions")
      return data.session
    }
  }

  static async seatWalkIn(tableNameOrId: string, guestInfo?: { customer_name?: string; phone?: string; guest_count?: number; notes?: string }) {
    this.init()
    const table = this.tablesCache.find((t) => t.id === tableNameOrId || sameName(t.name, tableNameOrId))
    const nowIso = new Date().toISOString()
    if (table) {
      this.tablesCache = this.tablesCache.map((t) =>
        t.id === table.id
          ? {
              ...t,
              status: "occupied",
              guestName: guestInfo?.customer_name || "Walk-in Guest",
              occupiedAt: nowIso,
              releasedAt: undefined,
            }
          : t
      )
      const existingSession = this.sessionsCache.find(
        (s) => (s.table_id === table.id || sameName(s.table_name, table.name)) && s.status !== "closed"
      )
      if (!existingSession) {
        const newSession: SharedSession = {
          id: "ses-" + Date.now(),
          table_id: table.id,
          table_name: table.name,
          customer_name: guestInfo?.customer_name || "Walk-in Guest",
          phone: guestInfo?.phone,
          guest_count: guestInfo?.guest_count || table.capacity || 2,
          seated_at: nowIso,
          status: "open",
          notes: guestInfo?.notes || "Walk-in seated",
        }
        this.sessionsCache = [newSession, ...this.sessionsCache]
      }
      if (this.isBrowser()) {
        try {
          localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
          localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessionsCache))
        } catch {}
      }
      this.emitTables()
      this.emitSessions()
      this.broadcast("tables")
      this.broadcast("sessions")
    }

    if (this.isBrowser()) {
      try {
        const res = await fetch("/api/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "seat", tableName: tableNameOrId, guestInfo }),
        })
        const data = await res.json()
        await this.refreshFromApi()
        return data?.session
      } catch {}
    }
  }

  static async updateBookingStatus(id: string, status: SharedBooking["status"]) {
    this.init()
    if (this.isBrowser()) {
      const action = status === "cancelled" ? "cancel" : "status"
      const res = await fetch("/api/tables/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, status }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update booking status")
      }
      await this.refreshFromApi()
      this.broadcast("bookings")
      this.broadcast("tables")
      return
    }

    const targetBooking = this.bookingsCache.find((b) => b.id === id)
    this.bookingsCache = this.bookingsCache.map((b) => (b.id === id ? { ...b, status } : b))
    if (status === "cancelled" || status === "no_show" || status === "completed") {
      this.tablesCache = this.tablesCache.map((t) => {
        const matches =
          t.bookingId === id ||
          (targetBooking && (t.id === targetBooking.table_id || sameName(t.name, targetBooking.table_name)))
        if (matches && t.status === "reserved") {
          return {
            ...t,
            status: "available" as const,
            bookingId: undefined,
            guestName: undefined,
            occupiedAt: undefined,
          }
        }
        return t
      })
    }
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(this.bookingsCache))
    localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
    this.emitBookings()
    this.emitTables()
    this.broadcast("bookings")
    this.broadcast("tables")

    if (isSupabaseConfigured()) {
      try {
        await createClient()
          .from("reservations")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", id)
      } catch {}
    }
  }

  // --- PRODUCTS & CATEGORIES APIS ------------------------------------------
  static getProducts(): SharedProduct[] {
    this.init()
    return this.productsCache
  }

  static getCategories(): SharedCategory[] {
    this.init()
    return this.categoriesCache
  }

  private static async refreshProductsFromCloud() {
    if (!this.isBrowser()) return
    try {
      // 1. Fetch authoritative products from SQL API
      let apiProds: any[] = []
      try {
        const aRes = await fetch("/api/products", { cache: "no-store" })
        if (aRes.ok) {
          const aJson = await aRes.json()
          if (Array.isArray(aJson?.products) && aJson.products.length > 0) {
            apiProds = aJson.products
          }
        }
      } catch {}

      // 2. Fetch from Supabase if configured
      let ps: any[] = []
      let cs: any[] = []
      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient()
          const [pRes, cRes] = await Promise.all([
            supabase.from("pos_products").select("*").eq("is_archived", false).order("name"),
            supabase.from("pos_categories").select("*").eq("is_active", true).order("sort_order"),
          ])
          if (Array.isArray(pRes.data)) ps = pRes.data
          if (Array.isArray(cRes.data)) cs = cRes.data
        } catch {}
      }

      if (cs.length > 0) {
        this.categoriesCache = cs.map((c: any) => ({ id: String(c.id), name: c.name, sort_order: c.sort_order }))
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(this.categoriesCache))
        this.emitCategories()
      }

      const incoming = apiProds.length > 0 ? apiProds : ps
      if (Array.isArray(incoming) && incoming.length > 0) {
        const catMap = new Map(this.categoriesCache.map((c) => [c.id, c.name]))
        const mappedIncoming = incoming.filter((p: any) => p.active !== false && p.is_archived !== true).map((p: any) => {
          const categoryName = catMap.get(String(p.category_id)) || p.category_name || p.category || "General"
          const station = (p.station as "kitchen" | "bar") || determineItemStation({
            station: p.station,
            department: p.department || p.department_override,
            category: categoryName,
            name: p.name,
          })
          return {
            id: String(p.id),
            name: p.name,
            price: Number(p.price != null ? p.price : 0),
            category: categoryName,
            category_id: p.category_id ? String(p.category_id) : undefined,
            image: p.image || "/placeholder.svg",
            stock: Number(p.stock != null ? p.stock : 0),
            description: p.description || "",
            temperature: p.temperature || "none",
            dietary_tags: Array.isArray(p.dietary_tags) ? p.dietary_tags : [],
            department: p.department || p.department_override || (station === "bar" ? "Coffee Bar" : "Juice & Food"),
            station,
            active: p.active !== false,
            is_archived: p.is_archived === true,
            updated_at: p.updated_at ? String(p.updated_at) : undefined,
          }
        })

        // Overlay with productsCache preserving custom values
        const cacheMap = new Map<string, SharedProduct>()
        this.productsCache.forEach((p) => cacheMap.set(p.name.trim().toLowerCase(), p))
        mappedIncoming.forEach((mp) => {
          const key = mp.name.trim().toLowerCase()
          const existing = cacheMap.get(key)
          let finalPrice = existing?.price ?? mp.price
          if (!existing?.user_customized && mp.price > 0) {
            finalPrice = mp.price
          } else if (existing?.user_customized && mp.updated_at && existing.updated_at && new Date(mp.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
            finalPrice = mp.price
          }

          let finalImage = existing?.image || mp.image
          if (!existing?.user_customized) {
            if (mp.image && !mp.image.includes("placeholder")) {
              finalImage = mp.image
            }
          } else if (existing?.user_customized) {
            const defaultSeed = PRODUCT_IMAGE_MAP[mp.name?.trim()]
            if (mp.image && !mp.image.includes("placeholder") && mp.image !== defaultSeed) {
              if (mp.updated_at && existing.updated_at && new Date(mp.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
                finalImage = mp.image
              }
            }
          }

          let finalStock = mp.stock
          if (existing?.updated_at && mp.updated_at) {
            const existingTime = new Date(existing.updated_at).getTime()
            const incomingTime = new Date(mp.updated_at).getTime()
            if (existingTime > incomingTime) {
              finalStock = existing.stock
            }
          } else if (existing?.stock !== undefined && (mp.stock === undefined || mp.stock === null)) {
            finalStock = existing.stock
          }

          cacheMap.set(key, {
            ...existing,
            ...mp,
            id: existing?.id || mp.id,
            price: finalPrice,
            image: finalImage,
            stock: finalStock,
            user_customized: existing?.user_customized,
            updated_at: existing?.updated_at && mp.updated_at && new Date(existing.updated_at).getTime() > new Date(mp.updated_at).getTime() ? existing.updated_at : (mp.updated_at || existing?.updated_at),
          })
        })
        this.productsCache = Array.from(cacheMap.values())
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
        this.emitProducts()
      }
    } catch {}
  }

  static async saveProduct(product: Partial<SharedProduct> & { name: string; price: number }, originalId?: string) {
    this.init()
    const isNew = !product.id || product.id.startsWith("new-")
    const id = isNew ? "prod-" + Date.now() : product.id!
    const targetName = (product.name || "").trim().toLowerCase()
    const targetId = String(id)
    const origId = originalId ? String(originalId) : ""

    const station = product.station || determineItemStation({
      station: product.station,
      department: product.department,
      category: product.category,
      name: product.name,
    })
    const department = product.department || (station === "bar" ? "Coffee Bar" : "Juice & Food")
    const prevItem = this.productsCache.find((p) => String(p.id) === targetId || (origId && String(p.id) === origId) || (p.name && p.name.trim().toLowerCase() === targetName))
    const parsedStock = product.stock !== undefined && !isNaN(Number(product.stock)) ? Math.max(0, parseInt(String(product.stock), 10)) : (prevItem?.stock ?? 0)

    const cleanProduct: SharedProduct = {
      id,
      name: product.name.trim(),
      price: Number(product.price) || 0,
      category: product.category || (station === "bar" ? "Fresh Juices" : "Mains"),
      category_id: product.category_id,
      image: product.image || "/latte-coffee.png",
      stock: parsedStock,
      description: product.description || "",
      temperature: product.temperature || "none",
      dietary_tags: product.dietary_tags || [],
      department,
      station,
      active: product.active !== false,
      is_archived: false,
      user_customized: true,
      updated_at: new Date().toISOString(),
    }

    if (prevItem && prevItem.stock !== cleanProduct.stock) {
      this.logMovement({
        product_id: cleanProduct.id,
        product_name: cleanProduct.name,
        department: (cleanProduct.department as any) || "Coffee Bar",
        quantity_change: cleanProduct.stock - prevItem.stock,
        reason: "Product catalog edit",
      })
    }

    let matched = false
    this.productsCache = this.productsCache.map((p) => {
      const matchId = String(p.id) === targetId || (origId && String(p.id) === origId) || (product.id && String(p.id) === String(product.id))
      const matchName = p.name && p.name.trim().toLowerCase() === targetName
      if (matchId || matchName) {
        matched = true
        return { ...p, ...cleanProduct, id: p.id }
      }
      return p
    })
    if (!matched) {
      if (isNew) {
        this.productsCache = [cleanProduct, ...this.productsCache]
      } else {
        this.productsCache = [{ ...cleanProduct, id }, ...this.productsCache]
      }
    }

    // Also update DEFAULT_PRODUCTS in memory
    DEFAULT_PRODUCTS.forEach((dp) => {
      if (String(dp.id) === targetId || (origId && String(dp.id) === origId) || (dp.name && dp.name.trim().toLowerCase() === targetName)) {
        Object.assign(dp, cleanProduct)
      }
    })

    try {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
    } catch {}

    // Update pos_product_overrides cookie in browser
    if (typeof document !== "undefined") {
      try {
        const match = document.cookie.match(/pos_product_overrides=([^;]+)/)
        let curOverrides: Record<string, any> = {}
        if (match && match[1]) {
          try { curOverrides = JSON.parse(decodeURIComponent(match[1])) } catch {}
        }
        const oData: Record<string, any> = {
          price: cleanProduct.price,
          stock: cleanProduct.stock,
          updated_at: cleanProduct.updated_at,
        }
        if (cleanProduct.image && !cleanProduct.image.startsWith("data:") && cleanProduct.image.length < 500) {
          oData.image = cleanProduct.image
        }
        curOverrides[id] = oData
        if (cleanProduct.name) {
          curOverrides[cleanProduct.name.trim().toLowerCase()] = oData
        }
        document.cookie = `pos_product_overrides=${encodeURIComponent(JSON.stringify(curOverrides))}; path=/; max-age=2592000; SameSite=Lax`
      } catch {}
    }

    this.emitProducts()
    this.broadcast("products", cleanProduct)

    // API sync for full consistency across sessions and stations
    try {
      if (isNew) {
        void fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: cleanProduct.name,
            price: cleanProduct.price,
            stock: cleanProduct.stock,
            image: cleanProduct.image,
            category_id: cleanProduct.category_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanProduct.category_id) ? cleanProduct.category_id : undefined,
            description: cleanProduct.description,
            department: cleanProduct.department,
            station: cleanProduct.station,
            active: cleanProduct.active,
          }),
        }).catch((err) => console.warn("Failed posting product to /api/products", err))
      } else {
        void fetch(`/api/products/${encodeURIComponent(origId || id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: cleanProduct.name,
            price: cleanProduct.price,
            stock: cleanProduct.stock,
            image: cleanProduct.image,
            category_id: cleanProduct.category_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanProduct.category_id) ? cleanProduct.category_id : undefined,
            description: cleanProduct.description,
            department: cleanProduct.department,
            station: cleanProduct.station,
            active: cleanProduct.active,
          }),
        }).catch((err) => console.warn("Failed updating product on /api/products/[id]", err))
      }
    } catch {}

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        if (isNew) {
          await supabase.from("pos_products").insert({
            name: cleanProduct.name,
            price: cleanProduct.price,
            stock: cleanProduct.stock,
            image: cleanProduct.image,
            category_id: cleanProduct.category_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanProduct.category_id) ? cleanProduct.category_id : null,
            description: cleanProduct.description,
            temperature: cleanProduct.temperature,
            dietary_tags: cleanProduct.dietary_tags,
            department_override: cleanProduct.department,
            station: cleanProduct.station,
            active: true,
            updated_at: new Date().toISOString(),
          })
        } else {
          const upPayload = {
            name: cleanProduct.name,
            price: cleanProduct.price,
            stock: cleanProduct.stock,
            image: cleanProduct.image,
            category_id: cleanProduct.category_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanProduct.category_id) ? cleanProduct.category_id : null,
            description: cleanProduct.description,
            temperature: cleanProduct.temperature,
            dietary_tags: cleanProduct.dietary_tags,
            department_override: cleanProduct.department,
            station: cleanProduct.station,
            updated_at: new Date().toISOString(),
          }
          if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
            await supabase.from("pos_products").update(upPayload).eq("id", id)
          } else {
            await supabase.from("pos_products").update(upPayload).ilike("name", cleanProduct.name)
          }
        }
      } catch {}
    }
    return cleanProduct
  }

  static async deleteProduct(id: string) {
    this.init()
    this.productsCache = this.productsCache.filter((p) => p.id !== id)
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
    this.emitProducts()
    this.broadcast("products")

    try {
      void fetch(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" })
        .catch((err) => console.warn("Failed soft-deleting product", err))
    } catch {}

    if (isSupabaseConfigured()) {
      try {
        await createClient().from("pos_products").update({ is_archived: true, active: false, updated_at: new Date().toISOString() }).eq("id", id)
      } catch {}
    }
  }

  static async adjustStock(productId: string, quantityChange: number, reason = "Stock Adjustment") {
    this.init()
    const prod = this.productsCache.find((p) => p.id === productId || sameName(p.name, productId))
    if (!prod) return

    const newStock = Math.max(0, prod.stock + quantityChange)
    this.productsCache = this.productsCache.map((p) => (p.id === prod.id ? { ...p, stock: newStock } : p))
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
    this.emitProducts()
    this.broadcast("products")
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos_products_updated", { detail: { id: prod.id, stock: newStock } }))
    }

    this.logMovement({
      product_id: prod.id,
      product_name: prod.name,
      department: (prod.department as any) || "Juice & Food",
      quantity_change: quantityChange,
      reason,
    })

    if (this.isBrowser()) {
      try {
        void fetch(`/api/products/${encodeURIComponent(prod.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stock: newStock }),
        }).catch((err) => console.warn("Failed syncing adjusted stock to /api/products/[id]", err))
      } catch {}
    }

    if (isSupabaseConfigured()) {
      try {
        await createClient().from("pos_products").update({ stock: newStock }).eq("id", prod.id)
      } catch {}
    }
  }

  static async addCategory(name: string, id?: string) {
    this.init()
    const clean = name.trim()
    if (!clean) return
    const catId = id || "cat-" + clean.toLowerCase().replace(/[^a-z0-9]/g, "-")
    const newCat: SharedCategory = { id: catId, name: clean, sort_order: this.categoriesCache.length + 1 }
    this.categoriesCache = [...this.categoriesCache.filter((c) => c.name.toLowerCase() !== clean.toLowerCase()), newCat]
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(this.categoriesCache))
    this.broadcast("categories", newCat)
    this.emitCategories()

    if (isSupabaseConfigured() && !id) {
      try {
        const { data } = await createClient()
          .from("pos_categories")
          .insert({ name: clean, sort_order: newCat.sort_order, is_active: true })
          .select("id")
          .single()
        if (data?.id) {
          newCat.id = String(data.id)
          this.categoriesCache = this.categoriesCache.map((c) => (c.name.toLowerCase() === clean.toLowerCase() ? { ...c, id: String(data.id) } : c))
          localStorage.setItem(CATEGORIES_KEY, JSON.stringify(this.categoriesCache))
          this.broadcast("categories", newCat)
          this.emitCategories()
        }
      } catch {}
    }
    return newCat
  }

  // --- ORDERS & REPORTS APIS -----------------------------------------------
  static getOrders(): SharedOrder[] {
    this.init()
    return this.ordersCache
  }

  static getTerminalId(): string {
    if (typeof window === "undefined") return "SRV"
    let tid = localStorage.getItem("pos_terminal_id")
    if (!tid) {
      tid = `T${Math.floor(10 + Math.random() * 90)}`
      localStorage.setItem("pos_terminal_id", tid)
    }
    return tid
  }

  static getOfflineOrderNumber(): { orderNumber: string; receiptNumber: string; seq: number } {
    this.init()
    const tid = this.getTerminalId()
    let maxSeq = 100
    for (const o of this.ordersCache) {
      if (!o.order_number) continue
      const match = o.order_number.match(/(\d+)/)
      if (match) {
        const val = parseInt(match[1], 10)
        if (!isNaN(val) && val > maxSeq) {
          maxSeq = val
        }
      }
    }
    const nextSeq = maxSeq + 1
    const formatted = String(nextSeq).padStart(6, "0")
    return {
      orderNumber: `OFFLINE-${tid}-${formatted}`,
      receiptNumber: `OFFLINE-RC-${tid}-${formatted}`,
      seq: nextSeq,
    }
  }

  static getNextOrderNumber(): { orderNumber: string; receiptNumber: string; seq: number } {
    this.init()
    let maxSeq = 100
    for (const o of this.ordersCache) {
      if (!o.order_number) continue
      const match = o.order_number.match(/(\d+)/)
      if (match) {
        const val = parseInt(match[1], 10)
        if (!isNaN(val) && val > maxSeq) {
          maxSeq = val
        }
      }
    }
    const nextSeq = maxSeq + 1
    const formatted = String(nextSeq).padStart(6, "0")
    return {
      orderNumber: `LS-${formatted}`,
      receiptNumber: `LS-RC-${formatted}`,
      seq: nextSeq,
    }
  }

  static async allocateNextOrderNumber(): Promise<{ orderNumber: string; receiptNumber: string; seq: number }> {
    this.init()

    // Calculate maximum known sequence on client to prevent sequence collisions
    let maxKnownSeq = 100
    for (const o of this.ordersCache) {
      if (!o.order_number) continue
      const m = o.order_number.match(/(\d+)/)
      if (m) {
        const val = parseInt(m[1], 10)
        if (!isNaN(val) && val > maxKnownSeq) maxKnownSeq = val
      }
    }
    if (this.sharedNextSeq > maxKnownSeq) {
      maxKnownSeq = this.sharedNextSeq - 1
    }

    if (this.isBrowser()) {
      // 1. Direct Supabase RPC for maximum speed if configured in client
      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient()
          const { data, error } = await supabase.rpc("get_next_bill_numbers")
          if (!error && data && data.order_number) {
            let seq = Number(data.seq) || (maxKnownSeq + 1)
            if (seq <= maxKnownSeq) {
              seq = maxKnownSeq + 1
            }
            this.sharedNextSeq = Math.max(this.sharedNextSeq, seq + 1)
            const formatted = String(seq).padStart(6, "0")
            return {
              orderNumber: `LS-${formatted}`,
              receiptNumber: `LS-RC-${formatted}`,
              seq,
            }
          }
        } catch {
          // Fall back to server endpoint
        }
      }

      // 2. Next.js API server endpoint fallback (handles service-role key or SQLite atomic sequence)
      try {
        const res = await fetch("/api/orders/next-number", { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          if (data.success && (data.orderNumber || data.seq)) {
            let seq = Number(data.seq) || (maxKnownSeq + 1)
            if (seq <= maxKnownSeq) {
              seq = maxKnownSeq + 1
            }
            this.sharedNextSeq = Math.max(this.sharedNextSeq, seq + 1)
            const formatted = String(seq).padStart(6, "0")
            return {
              orderNumber: `LS-${formatted}`,
              receiptNumber: `LS-RC-${formatted}`,
              seq,
            }
          }
        }
      } catch (err) {
        console.warn("Could not allocate server order sequence, falling back to client sequence", err)
      }
    }

    const nextSeq = maxKnownSeq + 1
    this.sharedNextSeq = Math.max(this.sharedNextSeq, nextSeq + 1)
    const formatted = String(nextSeq).padStart(6, "0")
    return {
      orderNumber: `LS-${formatted}`,
      receiptNumber: `LS-RC-${formatted}`,
      seq: nextSeq,
    }
  }

  static restockAllProducts(amount = 100) {
    this.init()
    this.productsCache = this.productsCache.map((p) => ({
      ...p,
      stock: Math.max(p.stock, amount),
    }))
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
    this.emitProducts()
    this.broadcast("products")
  }

  private static mapDbOrderToShared(o: any): SharedOrder {
    return {
      id: String(o.id),
      order_number: o.order_number,
      receipt_number: o.receipt_number || "",
      table_name: o.table_name || "Takeaway",
      cashier_name: o.cashier_name || "Staff",
      department: o.department || "Juice & Food",
      order_type: o.order_type || (o.table_name === "Takeaway" ? "takeaway" : "dine_in"),
      items: Array.isArray(o.order_items) && o.order_items.length > 0
        ? o.order_items.map((i: any) => ({
            id: i.product_id || i.id,
            name: i.product_name_snapshot,
            price: Number(i.unit_price_snapshot) || 0,
            quantity: Number(i.quantity) || 1,
            station: i.station,
          }))
        : Array.isArray(o.items)
        ? o.items
        : [],
      subtotal: Number(o.subtotal) || 0,
      service_charge: Number(o.service_charge) || 0,
      service_charge_rate: Number(o.service_charge_rate) || 0,
      discount: Number(o.discount) || 0,
      total: Number(o.total) || 0,
      payment_method: o.payment_method || "cash",
      split_payments: Array.isArray(o.split_payments)
        ? o.split_payments
        : (typeof o.notes === "string" && o.notes.includes("split_payments")
          ? (() => { try { return JSON.parse(o.notes).split_payments } catch { return undefined } })()
          : undefined),
      cash_received: o.cash_received != null ? Number(o.cash_received) : undefined,
      change_amount: o.change_amount != null ? Number(o.change_amount) : undefined,
      status: o.status || "paid",
      payment_status: o.payment_status || (o.status === "open" ? "unpaid" : "paid"),
      kitchen_status: o.kitchen_status || "served",
      bar_status: o.bar_status || "served",
      stock_deducted: Boolean(o.stock_deducted),
      idempotency_key: o.idempotency_key || undefined,
      offline_ref: o.offline_ref || undefined,
      created_at: o.created_at || new Date().toISOString(),
    }
  }

  private static async refreshOrdersFromCloud() {
    if (!this.isBrowser() || this.isRefreshingOrders) return
    this.isRefreshingOrders = true
    try {
      let fetchedOrders: SharedOrder[] = []

      if (isSupabaseConfigured()) {
        const client = createClient()

        // 1. ALWAYS query all active/open dine-in orders unconditionally
        // Guarantees active tabs and table occupancy are retained regardless of history pagination
        try {
          const { data: openData, error: openErr } = await client
            .from("pos_orders")
            .select(`
              id, order_number, receipt_number, table_name, cashier_name, department,
              order_type, subtotal, service_charge, service_charge_rate, discount, tax,
              total, payment_method, split_payments, cash_received, change_amount,
              status, payment_status, kitchen_status, bar_status, items, stock_deducted,
              customer_id, customer_name, created_at, updated_at,
              order_items (
                id, product_id, product_name_snapshot, unit_price_snapshot, quantity, station, item_status
              )
            `)
            .in("status", ["open", "pending"])
            .order("created_at", { ascending: true })

          if (!openErr && Array.isArray(openData)) {
            for (const o of openData) {
              fetchedOrders.push(this.mapDbOrderToShared(o))
            }
          }
        } catch (openEx) {
          console.warn("Failed fetching open orders:", openEx)
        }

        // 2. Incremental forward cursor pagination (updated_at ASC, id ASC)
        if (!this.lastOrdersSyncTimestamp) {
          // Initial sync: fetch latest 50 orders
          const { data: initialData, error: initialErr } = await client
            .from("pos_orders")
            .select(`
              id, order_number, receipt_number, table_name, cashier_name, department,
              order_type, subtotal, service_charge, service_charge_rate, discount, tax,
              total, payment_method, split_payments, cash_received, change_amount,
              status, payment_status, kitchen_status, bar_status, items, stock_deducted,
              customer_id, customer_name, created_at, updated_at,
              order_items (
                id, product_id, product_name_snapshot, unit_price_snapshot, quantity, station, item_status
              )
            `)
            .order("updated_at", { ascending: false })
            .limit(50)

          if (!initialErr && Array.isArray(initialData) && initialData.length > 0) {
            for (const o of initialData) {
              fetchedOrders.push(this.mapDbOrderToShared(o))
            }
            const highest = initialData[0]
            if (highest?.updated_at) {
              const nowIso = new Date().toISOString()
              this.lastOrdersSyncTimestamp = highest.updated_at > nowIso ? nowIso : highest.updated_at
              this.lastOrdersSyncId = String(highest.id)
            }
          }
        } else {
          // Forward cursor loop: consume all batches without dropping records
          let hasMore = true
          let pageCount = 0
          while (hasMore && pageCount < 10) {
            pageCount++
            let query = client
              .from("pos_orders")
              .select(`
                id, order_number, receipt_number, table_name, cashier_name, department,
                order_type, subtotal, service_charge, service_charge_rate, discount, tax,
                total, payment_method, split_payments, cash_received, change_amount,
                status, payment_status, kitchen_status, bar_status, items, stock_deducted,
                customer_id, customer_name, created_at, updated_at,
                order_items (
                  id, product_id, product_name_snapshot, unit_price_snapshot, quantity, station, item_status
                )
              `)
              .order("updated_at", { ascending: true })
              .order("id", { ascending: true })
              .limit(50)

            if (this.lastOrdersSyncId) {
              query = query.or(
                `updated_at.gt.${this.lastOrdersSyncTimestamp},and(updated_at.eq.${this.lastOrdersSyncTimestamp},id.gt.${this.lastOrdersSyncId})`
              )
            } else {
              query = query.gt("updated_at", this.lastOrdersSyncTimestamp)
            }

            const { data, error } = await query
            if (error || !Array.isArray(data) || data.length === 0) {
              hasMore = false
              break
            }

            for (const o of data) {
              fetchedOrders.push(this.mapDbOrderToShared(o))
            }

            const lastRec = data[data.length - 1]
            if (lastRec?.updated_at) {
              const nowIso = new Date().toISOString()
              this.lastOrdersSyncTimestamp = lastRec.updated_at > nowIso ? nowIso : lastRec.updated_at
              this.lastOrdersSyncId = String(lastRec.id)
            }

            if (data.length < 50) {
              hasMore = false
            }
          }
        }
      } else {
        // Fallback for demo / offline mode
        try {
          const res = await fetch("/api/orders?limit=50", { cache: "no-store" })
          if (res.ok) {
            const json = await res.json()
            if (json.orders && Array.isArray(json.orders)) {
              fetchedOrders = json.orders
              this.lastOrdersSyncTimestamp = new Date().toISOString()
            }
          }
        } catch {}
      }

      if (fetchedOrders.length > 0) {
        let changed = false
        const map = new Map<string, SharedOrder>()
        this.ordersCache.forEach((o) => {
          map.set(o.order_number || o.id, o)
        })
        fetchedOrders.forEach((cloud) => {
          const key = cloud.order_number || cloud.id
          const local = map.get(key)
          if (!local) {
            map.set(key, cloud)
            changed = true
          } else {
            const kitchenServed = local.kitchen_status === "served" || cloud.kitchen_status === "served"
            const barServed = local.bar_status === "served" || cloud.bar_status === "served"
            const isCompleted = (local.status === "completed" || cloud.status === "completed") ||
              (kitchenServed && barServed && (local.status === "paid" || cloud.status === "paid"))

            const updatedOrder: SharedOrder = {
              ...local,
              ...cloud,
              kitchen_status: kitchenServed ? "served" : (cloud.kitchen_status || local.kitchen_status),
              bar_status: barServed ? "served" : (cloud.bar_status || local.bar_status),
              status: isCompleted ? "completed" : (local.status === "paid" ? "paid" : cloud.status),
            }

            if (JSON.stringify(updatedOrder) !== JSON.stringify(local)) {
              map.set(key, updatedOrder)
              changed = true
            }
          }
        })

        if (changed) {
          this.ordersCache = Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          localStorage.setItem(ORDERS_KEY, JSON.stringify(this.ordersCache))
          this.emitOrders()
        }
      }
    } catch (err) {
      console.warn("refreshOrdersFromCloud error", err)
    } finally {
      this.isRefreshingOrders = false
      if (this.hasPendingOrdersRefresh) {
        this.hasPendingOrdersRefresh = false
        setTimeout(() => void this.refreshOrdersFromCloud(), 50)
      }
    }
  }

  static async saveOrder(order: SharedOrder) {
    this.init()

    const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str))
    const validId = isUuid(order.id)
      ? order.id
      : (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `ord-${Date.now()}`)

    const normalizedOrder: SharedOrder = {
      ...order,
      id: validId,
      items: (order.items || []).map((item) => ({
        ...item,
        station: item.station || determineItemStation(item),
      })),
    }

    const idempotencyKey = (order as any).idempotency_key || `idem_${validId}`
    const action = (order as any).action || (normalizedOrder.status === "open" ? "send_kitchen" : "create_order")

    // Persist to authoritative backend /api/orders
    const payload = {
      id: isUuid(validId) ? validId : undefined,
      order_number: normalizedOrder.order_number,
      receipt_number: normalizedOrder.receipt_number,
      table_name: normalizedOrder.table_name || "Takeaway",
      cashier_name: normalizedOrder.cashier_name || "Staff",
      department: normalizedOrder.department || (normalizedOrder.ticket_source === "coffee_bill" ? "Coffee Bar" : "Juice & Food"),
      order_type: normalizedOrder.ticket_source === "coffee_bill" ? "coffee_bar" : (isTakeaway(normalizedOrder.table_name) ? "takeaway" : "dine_in"),
      items: normalizedOrder.items,
      subtotal: Number(normalizedOrder.subtotal) || 0,
      service_charge: Number(normalizedOrder.service_charge) || 0,
      service_charge_rate: Number(normalizedOrder.service_charge_rate) || 0,
      discount: Number(normalizedOrder.discount) || 0,
      tax: Number(normalizedOrder.tax) || 0,
      total: Number(normalizedOrder.total) || 0,
      payment_method: normalizedOrder.payment_method || "cash",
      split_payments: normalizedOrder.split_payments,
      cash_received: Number(normalizedOrder.cash_received) || Number(normalizedOrder.total) || 0,
      change_amount: Number(normalizedOrder.change_amount) || 0,
      status: normalizedOrder.status || "paid",
      notes: normalizedOrder.notes || (normalizedOrder.split_payments?.length ? JSON.stringify({ split_payments: normalizedOrder.split_payments }) : ""),
      idempotency_key: idempotencyKey,
      action: action,
    }

    let resData: any = null
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        resData = await res.json().catch(() => ({}))
      } else {
        const errJson = await res.json().catch(() => ({}))
        console.warn("POST /api/orders non-ok response, continuing with local order confirmation:", res.status, errJson)
      }
    } catch (netErr) {
      console.warn("POST /api/orders fetch failed, confirming order locally:", netErr)
    }

    const committed = resData?.order || {}
    if (committed.order_number) normalizedOrder.order_number = committed.order_number
    if (committed.receipt_number) normalizedOrder.receipt_number = committed.receipt_number
    if (committed.id) normalizedOrder.id = committed.id
    if (committed.status) normalizedOrder.status = committed.status
    if (committed.created_at) normalizedOrder.created_at = committed.created_at

    // Ensure payment_status is strictly aligned with status
    if (normalizedOrder.status === "paid") {
      normalizedOrder.payment_status = "paid"
    } else if (normalizedOrder.status === "open") {
      normalizedOrder.payment_status = "unpaid"
    }

    // Upsert into orders cache: NEVER overwrite an order belonging to a different table
    normalizedOrder.stock_deducted = true
    const existingById = this.ordersCache.findIndex((o) => o.id === normalizedOrder.id)
    const existingByNum = this.ordersCache.findIndex(
      (o) =>
        o.order_number === normalizedOrder.order_number &&
        (sameName(o.table_name, normalizedOrder.table_name) || !o.table_name || !normalizedOrder.table_name)
    )

    if (existingById >= 0) {
      this.ordersCache[existingById] = { ...this.ordersCache[existingById], ...normalizedOrder }
    } else if (existingByNum >= 0) {
      this.ordersCache[existingByNum] = { ...this.ordersCache[existingByNum], ...normalizedOrder }
    } else {
      this.ordersCache = [normalizedOrder, ...this.ordersCache]
    }

    localStorage.setItem(ORDERS_KEY, JSON.stringify(this.ordersCache))
    this.emitOrders()
    this.broadcast("orders", normalizedOrder)

    // Deduct products stock locally to keep UI responsive
    let stockChanged = false
    for (const item of normalizedOrder.items) {
      const target = this.productsCache.find((p) => p.id === item.id || (item as any).product_id === p.id || sameName(p.name, item.name))
      if (target) {
        const remaining = Math.max(0, target.stock - (item.quantity || 1))
        this.productsCache = this.productsCache.map((p) => (p.id === target.id ? { ...p, stock: remaining } : p))
        stockChanged = true
        if (this.isBrowser()) {
          try {
            void fetch(`/api/products/${encodeURIComponent(target.id)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stock: remaining }),
            }).catch(() => {})
          } catch {}
        }
      }
    }
    if (stockChanged) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
      this.emitProducts()
      this.broadcast("products")
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pos_products_updated"))
      }
    }

    // Update table occupation:
    // When someone is at the table (open order or paid dine-in), mark table occupied!
    // When customers leave, staff updates/frees the table from the Table section.
    if (!isTakeaway(normalizedOrder.table_name)) {
      void this.occupyTable(
        normalizedOrder.table_name,
        normalizedOrder.department === "Coffee Bar" ? "Coffee Bar" : "Juice & Food",
        normalizedOrder.order_number,
        normalizedOrder.total,
        normalizedOrder.customer_name || normalizedOrder.cashier_name
      )
    }

    // Customer credit ledger & loyalty points update
    if (normalizedOrder.customer_id) {
      const custIndex = this.customersCache.findIndex((c) => c.id === normalizedOrder.customer_id)
      if (custIndex >= 0) {
        const cust = this.customersCache[custIndex]
        let pointsEarned = 0
        let newCredit = cust.credit_balance || 0
        if (normalizedOrder.status === "paid" || normalizedOrder.status === "completed") {
          pointsEarned = Math.floor((normalizedOrder.total || 0) / 100)
        }
        if (normalizedOrder.payment_method === "credit") {
          newCredit += (normalizedOrder.total || 0)
        } else if (normalizedOrder.payment_method === "split" && Array.isArray(normalizedOrder.split_payments)) {
          const creditLine = normalizedOrder.split_payments.find((p) => p.method === "credit" && (!p.customer_id || p.customer_id === cust.id))
          if (creditLine) {
            newCredit += (Number(creditLine.amount) || 0)
          }
        }
        this.customersCache[custIndex] = {
          ...cust,
          loyalty_points: (cust.loyalty_points || 0) + pointsEarned,
          credit_balance: newCredit,
        }
        if (this.isBrowser()) {
          try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customersCache)) } catch {}
        }
        this.emitCustomers()
        this.broadcast("customers")
      }
    }

    // Additional customer credit check if split line has a specific customer_id different from main order
    if (normalizedOrder.payment_method === "split" && Array.isArray(normalizedOrder.split_payments)) {
      for (const sp of normalizedOrder.split_payments) {
        if (sp.method === "credit" && sp.customer_id && sp.customer_id !== normalizedOrder.customer_id) {
          const cIdx = this.customersCache.findIndex((c) => c.id === sp.customer_id)
          if (cIdx >= 0) {
            const cust = this.customersCache[cIdx]
            this.customersCache[cIdx] = {
              ...cust,
              credit_balance: (cust.credit_balance || 0) + (Number(sp.amount) || 0),
            }
            if (this.isBrowser()) {
              try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customersCache)) } catch {}
            }
            this.emitCustomers()
            this.broadcast("customers")
          }
        }
      }
    }

    // Promo code usage tracking
    if (normalizedOrder.promo_code) {
      const promoIndex = this.promosCache.findIndex((p) => p.code.toUpperCase() === normalizedOrder.promo_code?.toUpperCase())
      if (promoIndex >= 0) {
        this.promosCache[promoIndex].usage_count = (this.promosCache[promoIndex].usage_count || 0) + 1
        if (this.isBrowser()) {
          try { localStorage.setItem(PROMOS_KEY, JSON.stringify(this.promosCache)) } catch {}
        }
        this.emitPromos()
      }
    }

    return normalizedOrder
  }

  static async updateTicketStatus(
    orderId: string,
    station: "kitchen" | "bar",
    status: "pending" | "preparing" | "ready" | "served",
  ) {
    this.init()
    let matchedOrderNumber: string | undefined

    this.ordersCache = this.ordersCache.map((o) => {
      if (o.id === orderId || o.order_number === orderId) {
        matchedOrderNumber = o.order_number
        const nextKitchen = station === "kitchen" ? status : o.kitchen_status
        const nextBar = station === "bar" ? status : o.bar_status
        const allServed = (nextKitchen === "served" || !nextKitchen) && (nextBar === "served" || !nextBar)
        const nextStatus = allServed && (o.status === "paid" || o.status === "completed") ? "completed" : o.status
        return {
          ...o,
          kitchen_status: nextKitchen,
          bar_status: nextBar,
          status: nextStatus,
        }
      }
      return o
    })
    localStorage.setItem(ORDERS_KEY, JSON.stringify(this.ordersCache))
    this.emitOrders()
    this.broadcast("orders")

    const targetOrderNum = matchedOrderNumber || orderId

    // Notify backend endpoint
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(targetOrderNum)}/ticket-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ station, status }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        console.warn("Failed calling ticket-status endpoint:", errJson?.error)
      }
    } catch (patchErr) {
      console.warn("Failed calling ticket-status endpoint:", patchErr)
    }
  }

  // --- Inventory Movements Log ---------------------------------------------
  static getMovements(): SharedMovement[] {
    if (!this.isBrowser()) return []
    try {
      const raw = localStorage.getItem(MOVEMENTS_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  static logMovement(movement: Omit<SharedMovement, "id" | "created_at">) {
    if (!this.isBrowser()) return
    const record: SharedMovement = {
      ...movement,
      id: "mov-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      created_at: new Date().toISOString(),
    }
    const updated = [record, ...this.getMovements()].slice(0, 100)
    localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent("pos_movements_updated", { detail: updated }))
    this.broadcast("movements")
  }

  // --- Inventory & Recipe Operations ---------------------------------------
  static getIngredients(): SharedIngredient[] {
    this.init()
    return this.ingredientsCache
  }

  static setIngredients(ingredients: SharedIngredient[]): void {
    this.init()
    this.ingredientsCache = ingredients
    if (this.isBrowser()) {
      try {
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
      } catch {}
    }
    this.emitIngredients()
  }

  static subscribeIngredients(listener: Listener<SharedIngredient[]>): () => void {
    this.init()
    this.ingredientListeners.add(listener)
    listener(this.ingredientsCache)
    return () => {
      this.ingredientListeners.delete(listener)
    }
  }

  static async saveIngredient(ingredient: SharedIngredient) {
    this.init()
    const idx = this.ingredientsCache.findIndex((i) => i.id === ingredient.id)
    if (idx >= 0) {
      this.ingredientsCache[idx] = { ...this.ingredientsCache[idx], ...ingredient }
    } else {
      this.ingredientsCache = [...this.ingredientsCache, ingredient]
    }
    if (this.isBrowser()) {
      try {
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
      } catch {}
    }
    this.emitIngredients()
    this.broadcast("ingredients", ingredient)
    this.broadcast("inventory")

    if (isSupabaseConfigured()) {
      try {
        const isIngUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ingredient.id)
        const isCatUuid = ingredient.category_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ingredient.category_id)
        const payload: any = {
          name: ingredient.name,
          dimension: ingredient.dimension,
          base_unit: ingredient.base_unit,
          default_purchase_unit: ingredient.default_purchase_unit,
          current_stock_base: Number(ingredient.current_stock_base) || 0,
          reorder_level_base: Number(ingredient.reorder_level_base) || 0,
          category_id: isCatUuid ? ingredient.category_id : null,
          is_archived: false,
          is_active: true,
          updated_at: new Date().toISOString(),
        }
        if (isIngUuid) {
          payload.id = ingredient.id
          await createClient().from("ingredients").upsert(payload, { onConflict: "id" })
        } else {
          await createClient().from("ingredients").insert(payload)
        }
      } catch (e) {
        console.warn("Supabase ingredient upsert warning", e)
      }
    }
  }

  static async adjustIngredientStock(ingredientId: string, deltaBase: number, reason: string = "Stock count") {
    this.init()
    const target = this.ingredientsCache.find((i) => i.id === ingredientId)
    if (!target) return
    const newStock = Math.max(0, (Number(target.current_stock_base) || 0) + deltaBase)
    this.ingredientsCache = this.ingredientsCache.map((i) =>
      i.id === ingredientId ? { ...i, current_stock_base: newStock } : i
    )
    if (this.isBrowser()) {
      try {
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
      } catch {}
    }
    this.emitIngredients()
    this.broadcast("ingredients")
    this.broadcast("inventory")

    if (isSupabaseConfigured() && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ingredientId)) {
      try {
        const client = createClient()
        await client.from("ingredients").update({
          current_stock_base: newStock,
          updated_at: new Date().toISOString(),
        }).eq("id", ingredientId)

        try {
          await client.from("ingredient_stock_movements").insert({
            ingredient_id: ingredientId,
            quantity_change_base: deltaBase,
            reason: reason || "Manual adjustment",
          })
        } catch {}
      } catch (e) {
        console.warn("Supabase ingredient stock adjust note:", e)
      }
    }
  }

  static async setIngredientStock(ingredientId: string, newStockBase: number, reason: string = "Stock count") {
    this.init()
    const target = this.ingredientsCache.find((i) => i.id === ingredientId)
    if (!target) return
    const prevStock = Number(target.current_stock_base) || 0
    const clampedNew = Math.max(0, Number(newStockBase) || 0)
    const delta = clampedNew - prevStock
    this.ingredientsCache = this.ingredientsCache.map((i) =>
      i.id === ingredientId ? { ...i, current_stock_base: clampedNew } : i
    )
    if (this.isBrowser()) {
      try {
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
      } catch {}
    }
    this.emitIngredients()
    this.broadcast("ingredients")
    this.broadcast("inventory")

    if (isSupabaseConfigured() && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ingredientId)) {
      try {
        const client = createClient()
        await client.from("ingredients").update({
          current_stock_base: clampedNew,
          updated_at: new Date().toISOString(),
        }).eq("id", ingredientId)

        try {
          await client.from("ingredient_stock_movements").insert({
            ingredient_id: ingredientId,
            quantity_change_base: delta,
            reason: reason || "Physical stock count",
          })
        } catch {}
      } catch (e) {
        console.warn("Supabase setIngredientStock note:", e)
      }
    }
  }

  static async deleteIngredient(ingredientId: string) {
    this.init()
    this.ingredientsCache = this.ingredientsCache.filter((i) => i.id !== ingredientId)

    // Clean up any recipe that referenced this ingredient
    const cleanedRecipes: Record<string, SharedRecipeItem[]> = {}
    for (const [key, lines] of Object.entries(this.recipesCache)) {
      cleanedRecipes[key] = lines.filter((l) => l.ingredient_id !== ingredientId)
    }
    this.recipesCache = cleanedRecipes

    if (this.isBrowser()) {
      try {
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
        localStorage.setItem(RECIPES_KEY, JSON.stringify(this.recipesCache))
      } catch {}
    }
    this.emitIngredients()
    this.emitRecipes()
    this.broadcast("ingredients")
    this.broadcast("recipes")
    this.broadcast("inventory")

    if (isSupabaseConfigured()) {
      try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ingredientId)) {
          const supabase = createClient()
          await supabase.from("ingredients").update({ is_archived: true, updated_at: new Date().toISOString() }).eq("id", ingredientId)
          await supabase.from("recipe_items").delete().eq("ingredient_id", ingredientId)
        }
      } catch (err) {
        console.warn("Supabase ingredient delete warning", err)
      }
    }
  }

  static async clearBulkInventory(): Promise<void> {
    this.init()
    this.ingredientsCache = []
    this.recipesCache = {}
    this.purchasesCache = []
    this.wastageCache = []
    this.adjustmentsCache = []
    if (this.isBrowser()) {
      try {
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify([]))
        localStorage.setItem(RECIPES_KEY, JSON.stringify({}))
        localStorage.setItem(PURCHASES_KEY, JSON.stringify([]))
        localStorage.setItem(WASTAGE_KEY, JSON.stringify([]))
        localStorage.setItem(ADJUSTMENTS_KEY, JSON.stringify([]))
        localStorage.setItem("pos_bulk_purged_v4", "true")
      } catch {}
    }
    this.emitIngredients()
    this.emitRecipes()
    this.emitPurchases()
    this.emitWastage()
    this.emitAdjustments()
    this.broadcast("ingredients", [])
    this.broadcast("recipes", {})
    this.broadcast("purchases", [])
    this.broadcast("inventory", {})

    if (isSupabaseConfigured()) {
      try {
        const client = createClient()
        // 1. Delete purchase items first
        await client.from("purchase_items").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        // 2. Delete purchases
        await client.from("purchases").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        // 3. Delete recipe items
        await client.from("recipe_items").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        // 4. Delete ingredient stock movements
        await client.from("ingredient_stock_movements").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        // 5. Deactivate and archive all ingredients
        await client.from("ingredients").update({
          is_archived: true,
          is_active: false,
          current_stock_base: 0,
          updated_at: new Date().toISOString(),
        }).neq("id", "00000000-0000-0000-0000-000000000000")
      } catch (err) {
        console.warn("Supabase clearBulkInventory warning", err)
      }
    }
  }

  static getIngredientCategories(): SharedIngredientCategory[] {
    this.init()
    return this.ingredientCategoriesCache
  }

  static setIngredientCategories(categories: SharedIngredientCategory[]): void {
    this.init()
    this.ingredientCategoriesCache = categories
    if (this.isBrowser()) {
      try {
        localStorage.setItem(INGREDIENT_CATEGORIES_KEY, JSON.stringify(this.ingredientCategoriesCache))
      } catch {}
    }
    this.emitIngredientCategories()
  }

  static subscribeIngredientCategories(listener: Listener<SharedIngredientCategory[]>): () => void {
    this.init()
    this.ingredientCategoryListeners.add(listener)
    listener(this.ingredientCategoriesCache)
    return () => {
      this.ingredientCategoryListeners.delete(listener)
    }
  }

  static async saveIngredientCategory(category: SharedIngredientCategory) {
    this.init()
    const idx = this.ingredientCategoriesCache.findIndex((c) => c.id === category.id)
    if (idx >= 0) {
      this.ingredientCategoriesCache[idx] = { ...this.ingredientCategoriesCache[idx], ...category }
    } else {
      this.ingredientCategoriesCache = [...this.ingredientCategoriesCache, category]
    }
    if (this.isBrowser()) {
      try {
        localStorage.setItem(INGREDIENT_CATEGORIES_KEY, JSON.stringify(this.ingredientCategoriesCache))
      } catch {}
    }
    this.emitIngredientCategories()
    this.broadcast("ingredient_categories", category)
    this.broadcast("inventory")

    if (isSupabaseConfigured()) {
      try {
        const isCatUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(category.id)
        const payload: any = {
          name: category.name,
          sort_order: category.sort_order || (this.ingredientCategoriesCache.length * 10),
          is_active: true,
        }
        if (isCatUuid) {
          payload.id = category.id
          await createClient().from("ingredient_categories").upsert(payload, { onConflict: "id" })
        } else {
          await createClient().from("ingredient_categories").insert(payload)
        }
      } catch (e) {
        console.warn("Supabase ingredient category upsert warning", e)
      }
    }
  }

  static async removeIngredientCategory(categoryId: string) {
    this.init()
    this.ingredientCategoriesCache = this.ingredientCategoriesCache.filter((c) => c.id !== categoryId)
    this.ingredientsCache = this.ingredientsCache.map((i) =>
      i.category_id === categoryId ? { ...i, category_id: null } : i
    )
    if (this.isBrowser()) {
      try {
        localStorage.setItem(INGREDIENT_CATEGORIES_KEY, JSON.stringify(this.ingredientCategoriesCache))
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
      } catch {}
    }
    this.emitIngredientCategories()
    this.emitIngredients()
    this.broadcast("ingredient_categories")
    this.broadcast("ingredients")
    this.broadcast("inventory")

    if (isSupabaseConfigured()) {
      try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(categoryId)) {
          const supabase = createClient()
          await supabase.from("ingredient_categories").update({ is_active: false }).eq("id", categoryId)
          await supabase.from("ingredients").update({ category_id: null }).eq("category_id", categoryId)
        }
      } catch {}
    }
  }

  static getRecipes(): Record<string, SharedRecipeItem[]> {
    this.init()
    return this.recipesCache
  }

  static setRecipes(recipes: Record<string, SharedRecipeItem[]>): void {
    this.init()
    this.recipesCache = recipes
    if (this.isBrowser()) {
      try {
        localStorage.setItem(RECIPES_KEY, JSON.stringify(this.recipesCache))
      } catch {}
    }
    this.emitRecipes()
  }

  static subscribeRecipes(listener: Listener<Record<string, SharedRecipeItem[]>>): () => void {
    this.init()
    this.recipeListeners.add(listener)
    listener(this.recipesCache)
    return () => {
      this.recipeListeners.delete(listener)
    }
  }

  static async saveRecipe(productId: string, lines: SharedRecipeItem[]) {
    this.init()
    const prod = this.productsCache.find((p) => p.id === productId || sameName(p.name, productId))
    this.recipesCache = {
      ...this.recipesCache,
      [productId]: lines,
    }
    if (prod && prod.name && prod.name !== productId) {
      this.recipesCache[prod.name] = lines
    }

    if (this.isBrowser()) {
      try {
        localStorage.setItem(RECIPES_KEY, JSON.stringify(this.recipesCache))
      } catch {}
    }
    this.emitRecipes()
    this.broadcast("recipes", { productId, lines })
    this.broadcast("inventory")

    if (isSupabaseConfigured()) {
      try {
        const client = createClient()
        await client.from("recipe_items").delete().eq("product_id", productId)
        if (prod && prod.name && prod.name !== productId) {
          await client.from("recipe_items").delete().eq("product_id", prod.name)
        }
        const validUuidLines = lines.filter((l) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(l.ingredient_id))
        if (validUuidLines.length > 0) {
          const toInsert = validUuidLines.map((l) => ({
            product_id: productId,
            ingredient_id: l.ingredient_id,
            quantity_base: l.quantity_base,
          }))
          if (prod && prod.name && prod.name !== productId) {
            toInsert.push(...validUuidLines.map((l) => ({
              product_id: prod.name,
              ingredient_id: l.ingredient_id,
              quantity_base: l.quantity_base,
            })))
          }
          await client.from("recipe_items").insert(toInsert)
        }
      } catch (e) {
        console.warn("Supabase recipe save warning", e)
      }
    }
  }

  static getPurchases(): SharedPurchase[] {
    this.init()
    return this.purchasesCache
  }

  static setPurchases(purchases: SharedPurchase[]): void {
    this.init()
    this.purchasesCache = purchases
    if (this.isBrowser()) {
      try {
        localStorage.setItem(PURCHASES_KEY, JSON.stringify(this.purchasesCache))
      } catch {}
    }
    this.emitPurchases()
  }

  static subscribePurchases(listener: Listener<SharedPurchase[]>): () => void {
    this.init()
    this.purchaseListeners.add(listener)
    listener(this.purchasesCache)
    return () => {
      this.purchaseListeners.delete(listener)
    }
  }

  static async savePurchase(purchase: SharedPurchase) {
    this.init()
    this.purchasesCache = [purchase, ...this.purchasesCache]

    for (const item of purchase.purchase_items) {
      const target = this.ingredientsCache.find((i) => i.id === item.ingredient_id)
      if (target) {
        target.current_stock_base = (target.current_stock_base || 0) + (item.quantity_base || 0)
      }
    }

    if (this.isBrowser()) {
      try {
        localStorage.setItem(PURCHASES_KEY, JSON.stringify(this.purchasesCache))
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
      } catch {}
    }
    this.emitPurchases()
    this.emitIngredients()
    this.broadcast("purchases", purchase)
    this.broadcast("ingredients")
    this.broadcast("inventory")

    if (isSupabaseConfigured()) {
      try {
        const client = createClient()
        const isPurUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(purchase.id)
        const purPayload: any = {
          supplier_name: purchase.supplier_name || null,
          status: "posted",
          payment_method: "cash",
          subtotal_minor: purchase.total_minor,
          total_minor: purchase.total_minor,
        }
        if (isPurUuid) purPayload.id = purchase.id
        const { data: purRow } = await client.from("purchases").insert(purPayload).select("id").single()

        if (purRow && purchase.purchase_items.length > 0) {
          const validItemLines = purchase.purchase_items.filter((pi) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pi.ingredient_id))
          if (validItemLines.length > 0) {
            await client.from("purchase_items").insert(
              validItemLines.map((pi) => ({
                purchase_id: purRow.id,
                ingredient_id: pi.ingredient_id,
                quantity: pi.quantity,
                unit: pi.unit,
                quantity_base: pi.quantity_base,
                unit_price_minor: pi.unit_price_minor,
                total_price_minor: pi.total_price_minor,
              }))
            )
            // Synchronize ingredient stock in Supabase directly
            for (const item of validItemLines) {
              const currentIng = this.ingredientsCache.find((i) => i.id === item.ingredient_id)
              if (currentIng) {
                await client.from("ingredients").update({
                  current_stock_base: currentIng.current_stock_base,
                  updated_at: new Date().toISOString(),
                }).eq("id", item.ingredient_id)
              }
            }
          }
        }
      } catch (e) {
        console.warn("Supabase purchase save warning", e)
      }
    }
  }

  static getRecipeForProduct(productIdOrName: string): SharedRecipeItem[] | undefined {
    this.init()
    if (!this.recipesCache) return undefined
    const query = String(productIdOrName || "").trim().toLowerCase()
    if (!query) return undefined

    // 1. Direct or case-insensitive key match
    if (this.recipesCache[productIdOrName]?.length) return this.recipesCache[productIdOrName]
    const directMatch = Object.entries(this.recipesCache).find(([k]) => k.trim().toLowerCase() === query)
    if (directMatch && directMatch[1]?.length) return directMatch[1]

    // 2. Lookup by productsCache
    const prod = this.productsCache.find((p) => p.id === productIdOrName || sameName(p.name, productIdOrName))
    if (prod) {
      if (this.recipesCache[prod.id]?.length) return this.recipesCache[prod.id]
      if (this.recipesCache[prod.name]?.length) return this.recipesCache[prod.name]
      const pMatch = Object.entries(this.recipesCache).find(
        ([k]) => sameName(k, prod.name) || sameName(k, prod.id)
      )
      if (pMatch && pMatch[1]?.length) return pMatch[1]
    }
    return undefined
  }

  static validateOrderStock(items: { id?: string; name: string; quantity: number }[]): {
    valid: boolean
    warnings: string[]
    insufficientIngredients: {
      ingredientName: string
      requiredBase: number
      availableBase: number
      unit: string
    }[]
  } {
    this.init()
    const warnings: string[] = []
    const insufficientIngredients: any[] = []

    const totalRequired = new Map<string, { ingredient: SharedIngredient; required: number }>()

    for (const item of items) {
      const qty = Number(item.quantity) || 1
      if (qty <= 0) continue

      const targetKey = item.id || item.name
      const recipe = this.getRecipeForProduct(targetKey)
      if (!recipe || !recipe.length) continue

      for (const line of recipe) {
        const ing = this.ingredientsCache.find(
          (i) =>
            i.id === line.ingredient_id ||
            sameName(i.name, line.ingredient_id) ||
            (line.ingredient_name && sameName(i.name, line.ingredient_name))
        )
        if (!ing) continue

        const lineBase =
          Number(line.quantity_base) ||
          toBaseUnits(Number((line as any).quantity) || 0, line.unit || ing.base_unit)
        const requiredForThisItem = lineBase * qty

        const existing = totalRequired.get(ing.id)
        if (existing) {
          existing.required += requiredForThisItem
        } else {
          totalRequired.set(ing.id, { ingredient: ing, required: requiredForThisItem })
        }
      }
    }

    for (const { ingredient, required } of totalRequired.values()) {
      const available = Number(ingredient.current_stock_base) || 0
      if (required > available) {
        const reqStr = formatStockDisplay(required, ingredient.base_unit)
        const availStr = formatStockDisplay(available, ingredient.base_unit)
        warnings.push(`Insufficient stock for "${ingredient.name}": requires ${reqStr}, but only ${availStr} in stock.`)
        insufficientIngredients.push({
          ingredientName: ingredient.name,
          requiredBase: required,
          availableBase: available,
          unit: ingredient.base_unit,
        })
      }
    }

    return {
      valid: warnings.length === 0,
      warnings,
      insufficientIngredients,
    }
  }

  static async refreshIngredientsFromCloud(): Promise<void> {
    if (!this.isBrowser() || !isSupabaseConfigured()) return
    try {
      const client = createClient()
      const { data, error } = await client
        .from("ingredients")
        .select("*")
        .eq("is_archived", false)
        .order("name")

      if (!error && Array.isArray(data)) {
        const cloudIngs: SharedIngredient[] = data.map((row) => ({
          id: row.id,
          name: row.name,
          dimension: row.dimension || "weight",
          base_unit: row.base_unit || "g",
          default_purchase_unit: row.default_purchase_unit || row.base_unit || "kg",
          current_stock_base: Number(row.current_stock_base) || 0,
          reorder_level_base: Number(row.reorder_level_base) || 0,
          category_id: row.category_id || null,
        }))

        const map = new Map<string, SharedIngredient>()
        cloudIngs.forEach((i) => map.set(i.id, i))
        for (const local of this.ingredientsCache) {
          if (!map.has(local.id) && !cloudIngs.some((c) => sameName(c.name, local.name))) {
            map.set(local.id, local)
          }
        }

        this.ingredientsCache = Array.from(map.values())
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
        this.emitIngredients()
      }
    } catch (err) {
      console.warn("refreshIngredientsFromCloud error:", err)
    }
  }

  static async refreshRecipesFromCloud(): Promise<void> {
    if (!this.isBrowser() || !isSupabaseConfigured()) return
    try {
      const client = createClient()
      const { data, error } = await client
        .from("recipe_items")
        .select("product_id,ingredient_id,quantity_base")

      if (!error && Array.isArray(data)) {
        const grouped: Record<string, SharedRecipeItem[]> = {}
        for (const row of data) {
          const item: SharedRecipeItem = {
            ingredient_id: row.ingredient_id,
            quantity_base: Number(row.quantity_base) || 0,
          }
          const pId = String(row.product_id).trim()
          ;(grouped[pId] ||= []).push(item)

          const prod = this.productsCache.find((p) => p.id === pId || sameName(p.name, pId))
          if (prod && prod.name && prod.name !== pId) {
            ;(grouped[prod.name] ||= []).push(item)
          }
        }

        this.recipesCache = {
          ...this.recipesCache,
          ...grouped,
        }
        localStorage.setItem(RECIPES_KEY, JSON.stringify(this.recipesCache))
        this.emitRecipes()
      }
    } catch (err) {
      console.warn("refreshRecipesFromCloud error:", err)
    }
  }

  static async deductRecipeIngredients(
    productIdOrName: string,
    orderQty: number = 1,
    orderNumber?: string,
    orderId?: string
  ): Promise<{ success: boolean; deducted: { ingredientName: string; amountBase: number; remainingBase: number; unit: string }[] }> {
    this.init()
    const recipeLines = this.getRecipeForProduct(productIdOrName)
    if (!recipeLines || !recipeLines.length) return { success: true, deducted: [] }

    let changed = false
    const deductedInfo: { ingredientName: string; amountBase: number; remainingBase: number; unit: string }[] = []
    const cloudUpdates: { id: string; newStock: number; deltaBase: number; name: string }[] = []

    this.ingredientsCache = this.ingredientsCache.map((ing) => {
      const line = recipeLines.find(
        (r) =>
          r.ingredient_id === ing.id ||
          sameName(ing.name, r.ingredient_id) ||
          (r.ingredient_name && sameName(ing.name, r.ingredient_name))
      )
      if (line) {
        changed = true
        // 1. Recipe Multiplication: multiply required amount per item by total quantity ordered
        // 2. Unit Conversion: ensure line quantity is converted to base units
        const lineBase =
          Number(line.quantity_base) ||
          toBaseUnits(Number((line as any).quantity) || 0, line.unit || ing.base_unit)
        const deductAmt = lineBase * orderQty
        const current = Number(ing.current_stock_base) || 0
        const newStock = Math.max(0, current - deductAmt)

        deductedInfo.push({
          ingredientName: ing.name,
          amountBase: deductAmt,
          remainingBase: newStock,
          unit: ing.base_unit,
        })

        cloudUpdates.push({
          id: ing.id,
          newStock,
          deltaBase: -deductAmt,
          name: ing.name,
        })

        return {
          ...ing,
          current_stock_base: newStock,
        }
      }
      return ing
    })

    if (changed) {
      if (this.isBrowser()) {
        try {
          localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
        } catch {}
      }
      this.emitIngredients()
      this.broadcast("ingredients", this.ingredientsCache)
      this.broadcast("inventory")
      if (this.isBrowser()) {
        window.dispatchEvent(new CustomEvent("pos_realtime_inventory"))
        window.dispatchEvent(new CustomEvent("pos_realtime_ingredients"))
      }

      // 3. Stock State / Database Update: Persist newly calculated stock to Supabase
      if (isSupabaseConfigured() && cloudUpdates.length > 0) {
        try {
          const client = createClient()
          for (const item of cloudUpdates) {
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)) {
              await client
                .from("ingredients")
                .update({
                  current_stock_base: item.newStock,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", item.id)

              try {
                await client.from("ingredient_stock_movements").insert({
                  ingredient_id: item.id,
                  quantity_change_base: item.deltaBase,
                  reason: `Sale ${orderNumber ? "#" + orderNumber : ""} (${orderQty}x ${productIdOrName})`,
                  reference: orderId || null,
                })
              } catch {}
            }
          }
        } catch (e) {
          console.warn("Supabase ingredient stock deduction update note:", e)
        }
      }
    }

    return { success: true, deducted: deductedInfo }
  }

  // ==========================================
  // CUSTOMER MANAGEMENT & CRM
  // ==========================================
  static getCustomers(): SharedCustomer[] {
    this.init()
    return this.customersCache
  }

  static getCustomerById(id: string): SharedCustomer | undefined {
    this.init()
    return this.customersCache.find((c) => c.id === id)
  }

  static subscribeCustomers(listener: Listener<SharedCustomer[]>): () => void {
    this.init()
    this.customerListeners.add(listener)
    listener(this.customersCache)
    return () => {
      this.customerListeners.delete(listener)
    }
  }

  static addCustomer(customer: Omit<SharedCustomer, "id" | "created_at">): SharedCustomer {
    this.init()
    const newCust: SharedCustomer = {
      ...customer,
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `cust-${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    this.customersCache = [newCust, ...this.customersCache]
    if (this.isBrowser()) {
      try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customersCache)) } catch {}
    }
    this.emitCustomers()
    this.broadcast("customers", newCust)
    return newCust
  }

  static updateCustomer(id: string, patch: Partial<SharedCustomer>): void {
    this.init()
    this.customersCache = this.customersCache.map((c) => (c.id === id ? { ...c, ...patch } : c))
    if (this.isBrowser()) {
      try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customersCache)) } catch {}
    }
    this.emitCustomers()
    this.broadcast("customers")
  }

  static deleteCustomer(id: string): void {
    this.init()
    this.customersCache = this.customersCache.filter((c) => c.id !== id)
    if (this.isBrowser()) {
      try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customersCache)) } catch {}
    }
    this.emitCustomers()
    this.broadcast("customers")
  }

  static recordCreditPayment(customerId: string, amount: number, _reference?: string, _notes?: string): void {
    this.init()
    const index = this.customersCache.findIndex((c) => c.id === customerId)
    if (index >= 0) {
      const cust = this.customersCache[index]
      const newBal = Math.max(0, cust.credit_balance - amount)
      this.customersCache[index] = { ...cust, credit_balance: newBal }
      if (this.isBrowser()) {
        try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customersCache)) } catch {}
      }
      this.emitCustomers()
      this.broadcast("customers")
    }
  }

  // ==========================================
  // PROMOTIONAL OFFERS
  // ==========================================
  static getPromos(): SharedPromoOffer[] {
    this.init()
    return this.promosCache
  }

  static subscribePromos(listener: Listener<SharedPromoOffer[]>): () => void {
    this.init()
    this.promoListeners.add(listener)
    listener(this.promosCache)
    return () => {
      this.promoListeners.delete(listener)
    }
  }

  static addPromo(promo: Omit<SharedPromoOffer, "id">): SharedPromoOffer {
    this.init()
    const newPromo: SharedPromoOffer = {
      ...promo,
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `promo-${Date.now()}`,
    }
    this.promosCache = [newPromo, ...this.promosCache]
    if (this.isBrowser()) {
      try { localStorage.setItem(PROMOS_KEY, JSON.stringify(this.promosCache)) } catch {}
    }
    this.emitPromos()
    this.broadcast("promos")
    return newPromo
  }

  static updatePromo(id: string, patch: Partial<SharedPromoOffer>): void {
    this.init()
    this.promosCache = this.promosCache.map((p) => (p.id === id ? { ...p, ...patch } : p))
    if (this.isBrowser()) {
      try { localStorage.setItem(PROMOS_KEY, JSON.stringify(this.promosCache)) } catch {}
    }
    this.emitPromos()
    this.broadcast("promos")
  }

  static deletePromo(id: string): void {
    this.init()
    this.promosCache = this.promosCache.filter((p) => p.id !== id)
    if (this.isBrowser()) {
      try { localStorage.setItem(PROMOS_KEY, JSON.stringify(this.promosCache)) } catch {}
    }
    this.emitPromos()
    this.broadcast("promos")
  }

  static applyPromo(code: string, subtotal: number): { valid: boolean; discount: number; message: string; promo?: SharedPromoOffer } {
    this.init()
    const clean = code.trim().toUpperCase()
    const found = this.promosCache.find((p) => p.code.toUpperCase() === clean && p.active)
    if (!found) {
      return { valid: false, discount: 0, message: "Invalid or inactive promo code" }
    }
    if (found.min_spend && subtotal < found.min_spend) {
      return { valid: false, discount: 0, message: `Minimum spend of LKR ${found.min_spend.toLocaleString()} required` }
    }
    if (found.valid_until && new Date(found.valid_until).getTime() < Date.now()) {
      return { valid: false, discount: 0, message: "This promo code has expired" }
    }
    let discount = 0
    if (found.discount_type === "percentage") {
      discount = Math.round((subtotal * found.discount_value) / 100)
    } else {
      discount = Math.min(subtotal, found.discount_value)
    }
    return {
      valid: true,
      discount,
      message: `Promo applied: ${found.discount_type === "percentage" ? `${found.discount_value}% off` : `LKR ${found.discount_value} off`}`,
      promo: found,
    }
  }

  // ==========================================
  // CUSTOMER FEEDBACK
  // ==========================================
  static getFeedback(): SharedCustomerFeedback[] {
    this.init()
    return this.feedbackCache
  }

  static subscribeFeedback(listener: Listener<SharedCustomerFeedback[]>): () => void {
    this.init()
    this.feedbackListeners.add(listener)
    listener(this.feedbackCache)
    return () => {
      this.feedbackListeners.delete(listener)
    }
  }

  static addFeedback(fb: Omit<SharedCustomerFeedback, "id" | "created_at">): SharedCustomerFeedback {
    this.init()
    const item: SharedCustomerFeedback = {
      ...fb,
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `fb-${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    this.feedbackCache = [item, ...this.feedbackCache]
    if (this.isBrowser()) {
      try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(this.feedbackCache)) } catch {}
    }
    this.emitFeedback()
    this.broadcast("feedback")
    return item
  }

  // ==========================================
  // SUPPLIER MANAGEMENT
  // ==========================================
  static getSuppliers(): SharedSupplier[] {
    this.init()
    return this.suppliersCache
  }

  static subscribeSuppliers(listener: Listener<SharedSupplier[]>): () => void {
    this.init()
    this.supplierListeners.add(listener)
    listener(this.suppliersCache)
    return () => {
      this.supplierListeners.delete(listener)
    }
  }

  static addSupplier(sup: Omit<SharedSupplier, "id" | "created_at">): SharedSupplier {
    this.init()
    const item: SharedSupplier = {
      ...sup,
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `sup-${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    this.suppliersCache = [item, ...this.suppliersCache]
    if (this.isBrowser()) {
      try { localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(this.suppliersCache)) } catch {}
    }
    this.emitSuppliers()
    this.broadcast("suppliers")
    return item
  }

  static updateSupplier(id: string, patch: Partial<SharedSupplier>): void {
    this.init()
    this.suppliersCache = this.suppliersCache.map((s) => (s.id === id ? { ...s, ...patch } : s))
    if (this.isBrowser()) {
      try { localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(this.suppliersCache)) } catch {}
    }
    this.emitSuppliers()
    this.broadcast("suppliers")
  }

  static deleteSupplier(id: string): void {
    this.init()
    this.suppliersCache = this.suppliersCache.filter((s) => s.id !== id)
    if (this.isBrowser()) {
      try { localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(this.suppliersCache)) } catch {}
    }
    this.emitSuppliers()
    this.broadcast("suppliers")
  }

  // ==========================================
  // WASTAGE & SPOILAGE MANAGEMENT
  // ==========================================
  static getWastage(): SharedWastageItem[] {
    this.init()
    return this.wastageCache
  }

  static subscribeWastage(listener: Listener<SharedWastageItem[]>): () => void {
    this.init()
    this.wastageListeners.add(listener)
    listener(this.wastageCache)
    return () => {
      this.wastageListeners.delete(listener)
    }
  }

  static async addWastageItem(waste: Omit<SharedWastageItem, "id" | "created_at">): Promise<SharedWastageItem> {
    this.init()
    const item: SharedWastageItem = {
      ...waste,
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `waste-${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    this.wastageCache = [item, ...this.wastageCache]
    if (item.item_type === "ingredient") {
      const ing = this.ingredientsCache.find((i) => i.id === item.item_id)
      if (ing) {
        const u = String(item.unit || "").toLowerCase().trim()
        const factor = (u === "kg" || u === "l" || u === "liter" || u === "litre") ? 1000 : (u === "dozen" ? 12 : (u === "tray" ? 30 : 1))
        const deduct = (Number(item.quantity) || 0) * factor
        ing.current_stock_base = Math.max(0, (Number(ing.current_stock_base) || 0) - deduct)
        this.emitIngredients()

        if (isSupabaseConfigured() && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.item_id)) {
          try {
            await createClient().from("ingredients").update({
              current_stock_base: ing.current_stock_base,
              updated_at: new Date().toISOString(),
            }).eq("id", item.item_id)
          } catch {}
        }
      }
    }
    if (this.isBrowser()) {
      try {
        localStorage.setItem(WASTAGE_KEY, JSON.stringify(this.wastageCache))
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
      } catch {}
    }
    this.emitWastage()
    this.broadcast("wastage")
    this.broadcast("ingredients")
    this.broadcast("inventory")
    return item
  }

  // ==========================================
  // STOCK ADJUSTMENTS
  // ==========================================
  static getAdjustments(): SharedStockAdjustment[] {
    this.init()
    return this.adjustmentsCache
  }

  static subscribeAdjustments(listener: Listener<SharedStockAdjustment[]>): () => void {
    this.init()
    this.adjustmentListeners.add(listener)
    listener(this.adjustmentsCache)
    return () => {
      this.adjustmentListeners.delete(listener)
    }
  }

  static async addAdjustment(adj: Omit<SharedStockAdjustment, "id" | "created_at">): Promise<SharedStockAdjustment> {
    this.init()
    const item: SharedStockAdjustment = {
      ...adj,
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `adj-${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    this.adjustmentsCache = [item, ...this.adjustmentsCache]
    const ing = this.ingredientsCache.find((i) => i.id === item.ingredient_id)
    if (ing) {
      ing.current_stock_base = item.new_stock
      this.emitIngredients()

      if (isSupabaseConfigured() && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.ingredient_id)) {
        try {
          await createClient().from("ingredients").update({
            current_stock_base: item.new_stock,
            updated_at: new Date().toISOString(),
          }).eq("id", item.ingredient_id)
        } catch {}
      }
    }
    if (this.isBrowser()) {
      try {
        localStorage.setItem(ADJUSTMENTS_KEY, JSON.stringify(this.adjustmentsCache))
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
      } catch {}
    }
    this.emitAdjustments()
    this.broadcast("adjustments")
    this.broadcast("ingredients")
    this.broadcast("inventory")
    return item
  }

  // ==========================================
  // EXPENSES & P&L TRACKING
  // ==========================================
  static getExpenses(): SharedExpense[] {
    this.init()
    return this.expensesCache
  }

  static subscribeExpenses(listener: Listener<SharedExpense[]>): () => void {
    this.init()
    this.expenseListeners.add(listener)
    listener(this.expensesCache)
    return () => {
      this.expenseListeners.delete(listener)
    }
  }

  static addExpense(exp: Omit<SharedExpense, "id" | "created_at">): SharedExpense {
    this.init()
    const item: SharedExpense = {
      ...exp,
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `exp-${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    this.expensesCache = [item, ...this.expensesCache]
    if (this.isBrowser()) {
      try { localStorage.setItem(EXPENSES_KEY, JSON.stringify(this.expensesCache)) } catch {}
    }
    this.emitExpenses()
    this.broadcast("expenses")
    return item
  }

  static deleteExpense(id: string): void {
    this.init()
    this.expensesCache = this.expensesCache.filter((e) => e.id !== id)
    if (this.isBrowser()) {
      try { localStorage.setItem(EXPENSES_KEY, JSON.stringify(this.expensesCache)) } catch {}
    }
    this.emitExpenses()
    this.broadcast("expenses")
  }

  // ==========================================
  // BRANCH MANAGEMENT
  // ==========================================
  static getBranches(): SharedBranch[] {
    this.init()
    return this.branchesCache
  }

  static getActiveBranchId(): string {
    this.init()
    return this.activeBranchId
  }

  static getActiveBranch(): SharedBranch {
    this.init()
    return this.branchesCache.find((b) => b.id === this.activeBranchId) || this.branchesCache[0] || DEFAULT_BRANCHES[0]
  }

  static setActiveBranchId(id: string): void {
    this.init()
    this.activeBranchId = id
    if (this.isBrowser()) {
      try { localStorage.setItem(ACTIVE_BRANCH_KEY, id) } catch {}
    }
    this.emitBranches()
    this.broadcast("branches")
  }

  static subscribeBranches(listener: Listener<SharedBranch[]>): () => void {
    this.init()
    this.branchListeners.add(listener)
    listener(this.branchesCache)
    return () => {
      this.branchListeners.delete(listener)
    }
  }

  // ==========================================
  // TABLE TRANSFER & TABLE MERGE
  // ==========================================
  static transferTable(sourceTableIdOrName: string, targetTableIdOrName: string): boolean {
    this.init()
    const src = this.tablesCache.find((t) => t.id === sourceTableIdOrName || sameName(t.name, sourceTableIdOrName))
    const tgt = this.tablesCache.find((t) => t.id === targetTableIdOrName || sameName(t.name, targetTableIdOrName))
    if (!src || !tgt) return false

    const sessionIndex = this.sessionsCache.findIndex((s) => s.table_id === src.id || sameName(s.table_name, src.name))
    if (sessionIndex >= 0) {
      this.sessionsCache[sessionIndex].table_id = tgt.id
      this.sessionsCache[sessionIndex].table_name = tgt.name
    }

    this.ordersCache = this.ordersCache.map((o) => {
      if (sameName(o.table_name, src.name) && o.status === "open") {
        return { ...o, table_name: tgt.name }
      }
      return o
    })

    tgt.status = "occupied"
    tgt.guestName = src.guestName
    tgt.orderNumber = src.orderNumber
    tgt.orderTotal = src.orderTotal
    tgt.occupiedAt = src.occupiedAt

    src.status = "available"
    src.guestName = undefined
    src.orderNumber = undefined
    src.orderTotal = undefined
    src.occupiedAt = undefined

    if (this.isBrowser()) {
      try {
        localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessionsCache))
        localStorage.setItem(ORDERS_KEY, JSON.stringify(this.ordersCache))
      } catch {}
    }
    this.emitTables()
    this.emitSessions()
    this.emitOrders()
    this.broadcast("tables")
    this.broadcast("sessions")
    this.broadcast("orders")
    return true
  }

  static mergeTables(targetTableId: string, sourceTableId: string): boolean {
    this.init()
    const tgt = this.tablesCache.find((t) => t.id === targetTableId)
    const src = this.tablesCache.find((t) => t.id === sourceTableId)
    if (!tgt || !src) return false

    tgt.name = `${tgt.name} + ${src.name}`
    tgt.capacity = (tgt.capacity || 2) + (src.capacity || 2)

    this.ordersCache = this.ordersCache.map((o) => {
      if (sameName(o.table_name, src.name) && o.status === "open") {
        return { ...o, table_name: tgt.name }
      }
      return o
    })

    src.status = "occupied"
    src.guestName = `Merged with ${tgt.name}`

    if (this.isBrowser()) {
      try {
        localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
        localStorage.setItem(ORDERS_KEY, JSON.stringify(this.ordersCache))
      } catch {}
    }
    this.emitTables()
    this.broadcast("tables")
    return true
  }

  static splitTable(_tableId: string): boolean {
    this.init()
    this.tablesCache = DEFAULT_TABLES.map((t) => ({ ...t }))
    if (this.isBrowser()) {
      try { localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache)) } catch {}
    }
    this.emitTables()
    this.broadcast("tables")
    return true
  }

  // ==========================================
  // FULL SYSTEM BACKUP & RESTORE (JSON)
  // ==========================================
  static exportCompleteBackup(): string {
    this.init()
    const backup = {
      system: "POS & ERP System",
      version: "2.4.0",
      exported_at: new Date().toISOString(),
      branch: this.getActiveBranch(),
      tables: this.tablesCache,
      categories: this.categoriesCache,
      products: this.productsCache,
      orders: this.ordersCache,
      customers: this.customersCache,
      promos: this.promosCache,
      feedback: this.feedbackCache,
      suppliers: this.suppliersCache,
      ingredients: this.ingredientsCache,
      ingredient_categories: this.ingredientCategoriesCache,
      recipes: this.recipesCache,
      purchases: this.purchasesCache,
      wastage: this.wastageCache,
      adjustments: this.adjustmentsCache,
      expenses: this.expensesCache,
    }
    return JSON.stringify(backup, null, 2)
  }

  static importCompleteBackup(jsonContent: string): { success: boolean; message: string } {
    this.init()
    try {
      const data = JSON.parse(jsonContent)
      if (!data || typeof data !== "object") {
        return { success: false, message: "Invalid backup file: not a JSON object" }
      }
      if (Array.isArray(data.products)) {
        this.productsCache = data.products
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
        this.emitProducts()
      }
      if (Array.isArray(data.categories)) {
        this.categoriesCache = data.categories
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(this.categoriesCache))
        this.emitCategories()
      }
      if (Array.isArray(data.tables)) {
        this.tablesCache = data.tables
        localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
        this.emitTables()
      }
      if (Array.isArray(data.orders)) {
        this.ordersCache = data.orders
        localStorage.setItem(ORDERS_KEY, JSON.stringify(this.ordersCache))
        this.emitOrders()
      }
      if (Array.isArray(data.customers)) {
        this.customersCache = data.customers
        localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customersCache))
        this.emitCustomers()
      }
      if (Array.isArray(data.suppliers)) {
        this.suppliersCache = data.suppliers
        localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(this.suppliersCache))
        this.emitSuppliers()
      }
      if (Array.isArray(data.ingredients)) {
        this.ingredientsCache = data.ingredients
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(this.ingredientsCache))
        this.emitIngredients()
      }
      if (data.recipes && typeof data.recipes === "object") {
        this.recipesCache = data.recipes
        localStorage.setItem(RECIPES_KEY, JSON.stringify(this.recipesCache))
        this.emitRecipes()
      }
      if (Array.isArray(data.expenses)) {
        this.expensesCache = data.expenses
        localStorage.setItem(EXPENSES_KEY, JSON.stringify(this.expensesCache))
        this.emitExpenses()
      }
      this.broadcast("backup_restored")
      return { success: true, message: `Backup restored successfully! (${data.orders?.length || 0} orders, ${data.products?.length || 0} products)` }
    } catch (err: any) {
      return { success: false, message: `Restore failed: ${err.message}` }
    }
  }
}
