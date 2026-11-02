import { CoffeeProduct, CoffeeBill, CoffeeBillItem, CoffeeReportFilters, CoffeeReportSummary } from "./types"
import { createClient } from "@/lib/supabase/client"
import { createStaffSupabaseClient } from "./auth"

export const INITIAL_COFFEE_PRODUCTS: CoffeeProduct[] = [
  {
    id: "cof-prod-1",
    name: "Espresso Single",
    category: "Espresso",
    size: "Single",
    price: 550,
    image_url: "/latte-coffee.png",
    status: "active",
  },
  {
    id: "cof-prod-2",
    name: "Espresso Double",
    category: "Espresso",
    size: "Double",
    price: 750,
    image_url: "/latte-coffee.png",
    status: "active",
  },
  {
    id: "cof-prod-3",
    name: "Caffe Latte",
    category: "Milk Coffee",
    size: "Regular",
    price: 850,
    image_url: "/latte-coffee.png",
    status: "active",
  },
  {
    id: "cof-prod-4",
    name: "Cappuccino",
    category: "Milk Coffee",
    size: "Regular",
    price: 800,
    image_url: "/latte-coffee.png",
    status: "active",
  },
  {
    id: "cof-prod-5",
    name: "Flat White",
    category: "Milk Coffee",
    size: "Regular",
    price: 850,
    image_url: "/latte-coffee.png",
    status: "active",
  },
  {
    id: "cof-prod-6",
    name: "Americano",
    category: "Black Coffee",
    size: "Large",
    price: 650,
    image_url: "/latte-coffee.png",
    status: "active",
  },
  {
    id: "cof-prod-7",
    name: "Caramel Macchiato",
    category: "Specialty",
    size: "Large",
    price: 950,
    image_url: "/latte-coffee.png",
    status: "active",
  },
  {
    id: "cof-prod-8",
    name: "Iced Vanilla Latte",
    category: "Cold Coffee",
    size: "Large",
    price: 950,
    image_url: "/iced-tea.png",
    status: "active",
  },
  {
    id: "cof-prod-9",
    name: "Cold Brew Reserve",
    category: "Cold Coffee",
    size: "Regular",
    price: 900,
    image_url: "/iced-tea.png",
    status: "active",
  },
  {
    id: "cof-prod-10",
    name: "Seasonal Mocha Frappe",
    category: "Blended",
    size: "Large",
    price: 1100,
    image_url: "/ice-cream-sundae.png",
    status: "inactive",
  },
  {
    id: "cof-prod-11",
    name: "Mocha",
    category: "Hot Coffee",
    size: "Regular",
    price: 1200,
    image_url: "/latte-coffee.png",
    status: "active",
  },
  {
    id: "cof-prod-12",
    name: "Bumble Coffee",
    category: "Specialty",
    size: "Regular",
    price: 1200,
    image_url: "/latte-coffee.png",
    status: "active",
  },
  {
    id: "cof-prod-13",
    name: "Espresso Tonic",
    category: "Specialty",
    size: "Regular",
    price: 1000,
    image_url: "/iced-tea.png",
    status: "active",
  },
  {
    id: "cof-prod-14",
    name: "Matcha Latte",
    category: "Cold Coffee",
    size: "Regular",
    price: 800,
    image_url: "/iced-tea.png",
    status: "active",
  },
  {
    id: "cof-prod-15",
    name: "Iced Cappuccino",
    category: "Cold Coffee",
    size: "Regular",
    price: 800,
    image_url: "/iced-tea.png",
    status: "active",
  },
  {
    id: "cof-prod-16",
    name: "Iced Latte",
    category: "Cold Coffee",
    size: "Regular",
    price: 900,
    image_url: "/iced-tea.png",
    status: "active",
  },
  {
    id: "cof-prod-17",
    name: "Iced Americano",
    category: "Cold Coffee",
    size: "Regular",
    price: 700,
    image_url: "/iced-tea.png",
    status: "active",
  },
  {
    id: "cof-prod-18",
    name: "Iced Matcha Latte",
    category: "Cold Coffee",
    size: "Regular",
    price: 1000,
    image_url: "/iced-tea.png",
    status: "active",
  },
  {
    id: "cof-prod-19",
    name: "Coffee V60",
    category: "Specialty",
    size: "Regular",
    price: 1100,
    image_url: "/latte-coffee.png",
    status: "active",
  },
]

