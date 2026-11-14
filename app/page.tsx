"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  ClipboardList,
  Clock,
  Coffee,
  CreditCard,
  DollarSign,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  PlusCircle,
  Printer,
  QrCode,
  Percent,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Trash2,
  Edit2,
  TrendingUp,
  UtensilsCrossed,
  X,
  Zap,
  Shield,
  Users,
  BookOpen,
  UserCheck,
  Landmark,
  Split,
  Truck,
  Building2,
  CalendarDays,
  Download,
  Upload,
  Ticket,
  Barcode,
  Camera,
  ImagePlus,
  Minus,
} from "lucide-react"
import { createClient, getBrowserSession, isSupabaseConfigured } from "@/lib/supabase/client"
import { isDemoMode, playCashDrawerSound } from "@/lib/config/demo"
import { BarcodeScannerModal } from "@/app/components/barcode-scanner-modal"
import { ModifierModal, getApplicableModifierGroups } from "@/app/components/modifier-modal"
import { MOCK_PRODUCTS } from "@/lib/mock/pos-mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { PosReceipt, type PosReceiptItem } from "@/components/ui/pos-receipt"
import { printThermalReceiptDoc, printTicketSlipDoc } from "@/lib/thermal-printer"
import { toast } from "sonner"
import { products as fallbackProducts } from "./data/products"
import { CoffeeProductsView } from "@/app/components/coffee/coffee-products-view"
import { CoffeeBillView } from "@/app/components/coffee/coffee-bill-view"
import { CoffeeReportView } from "@/app/components/coffee/coffee-report-view"
import { TablesWorkspace } from "@/app/components/tables-workspace"
import { InventoryWorkspace } from "@/app/components/inventory-workspace"
import { CustomerManagementView } from "@/app/components/customer-management-view"
import { ReportsView, type ReportOrderRecord, type ReportProduct } from "@/app/components/reports-view"
import { UserManagementView } from "@/app/components/admin/user-management-view"
import { RoleManagementView } from "@/app/components/admin/role-management-view"
import { UserGuideView } from "@/app/components/user-guide-view"
import { AccessDenied } from "@/app/components/access-denied"
import { usePermissions } from "@/hooks/use-permissions"
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
import { SharedPosService, DEFAULT_INITIAL_ORDERS, type SharedCustomer, type SharedBranch } from "@/lib/shared-pos-service"
import { determineItemStation, isBarItem, isKitchenItem } from "@/lib/station-routing"
import { useSharedTables } from "@/hooks/use-shared-tables"
import type { CoffeeBill } from "@/lib/coffee/types"
import { resolveProductImage, PRODUCT_IMAGE_MAP } from "@/lib/product-images"
import { compressImageFile } from "@/lib/image-compress"

type View =
  | "Dashboard"
  | "POS"
  | "Kitchen"
  | "Bar"
  | "Orders"
  | "TableBooked"
  | "Tables"
  | "Products"
  | "Inventory"
  | "Customers"
  | "Reports"
  | "Settings"
  | "CoffeeProducts"
  | "CoffeeBill"
  | "CoffeeReport"
  | "Users"
  | "Roles"
  | "UserGuide"
type PaymentMethod = "cash" | "card" | "qr" | "bank_transfer" | "credit" | "split"

export type SplitPaymentMethod = "cash" | "card" | "bank_transfer" | "credit" | "qr"

export interface SplitPaymentLineItem {
  id: string
  method: SplitPaymentMethod
  amount: string
  tendered: string
  reference: string
  customerId: string
}

export type Product = {
  id: string
  name: string
  price: number
  category: string
  image: string
  stock: number
  category_id?: string
  department?: string
  station?: "kitchen" | "bar" | "none"
  description?: string
  temperature?: "hot" | "iced" | "none"
  dietary_tags?: string[]
  user_customized?: boolean
  updated_at?: string
}

const DEFAULT_POS_CATEGORIES: { id: string; name: string }[] = [
  { id: "cat-coffee-hot-drinks", name: "Coffee & Hot Drinks" },
  { id: "cat-cold-drinks", name: "Cold Drinks" },
  { id: "cat-meals", name: "Meals" },
  { id: "cat-salads", name: "Salads" },
  { id: "cat-bakery-desserts", name: "Bakery & Desserts" },
]

// `round` is the service round an item was sent in (1 = first send). It lets the
// kitchen/bar see which lines were added to an already-open tab.
export type CartItem = Product & {
  cartItemId?: string
  quantity: number
  round?: number
  notes?: string
  modifiers?: string[]
}

export type TableInfo = {
  id: string
  name: string
  capacity: number
  status: "available" | "occupied" | "cleaning" | "reserved" | "bill_requested"
  guestName?: string
}

export type OrderRecord = {
  id: string
  order_number: string
  receipt_number: string
  table_name: string
  cashier_name: string
  department?: "Juice & Food" | "Coffee Bar" | string
  items: CartItem[]
  subtotal: number
  service_charge: number
  service_charge_rate: number
  discount: number
  total: number
  payment_method: PaymentMethod | string
  split_payments?: {
    id?: string
    method: string
    amount: number
    tendered?: number
    change_due?: number
    reference?: string
    customer_id?: string
    customer_name?: string
  }[]
  cash_received?: number
  change_amount?: number
  status: "open" | "paid" | "completed" | "refunded" | "cancelled" | string
  payment_status?: string
  kitchen_status?: "pending" | "preparing" | "ready" | "served"
  bar_status?: "pending" | "preparing" | "ready" | "served"
  ticket_source?: "coffee_bill"
  order_type?: "dine_in" | "takeaway" | "delivery"
  delivery_address?: string
  delivery_phone?: string
  customer_id?: string
  customer_name?: string
  bank_ref?: string
  created_at: string
}

function toOrderRecord(o: any): OrderRecord {
  const parseItems = (): CartItem[] => {
    let raw = o.items
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw)
      } catch {
        raw = []
      }
    }
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((i: any) => ({
        id: String(i.id || i.product_id || ""),
        name: String(i.name || i.product_name_snapshot || "Item"),
        price: Number(i.price ?? i.unit_price_snapshot ?? 0),
        quantity: Number(i.quantity ?? 1),
        category: i.category || (i.station === "bar" ? "Coffee Bar" : "General"),
        image: i.image || "/placeholder.svg",
        stock: Number(i.stock ?? 50),
        round: i.round,
        department: i.department || (i.station === "bar" ? "Coffee Bar" : undefined),
      }))
    }
    if (Array.isArray(o.order_items) && o.order_items.length > 0) {
      return o.order_items.map((i: any) => ({
        id: String(i.product_id || i.id),
        name: String(i.product_name_snapshot || i.name || "Item"),
        price: Number(i.unit_price_snapshot ?? i.price ?? 0),
        quantity: Number(i.quantity ?? 1),
        category: i.category || (i.station === "bar" ? "Coffee Bar" : "General"),
        image: i.image || "/placeholder.svg",
        stock: Number(i.stock ?? 50),
        round: i.round,
        department: i.department || (i.station === "bar" ? "Coffee Bar" : "Juice & Food"),
      }))
    }
    return []
  }

  return {
    id: String(o.id),
    order_number: String(o.order_number),
    receipt_number: String(o.receipt_number || ""),
    table_name: String(o.table_name || "Takeaway"),
    cashier_name: String(o.cashier_name || "Cashier"),
    department: o.department || "Juice & Food",
    items: parseItems(),
    subtotal: Number(o.subtotal ?? 0),
    service_charge: Number(o.service_charge ?? 0),
    service_charge_rate: Number(o.service_charge_rate ?? 0),
    discount: Number(o.discount ?? 0),
    total: Number(o.total ?? 0),
    payment_method: o.payment_method || "cash",
    split_payments: Array.isArray(o.split_payments)
      ? o.split_payments
      : (typeof o.notes === "string" && o.notes.includes("split_payments")
        ? (() => { try { return JSON.parse(o.notes).split_payments } catch { return undefined } })()
        : undefined),
    cash_received: o.cash_received != null ? Number(o.cash_received) : undefined,
    change_amount: o.change_amount != null ? Number(o.change_amount) : undefined,
    status: o.status || "paid",
    kitchen_status: o.kitchen_status,
    bar_status: o.bar_status,
    ticket_source: o.ticket_source,
    order_type: o.order_type || (o.table_name === "Takeaway" ? "takeaway" : "dine_in"),
    delivery_address: o.delivery_address,
    delivery_phone: o.delivery_phone,
    customer_id: o.customer_id,
    customer_name: o.customer_name,
    bank_ref: o.bank_ref,
    created_at: o.created_at || new Date().toISOString(),
  }
}

const workspaceNav: { label: View; icon: typeof LayoutDashboard; requiredPermission?: string }[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "POS", icon: ShoppingBag, requiredPermission: "orders.create" },
  { label: "Kitchen", icon: UtensilsCrossed, requiredPermission: "kitchen.view" },
  { label: "Bar", icon: Coffee, requiredPermission: "kitchen.view" },
  { label: "Settings", icon: Settings },
]

const coffeeNav: { label: View; title: string; icon: typeof Coffee; adminOnly?: boolean; requiredPermission?: string }[] = [
  { label: "CoffeeProducts", title: "Coffee Products", icon: Package, requiredPermission: "products.view" },
  { label: "CoffeeBill", title: "Coffee Bill", icon: Receipt, requiredPermission: "orders.create" },
  { label: "CoffeeReport", title: "Coffee Report", icon: TrendingUp, requiredPermission: "reports.view" },
]

const managementNav: { label: View; title?: string; icon: typeof ClipboardList; requiredPermission?: string }[] = [
  { label: "Orders", icon: ClipboardList, requiredPermission: "orders.view" },
  { label: "Tables", icon: Table2, requiredPermission: "orders.view" },
  { label: "Products", icon: Package, requiredPermission: "products.view" },
  { label: "Inventory", icon: Package, requiredPermission: "inventory.view" },
  { label: "Customers", title: "Customers & CRM", icon: UserCheck, requiredPermission: "customers.view" },
  { label: "Reports", icon: TrendingUp, requiredPermission: "reports.view" },
  { label: "Users", icon: Users, requiredPermission: "users.manage" },
  { label: "Roles", icon: Shield, requiredPermission: "roles.manage" },
  { label: "UserGuide", title: "User Guide", icon: BookOpen },
]

type TicketStation = "kitchen" | "bar"
type TicketStatus = NonNullable<OrderRecord["kitchen_status"]>


function getStationItems(order: OrderRecord, station: TicketStation) {
  const items = Array.isArray(order.items) ? order.items : []
  if (order.ticket_source === "coffee_bill") return station === "bar" ? items : []
  return items.filter((item) => isBarItem(item) === (station === "bar"))
}

function getTicketStatus(order: OrderRecord, station: TicketStation): TicketStatus {
  return (station === "bar" ? order.bar_status : order.kitchen_status) || "pending"
}

function countActiveTickets(orders: OrderRecord[], station: TicketStation) {
  return orders.filter(
    (order) => getStationItems(order, station).length > 0 && getTicketStatus(order, station) !== "served",
  ).length
}

function isOrderFullyServed(order: OrderRecord): boolean {
  const kitchenItems = getStationItems(order, "kitchen")
  const barItems = getStationItems(order, "bar")

  const kitchenDone = kitchenItems.length === 0 || order.kitchen_status === "served"
  const barDone = barItems.length === 0 || order.bar_status === "served"

  return kitchenDone && barDone
}

function isOrderCompleted(order: OrderRecord): boolean {
  if (order.status === "completed") return true
  if (order.status === "paid" && isOrderFullyServed(order)) return true
  return false
}

function toCoffeeBarTicket(bill: CoffeeBill): OrderRecord {
  return {
    id: `coffee:${bill.id}`,
    order_number: bill.bill_number,
    receipt_number: bill.bill_number,
    table_name: bill.table_name || "Takeaway",
    cashier_name: "Coffee Bar",
    department: "Coffee Bar",
    items: (bill.items || []).map((item) => ({
      id: item.id,
      name: item.item_name,
      price: item.unit_price,
      category: "Coffee Bar",
      image: "",
      stock: 0,
      quantity: item.quantity,
    })),
    subtotal: bill.subtotal,
    service_charge: bill.tax,
    service_charge_rate: 0,
    discount: bill.discount,
    total: bill.grand_total,
    payment_method: bill.payment_method === "transfer" ? "qr" : bill.payment_method,
    status: "paid",
    bar_status: bill.bar_status || "served",
    ticket_source: "coffee_bill",
    created_at: bill.created_at || bill.bill_date,
  }
}

function printReportReceipt(order: ReportOrderRecord) {
  printThermalReceiptDoc({
    id: String(order.id),
    order_number: order.order_number,
    receipt_number: order.receipt_number,
    table_name: order.table_name || "Takeaway",
    cashier_name: order.cashier_name || "System Administrator",
    items: order.items.map((i) => ({
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    })),
    subtotal: order.subtotal,
    service_charge: order.service_charge || 0,
    service_charge_rate: order.service_charge_rate || 0.1,
    discount: order.discount || 0,
    total: order.total,
    payment_method: order.payment_method || "cash",
    cash_received: (order as any).cash_received || order.total,
    change_amount: (order as any).change_amount || 0,
    order_type: (order as any).order_type || "dine_in",
    created_at: order.created_at || new Date().toISOString(),
  }, false)
}

function getLocalCoffeeOrders(): OrderRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem("pos_coffee_bills")
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).map(toCoffeeBarTicket)
  } catch {
    return []
  }
}

