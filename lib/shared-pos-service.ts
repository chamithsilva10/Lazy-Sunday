"use client"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { resolveProductImage } from "@/lib/product-images"
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
  bookingId?: string
}

export interface SharedBooking {
  id: string
  customer_name: string
  phone: string
  party_size: number
  reserved_for: string
  duration_minutes: number
  table_id: string
  table_name: string
  status: "confirmed" | "arrived" | "completed" | "cancelled" | "no_show"
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
const POLL_MS = 20000

export const DEFAULT_TABLES: SharedTable[] = [
  { id: "1", name: "Table 01", capacity: 2, status: "available" },
  { id: "2", name: "Table 02", capacity: 4, status: "available" },
  { id: "3", name: "Table 03", capacity: 4, status: "available" },
  { id: "4", name: "Table 04", capacity: 6, status: "available" },
  { id: "5", name: "Table 05", capacity: 4, status: "available" },
  { id: "6", name: "Table 06", capacity: 2, status: "available" },
  { id: "7", name: "Table 07", capacity: 4, status: "available" },
  { id: "8", name: "Table 08", capacity: 6, status: "available" },
]

export const DEFAULT_CATEGORIES: SharedCategory[] = [
  { id: "cat-tea", name: "Tea", sort_order: 1 },
  { id: "cat-hot-coffee", name: "Hot Coffee", sort_order: 2 },
  { id: "cat-cold-coffee", name: "Cold Coffee", sort_order: 3 },
  { id: "cat-coffee", name: "Coffee & Tea", sort_order: 4 },
  { id: "cat-juices", name: "Fresh Juices", sort_order: 5 },
  { id: "cat-smoothies", name: "Smoothies & Shakes", sort_order: 6 },
  { id: "cat-beverages", name: "Beverages", sort_order: 7 },
  { id: "cat-morning-breath", name: "Morning Breath", sort_order: 8 },
  { id: "cat-mains", name: "Mains", sort_order: 9 },
  { id: "cat-mains-sandwiches", name: "Mains & Sandwiches", sort_order: 10 },
  { id: "cat-handheld", name: "Handheld", sort_order: 11 },
  { id: "cat-appetizer", name: "Appetizer", sort_order: 12 },
  { id: "cat-salad", name: "Salad", sort_order: 13 },
  { id: "cat-soup", name: "Soup", sort_order: 14 },
  { id: "cat-trendy-catchy", name: "Trendy and Catchy", sort_order: 15 },
  { id: "cat-snacks", name: "Snacks & Bites", sort_order: 16 },
  { id: "cat-desserts", name: "Desserts", sort_order: 17 },
  { id: "cat-addons", name: "Add-ons", sort_order: 18 },
]

export const DEFAULT_INGREDIENT_CATEGORIES: SharedIngredientCategory[] = [
  { id: "eab0bccf-7b81-46e4-bb72-660737351286", name: "Coffee & Tea", sort_order: 11 },
  { id: "c082d036-cfc7-48a6-9545-a2b4fe312af3", name: "Dairy", sort_order: 20 },
  { id: "2f6447ed-18e0-413b-88c4-4319526d1c74", name: "Produce", sort_order: 30 },
  { id: "c9b2ba48-f806-4114-b274-c48f884972d6", name: "Dry Goods", sort_order: 40 },
  { id: "32a8a941-541f-49e5-a638-7fe49fe4ea25", name: "Meat & Seafood", sort_order: 51 },
  { id: "65ff45b9-9ff0-40df-8945-9c4e9706162b", name: "Beverages", sort_order: 61 },
  { id: "d7671ae1-cc7c-40c0-a947-a78019b41925", name: "Packaging", sort_order: 70 },
  { id: "59f18c82-5aa9-4a18-83d7-d5c2ef71f3fe", name: "Cleaning", sort_order: 80 },
]

export const DEFAULT_INGREDIENTS: SharedIngredient[] = []

export const DEFAULT_RECIPES: Record<string, SharedRecipeItem[]> = {}

export const DEFAULT_PRODUCTS: SharedProduct[] = [
  // --- TEA ---
  { id: "prod-tea-1", name: "Black Tea", price: 250, category: "Tea", category_id: "cat-tea", image: resolveProductImage("Black Tea", null, "Tea"), stock: 100, description: "Freshly brewed Ceylon black tea", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-tea-2", name: "Ginger Tea", price: 300, category: "Tea", category_id: "cat-tea", image: resolveProductImage("Ginger Tea", null, "Tea"), stock: 100, description: "Warm black tea infused with spicy ginger root", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-tea-3", name: "Green Tea", price: 300, category: "Tea", category_id: "cat-tea", image: resolveProductImage("Green Tea", null, "Tea"), stock: 100, description: "Delicate and cleansing steamed green tea", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-tea-4", name: "Cinnamon Tea", price: 300, category: "Tea", category_id: "cat-tea", image: resolveProductImage("Cinnamon Tea", null, "Tea"), stock: 100, description: "Fragrant Ceylon cinnamon bark tea", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-tea-5", name: "Cardamom Tea", price: 300, category: "Tea", category_id: "cat-tea", image: resolveProductImage("Cardamom Tea", null, "Tea"), stock: 100, description: "Aromatic crushed green cardamom spice tea", temperature: "hot", department: "Coffee Bar", station: "bar" },

  // --- HOT COFFEE ---
  { id: "prod-coffee-1", name: "Espresso", price: 500, category: "Hot Coffee", category_id: "cat-hot-coffee", image: resolveProductImage("Espresso", null, "Hot Coffee"), stock: 100, description: "Rich single origin espresso shot", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-coffee-2", name: "Cappuccino", price: 700, category: "Hot Coffee", category_id: "cat-hot-coffee", image: resolveProductImage("Cappuccino", null, "Hot Coffee"), stock: 100, description: "Velvety steamed milk foam with double espresso", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-coffee-3", name: "Mocha", price: 1200, category: "Hot Coffee", category_id: "cat-hot-coffee", image: resolveProductImage("Mocha", null, "Hot Coffee"), stock: 100, description: "Espresso combined with dark Dutch cocoa and milk", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-coffee-4", name: "Latte", price: 800, category: "Hot Coffee", category_id: "cat-hot-coffee", image: resolveProductImage("Latte", null, "Hot Coffee"), stock: 100, description: "Smooth espresso with silky micro-foam milk", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-coffee-5", name: "Flat White", price: 650, category: "Hot Coffee", category_id: "cat-hot-coffee", image: resolveProductImage("Flat White", null, "Hot Coffee"), stock: 100, description: "Double ristretto poured over flat velvety milk", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-coffee-6", name: "Americano", price: 600, category: "Hot Coffee", category_id: "cat-hot-coffee", image: resolveProductImage("Americano", null, "Hot Coffee"), stock: 100, description: "Espresso lengthened with hot mineral water", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-coffee-7", name: "Bumble Coffee", price: 1200, category: "Hot Coffee", category_id: "cat-hot-coffee", image: resolveProductImage("Bumble Coffee", null, "Hot Coffee"), stock: 100, description: "Signature espresso layered with fresh orange juice and caramel", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-coffee-8", name: "Espresso Tonic", price: 1000, category: "Hot Coffee", category_id: "cat-hot-coffee", image: resolveProductImage("Espresso Tonic", null, "Hot Coffee"), stock: 100, description: "Double espresso poured over crisp craft tonic water", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-10", name: "Espresso Single", price: 550, category: "Hot Coffee", category_id: "cat-hot-coffee", image: resolveProductImage("Espresso Single", null, "Hot Coffee"), stock: 100, department: "Coffee Bar", temperature: "hot", station: "bar" },
  { id: "prod-11", name: "Espresso Double", price: 750, category: "Hot Coffee", category_id: "cat-hot-coffee", image: resolveProductImage("Espresso Double", null, "Hot Coffee"), stock: 100, department: "Coffee Bar", temperature: "hot", station: "bar" },
  { id: "prod-12", name: "Caffe Latte", price: 850, category: "Hot Coffee", category_id: "cat-hot-coffee", image: resolveProductImage("Caffe Latte", null, "Hot Coffee"), stock: 100, department: "Coffee Bar", temperature: "hot", station: "bar" },

  // --- COLD COFFEE ---
  { id: "prod-cc-1", name: "Matcha Latte", price: 800, category: "Cold Coffee", category_id: "cat-cold-coffee", image: resolveProductImage("Matcha Latte", null, "Cold Coffee"), stock: 100, description: "Ceremonial grade Uji matcha whisked with iced milk", temperature: "iced", department: "Coffee Bar", station: "bar" },
  { id: "prod-cc-2", name: "Iced Cappuccino", price: 800, category: "Cold Coffee", category_id: "cat-cold-coffee", image: resolveProductImage("Iced Cappuccino", null, "Cold Coffee"), stock: 100, description: "Chilled espresso poured over ice with thick cold foam", temperature: "iced", department: "Coffee Bar", station: "bar" },
  { id: "prod-cc-3", name: "Iced Latte", price: 900, category: "Cold Coffee", category_id: "cat-cold-coffee", image: resolveProductImage("Iced Latte", null, "Cold Coffee"), stock: 100, description: "Classic espresso and chilled milk poured over ice cubes", temperature: "iced", department: "Coffee Bar", station: "bar" },
  { id: "prod-cc-4", name: "Iced Americano", price: 700, category: "Cold Coffee", category_id: "cat-cold-coffee", image: resolveProductImage("Iced Americano", null, "Cold Coffee"), stock: 100, description: "Crisp iced espresso with purified cold water", temperature: "iced", department: "Coffee Bar", station: "bar" },
  { id: "prod-cc-5", name: "Iced Matcha Latte", price: 1000, category: "Cold Coffee", category_id: "cat-cold-coffee", image: resolveProductImage("Iced Matcha Latte", null, "Cold Coffee"), stock: 100, description: "Double matcha green tea blend served ice cold", temperature: "iced", department: "Coffee Bar", station: "bar" },
  { id: "prod-17", name: "Cold Brew Reserve", price: 900, category: "Cold Coffee", category_id: "cat-cold-coffee", image: resolveProductImage("Cold Brew Reserve", null, "Cold Coffee"), stock: 100, department: "Coffee Bar", temperature: "iced", station: "bar" },
  { id: "prod-16", name: "Iced Lemon Tea", price: 650, category: "Cold Coffee", category_id: "cat-cold-coffee", image: resolveProductImage("Iced Lemon Tea", null, "Cold Coffee"), stock: 100, department: "Coffee Bar", temperature: "iced", station: "bar" },

  // --- ADD-ONS & MODIFIERS ---
  { id: "prod-add-1", name: "Extra Vanilla", price: 200, category: "Add-ons", category_id: "cat-addons", image: resolveProductImage("Extra Vanilla", null, "Add-ons"), stock: 100, description: "Pure Madagascar vanilla syrup pump", department: "Coffee Bar", station: "bar" },
  { id: "prod-add-2", name: "Extra Caramel", price: 200, category: "Add-ons", category_id: "cat-addons", image: resolveProductImage("Extra Caramel", null, "Add-ons"), stock: 100, description: "Rich buttery caramel drizzle", department: "Coffee Bar", station: "bar" },
  { id: "prod-add-3", name: "Oat Milk", price: 500, category: "Add-ons", category_id: "cat-addons", image: resolveProductImage("Oat Milk", null, "Add-ons"), stock: 100, description: "Barista blend creamy oat milk substitution", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-add-4", name: "Soya Milk", price: 500, category: "Add-ons", category_id: "cat-addons", image: resolveProductImage("Soya Milk", null, "Add-ons"), stock: 100, description: "Organic non-GMO soy milk substitution", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-add-5", name: "Almond Milk", price: 500, category: "Add-ons", category_id: "cat-addons", image: resolveProductImage("Almond Milk", null, "Add-ons"), stock: 100, description: "Unsweetened roasted almond milk substitution", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-add-6", name: "Coffee V60", price: 1100, category: "Add-ons", category_id: "cat-addons", image: resolveProductImage("Coffee V60", null, "Add-ons"), stock: 100, description: "Artisanal hand-poured single origin filter brew", department: "Coffee Bar", station: "bar" },

  // --- BEVERAGES & REFRESHMENTS ---
  { id: "prod-bev-1", name: "Water", price: 250, category: "Beverages", category_id: "cat-beverages", image: resolveProductImage("Water", null, "Beverages"), stock: 100, description: "Bottled pure mineral water", department: "Coffee Bar", station: "bar" },
  { id: "prod-bev-2", name: "Fresh Coconut", price: 350, category: "Beverages", category_id: "cat-beverages", image: resolveProductImage("Fresh Coconut", null, "Beverages"), stock: 100, description: "Local chilled king coconut served fresh", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-bev-3", name: "Soft Drinks", price: 400, category: "Beverages", category_id: "cat-beverages", image: resolveProductImage("Soft Drinks", null, "Beverages"), stock: 100, description: "Choice of Coca-Cola, Sprite, Coke Zero, or Ginger Beer", department: "Coffee Bar", station: "bar" },
  { id: "prod-bev-4", name: "Fresh Juice", price: 800, category: "Beverages", category_id: "cat-beverages", image: resolveProductImage("Fresh Juice", null, "Beverages"), stock: 100, description: "Freshly squeezed: Lime, Mango, Papaya, Pineapple, Watermelon, or Passion Fruit", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-bev-5", name: "Mix Juice", price: 900, category: "Beverages", category_id: "cat-beverages", image: resolveProductImage("Mix Juice", null, "Beverages"), stock: 100, description: "Fresh tropical blended mixed juice", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },

  // --- FRESH JUICES ---
  { id: "prod-1", name: "Papaya Lime Juice", price: 650, category: "Fresh Juices", category_id: "cat-juices", image: resolveProductImage("Papaya Lime Juice", null, "Fresh Juices"), stock: 100, department: "Juice & Food", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-2", name: "Watermelon Cooler", price: 700, category: "Fresh Juices", category_id: "cat-juices", image: resolveProductImage("Watermelon Cooler", null, "Fresh Juices"), stock: 100, department: "Juice & Food", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-3", name: "King Coconut Fresh", price: 450, category: "Fresh Juices", category_id: "cat-juices", image: resolveProductImage("King Coconut Fresh", null, "Fresh Juices"), stock: 100, department: "Juice & Food", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-4", name: "Pineapple Mint Zing", price: 750, category: "Fresh Juices", category_id: "cat-juices", image: resolveProductImage("Pineapple Mint Zing", null, "Fresh Juices"), stock: 100, department: "Juice & Food", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-5", name: "Passion Fruit Sparkler", price: 800, category: "Fresh Juices", category_id: "cat-juices", image: resolveProductImage("Passion Fruit Sparkler", null, "Fresh Juices"), stock: 100, department: "Juice & Food", station: "bar", dietary_tags: ["VEG"] },

  // --- SMOOTHIES & SHAKES ---
  { id: "prod-6", name: "Tropical Green Bowl", price: 1150, category: "Smoothies & Shakes", category_id: "cat-smoothies", image: resolveProductImage("Tropical Green Bowl", null, "Smoothies & Shakes"), stock: 100, department: "Juice & Food", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-7", name: "Mango Passion Smoothie", price: 950, category: "Smoothies & Shakes", category_id: "cat-smoothies", image: resolveProductImage("Mango Passion Smoothie", null, "Smoothies & Shakes"), stock: 100, department: "Juice & Food", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-8", name: "Dragonfruit Dream Shake", price: 1050, category: "Smoothies & Shakes", category_id: "cat-smoothies", image: resolveProductImage("Dragonfruit Dream Shake", null, "Smoothies & Shakes"), stock: 100, department: "Juice & Food", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-9", name: "Peanut Butter Banana Shake", price: 950, category: "Smoothies & Shakes", category_id: "cat-smoothies", image: resolveProductImage("Peanut Butter Banana Shake", null, "Smoothies & Shakes"), stock: 100, department: "Juice & Food", station: "bar", dietary_tags: ["VEG"] },

  // --- APPETIZER ---
  { id: "prod-app-1", name: "Crispy Tofu", price: 1000, category: "Appetizer", category_id: "cat-appetizer", image: resolveProductImage("Crispy Tofu", null, "Appetizer"), stock: 100, description: "Crispy golden spiced tofu cubes with dipping sauce", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-app-2", name: "Garlic Bread with Mozzarella", price: 1300, category: "Appetizer", category_id: "cat-appetizer", image: resolveProductImage("Garlic Bread with Mozzarella", null, "Appetizer"), stock: 100, description: "Toasted baguette slices with rich garlic butter and melted mozzarella", department: "Juice & Food", station: "kitchen" },
  { id: "prod-app-3", name: "French Fries", price: 1500, category: "Appetizer", category_id: "cat-appetizer", image: resolveProductImage("French Fries", null, "Appetizer"), stock: 100, description: "Classic salted crispy potato french fries", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },

  // --- SALAD ---
  { id: "prod-sal-1", name: "Fresh Green Salad", price: 1400, category: "Salad", category_id: "cat-salad", image: resolveProductImage("Fresh Green Salad", null, "Salad"), stock: 100, description: "Cabbage, cucumber, spring onion, tomato, carrot and vinaigrette dressing", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-sal-2", name: "Avocado Salad", price: 1800, category: "Salad", category_id: "cat-salad", image: resolveProductImage("Avocado Salad", null, "Salad"), stock: 100, description: "Fresh avocado, cucumber, tomato, parsley and extra virgin olive oil", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-sal-3", name: "Catalana di Gamberi", price: 1800, category: "Salad", category_id: "cat-salad", image: resolveProductImage("Catalana di Gamberi", null, "Salad"), stock: 100, description: "Fresh local prawns, tender leeks, cherry tomatoes, olive oil and lime", department: "Juice & Food", station: "kitchen" },
  { id: "prod-sal-4", name: "Chicken Salad", price: 1900, category: "Salad", category_id: "cat-salad", image: resolveProductImage("Chicken Salad", null, "Salad"), stock: 100, description: "Grilled chicken strips, fresh garden greens, Parmesan shavings and house dressing", department: "Juice & Food", station: "kitchen" },
  { id: "prod-21", name: "Hiriketiya Salad Bowl", price: 1250, category: "Salad", category_id: "cat-salad", image: resolveProductImage("Hiriketiya Salad Bowl", null, "Salad"), stock: 100, department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },

  // --- SOUP ---
  { id: "prod-soup-1", name: "Pumpkin Soup", price: 1800, category: "Soup", category_id: "cat-soup", image: resolveProductImage("Pumpkin Soup", null, "Soup"), stock: 100, description: "Creamy roasted pumpkin soup with herbs, served with crusty garlic bread", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-soup-2", name: "Vegan Noodles Soup", price: 1800, category: "Soup", category_id: "cat-soup", image: resolveProductImage("Vegan Noodles Soup", null, "Soup"), stock: 100, description: "Fresh vegetables, rice noodles, silken tofu and aromatic coconut broth", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-soup-3", name: "Creamy Chicken Soup", price: 1900, category: "Soup", category_id: "cat-soup", image: resolveProductImage("Creamy Chicken Soup", null, "Soup"), stock: 100, description: "Slow-simmered chicken breast, potato, carrot, leeks and garlic croutons", department: "Juice & Food", station: "kitchen" },

  // --- MAINS ---
  { id: "prod-main-1", name: "Tuna Tartare", price: 2300, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Tuna Tartare", null, "Mains"), stock: 100, description: "Fresh sashimi tuna, diced avocado, red onion, capers and citrus olive oil", department: "Juice & Food", station: "kitchen" },
  { id: "prod-main-2", name: "Hummus with Paratha Rotti", price: 1800, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Hummus with Paratha Rotti", null, "Mains"), stock: 100, description: "Velvety spiced chickpea hummus, tahini, cumin and warm flaky paratha", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-main-3", name: "BBQ Tofu Rice", price: 2000, category: "Mains", category_id: "cat-mains", image: resolveProductImage("BBQ Tofu Rice", null, "Mains"), stock: 100, description: "Smoky glazed BBQ tofu, sweet bell pepper, onion and fragrant jasmine rice", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-main-4", name: "Buddha Bowl", price: 2500, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Buddha Bowl", null, "Mains"), stock: 100, description: "Edamame, chickpeas, roasted vegetables, crispy tofu, avocado and brown rice", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-main-5", name: "Vegan Spaghetti Bolognese", price: 2200, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Vegan Spaghetti Bolognese", null, "Mains"), stock: 100, description: "Al dente spaghetti tossed in slow cooked minced soya tomato ragù", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-main-6", name: "Black Chicken Curry", price: 2300, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Black Chicken Curry", null, "Mains"), stock: 100, description: "Authentic southern Sri Lankan roasted spice black chicken curry, coconut rotti and sambol", department: "Juice & Food", station: "kitchen" },
  { id: "prod-main-7", name: "Zucchini Gamberi", price: 2500, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Zucchini Gamberi", null, "Mains"), stock: 100, description: "Fusilli pasta tossed in house zucchini pesto and sweet ocean prawns", department: "Juice & Food", station: "kitchen" },
  { id: "prod-main-8", name: "Gnocchi con Calamari", price: 2300, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Gnocchi con Calamari", null, "Mains"), stock: 100, description: "Handmade potato gnocchi with tender calamari rings in rich tomato sauce", department: "Juice & Food", station: "kitchen" },
  { id: "prod-main-9", name: "Nasi Goreng", price: 2000, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Nasi Goreng", null, "Mains"), stock: 100, description: "Indonesian wok-fried rice with seafood, chicken skewers and a sunny side egg", department: "Juice & Food", station: "kitchen" },
  { id: "prod-main-10", name: "Shakshouka", price: 2000, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Shakshouka", null, "Mains"), stock: 100, description: "Two poached eggs in spiced tomato, cumin and sweet pepper sauce with sourdough", department: "Juice & Food", station: "kitchen" },
  { id: "prod-main-11", name: "Grilled Tuna", price: 2500, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Grilled Tuna", null, "Mains"), stock: 100, description: "Pan-seared yellowfin tuna steak, creamy mashed potato and sautéed garden greens", department: "Juice & Food", station: "kitchen" },
  { id: "prod-main-12", name: "Vegan Penne Ai Funghi", price: 2000, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Vegan Penne Ai Funghi", null, "Mains"), stock: 100, description: "Creamy wild mushroom penne in velvety coconut cream sauce and parsley", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-main-13", name: "Seafood Marinara", price: 2500, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Seafood Marinara", null, "Mains"), stock: 100, description: "Fresh fish fillets, calamari, jumbo prawns and mussels in basil garlic marinara", department: "Juice & Food", station: "kitchen" },
  { id: "prod-19", name: "Delicious Handcrafted Pizza", price: 2100, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Delicious Handcrafted Pizza", null, "Mains"), stock: 100, department: "Juice & Food", station: "kitchen" },
  { id: "prod-20", name: "Crispy Chicken Wings", price: 1450, category: "Mains", category_id: "cat-mains", image: resolveProductImage("Crispy Chicken Wings", null, "Mains"), stock: 100, department: "Juice & Food", station: "kitchen" },

  // --- HANDHELD & SANDWICHES ---
  { id: "prod-hh-1", name: "Prime Angus Burger", price: 2000, category: "Handheld", category_id: "cat-handheld", image: resolveProductImage("Prime Angus Burger", null, "Handheld"), stock: 100, description: "Signature house beef or veggie patty with crisp fries and fresh coleslaw", department: "Juice & Food", station: "kitchen" },
  { id: "prod-hh-2", name: "Mushroom Burger", price: 2200, category: "Handheld", category_id: "cat-handheld", image: resolveProductImage("Mushroom Burger", null, "Handheld"), stock: 100, description: "Grilled portobello mushroom patty with caramelized onions and fries", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-hh-3", name: "Veggie Panini", price: 1800, category: "Handheld", category_id: "cat-handheld", image: resolveProductImage("Veggie Panini", null, "Handheld"), stock: 100, description: "Pressed ciabatta with grilled zucchini, sweet pepper, pesto and fries", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-hh-4", name: "Signature Chicken Panini", price: 1800, category: "Handheld", category_id: "cat-handheld", image: resolveProductImage("Signature Chicken Panini", null, "Handheld"), stock: 100, description: "House grilled chicken, smoked mozzarella, ripe tomato and fries", department: "Juice & Food", station: "kitchen" },
  { id: "prod-hh-5", name: "Egg and Cheese Panini", price: 1900, category: "Handheld", category_id: "cat-handheld", image: resolveProductImage("Egg and Cheese Panini", null, "Handheld"), stock: 100, description: "Scrambled egg, cheddar, sliced tomato and cucumber in toasted panini", department: "Juice & Food", station: "kitchen" },
  { id: "prod-hh-6", name: "Coconut Sambol Panini", price: 2000, category: "Handheld", category_id: "cat-handheld", image: resolveProductImage("Coconut Sambol Panini", null, "Handheld"), stock: 100, description: "Melted mozzarella, fried egg, spicy fresh coconut pol sambol and fries", department: "Juice & Food", station: "kitchen" },
  { id: "prod-hh-7", name: "Club Sandwich", price: 2200, category: "Handheld", category_id: "cat-handheld", image: resolveProductImage("Club Sandwich", null, "Handheld"), stock: 100, description: "Triple decker toasted sandwich with chicken ham, egg, lettuce, tomato and fries", department: "Juice & Food", station: "kitchen" },
  { id: "prod-18", name: "Classic Beef Burger", price: 1650, category: "Handheld", category_id: "cat-handheld", image: resolveProductImage("Classic Beef Burger", null, "Handheld"), stock: 100, department: "Juice & Food", station: "kitchen" },

  // --- MORNING BREATH (BREAKFAST) ---
  { id: "prod-mb-1", name: "Fruit Platter", price: 1400, category: "Morning Breath", category_id: "cat-morning-breath", image: resolveProductImage("Fruit Platter", null, "Morning Breath"), stock: 100, description: "Seasonal sliced papaya, watermelon, pineapple, passion fruit and banana", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-mb-2", name: "Best Bowl", price: 1800, category: "Morning Breath", category_id: "cat-morning-breath", image: resolveProductImage("Best Bowl", null, "Morning Breath"), stock: 100, description: "Creamy avocado, golden hash browns, bacon strips, sausage, sourdough and eggs", department: "Juice & Food", station: "kitchen" },
  { id: "prod-mb-3", name: "Eggs Benedict", price: 1900, category: "Morning Breath", category_id: "cat-morning-breath", image: resolveProductImage("Eggs Benedict", null, "Morning Breath"), stock: 100, description: "Two poached farm eggs, creamy hollandaise sauce, bacon, avocado on sourdough", department: "Juice & Food", station: "kitchen" },
  { id: "prod-mb-4", name: "Spinach and Potato Omelette", price: 1700, category: "Morning Breath", category_id: "cat-morning-breath", image: resolveProductImage("Spinach and Potato Omelette", null, "Morning Breath"), stock: 100, description: "Fluffy 3-egg omelette with baby spinach, sautéed potatoes and sourdough toast", department: "Juice & Food", station: "kitchen" },
  { id: "prod-mb-5", name: "Scrambled Tofu", price: 1800, category: "Morning Breath", category_id: "cat-morning-breath", image: resolveProductImage("Scrambled Tofu", null, "Morning Breath"), stock: 100, description: "Turmeric spiced scrambled tofu, sliced avocado, wilted spinach and sourdough", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-mb-6", name: "Vegan New York Pancake", price: 1800, category: "Morning Breath", category_id: "cat-morning-breath", image: resolveProductImage("Vegan New York Pancake", null, "Morning Breath"), stock: 100, description: "Stack of fluffy vegan pancakes with sliced banana, kithul treacle and chocolate sauce", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-mb-7", name: "Sri Lankan Coconut Rotti", price: 1800, category: "Morning Breath", category_id: "cat-morning-breath", image: resolveProductImage("Sri Lankan Coconut Rotti", null, "Morning Breath"), stock: 100, description: "Warm fresh coconut pol rotti served with spicy dhal curry and fresh sambol", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-mb-8", name: "Breaky Burger", price: 1900, category: "Morning Breath", category_id: "cat-morning-breath", image: resolveProductImage("Breaky Burger", null, "Morning Breath"), stock: 100, description: "Brioche bun with crispy hash browns, bacon, fried egg, relish and greens", department: "Juice & Food", station: "kitchen" },

  // --- TRENDY AND CATCHY (BOWLS) ---
  { id: "prod-tc-1", name: "Mango Smoothie Bowl", price: 1900, category: "Trendy and Catchy", category_id: "cat-trendy-catchy", image: resolveProductImage("Mango Smoothie Bowl", null, "Trendy and Catchy"), stock: 100, description: "Thick mango and banana base topped with chia seeds, coconut flakes and fresh fruits", department: "Juice & Food", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-tc-2", name: "Coco Banana Smoothie Bowl", price: 1800, category: "Trendy and Catchy", category_id: "cat-trendy-catchy", image: resolveProductImage("Coco Banana Smoothie Bowl", null, "Trendy and Catchy"), stock: 100, description: "Raw cocoa, frozen banana, coconut milk, roasted pumpkin seeds and kiwi", department: "Juice & Food", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-tc-3", name: "Vegan Porridge Bowl", price: 1900, category: "Trendy and Catchy", category_id: "cat-trendy-catchy", image: resolveProductImage("Vegan Porridge Bowl", null, "Trendy and Catchy"), stock: 100, description: "Rolled oats simmered in coconut milk, topped with dates, raisins, peanut butter and banana", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-tc-4", name: "Granola Bowl", price: 2000, category: "Trendy and Catchy", category_id: "cat-trendy-catchy", image: resolveProductImage("Granola Bowl", null, "Trendy and Catchy"), stock: 100, description: "Crunchy toasted artisan granola, buffalo curd, sliced tropical fruits and kithul treacle", department: "Juice & Food", station: "kitchen" },

  // --- SNACKS & BITES ---
  { id: "prod-22", name: "Crispy French Fries", price: 750, category: "Snacks & Bites", category_id: "cat-snacks", image: resolveProductImage("Crispy French Fries", null, "Snacks & Bites"), stock: 100, department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-23", name: "Cheesy Garlic Fries", price: 950, category: "Snacks & Bites", category_id: "cat-snacks", image: resolveProductImage("Cheesy Garlic Fries", null, "Snacks & Bites"), stock: 100, department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },

  // --- DESSERTS ---
  { id: "prod-24", name: "Warm Apple Pie Slice", price: 850, category: "Desserts", category_id: "cat-desserts", image: resolveProductImage("Warm Apple Pie Slice", null, "Desserts"), stock: 100, department: "Juice & Food", station: "kitchen" },
  { id: "prod-25", name: "New York Cheesecake Slice", price: 950, category: "Desserts", category_id: "cat-desserts", image: resolveProductImage("New York Cheesecake Slice", null, "Desserts"), stock: 100, department: "Juice & Food", station: "kitchen" },
  { id: "prod-26", name: "Chocolate Fudge Brownie", price: 800, category: "Desserts", category_id: "cat-desserts", image: resolveProductImage("Chocolate Fudge Brownie", null, "Desserts"), stock: 100, department: "Juice & Food", station: "kitchen" },
  { id: "prod-27", name: "Chocolate Cake Slice", price: 900, category: "Desserts", category_id: "cat-desserts", image: resolveProductImage("Chocolate Cake Slice", null, "Desserts"), stock: 100, department: "Juice & Food", station: "kitchen" },
  { id: "prod-28", name: "Artisan Ice Cream Sundae", price: 950, category: "Desserts", category_id: "cat-desserts", image: resolveProductImage("Artisan Ice Cream Sundae", null, "Desserts"), stock: 100, department: "Juice & Food", station: "kitchen" },
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

const isTakeaway = (name?: string) => !name || name.trim().toLowerCase() === "takeaway"
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export class SharedPosService {
  private static tablesCache: SharedTable[] = []
  private static bookingsCache: SharedBooking[] = []
  private static sessionsCache: SharedSession[] = []
  private static productsCache: SharedProduct[] = []
  private static categoriesCache: SharedCategory[] = []
  private static ordersCache: SharedOrder[] = []
  private static ingredientsCache: SharedIngredient[] = []
  private static ingredientCategoriesCache: SharedIngredientCategory[] = []
  private static recipesCache: Record<string, SharedRecipeItem[]> = {}
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

    // Tables
    try {
      const rawTables = localStorage.getItem(TABLES_KEY)
      this.tablesCache = rawTables ? JSON.parse(rawTables) : DEFAULT_TABLES.map((t) => ({ ...t }))
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
        if (missing.length > 0 && this.isBrowser()) {
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

  static async refresh(): Promise<void> {
    this.init()
    if (!isSupabaseConfigured() || !this.isBrowser()) return
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
          if (b.status === "arrived" || (now >= start - 30 * 60000 && now <= end)) {
            bookingByTable.set(String(b.table_id), b)
          }
        }

        const previous = new Map(this.tablesCache.map((t) => [t.id, t]))
        this.tablesCache = rows.map((row: any) => {
          const session = sessionByTable.get(String(row.id))
          const booking = bookingByTable.get(String(row.id))
          const prev = previous.get(String(row.id))

          let status: SharedTable["status"] = "available"
          if (session) {
            status = session.status === "bill_requested" ? "bill_requested" : "occupied"
          } else if (booking) {
            status = "reserved"
          } else if (row.status === "cleaning") {
            status = "cleaning"
          } else if (row.status === "occupied") {
            status = "occupied"
          }

          return {
            id: String(row.id),
            name: row.name,
            capacity: Number(row.capacity) || 2,
            status,
            department: status === "occupied" ? prev?.department : undefined,
            orderNumber: status === "occupied" ? prev?.orderNumber : undefined,
            orderTotal: status === "occupied" ? prev?.orderTotal : undefined,
            guestName: session?.customer_name || booking?.customer_name,
            occupiedAt: session?.seated_at || (booking ? booking.reserved_for : undefined),
            bookingId: booking?.id,
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
          table_name: this.tablesCache.find((t) => t.id === String(b.table_id))?.name || "Table",
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
    const table = this.tablesCache.find((t) => sameName(t.name, tableName))
    if (!table) return

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

    // Save session
    const existingSession = this.sessionsCache.find((s) => s.table_id === table.id && s.status !== "closed")
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
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessionsCache))
    }

    localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
    this.emitTables()
    this.broadcast("tables")

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        await supabase.from("pos_tables").update({ status: "occupied" }).eq("id", table.id)
      } catch {}
    }
  }

  static async releaseTable(tableName: string) {
    this.init()
    if (isTakeaway(tableName)) return
    const table = this.tablesCache.find((t) => sameName(t.name, tableName))
    if (!table) return

    this.tablesCache = this.tablesCache.map((t) =>
      sameName(t.name, tableName)
        ? {
            ...t,
            status: "available",
            department: undefined,
            orderNumber: undefined,
            orderTotal: undefined,
            guestName: undefined,
            occupiedAt: undefined,
            bookingId: undefined,
          }
        : t,
    )

    this.sessionsCache = this.sessionsCache.map((s) =>
      s.table_id === table.id && s.status !== "closed" ? { ...s, status: "closed" as const } : s,
    )

    localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessionsCache))
    this.emitTables()
    this.broadcast("tables")

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        await supabase.from("pos_tables").update({ status: "available" }).eq("id", table.id)
        await supabase
          .from("table_sessions")
          .update({ status: "closed", closed_at: new Date().toISOString() })
          .eq("table_id", table.id)
          .in("status", ["open", "bill_requested"])
      } catch {}
    }
  }

  static async setTableStatus(tableId: string, status: SharedTable["status"]) {
    this.init()
    const table = this.tablesCache.find((t) => t.id === tableId)
    if (!table) return
    if (status === "available") return this.releaseTable(table.name)

    this.tablesCache = this.tablesCache.map((t) => (t.id === tableId ? { ...t, status } : t))
    localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
    this.emitTables()
    this.broadcast("tables")

    if (isSupabaseConfigured()) {
      try {
        await createClient().from("pos_tables").update({ status }).eq("id", tableId)
      } catch {}
    }
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
    const newBooking: SharedBooking = {
      ...booking,
      id: "res-" + Date.now(),
      created_at: new Date().toISOString(),
    }
    this.bookingsCache = [newBooking, ...this.bookingsCache]

    // If booking is for right now or starting soon, mark table as reserved
    const targetTable = this.tablesCache.find((t) => t.id === newBooking.table_id || sameName(t.name, newBooking.table_name))
    if (targetTable) {
      this.tablesCache = this.tablesCache.map((t) =>
        t.id === targetTable.id
          ? {
              ...t,
              status: t.status === "available" ? "reserved" : t.status,
              guestName: newBooking.customer_name,
              occupiedAt: newBooking.reserved_for,
              bookingId: newBooking.id,
            }
          : t,
      )
    }

    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(this.bookingsCache))
    localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
    this.emitBookings()
    this.emitTables()
    this.broadcast("bookings")
    this.broadcast("tables")

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        await supabase.from("reservations").insert({
          customer_name: newBooking.customer_name,
          phone: newBooking.phone,
          party_size: newBooking.party_size,
          reserved_for: newBooking.reserved_for,
          duration_minutes: newBooking.duration_minutes,
          table_id: newBooking.table_id,
          special_requests: newBooking.special_requests || "",
          status: newBooking.status,
          source: newBooking.source || "staff",
        })
        await this.refresh()
      } catch {}
    }
    return newBooking
  }

  static async updateBookingStatus(id: string, status: SharedBooking["status"]) {
    this.init()
    this.bookingsCache = this.bookingsCache.map((b) => (b.id === id ? { ...b, status } : b))
    if (status === "cancelled" || status === "no_show" || status === "completed") {
      this.tablesCache = this.tablesCache.map((t) => (t.bookingId === id && t.status === "reserved" ? { ...t, status: "available", bookingId: undefined } : t))
    }
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(this.bookingsCache))
    localStorage.setItem(TABLES_KEY, JSON.stringify(this.tablesCache))
    this.emitBookings()
    this.emitTables()
    this.broadcast("bookings")
    this.broadcast("tables")

    if (isSupabaseConfigured()) {
      try {
        await createClient().from("reservations").update({ status, updated_at: new Date().toISOString() }).eq("id", id)
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
    if (!isSupabaseConfigured() || !this.isBrowser()) return
    try {
      const supabase = createClient()
      const [{ data: ps }, { data: cs }] = await Promise.all([
        supabase.from("pos_products").select("*").eq("is_archived", false).order("name"),
        supabase.from("pos_categories").select("*").eq("is_active", true).order("sort_order"),
      ])
      if (cs && cs.length > 0) {
        this.categoriesCache = cs.map((c: any) => ({ id: String(c.id), name: c.name, sort_order: c.sort_order }))
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(this.categoriesCache))
        this.emitCategories()
      }
      if (ps && ps.length > 0) {
        const catMap = new Map(this.categoriesCache.map((c) => [c.id, c.name]))
        this.productsCache = ps.map((p: any) => {
          const categoryName = catMap.get(String(p.category_id)) || p.category || "General"
          const station = (p.station as "kitchen" | "bar") || determineItemStation({
            station: p.station,
            department: p.department_override,
            category: categoryName,
            name: p.name,
          })
          return {
            id: String(p.id),
            name: p.name,
            price: Number(p.price) || 0,
            category: categoryName,
            category_id: p.category_id ? String(p.category_id) : undefined,
            image: p.image || "/placeholder.svg",
            stock: Number(p.stock) || 0,
            description: p.description || "",
            temperature: p.temperature || "none",
            dietary_tags: p.dietary_tags || [],
            department: p.department_override || (station === "bar" ? "Coffee Bar" : "Juice & Food"),
            station,
            active: p.active !== false,
            is_archived: p.is_archived === true,
          }
        })
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
        this.emitProducts()
      }
    } catch {}
  }

  static async saveProduct(product: Partial<SharedProduct> & { name: string; price: number }) {
    this.init()
    const isNew = !product.id || product.id.startsWith("new-")
    const id = isNew ? "prod-" + Date.now() : product.id!
    const station = product.station || determineItemStation({
      station: product.station,
      department: product.department,
      category: product.category,
      name: product.name,
    })
    const department = product.department || (station === "bar" ? "Coffee Bar" : "Juice & Food")
    const cleanProduct: SharedProduct = {
      id,
      name: product.name.trim(),
      price: Number(product.price) || 0,
      category: product.category || (station === "bar" ? "Fresh Juices" : "Mains"),
      category_id: product.category_id,
      image: product.image || "/latte-coffee.png",
      stock: Number(product.stock) || 20,
      description: product.description || "",
      temperature: product.temperature || "none",
      dietary_tags: product.dietary_tags || [],
      department,
      station,
      active: product.active !== false,
      is_archived: false,
    }

    if (isNew) {
      this.productsCache = [cleanProduct, ...this.productsCache]
    } else {
      this.productsCache = this.productsCache.map((p) => (p.id === id ? { ...p, ...cleanProduct } : p))
    }

    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
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
        void fetch(`/api/products/${encodeURIComponent(id)}`, {
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
          await supabase.from("pos_products").update({
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
          }).eq("id", id)
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
    const prod = this.productsCache.find((p) => p.id === productId)
    if (!prod) return

    const newStock = Math.max(0, prod.stock + quantityChange)
    this.productsCache = this.productsCache.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
    this.emitProducts()
    this.broadcast("products")

    this.logMovement({
      product_id: productId,
      product_name: prod.name,
      department: (prod.department as any) || "Juice & Food",
      quantity_change: quantityChange,
      reason,
    })

    if (isSupabaseConfigured()) {
      try {
        await createClient().from("pos_products").update({ stock: newStock }).eq("id", productId)
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

  private static async refreshOrdersFromCloud() {
    if (!this.isBrowser()) return
    try {
      // 1. Fetch unified orders via API route or Supabase
      let fetchedOrders: SharedOrder[] = []

      if (isSupabaseConfigured()) {
        const { data, error } = await createClient()
          .from("pos_orders")
          .select(`
            *,
            order_items (
              id,
              product_id,
              product_name_snapshot,
              unit_price_snapshot,
              quantity,
              station,
              item_status
            )
          `)
          .order("created_at", { ascending: false })

        if (!error && Array.isArray(data)) {
          fetchedOrders = data.map((o: any) => ({
            id: String(o.id),
            order_number: o.order_number,
            receipt_number: o.receipt_number || "",
            table_name: o.table_name || "Takeaway",
            cashier_name: o.cashier_name || "Staff",
            department: o.department || "Juice & Food",
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
            kitchen_status: o.kitchen_status || "served",
            bar_status: o.bar_status || "served",
            created_at: o.created_at || new Date().toISOString(),
          }))
        }
      } else {
        // Offline / local API fallback
        try {
          const res = await fetch("/api/orders?all=true", { cache: "no-store" })
          if (res.ok) {
            const json = await res.json()
            if (json.orders && Array.isArray(json.orders)) {
              fetchedOrders = json.orders
            }
          }
        } catch {}
      }

      if (fetchedOrders.length > 0) {
        const map = new Map<string, SharedOrder>()
        this.ordersCache.forEach((o) => {
          map.set(o.order_number || o.id, o)
        })
        fetchedOrders.forEach((cloud) => {
          const key = cloud.order_number || cloud.id
          const local = map.get(key)
          if (!local) {
            map.set(key, cloud)
          } else {
            const kitchenServed = local.kitchen_status === "served" || cloud.kitchen_status === "served"
            const barServed = local.bar_status === "served" || cloud.bar_status === "served"
            const isCompleted = (local.status === "completed" || cloud.status === "completed") ||
              (kitchenServed && barServed && (local.status === "paid" || cloud.status === "paid"))

            map.set(key, {
              ...local,
              ...cloud,
              kitchen_status: kitchenServed ? "served" : (cloud.kitchen_status || local.kitchen_status),
              bar_status: barServed ? "served" : (cloud.bar_status || local.bar_status),
              status: isCompleted ? "completed" : (local.status === "paid" ? "paid" : cloud.status),
            })
          }
        })

        this.ordersCache = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        localStorage.setItem(ORDERS_KEY, JSON.stringify(this.ordersCache))
        this.emitOrders()
      }
    } catch (err) {
      console.warn("refreshOrdersFromCloud error", err)
    }
  }

  static async saveOrder(order: SharedOrder) {
    this.init()

    const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str))
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

    // Upsert into orders cache
    const existingById = this.ordersCache.findIndex((o) => o.id === normalizedOrder.id)
    const existingByNum = this.ordersCache.findIndex((o) => o.order_number === normalizedOrder.order_number)

    if (existingById >= 0) {
      this.ordersCache[existingById] = { ...this.ordersCache[existingById], ...normalizedOrder }
    } else if (existingByNum >= 0 && this.ordersCache[existingByNum].id !== normalizedOrder.id) {
      const fresh = this.getNextOrderNumber()
      normalizedOrder.order_number = fresh.orderNumber
      normalizedOrder.receipt_number = fresh.receiptNumber
      this.ordersCache = [normalizedOrder, ...this.ordersCache]
    } else if (existingByNum >= 0) {
      this.ordersCache[existingByNum] = { ...this.ordersCache[existingByNum], ...normalizedOrder }
    } else {
      this.ordersCache = [normalizedOrder, ...this.ordersCache]
    }

    localStorage.setItem(ORDERS_KEY, JSON.stringify(this.ordersCache))
    this.emitOrders()
    this.broadcast("orders", normalizedOrder)

    // Deduct products stock and recipe ingredients
    for (const item of normalizedOrder.items) {
      const target = this.productsCache.find((p) => p.id === item.id || sameName(p.name, item.name))
      if (target) {
        const remaining = Math.max(0, target.stock - (item.quantity || 1))
        this.productsCache = this.productsCache.map((p) => (p.id === target.id ? { ...p, stock: remaining } : p))
      }
      const targetKey = target?.id || item.id || item.name
      if (targetKey) {
        await this.deductRecipeIngredients(
          targetKey,
          item.quantity || 1,
          normalizedOrder.order_number,
          normalizedOrder.id
        )
      }
    }
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.productsCache))
    this.emitProducts()
    this.broadcast("products")

    // Update table occupation/release
    if (!isTakeaway(normalizedOrder.table_name)) {
      if (normalizedOrder.status === "open") {
        void this.occupyTable(
          normalizedOrder.table_name,
          normalizedOrder.department === "Coffee Bar" ? "Coffee Bar" : "Juice & Food",
          normalizedOrder.order_number,
          normalizedOrder.total,
          normalizedOrder.cashier_name
        )
      } else if (normalizedOrder.status === "paid" || normalizedOrder.status === "completed") {
        void this.releaseTable(normalizedOrder.table_name)
      }
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

    // Persist to backend /api/orders
    try {
      const payload = {
        id: normalizedOrder.id,
        order_number: normalizedOrder.order_number,
        receipt_number: normalizedOrder.receipt_number,
        table_name: normalizedOrder.table_name,
        cashier_name: normalizedOrder.cashier_name,
        department: normalizedOrder.department || (normalizedOrder.ticket_source === "coffee_bill" ? "Coffee Bar" : "Juice & Food"),
        order_type: normalizedOrder.ticket_source === "coffee_bill" ? "coffee_bar" : (isTakeaway(normalizedOrder.table_name) ? "takeaway" : "dine_in"),
        items: normalizedOrder.items,
        subtotal: normalizedOrder.subtotal,
        service_charge: normalizedOrder.service_charge || 0,
        service_charge_rate: normalizedOrder.service_charge_rate || 0,
        discount: normalizedOrder.discount || 0,
        tax: 0,
        total: normalizedOrder.total,
        payment_method: normalizedOrder.payment_method || "cash",
        split_payments: normalizedOrder.split_payments,
        cash_received: normalizedOrder.cash_received || normalizedOrder.total,
        change_amount: normalizedOrder.change_amount || 0,
        status: normalizedOrder.status,
      }

      void fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((err) => console.warn("Failed posting order to /api/orders", err))
    } catch {}

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        const dbPayload: any = {
          order_number: normalizedOrder.order_number,
          receipt_number: normalizedOrder.receipt_number,
          table_name: normalizedOrder.table_name,
          cashier_name: normalizedOrder.cashier_name,
          subtotal: normalizedOrder.subtotal,
          service_charge: normalizedOrder.service_charge,
          discount: normalizedOrder.discount,
          total: normalizedOrder.total,
          payment_method: normalizedOrder.payment_method,
          split_payments: normalizedOrder.split_payments || [],
          cash_received: normalizedOrder.cash_received || 0,
          change_amount: normalizedOrder.change_amount || 0,
          status: normalizedOrder.status,
          items: normalizedOrder.items,
          kitchen_status: normalizedOrder.kitchen_status || "pending",
          bar_status: normalizedOrder.bar_status || "pending",
          notes: normalizedOrder.split_payments?.length
            ? JSON.stringify({ split_payments: normalizedOrder.split_payments })
            : (normalizedOrder.notes || ""),
          created_at: normalizedOrder.created_at,
        }
        if (isUuid(validId)) {
          dbPayload.id = validId
        }
        const { error: upsertErr } = await supabase.from("pos_orders").upsert(dbPayload, { onConflict: "order_number" })
        if (upsertErr) {
          console.warn("Could not upsert order to Supabase; retrying fallback without split_payments", upsertErr)
          const fallback = { ...dbPayload }
          delete fallback.split_payments
          await supabase.from("pos_orders").upsert(fallback, { onConflict: "order_number" })
        }
      } catch (err) {
        console.warn("Could not upsert order to Supabase; retained in local reactive store", err)
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
      void fetch(`/api/orders/${encodeURIComponent(targetOrderNum)}/ticket-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ station, status }),
      }).catch((err) => console.warn("Failed calling ticket-status endpoint", err))
    } catch {}

    if (isSupabaseConfigured()) {
      try {
        const payload: any = station === "bar" ? { bar_status: status } : { kitchen_status: status }
        const updated = this.ordersCache.find((o) => o.id === orderId || o.order_number === orderId)
        if (updated?.status === "completed") {
          payload.status = "completed"
        }
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)
        const query = matchedOrderNumber
          ? createClient().from("pos_orders").update(payload).eq("order_number", matchedOrderNumber)
          : isUuid
            ? createClient().from("pos_orders").update(payload).eq("id", orderId)
            : createClient().from("pos_orders").update(payload).eq("order_number", orderId)
        await query
      } catch (err) {
        console.warn("Could not sync ticket status to cloud; updated locally", err)
      }
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
    this.emitOrders()
    this.broadcast("tables")
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