const LOCAL_PRODUCTS_KEY = "pos_coffee_products"
const LOCAL_BILLS_KEY = "pos_coffee_bills"
const LOCAL_COUNTER_KEY = "pos_coffee_bill_counter"

// Memory cache for server-side route handlers or offline execution
let memoryProducts: CoffeeProduct[] = [...INITIAL_COFFEE_PRODUCTS]
let memoryBills: CoffeeBill[] = []
let memoryCounter = 1001

function isUuid(val?: string | null): boolean {
  if (!val) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val)
}

function getDatabaseClient(supabaseClient?: any) {
  if (supabaseClient) return supabaseClient
  if (typeof window === "undefined") {
    const serverClient = createStaffSupabaseClient()
    if (serverClient) return serverClient
  }
  return createClient()
}

export class CoffeeStorageService {
  private static isBrowser(): boolean {
    return typeof window !== "undefined"
  }

  // --- COFFEE PRODUCTS ---

  static getCachedProducts(): CoffeeProduct[] {
    if (this.isBrowser()) {
      try {
        const local = localStorage.getItem(LOCAL_PRODUCTS_KEY)
        if (local) {
          const parsed = JSON.parse(local)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch {}
    }
    return memoryProducts.length > 0 ? memoryProducts : [...INITIAL_COFFEE_PRODUCTS]
  }

  static saveLocalProducts(products: CoffeeProduct[]): void {
    memoryProducts = [...products]
    if (this.isBrowser()) {
      try {
        localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products))
        window.dispatchEvent(new CustomEvent("coffee_products_updated", { detail: products }))
      } catch {}
    }
  }

  static async getProducts(supabaseClient?: any): Promise<CoffeeProduct[]> {
    const supabase = getDatabaseClient(supabaseClient)
    try {
      const { data, error } = await supabase
        .from("coffee_products")
        .select("*")
        .order("created_at", { ascending: true })

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: CoffeeProduct[] = data.filter(Boolean).map((item: any) => ({
          id: String(item.id),
          name: String(item.name || "Unnamed coffee"),
          category: String(item.category || "Other"),
          size: String(item.size || "Regular"),
          price: Number(item.price) || 0,
          image_url: item.image_url || "/latte-coffee.png",
          status: item.status === "inactive" ? "inactive" : "active",
          created_at: item.created_at,
          updated_at: item.updated_at,
        }))
        this.saveLocalProducts(mapped)
        return mapped
      }
      if (error) {
        console.warn("Supabase getProducts warning:", error.message)
      }
    } catch (error: any) {
      console.warn("Supabase getProducts error, falling back:", error?.message || error)
    }