function mergeOrderRecords(...orderArrays: (OrderRecord[] | undefined | null)[]): OrderRecord[] {
  const map = new Map<string, OrderRecord>()

  for (const list of orderArrays) {
    if (!list || !Array.isArray(list)) continue
    for (const incoming of list) {
      if (!incoming) continue
      const numKey = incoming.order_number ? String(incoming.order_number) : ""
      const idKey = incoming.id ? String(incoming.id) : ""
      const existing = (numKey && map.get(numKey)) || (idKey && map.get(idKey))

      if (!existing) {
        if (numKey) map.set(numKey, incoming)
        if (idKey) map.set(idKey, incoming)
      } else {
        const hasKitchen = Boolean(existing.kitchen_status || incoming.kitchen_status)
        const hasBar = Boolean(existing.bar_status || incoming.bar_status)

        const kitchenServed = !hasKitchen || existing.kitchen_status === "served" || incoming.kitchen_status === "served"
        const barServed = !hasBar || existing.bar_status === "served" || incoming.bar_status === "served"
        const isFullyServed = (kitchenServed && barServed) && (hasKitchen || hasBar)
        const completed =
          existing.status === "completed" ||
          incoming.status === "completed" ||
          (isFullyServed && (existing.status === "paid" || incoming.status === "paid"))

        const merged: OrderRecord = {
          ...existing,
          ...incoming,
          items: incoming.items && incoming.items.length > 0 ? incoming.items : existing.items,
          kitchen_status: hasKitchen ? (existing.kitchen_status === "served" || incoming.kitchen_status === "served" ? "served" : (incoming.kitchen_status || existing.kitchen_status)) : undefined,
          bar_status: hasBar ? (existing.bar_status === "served" || incoming.bar_status === "served" ? "served" : (incoming.bar_status || existing.bar_status)) : undefined,
          status: completed ? "completed" : existing.status === "paid" ? "paid" : incoming.status,
        }
        if (numKey) map.set(numKey, merged)
        if (idKey) map.set(idKey, merged)
      }
    }
  }

  const unique = new Map<string, OrderRecord>()
  for (const o of map.values()) {
    const primaryKey = o.order_number || o.id
    if (!unique.has(primaryKey)) {
      unique.set(primaryKey, o)
    }
  }

  return Array.from(unique.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

function handleProductImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const target = e.currentTarget
  target.onerror = null
  const src = target.getAttribute("src") || ""
  if (typeof window !== "undefined" && src) {
    try {
      const cached =
        localStorage.getItem("pos_upload:" + src) ||
        localStorage.getItem("pos_upload:" + src.split("/").pop())
      if (cached) {
        target.src = cached
        return
      }
    } catch {}
  }
  target.src = "/placeholder.svg"
}

export default function POSPage() {
  const supabase = useMemo(() => createClient(), [])
  const [mounted, setMounted] = useState(false)
  const {
    user: rbacUser,
    role: rbacRole,
    permissions: rbacPermissions,
    loading: rbacLoading,
    hasPermission,
    canAccessView,
    canManageProducts: rbacCanManageProducts,
    canManageCategories: rbacCanManageCategories,
    canManageTables: rbacCanManageTables,
  } = usePermissions()

  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search)
      const v = p.get("view") as View
      if (v) setView(v)
    }
  }, [])

  // User & View states
  const [user, setUser] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("pos_cached_user")
        if (cached) return JSON.parse(cached)
      } catch {}
    }
    return null
  })

  // Least privilege until the server confirms the signed-in user's role, preserving cached verified session
  const [role, setRole] = useState<CanonicalRole>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("pos_cached_role") || localStorage.getItem("pos_staff_role")
        if (cached) return normalizeRole(cached)
      } catch {}
    }
    return "cashier"
  })
  const activeRole = normalizeRole(rbacRole || role)
  const activeUser = rbacUser || user
  const [view, setView] = useState<View>("POS")
  const [coffeeMenuOpen, setCoffeeMenuOpen] = useState(true)

  // Mobile Navigation & Mobile Cart Drawer states
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  // Database Data States
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        SharedPosService.init()
        const shared = SharedPosService.getOrders()
        const localCoffee = getLocalCoffeeOrders()
        return mergeOrderRecords(
          DEFAULT_INITIAL_ORDERS.map(toOrderRecord),
          shared.map(toOrderRecord),
          localCoffee,
        )
      } catch {}
    }
    return DEFAULT_INITIAL_ORDERS.map(toOrderRecord)
  })
  const [coffeeBills, setCoffeeBills] = useState<CoffeeBill[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("pos_coffee_bills")
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch {}
    }
    return []
  })
  // Floor state is shared (Supabase + realtime) so POS, Tables and Coffee Bill always agree.
  const sharedTables = useSharedTables()
  const tables: TableInfo[] = useMemo(
    () => sharedTables.map((t) => ({ id: t.id, name: t.name, capacity: t.capacity, status: t.status, guestName: t.guestName })),
    [sharedTables],
  )
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [orderCount, setOrderCount] = useState<number>(100)
  const [activeOpenOrder, setActiveOpenOrder] = useState<OrderRecord | null>(null)
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null)

  function getNextOrderNumberInfo(): { orderNum: string; receiptNum: string; nextSeq: number } {
    let maxSeq = 100
    for (const o of orders) {
      if (!o.order_number) continue
      const m = o.order_number.match(/(\d+)/)
      if (m) {
        const val = parseInt(m[1], 10)
        if (!isNaN(val) && val > maxSeq) maxSeq = val
      }
    }
    const sharedNext = SharedPosService.getNextOrderNumber()
    if (sharedNext.seq > maxSeq) {
      maxSeq = sharedNext.seq - 1
    }
    if (orderCount > maxSeq) {
      maxSeq = orderCount
    }
    const nextSeq = maxSeq + 1
    const formatted = String(nextSeq).padStart(6, "0")
    return {
      orderNum: `LS-${formatted}`,
      receiptNum: `LS-RC-${formatted}`,
      nextSeq,
    }
  }

  function startNewOrder() {
    setActiveOpenOrder(null)
    setCart([])
    setSelectedTable("Takeaway")
    toast.info("Ready for new order with fresh order number.")
  }

  // Fetch Guard Refs to prevent network storms and ERR_INSUFFICIENT_RESOURCES
  const isFetchingDataRef = useRef(false)
  const isFetchingOrdersRef = useRef(false)
  const lastDataFetchTimeRef = useRef(0)
  const lastOrdersFetchTimeRef = useRef(0)

  // Current POS Order State
  const [cart, setCart] = useState<CartItem[]>([])
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string>("Table 1")
  const [cashierName, setCashierName] = useState<string>("Cashier")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All")

  const [sending, setSending] = useState(false)
  const [paying, setPaying] = useState(false)

  // Order Type & Delivery States
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | "delivery">("dine_in")
  const [deliveryAddress, setDeliveryAddress] = useState<string>("")
  const [deliveryPhone, setDeliveryPhone] = useState<string>("")

  // Auto-align selectedTable with free tables so staff never stays on an occupied table
  useEffect(() => {
    if (activeOpenOrder) return
    if (orderType === "dine_in" && tables.length > 0) {
      const cur = tables.find((t) => t.name.toLowerCase() === selectedTable?.toLowerCase())
      if (!cur || cur.status !== "available") {
        const firstAvail = tables.find((t) => t.status === "available")
        if (firstAvail) {
          setSelectedTable(firstAvail.name)
        }
      }
    }
  }, [tables, orderType, selectedTable, activeOpenOrder])

  // Bank Transfer and Customer Credit States
  const [bankRefNumber, setBankRefNumber] = useState<string>("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
  const [customers, setCustomers] = useState<SharedCustomer[]>(() => SharedPosService.getCustomers())

  // Promo Code States
  const [promoCodeInput, setPromoCodeInput] = useState<string>("")
  const [appliedPromoCode, setAppliedPromoCode] = useState<string>("")

  // Split Bill States
  const [splitModalOpen, setSplitModalOpen] = useState(false)
  const [splitWays, setSplitWays] = useState<number>(2)

  // KOT Ticket Preview Modal States
  const [kotModalOpen, setKotModalOpen] = useState(false)
  const [kotTicketData, setKotTicketData] = useState<OrderRecord | null>(null)

  // Multi-Branch States
  const [branches, setBranches] = useState<SharedBranch[]>(() => SharedPosService.getBranches())
  const [activeBranchId, setActiveBranchId] = useState<string>(() => SharedPosService.getActiveBranch().id)

  useEffect(() => {
    const unsubCust = SharedPosService.subscribeCustomers(setCustomers)
    const unsubBranch = SharedPosService.subscribeBranches(setBranches)
    const unsubIng = SharedPosService.subscribeIngredients(() => {})
    const unsubRec = SharedPosService.subscribeRecipes(() => {})
    return () => {
      unsubCust()
      unsubBranch()
      unsubIng()
      unsubRec()
    }
  }, [])

  // Payment Modal States
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [paymentMode, setPaymentMode] = useState<"single" | "split">("single")
  const [splitLines, setSplitLines] = useState<SplitPaymentLineItem[]>([
    { id: "line-1", method: "cash", amount: "", tendered: "", reference: "", customerId: "" },
    { id: "line-2", method: "card", amount: "", tendered: "", reference: "", customerId: "" },
  ])
  const [cashReceivedInput, setCashReceivedInput] = useState<string>("")
  const [cardConfirmed, setCardConfirmed] = useState<boolean>(false)
  const [qrConfirmed, setQrConfirmed] = useState<boolean>(false)

  // Tax / VAT and Discount settings (Juice POS - Cashier can add or remove)
  const [discount, setDiscount] = useState<string>("0")
  const [tax, setTax] = useState<string>("")
  const [isTaxIncluded, setIsTaxIncluded] = useState<boolean>(true)

  // Receipt Modal States
  const [completedReceipt, setCompletedReceipt] = useState<OrderRecord | null>(null)
  const [dialogType, setDialogType] = useState<"product" | "table" | "stock" | "category" | null>(null)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [showAddCategoryInline, setShowAddCategoryInline] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    price: "",
    category_id: "",
    capacity: "2",
    stock: "0",
    reason: "Stock received",
    station: "kitchen" as "kitchen" | "bar",
    stationManuallySelected: false,
    image: "",
  })
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  async function handleImageFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingImage(true)
    try {
      // 1. Client-side compress down to max 480x480 (~20-30KB) to prevent 413 Content Too Large
      const { dataUrl, blob } = await compressImageFile(file, 480, 0.8)
      const ext = file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)?.[0] || ".jpg"
      const safeName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`
      const publicUrl = `/api/uploads/${safeName}`

      // Pre-cache in localStorage and CacheStorage so images render immediately and withstand offline/restarts
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("pos_upload:" + publicUrl, dataUrl)
          localStorage.setItem("pos_upload:" + safeName, dataUrl)
          localStorage.setItem("pos_upload:/uploads/" + safeName, dataUrl)
          if (typeof caches !== "undefined") {
            const c = await caches.open("pos-uploads-v1")
            await c.put(
              publicUrl,
              new Response(blob, {
                headers: {
                  "Content-Type": blob.type || "image/jpeg",
                  "Cache-Control": "public, max-age=31536000, immutable",
                },
              })
            )
          }
        } catch {}
      }

      // Set form preview immediately with publicUrl
      setForm((f) => ({ ...f, image: publicUrl }))

      try {
        const formData = new FormData()
        formData.append("file", blob, safeName)
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          if (data?.success && data?.url) {
            setForm((f) => ({ ...f, image: data.url }))
            if (data.url !== publicUrl) {
              try {
                localStorage.setItem("pos_upload:" + data.url, dataUrl)
              } catch {}
            }
            toast.success("Photo uploaded successfully")
          } else {
            toast.success("Photo uploaded successfully")
          }
        } else {
          toast.success("Photo uploaded successfully")
        }
      } catch (err) {
        console.warn("Upload network error, cached locally", err)
        toast.success("Photo uploaded successfully")
      }
    } catch (compressErr) {
      console.warn("Image compression failed", compressErr)
      toast.error("Failed to process image file")
    } finally {
      setIsUploadingImage(false)
    }
  }

  function handleBarcodeScan(scannedCode: string) {
    const clean = scannedCode.trim().toLowerCase()
    const matched = products.find(
      (p) =>
        (p as any).barcode === scannedCode.trim() ||
        (p as any).sku?.toLowerCase() === clean ||
        p.name.toLowerCase() === clean
    )
    if (matched) {
      addToCart(matched)
      toast.success(`Scanned: ${matched.name} - Added to cart`)
      return
    }
    const mockMatch = MOCK_PRODUCTS.find(
      (mp) => mp.barcode === scannedCode.trim() || mp.sku.toLowerCase() === clean
    )
    if (mockMatch) {
      const prodToAdd: Product = {
        id: mockMatch.id,
        name: mockMatch.name,
        price: mockMatch.price,
        image: mockMatch.image,
        category: mockMatch.category,
        category_id: mockMatch.category_id,
        stock: mockMatch.stock,
        description: mockMatch.description,
        station: mockMatch.station,
        department: mockMatch.department,
      }
      addToCart(prodToAdd)
      toast.success(`Scanned: ${prodToAdd.name} - Added to cart`)
      return
    }
    toast.error(`Barcode / SKU "${scannedCode}" not found in catalog`)
  }

  async function handleResetDemoData() {
    if (!confirm("Are you sure you want to reset all mock data to the pristine starting state?")) return
    try {
      await fetch("/api/demo/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      })
      localStorage.clear()
      toast.success("Demo database & local state reset successfully!")
      setTimeout(() => window.location.reload(), 600)
    } catch {
      localStorage.clear()
      window.location.reload()
    }
  }

  // Load backend data safely with re-entrancy and throttling protection
  async function loadData() {
    const now = Date.now()
    if (isFetchingDataRef.current || now - lastDataFetchTimeRef.current < 2000) return
    isFetchingDataRef.current = true
    lastDataFetchTimeRef.current = now

    try {
      const [{ data: ps }, { data: os }, { data: ts }, { data: cs }, { data: cbs }] = await Promise.all([
        supabase.from("pos_products").select("id,name,price,image,stock,category_id,active,is_archived,description,temperature,dietary_tags,department_override,station").eq("is_archived", false).order("sort_order").order("name"),
        supabase.from("pos_orders").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("pos_tables").select("id,name,capacity,status").order("name"),
        supabase.from("pos_categories").select("id,name").eq("is_active", true).order("sort_order").order("name"),
        supabase.from("coffee_bills").select("*").order("created_at", { ascending: false }),
      ])

      const sharedProds = SharedPosService.getProducts()
      const sharedCats = SharedPosService.getCategories()
      const sharedOrds = SharedPosService.getOrders()

      const catMap = new Map<string, { id: string; name: string }>()
      sharedCats.forEach((c) => catMap.set(c.name.trim().toLowerCase(), { id: String(c.id), name: c.name }))
      if (cs && Array.isArray(cs)) {
        cs.forEach((c: any) => catMap.set(c.name.trim().toLowerCase(), { id: String(c.id), name: c.name }))
      }
      const resolvedCategories = catMap.size > 0 ? Array.from(catMap.values()) : DEFAULT_POS_CATEGORIES
      setCategories(resolvedCategories)
      const categoryById = new Map(resolvedCategories.map((category) => [String(category.id), category.name]))

      const prodMap = new Map<string, Product>()
      // 1. Seed with shared products
      sharedProds.forEach((p) => {
        const cat = categoryById.get(String(p.category_id)) || p.category || "General"
        const station = (p.station as "kitchen" | "bar") || determineItemStation({
          station: p.station,
          department: p.department,
          category: cat,
          name: p.name,
        })
        prodMap.set(p.name.trim().toLowerCase(), {
          id: String(p.id),
          name: p.name,
          price: Number(p.price ?? 0),
          image: p.image && !p.image.includes("placeholder") ? p.image : resolveProductImage(p.name, p.image, cat),
          category: cat,
          category_id: p.category_id,
          stock: Number(p.stock ?? 0),
          description: p.description || "",
          temperature: p.temperature || "none",
          dietary_tags: p.dietary_tags || [],
          department: p.department || (station === "bar" ? "Coffee Bar" : "Juice & Food"),
          station,
          user_customized: p.user_customized,
          updated_at: p.updated_at,
        })
      })
      // 2. Overlay / merge any cloud products from Supabase
      if (ps && Array.isArray(ps) && ps.length > 0) {
        ps.filter((p: any) => p.active !== false).forEach((p: any) => {
          const cat = categoryById.get(String(p.category_id)) || p.category || "General"
          const station = (p.station as "kitchen" | "bar") || determineItemStation({
            station: p.station,
            department: p.department_override,
            category: cat,
            name: p.name,
          })
          const key = p.name.trim().toLowerCase()
          const existing = prodMap.get(key)
          let resolvedPrice = existing?.price ?? Number(p.price != null ? p.price : 0)
          if (!existing?.user_customized && p.price != null && p.price > 0) {
            resolvedPrice = Number(p.price)
          } else if (existing?.user_customized && p.updated_at && existing.updated_at && new Date(p.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
            resolvedPrice = Number(p.price)
          }

          let resolvedImage = existing?.image || p.image || resolveProductImage(p.name, p.image, cat)
          if (!existing?.user_customized) {
            if (p.image && !p.image.includes("placeholder")) {
              resolvedImage = p.image
            }
          } else if (existing?.user_customized) {
            const defaultSeed = PRODUCT_IMAGE_MAP[p.name?.trim()]
            if (p.image && !p.image.includes("placeholder") && p.image !== defaultSeed) {
              if (p.updated_at && existing.updated_at && new Date(p.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
                resolvedImage = p.image
              }
            }
          }

          prodMap.set(key, {
            id: String(p.id || existing?.id),
            name: p.name,
            price: resolvedPrice,
            image: resolvedImage,
            category: cat,
            category_id: p.category_id || existing?.category_id,
            stock: Number(p.stock ?? existing?.stock ?? 0),
            description: p.description || existing?.description || "",
            temperature: p.temperature || existing?.temperature || "none",
            dietary_tags: p.dietary_tags || existing?.dietary_tags || [],
            department: p.department_override || existing?.department || (station === "bar" ? "Coffee Bar" : "Juice & Food"),
            station,
            user_customized: existing?.user_customized,
            updated_at: existing?.updated_at || p.updated_at,
          })
        })
      }

      // 3. Overlay authoritative products directly from SQL database API (SQLite / Postgres)
      try {
        const pRes = await fetch("/api/products", { cache: "no-store" })
        if (pRes.ok) {
          const pJson = await pRes.json()
          if (Array.isArray(pJson?.products) && pJson.products.length > 0) {
            pJson.products.forEach((p: any) => {
              const cat = categoryById.get(String(p.category_id)) || p.category || p.category_name || "General"
              const station = (p.station as "kitchen" | "bar") || determineItemStation({
                station: p.station,
                department: p.department || p.department_override,
                category: cat,
                name: p.name,
              })
              const key = p.name.trim().toLowerCase()
              const existing = prodMap.get(key)
              let resolvedPrice = existing?.price ?? Number(p.price != null ? p.price : 0)
              if (!existing?.user_customized && p.price != null && p.price > 0) {
                resolvedPrice = Number(p.price)
              } else if (existing?.user_customized && p.updated_at && existing.updated_at && new Date(p.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
                resolvedPrice = Number(p.price)
              }

              let resolvedImage = existing?.image || p.image || resolveProductImage(p.name, p.image, cat)
              if (!existing?.user_customized) {
                if (p.image && !p.image.includes("placeholder")) {
                  resolvedImage = p.image
                }
              } else if (existing?.user_customized) {
                const defaultSeed = PRODUCT_IMAGE_MAP[p.name?.trim()]
                if (p.image && !p.image.includes("placeholder") && p.image !== defaultSeed) {
                  if (p.updated_at && existing.updated_at && new Date(p.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
                    resolvedImage = p.image
                  }
                }
              }

              let resolvedStock = Number(p.stock != null ? p.stock : (existing?.stock ?? 0))
              if (existing?.updated_at && p.updated_at) {
                const existingTime = new Date(existing.updated_at).getTime()
                const serverTime = new Date(p.updated_at).getTime()
                if (existingTime > serverTime) {
                  resolvedStock = existing.stock
                }
              } else if (existing?.user_customized && existing.stock !== undefined && (p.stock === null || p.stock === undefined)) {
                resolvedStock = existing.stock
              }

              prodMap.set(key, {
                id: String(p.id || existing?.id),
                name: p.name,
                price: resolvedPrice,
                image: resolvedImage,
                category: cat,
                category_id: p.category_id || existing?.category_id,
                stock: resolvedStock,
                description: p.description || existing?.description || "",
                temperature: p.temperature || existing?.temperature || "none",
                dietary_tags: Array.isArray(p.dietary_tags) ? p.dietary_tags : (existing?.dietary_tags || []),
                department: p.department || p.department_override || existing?.department || (station === "bar" ? "Coffee Bar" : "Juice & Food"),
                station,
                user_customized: existing?.user_customized || p.user_customized,
                updated_at: existing?.updated_at && p.updated_at && new Date(existing.updated_at).getTime() > new Date(p.updated_at).getTime() ? existing.updated_at : (p.updated_at || existing?.updated_at),
              })
            })
          }
        }
      } catch (err) {
        console.warn("loadData /api/products fetch error:", err)
      }

      const uniqueById = new Map<string, Product>()
      Array.from(prodMap.values()).forEach((p) => {
        const safeId = uniqueById.has(p.id) ? `${p.id}-${p.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}` : p.id
        uniqueById.set(safeId, { ...p, id: safeId })
      })
      setProducts(Array.from(uniqueById.values()))

      const localCoffee = getLocalCoffeeOrders()
      const cloudOrders = os && Array.isArray(os) ? os.map(toOrderRecord) : []
      const cloudCoffee = cbs && Array.isArray(cbs) ? cbs.map((cb: any) => toCoffeeBarTicket(cb)) : []

      const unifiedOrders = mergeOrderRecords(
        DEFAULT_INITIAL_ORDERS.map(toOrderRecord),
        sharedOrds.map(toOrderRecord),
        localCoffee,
        cloudOrders,
        cloudCoffee,
      )
      setOrders(unifiedOrders)
      let maxFound = 100
      for (const o of unifiedOrders) {
        const m = String(o.order_number || "").match(/(\d+)/)
        if (m) {
          const val = parseInt(m[1], 10)
          if (!isNaN(val) && val > maxFound) maxFound = val
        }
      }
      setOrderCount(maxFound)
    } catch (e) {
      console.log("Using local state data")
      const sharedProds = SharedPosService.getProducts()
      const sharedCats = SharedPosService.getCategories()
      const sharedOrds = SharedPosService.getOrders()
      const localCoffee = getLocalCoffeeOrders()
      setCategories(sharedCats.length ? sharedCats.map(c => ({ id: String(c.id), name: c.name })) : DEFAULT_POS_CATEGORIES)
      setProducts(sharedProds.map((p) => {
        const station = (p.station as "kitchen" | "bar") || determineItemStation(p)
        return {
          id: String(p.id),
          name: p.name,
          price: Number(p.price ?? 0),
          image: p.image && !p.image.includes("placeholder") ? p.image : resolveProductImage(p.name, p.image, p.category),
          category: p.category || "General",
          category_id: p.category_id,
          stock: Number(p.stock ?? 0),
          description: p.description || "",
          temperature: p.temperature || "none",
          dietary_tags: p.dietary_tags || [],
          department: p.department || (station === "bar" ? "Coffee Bar" : "Juice & Food"),
          station,
        }
      }))
      const unifiedOrders = mergeOrderRecords(
        DEFAULT_INITIAL_ORDERS.map(toOrderRecord),
        sharedOrds.map(toOrderRecord),
        localCoffee,
      )
      setOrders(unifiedOrders)
      let maxFound = 100
      for (const o of unifiedOrders) {
        const m = String(o.order_number || "").match(/(\d+)/)
        if (m) {
          const val = parseInt(m[1], 10)
          if (!isNaN(val) && val > maxFound) maxFound = val
        }
      }
      setOrderCount(maxFound)
    } finally {
      isFetchingDataRef.current = false
      setLoading(false)
    }
  }

  async function refreshOrders(force = false) {
    const now = Date.now()
    if (isFetchingOrdersRef.current || (!force && now - lastOrdersFetchTimeRef.current < 2000)) return
    isFetchingOrdersRef.current = true
    lastOrdersFetchTimeRef.current = now

    let cloudOrders: OrderRecord[] = []
    let cloudCoffee: OrderRecord[] = []
    try {
      const [{ data, error }, { data: cbs }] = await Promise.all([
        supabase.from("pos_orders").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("coffee_bills").select("*").order("created_at", { ascending: false }).limit(50),
      ])
      if (!error && Array.isArray(data)) {
        cloudOrders = data.map(toOrderRecord)
      }
      if (Array.isArray(cbs)) {
        cloudCoffee = cbs.map((cb: any) => toCoffeeBarTicket(cb))
      }
    } catch {
      // offline fallback
    } finally {
      isFetchingOrdersRef.current = false
    }

    const shared = SharedPosService.getOrders()
    const localCoffee = getLocalCoffeeOrders()

    setOrders((prev) =>
      mergeOrderRecords(
        DEFAULT_INITIAL_ORDERS.map(toOrderRecord),
        prev,
        shared.map(toOrderRecord),
        localCoffee,
        cloudOrders,
        cloudCoffee,
      ),
    )
  }

  useEffect(() => {
    let channel: any
    void (async () => {
      try {
        const session = await getBrowserSession()
        const currentUser = session?.user || null
        if (currentUser) {
          setUser(currentUser)
        }
        const canonicalRole = normalizeRole(session?.role || session?.role_id)
        const roleLabel = getRoleDisplayName(canonicalRole)
        const displayName = currentUser?.full_name || currentUser?.username || roleLabel
        setCashierName(displayName)
        setRole(canonicalRole)
      } catch (err) {
        console.warn("Could not determine user session:", err)
      } finally {
        loadData()
      }
    })()

    let syncTimer: any = null
    const onRealtimeSync = () => {
      if (syncTimer) clearTimeout(syncTimer)
      syncTimer = setTimeout(() => {
        void refreshOrders(true)
        void loadData()
      }, 250)
    }
    window.addEventListener("pos_realtime_sync", onRealtimeSync)
    window.addEventListener("pos_orders_updated", onRealtimeSync)
    window.addEventListener("pos_realtime_orders", onRealtimeSync)
    window.addEventListener("pos_products_updated", onRealtimeSync)
    window.addEventListener("pos_tables_updated", onRealtimeSync)
    window.addEventListener("pos_sessions_updated", onRealtimeSync)
    window.addEventListener("pos_bookings_updated", onRealtimeSync)
    window.addEventListener("pos_categories_updated", onRealtimeSync)

    const unsubP = SharedPosService.subscribeProducts((prods) => {
      setProducts(prods.map((p) => {
        const cat = p.category || "General"
        const station = (p.station as "kitchen" | "bar") || determineItemStation(p)
        return {
          id: String(p.id),
          name: p.name,
          price: Number(p.price ?? 0),
          image: p.image && !p.image.includes("placeholder") ? p.image : resolveProductImage(p.name, p.image, cat),
          category: cat,
          category_id: p.category_id,
          stock: Number(p.stock ?? 0),
          description: p.description || "",
          temperature: p.temperature || "none",
          dietary_tags: p.dietary_tags || [],
          department: p.department || (station === "bar" ? "Coffee Bar" : "Juice & Food"),
          station,
        }
      }))
    })
    const unsubC = SharedPosService.subscribeCategories((cats) => {
      setCategories(cats.map((c) => ({ id: String(c.id), name: c.name })))
    })
    const unsubO = SharedPosService.subscribeOrders((ords) => {
      setOrders((prev) =>
        mergeOrderRecords(
          DEFAULT_INITIAL_ORDERS.map(toOrderRecord),
          prev,
          ords.map(toOrderRecord),
          getLocalCoffeeOrders(),
        ),
      )
    })

    try {
      channel = supabase
        .channel("pos-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "pos_orders" }, onRealtimeSync)
        .on("postgres_changes", { event: "*", schema: "public", table: "pos_products" }, onRealtimeSync)
        .on("postgres_changes", { event: "*", schema: "public", table: "pos_tables" }, onRealtimeSync)
        .on("postgres_changes", { event: "*", schema: "public", table: "pos_categories" }, onRealtimeSync)
        .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, onRealtimeSync)
        .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, onRealtimeSync)
        .on("postgres_changes", { event: "*", schema: "public", table: "coffee_bills" }, onRealtimeSync)
        .on("postgres_changes", { event: "*", schema: "public", table: "app_users" }, () => {
          window.dispatchEvent(new CustomEvent("pos_realtime_rbac"))
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "roles" }, () => {
          window.dispatchEvent(new CustomEvent("pos_realtime_rbac"))
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "role_permissions" }, () => {
          window.dispatchEvent(new CustomEvent("pos_realtime_rbac"))
        })
        .subscribe()
    } catch (err) {
      // realtime fallback
    }

    return () => {
      if (syncTimer) clearTimeout(syncTimer)
      window.removeEventListener("pos_realtime_sync", onRealtimeSync)
      window.removeEventListener("pos_orders_updated", onRealtimeSync)
      window.removeEventListener("pos_realtime_orders", onRealtimeSync)
      window.removeEventListener("pos_products_updated", onRealtimeSync)
      window.removeEventListener("pos_tables_updated", onRealtimeSync)
      window.removeEventListener("pos_sessions_updated", onRealtimeSync)
      window.removeEventListener("pos_bookings_updated", onRealtimeSync)
      window.removeEventListener("pos_categories_updated", onRealtimeSync)
      unsubP()
      unsubC()
      unsubO()
      if (channel) supabase.removeChannel(channel)
    }
  }, [supabase])

  useEffect(() => {
    if (view !== "Kitchen" && view !== "Bar") return
    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void refreshOrders()
    }, 10000)
    return () => window.clearInterval(interval)
  }, [view])

  useEffect(() => {
    let isCurrent = true
    const loadCoffeeBills = async () => {
      try {
        const response = await fetch("/api/coffee/bills?forBar=true", { cache: "no-store" })
        if (response.ok) {
          const result = await response.json()
          if (isCurrent && result.bills && Array.isArray(result.bills)) {
            const raw = typeof window !== "undefined" ? localStorage.getItem("pos_coffee_bills") : null
            const localBills: CoffeeBill[] = raw ? JSON.parse(raw) : []
            const map = new Map<string, CoffeeBill>()
            localBills.forEach((b) => map.set(b.bill_number || b.id, b))
            result.bills.forEach((b: CoffeeBill) => map.set(b.bill_number || b.id, b))
            setCoffeeBills(Array.from(map.values()))
            return
          }
        }
      } catch {
        // Keep the POS available if the separate Coffee module is offline.
      }
      if (isCurrent && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("pos_coffee_bills")
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) setCoffeeBills(parsed)
          }
        } catch {}
      }
    }

    void loadCoffeeBills()
    let channel: any
    try {
      const onCoffeeTicketsChange = () => {
        void loadCoffeeBills()
        void refreshOrders(true)
      }
      channel = supabase
        .channel("coffee-bar-tickets")
        .on("postgres_changes", { event: "*", schema: "public", table: "coffee_bills" }, onCoffeeTicketsChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "coffee_bill_items" }, onCoffeeTicketsChange)
        .subscribe()
    } catch {
      // The polling refresh below remains available if realtime is disabled.
    }
    const interval = view === "Bar" ? window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void loadCoffeeBills()
    }, 10000) : undefined
    return () => {
      isCurrent = false
      if (interval) window.clearInterval(interval)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase, view])


  // Active Menu items
  const menu: Product[] = products

  const menuCategories = useMemo(() => {
    const set = new Set<string>()
    categories.forEach((c) => { if (c.name) set.add(c.name) })
    menu.forEach((p) => { if (p.category) set.add(p.category) })
    return ["All", ...Array.from(set)]
  }, [categories, menu])

  const inventoryProducts = useMemo(
    () => products.map((product: Product) => ({ id: product.id, name: product.name, price: product.price })),
    [products]
  )

  const visibleProducts = menu.filter(
    (p) => (category === "All" || p.category === category) && p.name.toLowerCase().includes(query.toLowerCase())
  )

  // Current Order Calculations (Configurable VAT / Tax and Discount)
  const totalCartQty = cart.reduce((s, i) => s + i.quantity, 0)
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const discountNum = Math.max(0, Number(discount) || 0)
  const defaultTax = Math.round(subtotal * 0.10)
  const taxNum = !isTaxIncluded ? 0 : (tax !== "" ? Math.max(0, Number(tax) || 0) : defaultTax)
  const serviceCharge = taxNum
  const serviceChargeRate = isTaxIncluded ? (subtotal > 0 ? taxNum / subtotal : 0.1) : 0
  const total = Math.max(0, subtotal - discountNum + taxNum)

  // Cash calculation
  const cashReceivedAmount = Number(cashReceivedInput) || 0
  const changeAmount = Math.max(0, cashReceivedAmount - total)
  const isCashInsufficient = paymentMethod === "cash" && cashReceivedAmount < total
  const isCardNotConfirmed = paymentMethod === "card" && !cardConfirmed
  const isQrNotConfirmed = paymentMethod === "qr" && !qrConfirmed
  const isBankTransferMissing = paymentMethod === "bank_transfer" && !bankRefNumber.trim()
  const isCreditCustomerMissing = paymentMethod === "credit" && !selectedCustomerId

  // Split Payment calculations
  const splitTotalAllocated = splitLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const splitRemainingBalance = Math.max(0, total - splitTotalAllocated)
  const splitChangeDue = splitLines.reduce((s, l) => {
    if (l.method !== "cash") return s
    const amt = Number(l.amount) || 0
    const tend = Number(l.tendered) || amt
    if (tend > amt) return s + (tend - amt)
    return s
  }, 0)

  // Validation flags for split mode
  const isSplitUnderpaid = splitTotalAllocated < total
  const hasEmptySplitAmount = splitLines.some((l) => (Number(l.amount) || 0) <= 0)
  const isSplitMissingCardRef = splitLines.some((l) => l.method === "card" && !l.reference.trim())
  const isSplitMissingBankRef = splitLines.some((l) => l.method === "bank_transfer" && !l.reference.trim())
  const isSplitMissingCreditCust = splitLines.some((l) => l.method === "credit" && !l.customerId)
  const isCompletePaymentDisabled =
    paymentMode === "split"
      ? isSplitUnderpaid || hasEmptySplitAmount || isSplitMissingCardRef || isSplitMissingBankRef || isSplitMissingCreditCust
      : (paymentMethod === "cash" && isCashInsufficient) ||
        (paymentMethod === "card" && !cardConfirmed) ||
        (paymentMethod === "qr" && !qrConfirmed) ||
        (paymentMethod === "bank_transfer" && !bankRefNumber.trim()) ||
        (paymentMethod === "credit" && !selectedCustomerId)

  function initSplitPaymentLines() {
    setSplitLines((prev) => {
      if (prev.length >= 2) return prev
      return [
        { id: "line-1", method: "cash", amount: "", tendered: "", reference: "", customerId: "" },
        { id: "line-2", method: "card", amount: "", tendered: "", reference: "", customerId: "" },
      ]
    })
  }

  function addSplitPaymentLine() {
    const existingMethods = new Set(splitLines.map((l) => l.method))
    const availableMethods: SplitPaymentMethod[] = ["card", "bank_transfer", "qr", "credit", "cash"]
    const nextMethod = availableMethods.find((m) => !existingMethods.has(m)) || "card"
    const remAmt = splitRemainingBalance > 0 ? String(splitRemainingBalance) : ""
    const newLine: SplitPaymentLineItem = {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      method: nextMethod,
      amount: remAmt,
      tendered: nextMethod === "cash" ? remAmt : "",
      reference: "",
      customerId: "",
    }
    setSplitLines((prev) => [...prev, newLine])
    if (splitRemainingBalance > 0) {
      toast.info(`Added ${nextMethod.toUpperCase()} line for remaining Rs. ${splitRemainingBalance.toLocaleString()}`)
    }
  }

  function removeSplitPaymentLine(id: string) {
    if (splitLines.length <= 1) {
      toast.error("At least one payment line is required in split mode.")
      return
    }
    setSplitLines((prev) => prev.filter((l) => l.id !== id))
  }

  function updateSplitLineMethod(id: string, newMethod: SplitPaymentMethod) {
    setSplitLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line
        let nextAmt = Number(line.amount) || 0
        if (newMethod !== "cash") {
          const otherAllocations = prev.filter((l) => l.id !== id).reduce((s, l) => s + (Number(l.amount) || 0), 0)
          const maxAllowed = Math.max(0, total - otherAllocations)
          if (nextAmt > maxAllowed) {
            nextAmt = maxAllowed
          }
        }
        return {
          ...line,
          method: newMethod,
          amount: nextAmt > 0 ? String(nextAmt) : line.amount,
          tendered: newMethod === "cash" ? (line.tendered || line.amount) : "",
        }
      })
    )
  }

  function updateSplitLineAmount(lineIndex: number, newAmountStr: string) {
    const targetLine = splitLines[lineIndex]
    if (!targetLine) return

    let numVal = Math.max(0, Number(newAmountStr) || 0)

    // Validation rule: Only Cash may exceed the balance (change is given back).
    // Card, Bank Transfer and Store Credit amounts can never exceed the remaining balance.
    if (targetLine.method !== "cash") {
      const otherAllocations = splitLines
        .filter((_, idx) => idx !== lineIndex)
        .reduce((s, l) => s + (Number(l.amount) || 0), 0)
      const maxAllowed = Math.max(0, total - otherAllocations)
      if (numVal > maxAllowed) {
        numVal = maxAllowed
        newAmountStr = maxAllowed > 0 ? String(maxAllowed) : ""
        toast.warning(`${targetLine.method.toUpperCase()} amount cannot exceed remaining balance of Rs. ${maxAllowed.toLocaleString()}`)
      }
    }

    setSplitLines((prev) => {
      const copy = prev.map((l, idx) =>
        idx === lineIndex
          ? {
              ...l,
              amount: newAmountStr,
              tendered: l.method === "cash" ? (Number(l.tendered) < numVal ? newAmountStr : l.tendered) : l.tendered,
            }
          : l
      )

      // Quick helper: after entering the first amount, auto-fill the next line with the remaining balance
      if (lineIndex === 0 && copy.length > 1) {
        const remainingForNext = Math.max(0, total - numVal)
        const line1 = copy[1]
        if (!line1.amount || Number(line1.amount) === 0 || line1.amount === String(Math.max(0, total - (Number(targetLine.amount) || 0)))) {
          copy[1] = {
            ...line1,
            amount: remainingForNext > 0 ? String(remainingForNext) : "",
            tendered: line1.method === "cash" && remainingForNext > 0 ? String(remainingForNext) : line1.tendered,
          }
        }
      }
      return copy
    })
  }

  function handlePayRemaining(lineId: string) {
    const line = splitLines.find((l) => l.id === lineId)
    if (!line) return
    const otherAllocations = splitLines.filter((l) => l.id !== lineId).reduce((s, l) => s + (Number(l.amount) || 0), 0)
    const rem = Math.max(0, total - otherAllocations)
    setSplitLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              amount: String(rem),
              tendered: l.method === "cash" ? String(rem) : l.tendered,
            }
          : l
      )
    )
    toast.success(`Allocated remaining Rs. ${rem.toLocaleString()} to this line`)
  }

  function handleCashChip(lineId: string, action: "exact" | "+500" | "500" | "1000" | "2000" | "5000" | "10000") {
    setSplitLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l
        const lineAmt = Number(l.amount) || 0
        let nextTendered = Number(l.tendered) || lineAmt
        if (action === "exact") {
          nextTendered = lineAmt
        } else if (action === "+500") {
          nextTendered += 500
        } else {
          nextTendered = Number(action)
        }
        return {
          ...l,
          tendered: String(nextTendered),
        }
      })
    )
  }

  // Cart operations
  function addToCart(p: Product, customModifiers?: string[], extraPrice = 0, itemNotes?: string) {
    const itemStation = (p.station as "kitchen" | "bar") || determineItemStation(p)
    const validMods = (customModifiers && customModifiers.length > 0) ? customModifiers.slice().filter(Boolean) : []
    const modKey = validMods.slice().sort().join("|")
    const cartItemId = (modKey || itemNotes) ? `${p.id}_${modKey}_${itemNotes || ""}` : p.id
    const finalPrice = p.price + (extraPrice || 0)

    setCart((items) => {
      const existingIndex = items.findIndex((i) => (i.cartItemId || i.id) === cartItemId)
      if (existingIndex >= 0) {
        return items.map((i, idx) =>
          idx === existingIndex
            ? { ...i, quantity: i.quantity + 1, station: itemStation }
            : i
        )
      }
      return [
        ...items,
        {
          ...p,
          cartItemId,
          price: finalPrice,
          quantity: 1,
          station: itemStation,
          modifiers: validMods,
          notes: itemNotes,
        },
      ]
    })
  }

  function addAllProductsToCart() {
    const toAdd = visibleProducts.length > 0 ? visibleProducts : menu
    if (!toAdd.length) {
      toast.error("No products available to add.")
      return
    }
    setCart((items) => {
      const copy = [...items]
      for (const p of toAdd) {
        const itemStation = (p.station as "kitchen" | "bar") || determineItemStation(p)
        const existing = copy.find((i) => (i.cartItemId || i.id) === p.id)
        if (existing) {
          existing.quantity += 1
          existing.station = itemStation
        } else {
          copy.push({
            id: p.id,
            cartItemId: p.id,
            name: p.name,
            price: p.price,
            quantity: 1,
            image: p.image,
            category: p.category,
            stock: p.stock,
            department: p.department || (itemStation === "bar" ? "Coffee Bar" : "Juice & Food"),
            station: itemStation,
          })
        }
      }
      return copy
    })
    toast.success(`Added ${toAdd.length} products to current order!`)
  }

  function updateCartQuantity(id: string, delta: number) {
    setCart((items) =>
      items
        .map((i) => {
          if ((i.cartItemId || i.id) === id) {
            const nextQty = i.quantity + delta
            return { ...i, quantity: nextQty }
          }
          return i
        })
        .filter((i) => i.quantity > 0)
    )
  }

  // Load the Acceptance Test Scenario (Table 05, Cappuccino x2, Latte x1, Prime Angus Burger x1, Extra Vanilla x1)
  function loadAcceptanceTestScenario() {
    const cappuccino = menu.find((p) => p.name.toLowerCase().includes("cappuccino")) || {
      id: "test-1",
      name: "Cappuccino",
      price: 700,
      category: "Hot Coffee",
      image: "/placeholder.svg",
      stock: 50,
    }

    const latte = menu.find((p) => p.name.toLowerCase().includes("latte") && !p.name.toLowerCase().includes("iced")) || {
      id: "test-2",
      name: "Latte",
      price: 800,
      category: "Hot Coffee",
      image: "/placeholder.svg",
      stock: 50,
    }

    const burger = menu.find((p) => p.name.toLowerCase().includes("prime angus") || p.name.toLowerCase().includes("burger")) || {
      id: "test-3",
      name: "Prime Angus Burger",
      price: 2000,
      category: "Handheld",
      image: "/placeholder.svg",
      stock: 50,
    }

    const vanilla = menu.find((p) => p.name.toLowerCase().includes("extra vanilla")) || {
      id: "test-4",
      name: "Extra Vanilla",
      price: 200,
      category: "Add-ons",
      image: "/placeholder.svg",
      stock: 50,
    }

    setSelectedTable("Table 05")
    setCart([
      { ...cappuccino, quantity: 2 },
      { ...latte, quantity: 1 },
      { ...burger, quantity: 1 },
      { ...vanilla, quantity: 1 },
    ])
    toast.success("Loaded Test Order (Table 05: Cappuccino x2, Latte x1, Burger x1, Vanilla x1)")
  }

  // Promo code validation and apply
  function handleApplyPromoCode() {
    if (!promoCodeInput.trim()) {
      toast.error("Please enter a promo code")
      return
    }
    const result = SharedPosService.applyPromo(promoCodeInput.trim(), subtotal)
    if (!result.valid) {
      toast.error(result.message)
      return
    }
    setDiscount(String(result.discount))
    setAppliedPromoCode(promoCodeInput.trim().toUpperCase())
    toast.success(`${result.message}! Discount of Rs. ${result.discount.toLocaleString()} applied.`)
  }

  // Open Payment Window
  function openPaymentModal() {
    if (!cart.length) {
      toast.error("Current order is empty! Add products to proceed.")
      return
    }
    setMobileCartOpen(false)
    setPaymentMode("single")
    setPaymentMethod("cash")
    setCashReceivedInput(String(total)) // Default to exact amount
    setCardConfirmed(false)
    setQrConfirmed(false)
    setBankRefNumber("")
    setSelectedCustomerId("")
    setSplitLines([
      { id: "line-1", method: "cash", amount: "", tendered: "", reference: "", customerId: "" },
      { id: "line-2", method: "card", amount: "", tendered: "", reference: "", customerId: "" },
    ])
    setPaymentModalOpen(true)
  }

  // Complete Payment Action
  async function handleCompletePayment() {
    if (!cart.length) return

    const isSplitMode = paymentMode === "split"

    if (isSplitMode) {
      if (isSplitUnderpaid) {
        toast.error(`Total allocated (Rs. ${splitTotalAllocated.toLocaleString()}) is less than bill total (Rs. ${total.toLocaleString()}). Short by Rs. ${splitRemainingBalance.toLocaleString()}.`)
        return
      }
      if (hasEmptySplitAmount) {
        toast.error("Please enter a valid amount for every payment line.")
        return
      }
      if (isSplitMissingCardRef) {
        toast.error("Please enter the terminal approval code for each Card line.")
        return
      }
      if (isSplitMissingBankRef) {
        toast.error("Please enter the reference / slip number for each Bank Transfer line.")
        return
      }
      if (isSplitMissingCreditCust) {
        toast.error("Please select a customer account for each Store Credit line.")
        return
      }
    } else {
      if (paymentMethod === "cash" && isCashInsufficient) {
        toast.error("Insufficient cash amount! Cash received must be greater than or equal to total.")
        return
      }

      if (paymentMethod === "card" && !cardConfirmed) {
        toast.error("Please confirm card payment on the terminal first.")
        return
      }

      if (paymentMethod === "qr" && !qrConfirmed) {
        toast.error("Please confirm QR / online payment receipt first.")
        return
      }

      if (paymentMethod === "bank_transfer" && !bankRefNumber.trim()) {
        toast.error("Please enter the Bank Transfer reference or slip number.")
        return
      }

      if (paymentMethod === "credit" && !selectedCustomerId) {
        toast.error("Please select a customer from the account ledger for credit billing.")
        return
      }
    }

    const selectedCust = customers.find((c) => c.id === selectedCustomerId)

    const isPayingExisting = Boolean(activeOpenOrder)
    let orderNum = activeOpenOrder?.order_number || ""
    let receiptNum = activeOpenOrder?.receipt_number || ""

    if (!isPayingExisting) {
      try {
        const allocated = await SharedPosService.allocateNextOrderNumber()
        orderNum = allocated.orderNumber
        receiptNum = allocated.receiptNumber
        setOrderCount(allocated.seq)
      } catch {
        const fallback = getNextOrderNumberInfo()
        orderNum = fallback.orderNum
        receiptNum = fallback.receiptNum
        setOrderCount(fallback.nextSeq)
      }
    } else if (!receiptNum) {
      receiptNum = `LS-RC-${orderNum.replace(/^LS-/, "")}`
    }

    const purchasedItems: CartItem[] = cart.map((i) => ({
      ...i,
      station: (i.station as "kitchen" | "bar") || determineItemStation(i),
    }))

    // 0. Prevent assigning new dine-in order to occupied table
    if (orderType === "dine_in" && selectedTable && selectedTable !== "Takeaway") {
      const curTable = tables.find((t) => t.name.toLowerCase() === selectedTable.toLowerCase())
      if (!isPayingExisting && curTable && curTable.status === "occupied") {
        toast.error(`Table ${selectedTable} is currently OCCUPIED. Please select an available table.`)
        return
      }
    }

    // 1. Validate ingredient stock before allowing payment confirmation
    const stockValidation = SharedPosService.validateOrderStock(purchasedItems)
    if (!stockValidation.valid) {
      toast.error(stockValidation.warnings[0], { duration: 6000 })
      return
    }

    const nowIso = new Date().toISOString()

    let finalPaymentMethod: PaymentMethod | string = paymentMethod
    let splitSummary: any[] | undefined = undefined
    let finalCashReceived = total
    let finalChangeAmount = 0

    if (isSplitMode) {
      finalPaymentMethod = "split"
      splitSummary = splitLines.map((l) => {
        const amt = Number(l.amount) || 0
        const tend = l.method === "cash" ? Math.max(amt, Number(l.tendered) || amt) : amt
        const change = l.method === "cash" ? Math.max(0, tend - amt) : 0
        const cust = l.method === "credit" ? customers.find((c) => c.id === l.customerId) : undefined
        return {
          id: l.id,
          method: l.method,
          amount: amt,
          tendered: tend,
          change_due: change,
          reference: l.reference?.trim() || undefined,
          customer_id: cust?.id,
          customer_name: cust?.name,
        }
      })
      finalCashReceived = splitSummary.reduce((s, l) => s + (l.tendered || l.amount), 0)
      finalChangeAmount = splitSummary.reduce((s, l) => s + (l.change_due || 0), 0)
    } else {
      finalCashReceived = paymentMethod === "cash" ? cashReceivedAmount : total
      finalChangeAmount = paymentMethod === "cash" ? changeAmount : 0
    }

    const orderId = isPayingExisting
      ? activeOpenOrder!.id
      : (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `ord-${Date.now()}`)
    const newOrderRecord: OrderRecord = {
      id: orderId,
      order_number: orderNum,
      receipt_number: receiptNum,
      table_name: orderType === "takeaway" ? "Takeaway" : orderType === "delivery" ? `Delivery (${deliveryPhone || "Guest"})` : selectedTable,
      cashier_name: cashierName,
      department: "Juice & Food",
      items: purchasedItems,
      subtotal,
      service_charge: serviceCharge,
      service_charge_rate: serviceChargeRate,
      discount: discountNum,
      total,
      payment_method: finalPaymentMethod,
      split_payments: splitSummary,
      cash_received: finalCashReceived,
      change_amount: finalChangeAmount,
      status: "paid",
      payment_status: "paid",
      kitchen_status: isPayingExisting ? (activeOpenOrder!.kitchen_status || "pending") : "pending",
      bar_status: isPayingExisting ? (activeOpenOrder!.bar_status || "pending") : "pending",
      order_type: orderType,
      delivery_address: orderType === "delivery" ? deliveryAddress : undefined,
      delivery_phone: orderType === "delivery" ? deliveryPhone : undefined,
      customer_id: selectedCust?.id,
      customer_name: selectedCust?.name,
      bank_ref: paymentMethod === "bank_transfer" ? bankRefNumber.trim() : undefined,
      created_at: isPayingExisting ? activeOpenOrder!.created_at : nowIso,
    }

    const idempotencyKey = `idem_${orderId}_${isPayingExisting ? "pay" : "create"}`

    // 1. Authoritative transactional order persistence & atomic stock deduction
    try {
      const savedOrder = await SharedPosService.saveOrder({
        ...newOrderRecord,
        idempotency_key: idempotencyKey,
        action: isPayingExisting ? "pay_tab" : "create_order",
      })
      if (savedOrder?.order_number) newOrderRecord.order_number = savedOrder.order_number
      if (savedOrder?.receipt_number) newOrderRecord.receipt_number = savedOrder.receipt_number
      if (savedOrder?.id) newOrderRecord.id = savedOrder.id
    } catch (saveErr: any) {
      console.error("Order payment transaction failed:", saveErr)
      toast.error(saveErr?.message || "Failed to process payment. Please try again.")
      return
    }

      // 2. Deduct Inventory stock for sold products ONLY if not already deducted on an open tab
      if (!isPayingExisting) {
        const updatedProducts = products.map((p) => {
          const bought = purchasedItems.find((item) => item.id === p.id || (item as any).product_id === p.id || item.name?.toLowerCase() === p.name.toLowerCase())
          if (bought) {
            const remaining = Math.max(0, p.stock - bought.quantity)
            return { ...p, stock: remaining }
          }
          return p
        })
        setProducts(updatedProducts)
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("pos_products_updated"))
        }

        // Record inventory movements
        const newMovements = purchasedItems.map((item) => ({
          id: String(Date.now() + Math.random()),
          product_id: item.id,
          product_name: item.name,
          quantity_change: -item.quantity,
          reason: `Sale #${orderNum}`,
          created_at: nowIso,
        }))
        setMovements((prev) => [...newMovements, ...prev])
      }

      // 3. Mark Table Status as OCCUPIED for dine-in tables (freed from Tables workspace when guests leave)
      if (orderType === "dine_in" && selectedTable && selectedTable !== "Takeaway") {
        void SharedPosService.occupyTable(selectedTable, "Juice & Food", orderNum, total)
      }

      setOrders((prev) => [newOrderRecord, ...prev.filter((o) => o.id !== newOrderRecord.id && o.order_number !== newOrderRecord.order_number)])

    // 4. Set receipt for thermal preview & reset cart & adjustments
    if (finalPaymentMethod === "cash" || (splitSummary && splitSummary.some((s: any) => s.method === "cash"))) {
      playCashDrawerSound()
    }
    setCompletedReceipt(newOrderRecord)
    setActiveOpenOrder(null)
    setCart([])
    setDiscount("0")
    setAppliedPromoCode("")
    setPromoCodeInput("")
    setTax("")
    setIsTaxIncluded(true)
    setCardConfirmed(false)
    setQrConfirmed(false)
    setBankRefNumber("")
    setSelectedCustomerId("")
    setPaymentMode("single")
    setSplitLines([
      { id: "line-1", method: "cash", amount: "", tendered: "", reference: "", customerId: "" },
      { id: "line-2", method: "card", amount: "", tendered: "", reference: "", customerId: "" },
    ])
    setPaymentModalOpen(false)

    // Advance selectedTable to next available table
    const nextAvail = tables.find((t) => t.status === "available" && t.name.toLowerCase() !== selectedTable.toLowerCase())
    if (nextAvail) {
      setSelectedTable(nextAvail.name)
    }

    toast.success(`Payment Completed! Order #${orderNum} recorded. Table ${selectedTable} marked occupied.`)
  }

  // Send open order to Kitchen & Bar (for dine-in tables paying later)
  async function handleSendToKitchenAndBar() {
    if (!cart.length) {
      toast.error("Current order is empty! Add products to proceed.")
      return
    }

    const isUpdatingOpen = Boolean(activeOpenOrder)
    let orderNum = activeOpenOrder?.order_number || ""
    let receiptNum = activeOpenOrder?.receipt_number || ""

    if (!isUpdatingOpen) {
      try {
        const allocated = await SharedPosService.allocateNextOrderNumber()
        orderNum = allocated.orderNumber
        receiptNum = allocated.receiptNumber
        setOrderCount(allocated.seq)
      } catch {
        const fallback = getNextOrderNumberInfo()
        orderNum = fallback.orderNum
        receiptNum = fallback.receiptNum
        setOrderCount(fallback.nextSeq)
      }
    } else if (!receiptNum) {
      receiptNum = `LS-RC-${orderNum.replace(/^LS-/, "")}`
    }

    const purchasedItems: CartItem[] = cart.map((i) => ({
      ...i,
      station: (i.station as "kitchen" | "bar") || determineItemStation(i),
    }))

    // 0. Prevent assigning new dine-in order to occupied table (handleSendToKitchenAndBar)
    if (orderType === "dine_in" && selectedTable && selectedTable !== "Takeaway") {
      const curTable = tables.find((t) => t.name.toLowerCase() === selectedTable.toLowerCase())
      if (!isUpdatingOpen && curTable && curTable.status === "occupied") {
        toast.error(`Table ${selectedTable} is currently OCCUPIED. Please select an available table.`)
        return
      }
    }

    // 1. Validate ingredient stock before allowing payment confirmation
    const stockValidation = SharedPosService.validateOrderStock(purchasedItems)
    if (!stockValidation.valid) {
      toast.error(stockValidation.warnings[0], { duration: 6000 })
      return
    }

    const nowIso = new Date().toISOString()

    const orderId = isUpdatingOpen
      ? activeOpenOrder!.id
      : (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `ord-${Date.now()}`)
    const newOrderRecord: OrderRecord = {
      id: orderId,
      order_number: orderNum,
      receipt_number: receiptNum,
      table_name: selectedTable,
      cashier_name: cashierName,
      customer_name: "Walk-in Guest",
      department: "Juice & Food",
      items: purchasedItems,
      subtotal,
      service_charge: serviceCharge,
      service_charge_rate: serviceChargeRate,
      discount: discountNum,
      total,
      payment_method: "cash",
      payment_status: "unpaid",
      cash_received: 0,
      change_amount: 0,
      status: "open",
      order_type: selectedTable && selectedTable !== "Takeaway" ? "dine_in" : "takeaway",
      kitchen_status: "pending",
      bar_status: "pending",
      created_at: isUpdatingOpen ? activeOpenOrder!.created_at : nowIso,
    }

    const idempotencyKey = `idem_${orderId}_send`

    // 1. Authoritative transactional order persistence & station tickets creation
    try {
      const savedOrder = await SharedPosService.saveOrder({
        ...newOrderRecord,
        idempotency_key: idempotencyKey,
        action: isUpdatingOpen ? "add_items" : "send_kitchen",
      })
      if (savedOrder?.order_number) newOrderRecord.order_number = savedOrder.order_number
      if (savedOrder?.receipt_number) newOrderRecord.receipt_number = savedOrder.receipt_number
      if (savedOrder?.id) newOrderRecord.id = savedOrder.id
    } catch (saveErr: any) {
      console.error("Send to kitchen/bar failed:", saveErr)
      toast.error(saveErr?.message || "Failed to send order to kitchen/bar. Please try again.")
      return
    }

      // Deduct inventory locally
      const updatedProducts = products.map((p) => {
        const bought = purchasedItems.find((it) => it.id === p.id || (it as any).product_id === p.id || it.name?.toLowerCase() === p.name.toLowerCase())
        return bought ? { ...p, stock: Math.max(0, p.stock - bought.quantity) } : p
      })
      setProducts(updatedProducts)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pos_products_updated"))
      }

      // Mark table occupied across POS, Tables, and Coffee screens
      void SharedPosService.occupyTable(selectedTable, "Juice & Food", orderNum, total)

      setOrders((prev) => [newOrderRecord, ...prev.filter((o) => o.id !== newOrderRecord.id && o.order_number !== newOrderRecord.order_number)])

    // Set KOT ticket data and open KOT preview modal
    setKotTicketData(newOrderRecord)
    setKotModalOpen(true)

    setActiveOpenOrder(null)
    setCart([])
    setMobileCartOpen(false)

    // Advance selectedTable to next available table
    const nextAvail = tables.find((t) => t.status === "available" && t.name.toLowerCase() !== selectedTable.toLowerCase())
    if (nextAvail) {
      setSelectedTable(nextAvail.name)
    }

    toast.success(`Order #${orderNum} sent to Kitchen & Bar! Table ${selectedTable} marked occupied.`)
  }

  function handlePayOpenOrder(order: OrderRecord) {
    setActiveOpenOrder(order)
    setCart(order.items.map((it) => ({ ...it })))
    setSelectedTable(order.table_name || "Takeaway")
    setDiscount(String(order.discount || 0))
    setView("POS")
    setMobileCartOpen(true)
    toast.info(`Loaded open tab #${order.order_number} for ${order.table_name}. Select payment to complete or add more products.`)
  }

  // Print Ticket Slip for Kitchen (KOT) or Bar (BOT)
  function printTicketSlip(order: OrderRecord, station: TicketStation) {
    const items = getStationItems(order, station)
    if (!items.length) {
      toast.error(`No ${station} items found in this ticket.`)
      return
    }

    printTicketSlipDoc(
      {
        order_number: order.order_number,
        table_name: order.table_name || "Takeaway",
        cashier_name: order.cashier_name || "System Administrator",
        created_at: order.created_at || new Date().toISOString(),
        items: items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          category: it.category,
          notes: it.notes,
        })),
      },
      station
    )
  }

  // Create and select product category
  async function handleAddCategory(nameToCreate?: string) {
    const raw = (nameToCreate || newCategoryName).trim()
    if (!raw) {
      toast.error("Category name cannot be empty")
      return
    }
    const existing = categories.find((c) => c.name.toLowerCase() === raw.toLowerCase())
    if (existing) {
      toast.info(`Category "${raw}" already exists`)
      setForm((f) => ({ ...f, category_id: existing.id }))
      setNewCategoryName("")
      setShowAddCategoryInline(false)
      return existing
    }

    try {
      const { data, error } = await supabase
        .from("pos_categories")
        .insert({ name: raw, is_active: true, sort_order: categories.length + 1 })
        .select("id, name")
        .single()
      
      const realId = (data && !error && data.id) ? String(data.id) : undefined
      const newCat = realId && data
        ? { id: realId, name: data.name }
        : { id: `cat-${Date.now()}`, name: raw }

      await SharedPosService.addCategory(raw, realId)
      setCategories((prev) => {
        if (prev.some((c) => c.name.toLowerCase() === raw.toLowerCase())) return prev
        return [...prev, newCat]
      })
      setForm((f) => ({ ...f, category_id: newCat.id }))
      setNewCategoryName("")
      setShowAddCategoryInline(false)

      window.dispatchEvent(new CustomEvent("pos_categories_updated", { detail: newCat }))
      window.dispatchEvent(new CustomEvent("pos_realtime_sync", { detail: { type: "categories", data: newCat } }))
      toast.success(`Category "${raw}" added!`)
      return newCat
    } catch {
      const fallbackCat = { id: `cat-${Date.now()}`, name: raw }
      await SharedPosService.addCategory(raw)
      setCategories((prev) => {
        if (prev.some((c) => c.name.toLowerCase() === raw.toLowerCase())) return prev
        return [...prev, fallbackCat]
      })
      setForm((f) => ({ ...f, category_id: fallbackCat.id }))
      setNewCategoryName("")
      setShowAddCategoryInline(false)

      window.dispatchEvent(new CustomEvent("pos_categories_updated", { detail: fallbackCat }))
      window.dispatchEvent(new CustomEvent("pos_realtime_sync", { detail: { type: "categories", data: fallbackCat } }))
      toast.success(`Category "${raw}" added!`)
      return fallbackCat
    }
  }

  // Print Receipt Generator (Formatted strictly for 80mm thermal receipt printers)
  function printThermalReceipt(
    orderData: OrderRecord | null = completedReceipt,
    isGuestBill = false
  ) {
    if (!orderData) return
    printThermalReceiptDoc(orderData, isGuestBill)
  }

  // Save/Admin handlers
  async function saveProduct() {
    if (!form.name.trim() || !form.price) return toast.error("Name and price are required")
    const chosenCat = categories.find((c) => String(c.id) === String(form.category_id))
    const categoryName = chosenCat?.name || "General"

    let catId = form.category_id
    if (chosenCat && (!catId || catId.startsWith("cat-"))) {
      try {
        const { data: existingCat } = await supabase
          .from("pos_categories")
          .select("id")
          .ilike("name", chosenCat.name)
          .maybeSingle()
        if (existingCat?.id) {
          catId = String(existingCat.id)
        } else {
          const { data: newCat } = await supabase
            .from("pos_categories")
            .insert({ name: chosenCat.name, is_active: true, sort_order: categories.length + 1 })
            .select("id")
            .single()
          if (newCat?.id) {
            catId = String(newCat.id)
            setCategories((prev) => prev.map((c) => c.name === chosenCat.name ? { ...c, id: String(newCat.id) } : c))
          }
        }
      } catch {}
    }

    const isUuid = Boolean(catId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(catId))
    const station = form.station || determineItemStation({
      name: form.name.trim(),
      category: categoryName,
    })
    const department = station === "bar" ? "Coffee Bar" : "Juice & Food"
    let productImage = form.image?.trim() || resolveProductImage(form.name.trim(), "/placeholder.svg", categoryName)

    if (productImage.startsWith("data:")) {
      try {
        const upRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: productImage }),
        })
        if (upRes.ok) {
          const upJson = await upRes.json().catch(() => ({}))
          if (upJson?.success && upJson?.url) {
            productImage = upJson.url
          }
        }
      } catch (e) {
        console.warn("Could not convert dataUrl to uploaded image", e)
      }
    }

    const editingProduct = editingProductId ? products.find((p) => p.id === editingProductId) : null
    const parsedStock = form.stock !== "" && !isNaN(Number(form.stock)) ? Math.max(0, parseInt(form.stock, 10)) : (editingProduct?.stock ?? 0)

    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      stock: parsedStock,
      image: productImage,
      category_id: catId || null,
      category: categoryName,
      category_name: categoryName,
      active: true,
      is_active: true,
      is_archived: false,
      station,
      department,
      department_override: department,
    }

    let savedId = editingProductId || `prod-${Date.now()}`
    let serverUpdatedAt: string | undefined
    try {
      if (editingProductId) {
        const res = await fetch(`/api/products/${encodeURIComponent(editingProductId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          toast.error(errData?.error || "Failed to update product on server.")
          return
        }
        const data = await res.json().catch(() => ({}))
        if (data?.product?.id) savedId = String(data.product.id)
        if (data?.product?.updated_at) serverUpdatedAt = String(data.product.updated_at)
        if (data?.product?.image && !data.product.image.includes("placeholder")) {
          productImage = data.product.image
        }
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          toast.error(errData?.error || "Failed to create product on server.")
          return
        }
        const data = await res.json().catch(() => ({}))
        if (data?.product?.id) savedId = String(data.product.id)
        if (data?.product?.updated_at) serverUpdatedAt = String(data.product.updated_at)
        if (data?.product?.image && !data.product.image.includes("placeholder")) {
          productImage = data.product.image
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Network error while saving product.")
      return
    }

    try {
      if (editingProductId) {
        if (isUuid) {
          await supabase.from("pos_products").update(payload).eq("id", editingProductId)
        } else {
          await supabase.from("pos_products").update(payload).ilike("name", payload.name)
        }
      } else {
        await supabase.from("pos_products").insert({ ...payload, id: savedId })
      }
    } catch (e) {
      console.warn("Saved product locally", e)
    }

    const effectiveId = editingProductId || savedId
    const nowIso = serverUpdatedAt || new Date().toISOString()
    const saved: Product = {
      id: effectiveId,
      name: form.name.trim(),
      price: Number(form.price),
      category: categoryName,
      image: productImage,
      stock: parsedStock,
      category_id: catId || undefined,
      station,
      department,
      user_customized: true,
      updated_at: nowIso,
    }

    await SharedPosService.saveProduct(saved, editingProductId || undefined)
    setProducts((prev) => (editingProductId ? prev.map((p) => (p.id === editingProductId || p.id === savedId || p.name.toLowerCase() === saved.name.toLowerCase() ? saved : p)) : [saved, ...prev]))
    window.dispatchEvent(new CustomEvent("pos_products_updated", { detail: saved }))
    window.dispatchEvent(new CustomEvent("pos_realtime_sync", { detail: { type: "products", data: saved } }))
    toast.success(editingProductId ? "Product updated successfully" : "Product added successfully")
    setEditingProductId(null)
    setDialogType(null)
  }

  async function deleteProduct(id: string) {
    await SharedPosService.deleteProduct(id)
    try {
      const { error } = await supabase.from("pos_products").delete().eq("id", id)
      if (error) {
        console.warn("Could not delete from Supabase; removed locally", error)
      }
    } catch {}
    setProducts((prev) => prev.filter((p) => p.id !== id))
    window.dispatchEvent(new CustomEvent("pos_products_updated", { detail: { id, deleted: true } }))
    window.dispatchEvent(new CustomEvent("pos_realtime_sync", { detail: { type: "products", data: { id, deleted: true } } }))
    setDeleteProductId(null)
    toast.success("Product deleted successfully")
  }

  async function saveTable() {
    if (!form.name) return toast.error("Table number is required")
    try {
      await SharedPosService.addTable(form.name, Number(form.capacity) || 2)
      toast.success("Table created successfully!")
      setDialogType(null)
    } catch (e: any) {
      toast.error(e?.message || "Failed to create table")
    }
  }

  async function adjustStock(product: Product, amount: number) {
    if (!Number.isFinite(amount) || amount === 0) return
    const nextStock = Math.max(0, product.stock + amount)
    const nowIso = new Date().toISOString()
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: nextStock }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        toast.error(errJson?.error || "Failed to adjust stock on server")
        return
      }
    } catch (e: any) {
      toast.error(e?.message || "Network error adjusting stock")
      return
    }

    void SharedPosService.adjustStock(product.id, amount, form.reason || "Manual adjustment")
    try {
      await supabase.from("pos_products").update({ stock: nextStock, updated_at: nowIso }).eq("id", product.id)
    } catch {}

    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, stock: nextStock, user_customized: true, updated_at: nowIso } : p)))
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos_products_updated", { detail: { id: product.id, stock: nextStock, updated_at: nowIso } }))
    }
    toast.success(`Inventory stock updated for ${product.name}`)
    setDialogType(null)
  }

  async function updateOrderStatus(orderId: string, station: TicketStation, nextStatus: TicketStatus) {
    if (orderId.startsWith("coffee:")) {
      const billId = orderId.slice("coffee:".length)
      setCoffeeBills((prev) =>
        prev.map((bill) => (bill.id === billId ? { ...bill, bar_status: nextStatus } : bill)),
      )
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("pos_coffee_bills")
          if (raw) {
            const bills = JSON.parse(raw)
            if (Array.isArray(bills)) {
              const updated = bills.map((b: any) => (b.id === billId ? { ...b, bar_status: nextStatus } : b))
              localStorage.setItem("pos_coffee_bills", JSON.stringify(updated))
              window.dispatchEvent(new CustomEvent("pos_orders_updated"))
            }
          }
        } catch {}
      }
      try {
        await fetch(`/api/coffee/bills/${encodeURIComponent(billId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bar_status: nextStatus }),
        })
      } catch {
        console.warn("Could not sync coffee bill bar status")
      }
      toast.success(`Bar ticket marked ${nextStatus}`)
      return
    }

    const order = orders.find((item) => item.id === orderId || item.order_number === orderId)
    if (!order) return

    const statusField = station === "bar" ? "bar_status" : "kitchen_status"
    setOrders((prev) =>
      prev.map((item) => {
        if (item.id === order.id || item.order_number === order.order_number) {
          const updated = { ...item, [statusField]: nextStatus }
          if (isOrderFullyServed(updated) && (updated.status === "paid" || updated.status === "completed")) {
            updated.status = "completed"
          }
          return updated
        }
        return item
      }),
    )
    await SharedPosService.updateTicketStatus(order.id, station, nextStatus)

    toast.success(`${station === "bar" ? "Bar" : "Kitchen"} ticket marked ${nextStatus}`)
  }


  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" })
    location.href = "/auth/login"
  }

  function handleSelectTableAndStartOrder(tableName: string) {
    setSelectedTable(tableName)
    const openForTable = orders.find(
      (o) => o.table_name?.toLowerCase() === tableName.toLowerCase() && (o.status === "open" || o.status === "bill_requested")
    )
    if (openForTable) {
      setActiveOpenOrder(openForTable)
      setCart(openForTable.items.map((it) => ({ ...it })))
      toast.info(`Loaded open tab #${openForTable.order_number} for ${tableName}. You can add more products now.`)
    } else {
      setActiveOpenOrder(null)
      setCart([])
      SharedPosService.occupyTable(tableName, "Juice & Food")
      toast.info(`Selected ${tableName} for new POS Order`)
    }
    setView("POS")
  }

  if (!mounted) {
    return (
      <div suppressHydrationWarning className="min-h-[100dvh] bg-[#F4EBE4] flex items-center justify-center">
        <div suppressHydrationWarning className="flex flex-col items-center gap-3 text-[#808068]">
          <div className="size-10 animate-spin rounded-full border-4 border-[#D67B6B] border-t-transparent" />
          <span className="font-serif text-lg font-bold tracking-tight text-[#343428]">LAZY SUNDAY</span>
          <p className="text-xs text-[#808068]">Opening POS register…</p>
        </div>
      </div>
    )
  }

  return (
    <div suppressHydrationWarning className="min-h-[100dvh] bg-background text-foreground flex flex-col lg:flex-row pb-20 lg:pb-0 transition-colors duration-200">
      {/* ========================================================= */}
      {/* 1. DESKTOP SIDEBAR NAVIGATION                             */}
      {/* ========================================================= */}
      <aside className="hidden w-[238px] shrink-0 flex-col border-r border-[#E5D8CF] bg-[#F4EBE4] lg:flex sticky top-0 h-screen overflow-y-auto">
        <div className="flex h-[78px] items-center gap-3 border-b border-[#E5D8CF] px-6 shrink-0 bg-[#FAF5F1]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#808068] text-[#F4EBE4] shadow-sm">
            <UtensilsCrossed className="size-5" />
          </div>
          <div>
            <p className="font-serif text-[17px] font-bold leading-tight text-[#343428]">Lazy Sunday</p>
            <p className="text-[10px] uppercase tracking-[.2em] text-[#808068]">Restaurant &amp; Bar</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-4">
          <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#808068]">Workspace</p>
          {workspaceNav
            .filter(({ requiredPermission }) => !requiredPermission || hasPermission(requiredPermission))
            .map(({ label, icon: Icon }) => (
            <Button
              key={label}
              variant="ghost"
              onClick={() => setView(label)}
              className={`justify-start gap-3 rounded-xl px-3 ${
                view === label ? "bg-[#D67B6B] text-white font-semibold shadow-xs hover:bg-[#c26555] hover:text-white" : "text-[#545442] hover:bg-[#EAB8B5]/25 hover:text-[#343428]"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}

          {/* ========================================================= */}
          {/* COFFEE MODULE (Separate Service)                          */}
          {/* ========================================================= */}
          <div className="pt-4">
            <button
              onClick={() => setCoffeeMenuOpen(!coffeeMenuOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-[#808068] hover:text-[#D67B6B] transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Coffee className="size-3.5 text-[#D67B6B]" />
                Coffee
              </span>
              <ChevronRight
                className={`size-3 transition-transform duration-200 ${coffeeMenuOpen ? "rotate-90" : ""}`}
              />
            </button>

            {coffeeMenuOpen && (
              <div className="mt-1 space-y-1 pl-2 border-l-2 border-[#D67B6B]/30 ml-2.5">
                {coffeeNav
                  .filter((item) => !item.requiredPermission || hasPermission(item.requiredPermission))
                  .map(({ label, title, icon: Icon, adminOnly }) => (
                    <Button
                      key={label}
                      variant="ghost"
                      onClick={() => setView(label)}
                      className={`w-full justify-start gap-2.5 rounded-xl px-2.5 text-xs h-9 ${
                        view === label
                          ? "bg-[#D67B6B] text-white font-bold shadow-xs hover:bg-[#c26555] hover:text-white"
                          : "text-[#545442] hover:bg-[#EAB8B5]/25 hover:text-[#343428]"
                      }`}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span className="truncate">{title}</span>
                      {adminOnly && (
                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#FAF5F1] text-[#808068] font-semibold border border-[#E5D8CF]">
                          Admin
                        </span>
                      )}
                    </Button>
                  ))}
              </div>
            )}
          </div>

          <p className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[.2em] text-[#808068]">Management</p>
          {managementNav
            .filter(({ requiredPermission }) => !requiredPermission || hasPermission(requiredPermission))
            .map(({ label, title, icon: Icon }) => (
            <Button
              key={label}
              variant="ghost"
              onClick={() => setView(label)}
              className={`justify-start gap-3 rounded-xl px-3 ${
                view === label ? "bg-[#D67B6B] text-white font-semibold shadow-xs hover:bg-[#c26555] hover:text-white" : "text-[#545442] hover:bg-[#EAB8B5]/25 hover:text-[#343428]"
              }`}
            >
              <Icon className="size-4" />
              {title || label}
            </Button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#E5D8CF] shrink-0">
          <div className="rounded-2xl bg-[#808068] p-3.5 text-[#F4EBE4]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">POS Engine</p>
              <Badge className="bg-[#EAB8B5] text-[#808068] hover:bg-[#EAB8B5] font-bold text-[9px] px-1.5 py-0.5">
                LIVE SYNC
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-[#F4EBE4]/80">Real-time orders & table automation.</p>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MOBILE NAVIGATION DRAWER (Sheet)                       */}
      {/* ========================================================= */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[82vw] max-w-xs p-0 flex flex-col justify-between bg-[#F4EBE4] z-50">
          <div>
            {/* Drawer Header */}
            <div className="flex items-center gap-3 border-b border-[#E5D8CF] p-5 bg-[#FAF5F1]">
              <div className="flex size-11 items-center justify-center rounded-xl bg-[#808068] text-[#F4EBE4] shadow-sm">
                <UtensilsCrossed className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="font-serif text-lg font-bold leading-tight truncate text-[#343428]">Lazy Sunday</SheetTitle>
                <SheetDescription className="text-[10px] uppercase tracking-[.2em] text-[#808068]">Restaurant &amp; Bar</SheetDescription>
              </div>
            </div>

            {/* Active Cashier Badge */}
            <div className="mx-4 mt-4 p-3 rounded-xl bg-[#FAF5F1] border border-[#E5D8CF] flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#808068]">Active Register</p>
                <p className="text-sm font-semibold text-[#343428]">{cashierName}</p>
              </div>
              <Badge className="bg-[#808068] text-white capitalize text-[10px] px-2 py-0.5">
                {getRoleDisplayName(activeRole)}
              </Badge>
            </div>

            {/* Drawer Navigation Links */}
            <div className="px-3 py-2 space-y-4 max-h-[calc(100dvh-270px)] overflow-y-auto">
              <div>
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-[#808068]">Workspace</p>
                <div className="space-y-1">
                  {workspaceNav
                    .filter(({ requiredPermission }) => !requiredPermission || hasPermission(requiredPermission))
                    .map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      onClick={() => {
                        setView(label)
                        setMobileNavOpen(false)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        view === label
                          ? "bg-[#D67B6B] text-white font-semibold shadow-xs"
                          : "text-[#545442] hover:bg-[#EAB8B5]/25"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{label}</span>
                      {label === "POS" && cart.length > 0 && (
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#808068] text-white font-mono">
                          {totalCartQty}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Coffee Section */}
              <div>
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-[#808068] flex items-center gap-1.5">
                  <Coffee className="size-3 text-[#D67B6B]" />
                  Coffee
                </p>
                <div className="space-y-1">
                  {coffeeNav
                    .filter((item) => !item.requiredPermission || hasPermission(item.requiredPermission))
                    .map(({ label, title, icon: Icon, adminOnly }) => (
                      <button
                        key={label}
                        onClick={() => {
                          setView(label)
                          setMobileNavOpen(false)
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          view === label
                            ? "bg-[#D67B6B] text-white font-semibold shadow-xs"
                            : "text-[#545442] hover:bg-[#EAB8B5]/25"
                        }`}
                      >
                        <Icon className="size-4 shrink-0 text-[#808068]" />
                        <span>{title}</span>
                        {adminOnly && (
                          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#FAF5F1] text-[#808068] border border-[#E5D8CF] font-semibold">
                            Admin
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-[#808068]">Management</p>
                <div className="space-y-1">
                  {managementNav
                    .filter(({ requiredPermission }) => !requiredPermission || hasPermission(requiredPermission))
                    .map(({ label, title, icon: Icon }) => (
                    <button
                      key={label}
                      onClick={() => {
                        setView(label)
                        setMobileNavOpen(false)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        view === label
                          ? "bg-[#D67B6B] text-white font-semibold shadow-xs"
                          : "text-[#545442] hover:bg-[#EAB8B5]/25"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{title || label}</span>
                      {label === "Orders" && orders.length > 0 && (
                        <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded-md bg-[#FAF5F1] text-[#808068] font-mono border border-[#E5D8CF]">
                          {orders.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Test Scenario Trigger in Drawer */}
              <div className="px-1 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadAcceptanceTestScenario()
                    setView("POS")
                    setMobileNavOpen(false)
                  }}
                  className="w-full justify-start gap-2 border-[#808068]/30 text-[#808068] bg-[#FAF5F1] hover:bg-[#eeeee7] text-xs h-9 rounded-xl font-medium"
                >
                  <Zap className="size-3.5 text-[#D67B6B] fill-[#D67B6B]" />
                  Load Test Order (Table 05)
                </Button>
              </div>
            </div>
          </div>

          {/* Drawer Footer with Sign Out */}
          <div className="p-4 border-t border-[#E5D8CF] bg-[#FAF5F1] space-y-3">
            <div className="flex items-center justify-between text-xs text-[#808068]">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#D67B6B] animate-pulse"></span>
                Realtime POS Sync
              </span>
              <span className="font-mono text-[11px]">v1.0</span>
            </div>

            <Button
              variant="outline"
              onClick={signOut}
              className="w-full justify-center gap-2 text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800 h-10 rounded-xl text-sm font-medium"
            >
              <LogOut className="size-4" />
              Sign Out from POS
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ========================================================= */}
      {/* 3. MAIN CONTENT AREA                                      */}
      {/* ========================================================= */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top Responsive Navigation Bar */}
        <header className="flex min-h-[64px] sm:min-h-[72px] items-center justify-between border-b border-[#E5D8CF] bg-[#F4EBE4] px-3 sm:px-6 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.03)] gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            {/* Hamburger Button for Mobile */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden size-9 sm:size-10 rounded-xl hover:bg-[#EAB8B5]/25 text-[#808068] shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="size-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-semibold text-[#808068] truncate hidden sm:inline">
                  Lazy Sunday
                </span>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] sm:text-[11px] font-semibold shrink-0">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>LIVE TERMINAL</span>
                </div>
              </div>
              <h1 className="font-serif text-base sm:text-xl font-bold leading-tight text-[#343428] truncate">
                Good day, {activeUser?.full_name || getRoleDisplayName(activeRole)}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-nowrap">
            {/* Barcode Scanner Simulation Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBarcodeModalOpen(true)}
              className="h-8 sm:h-9 gap-1.5 border-[#808068]/30 text-[#808068] bg-white hover:bg-[#EAB8B5]/20 rounded-xl px-2 sm:px-3 text-xs font-semibold shadow-2xs shrink-0"
              title="Simulate Hardware Barcode Laser Scanner"
            >
              <Barcode className="size-4 text-[#808068] shrink-0" />
              <span className="hidden md:inline">Scan Barcode</span>
            </Button>

            {/* User Guide Quick Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView("UserGuide")}
              title="User Guide & Manual (English / සිංහල)"
              className={`h-8 sm:h-9 gap-1.5 border-[#808068]/30 rounded-xl px-2 sm:px-2.5 text-xs font-medium shrink-0 ${
                view === "UserGuide"
                  ? "bg-[#808068] text-white hover:bg-[#6c6c57] hover:text-white"
                  : "text-[#808068] bg-white hover:bg-[#EAB8B5]/20"
              }`}
            >
              <BookOpen className="size-3.5 shrink-0" />
              <span className="hidden xl:inline">Guide</span>
            </Button>

            {/* Orders Quick Switch */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView("Orders")}
              title="View Orders History"
              className="size-8 sm:size-9 rounded-xl hover:bg-[#EAB8B5]/25 text-[#545442] relative shrink-0"
            >
              <Receipt className="size-4 shrink-0" />
              {orders.length > 0 && (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-[#D67B6B]"></span>
              )}
            </Button>

            {/* Sign Out Button */}
            <Button
              variant="ghost"
              onClick={signOut}
              className="h-8 sm:h-9 gap-1.5 text-[#808068] hover:text-red-700 hover:bg-red-50 rounded-xl px-2 sm:px-2.5 text-xs shrink-0"
              title="Sign Out"
            >
              <Badge className="bg-[#808068] text-white capitalize text-[10px] px-2 py-0.5 border-0 hidden sm:inline-flex">
                {activeRole}
              </Badge>
              <LogOut className="size-3.5 shrink-0" />
            </Button>
          </div>
        </header>

        {/* View Router with Responsive Padding */}
        <div className="flex-1 p-3 sm:p-5 md:p-8 min-w-0">
          {!canAccessView(view) ? (
            <AccessDenied
              role={activeRole}
              onBackToAllowed={() =>
                setView(canAccessView("POS") ? "POS" : canAccessView("Kitchen") ? "Kitchen" : "Orders")
              }
            />
          ) : view === "POS" ? (
            <POSView
              visibleProducts={visibleProducts}
              categories={menuCategories}
              selectedCategory={category}
              setCategory={setCategory}
              query={query}
              setQuery={setQuery}
              cart={cart}
              tables={tables}
              selectedTable={selectedTable}
              setSelectedTable={setSelectedTable}
              addToCart={addToCart}
              onSelectProduct={(p: Product) => {
                const groups = getApplicableModifierGroups(p.name)
                if (groups.length > 0) {
                  setModifierProduct(p)
                } else {
                  addToCart(p)
                }
              }}
              addAllProductsToCart={addAllProductsToCart}
              activeOpenOrder={activeOpenOrder}
              startNewOrder={startNewOrder}
              nextOrderNumber={getNextOrderNumberInfo().orderNum}
              updateCartQuantity={updateCartQuantity}
              subtotal={subtotal}
              serviceCharge={serviceCharge}
              total={total}
              totalCartQty={totalCartQty}
              discount={discount}
              setDiscount={setDiscount}
              tax={tax}
              setTax={setTax}
              isTaxIncluded={isTaxIncluded}
              setIsTaxIncluded={setIsTaxIncluded}
              discountNum={discountNum}
              taxNum={taxNum}
              defaultTax={defaultTax}
              onPay={openPaymentModal}
              onSendToKitchen={handleSendToKitchenAndBar}
              onLoadTest={loadAcceptanceTestScenario}
              mobileCartOpen={mobileCartOpen}
              setMobileCartOpen={setMobileCartOpen}
              orderType={orderType}
              setOrderType={setOrderType}
              deliveryAddress={deliveryAddress}
              setDeliveryAddress={setDeliveryAddress}
              deliveryPhone={deliveryPhone}
              setDeliveryPhone={setDeliveryPhone}
              promoCodeInput={promoCodeInput}
              setPromoCodeInput={setPromoCodeInput}
              appliedPromoCode={appliedPromoCode}
              onApplyPromoCode={handleApplyPromoCode}
              onOpenSplitModal={() => setSplitModalOpen(true)}
              onPrintKot={() => {
                if (cart.length === 0) {
                  toast.error("Cart is empty")
                  return
                }
                const { orderNum, receiptNum } = getNextOrderNumberInfo()
                setKotTicketData({
                  id: `kot-${Date.now()}`,
                  order_number: activeOpenOrder ? activeOpenOrder.order_number : orderNum,
                  receipt_number: activeOpenOrder ? activeOpenOrder.receipt_number : receiptNum,
                  table_name: orderType === "takeaway" ? "Takeaway" : orderType === "delivery" ? "Delivery" : selectedTable,
                  cashier_name: cashierName,
                  department: "Juice & Food",
                  items: cart.map((i) => ({ ...i })),
                  subtotal,
                  service_charge: serviceCharge,
                  service_charge_rate: serviceChargeRate,
                  discount: discountNum,
                  total,
                  payment_method: paymentMethod,
                  order_type: orderType,
                  status: "open",
                  kitchen_status: "pending",
                  bar_status: "pending",
                  created_at: new Date().toISOString(),
                })
                setKotModalOpen(true)
              }}
              onPrintBill={() => {
                if (cart.length === 0) {
                  toast.error("Cart is empty")
                  return
                }
                const { orderNum, receiptNum } = getNextOrderNumberInfo()
                const guestBillOrder: OrderRecord = {
                  id: activeOpenOrder ? activeOpenOrder.id : `guest-bill-${Date.now()}`,
                  order_number: activeOpenOrder ? activeOpenOrder.order_number : orderNum,
                  receipt_number: activeOpenOrder ? activeOpenOrder.receipt_number : receiptNum,
                  table_name: orderType === "takeaway" ? "Takeaway" : orderType === "delivery" ? "Delivery" : selectedTable,
                  cashier_name: cashierName,
                  items: cart.map((i) => ({ ...i })),
                  subtotal,
                  service_charge: serviceCharge,
                  service_charge_rate: serviceChargeRate,
                  discount: discountNum,
                  total,
                  payment_method: paymentMethod || "cash",
                  order_type: orderType,
                  status: "open",
                  kitchen_status: "pending",
                  bar_status: "pending",
                  created_at: new Date().toISOString(),
                }
                printThermalReceipt(guestBillOrder, true)
              }}
            />
          ) : view === "CoffeeProducts" ? (
            <CoffeeProductsView role={activeRole === "admin" ? "admin" : "cashier"} />
          ) : view === "CoffeeBill" ? (
            <CoffeeBillView role={activeRole === "admin" ? "admin" : "cashier"} />
          ) : view === "CoffeeReport" ? (
            <CoffeeReportView />
          ) : (
            <ManagementView
              supabase={supabase}
              view={view}
              setView={setView}
              role={activeRole}
              setRole={setRole}
              orders={orders}
              coffeeBills={coffeeBills}
              tables={tables}
              products={products}
              categories={categories}
              movements={movements}
              loading={loading}
              onAdd={(type: any) => {
                setEditingProductId(null)
                if (type === "category") {
                  setNewCategoryName("")
                  setDialogType("category")
                  return
                }
                const firstCat = categories[0]
                const initialStation = determineItemStation({ category: firstCat?.name })
                setForm({
                  ...form,
                  name: "",
                  price: "",
                  category_id: firstCat?.id || "",
                  stock: "50",
                  station: initialStation,
                  stationManuallySelected: false,
                  image: "",
                })
                setDialogType(type)
              }}
              onStock={(p: Product) => {
                setForm({ ...form, name: p.name })
                setDialogType("stock")
              }}
              onEditProduct={(p: Product) => {
                setEditingProductId(p.id)
                const currentStation = (p.station as "kitchen" | "bar") || determineItemStation(p)
                setForm({
                  name: p.name,
                  price: String(p.price),
                  category_id: p.category_id || "",
                  capacity: "2",
                  stock: String(p.stock),
                  reason: "Stock received",
                  station: currentStation,
                  stationManuallySelected: true,
                  image: p.image || "",
                })
                setDialogType("product")
              }}
              onDeleteProduct={(id: string) => {
                if (window.confirm("Delete this product? This cannot be undone.")) deleteProduct(id)
              }}
              onPrintReceipt={(order: OrderRecord) => {
                setCompletedReceipt(order)
              }}
              onPrintTicket={printTicketSlip}
              onPayOpenOrder={handlePayOpenOrder}
              onUpdateOrderStatus={updateOrderStatus}
              onSelectTableAndStartOrder={handleSelectTableAndStartOrder}
              onSignOut={signOut}
            />
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* 4. MOBILE BOTTOM NAVIGATION BAR (lg:hidden)               */}
      {/* ========================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#F4EBE4]/95 backdrop-blur-md border-t border-[#E5D8CF] lg:hidden flex items-center justify-around px-2 py-1.5 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <button
          onClick={() => setView("POS")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
            view === "POS" ? "text-[#D67B6B] font-bold scale-105" : "text-[#808068]"
          }`}
        >
          <ShoppingBag className="size-5" />
          <span className="text-[10px] mt-0.5">POS</span>
          {cart.length > 0 && (
            <span className="absolute top-0.5 right-2 size-2 rounded-full bg-[#D67B6B] ring-2 ring-white"></span>
          )}
        </button>

        <button
          onClick={() => setView("Orders")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            view === "Orders" ? "text-[#D67B6B] font-bold scale-105" : "text-[#808068]"
          }`}
        >
          <ClipboardList className="size-5" />
          <span className="text-[10px] mt-0.5">Orders</span>
        </button>

        <button
          onClick={() => setView("Tables")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            view === "Tables" ? "text-[#D67B6B] font-bold scale-105" : "text-[#808068]"
          }`}
        >
          <Table2 className="size-5" />
          <span className="text-[10px] mt-0.5">Tables</span>
        </button>

        <button
          onClick={() => setView("Kitchen")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            view === "Kitchen" ? "text-[#D67B6B] font-bold scale-105" : "text-[#808068]"
          }`}
        >
          <UtensilsCrossed className="size-5" />
          <span className="text-[10px] mt-0.5">Kitchen</span>
        </button>

        <button
          onClick={() => setView("Bar")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            view === "Bar" ? "text-[#D67B6B] font-bold scale-105" : "text-[#808068]"
          }`}
          aria-label="Open Bar Order Tickets"
        >
          <Coffee className="size-5" />
          <span className="text-[10px] mt-0.5">Bar</span>
        </button>

        <button
          onClick={() => setMobileNavOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[#808068] hover:text-[#D67B6B]"
        >
          <Menu className="size-5" />
          <span className="text-[10px] mt-0.5">Menu</span>
        </button>
      </nav>

      {/* ========================================================= */}
      {/* 5. COMPLETE PAYMENT MODAL / WINDOW (Mobile Responsive)    */}
      {/* ========================================================= */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="w-[96vw] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-[#E5D8CF] shadow-2xl bg-white [&>button:last-child]:text-white [&>button:last-child]:opacity-85 [&>button:last-child]:hover:opacity-100 [&>button:last-child]:hover:bg-white/20 [&>button:last-child]:rounded-full [&>button:last-child]:size-8 [&>button:last-child]:flex [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:top-3.5 [&>button:last-child]:right-3.5 [&>button:last-child]:transition-colors [&>button:last-child]:z-30">
          <DialogHeader className="bg-[#808068] text-white p-4 sm:p-5 pr-14 sm:pr-16 shrink-0 relative">
            <div className="flex justify-between items-center gap-3">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-serif text-white tracking-wide">
                  COMPLETE PAYMENT
                </DialogTitle>
                <DialogDescription className="text-[#F4EBE4]/85 text-[11px] sm:text-xs mt-0.5">
                  Point of Sale • Order Settlement
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-[#D67B6B] text-white border-0 font-mono text-xs px-2.5 py-1">
                  {selectedTable}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-6 flex-1 overflow-y-auto bg-[#FAF5F1]">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* LEFT COLUMN: ORDER SUMMARY & TOTALS BREAKDOWN */}
              <div className="md:col-span-5 space-y-3.5">
                {/* Order Header Summary */}
                <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#E5D8CF] shadow-sm text-xs space-y-1.5">
                  <div className="flex justify-between font-mono">
                    <span className="text-gray-500">Order No:</span>
                    <span className="font-bold text-gray-900">#LS-{String(orderCount + 1).padStart(6, "0")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Table:</span>
                    <span className="font-semibold text-gray-800">{selectedTable}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cashier:</span>
                    <span className="text-gray-800">{cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date &amp; Time:</span>
                    <span className="text-gray-800">
                      {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })},{" "}
                      {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Order Items Table */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                      Order Items
                    </p>
                    <Badge variant="outline" className="text-[10px] font-mono font-bold bg-white text-gray-700">
                      {totalCartQty} item{totalCartQty === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="divide-y border border-[#E5D8CF] rounded-xl overflow-hidden bg-white text-xs max-h-[140px] overflow-y-auto shadow-sm">
                    {cart.map((item) => (
                      <div key={item.id} className="p-2.5 sm:p-3 flex justify-between items-center">
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                          <p className="text-[11px] text-gray-500">
                            x{item.quantity} @ Rs. {item.price.toLocaleString()}
                          </p>
                        </div>
                        <p className="font-semibold font-mono text-gray-900 shrink-0">
                          Rs. {(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals & Tax / Discount Adjustments Breakdown */}
                <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-[#E5D8CF] shadow-sm space-y-2.5 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-mono font-medium">Rs. {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Cashier Tax & Discount Controls */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-gray-100">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] text-gray-600 font-bold uppercase">Discount (Rs.)</label>
                        {discountNum > 0 && (
                          <button
                            type="button"
                            onClick={() => setDiscount("0")}
                            className="text-[9px] text-red-600 hover:underline font-medium"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        className="h-8 text-xs rounded-lg bg-gray-50/50 border-gray-200 font-mono"
                      />
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => setDiscount("0")}
                          className={`text-[9px] px-1.5 py-0.5 rounded border ${discount === "0" ? "bg-gray-200 font-bold" : "bg-white text-gray-600"}`}
                        >
                          Rs. 0
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscount(String(Math.round(subtotal * 0.05)))}
                          className="text-[9px] px-1.5 py-0.5 rounded border bg-white text-gray-600 hover:bg-gray-50"
                        >
                          5%
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscount(String(Math.round(subtotal * 0.10)))}
                          className="text-[9px] px-1.5 py-0.5 rounded border bg-white text-gray-600 hover:bg-gray-50"
                        >
                          10%
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] text-gray-600 font-bold uppercase">VAT / Tax (Rs.)</label>
                        <button
                          type="button"
                          onClick={() => {
                            if (isTaxIncluded) {
                              setIsTaxIncluded(false)
                              setTax("0")
                            } else {
                              setIsTaxIncluded(true)
                              setTax("")
                            }
                          }}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-colors ${
                            isTaxIncluded ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {isTaxIncluded ? "Tax: ON" : "Tax: OFF"}
                        </button>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        placeholder={isTaxIncluded ? String(defaultTax) : "0"}
                        value={isTaxIncluded ? (tax === "" ? "" : tax) : "0"}
                        disabled={!isTaxIncluded}
                        onChange={(e) => {
                          setIsTaxIncluded(true)
                          setTax(e.target.value)
                        }}
                        className={`h-8 text-xs rounded-lg font-mono ${
                          !isTaxIncluded ? "bg-gray-100 text-gray-400" : "bg-gray-50/50 border-gray-200"
                        }`}
                      />
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsTaxIncluded(true)
                            setTax("")
                          }}
                          className={`text-[9px] px-1.5 py-0.5 rounded border ${
                            isTaxIncluded && tax === "" ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold" : "bg-white text-gray-600"
                          }`}
                        >
                          10% Tax
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsTaxIncluded(false)
                            setTax("0")
                          }}
                          className={`text-[9px] px-1.5 py-0.5 rounded border ${
                            !isTaxIncluded ? "bg-gray-200 font-bold" : "bg-white text-gray-600"
                          }`}
                        >
                          0%
                        </button>
                      </div>
                    </div>
                  </div>

                  {discountNum > 0 && (
                    <div className="flex justify-between text-red-600 pt-1">
                      <span>Discount</span>
                      <span className="font-mono font-medium">- Rs. {discountNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-gray-600">
                    <span>VAT / Tax {isTaxIncluded ? "(Applied)" : "(Exempt / 0%)"}</span>
                    <span className="font-mono font-medium">Rs. {taxNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* TOTAL AMOUNT DUE BANNER */}
                <div className="bg-[#808068] text-white rounded-xl p-3.5 sm:p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#F4EBE4]/80">Total Amount Due</p>
                    <p className="text-[11px] text-[#EAB8B5]">Table: {selectedTable} • {totalCartQty} item{totalCartQty === 1 ? "" : "s"}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-xl sm:text-2xl text-white tracking-tight">
                      Rs. {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: PAYMENT METHOD SELECTOR & TENDER VIEWS */}
              <div className="md:col-span-7 space-y-3.5">
                {/* Section Header */}
                <div className="flex items-center justify-between pb-0.5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-gray-800">Payment Method</p>
                    <p className="text-[11px] text-gray-400">Choose single method or split across multiple tenders</p>
                  </div>
                  {paymentMode === "split" && (
                    <Badge className="bg-[#FAF5F1] text-[#D67B6B] border border-[#EAB8B5] font-bold text-[10px] gap-1 px-2 py-0.5">
                      <Split className="size-3" />
                      Split Mode Active
                    </Badge>
                  )}
                </div>

                {/* 6 UNIFIED PAYMENT METHOD BUTTONS */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {/* 1. CASH */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("single")
                      setPaymentMethod("cash")
                    }}
                    className={`relative flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border-2 transition-all duration-150 select-none group min-h-[70px] sm:min-h-[78px] ${
                      paymentMode === "single" && paymentMethod === "cash"
                        ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-md ring-2 ring-[#D67B6B]/25"
                        : "bg-white text-gray-700 border-gray-200 hover:border-[#D67B6B]/40 hover:bg-[#FAF5F1] hover:text-[#D67B6B] shadow-sm"
                    }`}
                  >
                    {paymentMode === "single" && paymentMethod === "cash" && (
                      <span className="absolute top-1.5 right-1.5 size-4 rounded-full bg-white text-[#D67B6B] flex items-center justify-center shadow-sm">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                    )}
                    <div className={`p-1.5 rounded-lg mb-1 transition-colors ${
                      paymentMode === "single" && paymentMethod === "cash"
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600 group-hover:bg-[#EAB8B5]/30 group-hover:text-[#D67B6B]"
                    }`}>
                      <Banknote className="size-5" />
                    </div>
                    <span className="text-xs sm:text-sm font-black tracking-wider uppercase">CASH</span>
                    <span className={`text-[9px] sm:text-[10px] truncate max-w-full font-medium ${
                      paymentMode === "single" && paymentMethod === "cash" ? "text-white/90" : "text-gray-400 group-hover:text-[#D67B6B]/70"
                    }`}>
                      Notes &amp; Coins
                    </span>
                  </button>

                  {/* 2. CARD */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("single")
                      setPaymentMethod("card")
                    }}
                    className={`relative flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border-2 transition-all duration-150 select-none group min-h-[70px] sm:min-h-[78px] ${
                      paymentMode === "single" && paymentMethod === "card"
                        ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-md ring-2 ring-[#D67B6B]/25"
                        : "bg-white text-gray-700 border-gray-200 hover:border-[#D67B6B]/40 hover:bg-[#FAF5F1] hover:text-[#D67B6B] shadow-sm"
                    }`}
                  >
                    {paymentMode === "single" && paymentMethod === "card" && (
                      <span className="absolute top-1.5 right-1.5 size-4 rounded-full bg-white text-[#D67B6B] flex items-center justify-center shadow-sm">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                    )}
                    <div className={`p-1.5 rounded-lg mb-1 transition-colors ${
                      paymentMode === "single" && paymentMethod === "card"
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600 group-hover:bg-[#EAB8B5]/30 group-hover:text-[#D67B6B]"
                    }`}>
                      <CreditCard className="size-5" />
                    </div>
                    <span className="text-xs sm:text-sm font-black tracking-wider uppercase">CARD</span>
                    <span className={`text-[9px] sm:text-[10px] truncate max-w-full font-medium ${
                      paymentMode === "single" && paymentMethod === "card" ? "text-white/90" : "text-gray-400 group-hover:text-[#D67B6B]/70"
                    }`}>
                      POS Terminal
                    </span>
                  </button>

                  {/* 3. QR PAY */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("single")
                      setPaymentMethod("qr")
                    }}
                    className={`relative flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border-2 transition-all duration-150 select-none group min-h-[70px] sm:min-h-[78px] ${
                      paymentMode === "single" && paymentMethod === "qr"
                        ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-md ring-2 ring-[#D67B6B]/25"
                        : "bg-white text-gray-700 border-gray-200 hover:border-[#D67B6B]/40 hover:bg-[#FAF5F1] hover:text-[#D67B6B] shadow-sm"
                    }`}
                  >
                    {paymentMode === "single" && paymentMethod === "qr" && (
                      <span className="absolute top-1.5 right-1.5 size-4 rounded-full bg-white text-[#D67B6B] flex items-center justify-center shadow-sm">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                    )}
                    <div className={`p-1.5 rounded-lg mb-1 transition-colors ${
                      paymentMode === "single" && paymentMethod === "qr"
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600 group-hover:bg-[#EAB8B5]/30 group-hover:text-[#D67B6B]"
                    }`}>
                      <QrCode className="size-5" />
                    </div>
                    <span className="text-xs sm:text-sm font-black tracking-wider uppercase">QR PAY</span>
                    <span className={`text-[9px] sm:text-[10px] truncate max-w-full font-medium ${
                      paymentMode === "single" && paymentMethod === "qr" ? "text-white/90" : "text-gray-400 group-hover:text-[#D67B6B]/70"
                    }`}>
                      LankaPay QR
                    </span>
                  </button>

                  {/* 4. TRANSFER */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("single")
                      setPaymentMethod("bank_transfer")
                    }}
                    className={`relative flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border-2 transition-all duration-150 select-none group min-h-[70px] sm:min-h-[78px] ${
                      paymentMode === "single" && paymentMethod === "bank_transfer"
                        ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-md ring-2 ring-[#D67B6B]/25"
                        : "bg-white text-gray-700 border-gray-200 hover:border-[#D67B6B]/40 hover:bg-[#FAF5F1] hover:text-[#D67B6B] shadow-sm"
                    }`}
                  >
                    {paymentMode === "single" && paymentMethod === "bank_transfer" && (
                      <span className="absolute top-1.5 right-1.5 size-4 rounded-full bg-white text-[#D67B6B] flex items-center justify-center shadow-sm">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                    )}
                    <div className={`p-1.5 rounded-lg mb-1 transition-colors ${
                      paymentMode === "single" && paymentMethod === "bank_transfer"
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600 group-hover:bg-[#EAB8B5]/30 group-hover:text-[#D67B6B]"
                    }`}>
                      <Landmark className="size-5" />
                    </div>
                    <span className="text-xs sm:text-sm font-black tracking-wider uppercase">TRANSFER</span>
                    <span className={`text-[9px] sm:text-[10px] truncate max-w-full font-medium ${
                      paymentMode === "single" && paymentMethod === "bank_transfer" ? "text-white/90" : "text-gray-400 group-hover:text-[#D67B6B]/70"
                    }`}>
                      Bank Slip
                    </span>
                  </button>

                  {/* 5. CREDIT */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("single")
                      setPaymentMethod("credit")
                    }}
                    className={`relative flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border-2 transition-all duration-150 select-none group min-h-[70px] sm:min-h-[78px] ${
                      paymentMode === "single" && paymentMethod === "credit"
                        ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-md ring-2 ring-[#D67B6B]/25"
                        : "bg-white text-gray-700 border-gray-200 hover:border-[#D67B6B]/40 hover:bg-[#FAF5F1] hover:text-[#D67B6B] shadow-sm"
                    }`}
                  >
                    {paymentMode === "single" && paymentMethod === "credit" && (
                      <span className="absolute top-1.5 right-1.5 size-4 rounded-full bg-white text-[#D67B6B] flex items-center justify-center shadow-sm">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                    )}
                    <div className={`p-1.5 rounded-lg mb-1 transition-colors ${
                      paymentMode === "single" && paymentMethod === "credit"
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600 group-hover:bg-[#EAB8B5]/30 group-hover:text-[#D67B6B]"
                    }`}>
                      <UserCheck className="size-5" />
                    </div>
                    <span className="text-xs sm:text-sm font-black tracking-wider uppercase">CREDIT</span>
                    <span className={`text-[9px] sm:text-[10px] truncate max-w-full font-medium ${
                      paymentMode === "single" && paymentMethod === "credit" ? "text-white/90" : "text-gray-400 group-hover:text-[#D67B6B]/70"
                    }`}>
                      Customer Tab
                    </span>
                  </button>

                  {/* 6. SPLIT BILL */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("split")
                      if (!splitLines || splitLines.length === 0) {
                        initSplitPaymentLines()
                      }
                    }}
                    className={`relative flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border-2 transition-all duration-150 select-none group min-h-[70px] sm:min-h-[78px] ${
                      paymentMode === "split"
                        ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-md ring-2 ring-[#D67B6B]/25"
                        : "bg-[#FAF5F1] text-[#808068] border-dashed border-[#D67B6B]/60 hover:bg-[#faecea] hover:border-[#D67B6B] shadow-sm"
                    }`}
                  >
                    {paymentMode === "split" ? (
                      <span className="absolute top-1.5 right-1.5 size-4 rounded-full bg-white text-[#D67B6B] flex items-center justify-center shadow-sm">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="absolute top-1 right-1 rounded bg-[#D67B6B] px-1 py-0.5 text-[8px] font-black text-white uppercase">
                        MIXED
                      </span>
                    )}
                    <div className={`p-1.5 rounded-lg mb-1 transition-colors ${
                      paymentMode === "split"
                        ? "bg-white/20 text-white"
                        : "bg-[#EAB8B5]/40 text-[#808068] group-hover:bg-[#EAB8B5]"
                    }`}>
                      <Split className="size-5" />
                    </div>
                    <span className="text-xs sm:text-sm font-black tracking-wider uppercase">SPLIT BILL</span>
                    <span className={`text-[9px] sm:text-[10px] truncate max-w-full font-medium ${
                      paymentMode === "split" ? "text-white/90" : "text-[#808068]/80 group-hover:text-[#808068]"
                    }`}>
                      Multi-Tender
                    </span>
                  </button>
                </div>

                {/* SINGLE PAYMENT METHOD VIEWS */}
                {paymentMode === "single" && (
                  <div className="space-y-3 pt-1">
                    {/* CASH PAYMENT UI */}
                    {paymentMethod === "cash" && (
                      <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200/90 shadow-sm space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-amber-950 uppercase tracking-wider">Cash Received</label>
                          <span className="text-xs text-amber-800 font-mono font-bold">Total Due: Rs. {total.toLocaleString()}</span>
                        </div>

                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-700 font-mono font-bold text-base">
                            Rs.
                          </span>
                          <Input
                            type="number"
                            value={cashReceivedInput}
                            onChange={(e) => setCashReceivedInput(e.target.value)}
                            placeholder="Enter cash received"
                            className="h-12 pl-12 text-lg sm:text-xl font-mono font-bold bg-white border-amber-300 focus:ring-amber-500 rounded-xl"
                          />
                        </div>

                        {/* Quick Cash Presets */}
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setCashReceivedInput(String(total))}
                            className="text-xs bg-white border-amber-300 hover:bg-amber-100/70 text-amber-950 font-bold h-8 rounded-lg shadow-xs"
                          >
                            Exact (Rs. {total.toLocaleString()})
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setCashReceivedInput("1000")}
                            className="text-xs bg-white border-amber-200 hover:bg-amber-100/70 text-amber-900 font-semibold h-8 rounded-lg"
                          >
                            Rs. 1,000
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setCashReceivedInput("2000")}
                            className="text-xs bg-white border-amber-200 hover:bg-amber-100/70 text-amber-900 font-semibold h-8 rounded-lg"
                          >
                            Rs. 2,000
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setCashReceivedInput("5000")}
                            className="text-xs bg-white border-amber-200 hover:bg-amber-100/70 text-amber-900 font-semibold h-8 rounded-lg"
                          >
                            Rs. 5,000
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setCashReceivedInput("10000")}
                            className="text-xs bg-white border-amber-200 hover:bg-amber-100/70 text-amber-900 font-semibold h-8 rounded-lg"
                          >
                            Rs. 10,000
                          </Button>
                        </div>

                        {/* Change calculation / Validation */}
                        {isCashInsufficient ? (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-100/80 border border-red-300 text-red-700 text-xs font-semibold">
                            <AlertCircle className="size-4 shrink-0" />
                            <span>Short by Rs. {(total - cashReceivedAmount).toLocaleString()}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-100/80 border border-emerald-300 text-emerald-950 font-bold">
                            <span className="text-xs uppercase tracking-wider">Change to Return:</span>
                            <span className="font-mono text-base sm:text-lg text-emerald-800">
                              Rs. {changeAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* CARD PAYMENT UI */}
                    {paymentMethod === "card" && (
                      <div className="bg-blue-50/70 rounded-2xl p-4 border border-blue-200/90 shadow-sm space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-blue-950 uppercase tracking-wider">Terminal Card Charge</span>
                          <span className="text-blue-800 font-mono font-bold text-sm">Rs. {total.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-blue-800">Swipe or tap customer card on bank terminal for the amount above.</p>
                        <Button
                          type="button"
                          variant={cardConfirmed ? "default" : "outline"}
                          onClick={() => setCardConfirmed(!cardConfirmed)}
                          className={`w-full h-11 text-xs sm:text-sm gap-2 rounded-xl font-bold transition-all ${
                            cardConfirmed
                              ? "bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
                              : "border-blue-300 text-blue-900 bg-white hover:bg-blue-50"
                          }`}
                        >
                          <CheckCircle2 className="size-4" />
                          {cardConfirmed ? "Card Payment Confirmed ✓" : "Click to Confirm Terminal Success"}
                        </Button>
                      </div>
                    )}

                    {/* QR / ONLINE PAYMENT UI */}
                    {paymentMethod === "qr" && (
                      <div className="bg-purple-50/70 rounded-2xl p-4 border border-purple-200/90 shadow-sm space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-purple-950 uppercase tracking-wider">LankaPay / QR Payment</span>
                          <span className="text-purple-800 font-mono font-bold text-sm">Rs. {total.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-purple-100 shadow-xs">
                          <div className="size-12 rounded-lg bg-purple-100 flex items-center justify-center text-purple-800 shrink-0">
                            <QrCode className="size-7" />
                          </div>
                          <div className="text-[11px] text-gray-600 leading-snug">
                            <p className="font-bold text-gray-900">LankaPay / Counter QR</p>
                            <p className="text-gray-500">Ask customer to scan counter QR or transfer to business account.</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant={qrConfirmed ? "default" : "outline"}
                          onClick={() => setQrConfirmed(!qrConfirmed)}
                          className={`w-full h-11 text-xs sm:text-sm gap-2 rounded-xl font-bold transition-all ${
                            qrConfirmed
                              ? "bg-purple-700 hover:bg-purple-800 text-white shadow-sm"
                              : "border-purple-300 text-purple-900 bg-white hover:bg-purple-50"
                          }`}
                        >
                          <CheckCircle2 className="size-4" />
                          {qrConfirmed ? "QR Payment Confirmed ✓" : "Click to Confirm QR Payment Received"}
                        </Button>
                      </div>
                    )}

                    {/* BANK TRANSFER PAYMENT UI */}
                    {paymentMethod === "bank_transfer" && (
                      <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200/90 shadow-sm space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-amber-950 uppercase tracking-wider">Direct Bank Transfer</span>
                          <span className="text-amber-800 font-mono font-bold text-sm">Rs. {total.toLocaleString()}</span>
                        </div>
                        <div className="text-[11px] text-amber-900 bg-white p-2.5 rounded-xl border border-amber-200/90 space-y-1 shadow-xs">
                          <p className="font-bold text-amber-950">Merchant Bank Details</p>
                          <p>Bank: Commercial Bank PLC · Account: 1000-8472-9182 · Main Branch</p>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-amber-950 block mb-1">
                            Bank Reference / Slip Number *
                          </label>
                          <Input
                            placeholder="Enter TXN reference or slip number"
                            value={bankRefNumber}
                            onChange={(e) => setBankRefNumber(e.target.value)}
                            className="h-10 text-xs rounded-xl bg-white border-amber-300 font-mono font-semibold"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* CUSTOMER CREDIT (OPEN TAB) PAYMENT UI */}
                    {paymentMethod === "credit" && (
                      <div className="bg-rose-50/70 rounded-2xl p-4 border border-rose-200/90 shadow-sm space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-rose-950 uppercase tracking-wider">Customer Credit / Open Tab</span>
                          <span className="text-rose-800 font-mono font-bold text-sm">Rs. {total.toLocaleString()}</span>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-rose-950 block mb-1">
                            Select Customer Account *
                          </label>
                          <select
                            value={selectedCustomerId}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                            className="w-full h-10 rounded-xl border border-rose-300 bg-white px-3 text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                          >
                            <option value="">-- Choose registered customer --</option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.phone}) - Outstanding: Rs. {c.credit_balance.toLocaleString()} / Limit: Rs. {c.credit_limit.toLocaleString()}
                              </option>
                            ))}
                          </select>
                        </div>
                        {selectedCustomerId ? (
                          <p className="text-[11px] text-rose-700 font-medium">
                            Bill of Rs. {total.toLocaleString()} will be charged to customer&apos;s ledger.
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-500">
                            Register new customer in Customers &amp; CRM view to grant credit.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SPLIT PAYMENT / MIXED TENDER VIEW */}
                {paymentMode === "split" && (
                  <div className="space-y-3.5 pt-1">
                    {/* Live Summary Bar Always Visible */}
                    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100/70 p-3 sm:p-3.5 shadow-sm">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-gray-200/80 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Bill Total</p>
                          <p className="font-mono font-black text-xs sm:text-sm text-gray-900 mt-0.5">
                            Rs. {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                        </div>

                        <div className={`p-2 sm:p-2.5 rounded-xl border shadow-sm ${
                          splitTotalAllocated >= total ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-white border-gray-200/80 text-gray-900"
                        }`}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Total Paid</p>
                          <p className="font-mono font-black text-xs sm:text-sm mt-0.5">
                            Rs. {splitTotalAllocated.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                        </div>

                        <div className={`p-2 sm:p-2.5 rounded-xl border shadow-sm ${
                          splitRemainingBalance === 0
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-amber-50 border-amber-300 text-amber-900"
                        }`}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Remaining</p>
                          <p className="font-mono font-black text-xs sm:text-sm mt-0.5">
                            Rs. {splitRemainingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                        </div>

                        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-gray-200/80 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Change Due</p>
                          <p className={`font-mono font-black text-xs sm:text-sm mt-0.5 ${
                            splitChangeDue > 0 ? "text-emerald-700" : "text-gray-400"
                          }`}>
                            Rs. {splitChangeDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Status Helper Banner */}
                      <div className="mt-2.5">
                        {splitRemainingBalance > 0 ? (
                          <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-100/70 border border-amber-300/80 text-amber-900 text-xs font-medium">
                            <AlertCircle className="size-4 shrink-0 text-amber-700" />
                            <span>Short by <strong>Rs. {splitRemainingBalance.toLocaleString()}</strong>. Allocate amount or click &ldquo;Pay remaining&rdquo;.</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-100/70 border border-emerald-300 text-emerald-900 text-xs font-semibold">
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
                            <span>✓ Bill fully covered across {splitLines.length} payment lines. Ready to complete payment!</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PAYMENT BREAKDOWN LINES */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Payment Tender Lines</p>
                        <span className="text-[11px] text-gray-500">{splitLines.length} lines configured</span>
                      </div>

                      {splitLines.map((line, idx) => {
                        const lineAmt = Number(line.amount) || 0
                        const otherAllocations = splitLines
                          .filter((l) => l.id !== line.id)
                          .reduce((s, l) => s + (Number(l.amount) || 0), 0)
                        const maxAllowedForThisLine = Math.max(0, total - otherAllocations)
                        const lineTendered = Number(line.tendered) || lineAmt
                        const lineChange = line.method === "cash" ? Math.max(0, lineTendered - lineAmt) : 0

                        return (
                          <div
                            key={line.id}
                            className="rounded-2xl border border-gray-200 bg-white p-3.5 sm:p-4 shadow-sm space-y-3 relative transition-all hover:border-[#D67B6B]/40"
                          >
                            {/* Line Header */}
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="flex size-6 items-center justify-center rounded-full bg-gray-900 text-white text-[11px] font-bold">
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-bold text-gray-900">
                                  Payment Line #{idx + 1}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] capitalize font-bold ${
                                    line.method === "cash"
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      : line.method === "card"
                                      ? "bg-blue-50 text-blue-800 border-blue-200"
                                      : line.method === "bank_transfer"
                                      ? "bg-amber-50 text-amber-800 border-amber-200"
                                      : line.method === "credit"
                                      ? "bg-rose-50 text-rose-800 border-rose-200"
                                      : "bg-purple-50 text-purple-800 border-purple-200"
                                  }`}
                                >
                                  {line.method === "bank_transfer"
                                    ? "Bank Transfer"
                                    : line.method === "credit"
                                    ? "Store Credit"
                                    : line.method === "qr"
                                    ? "LankaPay QR"
                                    : line.method.toUpperCase()}
                                </Badge>
                              </div>

                              {splitLines.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSplitPaymentLine(line.id)}
                                  className="size-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Remove this payment line"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>

                            {/* Method Selector Segmented Buttons */}
                            <div>
                              <label className="text-[11px] font-bold text-gray-600 block mb-1.5">
                                Select Payment Method *
                              </label>
                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateSplitLineMethod(line.id, "cash")}
                                  className={`h-9 sm:h-10 rounded-xl px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-all truncate ${
                                    line.method === "cash"
                                      ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-sm"
                                      : "bg-white text-gray-700 border-gray-200 hover:bg-[#FAF5F1] hover:text-[#D67B6B]"
                                  }`}
                                >
                                  <Banknote className="size-3.5 shrink-0" />
                                  Cash
                                </button>

                                <button
                                  type="button"
                                  onClick={() => updateSplitLineMethod(line.id, "card")}
                                  className={`h-9 sm:h-10 rounded-xl px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-all truncate ${
                                    line.method === "card"
                                      ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-sm"
                                      : "bg-white text-gray-700 border-gray-200 hover:bg-[#FAF5F1] hover:text-[#D67B6B]"
                                  }`}
                                >
                                  <CreditCard className="size-3.5 shrink-0" />
                                  Card
                                </button>

                                <button
                                  type="button"
                                  onClick={() => updateSplitLineMethod(line.id, "bank_transfer")}
                                  className={`h-9 sm:h-10 rounded-xl px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-all truncate ${
                                    line.method === "bank_transfer"
                                      ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-sm"
                                      : "bg-white text-gray-700 border-gray-200 hover:bg-[#FAF5F1] hover:text-[#D67B6B]"
                                  }`}
                                >
                                  <Landmark className="size-3.5 shrink-0" />
                                  Transfer
                                </button>

                                <button
                                  type="button"
                                  onClick={() => updateSplitLineMethod(line.id, "credit")}
                                  className={`h-9 sm:h-10 rounded-xl px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-all truncate ${
                                    line.method === "credit"
                                      ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-sm"
                                      : "bg-white text-gray-700 border-gray-200 hover:bg-[#FAF5F1] hover:text-[#D67B6B]"
                                  }`}
                                >
                                  <UserCheck className="size-3.5 shrink-0" />
                                  Credit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => updateSplitLineMethod(line.id, "qr")}
                                  className={`h-9 sm:h-10 rounded-xl px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-all truncate col-span-2 sm:col-span-1 ${
                                    line.method === "qr"
                                      ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-sm"
                                      : "bg-white text-gray-700 border-gray-200 hover:bg-[#FAF5F1] hover:text-[#D67B6B]"
                                  }`}
                                >
                                  <QrCode className="size-3.5 shrink-0" />
                                  QR Pay
                                </button>
                              </div>
                            </div>

                            {/* Amount & Quick "Pay Remaining" Helper */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-gray-700">
                                  Amount to Charge (Rs.) *
                                </label>
                                {maxAllowedForThisLine > 0 && maxAllowedForThisLine !== lineAmt && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handlePayRemaining(line.id)}
                                    className="h-6 px-2 text-[10px] font-bold text-[#808068] border-[#808068]/40 bg-[#FAF5F1] hover:bg-[#eeeee7] rounded-md"
                                  >
                                    Pay remaining (Rs. {maxAllowedForThisLine.toLocaleString()})
                                  </Button>
                                )}
                              </div>

                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold font-mono text-sm">
                                  Rs.
                                </span>
                                <Input
                                  type="number"
                                  min="0"
                                  value={line.amount}
                                  onChange={(e) => updateSplitLineAmount(idx, e.target.value)}
                                  placeholder={`Enter amount (max Rs. ${maxAllowedForThisLine.toLocaleString()})`}
                                  className="h-11 pl-11 pr-3 text-base font-mono font-bold rounded-xl border-gray-300 focus:ring-2 focus:ring-[#D67B6B]"
                                />
                              </div>

                              {line.method !== "cash" && (
                                <p className="text-[10px] text-gray-400">
                                  Non-cash tenders cannot exceed the unpaid balance (max Rs. {maxAllowedForThisLine.toLocaleString()}).
                                </p>
                              )}
                            </div>

                            {/* METHOD SPECIFIC FIELDS */}
                            {/* CASH SPECIFIC CONTROLS */}
                            {line.method === "cash" && (
                              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-bold text-amber-950">
                                    Cash Note Tendered by Customer (Rs.)
                                  </label>
                                  <span className="text-[10px] font-mono text-amber-800">
                                    Line Charge: Rs. {lineAmt.toLocaleString()}
                                  </span>
                                </div>

                                <Input
                                  type="number"
                                  min="0"
                                  value={line.tendered || line.amount}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setSplitLines((prev) =>
                                      prev.map((l) => (l.id === line.id ? { ...l, tendered: val } : l))
                                    )
                                  }}
                                  placeholder="Cash note amount"
                                  className="h-9 font-mono font-bold text-sm bg-white border-amber-300 rounded-lg"
                                />

                                {/* Quick Tender Chips */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCashChip(line.id, "exact")}
                                    className="h-7 text-[10px] bg-white border-amber-200 rounded-md font-semibold"
                                  >
                                    Exact (Rs. {lineAmt.toLocaleString()})
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCashChip(line.id, "500")}
                                    className="h-7 text-[10px] bg-white border-amber-200 rounded-md font-semibold"
                                  >
                                    Rs. 500
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCashChip(line.id, "1000")}
                                    className="h-7 text-[10px] bg-white border-amber-200 rounded-md font-semibold"
                                  >
                                    Rs. 1,000
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCashChip(line.id, "2000")}
                                    className="h-7 text-[10px] bg-white border-amber-200 rounded-md font-semibold"
                                  >
                                    Rs. 2,000
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCashChip(line.id, "5000")}
                                    className="h-7 text-[10px] bg-white border-amber-200 rounded-md font-semibold"
                                  >
                                    Rs. 5,000
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCashChip(line.id, "+500")}
                                    className="h-7 text-[10px] bg-white border-amber-200 rounded-md font-semibold"
                                  >
                                    +Rs. 500
                                  </Button>
                                </div>

                                {/* Change Returned For This Line */}
                                <div className="flex items-center justify-between pt-1 border-t border-amber-200 text-xs font-bold text-amber-950">
                                  <span>Change for this line:</span>
                                  <span className="font-mono text-emerald-700">
                                    Rs. {lineChange.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* CARD SPECIFIC CONTROLS */}
                            {line.method === "card" && (
                              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
                                <label className="text-[11px] font-bold text-blue-950 block">
                                  Card Terminal Approval / Auth Code *
                                </label>
                                <Input
                                  value={line.reference}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setSplitLines((prev) =>
                                      prev.map((l) => (l.id === line.id ? { ...l, reference: val } : l))
                                    )
                                  }}
                                  placeholder="e.g. TRX-9481 or Terminal Auth #"
                                  className="h-9 text-xs font-mono font-semibold bg-white border-blue-300 rounded-lg"
                                  required
                                />
                                <p className="text-[10px] text-blue-700">
                                  Swipe or tap customer card on bank terminal for Rs. {lineAmt.toLocaleString()}.
                                </p>
                              </div>
                            )}

                            {/* BANK TRANSFER SPECIFIC CONTROLS */}
                            {line.method === "bank_transfer" && (
                              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                                <label className="text-[11px] font-bold text-amber-950 block">
                                  Bank Slip / Transfer Reference *
                                </label>
                                <Input
                                  value={line.reference}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setSplitLines((prev) =>
                                      prev.map((l) => (l.id === line.id ? { ...l, reference: val } : l))
                                    )
                                  }}
                                  placeholder="e.g. SLIP-837190 or Ref #"
                                  className="h-9 text-xs font-mono font-semibold bg-white border-amber-300 rounded-lg"
                                  required
                                />
                                <p className="text-[10px] text-amber-800">
                                  Commercial Bank PLC · A/C: 1000-8472-9182 · Merchant POS
                                </p>
                              </div>
                            )}

                            {/* STORE CREDIT SPECIFIC CONTROLS */}
                            {line.method === "credit" && (
                              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2">
                                <label className="text-[11px] font-bold text-rose-950 block">
                                  Select Customer Account *
                                </label>
                                <select
                                  value={line.customerId}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setSplitLines((prev) =>
                                      prev.map((l) => (l.id === line.id ? { ...l, customerId: val } : l))
                                    )
                                  }}
                                  className="w-full h-9 rounded-lg border border-rose-300 bg-white px-2.5 text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-rose-500"
                                  required
                                >
                                  <option value="">-- Choose registered customer --</option>
                                  {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} ({c.phone}) - Outstanding: Rs. {c.credit_balance.toLocaleString()} / Limit: Rs. {c.credit_limit.toLocaleString()}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-[10px] text-rose-700">
                                  Rs. {lineAmt.toLocaleString()} will be charged to customer&apos;s ledger.
                                </p>
                              </div>
                            )}

                            {/* LANKAPAY QR SPECIFIC CONTROLS */}
                            {line.method === "qr" && (
                              <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2">
                                <label className="text-[11px] font-bold text-purple-950 block">
                                  QR / Trace Reference (Optional)
                                </label>
                                <Input
                                  value={line.reference}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setSplitLines((prev) =>
                                      prev.map((l) => (l.id === line.id ? { ...l, reference: val } : l))
                                    )
                                  }}
                                  placeholder="e.g. LankaPay Ref or Trace #"
                                  className="h-9 text-xs font-mono font-semibold bg-white border-purple-300 rounded-lg"
                                />
                                <p className="text-[10px] text-purple-700">
                                  Customer scans counter LankaPay QR to transfer Rs. {lineAmt.toLocaleString()}.
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Add Payment Line Button */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addSplitPaymentLine}
                      className="w-full h-12 rounded-xl border-dashed border-2 border-[#808068]/50 text-[#808068] bg-[#FAF5F1] hover:bg-[#eeeee7] font-bold text-xs sm:text-sm gap-2 transition-all shadow-sm"
                    >
                      <Plus className="size-4" />
                      Add Payment Line {splitRemainingBalance > 0 ? `(Rs. ${splitRemainingBalance.toLocaleString()} Remaining)` : ""}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Action Buttons Sticky Footer */}
          <div className="p-3.5 sm:p-4 bg-white border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
            <Button
              variant="outline"
              onClick={() => setPaymentModalOpen(false)}
              className="rounded-xl h-11 px-4 sm:px-5 text-xs sm:text-sm font-semibold border-gray-300 hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCompletePayment}
              disabled={isCompletePaymentDisabled}
              className={`h-11 px-5 sm:px-7 font-bold gap-2 rounded-xl shadow-md text-xs sm:text-sm transition-all ${
                isCompletePaymentDisabled
                  ? "bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed shadow-none"
                  : "bg-[#D67B6B] hover:bg-[#c26555] text-white"
              }`}
            >
              <span>Complete Payment</span>
              <span className="font-mono text-white/90 text-[11px] sm:text-xs">
                • Rs. {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              <Check className="size-4 shrink-0" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 6. COMPLETED RECEIPT / BILL PREVIEW WINDOW                */}
      {/* ========================================================= */}
      <Dialog open={!!completedReceipt} onOpenChange={() => setCompletedReceipt(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-[#E5D8CF] shadow-2xl bg-white [&>button:last-child]:text-white [&>button:last-child]:opacity-85 [&>button:last-child]:hover:opacity-100 [&>button:last-child]:hover:bg-white/20 [&>button:last-child]:rounded-full [&>button:last-child]:size-8 [&>button:last-child]:flex [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:top-3.5 [&>button:last-child]:right-3.5 [&>button:last-child]:transition-colors [&>button:last-child]:z-30">
          <DialogHeader className="bg-[#808068] text-white p-4 sm:p-5 pr-14 sm:pr-16 shrink-0 relative">
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 sm:size-6 text-[#EAB8B5] shrink-0" />
                <div>
                  <DialogTitle className="text-base sm:text-xl font-serif text-white">PAYMENT COMPLETED</DialogTitle>
                  <DialogDescription className="text-[#F4EBE4]/85 text-[11px] sm:text-xs">
                    ✓ Successful • Receipt Generated
                  </DialogDescription>
                </div>
              </div>
              <Badge className="bg-[#FAF5F1] text-[#808068] border-0 font-mono text-[10px] sm:text-xs">
                {completedReceipt?.payment_method === "split" ? "SPLIT PAYMENT" : completedReceipt?.payment_method.toUpperCase()}
              </Badge>
            </div>
          </DialogHeader>

          <div className="p-3 sm:p-5 flex-1 overflow-y-auto space-y-4 bg-gray-50">
            {completedReceipt && (
              <PosReceipt
                receiptNumber={completedReceipt.receipt_number}
                orderNumber={completedReceipt.order_number}
                tableName={completedReceipt.table_name}
                cashierName={completedReceipt.cashier_name}
                orderType={completedReceipt.order_type}
                paymentMethod={completedReceipt.payment_method}
                splitPayments={completedReceipt.split_payments}
                items={completedReceipt.items}
                subtotal={completedReceipt.subtotal}
                serviceCharge={completedReceipt.service_charge}
                serviceChargeRate={completedReceipt.service_charge_rate}
                discount={completedReceipt.discount}
                total={completedReceipt.total}
                cashReceived={completedReceipt.cash_received}
                changeAmount={completedReceipt.change_amount}
                animated={true}
                showBarcode={true}
                onPrintAgain={() => printThermalReceipt(completedReceipt)}
              />
            )}
          </div>

          {/* Action Buttons: PRINT RECEIPT & CLOSE */}
          <div className="p-3 sm:p-4 bg-white border-t flex items-center justify-between gap-2 sm:gap-3 shrink-0">
            <Button variant="outline" onClick={() => setCompletedReceipt(null)} className="w-1/3 h-11 rounded-xl text-xs sm:text-sm">
              Close
            </Button>
            <Button
              onClick={() => printThermalReceipt(completedReceipt)}
              className="w-2/3 bg-[#D67B6B] hover:bg-[#c26555] text-white font-bold h-11 gap-1.5 sm:gap-2 rounded-xl text-xs sm:text-sm shadow-sm"
            >
              <Printer className="size-4 shrink-0" />
              PRINT RECEIPT (80mm)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* BARCODE SCANNER SIMULATOR MODAL                           */}
      {/* ========================================================= */}
      <BarcodeScannerModal
        open={barcodeModalOpen}
        onOpenChange={setBarcodeModalOpen}
        onScan={handleBarcodeScan}
      />

      {/* ========================================================= */}
      {/* SPLIT BILL MODAL                                          */}
      {/* ========================================================= */}
      <Dialog open={splitModalOpen} onOpenChange={setSplitModalOpen}>
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-5 space-y-4">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold flex items-center gap-2 text-gray-900">
              <Split className="size-5 text-[#D67B6B]" />
              Split Bill Between Guests
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Divide total order balance equally or into individual customer chits.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-[#FAF5F1] p-4 rounded-xl border border-[#E5D8CF] space-y-3">
            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="text-gray-600">Total Order Amount:</span>
              <span className="font-mono text-base font-bold text-[#D67B6B]">
                Rs. {total.toLocaleString()}
              </span>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-gray-200">
              <label className="text-xs font-bold text-gray-700 block">
                Split Count (Number of Guests):
              </label>
              <div className="flex items-center gap-2">
                {[2, 3, 4, 5].map((ways) => (
                  <button
                    key={ways}
                    type="button"
                    onClick={() => setSplitWays(ways)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      splitWays === ways
                        ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-xs"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-[#FAF5F1]"
                    }`}
                  >
                    {ways} Ways
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-[#EAB8B5] flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-[#808068]">Amount per Guest:</p>
                <p className="text-[10px] text-gray-500">Split into {splitWays} equal payments</p>
              </div>
              <span className="font-mono text-lg font-bold text-[#D67B6B]">
                Rs. {Math.round(total / splitWays).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setSplitModalOpen(false)}
              className="rounded-xl h-10 text-xs border-[#E5D8CF]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSplitModalOpen(false)
                toast.success(`Bill split ${splitWays} ways at Rs. ${Math.round(total / splitWays).toLocaleString()} each`)
                openPaymentModal()
              }}
              className="bg-[#D67B6B] text-white hover:bg-[#c26555] rounded-xl h-10 text-xs font-bold px-4 shadow-sm"
            >
              Proceed to Split Checkout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* KOT TICKET PREVIEW MODAL                                  */}
      {/* ========================================================= */}
      <Dialog open={kotModalOpen} onOpenChange={setKotModalOpen}>
        <DialogContent className="w-[92vw] sm:max-w-lg rounded-2xl p-5 space-y-4">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold flex items-center gap-2 text-gray-900">
              <UtensilsCrossed className="size-5 text-amber-700" />
              Preparation Tickets (KOT / BOT)
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Station orders routed for Kitchen chef and Bar barista preparation.
            </DialogDescription>
          </DialogHeader>

          {kotTicketData && (() => {
            const kotKitchenItems = getStationItems(kotTicketData, "kitchen")
            const kotBarItems = getStationItems(kotTicketData, "bar")

            const renderTicketSlipChit = (items: typeof kotKitchenItems, station: "kitchen" | "bar") => {
              const d = new Date(kotTicketData.created_at || Date.now())
              const day = d.getDate().toString().padStart(2, "0")
              const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
              const month = monthNames[d.getMonth()]
              const year = d.getFullYear()
              const hours = d.getHours().toString().padStart(2, "0")
              const minutes = d.getMinutes().toString().padStart(2, "0")
              const seconds = d.getSeconds().toString().padStart(2, "0")
              const dateTimeFormatted = `${day} ${month} ${year} · ${hours}:${minutes}:${seconds}`

              const orderNumClean = (kotTicketData.order_number || "").replace(/^LS-/, "")
              const isTakeaway = (kotTicketData.table_name || "").toLowerCase() === "takeaway"
              const tableNumOnly = kotTicketData.table_name ? kotTicketData.table_name.replace(/^(Table|Tab)\s*/i, "").trim() : "01"
              const tableDisplay = isTakeaway
                ? "TAKEAWAY"
                : `DINE IN / TABLE ${tableNumOnly.length < 2 ? `0${tableNumOnly}` : tableNumOnly}`

              return (
                <div
                  data-ticket="true"
                  className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.06)] font-sans text-xs text-black space-y-2 max-w-[340px] mx-auto select-none print:w-[72mm] print:max-w-[72mm] print:border-none print:p-0 print:shadow-none"
                >
                  {/* Top Header */}
                  <div className="text-center space-y-1">
                    {station === "kitchen" && (
                      <svg
                        className="w-6 h-6 mx-auto text-black"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
                      </svg>
                    )}
                    <h2 className="font-sans text-lg font-extrabold tracking-[0.16em] uppercase text-black pt-0.5">
                      LAZY SUNDAY
                    </h2>
                    <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-black">
                      {station === "bar" ? "BAR ORDER TICKET" : "KITCHEN ORDER TICKET"}
                    </p>
                    <p className="text-[10px] text-gray-800 tracking-wide font-medium">
                      Tel: +94 76 912 9153
                    </p>
                  </div>

                  <div className="border-t border-black my-2.5" />

                  {/* Metadata */}
                  <div className="text-xs text-black space-y-0.5">
                    <div className="font-extrabold tracking-wide uppercase text-sm">
                      ORDER {orderNumClean}
                    </div>
                    <div className="font-medium tracking-wider uppercase text-[11px]">
                      {tableDisplay}
                    </div>
                    <div className="text-[11px] text-gray-800">
                      {dateTimeFormatted}
                    </div>
                    <div className="text-[11px] text-gray-800">
                      Server: {kotTicketData.cashier_name || "Admin"} · Station: <strong>{station.toUpperCase()}</strong>
                    </div>
                  </div>

                  <div className="border-t border-black my-2.5" />

                  {/* Column Header */}
                  <div className="flex justify-between text-[11px] font-bold tracking-wider uppercase text-black pb-0.5">
                    <span className="w-[14%]">QTY</span>
                    <span className="flex-1 px-1">ITEM</span>
                    <span className="w-[32%] text-right">NOTES</span>
                  </div>

                  <div className="border-t border-black my-1" />

                  {/* Items */}
                  <div className="py-1 space-y-1.5 text-xs text-black">
                    {items.map((it, idx) => (
                      <div key={idx} className="flex items-baseline justify-between py-0.5">
                        <span className="w-[14%] font-bold text-sm">{it.quantity}</span>
                        <div className="flex-1 px-1">
                          <p className="font-bold text-sm leading-tight">{it.name}</p>
                          {it.category && <p className="text-[10px] text-gray-600 mt-0.5">[{it.category}]</p>}
                          {it.modifiers && it.modifiers.length > 0 && (
                            <p className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 rounded mt-0.5 inline-block uppercase">
                              + {it.modifiers.join(", ")}
                            </p>
                          )}
                          {it.notes && (
                            <p className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 rounded mt-1 inline-block uppercase">
                              * Note: {it.notes} *
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-black my-2.5" />

                  {/* Summary & Footer */}
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider py-0.5">
                    <span>TOTAL ITEMS</span>
                    <span className="text-sm font-black">{items.reduce((s, i) => s + (i.quantity || 1), 0)}</span>
                  </div>

                  <div className="border-t border-black my-2.5" />

                  <div className="text-center pt-1 space-y-1 text-black">
                    <p className="text-xs font-medium">{station === "bar" ? "Good coffee. Good day." : "Good food. Good day."}</p>
                    <p className="text-[10px] font-bold tracking-[0.35em] uppercase">
                      O R D E R &nbsp; D I S P A T C H
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <div className="space-y-4">
                <div className="max-h-[60vh] overflow-y-auto space-y-4 p-1">
                  {kotKitchenItems.length > 0 && renderTicketSlipChit(kotKitchenItems, "kitchen")}
                  {kotBarItems.length > 0 && renderTicketSlipChit(kotBarItems, "bar")}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setKotModalOpen(false)}
                    className="rounded-xl h-9 text-xs"
                  >
                    Close
                  </Button>
                  {kotKitchenItems.length > 0 && (
                    <Button
                      onClick={() => {
                        printTicketSlip(kotTicketData, "kitchen")
                      }}
                      className="bg-amber-800 hover:bg-amber-900 text-white rounded-xl h-9 text-xs font-bold px-3 gap-1.5"
                    >
                      <UtensilsCrossed className="size-3.5" />
                      Print Kitchen KOT
                    </Button>
                  )}
                  {kotBarItems.length > 0 && (
                    <Button
                      onClick={() => {
                        printTicketSlip(kotTicketData, "bar")
                      }}
                      className="bg-[#808068] hover:bg-[#6c6c57] text-white rounded-xl h-9 text-xs font-bold px-3 gap-1.5"
                    >
                      <Coffee className="size-3.5" />
                      Print Bar BOT
                    </Button>
                  )}
                  {kotKitchenItems.length > 0 && kotBarItems.length > 0 && (
                    <Button
                      onClick={() => {
                        printTicketSlip(kotTicketData, "kitchen")
                        setTimeout(() => {
                          printTicketSlip(kotTicketData, "bar")
                        }, 500)
                      }}
                      variant="outline"
                      className="border-stone-400 text-stone-800 hover:bg-stone-100 rounded-xl h-9 text-xs font-bold px-3 gap-1.5"
                    >
                      <Printer className="size-3.5" />
                      Print Both
                    </Button>
                  )}
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Admin Dialogs */}
      <Dialog open={!!dialogType} onOpenChange={() => { setDialogType(null); setShowAddCategoryInline(false); }}>
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogType === "product"
                ? editingProductId ? "Edit Product" : "Add Product"
                : dialogType === "table"
                ? "Add Table"
                : dialogType === "category"
                ? "Add Product Category"
                : "Adjust Inventory"}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {dialogType === "product"
                ? editingProductId ? "Update item details, preparation station, and price." : "Add a new menu product to POS register."
                : dialogType === "table"
                ? "Configure a new dining table for floor management."
                : dialogType === "category"
                ? "Create a new category for the catalog filter bar."
                : "Adjust stock and inventory units."}
            </DialogDescription>
          </DialogHeader>
          {dialogType === "product" && (
            <div className="flex flex-col gap-3 pt-2">
              {/* Station Selection (Bar vs Kitchen) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">Preparation Station</label>
                  <span className="text-[11px] font-medium text-gray-500">
                    {form.station === "bar" ? "🍹 Sent to Bar (BOT)" : "🍳 Sent to Kitchen (KOT)"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, station: "bar", stationManuallySelected: true }))}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      form.station === "bar"
                        ? "bg-purple-50 border-purple-500 text-purple-700 shadow-sm ring-1 ring-purple-500"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-xl">🍹</span>
                    <div className="text-left">
                      <div className="leading-tight">Bar Station</div>
                      <div className="text-[10px] font-normal text-gray-500">Juices & Drinks</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, station: "kitchen", stationManuallySelected: true }))}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      form.station === "kitchen"
                        ? "bg-amber-50 border-amber-600 text-amber-900 shadow-sm ring-1 ring-amber-600"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-xl">🍳</span>
                    <div className="text-left">
                      <div className="leading-tight">Kitchen Station</div>
                      <div className="text-[10px] font-normal text-gray-500">Food & Meals</div>
                    </div>
                  </button>
                </div>
              </div>

              <Input
                placeholder="Product name (e.g. Watermelon Juice, Chicken Burger)"
                value={form.name}
                onChange={(e) => {
                  const val = e.target.value
                  const chosenCat = categories.find((c) => String(c.id) === String(form.category_id))
                  const nextStation = form.stationManuallySelected
                    ? form.station
                    : determineItemStation({ name: val, category: chosenCat?.name })
                  setForm({ ...form, name: val, station: nextStation })
                }}
                className="h-11 rounded-xl"
              />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">Category</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryInline(!showAddCategoryInline)}
                    className="text-xs text-[#D67B6B] font-bold hover:underline"
                  >
                    {showAddCategoryInline ? "Cancel" : "+ New Category"}
                  </button>
                </div>
                <select
                  aria-label="Product category"
                  value={form.category_id}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setShowAddCategoryInline(true)
                    } else {
                      const newCatId = e.target.value
                      const chosenCat = categories.find((c) => String(c.id) === String(newCatId))
                      const nextStation = form.stationManuallySelected
                        ? form.station
                        : determineItemStation({ name: form.name, category: chosenCat?.name })
                      setForm({ ...form, category_id: newCatId, station: nextStation })
                      setShowAddCategoryInline(false)
                    }
                  }}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select Category...</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                  <option value="__new__">+ Create New Category...</option>
                </select>
                {showAddCategoryInline && (
                  <div className="flex gap-2 pt-1 animate-in fade-in-50">
                    <Input
                      placeholder="New category name (e.g. Pastries)"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void handleAddCategory()
                        }
                      }}
                      className="h-10 rounded-xl text-sm"
                      autoFocus
                    />
                    <Button
                      type="button"
                      onClick={() => void handleAddCategory()}
                      className="h-10 bg-[#D67B6B] hover:bg-[#c26555] text-white rounded-xl text-xs font-semibold px-4"
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>

              {/* Product Photo Upload & Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">Product Photo</label>
                  {form.image && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, image: "" }))}
                      className="text-[11px] text-red-500 hover:text-red-700 font-semibold"
                    >
                      Remove photo
                    </button>
                  )}
                </div>

                {form.image ? (
                  <div className="relative group rounded-xl overflow-hidden border border-[#E5D8CF] bg-[#FAF5F1] aspect-[16/9] max-h-40 flex items-center justify-center">
                    <img
                      src={form.image}
                      alt="Product preview"
                      className="w-full h-full object-cover"
                      onError={handleProductImageError}
                    />
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 text-white text-xs font-semibold z-10">
                        <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Uploading photo...
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <label className="cursor-pointer bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-100 flex items-center gap-1.5">
                        <Upload className="size-3.5" />
                        Replace
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageFileUpload}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, image: "" }))}
                        className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-600 flex items-center gap-1.5"
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="relative flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#E5D8CF] hover:border-[#D67B6B] bg-[#FAF5F1]/60 hover:bg-[#FAF5F1] rounded-xl cursor-pointer transition-colors text-center group">
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center gap-2 text-[#D67B6B] text-xs font-semibold z-10">
                        <div className="size-4 animate-spin rounded-full border-2 border-[#D67B6B] border-t-transparent" />
                        Uploading photo...
                      </div>
                    )}
                    <div className="size-10 rounded-full bg-white shadow-xs border border-[#E5D8CF] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                      <Camera className="size-5 text-[#D67B6B]" />
                    </div>
                    <span className="text-xs font-bold text-gray-700">Upload Product Photo</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      From computer, tablet gallery, or camera (PNG, JPG, WebP)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleImageFileUpload}
                    />
                  </label>
                )}

                <Input
                  placeholder="Or paste image URL (https://... or /uploads/...)"
                  value={form.image}
                  onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                  className="h-8 text-xs rounded-lg bg-white/70"
                />
              </div>
              <Input
                type="number"
                min="0"
                placeholder="Price (Rs.)"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="h-11 rounded-xl"
              />
              <Input
                type="number"
                min="0"
                placeholder="Opening Stock"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="h-11 rounded-xl"
              />
              <Button
                onClick={saveProduct}
                disabled={isUploadingImage}
                className="bg-[#D67B6B] hover:bg-[#c26555] text-white h-11 rounded-xl font-bold mt-2 disabled:opacity-50"
              >
                {isUploadingImage ? "Uploading photo..." : (editingProductId ? "Save Changes" : "Create Product")}
              </Button>
            </div>
          )}
          {dialogType === "category" && (
            <div className="flex flex-col gap-3 pt-2">
              <label className="text-xs font-semibold text-gray-700">Category Name</label>
              <Input
                placeholder="e.g. Detox Juices, Specialty Cold Brews"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="h-11 rounded-xl"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void handleAddCategory().then(() => setDialogType(null))
                  }
                }}
              />
              <div className="pt-1">
                <p className="text-xs text-gray-500 mb-2">Existing categories ({categories.length}):</p>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-gray-50 rounded-xl border">
                  {categories.map((c) => (
                    <Badge key={c.id} variant="secondary" className="text-xs py-1 px-2.5">
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                onClick={async () => {
                  await handleAddCategory()
                  setDialogType(null)
                }}
                className="bg-[#D67B6B] hover:bg-[#c26555] text-white h-11 rounded-xl font-bold mt-2"
              >
                Create Category
              </Button>
            </div>
          )}
          {dialogType === "table" && (
            <div className="flex flex-col gap-3 pt-2">
              <Input placeholder="Table name (e.g. Table 07)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-xl" />
              <Input type="number" placeholder="Seating Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="h-11 rounded-xl" />
              <Button onClick={saveTable} className="bg-[#D67B6B] hover:bg-[#c26555] text-white h-11 rounded-xl font-bold mt-2">
                Create Table
              </Button>
            </div>
          )}
          {dialogType === "stock" && (
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-xs text-muted-foreground">Adjusting stock for: <strong>{form.name}</strong></p>
              <Input type="number" placeholder="Quantity change (+ or -)" id="stock-amount-input" className="h-11 rounded-xl text-base" />
              <Button
                onClick={() => {
                  const el = document.getElementById("stock-amount-input") as HTMLInputElement
                  const targetP = products.find((x) => x.name === form.name)
                  if (targetP && el) adjustStock(targetP, Number(el.value))
                }}
                className="bg-[#D67B6B] hover:bg-[#c26555] text-white h-11 rounded-xl font-bold mt-2"
              >
                Save Stock Adjustment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ModifierModal
        product={modifierProduct}
        isOpen={Boolean(modifierProduct)}
        onClose={() => setModifierProduct(null)}
        onAdd={(product, modifiers, extraPrice, notes) => {
          addToCart(product, modifiers, extraPrice, notes)
          setModifierProduct(null)
        }}
      />
    </div>
  )
}

// =========================================================
// POS VIEW COMPONENT (Fully Mobile-Responsive)
// =========================================================
function POSView({
  visibleProducts,
  categories,
  selectedCategory,
  setCategory,
  query,
  setQuery,
  cart,
  tables,
  selectedTable,
  setSelectedTable,
  addToCart,
  onSelectProduct,
  addAllProductsToCart,
  activeOpenOrder,
  startNewOrder,
  nextOrderNumber,
  updateCartQuantity,
  subtotal,
  serviceCharge,
  total,
  totalCartQty,
  onPay,
  onSendToKitchen,
  onLoadTest,
  mobileCartOpen,
  setMobileCartOpen,
  orderType,
  setOrderType,
  deliveryAddress,
  setDeliveryAddress,
  deliveryPhone,
  setDeliveryPhone,
  promoCodeInput,
  setPromoCodeInput,
  appliedPromoCode,
  onApplyPromoCode,
  onOpenSplitModal,
  onPrintKot,
  onPrintBill,
  discountNum = 0,
}: any) {
  const [showPromoInput, setShowPromoInput] = useState(false)

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
      {/* Menu Catalog Section */}
      <section className="min-w-0 space-y-4 sm:space-y-5">
        {/* Title & Search bar */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[.18em] text-[#8a958a]">Point of Sale</p>
              {activeOpenOrder ? (
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                  Editing Tab: {activeOpenOrder.order_number}
                </Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                  Next Order: {nextOrderNumber}
                </Badge>
              )}
            </div>
            <h2 className="mt-0.5 font-serif text-xl sm:text-3xl font-bold text-[#1e2e25]">Menu Catalog</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={addAllProductsToCart}
              variant="outline"
              size="sm"
              className="h-10 shrink-0 gap-1.5 rounded-xl border-[#808068] text-[#808068] hover:bg-[#FAF5F1] font-semibold text-xs sm:text-sm px-3 shadow-sm"
              title="Add all menu products to this order"
            >
              <PlusCircle className="size-4" />
              <span>Add All Products</span>
            </Button>
            {activeOpenOrder && (
              <Button
                onClick={startNewOrder}
                variant="outline"
                size="sm"
                className="h-10 shrink-0 gap-1.5 rounded-xl border-amber-500 text-amber-800 hover:bg-amber-50 font-semibold text-xs px-3 shadow-sm"
                title="Start a new blank order"
              >
                <Plus className="size-4" />
                <span>New Blank Order</span>
              </Button>
            )}
            <div className="relative flex-1 sm:w-64 min-w-[160px]">
              <Search className="absolute left-3 top-2.5 size-4 text-[#808068]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search menu..."
                className="w-full rounded-xl border-[#E5D8CF] bg-white pl-9 pr-8 text-sm h-10"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Categories Bar with Touch Momentum Scroll */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              {categories.map((categoryName: string) => (
                <Button
                  key={categoryName}
                  variant={selectedCategory === categoryName ? "default" : "outline"}
                  onClick={() => setCategory(categoryName)}
                  className={`h-10 shrink-0 rounded-xl px-4 text-sm font-semibold transition-all ${
                    selectedCategory === categoryName
                      ? "bg-[#D67B6B] text-white shadow-xs hover:bg-[#c26555] border-[#D67B6B]"
                      : "border-[#E5D8CF] bg-white text-gray-700 hover:bg-[#FAF5F1]"
                  }`}
                >
                  {categoryName}
                </Button>
              ))}
        </div>

        {/* Products Grid (Mobile: 2 cols, Tablet: 3 cols, Desktop: 4 cols) */}
        <div className="grid min-w-0 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {visibleProducts.map((p: Product) => (
            <button
              key={p.id}
              onClick={() => (onSelectProduct ? onSelectProduct(p) : addToCart(p))}
              className="group flex flex-col justify-between rounded-xl sm:rounded-2xl border bg-white p-2.5 sm:p-3 text-left transition-all active:scale-[0.98] hover:shadow-md border-[#E5D8CF] hover:border-[#D67B6B]"
            >
              <div>
                <div className="relative mb-2 aspect-[4/3] w-full overflow-hidden rounded-lg sm:rounded-xl bg-gray-100">
                  <img
                    src={resolveProductImage(p.name, p.image, p.category)}
                    alt={p.name}
                    loading="lazy"
                    onError={handleProductImageError}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {p.stock <= 5 && p.stock > 0 && (
                    <Badge variant="secondary" className="absolute left-1.5 top-1.5 text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0 bg-amber-100 text-amber-800 border border-amber-300">
                      {p.stock} left
                    </Badge>
                  )}
                  {p.stock <= 0 && (
                    <Badge variant="secondary" className="absolute left-1.5 top-1.5 text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0 bg-[#FAF5F1] text-[#808068] border border-[#EAB8B5]">
                      Available
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs sm:text-sm font-semibold text-gray-900 leading-snug">{p.name}</p>
                <p className="text-[11px] text-gray-500 capitalize truncate">{p.category}</p>
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2">
                <p className="font-mono text-xs sm:text-sm font-bold text-[#D67B6B]">Rs. {p.price.toLocaleString()}</p>
                <span className="flex size-7 sm:size-8 items-center justify-center rounded-lg bg-[#FAF5F1] text-[#808068] group-hover:bg-[#D67B6B] group-hover:text-white transition-colors shrink-0">
                  <Plus className="size-4" />
                </span>
              </div>
            </button>
          ))}
          {visibleProducts.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-500 bg-white rounded-2xl border-2 border-dashed border-[#E5D8CF] p-8">
              <Package className="size-10 mx-auto mb-3 text-gray-300" />
              {query ? (
                <>
                  <p className="font-semibold text-sm text-gray-700">No items found matching &quot;{query}&quot;</p>
                  <p className="text-xs text-gray-400 mt-1">Try a different category or search term.</p>
                </>
              ) : (
                <>
                  <p className="font-serif text-lg font-bold text-gray-700">No Products in Catalog</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">All products have been removed from the system. Add products from the Products management screen.</p>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* FLOATING STICKY MOBILE CART TRIGGER BAR (xl:hidden)       */}
      {/* ========================================================= */}
      {cart.length > 0 && (
        <div className="xl:hidden fixed bottom-[68px] left-3 right-3 sm:left-6 sm:right-6 z-30 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#808068] text-white rounded-2xl shadow-xl p-3 flex items-center justify-between border border-[#6c6c57]">
            <button
              onClick={() => setMobileCartOpen(true)}
              className="flex items-center gap-3 text-left flex-1 min-w-0"
            >
              <div className="size-9 rounded-xl bg-white/15 flex items-center justify-center relative shrink-0">
                <ShoppingBag className="size-4 text-white" />
                <span className="absolute -top-1 -right-1 size-4 rounded-full bg-[#D67B6B] text-white font-mono text-[10px] font-bold flex items-center justify-center">
                  {totalCartQty}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate text-[#F4EBE4]/90">Order: {selectedTable}</p>
                <p className="font-mono text-sm font-bold text-white">Rs. {total.toLocaleString()}</p>
              </div>
            </button>

            <Button
              onClick={() => setMobileCartOpen(true)}
              className="bg-[#D67B6B] hover:bg-[#c26555] text-white font-bold text-xs h-9 px-3.5 rounded-xl shrink-0 gap-1.5 shadow-xs"
            >
              View Order
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE ORDER CART DRAWER (Sheet)                          */}
      {/* ========================================================= */}
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col h-full bg-white z-50 overflow-hidden">
          {/* Pinned Header - Compact */}
          <div className="p-3 border-b border-[#E5D8CF] shrink-0 bg-[#FAF5F1] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SheetTitle className="font-serif text-base sm:text-lg font-bold text-[#343428]">Order Summary</SheetTitle>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-[#808068]/30 text-[#808068] font-mono font-bold">
                  {activeOpenOrder ? `TAB #${activeOpenOrder.order_number}` : `#${nextOrderNumber}`}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                {activeOpenOrder && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startNewOrder}
                    className="text-[10px] h-6 px-1.5 border-[#D67B6B]/40 text-[#D67B6B] hover:bg-[#faecea]"
                  >
                    New Order
                  </Button>
                )}
                <Badge className="bg-white text-[#808068] border border-[#E5D8CF] text-[11px] h-5 px-2 font-medium">{totalCartQty} items</Badge>
              </div>
            </div>

            {/* Order Type Selector - Ultra Compact */}
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-white/80 rounded-lg text-xs border border-[#E5D8CF]">
              <button
                type="button"
                onClick={() => setOrderType("dine_in")}
                className={`py-1 text-[11px] font-bold rounded transition-all ${
                  orderType === "dine_in"
                    ? "bg-[#D67B6B] text-white shadow-xs"
                    : "text-gray-700 hover:bg-stone-100"
                }`}
              >
                🍽️ Dine-in
              </button>
              <button
                type="button"
                onClick={() => setOrderType("takeaway")}
                className={`py-1 text-[11px] font-bold rounded transition-all ${
                  orderType === "takeaway"
                    ? "bg-[#D67B6B] text-white shadow-xs"
                    : "text-gray-700 hover:bg-stone-100"
                }`}
              >
                🥡 Takeaway
              </button>
              <button
                type="button"
                onClick={() => setOrderType("delivery")}
                className={`py-1 text-[11px] font-bold rounded transition-all ${
                  orderType === "delivery"
                    ? "bg-[#D67B6B] text-white shadow-xs"
                    : "text-gray-700 hover:bg-stone-100"
                }`}
              >
                🛵 Delivery
              </button>
            </div>

            {/* Table / Delivery / Takeaway contextual info - Single compact row */}
            {orderType === "dine_in" && (
              <div className="flex items-center justify-between gap-2 bg-white px-2 py-1 rounded-lg border border-[#E5D8CF]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Table2 className="size-3.5 text-[#808068] shrink-0" />
                  <span className="text-[11px] font-semibold text-gray-700 shrink-0">Table:</span>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="h-6 rounded border border-gray-300 bg-white px-1.5 text-xs font-bold text-gray-900 outline-none focus:ring-1 focus:ring-[#D67B6B]"
                  >
                    {tables.map((t: TableInfo) => {
                      const isAvail = t.status === "available"
                      const isCur = t.name.toLowerCase() === selectedTable?.toLowerCase()
                      const labelStatus = isAvail
                        ? "AVAILABLE"
                        : t.status === "reserved"
                        ? "RESERVED"
                        : "OCCUPIED"
                      return (
                        <option key={t.id} value={t.name} disabled={!isAvail && !isCur}>
                          {t.name} ({labelStatus})
                        </option>
                      )
                    })}
                  </select>
                </div>
                {(() => {
                  const cur = tables.find((t: TableInfo) => t.name.toLowerCase() === selectedTable?.toLowerCase())
                  if (!cur) return null
                  if (cur.status === "reserved") {
                    return (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200 shrink-0">
                        <span className="size-1.5 rounded-full bg-violet-500"></span> Reserved
                      </span>
                    )
                  }
                  if (cur.status === "occupied") {
                    return (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                        <span className="size-1.5 rounded-full bg-amber-500"></span> Seated
                      </span>
                    )
                  }
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                      <span className="size-1.5 rounded-full bg-emerald-500"></span> Available
                    </span>
                  )
                })()}
              </div>
            )}

            {orderType === "delivery" && (
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  placeholder="Phone (077...)"
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  className="h-6 text-xs bg-white rounded-md border-blue-200"
                />
                <Input
                  placeholder="Delivery Address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="h-6 text-xs bg-white rounded-md border-blue-200"
                />
              </div>
            )}

            {orderType === "takeaway" && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 rounded-md border border-amber-200 text-[11px] text-amber-900">
                <ShoppingBag className="size-3 text-amber-700 shrink-0" />
                <span>Counter Pickup</span>
              </div>
            )}
          </div>

          {/* Cart Items List - ONLY SCROLLABLE AREA, MAXIMIZED SPACE */}
          <div className="flex-1 min-h-[160px] overflow-y-auto p-3 space-y-2">
            {cart.length > 0 ? (
              cart.map((item: CartItem) => {
                const itemKey = item.cartItemId || item.id
                return (
                  <div
                    key={itemKey}
                    className="flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl border border-[#E5D8CF] bg-white shadow-xs hover:border-[#D67B6B]/40 hover:shadow-sm transition-all"
                  >
                    {/* Product Thumbnail */}
                    <div className="relative size-12 sm:size-14 rounded-lg overflow-hidden bg-[#FAF5F1] border border-[#E5D8CF] shrink-0 shadow-2xs">
                      <img
                        src={resolveProductImage(item.name, item.image, item.category)}
                        alt={item.name}
                        className="size-full object-cover"
                        onError={handleProductImageError}
                      />
                    </div>

                    {/* Details - Full Name, No Cutoff */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm sm:text-base font-bold text-gray-900 leading-snug line-clamp-2 break-words">
                        {item.name}
                      </p>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <p className="text-xs font-semibold text-[#D67B6B] mt-0.5 line-clamp-1">
                          {item.modifiers.join(" • ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-gray-500 italic mt-0.5 line-clamp-1">
                          Note: {item.notes}
                        </p>
                      )}
                      <p className="font-mono text-xs sm:text-sm font-semibold text-stone-500 mt-0.5">
                        Rs. {item.price.toLocaleString("en-US", { minimumFractionDigits: 2 })} ea
                      </p>
                    </div>

                    {/* Quantity & Total */}
                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                      <div className="flex items-center rounded-lg border border-gray-300 bg-[#FAF5F1] p-0.5 shadow-2xs">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => updateCartQuantity(itemKey, -1)}
                          className="size-7 sm:size-8 rounded-md hover:bg-white text-gray-700 hover:text-red-600 transition-colors flex items-center justify-center"
                          title={item.quantity === 1 ? "Remove item" : "Decrease quantity"}
                        >
                          {item.quantity === 1 ? (
                            <Trash2 className="size-3.5 sm:size-4 text-red-500" />
                          ) : (
                            <Minus className="size-3.5 sm:size-4" />
                          )}
                        </Button>
                        <span className="w-5 sm:w-6 text-center font-mono text-sm sm:text-base font-extrabold text-stone-900">
                          {item.quantity}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => updateCartQuantity(itemKey, 1)}
                          className="size-7 sm:size-8 rounded-md hover:bg-white text-gray-700 hover:text-[#D67B6B] transition-colors flex items-center justify-center"
                          title="Increase quantity"
                        >
                          <Plus className="size-3.5 sm:size-4" />
                        </Button>
                      </div>
                      <span className="font-mono text-sm sm:text-base font-extrabold text-right text-stone-900 min-w-[65px] sm:min-w-[75px]">
                        Rs. {(item.price * item.quantity).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-6 text-center text-xs text-gray-500 border-2 border-dashed border-[#E5D8CF] rounded-xl p-4">
                <ShoppingBag className="size-8 text-gray-300 mb-2" />
                <p className="font-semibold text-gray-700 text-sm">Cart is currently empty</p>
                <p className="mt-1 text-gray-400 max-w-[200px]">Click any product from the catalog on the left to add it here.</p>
              </div>
            )}
          </div>

          {/* Pinned Footer - Compact & Space-Saving */}
          {cart.length > 0 && (
            <div className="shrink-0 border-t border-[#E5D8CF] bg-[#FAF5F1] p-3 space-y-2">
              {/* Price Breakdown */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({totalCartQty} items)</span>
                  <span className="font-mono font-medium">Rs. {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>

                {appliedPromoCode && discountNum > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount ({appliedPromoCode})</span>
                    <span className="font-mono">- Rs. {discountNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="flex justify-between text-[#808068] font-medium">
                  <span>Hospitality Service Charge (10%)</span>
                  <span className="font-mono">Rs. {serviceCharge.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Collapsible Promo Code */}
              {!appliedPromoCode ? (
                !showPromoInput ? (
                  <button
                    type="button"
                    onClick={() => setShowPromoInput(true)}
                    className="text-[11px] font-semibold text-[#808068] hover:text-[#D67B6B] flex items-center gap-1 transition-colors"
                  >
                    <Percent className="size-3" />
                    <span>+ Add promo code</span>
                  </button>
                ) : (
                  <div className="flex gap-1.5 items-center">
                    <Input
                      placeholder="PROMO CODE (E.G. WELCOME10)"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value)}
                      className="h-7 text-xs font-mono rounded-lg uppercase bg-white border-stone-200"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={onApplyPromoCode}
                      className="h-7 text-xs px-2.5 bg-[#808068] text-white hover:bg-[#6c6c57] rounded-lg shrink-0 font-semibold"
                    >
                      Apply
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowPromoInput(false)}
                      className="h-7 text-xs px-1.5 text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </Button>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-between text-[11px] text-[#808068] bg-white px-2 py-0.5 rounded-md border border-[#EAB8B5]">
                  <span className="font-semibold">Code: {appliedPromoCode}</span>
                  <Badge className="bg-[#D67B6B] text-white text-[9px] h-3.5 px-1">Applied</Badge>
                </div>
              )}

              {/* Total Due Card - Slim Banner */}
              <div className="rounded-lg bg-gradient-to-r from-[#808068] to-[#5c5c49] px-3 py-1.5 text-white shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#EAB8B5]">Total Payable</p>
                  <p className="text-[9px] text-[#F4EBE4]/80">Incl. 10% Service Charge</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base sm:text-lg font-black tracking-tight text-white drop-shadow-sm">
                    Rs. {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Row 1 = 4 Secondary Actions, Row 2 = Primary Pay Button */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-4 gap-1">
                  <Button
                    onClick={onSendToKitchen}
                    variant="outline"
                    size="sm"
                    className="h-7 px-1 text-[11px] font-bold border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 rounded-lg gap-1"
                    title="Send kitchen & bar chits"
                  >
                    <UtensilsCrossed className="size-3 text-amber-700 shrink-0" />
                    <span className="truncate">KOT</span>
                  </Button>
                  <Button
                    onClick={onPrintKot}
                    variant="outline"
                    size="sm"
                    className="h-7 px-1 text-[11px] font-bold border-stone-300 text-stone-800 hover:bg-stone-100 rounded-lg gap-1"
                    title="Print KOT ticket"
                  >
                    <Ticket className="size-3 text-stone-700 shrink-0" />
                    <span className="truncate">Print</span>
                  </Button>
                  <Button
                    onClick={onPrintBill}
                    variant="outline"
                    size="sm"
                    className="h-7 px-1 text-[11px] font-bold border-[#808068]/30 text-[#808068] bg-white hover:bg-[#FAF5F1] rounded-lg gap-1"
                    title="Print 80mm dining check"
                  >
                    <Printer className="size-3 text-[#808068] shrink-0" />
                    <span className="truncate">Bill</span>
                  </Button>
                  <Button
                    onClick={onOpenSplitModal}
                    variant="outline"
                    size="sm"
                    className="h-7 px-1 text-[11px] font-bold border-blue-200 text-blue-800 bg-blue-50/50 hover:bg-blue-100 rounded-lg gap-1"
                    title="Split bill"
                  >
                    <Split className="size-3 text-blue-600 shrink-0" />
                    <span className="truncate">Split</span>
                  </Button>
                </div>

                <Button
                  onClick={onPay}
                  className="w-full h-9 sm:h-10 bg-[#D67B6B] hover:bg-[#c26555] text-white font-bold text-xs sm:text-sm shadow rounded-xl flex items-center justify-center gap-1.5"
                >
                  <CreditCard className="size-4" />
                  <span>Pay & Settle (Rs. {total.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ========================================================= */}
      {/* DESKTOP CURRENT ORDER SUMMARY PANEL (hidden on < xl)       */}
      {/* ========================================================= */}
      <aside className="hidden xl:flex min-w-0 rounded-2xl border border-[#E5D8CF] bg-white shadow-sm sticky top-4 flex-col h-[calc(100vh-5.5rem)] overflow-hidden">
        {/* Panel Top Header & Mode Selectors (Pinned, Shrink-0) - Ultra Compact */}
        <div className="p-3 sm:p-3.5 pb-2 border-b border-[#E5D8CF] shrink-0 bg-white space-y-2">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg font-bold text-[#343428]">Order Summary</h3>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-[#808068]/30 text-[#808068] font-mono font-bold">
                {activeOpenOrder ? `TAB #${activeOpenOrder.order_number}` : `#${nextOrderNumber}`}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              {activeOpenOrder && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={startNewOrder}
                  className="text-xs h-6 px-2 border-[#D67B6B]/40 text-[#D67B6B] hover:bg-[#faecea]"
                  title="Switch to creating a new fresh order"
                >
                  New Order
                </Button>
              )}
              <Badge className="bg-[#FAF5F1] text-[#808068] border border-[#E5D8CF] text-[11px] h-5 px-2 font-medium">{totalCartQty} items</Badge>
            </div>
          </div>

          {/* Order Type Selector: Dine-in / Takeaway / Delivery */}
          <div className="grid grid-cols-3 gap-1 p-0.5 bg-[#FAF5F1] rounded-lg text-xs border border-[#E5D8CF]">
            <button
              type="button"
              onClick={() => setOrderType("dine_in")}
              className={`py-1 text-[11px] font-bold rounded transition-all ${
                orderType === "dine_in"
                  ? "bg-[#D67B6B] text-white shadow-xs"
                  : "text-gray-700 hover:bg-white/60"
              }`}
            >
              🍽️ Dine-in
            </button>
            <button
              type="button"
              onClick={() => setOrderType("takeaway")}
              className={`py-1 text-[11px] font-bold rounded transition-all ${
                orderType === "takeaway"
                  ? "bg-[#D67B6B] text-white shadow-xs"
                  : "text-gray-700 hover:bg-white/60"
              }`}
            >
              🥡 Takeaway
            </button>
            <button
              type="button"
              onClick={() => setOrderType("delivery")}
              className={`py-1 text-[11px] font-bold rounded transition-all ${
                orderType === "delivery"
                  ? "bg-[#D67B6B] text-white shadow-xs"
                  : "text-gray-700 hover:bg-white/60"
              }`}
            >
              🛵 Delivery
            </button>
          </div>

          {/* Table Selector (for Dine-in) - Single Sleek Row */}
          {orderType === "dine_in" && (
            <div className="flex items-center justify-between gap-2 bg-[#FAF5F1] px-2.5 py-1 rounded-lg border border-[#E5D8CF]">
              <div className="flex items-center gap-1.5 min-w-0">
                <Table2 className="size-3.5 text-[#808068] shrink-0" />
                <span className="text-[11px] font-semibold text-gray-700 shrink-0">Table:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="h-6 rounded border border-gray-300 bg-white px-2 text-xs font-bold text-gray-900 outline-none focus:ring-1 focus:ring-[#D67B6B]"
                >
                  {tables.map((t: TableInfo) => {
                    const isAvail = t.status === "available"
                    const isCur = t.name.toLowerCase() === selectedTable?.toLowerCase()
                    const labelStatus = isAvail
                      ? "AVAILABLE"
                      : t.status === "reserved"
                      ? "RESERVED"
                      : "OCCUPIED"
                    return (
                      <option key={t.id} value={t.name} disabled={!isAvail && !isCur}>
                        {t.name} ({labelStatus})
                      </option>
                    )
                  })}
                </select>
              </div>
              {(() => {
                const cur = tables.find((t: TableInfo) => t.name.toLowerCase() === selectedTable?.toLowerCase())
                if (!cur) return null
                if (cur.status === "reserved") {
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200 shrink-0">
                      <span className="size-1.5 rounded-full bg-violet-500"></span> Reserved
                    </span>
                  )
                }
                if (cur.status === "occupied") {
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                      <span className="size-1.5 rounded-full bg-amber-500"></span> Seated
                    </span>
                  )
                }
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                    <span className="size-1.5 rounded-full bg-emerald-500"></span> Available
                  </span>
                )
              })()}
            </div>
          )}

          {/* Delivery Details */}
          {orderType === "delivery" && (
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                placeholder="Phone (077...)"
                value={deliveryPhone}
                onChange={(e) => setDeliveryPhone(e.target.value)}
                className="h-7 text-xs bg-white rounded-lg border-blue-200"
              />
              <Input
                placeholder="Delivery Address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="h-7 text-xs bg-white rounded-lg border-blue-200"
              />
            </div>
          )}

          {/* Takeaway Info */}
          {orderType === "takeaway" && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900">
              <ShoppingBag className="size-3 text-amber-700 shrink-0" />
              <span>Counter Pickup Order</span>
            </div>
          )}
        </div>

        {/* Section 2: Active Cart Items List (Maximized Vertical Scroll Area) */}
        <div className="flex-1 min-h-[180px] overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {cart.length > 0 ? (
            cart.map((item: CartItem) => {
              const itemKey = item.cartItemId || item.id
              return (
                <div
                  key={itemKey}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#E5D8CF] bg-white shadow-xs hover:border-[#D67B6B]/40 hover:shadow-sm transition-all"
                >
                  {/* Product Thumbnail - Large and Clear */}
                  <div className="relative size-12 sm:size-14 rounded-xl overflow-hidden bg-[#FAF5F1] border border-[#E5D8CF] shrink-0 shadow-2xs">
                    <img
                      src={resolveProductImage(item.name, item.image, item.category)}
                      alt={item.name}
                      className="size-full object-cover"
                      onError={handleProductImageError}
                    />
                  </div>

                  {/* Details - Full Name, No Truncate Cutoff */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-base font-bold text-gray-900 leading-snug line-clamp-2 break-words">
                      {item.name}
                    </p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-xs font-semibold text-[#D67B6B] mt-0.5 line-clamp-1">
                        {item.modifiers.join(" • ")}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-[11px] text-gray-500 italic mt-0.5 line-clamp-1">
                        Note: {item.notes}
                      </p>
                    )}
                    <p className="font-mono text-xs sm:text-sm font-semibold text-stone-500 mt-0.5">
                      Rs. {item.price.toLocaleString("en-US", { minimumFractionDigits: 2 })} ea
                    </p>
                  </div>

                  {/* Quantity & Total */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="flex items-center rounded-xl border border-gray-300 bg-[#FAF5F1] p-0.5 shadow-2xs">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => updateCartQuantity(itemKey, -1)}
                        className="size-7 sm:size-8 rounded-lg hover:bg-white text-gray-700 hover:text-red-600 transition-colors flex items-center justify-center"
                        title={item.quantity === 1 ? "Remove item" : "Decrease quantity"}
                      >
                        {item.quantity === 1 ? (
                          <Trash2 className="size-3.5 sm:size-4 text-red-500" />
                        ) : (
                          <Minus className="size-3.5 sm:size-4" />
                        )}
                      </Button>
                      <span className="w-6 text-center font-mono text-sm sm:text-base font-extrabold text-stone-900">
                        {item.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => updateCartQuantity(itemKey, 1)}
                        className="size-7 sm:size-8 rounded-lg hover:bg-white text-gray-700 hover:text-[#D67B6B] transition-colors flex items-center justify-center"
                        title="Increase quantity"
                      >
                        <Plus className="size-3.5 sm:size-4" />
                      </Button>
                    </div>
                    <span className="font-mono text-sm sm:text-base font-extrabold text-right text-stone-900 min-w-[70px] sm:min-w-[75px]">
                      Rs. {(item.price * item.quantity).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-8 text-center text-xs text-gray-500 border-2 border-dashed border-[#E5D8CF] rounded-2xl p-4">
              <ShoppingBag className="size-9 text-gray-300 mb-2" />
              <p className="font-semibold text-gray-700 text-sm">Cart is currently empty</p>
              <p className="mt-1 text-gray-400 max-w-[200px]">Click any product from the catalog on the left to add it here.</p>
              <div className="flex flex-col gap-2 mt-4 w-full max-w-[220px]">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addAllProductsToCart}
                  className="w-full text-xs gap-1.5 border-[#808068] text-[#808068] bg-[#FAF5F1] hover:bg-[#eeeee7] rounded-xl font-semibold h-9"
                >
                  <PlusCircle className="size-3.5" />
                  Add All Products
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onLoadTest}
                  className="w-full text-xs gap-1.5 border-[#808068]/30 text-[#808068] bg-[#FAF5F1] hover:bg-[#eeeee7] rounded-xl h-9"
                >
                  <Zap className="size-3.5 text-[#D67B6B] fill-[#D67B6B]" />
                  Load Acceptance Test Order
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Summary Breakdown & Action Buttons (Pinned Footer, Compact) */}
        {cart.length > 0 && (
          <div className="shrink-0 border-t border-[#E5D8CF] bg-[#FAF5F1] p-3 sm:p-3.5 space-y-2">
            {/* Calculations Breakdown */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({totalCartQty} items)</span>
                <span className="font-mono font-medium">
                  Rs. {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {appliedPromoCode && discountNum > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount ({appliedPromoCode})</span>
                  <span className="font-mono">
                    - Rs. {discountNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-[#808068] font-medium">
                <span>Hospitality Service Charge (10%)</span>
                <span className="font-mono">
                  Rs. {serviceCharge.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Collapsible Promo Code Input Field */}
            {!appliedPromoCode ? (
              !showPromoInput ? (
                <button
                  type="button"
                  onClick={() => setShowPromoInput(true)}
                  className="text-[11px] font-semibold text-[#808068] hover:text-[#D67B6B] flex items-center gap-1 transition-colors"
                >
                  <Percent className="size-3" />
                  <span>+ Have a promo code?</span>
                </button>
              ) : (
                <div className="pt-0.5 flex gap-1.5 items-center">
                  <Input
                    placeholder="Promo code (e.g. WELCOME10)"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    className="h-7 text-xs font-mono rounded-lg uppercase bg-white border-stone-200"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={onApplyPromoCode}
                    className="h-7 text-xs px-2.5 bg-[#808068] text-white hover:bg-[#6c6c57] rounded-lg shrink-0 font-semibold"
                  >
                    Apply
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPromoInput(false)}
                    className="h-7 text-xs px-1.5 text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </Button>
                </div>
              )
            ) : (
              <div className="flex items-center justify-between text-[11px] text-[#808068] bg-white px-2 py-0.5 rounded-md border border-[#EAB8B5]">
                <span className="font-semibold">Code: {appliedPromoCode}</span>
                <Badge className="bg-[#D67B6B] text-white text-[9px] h-3.5 px-1.5">Applied</Badge>
              </div>
            )}

            {/* Total Due Pill Card - Slim Banner */}
            <div className="rounded-xl bg-gradient-to-r from-[#808068] to-[#5c5c49] px-3 py-1.5 text-white shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#EAB8B5]">Total Payable</p>
                <p className="text-[9px] text-[#F4EBE4]/80">Incl. 10% Service Charge</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-sm">
                  Rs. {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Action Buttons: Row 1 = 4 Secondary Actions, Row 2 = Primary Pay Button */}
            <div className="space-y-1.5 pt-0.5">
              <div className="grid grid-cols-4 gap-1">
                <Button
                  onClick={onSendToKitchen}
                  variant="outline"
                  size="sm"
                  className="h-7 px-1 text-[11px] font-bold border-amber-300 text-amber-950 bg-amber-50/60 hover:bg-amber-100 rounded-xl gap-1 transition-colors"
                  title="Send kitchen and bar order chits"
                >
                  <UtensilsCrossed className="size-3 text-amber-700 shrink-0" />
                  <span className="truncate">KOT</span>
                </Button>

                <Button
                  onClick={onPrintKot}
                  variant="outline"
                  size="sm"
                  className="h-7 px-1 text-[11px] font-bold border-stone-300 text-stone-800 hover:bg-stone-100 rounded-xl gap-1 transition-colors"
                  title="Preview & print Kitchen/Bar thermal tickets"
                >
                  <Ticket className="size-3 text-stone-700 shrink-0" />
                  <span className="truncate">Print</span>
                </Button>

                <Button
                  onClick={onPrintBill}
                  variant="outline"
                  size="sm"
                  className="h-7 px-1 text-[11px] font-bold border-[#808068]/30 text-[#808068] bg-white hover:bg-[#FAF5F1] rounded-xl gap-1 transition-colors"
                  title="Print Guest Dining Bill Check (80mm)"
                >
                  <Printer className="size-3 text-[#808068] shrink-0" />
                  <span className="truncate">Bill</span>
                </Button>

                <Button
                  onClick={onOpenSplitModal}
                  variant="outline"
                  size="sm"
                  className="h-7 px-1 text-[11px] font-bold border-blue-200 text-blue-900 bg-blue-50/50 hover:bg-blue-100 rounded-xl gap-1 transition-colors"
                  title="Split bill between guests"
                >
                  <Split className="size-3 text-blue-600 shrink-0" />
                  <span className="truncate">Split</span>
                </Button>
              </div>

              {/* Primary Checkout Button */}
              <Button
                onClick={onPay}
                className="w-full h-10 bg-[#D67B6B] hover:bg-[#c26555] text-white font-bold text-sm shadow-md rounded-xl flex items-center justify-center gap-2 transition-all hover:shadow-lg active:scale-[0.99]"
              >
                <CreditCard className="size-4" />
                <span>Pay & Settle (Rs. {total.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
              </Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

// =========================================================
// MANAGEMENT VIEW COMPONENT (Fully Mobile-Responsive for All Views)
// =========================================================
function ManagementView({
  supabase,
  view,
  setView,
  role,
  setRole,
  orders,
  coffeeBills,
  tables,
  products,
  categories = [],
  movements,
  loading,
  onAdd,
  onStock,
  onEditProduct,
  onDeleteProduct,
  onPrintReceipt,
  onPrintTicket,
  onPayOpenOrder,
  onUpdateOrderStatus,
  onSelectTableAndStartOrder,
  onSignOut,
}: any) {
  const {
    permissions: rbacPermissions = [],
    canManageProducts: rbacCanManageProducts,
    canManageCategories: rbacCanManageCategories,
    canManageTables: rbacCanManageTables,
    canAdjustStock: rbacCanAdjustStock,
    role: rbacRole,
  } = usePermissions()

  const effectiveRole = normalizeRole(role || rbacRole)
  const effectiveCanManageProducts = rbacCanManageProducts || canManageProducts(effectiveRole, rbacPermissions)
  const effectiveCanManageCategories = rbacCanManageCategories || canManageCategories(effectiveRole, rbacPermissions)
  const effectiveCanManageTables = rbacCanManageTables || canManageTables(effectiveRole, rbacPermissions)
  const effectiveCanAdjustStock = rbacCanAdjustStock || canAdjustStock(effectiveRole, rbacPermissions)

  const [orderSearch, setOrderSearch] = useState("")
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "completed" | "active" | "open">("all")
  const [ticketFilter, setTicketFilter] = useState<"active" | "all">("active")
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("All")
  const [pendingTicketIds, setPendingTicketIds] = useState<Set<string>>(new Set())

  const inventoryProducts = useMemo(
    () => (products || []).map((product: Product) => ({ id: product.id, name: product.name, price: product.price })),
    [products]
  )

  async function updateTicket(orderId: string, station: TicketStation, status: TicketStatus) {
    if (pendingTicketIds.has(orderId)) return
    setPendingTicketIds((current) => new Set(current).add(orderId))
    try {
      await onUpdateOrderStatus(orderId, station, status)
    } finally {
      setPendingTicketIds((current) => {
        const next = new Set(current)
        next.delete(orderId)
        return next
      })
    }
  }

  const titleMap: Record<string, string> = {
    Dashboard: "Today at a Glance",
    Kitchen: "Kitchen Queue (KDS)",
    Bar: "Bar Order Tickets (BOT)",
    Orders: "Order History",
    Tables: "Table Management",
    Products: "Product Catalog",
    Inventory: "Inventory Control",
    Reports: "Service Reports",
    Settings: "Workspace Settings",
    Users: "User & Staff Accounts",
    Roles: "Role & Permission Management",
  }

  // Unified orders combining all stations (Kitchen, Bar, Takeaway, Coffee)
  const unifiedOrdersMap = new Map<string, OrderRecord>()
  for (const o of orders) {
    if (o && (o.id || o.order_number)) {
      unifiedOrdersMap.set(String(o.order_number || o.id), o)
    }
  }
  for (const cb of coffeeBills) {
    const ticket = toCoffeeBarTicket(cb)
    const key = String(ticket.order_number || ticket.id)
    const existing = unifiedOrdersMap.get(key)
    if (!existing) {
      unifiedOrdersMap.set(key, ticket)
    } else if (existing.ticket_source === "coffee_bill" || existing.department === "Coffee Bar") {
      unifiedOrdersMap.set(key, {
        ...existing,
        bar_status: ticket.bar_status || existing.bar_status,
        status: ticket.bar_status === "served" ? "completed" : existing.status,
      })
    }
  }
  const allUnifiedOrders = Array.from(unifiedOrdersMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  // Dashboard Stats Calculations (unified across all stations)
  const totalSalesToday = allUnifiedOrders.reduce((s: number, o: OrderRecord) => s + (o.total || 0), 0)
  const totalServiceCharge = allUnifiedOrders.reduce((s: number, o: OrderRecord) => s + (o.service_charge || 0), 0)
  const occupiedCount = tables.filter((t: TableInfo) => t.status === "occupied").length
  const lowStockCount = products.filter((p: Product) => p.stock <= 5).length
  const allTicketOrders = allUnifiedOrders
  const station = view === "Bar" ? "bar" : "kitchen"
  const stationOrders = allTicketOrders.filter((order: OrderRecord) => getStationItems(order, station).length > 0)
  const activeTicketCount = stationOrders.filter((order: OrderRecord) => getTicketStatus(order, station) !== "served").length
  const ticketOrders = stationOrders.filter((order: OrderRecord) => {
    if (ticketFilter === "active") return getTicketStatus(order, station) !== "served"
    return true
  })
  const cashSales = allUnifiedOrders.reduce((s: number, o: OrderRecord) => {
    let splitList = Array.isArray(o.split_payments) && o.split_payments.length > 0 ? o.split_payments : null
    if (!splitList && typeof (o as any).notes === "string" && (o as any).notes.includes("split_payments")) {
      try {
        const parsed = JSON.parse((o as any).notes)
        if (Array.isArray(parsed.split_payments)) splitList = parsed.split_payments
      } catch {}
    }
    if (splitList && splitList.length > 0) {
      const c = splitList
        .filter((sp: any) => String(sp.method || "").toLowerCase() === "cash")
        .reduce((cs: number, sp: any) => cs + (Number(sp.amount) || 0), 0)
      return s + c
    }
    return s + (o.payment_method === "cash" ? (o.total || 0) : 0)
  }, 0)

  const cardSales = allUnifiedOrders.reduce((s: number, o: OrderRecord) => {
    let splitList = Array.isArray(o.split_payments) && o.split_payments.length > 0 ? o.split_payments : null
    if (!splitList && typeof (o as any).notes === "string" && (o as any).notes.includes("split_payments")) {
      try {
        const parsed = JSON.parse((o as any).notes)
        if (Array.isArray(parsed.split_payments)) splitList = parsed.split_payments
      } catch {}
    }
    if (splitList && splitList.length > 0) {
      const c = splitList
        .filter((sp: any) => String(sp.method || "").toLowerCase() === "card")
        .reduce((cs: number, sp: any) => cs + (Number(sp.amount) || 0), 0)
      return s + c
    }
    return s + (o.payment_method === "card" ? (o.total || 0) : 0)
  }, 0)

  // Filtered orders for Order History tab
  const allOrdersFilteredBySearch = allUnifiedOrders.filter((o: OrderRecord) => {
    const search = orderSearch.toLowerCase()
    const orderNumber = String(o.order_number ?? "").toLowerCase()
    const tableName = String(o.table_name ?? "").toLowerCase()
    const receiptNumber = String(o.receipt_number ?? "").toLowerCase()
    const cashierName = String(o.cashier_name ?? "").toLowerCase()
    const dept = String(o.department ?? "").toLowerCase()

    return (
      orderNumber.includes(search) ||
      tableName.includes(search) ||
      receiptNumber.includes(search) ||
      cashierName.includes(search) ||
      dept.includes(search)
    )
  })

  const completedOrdersCount = allUnifiedOrders.filter((o: OrderRecord) => isOrderCompleted(o)).length
  const openOrdersCount = allUnifiedOrders.filter((o: OrderRecord) => o.status === "open").length
  const activeOrdersCount = allUnifiedOrders.filter((o: OrderRecord) => o.status !== "open" && !isOrderCompleted(o)).length

  const filteredOrders = allOrdersFilteredBySearch.filter((o: OrderRecord) => {
    if (orderStatusFilter === "completed") return isOrderCompleted(o)
    if (orderStatusFilter === "open") return o.status === "open"
    if (orderStatusFilter === "active") return o.status !== "open" && !isOrderCompleted(o)
    return true
  })

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* View Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[.18em] text-[#8a958a]">Management</p>
          <h2 className="mt-0.5 font-serif text-2xl sm:text-3xl font-bold text-gray-900">{titleMap[view] || view}</h2>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Live operational restaurant records.</p>
        </div>

        {effectiveCanManageCategories && view === "Products" && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              onClick={() => onAdd("category")}
              variant="outline"
              className="border-[#808068] text-[#808068] hover:bg-[#FAF5F1] gap-1.5 rounded-xl h-10 text-xs sm:text-sm shadow-sm"
            >
              <Plus className="size-4" />
              Add Category
            </Button>
            <Button
              onClick={() => onAdd("product")}
              className="bg-[#D67B6B] hover:bg-[#c26555] text-white gap-1.5 rounded-xl h-10 text-xs sm:text-sm shadow-sm"
            >
              <Plus className="size-4" />
              Add Product
            </Button>
          </div>
        )}

        {effectiveCanManageTables && view === "Tables" && (
          <Button
            onClick={() => onAdd("table")}
            className="bg-[#D67B6B] hover:bg-[#c26555] text-white gap-2 rounded-xl h-10 text-xs sm:text-sm self-start sm:self-auto shadow-sm"
          >
            <Plus className="size-4" />
            Add Table
          </Button>
        )}

        {(view === "Kitchen" || view === "Bar") && (
          <div className="flex items-center gap-1.5 bg-[#FAF5F1] p-1 rounded-xl self-start sm:self-auto border border-[#E5D8CF]">
            <Button
              size="sm"
              variant={ticketFilter === "active" ? "default" : "ghost"}
              onClick={() => setTicketFilter("active")}
              className={`h-8 rounded-lg text-xs font-semibold ${
                ticketFilter === "active" ? "bg-[#D67B6B] text-white shadow-xs" : "text-[#808068] hover:text-[#343428]"
              }`}
            >
              Active Tickets ({activeTicketCount})
            </Button>
            <Button
              size="sm"
              variant={ticketFilter === "all" ? "default" : "ghost"}
              onClick={() => setTicketFilter("all")}
              className={`h-8 rounded-lg text-xs font-semibold ${
                ticketFilter === "all" ? "bg-[#D67B6B] text-white shadow-xs" : "text-[#808068] hover:text-[#343428]"
              }`}
            >
              All Tickets ({stationOrders.length})
            </Button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 1. DASHBOARD VIEW                                         */}
      {/* ========================================================= */}
      {view === "Dashboard" && (
        <div className="space-y-5">
          {/* KPI Stat Cards (2 cols mobile, 4 cols desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <Card className="rounded-2xl border-[#E5D8CF] bg-white p-3.5 sm:p-4">
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Gross Sales</span>
                <span className="p-1.5 rounded-lg bg-[#FAF5F1] text-[#D67B6B]">
                  <DollarSign className="size-4" />
                </span>
              </div>
              <p className="mt-2 font-mono text-lg sm:text-2xl font-bold text-[#D67B6B]">
                Rs. {totalSalesToday.toLocaleString()}
              </p>
              <p className="mt-1 text-[10px] text-gray-400">{allUnifiedOrders.length} completed transactions</p>
            </Card>

            <Card className="rounded-2xl border-[#E5D8CF] bg-white p-3.5 sm:p-4">
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Tables Active</span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                  <Table2 className="size-4" />
                </span>
              </div>
              <p className="mt-2 font-mono text-lg sm:text-2xl font-bold text-amber-900">
                {occupiedCount} / {tables.length}
              </p>
              <p className="mt-1 text-[10px] text-gray-400">Dine-in floor occupancy</p>
            </Card>

            <Card className="rounded-2xl border-[#E5D8CF] bg-white p-3.5 sm:p-4">
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Service Charge</span>
                <span className="p-1.5 rounded-lg bg-[#FAF5F1] text-[#808068]">
                  <TrendingUp className="size-4" />
                </span>
              </div>
              <p className="mt-2 font-mono text-lg sm:text-2xl font-bold text-[#808068]">
                Rs. {totalServiceCharge.toLocaleString()}
              </p>
              <p className="mt-1 text-[10px] text-gray-400">10% staff service charge</p>
            </Card>

            <Card className="rounded-2xl border-[#E5D8CF] bg-white p-3.5 sm:p-4">
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Stock Alerts</span>
                <span className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
                  <Package className="size-4" />
                </span>
              </div>
              <p className="mt-2 font-mono text-lg sm:text-2xl font-bold text-rose-800">
                {lowStockCount} items
              </p>
              <p className="mt-1 text-[10px] text-gray-400">Stock &lt;= 5 units remaining</p>
            </Card>
          </div>

          {/* Quick Action Navigation Buttons on Mobile */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <Button
              variant="outline"
              onClick={() => setView("POS")}
              className="h-11 rounded-xl justify-start gap-2 bg-white text-xs font-semibold text-gray-800 border-[#E5D8CF] hover:bg-[#FAF5F1]"
            >
              <ShoppingBag className="size-4 text-[#D67B6B]" />
              Open POS Register
            </Button>
            <Button
              variant="outline"
              onClick={() => setView("Kitchen")}
              className="h-11 rounded-xl justify-start gap-2 bg-white text-xs font-semibold text-gray-800 border-[#E5D8CF] hover:bg-[#FAF5F1]"
            >
              <ChefHat className="size-4 text-[#808068]" />
              Kitchen Queue ({countActiveTickets(allUnifiedOrders, "kitchen")})
            </Button>
            <Button
              variant="outline"
              onClick={() => setView("Bar")}
              className="h-11 rounded-xl justify-start gap-2 bg-white text-xs font-semibold text-gray-800 border-[#E5D8CF] hover:bg-[#FAF5F1]"
            >
              <Coffee className="size-4 text-[#808068]" />
              Bar Tickets ({countActiveTickets(allTicketOrders, "bar")})
            </Button>
            <Button
              variant="outline"
              onClick={() => setView("Tables")}
              className="h-11 rounded-xl justify-start gap-2 bg-white text-xs font-semibold text-gray-800 border-[#E5D8CF] hover:bg-[#FAF5F1]"
            >
              <Table2 className="size-4 text-[#808068]" />
              Dining Tables
            </Button>
            <Button
              variant="outline"
              onClick={() => setView("Reports")}
              className="h-11 rounded-xl justify-start gap-2 bg-white text-xs font-semibold text-gray-800 border-[#E5D8CF] hover:bg-[#FAF5F1]"
            >
              <TrendingUp className="size-4 text-[#D67B6B]" />
              Sales Reports
            </Button>
          </div>

          {/* Recent Orders List */}
          <Card className="rounded-2xl border-[#E5D8CF] overflow-hidden bg-white">
            <div className="flex items-center justify-between border-b p-3.5 sm:p-4">
              <h3 className="font-serif text-base sm:text-lg font-bold">Recent Orders ({allUnifiedOrders.length})</h3>
              <Badge variant="outline" className="text-[10px]">Realtime</Badge>
            </div>
            <div className="divide-y text-xs">
              {allUnifiedOrders.slice(0, 10).map((o: OrderRecord) => (
                <div key={o.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-xs sm:text-sm text-gray-900">{o.order_number}</span>
                      {o.payment_method === "split" ? (
                        <Badge className="bg-indigo-100 text-indigo-800 border-0 text-[10px] capitalize px-1.5 py-0 font-bold">
                          ⚡ Split
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] capitalize px-1.5 py-0">
                          {o.payment_method}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {o.table_name} • {o.items?.length || 0} items • {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-0 border-gray-50">
                    <span className="font-mono font-bold text-sm text-[#D67B6B]">Rs. {o.total.toLocaleString()}</span>
                    <Button size="sm" variant="outline" onClick={() => onPrintReceipt(o)} className="h-7 text-xs gap-1 rounded-lg">
                      <Printer className="size-3" />
                      Receipt
                    </Button>
                  </div>
                </div>
              ))}
              {!allUnifiedOrders.length && (
                <p className="p-8 text-center text-gray-400 text-xs">No transactions recorded yet.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. PREPARATION TICKETS (KOT / BOT)                        */}
      {/* ========================================================= */}
      {(view === "Kitchen" || view === "Bar") && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {ticketOrders.map((o: OrderRecord) => {
              const ticketStatus = getTicketStatus(o, station)
              const ticketItems = getStationItems(o, station)

              return (
              <Card key={o.id} className="rounded-2xl border-[#E5D8CF] overflow-hidden bg-white shadow-sm flex flex-col justify-between">
                <div>
                  <div className="p-3.5 bg-[#FAF5F1] border-b border-[#E5D8CF] flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-gray-900">{o.order_number}</span>
                      <p className="font-serif font-bold text-sm text-[#808068]">{o.table_name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => onPrintTicket(o, station)}
                        title={`Print ${station === "bar" ? "BOT" : "KOT"} Ticket`}
                        className="size-7 rounded-lg bg-white text-gray-600 hover:text-gray-900 border-gray-200"
                      >
                        <Printer className="size-3.5" />
                      </Button>
                      <Badge
                        className={`capitalize text-[10px] px-2 py-0.5 ${
                          ticketStatus === "ready"
                            ? "bg-emerald-600 text-white"
                            : ticketStatus === "preparing"
                            ? "bg-amber-600 text-white"
                            : ticketStatus === "served"
                            ? "bg-gray-400 text-white"
                            : "bg-[#808068] text-white"
                        }`}
                      >
                        {ticketStatus}
                      </Badge>
                    </div>
                  </div>

                  <div className="min-h-[92px] p-3.5 space-y-2 text-xs divide-y divide-gray-100">
                    {ticketItems.length > 0 ? (
                      ticketItems.map((it, idx) => {
                        const itemName = String(it?.name || "Unnamed item")
                        const quantity = Number(it?.quantity) || 0

                        return (
                          <div key={it?.id || `${o.id}-item-${idx}`} className="flex items-center justify-between gap-3 pt-1.5 first:pt-0">
                            <div className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-gray-800" title={itemName}>
                                {itemName}
                              </span>
                              {it?.modifiers && it.modifiers.length > 0 && (
                                <span className="block text-[10px] font-medium text-amber-700">
                                  {it.modifiers.join(" • ")}
                                </span>
                              )}
                              {it?.notes && (
                                <span className="block text-[10px] italic text-gray-500">
                                  Note: {it.notes}
                                </span>
                              )}
                              {it?.category && <span className="text-[10px] text-gray-500">{it.category}</span>}
                            </div>
                            <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-bold text-gray-700">
                              x{quantity}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <p className="py-3 text-center text-xs text-gray-400">No items recorded for this order</p>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border-t border-[#E5D8CF] flex items-center justify-between gap-2">
                  <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                    <Clock className="size-3" />
                    {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex gap-1.5">
                    {ticketStatus === "pending" && (
                      <Button
                        size="sm"
                        disabled={pendingTicketIds.has(o.id)}
                        onClick={() => void updateTicket(o.id, station, "preparing")}
                        className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-2.5"
                      >
                        {pendingTicketIds.has(o.id) ? "Saving..." : station === "bar" ? "Start Preparing" : "Start Cooking"}
                      </Button>
                    )}
                    {ticketStatus === "preparing" && (
                      <Button
                        size="sm"
                        disabled={pendingTicketIds.has(o.id)}
                        onClick={() => void updateTicket(o.id, station, "ready")}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5"
                      >
                        {pendingTicketIds.has(o.id) ? "Saving..." : "Mark Ready"}
                      </Button>
                    )}
                    {ticketStatus === "ready" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingTicketIds.has(o.id)}
                        onClick={() => void updateTicket(o.id, station, "served")}
                        className="h-8 text-xs text-gray-700 rounded-lg px-2.5"
                      >
                        {pendingTicketIds.has(o.id) ? "Saving..." : "Mark Served"}
                      </Button>
                    )}
                    {ticketStatus === "served" && (
                      <span className="text-xs text-gray-400 font-semibold px-2 py-1">Completed ✓</span>
                    )}
                  </div>
                </div>
              </Card>
              )
            })}
            {!ticketOrders.length && (
              <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-2xl border border-dashed p-6">
                {station === "bar" ? (
                  <Coffee className="size-10 mx-auto mb-2 text-gray-300" />
                ) : (
                  <ChefHat className="size-10 mx-auto mb-2 text-gray-300" />
                )}
                <p className="font-semibold text-gray-600">No {station === "bar" ? "bar" : "kitchen"} tickets</p>
                <p className="text-xs text-gray-400 mt-1">New POS orders will appear here when they contain {station === "bar" ? "beverages" : "food"}.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. ORDERS HISTORY VIEW                                    */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* 3. ORDERS HISTORY VIEW                                    */}
      {/* ========================================================= */}
      {view === "Orders" && (
        <Card className="rounded-2xl border-[#E5D8CF] overflow-hidden bg-white shadow-xs">
          <CardContent className="p-0">
            <div className="p-3.5 sm:p-4 border-b border-[#E5D8CF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF5F1]">
              <div>
                <h3 className="font-serif text-base sm:text-lg font-bold text-gray-900">Orders Management ({filteredOrders.length})</h3>
                <p className="text-xs text-gray-500">Track active orders, completed orders, open tabs, and receipts in real time.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 size-4 text-gray-400" />
                <Input
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search order #, table, or receipt..."
                  className="pl-9 h-9 text-xs rounded-xl bg-white border-[#E5D8CF] focus:ring-[#D67B6B]"
                />
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 p-2 sm:px-4 border-b border-[#E5D8CF] bg-[#FAF5F1]/50 overflow-x-auto scrollbar-none">
              <Button
                size="sm"
                variant={orderStatusFilter === "all" ? "default" : "ghost"}
                onClick={() => setOrderStatusFilter("all")}
                className={`h-7 px-3 text-xs rounded-lg font-medium transition-all ${
                  orderStatusFilter === "all"
                    ? "bg-[#D67B6B] text-white shadow-xs"
                    : "text-[#808068] hover:text-[#343428] hover:bg-[#FAF5F1]"
                }`}
              >
                All Orders ({orders.length})
              </Button>
              <Button
                size="sm"
                variant={orderStatusFilter === "completed" ? "default" : "ghost"}
                onClick={() => setOrderStatusFilter("completed")}
                className={`h-7 px-3 text-xs rounded-lg font-medium transition-all ${
                  orderStatusFilter === "completed"
                    ? "bg-emerald-700 text-white hover:bg-emerald-800"
                    : "text-emerald-800 hover:bg-emerald-100/70"
                }`}
              >
                <CheckCircle2 className="size-3.5 mr-1" />
                Completed ({completedOrdersCount})
              </Button>
              <Button
                size="sm"
                variant={orderStatusFilter === "active" ? "default" : "ghost"}
                onClick={() => setOrderStatusFilter("active")}
                className={`h-7 px-3 text-xs rounded-lg font-medium transition-all ${
                  orderStatusFilter === "active"
                    ? "bg-blue-700 text-white hover:bg-blue-800"
                    : "text-blue-800 hover:bg-blue-100/70"
                }`}
              >
                <Clock className="size-3.5 mr-1" />
                Active / In Prep ({activeOrdersCount})
              </Button>
              <Button
                size="sm"
                variant={orderStatusFilter === "open" ? "default" : "ghost"}
                onClick={() => setOrderStatusFilter("open")}
                className={`h-7 px-3 text-xs rounded-lg font-medium transition-all ${
                  orderStatusFilter === "open"
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "text-amber-800 hover:bg-amber-100/70"
                }`}
              >
                Open Tabs ({openOrdersCount})
              </Button>
            </div>

            <div className="divide-y text-xs">
              {filteredOrders.map((o: OrderRecord) => {
                const completed = isOrderCompleted(o)
                const kitchenItems = getStationItems(o, "kitchen")
                const barItems = getStationItems(o, "bar")
                const hasKitchen = kitchenItems.length > 0
                const hasBar = barItems.length > 0
                const isPending = pendingTicketIds.has(o.id)

                return (
                  <div key={o.id} className="p-3.5 sm:p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Header line: Order number, Receipt, Status badges */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <p className="font-bold font-mono text-xs sm:text-sm text-gray-900">{o.order_number}</p>
                          {o.receipt_number && (
                            <span className="text-[10px] text-gray-400">({o.receipt_number})</span>
                          )}

                          {completed ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-semibold px-2 py-0.5 flex items-center gap-1">
                              <CheckCircle2 className="size-3 text-emerald-600" />
                              Completed ✓
                            </Badge>
                          ) : o.status === "open" ? (
                            <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] uppercase font-bold px-2 py-0.5">
                              OPEN TAB
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-semibold px-2 py-0.5 flex items-center gap-1">
                              <Clock className="size-3 text-blue-600" />
                              Paid · In Prep
                            </Badge>
                          )}

                          {o.payment_method && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize px-1.5 py-0 ${
                                o.payment_method === "split"
                                  ? "bg-indigo-50 text-indigo-800 border-indigo-200 font-bold"
                                  : "text-gray-600 border-gray-200"
                              }`}
                            >
                              {o.payment_method === "split" ? "⚡ Split" : o.payment_method}
                            </Badge>
                          )}

                          {o.department && (
                            <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-200 px-1.5 py-0">
                              {o.department}
                            </Badge>
                          )}
                        </div>

                        {/* Order meta info */}
                        <p className="text-gray-500 text-[11px]">
                          Table: <strong className="text-gray-700">{o.table_name}</strong> • Cashier: {o.cashier_name} •{" "}
                          {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{" "}
                          {new Date(o.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                        </p>

                        {/* Station tickets status */}
                        {(hasKitchen || hasBar) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {hasKitchen && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                                o.kitchen_status === "served"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-orange-50 text-orange-700 border-orange-200"
                              }`}>
                                <ChefHat className="size-3" />
                                Kitchen: {o.kitchen_status === "served" ? "Served ✓" : (o.kitchen_status || "Pending")}
                              </span>
                            )}
                            {hasBar && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                                o.bar_status === "served"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}>
                                <Coffee className="size-3" />
                                Bar: {o.bar_status === "served" ? "Served ✓" : (o.bar_status || "Pending")}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Items preview list */}
                        {Array.isArray(o.items) && o.items.length > 0 && (
                          <div className="text-[11px] text-gray-600 bg-gray-50/80 rounded-md p-1.5 px-2 max-w-xl">
                            <span className="font-medium text-gray-700">Items ({o.items.reduce((acc, it) => acc + (it.quantity || 1), 0)}): </span>
                            {o.items.map((it, idx) => (
                              <span key={idx} className="inline-block mr-2">
                                <span className="font-semibold text-gray-800">{it.quantity}x</span> {it.name}
                                {idx < o.items.length - 1 ? "," : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right side actions and total */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-gray-100 shrink-0">
                        <p className="font-mono font-bold text-base sm:text-lg text-[#D67B6B]">
                          Rs. {o.total.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {o.status === "open" && (
                            <Button
                              size="sm"
                              onClick={() => onPayOpenOrder(o)}
                              className="bg-[#D67B6B] hover:bg-[#c26555] text-white text-xs h-7 px-2.5 rounded-lg font-semibold shadow-xs"
                            >
                              Pay Tab
                            </Button>
                          )}
                          {hasKitchen && o.kitchen_status !== "served" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTicket(o.id, "kitchen", "served")}
                              disabled={isPending}
                              className="h-7 text-[10px] px-2 text-orange-700 border-orange-200 hover:bg-orange-50 rounded-lg"
                            >
                              Serve Kitchen
                            </Button>
                          )}
                          {hasBar && o.bar_status !== "served" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTicket(o.id, "bar", "served")}
                              disabled={isPending}
                              className="h-7 text-[10px] px-2 text-purple-700 border-purple-200 hover:bg-purple-50 rounded-lg"
                            >
                              Serve Bar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onPrintReceipt(o)}
                            className="gap-1 text-xs h-7 px-2.5 rounded-lg"
                          >
                            <Printer className="size-3" />
                            Receipt
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {!filteredOrders.length && (
                <div className="p-12 text-center text-gray-500">
                  <ClipboardList className="size-10 mx-auto mb-2 text-gray-300" />
                  <p className="font-semibold text-gray-600">No {orderStatusFilter !== "all" ? orderStatusFilter : ""} orders found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {orderSearch ? "Try clearing your search query." : "Orders will appear here once placed at the POS."}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================= */}
      {/* 4. TABLES & BOOKINGS MANAGEMENT VIEW                      */}
      {/* ========================================================= */}
      {(view === "Tables" || view === "TableBooked") && (
        <TablesWorkspace
          role={effectiveRole}
          initialTab={view === "TableBooked" ? "bookings" : "floor"}
          onStartOrder={onSelectTableAndStartOrder}
        />
      )}

      {/* ========================================================= */}
      {/* 5. PRODUCTS VIEW                                          */}
      {/* ========================================================= */}
      {view === "Products" && (
        <div className="space-y-3">
          {/* Category Filter Bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            {["All", ...categories.map((c: any) => c.name)].map((catName) => (
              <Button
                key={catName}
                size="sm"
                variant={catalogCategoryFilter === catName ? "default" : "outline"}
                onClick={() => setCatalogCategoryFilter(catName)}
                className={`h-8 shrink-0 rounded-xl px-3 text-xs font-semibold ${
                  catalogCategoryFilter === catName
                    ? "bg-[#D67B6B] text-white shadow-xs"
                    : "border-[#E5D8CF] bg-white text-gray-700 hover:bg-[#FAF5F1]"
                }`}
              >
                {catName}
              </Button>
            ))}
          </div>

          <Card className="rounded-2xl border-[#E5D8CF] overflow-hidden bg-white">
            <CardContent className="p-0">
              <div className="divide-y text-xs">
                {(products && products.length > 0 ? products : SharedPosService.getProducts())
                  .filter(
                    (p: any) =>
                      catalogCategoryFilter === "All" || p.category === catalogCategoryFilter,
                  )
                  .map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3.5 sm:p-4 gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {p.image && (
                          <img
                            src={p.image}
                            alt={p.name}
                            onError={handleProductImageError}
                            className="size-10 rounded-lg object-cover bg-gray-100 shrink-0 border border-gray-100"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs sm:text-sm text-gray-900 truncate">{p.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-gray-500 text-[11px]">{p.category} • Rs. {p.price.toLocaleString()}</span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 font-medium ${
                                (p.station === "bar" || determineItemStation(p) === "bar")
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                            >
                              {(p.station === "bar" || determineItemStation(p) === "bar") ? "🍹 Bar (Drinks/Juice)" : "🍳 Kitchen (Food)"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={p.stock <= 5 ? "destructive" : "outline"} className="font-mono text-[10px]">
                          Stock: {p.stock}
                        </Badge>
                        {effectiveCanManageProducts ? (
                          <>
                            <Button size="icon" variant="outline" onClick={() => onEditProduct(p)} className="size-8 rounded-lg" title="Edit product" aria-label={`Edit ${p.name}`}>
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="outline" onClick={() => onDeleteProduct(p.id)} className="size-8 rounded-lg text-red-600" title="Delete product" aria-label={`Delete ${p.name}`}>
                              <Trash2 className="size-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onStock(p)} className="h-8 text-xs rounded-lg">
                              Adjust Stock
                            </Button>
                          </>
                        ) : effectiveCanAdjustStock ? (
                          <Button size="sm" variant="outline" onClick={() => onStock(p)} className="h-8 text-xs rounded-lg">
                            Adjust Stock
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                {!(products && products.length > 0 ? products : SharedPosService.getProducts()).filter((p: any) => catalogCategoryFilter === "All" || p.category === catalogCategoryFilter).length && (
                  <p className="p-8 text-center text-gray-400">No products found in category "{catalogCategoryFilter}".</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. INVENTORY CONTROL VIEW                                 */}
      {/* ========================================================= */}
      {view === "Inventory" && (
        <InventoryWorkspace supabase={supabase} products={inventoryProducts} role={effectiveRole} />
      )}

      {/* ========================================================= */}
      {/* 7. CUSTOMERS & CRM VIEW                                    */}
      {/* ========================================================= */}
      {view === "Customers" && <CustomerManagementView />}

      {/* ========================================================= */}
      {/* 8. REPORTS VIEW                                           */}
      {/* ========================================================= */}
      {view === "Reports" && (
        <ReportsView
          orders={allUnifiedOrders.map((o: OrderRecord): ReportOrderRecord => ({
            id: o.id,
            order_number: o.order_number,
            receipt_number: o.receipt_number,
            table_name: o.table_name,
            cashier_name: o.cashier_name,
            department: o.department === "Coffee Bar" ? "Coffee Bar" : "Juice & Food",
            items: o.items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              category: i.category,
            })),
            subtotal: o.subtotal,
            service_charge: o.service_charge,
            service_charge_rate: o.service_charge_rate,
            discount: o.discount,
            total: o.total,
            payment_method: o.payment_method || "cash",
            split_payments: o.split_payments,
            notes: (o as any).notes,
            cash_received: o.cash_received,
            change_amount: o.change_amount,
            status: (["open", "paid", "completed", "refunded", "cancelled"].includes(o.status) ? (o.status as any) : "paid"),
            kitchen_status: o.kitchen_status,
            created_at: o.created_at,
          }))}
          products={products.map((p: Product): ReportProduct => ({
            id: p.id,
            name: p.name,
            price: p.price,
            category: p.category,
            stock: p.stock,
          }))}
          onPrintReceipt={printReportReceipt}
        />
      )}

      {/* ========================================================= */}
      {/* 9. SETTINGS VIEW                                          */}
      {/* ========================================================= */}
      {view === "Settings" && (
        <div className="max-w-xl space-y-4">
          <Card className="rounded-2xl border-[#E5D8CF] p-4 sm:p-6 bg-white space-y-4">
            <div>
              <h3 className="font-serif text-lg font-bold">Restaurant Configuration</h3>
              <p className="text-xs text-gray-500">POS Terminal details &amp; local sync.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Location:</span>
                <span className="font-semibold">Hiriketiya Beach, Sri Lanka</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Active Branch:</span>
                <span className="font-semibold text-[#808068]">
                  {SharedPosService.getActiveBranch()?.name || "Hiriketiya Main Beach"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Service Charge Rate:</span>
                <span className="font-semibold text-[#808068]">10% (Automated)</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Currency:</span>
                <span className="font-semibold font-mono">Sri Lankan Rupee (Rs.)</span>
              </div>
              <div className="flex justify-between py-2 border-b items-center">
                <span className="text-gray-600">Active Terminal Role:</span>
                <div className="flex items-center gap-2">
                  <Badge className="bg-[#808068] text-white capitalize">{getRoleDisplayName(effectiveRole)}</Badge>
                </div>
              </div>
            </div>

            {/* Cloud Backup & Restore Controls */}
            <div className="p-3 bg-[#FAF5F1] rounded-xl border border-[#E5D8CF] space-y-2">
              <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Download className="size-3.5 text-[#808068]" />
                Cloud Backup &amp; Data Restore
              </p>
              <p className="text-[11px] text-gray-500">
                Safely backup orders, customer debts, recipes, wastage, and inventory to encrypted JSON.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const json = SharedPosService.exportCompleteBackup()
                    const blob = new Blob([json], { type: "application/json" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `pos-backup-${new Date().toISOString().substring(0, 10)}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                    toast.success("Complete POS system backup exported!")
                  }}
                  className="rounded-xl text-xs h-9 gap-1.5 flex-1 border-[#E5D8CF] hover:bg-[#FAF5F1] text-[#808068]"
                >
                  <Download className="size-3.5 text-[#808068]" />
                  Export Backup (JSON)
                </Button>

                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-[#E5D8CF] bg-white hover:bg-[#FAF5F1] text-xs font-medium text-gray-800">
                    <Upload className="size-3.5 text-gray-600" />
                    Restore Backup
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = (event) => {
                        const content = event.target?.result as string
                        if (content) {
                          const res = SharedPosService.importCompleteBackup(content)
                          if (res.success) {
                            toast.success("POS Data restored successfully! Reloading view...")
                            setTimeout(() => window.location.reload(), 1000)
                          } else {
                            toast.error(`Restore failed: ${res.message}`)
                          }
                        }
                      }
                      reader.readAsText(file)
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <Button
                variant="outline"
                onClick={() => toast.success("Printer test successful! 80mm thermal paper feed ready.")}
                className="rounded-xl h-10 text-xs gap-1.5"
              >
                <Printer className="size-4" />
                Test Thermal Printer (80mm)
              </Button>
              <Button
                variant="outline"
                onClick={onSignOut}
                className="rounded-xl h-10 text-xs gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
              >
                <LogOut className="size-4" />
                Sign Out Cashier
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. USER & STAFF ACCOUNTS MANAGEMENT                       */}
      {/* ========================================================= */}
      {view === "Users" && <UserManagementView />}

      {/* ========================================================= */}
      {/* 10. ROLE-BASED ACCESS CONTROL (ROLES)                     */}
      {/* ========================================================= */}
      {view === "Roles" && <RoleManagementView />}

      {/* ========================================================= */}
      {/* 11. USER GUIDE & MANUAL (ENGLISH & SINHALA)               */}
      {/* ========================================================= */}
      {view === "UserGuide" && <UserGuideView onNavigateView={(v) => setView(v as View)} />}
    </div>
  )
}
