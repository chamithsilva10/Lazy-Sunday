import { CoffeeProduct, CoffeeBill, CoffeeBillItem, CoffeeReportFilters, CoffeeReportSummary } from "./types"
import { createClient } from "@/lib/supabase/client"
import { createStaffSupabaseClient } from "./auth"

export const INITIAL_COFFEE_PRODUCTS: CoffeeProduct[] = [
  {
    "id": "c-prod-101",
    "name": "Ristretto",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 500,
    "image_url": "/uploads/prod_1794637814975_5gmi8.jpg",
    "status": "active"
  },
  {
    "id": "c-prod-102",
    "name": "Espresso",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 500,
    "image_url": "/uploads/prod_1794639566380_84t95.jpg",
    "status": "active"
  },
  {
    "id": "c-prod-103",
    "name": "Long Black",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 650,
    "image_url": "https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-104",
    "name": "Flat White",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 750,
    "image_url": "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-105",
    "name": "Cappuccino",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 750,
    "image_url": "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-106",
    "name": "Latte",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 800,
    "image_url": "/latte-coffee.png",
    "status": "active"
  },
  {
    "id": "c-prod-107",
    "name": "Mocha",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 950,
    "image_url": "https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-108",
    "name": "V60 Pour Over",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 1100,
    "image_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-109",
    "name": "Matcha Latte",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 950,
    "image_url": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-110",
    "name": "Chocolate",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 900,
    "image_url": "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-111",
    "name": "Ceylon Breakfast",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 400,
    "image_url": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-112",
    "name": "Green Tea",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 450,
    "image_url": "https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-113",
    "name": "Ginger & Lemongrass",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 450,
    "image_url": "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-114",
    "name": "Chai",
    "category": "Coffee & Hot Drinks",
    "size": "Regular",
    "price": 650,
    "image_url": "https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-115",
    "name": "Mango Matcha",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 1050,
    "image_url": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-116",
    "name": "King Coconut",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 450,
    "image_url": "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-117",
    "name": "House Lime Soda",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 650,
    "image_url": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-118",
    "name": "House Pineapple & Mint Soda",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 750,
    "image_url": "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-119",
    "name": "Passion Soda",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 750,
    "image_url": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-120",
    "name": "Mango Smoothie",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 950,
    "image_url": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-121",
    "name": "Peanut Butter Shake",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 1100,
    "image_url": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-122",
    "name": "Pani Dodang & Sea Salt",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 750,
    "image_url": "/glass-of-orange-juice.png",
    "status": "active"
  },
  {
    "id": "c-prod-123",
    "name": "Ginger Lemonade",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 750,
    "image_url": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-124",
    "name": "Peach & Mango Iced Tea",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 800,
    "image_url": "/iced-tea.png",
    "status": "active"
  },
  {
    "id": "c-prod-125",
    "name": "Salted Coconut & Lime Sparkling",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 800,
    "image_url": "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80",
    "status": "active"
  },
  {
    "id": "c-prod-126",
    "name": "Sparkling Water",
    "category": "Cold Drinks",
    "size": "Regular",
    "price": 500,
    "image_url": "/bottled-water.png",
    "status": "active"
  }
]

const LOCAL_PRODUCTS_KEY = "pos_coffee_products"
const LOCAL_BILLS_KEY = "pos_coffee_bills"
const LOCAL_COUNTER_KEY = "pos_coffee_bill_counter"

// Memory cache for server-side route handlers or offline execution
let memoryProducts: CoffeeProduct[] = []
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
        if (local !== null) {
          const parsed = JSON.parse(local)
          if (Array.isArray(parsed)) return parsed
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

      if (!billError && billRecord && billRecord.id) {
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
