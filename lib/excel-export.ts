/**
 * Professional Native Excel (.xlsx) & Horizontal CSV Export Engine
 * Generates genuine Microsoft Excel Workbooks (.xlsx OpenXML) and Universal CSVs (.csv)
 * with horizontal data alignment, native Auto-Filters, pre-configured column widths,
 * and comprehensive multi-sheet ledgers without any "corrupted or unsafe" warnings.
 */

import * as XLSX from "xlsx"
import { determineItemStation, getOrderStationScope, StationType } from "./station-routing"

// ---------- Helpers ----------
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return ""
  const str = String(val)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadExcelFile(buffer: Uint8Array, filename: string) {
  if (typeof window === "undefined") return
  const blob = new Blob([buffer as any], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsvFile(content: string, filename: string) {
  if (typeof window === "undefined") return
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadFile(content: string | Uint8Array, filename: string, mimeType?: string) {
  if (content instanceof Uint8Array) {
    downloadExcelFile(content, filename)
  } else {
    downloadCsvFile(content, filename)
  }
}

// ---------- Interfaces ----------
export interface ExportFilterMeta {
  dateRange: string
  stationScope: string // e.g. "All Stations", "Bar (Juices & Drinks)", "Kitchen (Food & Meals)"
  departmentScope: string // e.g. "All Departments", "Juice & Food", "Coffee Bar"
  paymentMethod: string // e.g. "All Payment Methods", "Cash", etc.
  category?: string
  product?: string
  generatedAt: string
  generatedBy?: string
}

export interface SalesReportExportOrder {
  id: string
  order_number: string
  receipt_number?: string
  table_name?: string
  cashier_name?: string
  department?: string
  items: { name: string; price: number; quantity: number; category?: string; station?: string }[]
  subtotal: number
  service_charge: number
  service_charge_rate?: number
  discount: number
  total: number
  payment_method: string
  split_payments?: { method: string; amount: number; reference?: string }[]
  status: string
  kitchen_status?: string
  created_at: string
}

export interface SalesReportExportData {
  filters: ExportFilterMeta
  totalSales: number
  billCount: number
  totalItemsSold: number
  averageBillValue: number
  totalServiceCharge: number
  cashSales: number
  cardSales: number
  qrSales: number
  bankTransferSales: number
  creditSales: number
  kitchenRevenue: number
  kitchenItemCount: number
  barRevenue: number
  barItemCount: number
  orders: SalesReportExportOrder[]
  productSales: {
    productName: string
    category: string
    quantitySold: number
    totalRevenue: number
    percentageOfSales: number
  }[]
  categorySales: {
    category: string
    itemCount: number
    totalRevenue: number
    percentageOfSales: number
  }[]
  dailySummaries: {
    date: string
    billCount: number
    totalRevenue: number
    totalServiceCharge: number
  }[]
}

export interface CoffeeReportExportBill {
  id: string
  bill_number: string
  bill_date: string
  table_name?: string
  customer_name?: string
  customer_phone?: string
  cashier_name?: string
  items: { item_name: string; size?: string; quantity: number; unit_price: number; line_total: number }[]
  subtotal: number
  discount: number
  tax?: number
  grand_total: number
  payment_method: string
  notes?: string
}

export interface CoffeeReportExportData {
  filters: {
    dateRange: string
    paymentMethod: string
    product: string
    generatedAt: string
  }
  totalSales: number
  billCount: number
  totalCupsSold: number
  averageBillValue: number
  cashSales: number
  cardSales: number
  transferSales: number
  bills?: CoffeeReportExportBill[]
  productSales: {
    productName: string
    category: string
    quantitySold: number
    totalRevenue: number
    percentageOfSales: number
  }[]
  dailySummaries: {
    date: string
    billCount: number
    totalRevenue: number
  }[]
}

// ============================================================================
// MAIN POS SALES REPORT: NATIVE EXCEL (.xlsx) GENERATOR
// ============================================================================
export function generateSalesReportExcelXml(data: SalesReportExportData): Uint8Array {
  return generateSalesReportXlsx(data)
}

export function generateSalesReportXlsx(data: SalesReportExportData): Uint8Array {
  const { filters } = data
  const wb = XLSX.utils.book_new()

  // 1. WORKSHEET 1: TRANSACTIONS LEDGER (Horizontal Order-by-Order Table)
  const ledgerData: any[][] = [
    ["RESTAURANT & BAR — TRANSACTIONS & SALES REGISTER"],
    [
      `Date Range: ${filters.dateRange}  |  Station: ${filters.stationScope}  |  Department: ${filters.departmentScope}  |  Payment: ${filters.paymentMethod}  |  Exported: ${filters.generatedAt}`,
    ],
    [],
    [
      "Order Number",
      "Receipt #",
      "Date",
      "Time",
      "Station",
      "Department",
      "Table / Place",
      "Cashier",
      "Items Ordered",
      "Total Qty",
      "Subtotal (Rs.)",
      "Discount (Rs.)",
      "Service Chg (Rs.)",
      "Net Total (Rs.)",
      "Payment Method",
      "Status",
    ],
  ]

  let totalSubtotal = 0
  let totalDiscount = 0
  let totalServiceCharge = 0
  let totalNet = 0
  let totalItemsCount = 0

  const ordersList = data.orders || []

  ordersList.forEach((order) => {
    const dateObj = new Date(order.created_at)
    const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split("T")[0] : order.created_at
    const timeStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString("en-US", { hour12: false }) : ""

    const stationScope = getOrderStationScope(order.items)
    const stationLabel =
      stationScope === "mixed" ? "🍹🍳 Mixed" : stationScope === "bar" ? "🍹 Bar" : "🍳 Kitchen"

    const itemsSummary = (order.items || [])
      .map((i) => `${i.quantity}x ${i.name}`)
      .join(", ")

    const orderItemsQty = (order.items || []).reduce((sum, i) => sum + i.quantity, 0)

    totalSubtotal += order.subtotal || 0
    totalDiscount += order.discount || 0
    totalServiceCharge += order.service_charge || 0
    totalNet += order.total || 0
    totalItemsCount += orderItemsQty

    ledgerData.push([
      order.order_number,
      order.receipt_number || order.order_number,
      dateStr,
      timeStr,
      stationLabel,
      order.department || "Juice & Food",
      order.table_name || "Counter",
      order.cashier_name || "Cashier",
      itemsSummary,
      orderItemsQty,
      order.subtotal || 0,
      order.discount || 0,
      order.service_charge || 0,
      order.total || 0,
      order.split_payments && order.split_payments.length > 0
        ? `SPLIT (${order.split_payments.map((sp) => `${(sp.method || "").toUpperCase()}: ${Number(sp.amount || 0).toLocaleString()}`).join(" / ")})`
        : (order.payment_method || "cash").toUpperCase(),
      (order.status || "paid").toUpperCase(),
    ])
  })

  // Summary row
  ledgerData.push([
    `TOTAL (${ordersList.length} Orders)`,
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    totalItemsCount,
    totalSubtotal,
    totalDiscount,
    totalServiceCharge,
    totalNet,
    "-",
    "-",
  ])

  const wsLedger = XLSX.utils.aoa_to_sheet(ledgerData)
  wsLedger["!cols"] = [
    { wch: 15 }, // Order #
    { wch: 15 }, // Receipt #
    { wch: 12 }, // Date
    { wch: 10 }, // Time
    { wch: 14 }, // Station
    { wch: 16 }, // Department
    { wch: 14 }, // Table
    { wch: 14 }, // Cashier
    { wch: 42 }, // Items
    { wch: 11 }, // Qty
    { wch: 15 }, // Subtotal
    { wch: 14 }, // Discount
    { wch: 16 }, // Service Charge
    { wch: 16 }, // Net Total
    { wch: 15 }, // Payment
    { wch: 12 }, // Status
  ]
  const ledgerLastRow = Math.max(5, ledgerData.length)
  wsLedger["!autofilter"] = { ref: `A4:P${ledgerLastRow}` }
  XLSX.utils.book_append_sheet(wb, wsLedger, "Transactions Ledger")

  // 2. WORKSHEET 2: PRODUCT PERFORMANCE
  const prodData: any[][] = [
    ["PRODUCT SALES & VOLUME PERFORMANCE"],
    [`Date Range: ${filters.dateRange}  |  Station Scope: ${filters.stationScope}  |  Ranked by Total Revenue`],
    [],
    [
      "Rank (#)",
      "Product Name",
      "Category",
      "Station",
      "Units Sold",
      "Avg Unit Price (Rs.)",
      "Total Revenue (Rs.)",
      "Share of Sales (%)",
    ],
  ]

  let prodTotalQty = 0
  let prodTotalRev = 0

  data.productSales.forEach((p, idx) => {
    const station = determineItemStation({ name: p.productName, category: p.category })
    const stationLabel = station === "bar" ? "🍹 Bar" : "🍳 Kitchen"
    const avgPrice = p.quantitySold > 0 ? Math.round(p.totalRevenue / p.quantitySold) : 0

    prodTotalQty += p.quantitySold
    prodTotalRev += p.totalRevenue

    prodData.push([
      idx + 1,
      p.productName,
      p.category,
      stationLabel,
      p.quantitySold,
      avgPrice,
      p.totalRevenue,
      `${p.percentageOfSales}%`,
    ])
  })

  prodData.push([
    `TOTAL (${data.productSales.length} Products)`,
    "-",
    "-",
    "-",
    prodTotalQty,
    "-",
    prodTotalRev,
    "100.0%",
  ])

  const wsProd = XLSX.utils.aoa_to_sheet(prodData)
  wsProd["!cols"] = [
    { wch: 10 },
    { wch: 28 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
  ]
  const prodLastRow = Math.max(5, prodData.length)
  wsProd["!autofilter"] = { ref: `A4:H${prodLastRow}` }
  XLSX.utils.book_append_sheet(wb, wsProd, "Product Sales")

  // 3. WORKSHEET 3: CATEGORY & STATION ANALYSIS
  const catData: any[][] = [
    ["CATEGORY & STATION PERFORMANCE BREAKDOWN"],
    [`Date Range: ${filters.dateRange}  |  Station Scope: ${filters.stationScope}`],
    [],
    ["Menu Category", "Primary Station", "Items Sold (Units)", "Total Revenue (Rs.)", "Contribution (%)"],
  ]

  let catTotalQty = 0
  let catTotalRev = 0

  data.categorySales.forEach((c) => {
    const station = determineItemStation({ category: c.category })
    const stationLabel = station === "bar" ? "🍹 Bar (Beverages)" : "🍳 Kitchen (Food)"

    catTotalQty += c.itemCount
    catTotalRev += c.totalRevenue

    catData.push([c.category, stationLabel, c.itemCount, c.totalRevenue, `${c.percentageOfSales}%`])
  })

  catData.push([`TOTAL (${data.categorySales.length} Categories)`, "-", catTotalQty, catTotalRev, "100.0%"])

  // Add station fulfillment summary below
  catData.push([])
  catData.push(["STATION FULFILLMENT BREAKDOWN (KITCHEN VS BAR)"])
  catData.push(["Station", "Ticket Routing", "Items Sold", "Station Revenue (Rs.)", "Revenue Share (%)"])
  const kitchenShare = data.totalSales > 0 ? Math.round((data.kitchenRevenue / data.totalSales) * 100) : 0
  const barShare = data.totalSales > 0 ? Math.round((data.barRevenue / data.totalSales) * 100) : 0
  catData.push([
    "🍳 Kitchen Station",
    "KOT (Food & Meals)",
    data.kitchenItemCount,
    data.kitchenRevenue,
    `${kitchenShare}%`,
  ])
  catData.push([
    "🍹 Bar / Beverage Station",
    "BOT (Juices & Drinks)",
    data.barItemCount,
    data.barRevenue,
    `${barShare}%`,
  ])

  const wsCat = XLSX.utils.aoa_to_sheet(catData)
  wsCat["!cols"] = [{ wch: 24 }, { wch: 24 }, { wch: 18 }, { wch: 20 }, { wch: 18 }]
  const catFilterRow = Math.max(5, 4 + data.categorySales.length)
  wsCat["!autofilter"] = { ref: `A4:E${catFilterRow}` }
  XLSX.utils.book_append_sheet(wb, wsCat, "Category & Station")

  // 4. WORKSHEET 4: DAILY REVENUE
  const dailyData: any[][] = [
    ["DAILY REVENUE & PAYMENT SETTLEMENT REGISTER"],
    [`Chronological day-by-day revenue breakdown  |  Date Range: ${filters.dateRange}`],
    [],
    [
      "Date",
      "Day of Week",
      "Orders Count",
      "Sales Subtotal (Rs.)",
      "Service Charge (Rs.)",
      "Total Revenue (Rs.)",
      "Average Ticket (Rs.)",
    ],
  ]

  let dailyTotalBills = 0
  let dailyTotalRev = 0
  let dailyTotalService = 0

  data.dailySummaries.forEach((d) => {
    const dDate = new Date(d.date)
    const dayOfWeek = !isNaN(dDate.getTime())
      ? dDate.toLocaleDateString("en-US", { weekday: "short" })
      : ""
    const avgTicket = d.billCount > 0 ? Math.round(d.totalRevenue / d.billCount) : 0

    dailyTotalBills += d.billCount
    dailyTotalRev += d.totalRevenue
    dailyTotalService += d.totalServiceCharge

    dailyData.push([
      d.date,
      dayOfWeek,
      d.billCount,
      d.totalRevenue - d.totalServiceCharge,
      d.totalServiceCharge,
      d.totalRevenue,
      avgTicket,
    ])
  })

  dailyData.push([
    `TOTAL (${data.dailySummaries.length} Days)`,
    "-",
    dailyTotalBills,
    dailyTotalRev - dailyTotalService,
    dailyTotalService,
    dailyTotalRev,
    dailyTotalBills > 0 ? Math.round(dailyTotalRev / dailyTotalBills) : 0,
  ])

  const wsDaily = XLSX.utils.aoa_to_sheet(dailyData)
  wsDaily["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
  ]
  const dailyLastRow = Math.max(5, dailyData.length)
  wsDaily["!autofilter"] = { ref: `A4:G${dailyLastRow}` }
  XLSX.utils.book_append_sheet(wb, wsDaily, "Daily Revenue")

  // 5. WORKSHEET 5: EXECUTIVE KPI SUMMARY (HORIZONTAL)
  const execData: any[][] = [
    ["EXECUTIVE HORIZONTAL KPI OVERVIEW"],
    ["All core sales metrics arranged side-by-side horizontally across columns for instant spreadsheet auditing."],
    [],
    [
      "Date Scope",
      "Station Filter",
      "Total Orders",
      "Items Sold",
      "Gross Revenue (Rs.)",
      "Service Charges (Rs.)",
      "Net Total (Rs.)",
      "Average Ticket (Rs.)",
      "Cash Sales (Rs.)",
      "Card Terminal (Rs.)",
      "QR / Online (Rs.)",
      "Bank Transfer (Rs.)",
      "Customer Credit (Rs.)",
      "Kitchen Share (%)",
      "Bar Share (%)",
    ],
    [
      filters.dateRange,
      filters.stationScope,
      data.billCount,
      data.totalItemsSold,
      data.totalSales - data.totalServiceCharge,
      data.totalServiceCharge,
      data.totalSales,
      data.averageBillValue,
      data.cashSales,
      data.cardSales,
      data.qrSales,
      data.bankTransferSales,
      data.creditSales,
      `${kitchenShare}%`,
      `${barShare}%`,
    ],
    [],
    ["PAYMENT METHOD SETTLEMENT BREAKDOWN"],
    ["Payment Method", "Collected (Rs.)", "Share of Total (%)", "Settlement Account", "Reconciliation Status"],
    [
      "Cash Register",
      data.cashSales,
      `${data.totalSales > 0 ? Math.round((data.cashSales / data.totalSales) * 100) : 0}%`,
      "Drawer Cash",
      "Physical Drawer Count Required",
    ],
    [
      "Card Terminal",
      data.cardSales,
      `${data.totalSales > 0 ? Math.round((data.cardSales / data.totalSales) * 100) : 0}%`,
      "Merchant Bank",
      "Electronic Settlement",
    ],
    [
      "QR / Online Pay",
      data.qrSales,
      `${data.totalSales > 0 ? Math.round((data.qrSales / data.totalSales) * 100) : 0}%`,
      "LANKAQR / Digital",
      "Real-time Bank Credit",
    ],
    [
      "Bank Transfer",
      data.bankTransferSales,
      `${data.totalSales > 0 ? Math.round((data.bankTransferSales / data.totalSales) * 100) : 0}%`,
      "Direct Transfer",
      "Slip Verification Attached",
    ],
    [
      "Customer Credit",
      data.creditSales,
      `${data.totalSales > 0 ? Math.round((data.creditSales / data.totalSales) * 100) : 0}%`,
      "Receivables Ledger",
      "Outstanding Settlement",
    ],
  ]

  const wsExec = XLSX.utils.aoa_to_sheet(execData)
  wsExec["!cols"] = [
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(wb, wsExec, "Executive KPIs")

  // Generate binary XLSX buffer
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  return new Uint8Array(out)
}

// ============================================================================
// MAIN POS SALES REPORT: HORIZONTAL CSV GENERATOR
// ============================================================================
export function generateSalesReportCsv(data: SalesReportExportData): string {
  const { filters } = data
  let out = "\uFEFF" // UTF-8 BOM so Excel opens with proper encoding

  // Header Title & Metadata
  out += `RESTAURANT & BAR - TRANSACTIONS & SALES REGISTER\r\n`
  out += `Date Range,${escapeCsv(filters.dateRange)},Station Scope,${escapeCsv(filters.stationScope)},Department,${escapeCsv(filters.departmentScope)},Payment Method,${escapeCsv(filters.paymentMethod)},Generated At,${escapeCsv(filters.generatedAt)}\r\n\r\n`

  // 1. Horizontal Executive KPI Row
  out += `EXECUTIVE SUMMARY (HORIZONTAL)\r\n`
  out += `Date Scope,Station Scope,Total Orders,Total Items Sold,Gross Sales (Rs.),Service Charges (Rs.),Net Revenue (Rs.),Average Order (Rs.),Cash (Rs.),Card (Rs.),QR / Online (Rs.),Bank Transfer (Rs.),Customer Credit (Rs.),Kitchen Revenue (Rs.),Bar Revenue (Rs.)\r\n`
  out += `${escapeCsv(filters.dateRange)},${escapeCsv(filters.stationScope)},${data.billCount},${data.totalItemsSold},${data.totalSales - data.totalServiceCharge},${data.totalServiceCharge},${data.totalSales},${data.averageBillValue},${data.cashSales},${data.cardSales},${data.qrSales},${data.bankTransferSales},${data.creditSales},${data.kitchenRevenue},${data.barRevenue}\r\n\r\n`

  // 2. Full Orders / Transactions Ledger (Horizontal Table)
  out += `ALL TRANSACTIONS LEDGER\r\n`
  out += `Order #,Receipt #,Date,Time,Station,Department,Table / Channel,Cashier,Items Ordered,Items Qty,Subtotal (Rs.),Discount (Rs.),Service Charge (Rs.),Net Total (Rs.),Payment Method,Status\r\n`

  const orders = data.orders || []
  orders.forEach((o) => {
    const d = new Date(o.created_at)
    const dateStr = !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : o.created_at
    const timeStr = !isNaN(d.getTime()) ? d.toLocaleTimeString("en-US", { hour12: false }) : ""

    const stationScope = getOrderStationScope(o.items)
    const stationLabel =
      stationScope === "mixed" ? "Mixed (Bar & Kitchen)" : stationScope === "bar" ? "Bar" : "Kitchen"

    const itemsSummary = (o.items || [])
      .map((i) => `${i.quantity}x ${i.name}`)
      .join("; ")
    const totalQty = (o.items || []).reduce((sum, i) => sum + i.quantity, 0)

    const payMethodDisplay =
      o.split_payments && o.split_payments.length > 0
        ? `SPLIT (${o.split_payments.map((sp) => `${(sp.method || "").toUpperCase()}: ${Number(sp.amount || 0).toLocaleString()}`).join(" / ")})`
        : o.payment_method

    out += `${escapeCsv(o.order_number)},${escapeCsv(o.receipt_number || o.order_number)},${escapeCsv(dateStr)},${escapeCsv(timeStr)},${escapeCsv(stationLabel)},${escapeCsv(o.department || "Juice & Food")},${escapeCsv(o.table_name || "Counter")},${escapeCsv(o.cashier_name || "Cashier")},${escapeCsv(itemsSummary)},${totalQty},${o.subtotal || 0},${o.discount || 0},${o.service_charge || 0},${o.total || 0},${escapeCsv(payMethodDisplay)},${escapeCsv(o.status)}\r\n`
  })

  // 3. Product Sales Table
  out += `\r\nPRODUCT SALES BREAKDOWN\r\n`
  out += `Rank,Product Name,Category,Station,Quantity Sold,Average Price (Rs.),Total Revenue (Rs.),Sales Share (%)\r\n`
  data.productSales.forEach((p, idx) => {
    const station = determineItemStation({ name: p.productName, category: p.category }) === "bar" ? "Bar" : "Kitchen"
    const avgPrice = p.quantitySold > 0 ? Math.round(p.totalRevenue / p.quantitySold) : 0
    out += `${idx + 1},${escapeCsv(p.productName)},${escapeCsv(p.category)},${escapeCsv(station)},${p.quantitySold},${avgPrice},${p.totalRevenue},${p.percentageOfSales}%\r\n`
  })

  // 4. Category Sales Table
  out += `\r\nCATEGORY SALES BREAKDOWN\r\n`
  out += `Category,Station,Items Sold,Total Revenue (Rs.),Sales Share (%)\r\n`
  data.categorySales.forEach((c) => {
    const station = determineItemStation({ category: c.category }) === "bar" ? "Bar" : "Kitchen"
    out += `${escapeCsv(c.category)},${escapeCsv(station)},${c.itemCount},${c.totalRevenue},${c.percentageOfSales}%\r\n`
  })

  // 5. Daily Summary Table
  out += `\r\nDAILY REVENUE SUMMARY\r\n`
  out += `Date,Orders Count,Subtotal (Rs.),Service Charges (Rs.),Total Revenue (Rs.)\r\n`
  data.dailySummaries.forEach((d) => {
    out += `${escapeCsv(d.date)},${d.billCount},${d.totalRevenue - d.totalServiceCharge},${d.totalServiceCharge},${d.totalRevenue}\r\n`
  })

  return out
}

// ============================================================================
// COFFEE MODULE REPORT: NATIVE EXCEL (.xlsx) GENERATOR
// ============================================================================
export function generateCoffeeReportExcelXml(data: CoffeeReportExportData): Uint8Array {
  return generateCoffeeReportXlsx(data)
}

export function generateCoffeeReportXlsx(data: CoffeeReportExportData): Uint8Array {
  const { filters } = data
  const wb = XLSX.utils.book_new()

  // 1. WORKSHEET 1: COFFEE BILLS LEDGER
  const ledgerData: any[][] = [
    ["COFFEE BAR — SALES & BILLS LEDGER"],
    [`Date Range: ${filters.dateRange}  |  Payment: ${filters.paymentMethod}  |  Exported: ${filters.generatedAt}`],
    [],
    [
      "Bill Number",
      "Date",
      "Time",
      "Station",
      "Table / Counter",
      "Customer",
      "Coffee Items Ordered",
      "Cups Qty",
      "Subtotal (Rs.)",
      "Discount (Rs.)",
      "Grand Total (Rs.)",
      "Payment Method",
    ],
  ]

  let totalGrand = 0
  let totalSub = 0
  let totalDisc = 0
  let totalCups = 0
  const billsList = data.bills || []

  billsList.forEach((bill) => {
    const dateObj = new Date(bill.bill_date)
    const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split("T")[0] : bill.bill_date
    const timeStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString("en-US", { hour12: false }) : ""

    const itemsSummary = (bill.items || [])
      .map((i) => `${i.quantity}x ${i.item_name}${i.size ? ` (${i.size})` : ""}`)
      .join(", ")

    const cups = (bill.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0)

    totalGrand += bill.grand_total || 0
    totalSub += bill.subtotal || 0
    totalDisc += bill.discount || 0
    totalCups += cups

    ledgerData.push([
      bill.bill_number,
      dateStr,
      timeStr,
      "☕ Coffee Bar",
      bill.table_name || "Takeaway",
      bill.customer_name || "Guest",
      itemsSummary,
      cups,
      bill.subtotal || 0,
      bill.discount || 0,
      bill.grand_total || 0,
      (bill.payment_method || "cash").toUpperCase(),
    ])
  })

  ledgerData.push([
    `TOTAL (${billsList.length} Bills)`,
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    totalCups,
    totalSub,
    totalDisc,
    totalGrand,
    "-",
  ])

  const wsLedger = XLSX.utils.aoa_to_sheet(ledgerData)
  wsLedger["!cols"] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 15 },
    { wch: 16 },
    { wch: 18 },
    { wch: 38 },
    { wch: 10 },
    { wch: 15 },
    { wch: 14 },
    { wch: 16 },
    { wch: 15 },
  ]
  const lastRow = Math.max(5, ledgerData.length)
  wsLedger["!autofilter"] = { ref: `A4:L${lastRow}` }
  XLSX.utils.book_append_sheet(wb, wsLedger, "Coffee Bills Ledger")

  // 2. WORKSHEET 2: COFFEE PRODUCTS
  const prodData: any[][] = [
    ["COFFEE ITEM PERFORMANCE"],
    [`Date Range: ${filters.dateRange}  |  Product: ${filters.product}  |  Ranked by Revenue`],
    [],
    [
      "Rank (#)",
      "Coffee Item",
      "Size / Variation",
      "Cups Sold",
      "Unit Price (Rs.)",
      "Revenue (Rs.)",
      "Share of Coffee Sales (%)",
    ],
  ]

  let prodTotalCups = 0
  let prodTotalRev = 0

  data.productSales.forEach((p, idx) => {
    const avgPrice = p.quantitySold > 0 ? Math.round(p.totalRevenue / p.quantitySold) : 0
    prodTotalCups += p.quantitySold
    prodTotalRev += p.totalRevenue

    prodData.push([
      idx + 1,
      p.productName,
      p.category,
      p.quantitySold,
      avgPrice,
      p.totalRevenue,
      `${p.percentageOfSales}%`,
    ])
  })

  prodData.push([`TOTAL (${data.productSales.length} Items)`, "-", "-", prodTotalCups, "-", prodTotalRev, "100.0%"])

  const wsProd = XLSX.utils.aoa_to_sheet(prodData)
  wsProd["!cols"] = [{ wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 24 }]
  const prodLastRow = Math.max(5, prodData.length)
  wsProd["!autofilter"] = { ref: `A4:G${prodLastRow}` }
  XLSX.utils.book_append_sheet(wb, wsProd, "Coffee Products")

  // 3. WORKSHEET 3: DAILY COFFEE SALES
  const dailyData: any[][] = [
    ["DAILY COFFEE SALES"],
    [`Date Range: ${filters.dateRange}`],
    [],
    ["Date", "Bills Count", "Daily Revenue (Rs.)", "Average Bill (Rs.)"],
  ]

  let dailyTotalCount = 0
  let dailyTotalRev = 0

  data.dailySummaries.forEach((d) => {
    const avg = d.billCount > 0 ? Math.round(d.totalRevenue / d.billCount) : 0
    dailyTotalCount += d.billCount
    dailyTotalRev += d.totalRevenue

    dailyData.push([d.date, d.billCount, d.totalRevenue, avg])
  })

  dailyData.push([
    `TOTAL (${data.dailySummaries.length} Days)`,
    dailyTotalCount,
    dailyTotalRev,
    dailyTotalCount > 0 ? Math.round(dailyTotalRev / dailyTotalCount) : 0,
  ])

  const wsDaily = XLSX.utils.aoa_to_sheet(dailyData)
  wsDaily["!cols"] = [{ wch: 15 }, { wch: 14 }, { wch: 20 }, { wch: 20 }]
  const dailyLastRow = Math.max(5, dailyData.length)
  wsDaily["!autofilter"] = { ref: `A4:D${dailyLastRow}` }
  XLSX.utils.book_append_sheet(wb, wsDaily, "Daily Coffee Sales")

  // 4. WORKSHEET 4: EXECUTIVE KPIS (HORIZONTAL)
  const execData: any[][] = [
    ["COFFEE BAR — EXECUTIVE HORIZONTAL KPIS"],
    ["High-level operational performance figures displayed horizontally side-by-side."],
    [],
    [
      "Date Range",
      "Bills Count",
      "Cups Sold",
      "Total Sales (Rs.)",
      "Average Ticket (Rs.)",
      "Cash Sales (Rs.)",
      "Card Sales (Rs.)",
      "QR / Transfer (Rs.)",
    ],
    [
      filters.dateRange,
      data.billCount,
      data.totalCupsSold,
      data.totalSales,
      data.averageBillValue,
      data.cashSales,
      data.cardSales,
      data.transferSales,
    ],
  ]

  const wsExec = XLSX.utils.aoa_to_sheet(execData)
  wsExec["!cols"] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
  ]
  XLSX.utils.book_append_sheet(wb, wsExec, "Executive KPIs")

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  return new Uint8Array(out)
}

// ============================================================================
// COFFEE MODULE REPORT: HORIZONTAL CSV GENERATOR
// ============================================================================
export function generateCoffeeReportCsv(data: CoffeeReportExportData): string {
  const { filters } = data
  let out = "\uFEFF"

  out += `COFFEE BAR - SALES REPORT\r\n`
  out += `Date Range,${escapeCsv(filters.dateRange)},Payment Method,${escapeCsv(filters.paymentMethod)},Generated At,${escapeCsv(filters.generatedAt)}\r\n\r\n`

  out += `EXECUTIVE SUMMARY (HORIZONTAL)\r\n`
  out += `Date Scope,Total Bills,Total Cups Sold,Total Sales (Rs.),Average Bill (Rs.),Cash (Rs.),Card (Rs.),QR / Transfer (Rs.)\r\n`
  out += `${escapeCsv(filters.dateRange)},${data.billCount},${data.totalCupsSold},${data.totalSales},${data.averageBillValue},${data.cashSales},${data.cardSales},${data.transferSales}\r\n\r\n`

  out += `COFFEE BILLS LEDGER\r\n`
  out += `Bill Number,Date,Time,Station,Table / Counter,Customer,Items Ordered,Cups Qty,Subtotal (Rs.),Discount (Rs.),Grand Total (Rs.),Payment Method\r\n`

  const bills = data.bills || []
  bills.forEach((b) => {
    const d = new Date(b.bill_date)
    const dateStr = !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : b.bill_date
    const timeStr = !isNaN(d.getTime()) ? d.toLocaleTimeString("en-US", { hour12: false }) : ""
    const itemsSummary = (b.items || [])
      .map((i) => `${i.quantity}x ${i.item_name}${i.size ? ` (${i.size})` : ""}`)
      .join("; ")
    const cups = (b.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0)

    out += `${escapeCsv(b.bill_number)},${escapeCsv(dateStr)},${escapeCsv(timeStr)},Coffee Bar,${escapeCsv(b.table_name || "Takeaway")},${escapeCsv(b.customer_name || "Guest")},${escapeCsv(itemsSummary)},${cups},${b.subtotal || 0},${b.discount || 0},${b.grand_total || 0},${escapeCsv(b.payment_method)}\r\n`
  })

  out += `\r\nCOFFEE PRODUCTS BREAKDOWN\r\n`
  out += `Rank,Product Name,Size/Category,Cups Sold,Revenue (Rs.),Sales Share (%)\r\n`
  data.productSales.forEach((p, idx) => {
    out += `${idx + 1},${escapeCsv(p.productName)},${escapeCsv(p.category)},${p.quantitySold},${p.totalRevenue},${p.percentageOfSales}%\r\n`
  })

  out += `\r\nDAILY COFFEE SALES\r\n`
  out += `Date,Bills Count,Total Revenue (Rs.),Average Bill (Rs.)\r\n`
  data.dailySummaries.forEach((d) => {
    const avg = d.billCount > 0 ? Math.round(d.totalRevenue / d.billCount) : 0
    out += `${escapeCsv(d.date)},${d.billCount},${d.totalRevenue},${avg}\r\n`
  })

  return out
}
