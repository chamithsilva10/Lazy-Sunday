export type CoffeeStatus = "active" | "inactive"

export interface CoffeeProduct {
  id: string
  name: string
  category: string
  size?: string
  price: number
  image_url?: string
  status: CoffeeStatus
  created_at?: string
  updated_at?: string
}

export interface CoffeeBillItem {
  id: string
  bill_id?: string
  coffee_product_id?: string
  item_name: string
  size?: string
  quantity: number
  unit_price: number
  line_total: number
}

export type CoffeePaymentMethod = "cash" | "card" | "transfer" | "qr" | "split"

export interface CoffeeBill {
  id: string
  bill_number: string // COF-XXXX
  bill_date: string // ISO date
  table_name?: string
  customer_name?: string
  customer_phone?: string
  items: CoffeeBillItem[]
  bar_status?: "pending" | "preparing" | "ready" | "served"
  subtotal: number
  discount: number
  tax: number
  grand_total: number
  payment_method: CoffeePaymentMethod
  split_payments?: { method: string; amount: number; reference?: string; tendered?: number; change_due?: number }[]
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface CoffeeReportFilters {
  startDate?: string
  endDate?: string
  productId?: string
  paymentMethod?: string
}

export interface CoffeeProductSaleSummary {
  productName: string
  category: string
  quantitySold: number
  totalRevenue: number
  percentageOfSales: number
}

export interface CoffeeDailySummary {
  date: string
  billCount: number
  totalRevenue: number
}

export interface CoffeeReportSummary {
  totalSales: number
  billCount: number
  totalCupsSold: number
  averageBillValue: number
  cashSales: number
  cardSales: number
  transferSales: number
  productSales: CoffeeProductSaleSummary[]
  dailySummaries: CoffeeDailySummary[]
  bills?: CoffeeBill[]
}