    return this.getCachedProducts()
  }

  static async getActiveProducts(supabaseClient?: any): Promise<CoffeeProduct[]> {
    const products = await this.getProducts(supabaseClient)
    return products.filter((p) => p.status === "active")
  }

  static async addProduct(product: Omit<CoffeeProduct, "id">, supabaseClient?: any): Promise<CoffeeProduct> {
    const supabase = getDatabaseClient(supabaseClient)
    const newId = "cof-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7)
    const newProduct: CoffeeProduct = {
      ...product,
      id: newId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      const { data, error } = await supabase
        .from("coffee_products")
        .insert({
          name: product.name,
          category: product.category,
          size: product.size || "Regular",
          price: product.price,
          image_url: product.image_url || null,
          status: product.status || "active",
        })
        .select()
        .single()

      if (!error && data) {
        newProduct.id = String(data.id)
      } else if (error) {
        console.warn("Supabase addProduct warning:", error.message)
      }
    } catch (error: any) {
      console.warn("Supabase addProduct error, falling back:", error?.message || error)
    }

    if (this.isBrowser()) {
      const current = await this.getProducts()
      const updated = [...current, newProduct]
      localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(updated))
    } else {
      memoryProducts.push(newProduct)
    }

    return newProduct
  }

  static async updateProduct(id: string, updates: Partial<CoffeeProduct>, supabaseClient?: any): Promise<CoffeeProduct | null> {
    const supabase = getDatabaseClient(supabaseClient)
    let updatedProduct: CoffeeProduct | null = null

    try {
      const { data, error } = await supabase
        .from("coffee_products")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .maybeSingle()

      if (!error && data) {
        updatedProduct = data as CoffeeProduct
      } else if (error) {
        console.warn("Supabase updateProduct warning:", error.message)
      }
    } catch (error: any) {
      console.warn("Supabase updateProduct error, falling back:", error?.message || error)
    }

    if (this.isBrowser()) {
      const current = await this.getProducts()
      const updated = current.map((p) => {
        if (p.id === id) {
          updatedProduct = { ...p, ...updates, updated_at: new Date().toISOString() }
          return updatedProduct
        }
        return p
      })
      localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(updated))
    } else {
      const index = memoryProducts.findIndex((p) => p.id === id)
      if (index !== -1) {
        memoryProducts[index] = { ...memoryProducts[index], ...updates, updated_at: new Date().toISOString() }
        updatedProduct = memoryProducts[index]
      }
    }

    return updatedProduct || ({ id, ...updates } as CoffeeProduct)
  }

  static async deleteProduct(id: string, supabaseClient?: any): Promise<boolean> {
    const supabase = getDatabaseClient(supabaseClient)
    try {
      const { error } = await supabase.from("coffee_products").delete().eq("id", id)
      if (error) console.warn("Supabase deleteProduct warning:", error.message)
    } catch (error: any) {
      console.warn("Supabase deleteProduct error, falling back:", error?.message || error)
    }

    if (this.isBrowser()) {
      const current = await this.getProducts()
      const updated = current.filter((p) => p.id !== id)
      localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(updated))
    } else {
      memoryProducts = memoryProducts.filter((p) => p.id !== id)
    }

    return true
  }

  // --- COFFEE BILLS & COUNTER ---

  static async getNextBillNumber(supabaseClient?: any, reserve = false): Promise<string> {
    const supabase = getDatabaseClient(supabaseClient)
    if (reserve) {
      try {
        const { data, error } = await supabase.rpc("next_coffee_bill_number")
        if (!error && typeof data === "string" && data.trim()) {
          return data
        }
      } catch (e: any) {
        console.warn("RPC next_coffee_bill_number fallback:", e?.message || e)
      }
    }

    try {
      const { data, error } = await supabase
        .from("coffee_bills")
        .select("bill_number")
        .order("created_at", { ascending: false })
        .limit(1)

      if (!error && data && data.length > 0 && data[0].bill_number) {
        const lastNum = data[0].bill_number.replace(/[^0-9]/g, "")
        const parsed = parseInt(lastNum, 10)
        if (!isNaN(parsed)) {
          return `COF-${String(parsed + 1).padStart(4, "0")}`
        }
      }
    } catch (error: any) {
      console.warn("Supabase getNextBillNumber error, falling back:", error?.message || error)
    }

    if (this.isBrowser()) {
      const currentCounter = parseInt(localStorage.getItem(LOCAL_COUNTER_KEY) || "1001", 10)
      return `COF-${String(currentCounter).padStart(4, "0")}`
    }

    return `COF-${String(memoryCounter).padStart(4, "0")}`
  }

  static async getBills(supabaseClient?: any): Promise<CoffeeBill[]> {
    const supabase = getDatabaseClient(supabaseClient)
    try {
      const { data: bills, error } = await supabase
        .from("coffee_bills")
        .select(`
          id,
          bill_number,
          bill_date,
          table_name,
          bar_status,
          customer_name,
          customer_phone,
          subtotal,
          discount,
          tax,
          grand_total,
          payment_method,
          notes,
          created_at,
          coffee_bill_items (
            id,
            coffee_product_id,
            item_name,
            size,
            quantity,
            unit_price,
            line_total
          )
        `)
        .order("created_at", { ascending: false })

      if (!error && Array.isArray(bills) && bills.length > 0) {
        const mapped = bills.filter(Boolean).map((b: any) => ({
          id: String(b.id),
          bill_number: String(b.bill_number || "COF-0000"),
          bill_date: b.bill_date || new Date().toISOString(),
          table_name: b.table_name || "Takeaway",
          bar_status: b.bar_status || "served",
          customer_name: String(b.customer_name || ""),
          customer_phone: String(b.customer_phone || ""),
          subtotal: Number(b.subtotal) || 0,
          discount: Number(b.discount) || 0,
          tax: Number(b.tax) || 0,
          grand_total: Number(b.grand_total) || 0,
          payment_method: b.payment_method || "cash",
          notes: String(b.notes || ""),
          created_at: b.created_at,
          items: Array.isArray(b.coffee_bill_items)
            ? b.coffee_bill_items.filter(Boolean).map((item: any) => ({
                id: String(item.id),
                coffee_product_id: item.coffee_product_id,
                item_name: String(item.item_name || "Coffee item"),
                size: String(item.size || "Regular"),
                quantity: Number(item.quantity) || 0,
                unit_price: Number(item.unit_price) || 0,
                line_total: Number(item.line_total) || 0,
              }))
            : [],
        }))
        memoryBills = mapped
        return mapped
      }
      if (error) {
        console.warn("Supabase getBills warning:", error.message)
      }
    } catch (error: any) {
      console.warn("Supabase getBills error, falling back:", error?.message || error)
    }

    if (this.isBrowser()) {
      const local = localStorage.getItem(LOCAL_BILLS_KEY)
      if (local) {
        try {
          const parsed = JSON.parse(local)
          if (Array.isArray(parsed)) {
            return parsed.filter(Boolean).map((bill: any) => ({
              ...bill,
              id: String(bill.id || `local-${Date.now()}`),
              bill_number: String(bill.bill_number || "COF-0000"),
              items: Array.isArray(bill.items) ? bill.items.filter(Boolean) : [],
            }))
          }
        } catch {
          // ignore corrupted local state
        }
      }
    }

    return memoryBills.map((bill) => ({ ...bill, items: Array.isArray(bill.items) ? bill.items : [] }))
  }

  static async getBillById(id: string, supabaseClient?: any): Promise<CoffeeBill | null> {
    const bills = await this.getBills(supabaseClient)
    return bills.find((b) => b.id === id) || null
  }

  static async saveBill(
    billData: Omit<CoffeeBill, "id"> & { cashier_id?: string },
    supabaseClient?: any,
  ): Promise<CoffeeBill> {
    const supabase = getDatabaseClient(supabaseClient)
    const newId = "bill-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7)
    const billToSave: CoffeeBill = {
      ...billData,
      id: newId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const cashierId = (billData as CoffeeBill & { cashier_id?: string }).cashier_id
    const validCashierId = isUuid(cashierId) ? cashierId : null

    try {
      const { data: billRecord, error: billError } = await supabase
        .from("coffee_bills")
        .insert({
          bill_number: billData.bill_number,
          bill_date: billData.bill_date || new Date().toISOString(),
          table_name: billData.table_name || "Takeaway",
          bar_status: billData.bar_status || "pending",
          customer_name: billData.customer_name || null,
          customer_phone: billData.customer_phone || null,
          cashier_id: validCashierId,
          subtotal: billData.subtotal,
          discount: billData.discount,
          tax: billData.tax,
          grand_total: billData.grand_total,
          payment_method: billData.payment_method,
          notes: billData.notes || null,
        })
        .select()
        .single()

      if (!billError && billRecord) {
        billToSave.id = String(billRecord.id)

        // Insert bill line items with frozen snapshot of name and price
        const itemInserts = billData.items.map((item) => ({
          bill_id: billRecord.id,
          coffee_product_id: isUuid(item.coffee_product_id) ? item.coffee_product_id : null,
          item_name: item.item_name,
          size: item.size || "Regular",
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        }))

        const { error: itemsError } = await supabase.from("coffee_bill_items").insert(itemInserts)
        if (itemsError) {
          console.warn("Supabase coffee_bill_items insert warning:", itemsError.message)
        }
      } else if (billError) {
        console.warn("Supabase coffee_bills insert warning:", billError.message)
      }
    } catch (error: any) {
      console.warn("Supabase saveBill error, falling back:", error?.message || error)
    }

    if (this.isBrowser()) {
      const bills = await this.getBills()
      const updated = [billToSave, ...bills]
      localStorage.setItem(LOCAL_BILLS_KEY, JSON.stringify(updated))

      // Increment counter
      const currentCounter = parseInt(localStorage.getItem(LOCAL_COUNTER_KEY) || "1001", 10)
      localStorage.setItem(LOCAL_COUNTER_KEY, String(currentCounter + 1))

      try {
        window.dispatchEvent(new CustomEvent("pos_orders_updated"))
        window.dispatchEvent(new CustomEvent("pos_realtime_sync"))
        if ("BroadcastChannel" in window) {
          const bc = new BroadcastChannel("pos_realtime_sync")
          bc.postMessage({ type: "orders", data: billToSave })
          bc.close()
        }
      } catch {}
    } else {
      memoryBills.unshift(billToSave)
      memoryCounter++
    }

    return billToSave
  }

  static async updateBill(id: string, updates: Partial<CoffeeBill>, supabaseClient?: any): Promise<CoffeeBill | null> {
    const supabase = getDatabaseClient(supabaseClient)
    let updatedBill: CoffeeBill | null = null

    try {
      const { data, error } = await supabase
        .from("coffee_bills")
        .update({
          customer_name: updates.customer_name,
          customer_phone: updates.customer_phone,
          subtotal: updates.subtotal,
          discount: updates.discount,
          tax: updates.tax,
          grand_total: updates.grand_total,
          payment_method: updates.payment_method,
          notes: updates.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .maybeSingle()

      if (!error && data) {
        updatedBill = { ...data, items: updates.items || [] } as CoffeeBill
      }

      if (updates.items && (!error || !updatedBill)) {
        await supabase.from("coffee_bill_items").delete().eq("bill_id", id)
        const itemInserts = updates.items.map((item) => ({
          bill_id: id,
          coffee_product_id: isUuid(item.coffee_product_id) ? item.coffee_product_id : null,
          item_name: item.item_name,
          size: item.size || "Regular",
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        }))
        await supabase.from("coffee_bill_items").insert(itemInserts)
      }
    } catch (error: any) {
      console.warn("Supabase updateBill error, falling back:", error?.message || error)
    }

    if (this.isBrowser()) {
      const bills = await this.getBills()
      const updated = bills.map((b) => {
        if (b.id === id) {
          updatedBill = { ...b, ...updates, updated_at: new Date().toISOString() }
          return updatedBill
        }
        return b
      })
      localStorage.setItem(LOCAL_BILLS_KEY, JSON.stringify(updated))

      try {
        window.dispatchEvent(new CustomEvent("pos_orders_updated"))
        window.dispatchEvent(new CustomEvent("pos_realtime_sync"))
        if ("BroadcastChannel" in window) {
          const bc = new BroadcastChannel("pos_realtime_sync")
          bc.postMessage({ type: "orders", data: updatedBill })
          bc.close()
        }
      } catch {}
    } else {
      const idx = memoryBills.findIndex((b) => b.id === id)
      if (idx !== -1) {
        memoryBills[idx] = { ...memoryBills[idx], ...updates, updated_at: new Date().toISOString() }
        updatedBill = memoryBills[idx]
      }
    }

    return updatedBill || ({ id, ...updates } as CoffeeBill)
  }

  static async deleteBill(id: string, supabaseClient?: any): Promise<boolean> {
    const supabase = getDatabaseClient(supabaseClient)
    try {
      const { error } = await supabase.from("coffee_bills").delete().eq("id", id)
      if (error) console.warn("Supabase deleteBill warning:", error.message)
    } catch (error: any) {
      console.warn("Supabase deleteBill error, falling back:", error?.message || error)
    }

    if (this.isBrowser()) {
      const bills = await this.getBills()
      const updated = bills.filter((b) => b.id !== id)
      localStorage.setItem(LOCAL_BILLS_KEY, JSON.stringify(updated))

      try {
        window.dispatchEvent(new CustomEvent("pos_orders_updated"))
        window.dispatchEvent(new CustomEvent("pos_realtime_sync"))
        if ("BroadcastChannel" in window) {
          const bc = new BroadcastChannel("pos_realtime_sync")
          bc.postMessage({ type: "orders", data: { id, deleted: true } })
          bc.close()
        }
      } catch {}
    } else {
      memoryBills = memoryBills.filter((b) => b.id !== id)
    }

    return true
  }

  // --- COFFEE REPORT GENERATION ---

  static async generateReport(filters: CoffeeReportFilters = {}, supabaseClient?: any): Promise<CoffeeReportSummary> {
    try {
      const allBills = await this.getBills(supabaseClient)

      // Filter bills
      const filteredBills = allBills.filter((b) => {
        // Date filter
        if (filters.startDate) {
          const billTime = new Date(b.bill_date).getTime()
          const startTime = new Date(filters.startDate).setHours(0, 0, 0, 0)
          if (billTime < startTime) return false
        }
        if (filters.endDate) {
          const billTime = new Date(b.bill_date).getTime()
          const endTime = new Date(filters.endDate).setHours(23, 59, 59, 999)
          if (billTime > endTime) return false
        }

        // Payment method filter
        if (filters.paymentMethod && filters.paymentMethod !== "all") {
          if (b.payment_method !== filters.paymentMethod) return false
        }

        // Product filter
        if (filters.productId && filters.productId !== "all") {
          const hasProduct = b.items?.some(
            (i) => i.coffee_product_id === filters.productId || i.item_name === filters.productId
          )
          if (!hasProduct) return false
        }

        return true
      })

      // Totals
      let totalSales = 0
      let totalCupsSold = 0
      let cashSales = 0
      let cardSales = 0
      let transferSales = 0

      const productMap = new Map<string, { category: string; qty: number; revenue: number }>()
      const dailyMap = new Map<string, { billCount: number; revenue: number }>()

      for (const bill of filteredBills) {
        totalSales += bill.grand_total || 0

        if (bill.payment_method === "cash") cashSales += bill.grand_total || 0
        else if (bill.payment_method === "card") cardSales += bill.grand_total || 0
        else transferSales += bill.grand_total || 0

        const dateKey = new Date(bill.bill_date).toISOString().split("T")[0]
        const currentDay = dailyMap.get(dateKey) || { billCount: 0, revenue: 0 }
        dailyMap.set(dateKey, {
          billCount: currentDay.billCount + 1,
          revenue: currentDay.revenue + (bill.grand_total || 0),
        })

        if (Array.isArray(bill.items)) {
          for (const item of bill.items) {
            totalCupsSold += item.quantity || 0
            const prodName = item.item_name
            const existing = productMap.get(prodName) || {
              category: item.size ? `${item.size}` : "Coffee",
              qty: 0,
              revenue: 0,
            }
            productMap.set(prodName, {
              category: existing.category,
              qty: existing.qty + (item.quantity || 0),
              revenue: existing.revenue + (item.line_total || 0),
            })
          }
        }
      }

      const productSales = Array.from(productMap.entries())
        .map(([name, stat]) => ({
          productName: name,
          category: stat.category,
          quantitySold: stat.qty,
          totalRevenue: stat.revenue,
          percentageOfSales: totalSales > 0 ? Math.round((stat.revenue / totalSales) * 100) : 0,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)

      const dailySummaries = Array.from(dailyMap.entries())
        .map(([date, stat]) => ({
          date,
          billCount: stat.billCount,
          totalRevenue: stat.revenue,
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      return {
        totalSales,
        billCount: filteredBills.length,
        totalCupsSold,
        averageBillValue: filteredBills.length > 0 ? Math.round(totalSales / filteredBills.length) : 0,
        cashSales,
        cardSales,
        transferSales,
        productSales,
        dailySummaries,
        bills: filteredBills,
      }
    } catch (error: any) {
      console.warn("Coffee report generation error, returning empty summary:", error?.message || error)
      return {
        totalSales: 0,
        billCount: 0,
        totalCupsSold: 0,
        averageBillValue: 0,
        cashSales: 0,
        cardSales: 0,
        transferSales: 0,
        productSales: [],
        dailySummaries: [],
        bills: [],
      }
    }
  }
}
