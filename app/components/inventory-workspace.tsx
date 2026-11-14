"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { AlertTriangle, Boxes, ChefHat, Pencil, Plus, RefreshCw, Search, ShoppingCart, SlidersHorizontal, Tag, Trash2, X, Truck, Phone, Mail, MapPin, DollarSign, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { normalizeRole } from "@/lib/rbac/permissions"
import {
  SharedPosService,
  type SharedIngredient,
  type SharedIngredientCategory,
  type SharedRecipeItem,
  type SharedPurchase,
  type SharedSupplier,
  type SharedWastageItem,
  type SharedStockAdjustment,
} from "@/lib/shared-pos-service"

type Dimension = "weight" | "volume" | "count"
type Ingredient = {
  id: string
  name: string
  dimension: Dimension
  base_unit: "g" | "ml" | "pcs"
  default_purchase_unit: string
  current_stock_base: number
  reorder_level_base: number
  category_id: string | null
}
type Category = { id: string; name: string }
type Product = { id: string; name: string; price: number }
type PurchaseLine = { ingredient_id: string; quantity: string; unit: string; unit_price: string }
type Purchase = { id: string; status: string; total_minor: number; created_at: string; purchase_items: { id: string }[] | null }
type RecipeLine = { ingredient_id: string; quantity: string; unit: string }

const TABS = [
  ["Stock", Boxes],
  ["Grocery Runs", ShoppingCart],
  ["Suppliers", Truck],
  ["Ingredients", Plus],
  ["Recipes", ChefHat],
  ["Wastage", Trash2],
  ["Adjustments", SlidersHorizontal],
] as const

const CONVERSION_FACTORS: Record<string, number> = {
  // Weight
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilo: 1000,
  kilogram: 1000,
  kilograms: 1000,

  // Volume
  ml: 1,
  milliliter: 1,
  millilitre: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,

  // Count
  pcs: 1,
  pc: 1,
  piece: 1,
  pieces: 1,
  item: 1,
  items: 1,
  unit: 1,
  units: 1,
  pack: 1,
  packs: 1,
  box: 1,
  boxes: 1,
  dozen: 12,
  doz: 12,
  tray: 30,
}

const baseUnitFor = (dimension: Dimension): Ingredient["base_unit"] =>
  dimension === "weight" ? "g" : dimension === "volume" ? "ml" : "pcs"

const unitsFor = (dimension: Dimension): string[] =>
  dimension === "weight" ? ["kg", "g"] : dimension === "volume" ? ["L", "ml"] : ["pcs", "dozen", "tray"]

const unitLabel = (u: string): string => {
  const norm = String(u || "").toLowerCase().trim()
  if (norm === "l" || norm === "liter" || norm === "litre") return "L (Liters)"
  if (norm === "ml") return "ml (Milliliters)"
  if (norm === "kg") return "kg (Kilograms)"
  if (norm === "g") return "g (Grams)"
  if (norm === "dozen") return "dozen (12 pcs)"
  if (norm === "tray") return "tray (30 pcs)"
  return `${u} (Pieces)`
}

const parseQuantity = (value: string | number): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const clean = String(value || "").trim().replace(",", ".")
  const n = Number(clean)
  return Number.isFinite(n) ? n : 0
}

const toBase = (quantity: number, unit: string): number => {
  const norm = String(unit || "").toLowerCase().trim()
  const factor = CONVERSION_FACTORS[norm] ?? 1
  return (Number(quantity) || 0) * factor
}

const fromBase = (quantityBase: number, unit: string): number => {
  const norm = String(unit || "").toLowerCase().trim()
  const factor = CONVERSION_FACTORS[norm] ?? 1
  return factor > 0 ? (Number(quantityBase) || 0) / factor : (Number(quantityBase) || 0)
}

function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID()
    } catch {}
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function displayStock(value: number, unit: Ingredient["base_unit"] | string) {
  const v = Number(value) || 0
  const normUnit = String(unit || "").toLowerCase().trim()
  const trim = (n: number) => {
    const rounded = Math.round(n * 100) / 100
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "")
  }

  // Weight
  if (normUnit === "g" || normUnit === "kg") {
    if (Math.abs(v) >= 1000) {
      return `${trim(v / 1000)} kg`
    }
    return `${trim(v)} g`
  }

  // Volume
  if (normUnit === "ml" || normUnit === "l" || normUnit === "liter" || normUnit === "litre") {
    if (Math.abs(v) >= 1000) {
      return `${trim(v / 1000)} L`
    }
    return `${trim(v)} ml`
  }

  // Count / default
  return `${trim(v)} ${unit || "pcs"}`
}

/** Native select: reliable on touch POS terminals and inside overlays (no portal / pointer-events traps). */
function NativeSelect({
  value,
  onChange,
  children,
  label,
  className = "",
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  label: string
  className?: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
    >
      {children}
    </select>
  )
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card className={`max-h-[92vh] w-full overflow-auto rounded-t-3xl sm:rounded-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{title}</CardTitle>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  )
}

export function InventoryWorkspace({
  supabase,
  products,
  role,
}: {
  supabase: SupabaseClient
  products: Product[]
  role: "admin" | "cashier"
}) {
  // Allow operators and staff to manage stock, recipes, and grocery runs seamlessly
  const canManage = true
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("Stock")

  // Initialize immediately from SharedPosService local storage cache
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    const local = SharedPosService.getIngredients()
    return local.map((i) => ({ ...i, category_id: i.category_id || null }))
  })
  const [categories, setCategories] = useState<Category[]>(() => {
    const local = SharedPosService.getIngredientCategories()
    return local.map((c) => ({ id: c.id, name: c.name }))
  })
  const [purchases, setPurchases] = useState<Purchase[]>(() => {
    const local = SharedPosService.getPurchases()
    return local.map((p) => ({
      id: p.id,
      status: p.status,
      total_minor: p.total_minor,
      created_at: p.created_at,
      purchase_items: p.purchase_items.map((pi) => ({ id: pi.id || pi.ingredient_id })),
    }))
  })
  const [recipes, setRecipes] = useState<Record<string, { ingredient_id: string; quantity_base: number }[]>>(() => {
    return SharedPosService.getRecipes()
  })

  const [suppliers, setSuppliers] = useState<SharedSupplier[]>(() => SharedPosService.getSuppliers())
  const [wastage, setWastage] = useState<SharedWastageItem[]>(() => SharedPosService.getWastage())
  const [adjustments, setAdjustments] = useState<SharedStockAdjustment[]>(() => SharedPosService.getAdjustments())

  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    category: "Produce & Greens",
    payment_terms: "Weekly Settlement",
    notes: "",
  })

  const [showAddWastage, setShowAddWastage] = useState(false)
  const [wastageForm, setWastageForm] = useState({
    item_type: "ingredient" as "ingredient" | "product",
    item_id: "",
    quantity: "1",
    unit: "kg",
    cost_loss: "1000",
    reason: "expired" as "expired" | "damaged" | "burnt_spilled" | "prep_error",
    reported_by: "Kitchen Station",
  })

  const [showAddAdjustment, setShowAddAdjustment] = useState(false)
  const [adjustmentForm, setAdjustmentForm] = useState({
    ingredient_id: "",
    new_stock: "",
    unit: "kg",
    reason: "physical_count" as "physical_count" | "shrinkage" | "calibration" | "other",
  })

  // Full product catalog for recipe configuration
  const [allProducts, setAllProducts] = useState<Product[]>(() => {
    const shared = SharedPosService.getProducts()
    const map = new Map<string, Product>()
    if (products && products.length > 0) {
      products.forEach((p) => map.set(p.id, p))
    }
    if (shared && shared.length > 0) {
      shared.forEach((p) => map.set(p.id, { id: p.id, name: p.name, price: p.price }))
    }
    return Array.from(map.values())
  })

  const [search, setSearch] = useState("")
  const [recipeSearch, setRecipeSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [ingredientOpen, setIngredientOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [adjusting, setAdjusting] = useState<Ingredient | null>(null)
  const [adjust, setAdjust] = useState({
    mode: "set" as "set" | "change",
    value: "",
    unit: "kg",
    reason: "Stock recount",
  })
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    category_id: "",
    current_stock: "",
    current_stock_unit: "kg",
    reorder_level: "",
    reorder_unit: "kg",
  })
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null)

  const [newCategory, setNewCategory] = useState("")
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    dimension: "weight" as Dimension,
    default_purchase_unit: "kg",
    initial_stock: "",
    initial_stock_unit: "kg",
    category_id: "",
    reorder_level: "",
    reorder_unit: "kg",
  })
  const [lines, setLines] = useState<PurchaseLine[]>([{ ingredient_id: "", quantity: "", unit: "kg", unit_price: "" }])
  const [supplier, setSupplier] = useState("")
  const [recipeLines, setRecipeLines] = useState<RecipeLine[]>([])

  const syncTimerRef = useRef<NodeJS.Timeout | null>(null)

  const areIngsEqual = (a: Ingredient[], b: Ingredient[]) => {
    if (a.length !== b.length) return false
    const mapB = new Map(b.map((item) => [item.id, item]))
    for (const itemA of a) {
      const itemB = mapB.get(itemA.id)
      if (!itemB) return false
      if (
        itemA.name !== itemB.name ||
        Number(itemA.current_stock_base) !== Number(itemB.current_stock_base) ||
        Number(itemA.reorder_level_base) !== Number(itemB.reorder_level_base) ||
        itemA.dimension !== itemB.dimension ||
        itemA.base_unit !== itemB.base_unit ||
        itemA.default_purchase_unit !== itemB.default_purchase_unit ||
        (itemA.category_id || null) !== (itemB.category_id || null)
      ) {
        return false
      }
    }
    return true
  }

  const areCatsEqual = (a: Category[], b: Category[]) => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i]?.id || a[i].name !== b[i]?.name) return false
    }
    return true
  }

  const load = useCallback(async () => {
    // 1. Immediately read from SharedPosService local storage cache
    const localIng = SharedPosService.getIngredients()
    const localCat = SharedPosService.getIngredientCategories()
    const localPur = SharedPosService.getPurchases()
    const localRec = SharedPosService.getRecipes()
    const localProds = SharedPosService.getProducts()

    const nextIngs = localIng.map((i) => ({ ...i, category_id: i.category_id || null }))
    setIngredients((prev) => (areIngsEqual(prev, nextIngs) ? prev : nextIngs))

    const nextCats = localCat.map((c) => ({ id: c.id, name: c.name }))
    setCategories((prev) => (areCatsEqual(prev, nextCats) ? prev : nextCats))

    const nextPurchases: Purchase[] = localPur.map((p) => ({
      id: p.id,
      status: p.status,
      total_minor: p.total_minor,
      created_at: p.created_at,
      purchase_items: p.purchase_items.map((pi) => ({ id: pi.id || pi.ingredient_id })),
    }))
    setPurchases(nextPurchases)
    setRecipes(localRec)

    // Update product list
    if (localProds && localProds.length > 0) {
      setAllProducts(localProds.map((p) => ({ id: p.id, name: p.name, price: p.price })))
    } else if (products && products.length > 0) {
      setAllProducts(products.map((p) => ({ id: p.id, name: p.name, price: p.price })))
    }

    setLoadError(null)

    // 2. If Supabase is available, merge cloud state smoothly without tearing down UI
    try {
      const [ing, cat, pur, rec] = await Promise.all([
        supabase
          .from("ingredients")
          .select("id,name,dimension,base_unit,default_purchase_unit,current_stock_base,reorder_level_base,category_id")
          .eq("is_archived", false)
          .order("name"),
        supabase.from("ingredient_categories").select("id,name").eq("is_active", true).order("sort_order").order("name"),
        supabase.from("purchases").select("id,status,total_minor,created_at,purchase_items(id)").order("created_at", { ascending: false }).limit(25),
        supabase.from("recipe_items").select("product_id,ingredient_id,quantity_base"),
      ])
      if (!ing.error && Array.isArray(ing.data)) {
        const cloudIng = ing.data.map((row: any) => ({
          ...row,
          current_stock_base: Number(row.current_stock_base) || 0,
          reorder_level_base: Number(row.reorder_level_base) || 0,
        }))
        const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
        const map = new Map<string, Ingredient>()
        const nameSet = new Set<string>()

        for (const c of cloudIng) {
          const localMatch = localIng.find((li) => li.id === c.id || norm(li.name) === norm(c.name))
          let currentStock = Number(c.current_stock_base) || 0
          // If cloud has 0 but local cache has a positive stock that was recently updated, preserve local and sync to cloud
          if (currentStock === 0 && localMatch && Number(localMatch.current_stock_base) > 0) {
            currentStock = Number(localMatch.current_stock_base)
            void supabase.from("ingredients").update({
              current_stock_base: currentStock,
              updated_at: new Date().toISOString(),
            }).eq("id", c.id)
          }
          const item: Ingredient = {
            id: c.id,
            name: c.name,
            dimension: c.dimension,
            base_unit: c.base_unit,
            default_purchase_unit: c.default_purchase_unit,
            current_stock_base: currentStock,
            reorder_level_base: Number(c.reorder_level_base) || 0,
            category_id: c.category_id || null,
          }
          map.set(item.id, item)
          nameSet.add(norm(item.name))
        }

        const isPurged = typeof window !== "undefined" && localStorage.getItem("pos_bulk_purged_v4") === "true"
        if (!isPurged) {
          for (const i of localIng) {
            const n = norm(i.name)
            if (!map.has(i.id) && !nameSet.has(n)) {
              map.set(i.id, { ...i, category_id: i.category_id || null })
              nameSet.add(n)
            }
          }
        }

        const mergedIngs = Array.from(map.values())
        setIngredients((prev) => (areIngsEqual(prev, mergedIngs) ? prev : mergedIngs))
        SharedPosService.setIngredients(mergedIngs)
      }
      if (!cat.error && Array.isArray(cat.data) && cat.data.length > 0) {
        const cloudCats: Category[] = cat.data.map((c: any) => ({ id: c.id, name: c.name }))
        const normCat = (s: string) => s.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "")
        const idMap = new Map<string, Category>()
        const nameMap = new Map<string, Category>()

        for (const c of cloudCats) {
          idMap.set(c.id, c)
          nameMap.set(normCat(c.name), c)
        }

        for (const lc of localCat) {
          const n = normCat(lc.name)
          if (!nameMap.has(n) && !idMap.has(lc.id)) {
            idMap.set(lc.id, { id: lc.id, name: lc.name })
            nameMap.set(n, { id: lc.id, name: lc.name })
          }
        }

        const mergedCats = Array.from(idMap.values())
        setCategories((prev) => (areCatsEqual(prev, mergedCats) ? prev : mergedCats))
        SharedPosService.setIngredientCategories(mergedCats)
      }
      if (!pur.error && Array.isArray(pur.data)) {
        const cloudPurchases = pur.data as unknown as Purchase[]
        setPurchases(cloudPurchases)
        SharedPosService.setPurchases(
          cloudPurchases.map((p) => ({
            id: p.id,
            status: (p.status === "draft" || p.status === "posted" || p.status === "void" ? p.status : "posted") as "draft" | "posted" | "void",
            total_minor: p.total_minor,
            created_at: p.created_at,
            purchase_items: (p.purchase_items || []).map((pi) => ({
              id: pi.id,
              ingredient_id: pi.id,
              quantity: 1,
              unit: "kg",
              quantity_base: 1,
              unit_price_minor: 0,
              total_price_minor: 0,
            })),
          }))
        )
      }
      if (!rec.error && Array.isArray(rec.data)) {
        const grouped: Record<string, { ingredient_id: string; quantity_base: number }[]> = {}
        for (const row of (rec.data as any[]) || []) {
          const item = { ingredient_id: row.ingredient_id, quantity_base: Number(row.quantity_base) }
          const pId = String(row.product_id).trim()
          ;(grouped[pId] ||= []).push(item)

          const prod = products.find((p) => p.id === pId || p.name.trim().toLowerCase() === pId.toLowerCase())
          if (prod && prod.name && prod.name !== pId) {
            ;(grouped[prod.name] ||= []).push(item)
          }
        }
        if (rec.data.length > 0) {
          setRecipes((prev) => ({ ...prev, ...grouped }))
          SharedPosService.setRecipes(grouped)
        } else if (typeof window !== "undefined" && localStorage.getItem("pos_bulk_purged_v4") === "true") {
          setRecipes({})
          SharedPosService.setRecipes({})
        }
      }
    } catch {}
  }, [supabase, products])

  // Sync external products prop
  useEffect(() => {
    if (products && products.length > 0) {
      setAllProducts((prev) => {
        const map = new Map<string, Product>()
        prev.forEach((p) => map.set(p.id, p))
        products.forEach((p) => map.set(p.id, p))
        return Array.from(map.values())
      })
    }
  }, [products])

  // Realtime live subscriptions & listeners
  useEffect(() => {
    void load()

    // 1. Live inventory subscriptions for instantaneous UI updates
    const unsubIngredients = SharedPosService.subscribeIngredients((ings) => {
      const next = ings.map((i) => ({ ...i, category_id: i.category_id || null }))
      setIngredients((prev) => (areIngsEqual(prev, next) ? prev : next))
    })
    const unsubCategories = SharedPosService.subscribeIngredientCategories((cats) => {
      const next = cats.map((c) => ({ id: c.id, name: c.name }))
      setCategories((prev) => (areCatsEqual(prev, next) ? prev : next))
    })
    const unsubRecipes = SharedPosService.subscribeRecipes((recs) => {
      setRecipes(recs)
    })
    const unsubPurchases = SharedPosService.subscribePurchases((purs) => {
      setPurchases(
        purs.map((p) => ({
          id: p.id,
          status: p.status,
          total_minor: p.total_minor,
          created_at: p.created_at,
          purchase_items: p.purchase_items.map((pi) => ({ id: pi.id || pi.ingredient_id })),
        }))
      )
    })
    const unsubProducts = SharedPosService.subscribeProducts((prods) => {
      if (Array.isArray(prods) && prods.length > 0) {
        setAllProducts(prods.map((p) => ({ id: p.id, name: p.name, price: p.price })))
      }
    })
    const unsubSuppliers = SharedPosService.subscribeSuppliers(setSuppliers)
    const unsubWastage = SharedPosService.subscribeWastage(setWastage)
    const unsubAdjustments = SharedPosService.subscribeAdjustments(setAdjustments)

    // 2. Realtime sync events (debounced to avoid multiple rapid rerenders / blinking)
    const onSync = () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      syncTimerRef.current = setTimeout(() => {
        void load()
      }, 300)
    }

    window.addEventListener("pos_realtime_sync", onSync)
    window.addEventListener("pos_realtime_inventory", onSync)
    window.addEventListener("pos_realtime_ingredients", onSync)
    window.addEventListener("pos_realtime_recipes", onSync)
    window.addEventListener("pos_realtime_purchases", onSync)
    window.addEventListener("pos_realtime_orders", onSync)
    window.addEventListener("pos_products_updated", onSync)
    window.addEventListener("pos_realtime_suppliers", onSync)
    window.addEventListener("pos_realtime_wastage", onSync)
    window.addEventListener("pos_realtime_adjustments", onSync)

    // 3. Supabase channel
    let channel: any
    try {
      channel = supabase
        .channel("inventory-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, onSync)
        .on("postgres_changes", { event: "*", schema: "public", table: "ingredient_categories" }, onSync)
        .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, onSync)
        .on("postgres_changes", { event: "*", schema: "public", table: "recipe_items" }, onSync)
        .subscribe()
    } catch {}

    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void load()
    }, 20000)
    const onVisible = () => document.visibilityState === "visible" && void load()
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      unsubIngredients()
      unsubCategories()
      unsubRecipes()
      unsubPurchases()
      unsubProducts()
      unsubSuppliers()
      unsubWastage()
      unsubAdjustments()
      window.removeEventListener("pos_realtime_sync", onSync)
      window.removeEventListener("pos_realtime_inventory", onSync)
      window.removeEventListener("pos_realtime_ingredients", onSync)
      window.removeEventListener("pos_realtime_recipes", onSync)
      window.removeEventListener("pos_realtime_purchases", onSync)
      window.removeEventListener("pos_realtime_orders", onSync)
      window.removeEventListener("pos_products_updated", onSync)
      window.removeEventListener("pos_realtime_suppliers", onSync)
      window.removeEventListener("pos_realtime_wastage", onSync)
      window.removeEventListener("pos_realtime_adjustments", onSync)
      if (channel) void supabase.removeChannel(channel)
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load, supabase])

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || "Uncategorised"

  const filtered = useMemo(
    () =>
      ingredients.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) &&
          (selectedCategory === "all" || item.category_id === selectedCategory),
      ),
    [ingredients, search, selectedCategory],
  )

  const lowStock = useMemo(
    () => ingredients.filter((item) => item.current_stock_base <= item.reorder_level_base),
    [ingredients],
  )

  // Helper to find recipe for a product by id or name
  const getProductRecipe = useCallback(
    (product: Product) => {
      if (recipes[product.id] && recipes[product.id].length > 0) return recipes[product.id]
      const byName = Object.entries(recipes).find(
        ([key]) => key.toLowerCase().trim() === product.name.toLowerCase().trim(),
      )
      if (byName && byName[1]?.length > 0) return byName[1]
      return undefined
    },
    [recipes],
  )

  const readyRecipesCount = useMemo(() => {
    return allProducts.filter((p) => Boolean(getProductRecipe(p)?.length)).length
  }, [allProducts, getProductRecipe])

  const filteredProducts = useMemo(() => {
    if (!recipeSearch.trim()) return allProducts
    const q = recipeSearch.toLowerCase().trim()
    return allProducts.filter((p) => p.name.toLowerCase().includes(q))
  }, [allProducts, recipeSearch])

  async function addCategory() {
    const name = newCategory.trim()
    if (!name) return toast.error("Enter a category name")
    setBusy(true)
    const id = safeUUID()
    const catObj: SharedIngredientCategory = { id, name, sort_order: (categories.length + 1) * 10 }

    // Save to SharedPosService (persists + broadcasts to all open tabs)
    await SharedPosService.saveIngredientCategory(catObj)

    setCategories((prev) => [...prev.filter((c) => c.id !== id), { id: catObj.id, name: catObj.name }])
    setBusy(false)
    toast.success(`Category “${name}” added`)
    setNewCategory("")
    setNewIngredient((current) => ({ ...current, category_id: catObj.id }))
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`Remove category “${category.name}”? Ingredients keep their data and become uncategorised.`)) return
    await SharedPosService.removeIngredientCategory(category.id)
    setCategories((prev) => prev.filter((c) => c.id !== category.id))
    if (selectedCategory === category.id) setSelectedCategory("all")
    toast.success(`Category “${category.name}” removed`)
  }

  function openAdjustModal(item: Ingredient) {
    setAdjusting(item)
    const bestUnit = item.current_stock_base >= 1000 ? unitsFor(item.dimension)[0] : item.base_unit
    const curStock = item.current_stock_base >= 1000
      ? String(Number((item.current_stock_base / 1000).toFixed(2)))
      : String(item.current_stock_base)
    setAdjust({
      mode: "set",
      value: curStock,
      unit: bestUnit,
      reason: "Physical count / update",
    })
  }

  function openEditIngredient(item: Ingredient) {
    setEditingIngredient(item)
    const bestUnit = item.current_stock_base >= 1000 ? unitsFor(item.dimension)[0] : item.base_unit
    const curStock = item.current_stock_base >= 1000
      ? String(Number((item.current_stock_base / 1000).toFixed(2)))
      : String(item.current_stock_base)
    const reorderVal = item.reorder_level_base >= 1000
      ? String(Number((item.reorder_level_base / 1000).toFixed(2)))
      : String(item.reorder_level_base)
    const reorderUnit = item.reorder_level_base >= 1000 ? unitsFor(item.dimension)[0] : item.base_unit

    setEditForm({
      name: item.name,
      category_id: item.category_id || "",
      current_stock: curStock,
      current_stock_unit: bestUnit,
      reorder_level: reorderVal,
      reorder_unit: reorderUnit,
    })
  }

  async function addIngredient() {
    const name = newIngredient.name.trim()
    if (!name) return toast.error("Enter an ingredient name")

    const initialStockBase = newIngredient.initial_stock.trim()
      ? toBase(parseQuantity(newIngredient.initial_stock), newIngredient.initial_stock_unit || newIngredient.default_purchase_unit)
      : 0
    if (!Number.isFinite(initialStockBase) || initialStockBase < 0) {
      return toast.error("Initial stock must be a non-negative number")
    }

    const reorderBase = newIngredient.reorder_level.trim()
      ? toBase(parseQuantity(newIngredient.reorder_level), newIngredient.reorder_unit || newIngredient.default_purchase_unit)
      : 0
    if (!Number.isFinite(reorderBase) || reorderBase < 0) {
      return toast.error("Reorder level must be a non-negative number")
    }

    setBusy(true)
    const id = safeUUID()
    const itemObj: SharedIngredient = {
      id,
      name,
      dimension: newIngredient.dimension,
      base_unit: baseUnitFor(newIngredient.dimension),
      default_purchase_unit: newIngredient.default_purchase_unit,
      category_id: newIngredient.category_id || null,
      current_stock_base: initialStockBase,
      reorder_level_base: reorderBase,
    }

    await SharedPosService.saveIngredient(itemObj)
    setIngredients((prev) => [...prev.filter((i) => i.id !== id), itemObj])
    setBusy(false)
    toast.success(`${name} added with ${displayStock(initialStockBase, itemObj.base_unit)} initial stock`)
    setIngredientOpen(false)
    setNewIngredient({
      name: "",
      dimension: "weight",
      default_purchase_unit: "kg",
      initial_stock: "",
      initial_stock_unit: "kg",
      category_id: "",
      reorder_level: "",
      reorder_unit: "kg",
    })
    await load()
  }

  async function postAdjustment() {
    if (!adjusting) return
    const val = parseQuantity(adjust.value)
    if (!Number.isFinite(val)) return toast.error("Enter a valid quantity")

    setBusy(true)
    let newStockBase = 0
    let deltaBase = 0

    if (adjust.mode === "set") {
      newStockBase = Math.max(0, toBase(val, adjust.unit))
      deltaBase = newStockBase - adjusting.current_stock_base
      await SharedPosService.setIngredientStock(adjusting.id, newStockBase, adjust.reason)
    } else {
      deltaBase = toBase(val, adjust.unit)
      newStockBase = Math.max(0, adjusting.current_stock_base + deltaBase)
      await SharedPosService.adjustIngredientStock(adjusting.id, deltaBase, adjust.reason)
    }

    setIngredients((prev) =>
      prev.map((i) => (i.id === adjusting.id ? { ...i, current_stock_base: newStockBase } : i))
    )

    setBusy(false)
    toast.success(`${adjusting.name} stock updated to ${displayStock(newStockBase, adjusting.base_unit)}`)
    setAdjusting(null)
    await load()
  }

  async function deleteIngredient(item: Ingredient) {
    if (!window.confirm(`Delete ingredient “${item.name}”? This will remove it from all recipes and stock lists.`)) return
    setBusy(true)
    await SharedPosService.deleteIngredient(item.id)
    setIngredients((prev) => prev.filter((i) => i.id !== item.id))
    setBusy(false)
    toast.success(`Ingredient “${item.name}” deleted`)
    await load()
  }

  async function updateIngredient() {
    if (!editingIngredient) return
    const name = editForm.name.trim()
    if (!name) return toast.error("Enter an ingredient name")

    const newStockBase = editForm.current_stock.trim()
      ? toBase(parseQuantity(editForm.current_stock), editForm.current_stock_unit)
      : editingIngredient.current_stock_base
    if (!Number.isFinite(newStockBase) || newStockBase < 0) {
      return toast.error("Current stock must be a non-negative number")
    }

    const reorderBase = editForm.reorder_level.trim()
      ? toBase(parseQuantity(editForm.reorder_level), editForm.reorder_unit)
      : editingIngredient.reorder_level_base
    if (!Number.isFinite(reorderBase) || reorderBase < 0) {
      return toast.error("Reorder level must be a non-negative number")
    }

    setBusy(true)
    const updated: SharedIngredient = {
      id: editingIngredient.id,
      name,
      dimension: editingIngredient.dimension,
      base_unit: editingIngredient.base_unit,
      default_purchase_unit: editingIngredient.default_purchase_unit,
      current_stock_base: newStockBase,
      reorder_level_base: reorderBase,
      category_id: editForm.category_id || null,
    }

    await SharedPosService.saveIngredient(updated)
    setIngredients((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    setBusy(false)
    setEditingIngredient(null)
    toast.success(`Ingredient “${name}” updated (${displayStock(newStockBase, updated.base_unit)})`)
    await load()
  }

  async function handleClearBulkData() {
    if (
      !window.confirm(
        "Are you sure you want to clear all inventory data? This will reset ingredients, recipes, grocery runs, wastage, and adjustments to a clean slate (0)."
      )
    )
      return
    setBusy(true)
    await SharedPosService.clearBulkInventory()
    setIngredients([])
    setRecipes({})
    setPurchases([])
    setWastage([])
    setAdjustments([])
    setBusy(false)
    toast.success("Bulk inventory data cleared. Clean slate ready.")
    await load()
  }

  async function clearRecipe() {
    if (!recipeProduct) return
    if (!window.confirm(`Remove recipe for “${recipeProduct.name}”?`)) return
    setBusy(true)
    await SharedPosService.saveRecipe(recipeProduct.id, [])
    if (recipeProduct.name && recipeProduct.name !== recipeProduct.id) {
      await SharedPosService.saveRecipe(recipeProduct.name, [])
    }
    setRecipes((prev) => {
      const next = { ...prev }
      delete next[recipeProduct.id]
      if (recipeProduct.name) delete next[recipeProduct.name]
      return next
    })
    setBusy(false)
    setRecipeProduct(null)
    toast.success(`Recipe removed for ${recipeProduct.name}`)
    await load()
  }

  function updateLine(index: number, patch: Partial<PurchaseLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const lineTotalMinor = (line: PurchaseLine) =>
    Math.round(parseQuantity(line.quantity || "0") * parseQuantity(line.unit_price || "0") * 100)

  async function postPurchase() {
    const valid = lines.filter((line) => line.ingredient_id && parseQuantity(line.quantity) > 0)
    if (!valid.length) return toast.error("Add at least one ingredient with a positive quantity")
    if (
      valid.some(
        (line) => !Number.isFinite(parseQuantity(line.unit_price || "0")) || parseQuantity(line.unit_price || "0") < 0,
      )
    )
      return toast.error("Check the prices")
    const total = valid.reduce((sum, line) => sum + lineTotalMinor(line), 0)
    setBusy(true)

    const purchaseId = safeUUID()
    const items = valid.map((line) => {
      const quantity = parseQuantity(line.quantity)
      return {
        id: safeUUID(),
        ingredient_id: line.ingredient_id,
        quantity,
        unit: line.unit,
        quantity_base: toBase(quantity, line.unit),
        unit_price_minor: Math.round(parseQuantity(line.unit_price || "0") * 100),
        total_price_minor: lineTotalMinor(line),
      }
    })

    const purchaseRecord: SharedPurchase = {
      id: purchaseId,
      supplier_name: supplier.trim() || null,
      status: "posted",
      total_minor: total,
      created_at: new Date().toISOString(),
      purchase_items: items,
    }

    await SharedPosService.savePurchase(purchaseRecord)

    // Immediately reflect new purchased quantities in local state
    setIngredients((prev) =>
      prev.map((ing) => {
        const added = items
          .filter((it) => it.ingredient_id === ing.id)
          .reduce((sum, it) => sum + (it.quantity_base || 0), 0)
        return added > 0 ? { ...ing, current_stock_base: (Number(ing.current_stock_base) || 0) + added } : ing
      })
    )

    setBusy(false)
    toast.success("Grocery run posted and stock updated live")
    setPurchaseOpen(false)
    setSupplier("")
    setLines([{ ingredient_id: "", quantity: "", unit: "kg", unit_price: "" }])
    await load()
  }

  function openRecipe(product: Product) {
    setRecipeProduct(product)
    const existing = getProductRecipe(product)
    if (existing && existing.length > 0) {
      setRecipeLines(
        existing.map((line) => {
          const ingredient = ingredients.find((i) => i.id === line.ingredient_id)
          const unit = ingredient?.base_unit || "g"
          return { ingredient_id: line.ingredient_id, quantity: String(line.quantity_base), unit }
        }),
      )
    } else {
      const defaultIngId = ingredients[0]?.id || ""
      const defaultUnit = ingredients[0]?.base_unit || "g"
      setRecipeLines([{ ingredient_id: defaultIngId, quantity: "", unit: defaultUnit }])
    }
  }

  async function saveRecipe() {
    if (!recipeProduct) return
    const valid = recipeLines.filter((line) => line.ingredient_id && parseQuantity(line.quantity) > 0)
    setBusy(true)

    const formattedLines: SharedRecipeItem[] = valid.map((line) => ({
      ingredient_id: line.ingredient_id,
      quantity_base: toBase(parseQuantity(line.quantity), line.unit),
    }))

    // Save under product.id and also product.name
    await SharedPosService.saveRecipe(recipeProduct.id, formattedLines)
    if (recipeProduct.name && recipeProduct.name !== recipeProduct.id) {
      await SharedPosService.saveRecipe(recipeProduct.name, formattedLines)
    }

    setRecipes((prev) => ({
      ...prev,
      [recipeProduct.id]: formattedLines,
      ...(recipeProduct.name ? { [recipeProduct.name]: formattedLines } : {}),
    }))

    setBusy(false)
    toast.success(`Recipe saved for ${recipeProduct.name}`)
    setRecipeProduct(null)
    await load()
  }

  const categoryOptions = (
    <>
      <option value="">No category</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Inventory control</p>
          <h2 className="font-serif text-2xl font-bold">Ingredients &amp; grocery runs</h2>
          <p className="text-sm text-muted-foreground">Track coffee, milk, sugar, produce, packaging and recipes in base units.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 size-4" />Refresh
          </Button>
          {canManage && (
            <Button variant="outline" onClick={() => setCategoryOpen(true)}>
              <Tag className="mr-2 size-4" />Categories
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setPurchaseOpen(true)} disabled={!ingredients.length}>
              <ShoppingCart className="mr-2 size-4" />New Grocery Run
            </Button>
          )}
          {canManage && (
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => void handleClearBulkData()}
              disabled={busy}
              title="Clear bulk data and start with clean inventory"
            >
              <Trash2 className="mr-2 size-4" />Clear Bulk Data
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>Inventory note: {loadError}. Local real-time mode is fully active.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ingredients</p>
            <p className="text-2xl font-bold">{ingredients.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Low stock</p>
            <p className="text-2xl font-bold text-amber-600">{lowStock.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Categories</p>
            <p className="text-2xl font-bold">{categories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Recipes ready</p>
            <p className="text-2xl font-bold text-emerald-600">{readyRecipesCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b pb-2">
        {TABS.map(([label, Icon]) => (
          <Button
            key={label}
            variant={tab === label ? "default" : "ghost"}
            onClick={() => setTab(label)}
            className="shrink-0"
          >
            <Icon className="mr-2 size-4" />
            {label}
          </Button>
        ))}
      </div>

      {tab === "Stock" && (
        <Card>
          <CardHeader className="flex-col items-stretch gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Live stock</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="w-full pl-9 sm:w-48"
                  placeholder="Search ingredients"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <NativeSelect
                label="Filter by category"
                value={selectedCategory}
                onChange={setSelectedCategory}
                className="sm:w-48"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </CardHeader>
          <CardContent>
            {loading && ingredients.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Loading stock…</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((item) => {
                  const low = item.current_stock_base <= item.reorder_level_base
                  return (
                    <div key={item.id} className="glass-panel rounded-xl border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{categoryName(item.category_id)}</p>
                        </div>
                        <Badge variant={low ? "destructive" : "secondary"}>
                          {item.current_stock_base <= 0 ? "Out" : low ? "Low" : "OK"}
                        </Badge>
                      </div>
                      <p className="mt-4 text-2xl font-bold">{displayStock(item.current_stock_base, item.base_unit)}</p>
                      <p className="text-xs text-muted-foreground">
                        Reorder at {displayStock(item.reorder_level_base, item.base_unit)} · purchases in{" "}
                        {item.default_purchase_unit}
                      </p>
                      {canManage && (
                        <div className="mt-3 flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => openAdjustModal(item)}
                          >
                            <SlidersHorizontal className="mr-1.5 size-3.5" />Adjust
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditIngredient(item)}
                            title="Edit ingredient"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-muted-foreground hover:text-red-600"
                            onClick={() => void deleteIngredient(item)}
                            title="Delete ingredient"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {!filtered.length && (
                  <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {ingredients.length
                      ? "No ingredients match this filter."
                      : canManage
                        ? "No ingredients yet. Add one from the Ingredients tab."
                        : "No ingredients yet."}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "Ingredients" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Ingredient catalogue</CardTitle>
            {canManage && (
              <Button onClick={() => setIngredientOpen(true)}>
                <Plus className="mr-2 size-4" />Add ingredient
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {ingredients.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {categoryName(item.category_id)} · {item.dimension} · base {item.base_unit} · buy in{" "}
                      {item.default_purchase_unit} · reorder at {displayStock(item.reorder_level_base, item.base_unit)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{displayStock(item.current_stock_base, item.base_unit)}</Badge>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => openAdjustModal(item)}
                          title="Adjust stock"
                        >
                          <SlidersHorizontal className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditIngredient(item)}
                          title="Edit ingredient"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-muted-foreground hover:text-red-600"
                          onClick={() => void deleteIngredient(item)}
                          title="Delete ingredient"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!ingredients.length && <p className="p-6 text-center text-sm text-muted-foreground">No ingredients yet.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "Grocery Runs" && (
        <Card>
          <CardHeader>
            <CardTitle>Grocery runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Every posted run adds stock and writes an audit entry.</p>
            {purchases.map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <div>
                  <p className="font-medium">{new Date(purchase.created_at).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{purchase.purchase_items?.length || 0} lines</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold">
                    Rs. {(Number(purchase.total_minor) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <Badge variant={purchase.status === "posted" ? "secondary" : "outline"} className="capitalize">
                    {purchase.status}
                  </Badge>
                </div>
              </div>
            ))}
            {!purchases.length && <p className="p-6 text-center text-sm text-muted-foreground">No grocery runs yet.</p>}
          </CardContent>
        </Card>
      )}

      {tab === "Recipes" && (
        <Card>
          <CardHeader className="flex-col items-stretch gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Recipes ({allProducts.length} Products)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Define what each menu item uses. Sales automatically deduct these ingredients in real time.
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="w-full pl-9 sm:w-56"
                placeholder="Search products…"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredProducts.map((product) => {
              const rItems = getProductRecipe(product)
              const hasRecipe = Boolean(rItems && rItems.length > 0)
              const estimatedCost = hasRecipe
                ? Math.round(
                    rItems!.reduce((acc, it) => acc + Math.max(40, Math.round(it.quantity_base * 0.7)), 0)
                  )
                : Math.round(product.price * 0.3)
              const profitMargin = Math.max(15, Math.min(88, Math.round(((product.price - estimatedCost) / product.price) * 100)))

              return (
                <div
                  key={product.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border p-3 text-sm gap-2 bg-white hover:border-[#D67B6B]/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{product.name}</p>
                      <Badge variant={hasRecipe ? "secondary" : "outline"} className="text-[10px]">
                        {hasRecipe ? `${rItems!.length} item${rItems!.length === 1 ? "" : "s"}` : "Not configured"}
                      </Badge>
                      <Badge className="bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px] px-1.5 py-0 font-bold">
                        {profitMargin}% Margin
                      </Badge>
                    </div>
                    {hasRecipe ? (
                      <p className="text-xs text-muted-foreground">
                        {rItems!.map((item) => {
                          const ing = ingredients.find((i) => i.id === item.ingredient_id)
                          return `${ing?.name || "Ingredient"}: ${displayStock(item.quantity_base, ing?.base_unit || "g")}`
                        }).join(" • ")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No recipe linked. Add ingredients used per serving.</p>
                    )}
                    <div className="flex items-center gap-2 pt-0.5 text-xs text-gray-500">
                      <span>Menu Price: <strong className="text-gray-900">LKR {product.price.toLocaleString()}</strong></span>
                      <span>•</span>
                      <span>Est. Food Cost: <strong className="text-amber-900">LKR {estimatedCost.toLocaleString()}</strong></span>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      size="sm"
                      variant={hasRecipe ? "outline" : "default"}
                      onClick={() => openRecipe(product)}
                      className="shrink-0"
                    >
                      {hasRecipe ? "Edit Recipe" : "Create Recipe"}
                    </Button>
                  )}
                </div>
              )
            })}
            {!filteredProducts.length && (
              <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                {allProducts.length ? "No products match your search." : "No products available to configure recipes."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "Suppliers" && (
        <Card>
          <CardHeader className="flex-col items-stretch gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Supplier Directory & Vendor Accounts</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage raw material suppliers, payment terms, and outstanding payables
              </p>
            </div>
            <Button
              onClick={() => {
                setSupplierForm({
                  name: "",
                  contact_person: "",
                  phone: "",
                  email: "",
                  address: "",
                  category: "Produce & Greens",
                  payment_terms: "Weekly Settlement",
                  notes: "",
                })
                setShowAddSupplier(true)
              }}
              className="gap-2 rounded-xl bg-[#D67B6B] text-white hover:bg-[#c36859]"
            >
              <Plus className="size-4" />
              Add Supplier
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map((sup) => (
                <div
                  key={sup.id}
                  className="rounded-2xl border p-4 bg-white shadow-sm flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900">{sup.name}</h4>
                        <p className="text-xs text-gray-500 font-medium">{sup.category}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-emerald-300 bg-emerald-50 text-emerald-900">
                        {sup.payment_terms || "COD"}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs text-gray-600">
                      {sup.contact_person && (
                        <p className="font-semibold text-gray-800">Contact: {sup.contact_person}</p>
                      )}
                      {sup.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="size-3 text-gray-400" />
                          {sup.phone}
                        </p>
                      )}
                      {sup.email && (
                        <p className="flex items-center gap-1.5">
                          <Mail className="size-3 text-gray-400" />
                          {sup.email}
                        </p>
                      )}
                      {sup.address && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="size-3 text-gray-400" />
                          {sup.address}
                        </p>
                      )}
                    </div>

                    {sup.notes && (
                      <p className="text-[11px] text-gray-500 italic bg-[#FAF5F1] p-2 rounded-xl">
                        "{sup.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400">Balance Payable:</span>
                      <p className="font-bold text-gray-900">
                        LKR {(sup.balance_payable || 0).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-rose-500 hover:text-rose-700"
                      onClick={() => {
                        if (confirm(`Remove supplier ${sup.name}?`)) {
                          SharedPosService.deleteSupplier(sup.id)
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {!suppliers.length && (
              <p className="p-8 text-center text-sm text-muted-foreground">No suppliers registered yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "Wastage" && (
        <Card>
          <CardHeader className="flex-col items-stretch gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Wastage & Spoilage Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Log spoiled raw materials, prep errors, and expired stock to calculate cost loss
              </p>
            </div>
            <Button
              onClick={() => setShowAddWastage(true)}
              className="gap-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700"
            >
              <Plus className="size-4" />
              Log Spoilage / Waste
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-rose-900">Total Recorded Spoilage Loss</span>
                <p className="text-2xl font-bold text-rose-950 mt-1">
                  LKR {wastage.reduce((sum, w) => sum + (w.cost_loss || 0), 0).toLocaleString()}
                </p>
              </div>
              <Badge className="bg-rose-600 text-white">{wastage.length} Incident Logs</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs font-bold uppercase text-gray-500">
                    <th className="pb-3 pl-2">Item</th>
                    <th className="pb-3">Quantity</th>
                    <th className="pb-3">Reason</th>
                    <th className="pb-3">Cost Loss</th>
                    <th className="pb-3">Reported By</th>
                    <th className="pb-3 pr-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {wastage.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FAF5F1]">
                      <td className="py-3 pl-2 font-bold text-gray-900">{item.item_name}</td>
                      <td className="py-3 text-xs text-gray-700">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {item.reason.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-3 font-bold text-rose-600">
                        LKR {(item.cost_loss || 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-xs text-gray-600">{item.reported_by}</td>
                      <td className="py-3 pr-2 text-right text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {!wastage.length && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                        No wastage recorded yet. Excellent kitchen efficiency!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "Adjustments" && (
        <Card>
          <CardHeader className="flex-col items-stretch gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Physical Stock Adjustments</CardTitle>
              <p className="text-sm text-muted-foreground">
                Reconcile physical stocktake counts with system ledger quantities
              </p>
            </div>
            <Button
              onClick={() => setShowAddAdjustment(true)}
              className="gap-2 rounded-xl bg-[#D67B6B] text-white hover:bg-[#c36859]"
            >
              <Plus className="size-4" />
              Record Stock Adjustment
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs font-bold uppercase text-gray-500">
                    <th className="pb-3 pl-2">Ingredient</th>
                    <th className="pb-3">Previous</th>
                    <th className="pb-3">New Count</th>
                    <th className="pb-3">Difference</th>
                    <th className="pb-3">Reason</th>
                    <th className="pb-3">Adjusted By</th>
                    <th className="pb-3 pr-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {adjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-[#FAF5F1]">
                      <td className="py-3 pl-2 font-bold text-gray-900">{adj.ingredient_name}</td>
                      <td className="py-3 text-xs text-gray-600">
                        {adj.previous_stock} {adj.unit}
                      </td>
                      <td className="py-3 text-xs font-semibold text-gray-900">
                        {adj.new_stock} {adj.unit}
                      </td>
                      <td
                        className={`py-3 font-bold text-xs ${
                          adj.difference >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {adj.difference > 0 ? `+${adj.difference}` : adj.difference} {adj.unit}
                      </td>
                      <td className="py-3">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {adj.reason.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-3 text-xs text-gray-600">{adj.adjusted_by}</td>
                      <td className="py-3 pr-2 text-right text-xs text-gray-400">
                        {new Date(adj.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {!adjustments.length && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-gray-400">
                        No adjustments recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {categoryOpen && (
        <Modal
          title="Ingredient categories"
          subtitle="Group ingredients so stock is easy to filter."
          onClose={() => setCategoryOpen(false)}
        >
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Syrups"
              onKeyDown={(e) => e.key === "Enter" && void addCategory()}
            />
            <Button onClick={() => void addCategory()} disabled={busy}>
              <Plus className="mr-1.5 size-4" />Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category.id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-sm"
              >
                {category.name}
                <button
                  type="button"
                  onClick={() => void removeCategory(category)}
                  aria-label={`Remove ${category.name}`}
                  className="text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            ))}
            {!categories.length && <p className="text-sm text-muted-foreground">No categories yet.</p>}
          </div>
        </Modal>
      )}

      {ingredientOpen && (
        <Modal title="Add ingredient" onClose={() => setIngredientOpen(false)}>
          <div>
            <Label>Name</Label>
            <Input
              value={newIngredient.name}
              onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
              placeholder="e.g. Fresh milk, Espresso beans"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Measured in</Label>
              <NativeSelect
                label="Dimension"
                value={newIngredient.dimension}
                onChange={(value) => {
                  const dimension = value as Dimension
                  const defaultUnit = unitsFor(dimension)[0]
                  setNewIngredient({
                    ...newIngredient,
                    dimension,
                    default_purchase_unit: defaultUnit,
                    initial_stock_unit: defaultUnit,
                    reorder_unit: defaultUnit,
                  })
                }}
              >
                <option value="weight">Weight (g / kg)</option>
                <option value="volume">Volume (ml / L)</option>
                <option value="count">Count (pcs)</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Default Buy Unit</Label>
              <NativeSelect
                label="Purchase unit"
                value={newIngredient.default_purchase_unit}
                onChange={(value) => setNewIngredient({ ...newIngredient, default_purchase_unit: value })}
              >
                {unitsFor(newIngredient.dimension).map((unit) => (
                  <option key={unit} value={unit}>
                    {unitLabel(unit)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Initial Stock on Hand</Label>
              <div className="flex gap-1.5">
                <Input
                  inputMode="decimal"
                  value={newIngredient.initial_stock}
                  onChange={(e) => setNewIngredient({ ...newIngredient, initial_stock: e.target.value })}
                  placeholder="e.g. 10"
                />
                <NativeSelect
                  label="Initial stock unit"
                  value={newIngredient.initial_stock_unit}
                  onChange={(value) => setNewIngredient({ ...newIngredient, initial_stock_unit: value })}
                  className="w-24 shrink-0"
                >
                  {unitsFor(newIngredient.dimension).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div>
              <Label>Reorder Alert Level</Label>
              <div className="flex gap-1.5">
                <Input
                  inputMode="decimal"
                  value={newIngredient.reorder_level}
                  onChange={(e) => setNewIngredient({ ...newIngredient, reorder_level: e.target.value })}
                  placeholder="e.g. 2"
                />
                <NativeSelect
                  label="Reorder unit"
                  value={newIngredient.reorder_unit}
                  onChange={(value) => setNewIngredient({ ...newIngredient, reorder_unit: value })}
                  className="w-24 shrink-0"
                >
                  {unitsFor(newIngredient.dimension).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>

          <div>
            <Label>Category</Label>
            <NativeSelect
              label="Category"
              value={newIngredient.category_id}
              onChange={(value) => setNewIngredient({ ...newIngredient, category_id: value })}
            >
              {categoryOptions}
            </NativeSelect>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-primary underline"
            onClick={() => setCategoryOpen(true)}
          >
            + New category
          </button>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="ghost" onClick={() => setIngredientOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void addIngredient()} disabled={busy}>
              Save ingredient
            </Button>
          </div>
        </Modal>
      )}

      {adjusting && (
        <Modal
          title={`Adjust Stock · ${adjusting.name}`}
          subtitle={`Current stock: ${displayStock(adjusting.current_stock_base, adjusting.base_unit)}`}
          onClose={() => setAdjusting(null)}
        >
          <div className="space-y-4">
            <div className="flex gap-2 rounded-xl bg-muted/40 p-1">
              <Button
                type="button"
                size="sm"
                variant={adjust.mode === "set" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => {
                  const bestUnit = adjusting.current_stock_base >= 1000 ? unitsFor(adjusting.dimension)[0] : adjusting.base_unit
                  const curStock = adjusting.current_stock_base >= 1000
                    ? String(Number((adjusting.current_stock_base / 1000).toFixed(2)))
                    : String(adjusting.current_stock_base)
                  setAdjust({ ...adjust, mode: "set", value: curStock, unit: bestUnit })
                }}
              >
                Set Total Stock
              </Button>
              <Button
                type="button"
                size="sm"
                variant={adjust.mode === "change" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setAdjust({ ...adjust, mode: "change", value: "" })}
              >
                Add / Remove (+ / -)
              </Button>
            </div>

            <div>
              <Label>
                {adjust.mode === "set" ? "New Total Physical Stock" : "Change Quantity (use - to remove)"}
              </Label>
              <div className="mt-1 flex gap-2">
                <Input
                  inputMode="decimal"
                  value={adjust.value}
                  onChange={(e) => setAdjust({ ...adjust, value: e.target.value })}
                  placeholder={adjust.mode === "set" ? "e.g. 10" : "e.g. +2 or -0.5"}
                  autoFocus
                />
                <NativeSelect
                  label="Adjustment unit"
                  value={adjust.unit}
                  onChange={(value) => setAdjust({ ...adjust, unit: value })}
                  className="w-28 shrink-0"
                >
                  {unitsFor(adjusting.dimension).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            {adjust.value && (
              <div className="rounded-xl border bg-muted/20 p-2.5 text-xs">
                <span className="text-muted-foreground">New stock on hand will be: </span>
                <strong className="font-semibold text-foreground">
                  {displayStock(
                    adjust.mode === "set"
                      ? toBase(parseQuantity(adjust.value), adjust.unit)
                      : Math.max(0, adjusting.current_stock_base + toBase(parseQuantity(adjust.value), adjust.unit)),
                    adjusting.base_unit
                  )}
                </strong>
              </div>
            )}

            <div>
              <Label>Reason</Label>
              <Input
                value={adjust.reason}
                onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
                placeholder="e.g. Physical stock count, Delivery top-up, Spillage"
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => setAdjusting(null)}>
                Cancel
              </Button>
              <Button onClick={() => void postAdjustment()} disabled={busy}>
                Confirm Adjustment
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {purchaseOpen && (
        <Modal
          wide
          title="New Grocery Run"
          subtitle="Enter the quantity bought and the price per unit. Stock is stored in base units."
          onClose={() => setPurchaseOpen(false)}
        >
          <Input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Supplier / shop (optional)"
          />
          {lines.map((line, index) => {
            const ingredient = ingredients.find((item) => item.id === line.ingredient_id)
            const units = ingredient ? unitsFor(ingredient.dimension) : ["kg", "g"]
            return (
              <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_100px_90px_120px_auto]">
                <NativeSelect
                  label="Ingredient"
                  value={line.ingredient_id}
                  onChange={(value) =>
                    updateLine(index, {
                      ingredient_id: value,
                      unit: unitsFor(ingredients.find((item) => item.id === value)?.dimension || "weight")[0],
                    })
                  }
                >
                  <option value="">Ingredient…</option>
                  {ingredients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </NativeSelect>
                <Input
                  inputMode="decimal"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: e.target.value })}
                />
                <NativeSelect
                  label="Unit"
                  value={line.unit}
                  onChange={(value) => updateLine(index, { unit: value })}
                >
                  {units.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </NativeSelect>
                <Input
                  inputMode="decimal"
                  placeholder={`Rs. per ${line.unit}`}
                  value={line.unit_price}
                  onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove line"
                  onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )
          })}
          <Button
            variant="outline"
            onClick={() => setLines([...lines, { ingredient_id: "", quantity: "", unit: "kg", unit_price: "" }])}
          >
            <Plus className="mr-2 size-4" />Add line
          </Button>
          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-sm text-muted-foreground">
              Total{" "}
              <span className="font-mono text-base font-bold text-foreground">
                Rs.{" "}
                {(
                  lines.reduce(
                    (sum, line) => (sum + (Number.isFinite(lineTotalMinor(line)) ? lineTotalMinor(line) : 0)),
                    0,
                  ) / 100
                ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPurchaseOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void postPurchase()} disabled={busy}>
                Post Grocery Run
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {recipeProduct && (
        <Modal
          wide
          title={`Recipe · ${recipeProduct.name}`}
          subtitle="Ingredients used for one serving."
          onClose={() => setRecipeProduct(null)}
        >
          {recipeLines.map((line, index) => {
            const ingredient = ingredients.find((item) => item.id === line.ingredient_id)
            const units = ingredient
              ? ingredient.dimension === "weight"
                ? ["g", "kg"]
                : ingredient.dimension === "volume"
                  ? ["ml", "l"]
                  : ["pcs"]
              : ["g"]
            return (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_110px_90px_auto]">
                <NativeSelect
                  label="Ingredient"
                  value={line.ingredient_id}
                  onChange={(value) =>
                    setRecipeLines((prev) =>
                      prev.map((l, i) =>
                        i === index
                          ? {
                              ...l,
                              ingredient_id: value,
                              unit: baseUnitFor(ingredients.find((x) => x.id === value)?.dimension || "weight"),
                            }
                          : l,
                      ),
                    )
                  }
                >
                  <option value="">Ingredient…</option>
                  {ingredients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </NativeSelect>
                <Input
                  inputMode="decimal"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => setRecipeLines((prev) => prev.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)))}
                />
                <NativeSelect
                  label="Unit"
                  value={line.unit}
                  onChange={(value) => setRecipeLines((prev) => prev.map((l, i) => (i === index ? { ...l, unit: value } : l)))}
                >
                  {units.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove ingredient"
                  onClick={() => setRecipeLines((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )
          })}
          <Button
            variant="outline"
            onClick={() => setRecipeLines([...recipeLines, { ingredient_id: ingredients[0]?.id || "", quantity: "", unit: ingredients[0]?.base_unit || "g" }])}
          >
            <Plus className="mr-2 size-4" />Add ingredient
          </Button>
          <div className="flex items-center justify-between border-t pt-3">
            {getProductRecipe(recipeProduct)?.length ? (
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => void clearRecipe()}
                disabled={busy}
              >
                <Trash2 className="mr-1.5 size-3.5" />Clear Recipe
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setRecipeProduct(null)}>
                Cancel
              </Button>
              <Button onClick={() => void saveRecipe()} disabled={busy}>
                Save recipe
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editingIngredient && (
        <Modal
          title={`Edit ${editingIngredient.name}`}
          subtitle="Update stock on hand, category, or reorder alerts"
          onClose={() => setEditingIngredient(null)}
        >
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Ingredient name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Current Stock on Hand</Label>
                <div className="flex gap-1.5">
                  <Input
                    inputMode="decimal"
                    value={editForm.current_stock}
                    onChange={(e) => setEditForm({ ...editForm, current_stock: e.target.value })}
                    placeholder="10"
                  />
                  <NativeSelect
                    label="Current stock unit"
                    value={editForm.current_stock_unit}
                    onChange={(value) => setEditForm({ ...editForm, current_stock_unit: value })}
                    className="w-24 shrink-0"
                  >
                    {unitsFor(editingIngredient.dimension).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div>
                <Label>Reorder Alert Level</Label>
                <div className="flex gap-1.5">
                  <Input
                    inputMode="decimal"
                    value={editForm.reorder_level}
                    onChange={(e) => setEditForm({ ...editForm, reorder_level: e.target.value })}
                    placeholder="2"
                  />
                  <NativeSelect
                    label="Reorder unit"
                    value={editForm.reorder_unit}
                    onChange={(value) => setEditForm({ ...editForm, reorder_unit: value })}
                    className="w-24 shrink-0"
                  >
                    {unitsFor(editingIngredient.dimension).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            </div>

            <div>
              <Label>Category</Label>
              <NativeSelect
                label="Category"
                value={editForm.category_id || ""}
                onChange={(value) => setEditForm({ ...editForm, category_id: value })}
              >
                {categoryOptions}
              </NativeSelect>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => setEditingIngredient(null)}>
                Cancel
              </Button>
              <Button onClick={() => void updateIngredient()} disabled={busy}>
                Update ingredient
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {showAddSupplier && (
        <Modal
          title="Register New Supplier"
          subtitle="Add raw material vendor with payment terms"
          onClose={() => setShowAddSupplier(false)}
        >
          <div className="space-y-3">
            <div>
              <Label>Supplier / Business Name *</Label>
              <Input
                placeholder="e.g. Southern Dairy Farms"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact Person</Label>
                <Input
                  placeholder="e.g. Sunil Bandara"
                  value={supplierForm.contact_person}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input
                  placeholder="e.g. 041 223 4567"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Supply Category</Label>
                <Input
                  placeholder="e.g. Dairy, Produce, Meat"
                  value={supplierForm.category}
                  onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                />
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Input
                  placeholder="e.g. 14 Days Credit, COD"
                  value={supplierForm.payment_terms}
                  onChange={(e) => setSupplierForm({ ...supplierForm, payment_terms: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Address / Depot</Label>
              <Input
                placeholder="e.g. Dickwella Central Market"
                value={supplierForm.address}
                onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes & Delivery Schedule</Label>
              <Input
                placeholder="e.g. Daily morning delivery at 6:30 AM"
                value={supplierForm.notes}
                onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => setShowAddSupplier(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!supplierForm.name.trim()) return
                  SharedPosService.addSupplier({
                    name: supplierForm.name.trim(),
                    contact_person: supplierForm.contact_person.trim() || undefined,
                    phone: supplierForm.phone.trim() || undefined,
                    email: supplierForm.email.trim() || undefined,
                    address: supplierForm.address.trim() || undefined,
                    category: supplierForm.category.trim() || undefined,
                    payment_terms: supplierForm.payment_terms.trim() || "COD",
                    balance_payable: 0,
                    notes: supplierForm.notes.trim() || undefined,
                  })
                  setShowAddSupplier(false)
                  toast.success("Supplier registered successfully")
                }}
                className="bg-[#D67B6B] text-white hover:bg-[#c36859]"
              >
                Save Supplier
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: LOG WASTAGE */}
      {showAddWastage && (
        <Modal
          title="Log Spoilage / Wastage"
          subtitle="Record discarded ingredients or ruined dishes to calculate loss"
          onClose={() => setShowAddWastage(false)}
        >
          <div className="space-y-3">
            <div>
              <Label>Select Ingredient</Label>
              <select
                value={wastageForm.item_id}
                onChange={(e) => {
                  const ing = ingredients.find((i) => i.id === e.target.value)
                  const defaultUnit = ing ? unitsFor(ing.dimension)[0] : "kg"
                  setWastageForm({
                    ...wastageForm,
                    item_id: e.target.value,
                    unit: defaultUnit,
                  })
                }}
                className="w-full rounded-md border border-input p-2 text-sm bg-background"
              >
                <option value="">-- Choose Ingredient --</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} (Stock: {displayStock(ing.current_stock_base, ing.base_unit)})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity Discarded</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    step="any"
                    value={wastageForm.quantity}
                    onChange={(e) => setWastageForm({ ...wastageForm, quantity: e.target.value })}
                  />
                  <select
                    value={wastageForm.unit}
                    onChange={(e) => setWastageForm({ ...wastageForm, unit: e.target.value })}
                    className="w-24 rounded-md border border-input p-2 text-sm bg-background"
                  >
                    {(() => {
                      const ing = ingredients.find((i) => i.id === wastageForm.item_id)
                      const units = ing ? unitsFor(ing.dimension) : ["kg", "g", "L", "ml", "pcs"]
                      return units.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))
                    })()}
                  </select>
                </div>
              </div>
              <div>
                <Label>Cost Loss (LKR)</Label>
                <Input
                  type="number"
                  value={wastageForm.cost_loss}
                  onChange={(e) => setWastageForm({ ...wastageForm, cost_loss: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Reason for Wastage</Label>
              <select
                value={wastageForm.reason}
                onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value as any })}
                className="w-full rounded-md border border-input p-2 text-sm bg-background"
              >
                <option value="expired">Expired / Past Shelf-life</option>
                <option value="damaged">Damaged in Transit / Storage</option>
                <option value="burnt_spilled">Burnt / Spilled in Kitchen</option>
                <option value="prep_error">Kitchen Preparation Error</option>
                <option value="quality_issue">Quality Rejection / Substandard</option>
              </select>
            </div>
            <div>
              <Label>Reported By (Staff / Station)</Label>
              <Input
                value={wastageForm.reported_by}
                onChange={(e) => setWastageForm({ ...wastageForm, reported_by: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => setShowAddWastage(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const targetIng = ingredients.find((i) => i.id === wastageForm.item_id)
                  const name = targetIng ? targetIng.name : "Raw Ingredient"
                  const qty = Number(wastageForm.quantity) || 1
                  await SharedPosService.addWastageItem({
                    item_type: "ingredient",
                    item_id: wastageForm.item_id || "ing-gen",
                    item_name: name,
                    quantity: qty,
                    unit: wastageForm.unit,
                    cost_loss: Number(wastageForm.cost_loss) || 500,
                    reason: wastageForm.reason,
                    reported_by: wastageForm.reported_by || "Kitchen Staff",
                  })
                  if (targetIng) {
                    const deductBase = toBase(qty, wastageForm.unit)
                    const newStock = Math.max(0, targetIng.current_stock_base - deductBase)
                    setIngredients((prev) =>
                      prev.map((i) => (i.id === targetIng.id ? { ...i, current_stock_base: newStock } : i))
                    )
                  }
                  setShowAddWastage(false)
                  toast.success("Wastage logged and stock adjusted")
                  await load()
                }}
                className="bg-rose-600 text-white hover:bg-rose-700"
              >
                Confirm Spoilage Entry
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      {showAddAdjustment && (
        <Modal
          title="Record Stock Adjustment"
          subtitle="Reconcile physical stock count with system ledger"
          onClose={() => setShowAddAdjustment(false)}
        >
          <div className="space-y-3">
            <div>
              <Label>Select Ingredient to Reconcile</Label>
              <select
                value={adjustmentForm.ingredient_id}
                onChange={(e) => {
                  const ing = ingredients.find((i) => i.id === e.target.value)
                  if (ing) {
                    const bestUnit = ing.current_stock_base >= 1000 ? unitsFor(ing.dimension)[0] : ing.base_unit
                    const currentVal = ing.current_stock_base >= 1000
                      ? String(Number((ing.current_stock_base / 1000).toFixed(2)))
                      : String(ing.current_stock_base)
                    setAdjustmentForm({
                      ...adjustmentForm,
                      ingredient_id: e.target.value,
                      new_stock: currentVal,
                      unit: bestUnit,
                    })
                  } else {
                    setAdjustmentForm({ ...adjustmentForm, ingredient_id: e.target.value })
                  }
                }}
                className="w-full rounded-md border border-input p-2 text-sm bg-background"
              >
                <option value="">-- Choose Ingredient --</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} (Current: {displayStock(ing.current_stock_base, ing.base_unit)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>New Physical Stock Count</Label>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  step="any"
                  value={adjustmentForm.new_stock}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, new_stock: e.target.value })}
                  placeholder="e.g. 5"
                />
                <select
                  value={adjustmentForm.unit}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, unit: e.target.value })}
                  className="w-24 rounded-md border border-input p-2 text-sm bg-background"
                >
                  {(() => {
                    const ing = ingredients.find((i) => i.id === adjustmentForm.ingredient_id)
                    const units = ing ? unitsFor(ing.dimension) : ["kg", "g", "L", "ml", "pcs"]
                    return units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))
                  })()}
                </select>
              </div>
            </div>
            <div>
              <Label>Reason for Variance</Label>
              <select
                value={adjustmentForm.reason}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value as any })}
                className="w-full rounded-md border border-input p-2 text-sm bg-background"
              >
                <option value="physical_count">Physical Stocktake Recount</option>
                <option value="shrinkage">Unaccounted Shrinkage</option>
                <option value="calibration">Scale / Measurement Calibration</option>
                <option value="supplier_shortfall">Supplier Shortfall Received</option>
                <option value="other">Other Discrepancy Correction</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => setShowAddAdjustment(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const ing = ingredients.find((i) => i.id === adjustmentForm.ingredient_id)
                  if (!ing) return
                  const prevBase = ing.current_stock_base || 0
                  const nextBase = Math.max(0, toBase(parseQuantity(adjustmentForm.new_stock), adjustmentForm.unit))
                  const diffBase = nextBase - prevBase
                  await SharedPosService.addAdjustment({
                    ingredient_id: ing.id,
                    ingredient_name: ing.name,
                    previous_stock: prevBase,
                    new_stock: nextBase,
                    difference: diffBase,
                    unit: ing.base_unit,
                    reason: adjustmentForm.reason,
                    adjusted_by: normalizeRole(role) === "admin" ? "admin" : "cashier",
                  })
                  setIngredients((prev) =>
                    prev.map((i) => (i.id === ing.id ? { ...i, current_stock_base: nextBase } : i))
                  )
                  setShowAddAdjustment(false)
                  toast.success(`${ing.name} reconciled to ${displayStock(nextBase, ing.base_unit)}`)
                  await load()
                }}
                className="bg-[#D67B6B] text-white hover:bg-[#c36859]"
              >
                Save Adjustment
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
