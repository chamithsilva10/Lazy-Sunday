"use client"

import { useState, useEffect, useMemo } from "react"
import {
  TrendingUp,
  Calendar,
  FileSpreadsheet,
  Printer,
  DollarSign,
  Receipt,
  RotateCcw,
  CreditCard,
  Banknote,
  ArrowUpRight,
  ShoppingBag,
  UtensilsCrossed,
  Package,
  BarChart3,
  ArrowDownRight,
  QrCode,
  Coffee,
  Landmark,
  UserCheck,
  AlertTriangle,
  Plus,
  Trash2,
  FileText,
  Boxes,
  Download,
  Filter,
  CheckCircle2,
  Sparkles,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { SharedPosService, SharedExpense } from "@/lib/shared-pos-service"
import {
  generateSalesReportExcelXml,
  generateSalesReportCsv,
  downloadFile,
  ExportFilterMeta,
  SalesReportExportData,
} from "@/lib/excel-export"
import { determineItemStation, getOrderStationScope } from "@/lib/station-routing"

// ---------- Types ----------
export type ReportOrderRecord = {
  id: string
  order_number: string
  receipt_number: string
  table_name: string
  cashier_name: string
  department?: "Juice & Food" | "Coffee Bar"
  items: { id: string; name: string; price: number; quantity: number; category?: string; station?: string }[]
  subtotal: number
  service_charge: number
  service_charge_rate: number
  discount: number
  total: number
  payment_method: "cash" | "card" | "qr" | "bank_transfer" | "credit" | "split" | string
  split_payments?: { id?: string; method: string; amount: number; reference?: string; tendered?: number; change_due?: number }[]
  notes?: string
  cash_received?: number
  change_amount?: number
  status: "open" | "paid" | "completed" | "refunded" | "cancelled"
  kitchen_status?: "pending" | "preparing" | "ready" | "served"
  created_at: string
}

export type ReportProduct = {
  id: string
  name: string
  price: number
  category: string
  stock: number
}

// ---------- Derived Report Types ----------
interface ProductSaleSummary {
  productName: string
  category: string
  quantitySold: number
  totalRevenue: number
  percentageOfSales: number
}

interface CategorySaleSummary {
  category: string
  itemCount: number
  totalRevenue: number
  percentageOfSales: number
}

interface DailySummary {
  date: string
  billCount: number
  totalRevenue: number
  totalServiceCharge: number
}

interface ReportSummary {
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
  productSales: ProductSaleSummary[]
  categorySales: CategorySaleSummary[]
  dailySummaries: DailySummary[]
  filteredOrders: ReportOrderRecord[]
}

// ---------- Props ----------
interface ReportsViewProps {
  orders: ReportOrderRecord[]
  products: ReportProduct[]
  onPrintReceipt?: (order: ReportOrderRecord) => void
}

// ---------- Report Generation Logic ----------
function generateReport(
  allOrders: ReportOrderRecord[],
  filters: {
    startDate?: string
    endDate?: string
    productName?: string
    paymentMethod?: string
    category?: string
    department?: string
    station?: "all" | "bar" | "kitchen"
  }
): ReportSummary {
  // Filter orders
  const filteredOrders = allOrders.filter((o) => {
    // Only count paid/completed orders
    if (o.status === "refunded" || o.status === "cancelled") return false

    // Department filter
    if (filters.department && filters.department !== "all") {
      const orderDept = o.department || "Juice & Food"
      if (orderDept !== filters.department) return false
    }

    // Station filter
    if (filters.station && filters.station !== "all") {
      const hasMatchingItem = o.items.some((i) => {
        const itemStation = o.department === "Coffee Bar" ? "bar" : determineItemStation(i)
        return itemStation === filters.station
      })
      if (!hasMatchingItem) return false
    }

    // Date filter
    if (filters.startDate) {
      const orderTime = new Date(o.created_at).getTime()
      const startTime = new Date(filters.startDate).setHours(0, 0, 0, 0)
      if (orderTime < startTime) return false
    }
    if (filters.endDate) {
      const orderTime = new Date(o.created_at).getTime()
      const endTime = new Date(filters.endDate).setHours(23, 59, 59, 999)
      if (orderTime > endTime) return false
    }

    // Payment method filter
    if (filters.paymentMethod && filters.paymentMethod !== "all") {
      let splitList = Array.isArray(o.split_payments) && o.split_payments.length > 0 ? o.split_payments : null
      if (!splitList && typeof o.notes === "string" && o.notes.includes("split_payments")) {
        try {
          const parsed = JSON.parse(o.notes)
          if (Array.isArray(parsed.split_payments)) splitList = parsed.split_payments
        } catch {}
      }

      if (filters.paymentMethod === "split") {
        if (o.payment_method !== "split" && (!splitList || splitList.length === 0)) return false
      } else if (splitList && splitList.length > 0) {
        const matchesInSplit = splitList.some((p: any) => String(p.method || "").toLowerCase() === filters.paymentMethod?.toLowerCase())
        if (!matchesInSplit && o.payment_method !== filters.paymentMethod) return false
      } else if (o.payment_method !== filters.paymentMethod) {
        return false
      }
    }

    // Product filter
    if (filters.productName && filters.productName !== "all") {
      const hasProduct = o.items.some((i) => i.name === filters.productName)
      if (!hasProduct) return false
    }

    // Category filter
    if (filters.category && filters.category !== "all") {
      const hasCategory = o.items.some((i) => i.category === filters.category)
      if (!hasCategory) return false
    }

    return true
  })

  // Aggregations
  let totalSales = 0
  let totalItemsSold = 0
  let totalServiceCharge = 0
  let cashSales = 0
  let cardSales = 0
  let qrSales = 0
  let bankTransferSales = 0
  let creditSales = 0
  let kitchenRevenue = 0
  let kitchenItemCount = 0
  let barRevenue = 0
  let barItemCount = 0

  const productMap = new Map<string, { category: string; qty: number; revenue: number }>()
  const categoryMap = new Map<string, { itemCount: number; revenue: number }>()
  const dailyMap = new Map<string, { billCount: number; revenue: number; serviceCharge: number }>()

  for (const order of filteredOrders) {
    const isStationFiltered = filters.station && filters.station !== "all"
    const relevantItems = isStationFiltered
      ? order.items.filter((i) => {
          const itemStation = order.department === "Coffee Bar" ? "bar" : determineItemStation(i)
          return itemStation === filters.station
        })
      : order.items

    // Effective total for the order slice
    const orderItemsRev = relevantItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const orderSc = isStationFiltered
      ? Math.round(orderItemsRev * (order.service_charge_rate || 0.1))
      : (order.service_charge || 0)
    const effectiveTotal = isStationFiltered ? orderItemsRev + orderSc : order.total

    totalSales += effectiveTotal
    totalServiceCharge += orderSc

    let splitList = Array.isArray(order.split_payments) && order.split_payments.length > 0 ? order.split_payments : null
    if (!splitList && typeof order.notes === "string" && order.notes.includes("split_payments")) {
      try {
        const parsed = JSON.parse(order.notes)
        if (Array.isArray(parsed.split_payments)) splitList = parsed.split_payments
      } catch {}
    }

    if (splitList && splitList.length > 0) {
      const ratio = order.total > 0 ? (effectiveTotal / order.total) : 1
      for (const line of splitList) {
        const lineAmt = (Number(line.amount) || 0) * ratio
        const lineMethod = String(line.method || "").toLowerCase()
        if (lineMethod === "cash") cashSales += lineAmt
        else if (lineMethod === "card") cardSales += lineAmt
        else if (lineMethod === "bank_transfer") bankTransferSales += lineAmt
        else if (lineMethod === "credit") creditSales += lineAmt
        else qrSales += lineAmt
      }
    } else {
      if (order.payment_method === "cash") cashSales += effectiveTotal
      else if (order.payment_method === "card") cardSales += effectiveTotal
      else if (order.payment_method === "bank_transfer") bankTransferSales += effectiveTotal
      else if (order.payment_method === "credit") creditSales += effectiveTotal
      else qrSales += effectiveTotal
    }

    const dateKey = new Date(order.created_at).toISOString().split("T")[0]
    const currentDay = dailyMap.get(dateKey) || { billCount: 0, revenue: 0, serviceCharge: 0 }
    dailyMap.set(dateKey, {
      billCount: currentDay.billCount + 1,
      revenue: currentDay.revenue + effectiveTotal,
      serviceCharge: currentDay.serviceCharge + orderSc,
    })

    for (const item of relevantItems) {
      totalItemsSold += item.quantity
      const isBar = order.department === "Coffee Bar" || determineItemStation(item) === "bar"
      const itemRev = item.price * item.quantity
      if (isBar) {
        barRevenue += itemRev
        barItemCount += item.quantity
      } else {
        kitchenRevenue += itemRev
        kitchenItemCount += item.quantity
      }

      const prodName = item.name
      const existing = productMap.get(prodName) || {
        category: item.category || "General",
        qty: 0,
        revenue: 0,
      }
      productMap.set(prodName, {
        category: existing.category,
        qty: existing.qty + item.quantity,
        revenue: existing.revenue + itemRev,
      })

      const cat = item.category || "General"
      const existingCat = categoryMap.get(cat) || { itemCount: 0, revenue: 0 }
      categoryMap.set(cat, {
        itemCount: existingCat.itemCount + item.quantity,
        revenue: existingCat.revenue + itemRev,
      })
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

  const categorySales = Array.from(categoryMap.entries())
    .map(([cat, stat]) => ({
      category: cat,
      itemCount: stat.itemCount,
      totalRevenue: stat.revenue,
      percentageOfSales: totalSales > 0 ? Math.round((stat.revenue / totalSales) * 100) : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)

  const dailySummaries = Array.from(dailyMap.entries())
    .map(([date, stat]) => ({
      date,
      billCount: stat.billCount,
      totalRevenue: stat.revenue,
      totalServiceCharge: stat.serviceCharge,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return {
    totalSales,
    billCount: filteredOrders.length,
    totalItemsSold,
    averageBillValue: filteredOrders.length > 0 ? Math.round(totalSales / filteredOrders.length) : 0,
    totalServiceCharge,
    cashSales,
    cardSales,
    qrSales,
    bankTransferSales,
    creditSales,
    kitchenRevenue,
    kitchenItemCount,
    barRevenue,
    barItemCount,
    productSales,
    categorySales,
    dailySummaries,
    filteredOrders,
  }
}

// ---------- Component ----------
export function ReportsView({ orders, products, onPrintReceipt }: ReportsViewProps) {
  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<"all" | "Juice & Food" | "Coffee Bar">("all")
  const [selectedStation, setSelectedStation] = useState<"all" | "bar" | "kitchen">("all")
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week" | "month">("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedProduct, setSelectedProduct] = useState("all")
  const [selectedPayment, setSelectedPayment] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Advanced Excel Export Dialog State
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<"excel" | "csv">("excel")
  const [exportStation, setExportStation] = useState<"all" | "bar" | "kitchen">("all")

  // Handle Preset changes
  function applyDatePreset(preset: "all" | "today" | "week" | "month") {
    setDatePreset(preset)
    const now = new Date()
    const todayStr = now.toISOString().split("T")[0]

    if (preset === "all") {
      setStartDate("")
      setEndDate("")
    } else if (preset === "today") {
      setStartDate(todayStr)
      setEndDate(todayStr)
    } else if (preset === "week") {
      const pastWeek = new Date()
      pastWeek.setDate(now.getDate() - 7)
      setStartDate(pastWeek.toISOString().split("T")[0])
      setEndDate(todayStr)
    } else if (preset === "month") {
      const pastMonth = new Date()
      pastMonth.setDate(now.getDate() - 30)
      setStartDate(pastMonth.toISOString().split("T")[0])
      setEndDate(todayStr)
    }
  }

  // Generate report data (memoized)
  const report = useMemo(
    () =>
      generateReport(orders, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        productName: selectedProduct !== "all" ? selectedProduct : undefined,
        paymentMethod: selectedPayment !== "all" ? selectedPayment : undefined,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        department: selectedDepartment !== "all" ? selectedDepartment : undefined,
        station: selectedStation !== "all" ? selectedStation : undefined,
      }),
    [orders, startDate, endDate, selectedProduct, selectedPayment, selectedCategory, selectedDepartment, selectedStation]
  )

  // Unique product names and categories for filters
  const productNames = useMemo(() => {
    const names = new Set<string>()
    orders.forEach((o) => o.items.forEach((i) => names.add(i.name)))
    return Array.from(names).sort()
  }, [orders])

  const categoryNames = useMemo(() => {
    const cats = new Set<string>()
    orders.forEach((o) => o.items.forEach((i) => { if (i.category) cats.add(i.category) }))
    return Array.from(cats).sort()
  }, [orders])

  // Reset filters
  function handleResetFilters() {
    setSelectedDepartment("all")
    setSelectedStation("all")
    setDatePreset("all")
    setStartDate("")
    setEndDate("")
    setSelectedProduct("all")
    setSelectedPayment("all")
    setSelectedCategory("all")
  }

  // Reports subtab navigation
  const [reportTab, setReportTab] = useState<"sales" | "expenses" | "stock">("sales")

  // Expenses state
  const [expenses, setExpenses] = useState<SharedExpense[]>(() => SharedPosService.getExpenses())
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState("Raw Ingredients")
  const [expenseDesc, setExpenseDesc] = useState("")
  const [expenseAmount, setExpenseAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0])

  useEffect(() => {
    return SharedPosService.subscribeExpenses((data) => {
      setExpenses(data)
    })
  }, [])

  function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(expenseAmount)
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid expense amount")
      return
    }
    if (!expenseDesc.trim()) {
      toast.error("Please enter an expense description")
      return
    }
    SharedPosService.addExpense({
      category: expenseCategory as any,
      description: expenseDesc.trim(),
      amount: amt,
      payment_method: "cash",
      paid_to: "Operational Vendor",
      date: expenseDate || new Date().toISOString().split("T")[0],
      recorded_by: "Admin",
    })
    setExpenseDesc("")
    setExpenseAmount("")
    setShowAddExpenseModal(false)
    toast.success("Operating expense logged successfully")
  }

  function handleDeleteExpense(id: string) {
    if (confirm("Are you sure you want to remove this expense record?")) {
      SharedPosService.deleteExpense(id)
      toast.success("Expense removed")
    }
  }

  const totalExpenseAmount = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0)
  }, [expenses])

  const netOperatingProfit = report.totalSales - totalExpenseAmount
  const profitMarginPercent = report.totalSales > 0 ? Math.round((netOperatingProfit / report.totalSales) * 100) : 0

  // Inventory valuation
  const inventoryValuation = useMemo(() => {
    const totalVal = products.reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0)
    const lowStock = products.filter((p) => (p.stock || 0) <= 10)
    const outOfStock = products.filter((p) => (p.stock || 0) <= 0)
    return {
      totalItems: products.length,
      totalUnits: products.reduce((sum, p) => sum + (p.stock || 0), 0),
      totalValue: totalVal,
      lowStock,
      outOfStock,
    }
  }, [products])

  // Handler to export report in professional Excel (.xls) or Horizontal CSV (.csv) format
  function handleDownloadReport(format: "excel" | "csv", stationOverride?: "all" | "bar" | "kitchen") {
    const station = stationOverride || exportStation || selectedStation
    const exportRep = generateReport(orders, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      productName: selectedProduct !== "all" ? selectedProduct : undefined,
      paymentMethod: selectedPayment !== "all" ? selectedPayment : undefined,
      category: selectedCategory !== "all" ? selectedCategory : undefined,
      department: selectedDepartment !== "all" ? selectedDepartment : undefined,
      station: station !== "all" ? station : undefined,
    })

    if (!exportRep.billCount) {
      toast.error("No sales records to export for selected filters")
      return
    }

    const stationLabel =
      station === "bar"
        ? "Bar (Juices & Drinks)"
        : station === "kitchen"
        ? "Kitchen (Food & Meals)"
        : "All Stations"

    const deptLabel =
      selectedDepartment === "all"
        ? "All Departments"
        : selectedDepartment

    const dateRangeLabel =
      startDate && endDate
        ? `${startDate} to ${endDate}`
        : startDate
        ? `From ${startDate}`
        : endDate
        ? `Until ${endDate}`
        : "All Time (Complete History)"

    const filterMeta: ExportFilterMeta = {
      dateRange: dateRangeLabel,
      stationScope: stationLabel,
      departmentScope: deptLabel,
      paymentMethod: selectedPayment === "all" ? "All Payment Methods" : selectedPayment.toUpperCase(),
      category: selectedCategory !== "all" ? selectedCategory : undefined,
      product: selectedProduct !== "all" ? selectedProduct : undefined,
      generatedAt: new Date().toLocaleString(),
      generatedBy: "POS System",
    }

    const exportPayload: SalesReportExportData = {
      filters: filterMeta,
      totalSales: exportRep.totalSales,
      billCount: exportRep.billCount,
      totalItemsSold: exportRep.totalItemsSold,
      averageBillValue: exportRep.averageBillValue,
      totalServiceCharge: exportRep.totalServiceCharge,
      cashSales: exportRep.cashSales,
      cardSales: exportRep.cardSales,
      qrSales: exportRep.qrSales,
      bankTransferSales: exportRep.bankTransferSales,
      creditSales: exportRep.creditSales,
      kitchenRevenue: exportRep.kitchenRevenue,
      kitchenItemCount: exportRep.kitchenItemCount,
      barRevenue: exportRep.barRevenue,
      barItemCount: exportRep.barItemCount,
      orders: exportRep.filteredOrders,
      productSales: exportRep.productSales,
      categorySales: exportRep.categorySales,
      dailySummaries: exportRep.dailySummaries,
    }

    const dateSlug = new Date().toISOString().substring(0, 10)
    const stationSlug = station !== "all" ? `_${station}` : ""

    if (format === "excel") {
      const xlsxBuffer = generateSalesReportExcelXml(exportPayload)
      downloadFile(xlsxBuffer, `Sales_Report_${dateSlug}${stationSlug}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      toast.success("Excel Workbook (.xlsx) exported with auto-filters & horizontal ledger!")
    } else {
      const csv = generateSalesReportCsv(exportPayload)
      downloadFile(csv, `Sales_Report_${dateSlug}${stationSlug}.csv`, "text/csv;charset=utf-8")
      toast.success("Horizontal CSV ledger exported successfully!")
    }

    setShowExportModal(false)
  }

  // Open Export Modal
  function exportToExcel() {
    setExportStation(selectedStation)
    setShowExportModal(true)
  }

  // Print / PDF
  function printReport() {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E5D8CF] shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#808068] text-white shadow-sm">
            <TrendingUp className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl font-bold text-gray-900">Service Sales Report</h2>
              <Badge className="bg-[#FAF5F1] text-[#808068] border border-[#EAB8B5] text-[10px] font-semibold">
                Full POS Analytics
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Complete restaurant analytics — product breakdown, category insights, daily revenue, and settlement reports.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={exportToExcel}
            variant="outline"
            className="rounded-xl border-[#E5D8CF] text-xs h-10 gap-1.5 hover:bg-[#FAF5F1] text-[#808068] flex-1 sm:flex-initial"
          >
            <FileSpreadsheet className="size-4 text-[#D67B6B]" />
            Export to Excel
          </Button>

          <Button
            onClick={printReport}
            className="bg-[#D67B6B] text-white hover:bg-[#c26555] rounded-xl text-xs h-10 px-4 gap-1.5 shadow-sm flex-1 sm:flex-initial"
          >
            <Printer className="size-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Report Section Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5D8CF] pb-2 print:hidden overflow-x-auto">
        <button
          onClick={() => setReportTab("sales")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            reportTab === "sales"
              ? "bg-[#D67B6B] text-white shadow-xs"
              : "bg-white text-gray-700 border border-[#E5D8CF] hover:bg-[#FAF5F1]"
          }`}
        >
          <BarChart3 className="size-4" />
          Sales & Analytics
        </button>
        <button
          onClick={() => setReportTab("expenses")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            reportTab === "expenses"
              ? "bg-[#D67B6B] text-white shadow-xs"
              : "bg-white text-gray-700 border border-[#E5D8CF] hover:bg-[#FAF5F1]"
          }`}
        >
          <DollarSign className="size-4" />
          Expenses & Profit/Loss (P&L)
        </button>
        <button
          onClick={() => setReportTab("stock")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            reportTab === "stock"
              ? "bg-[#D67B6B] text-white shadow-xs"
              : "bg-white text-gray-700 border border-[#E5D8CF] hover:bg-[#FAF5F1]"
          }`}
        >
          <Boxes className="size-4" />
          Inventory & Stock Health
        </button>
      </div>

      {reportTab === "sales" && (
        <>
          {/* Filter Toolbar */}
          <Card className="rounded-2xl border-[#E5D8CF] bg-white p-4 shadow-sm print:hidden">
        <div className="space-y-3">
          {/* Department Selection */}
          <div className="flex items-center gap-2 pb-2.5 border-b border-[#E5D8CF] flex-wrap">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider mr-1">Department:</span>
            <Button
              size="sm"
              variant={selectedDepartment === "all" ? "default" : "outline"}
              onClick={() => setSelectedDepartment("all")}
              className={`rounded-xl text-xs h-7 px-3 font-semibold ${
                selectedDepartment === "all" ? "bg-[#D67B6B] text-white shadow-xs" : "border-[#E5D8CF] text-gray-700 bg-white hover:bg-[#FAF5F1]"
              }`}
            >
              All Departments
            </Button>
            <Button
              size="sm"
              variant={selectedDepartment === "Juice & Food" ? "default" : "outline"}
              onClick={() => setSelectedDepartment("Juice & Food")}
              className={`rounded-xl text-xs h-7 px-3 font-semibold ${
                selectedDepartment === "Juice & Food" ? "bg-[#D67B6B] text-white shadow-xs" : "border-[#E5D8CF] text-gray-700 bg-white hover:bg-[#FAF5F1]"
              }`}
            >
              🍹 Juice & Food POS
            </Button>
            <Button
              size="sm"
              variant={selectedDepartment === "Coffee Bar" ? "default" : "outline"}
              onClick={() => setSelectedDepartment("Coffee Bar")}
              className={`rounded-xl text-xs h-7 px-3 font-semibold ${
                selectedDepartment === "Coffee Bar" ? "bg-[#D67B6B] text-white shadow-xs" : "border-[#E5D8CF] text-gray-700 bg-white hover:bg-[#FAF5F1]"
              }`}
            >
              ☕ Coffee Bar
            </Button>
          </div>

          {/* Station Selection (Juice & Drinking items to Bar, Food & Meals to Kitchen) */}
          <div className="flex items-center gap-2 pb-2.5 border-b border-[#E5D8CF] flex-wrap">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider mr-1">Station:</span>
            <Button
              size="sm"
              variant={selectedStation === "all" ? "default" : "outline"}
              onClick={() => setSelectedStation("all")}
              className={`rounded-xl text-xs h-7 px-3 font-semibold ${
                selectedStation === "all" ? "bg-[#D67B6B] text-white shadow-xs" : "border-[#E5D8CF] text-gray-700 bg-white hover:bg-[#FAF5F1]"
              }`}
            >
              All Stations
            </Button>
            <Button
              size="sm"
              variant={selectedStation === "bar" ? "default" : "outline"}
              onClick={() => setSelectedStation("bar")}
              className={`rounded-xl text-xs h-7 px-3 font-semibold ${
                selectedStation === "bar" ? "bg-[#808068] text-white" : "border-[#E5D8CF] text-[#808068] bg-[#FAF5F1] hover:bg-[#eeeee7]"
              }`}
            >
              🍹 Bar (Juices & Drinks)
            </Button>
            <Button
              size="sm"
              variant={selectedStation === "kitchen" ? "default" : "outline"}
              onClick={() => setSelectedStation("kitchen")}
              className={`rounded-xl text-xs h-7 px-3 font-semibold ${
                selectedStation === "kitchen" ? "bg-[#808068] text-white" : "border-[#E5D8CF] text-[#808068] bg-[#FAF5F1] hover:bg-[#eeeee7]"
              }`}
            >
              🍳 Kitchen (Food & Meals)
            </Button>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-gray-600 mr-1 flex items-center gap-1">
                <Calendar className="size-3.5 text-[#D67B6B]" /> Date Preset:
              </span>
              <Button
                size="sm"
                variant={datePreset === "all" ? "default" : "outline"}
                onClick={() => applyDatePreset("all")}
                className={`rounded-xl text-xs h-8 px-3 ${
                  datePreset === "all" ? "bg-[#D67B6B] text-white shadow-xs" : "border-[#E5D8CF] text-gray-700 hover:bg-[#FAF5F1]"
                }`}
              >
                All Time
              </Button>
              <Button
                size="sm"
                variant={datePreset === "today" ? "default" : "outline"}
                onClick={() => applyDatePreset("today")}
                className={`rounded-xl text-xs h-8 px-3 ${
                  datePreset === "today" ? "bg-[#D67B6B] text-white shadow-xs" : "border-[#E5D8CF] text-gray-700 hover:bg-[#FAF5F1]"
                }`}
              >
                Today
              </Button>
              <Button
                size="sm"
                variant={datePreset === "week" ? "default" : "outline"}
                onClick={() => applyDatePreset("week")}
                className={`rounded-xl text-xs h-8 px-3 ${
                  datePreset === "week" ? "bg-[#D67B6B] text-white shadow-xs" : "border-[#E5D8CF] text-gray-700 hover:bg-[#FAF5F1]"
                }`}
              >
                Last 7 Days
              </Button>
              <Button
                size="sm"
                variant={datePreset === "month" ? "default" : "outline"}
                onClick={() => applyDatePreset("month")}
                className={`rounded-xl text-xs h-8 px-3 ${
                  datePreset === "month" ? "bg-[#D67B6B] text-white shadow-xs" : "border-[#E5D8CF] text-gray-700 hover:bg-[#FAF5F1]"
                }`}
              >
                Last 30 Days
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-gray-500 hover:text-gray-800 h-8 gap-1"
            >
              <RotateCcw className="size-3" />
              Reset Filters
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="text-[11px] font-semibold text-gray-600">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setDatePreset("all")
                }}
                className="mt-1 h-9 text-xs rounded-xl border-[#d7ded0]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setDatePreset("all")
                }}
                className="mt-1 h-9 text-xs rounded-xl border-[#d7ded0]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600">Product</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-[#E5D8CF] px-3 text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D67B6B]"
              >
                <option value="all">All Products</option>
                {productNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-[#E5D8CF] px-3 text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D67B6B]"
              >
                <option value="all">All Categories</option>
                {categoryNames.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600">Payment Method</label>
              <select
                value={selectedPayment}
                onChange={(e) => setSelectedPayment(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-[#E5D8CF] px-3 text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D67B6B]"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash Only</option>
                <option value="card">Card Terminal Only</option>
                <option value="qr">QR / Online Pay</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit">Customer Credit (Open Tab)</option>
                <option value="split">⚡ Split / Mixed Tender</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-[#E5D8CF] p-4 bg-white shadow-sm">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Revenue</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-[#D67B6B] mt-1.5">
            Rs. {report.totalSales.toLocaleString()}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-700 mt-1">
            <ArrowUpRight className="size-3.5" />
            <span>Including service charges</span>
          </div>
        </Card>

        <Card className="rounded-2xl border-[#dfe5d8] p-4 bg-white shadow-sm">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Orders</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-gray-900 mt-1.5">
            {report.billCount} <span className="text-xs font-normal text-gray-500">orders</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">CFJ- prefix invoices</p>
        </Card>

        <Card className="rounded-2xl border-[#dfe5d8] p-4 bg-white shadow-sm">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Items Sold</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-amber-800 mt-1.5">
            {report.totalItemsSold} <span className="text-xs font-normal text-gray-500">items</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Line item volume</p>
        </Card>

        <Card className="rounded-2xl border-[#dfe5d8] p-4 bg-white shadow-sm">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Average Order Value</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-blue-900 mt-1.5">
            Rs. {report.averageBillValue.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Spend per customer</p>
        </Card>

        <Card className="rounded-2xl border-[#dfe5d8] p-4 bg-white shadow-sm col-span-2 lg:col-span-1">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Service Charges</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-violet-900 mt-1.5">
            Rs. {report.totalServiceCharge.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">10% auto-applied</p>
        </Card>
      </div>

      {/* Payment Settlements Breakdown (All 5 Payment Methods) */}
      <Card className="rounded-2xl border-[#dfe5d8] p-4 bg-white shadow-sm">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Settlement Breakdown</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
            <div className="flex items-center gap-2">
              <Banknote className="size-4 text-emerald-700 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-emerald-950">Cash</span>
                <p className="text-[10px] text-emerald-700 mt-0.5">
                  {report.billCount > 0
                    ? Math.round((report.cashSales / Math.max(1, report.totalSales)) * 100)
                    : 0}
                  %
                </p>
              </div>
            </div>
            <span className="font-mono font-bold text-xs sm:text-sm text-emerald-900">
              Rs. {report.cashSales.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-100">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-blue-700 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-blue-950">Card Terminal</span>
                <p className="text-[10px] text-blue-700 mt-0.5">
                  {report.billCount > 0
                    ? Math.round((report.cardSales / Math.max(1, report.totalSales)) * 100)
                    : 0}
                  %
                </p>
              </div>
            </div>
            <span className="font-mono font-bold text-xs sm:text-sm text-blue-900">
              Rs. {report.cardSales.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/50 border border-purple-100">
            <div className="flex items-center gap-2">
              <QrCode className="size-4 text-purple-700 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-purple-950">QR / Online</span>
                <p className="text-[10px] text-purple-700 mt-0.5">
                  {report.billCount > 0
                    ? Math.round((report.qrSales / Math.max(1, report.totalSales)) * 100)
                    : 0}
                  %
                </p>
              </div>
            </div>
            <span className="font-mono font-bold text-xs sm:text-sm text-purple-900">
              Rs. {report.qrSales.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-100">
            <div className="flex items-center gap-2">
              <Landmark className="size-4 text-amber-700 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-amber-950">Bank Transfer</span>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  {report.billCount > 0
                    ? Math.round((report.bankTransferSales / Math.max(1, report.totalSales)) * 100)
                    : 0}
                  %
                </p>
              </div>
            </div>
            <span className="font-mono font-bold text-xs sm:text-sm text-amber-900">
              Rs. {report.bankTransferSales.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 border border-rose-100">
            <div className="flex items-center gap-2">
              <UserCheck className="size-4 text-rose-700 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-rose-950">Customer Credit</span>
                <p className="text-[10px] text-rose-700 mt-0.5">
                  {report.billCount > 0
                    ? Math.round((report.creditSales / Math.max(1, report.totalSales)) * 100)
                    : 0}
                  %
                </p>
              </div>
            </div>
            <span className="font-mono font-bold text-xs sm:text-sm text-rose-900">
              Rs. {report.creditSales.toLocaleString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Station Sales Breakdown (Kitchen vs Bar) */}
      <Card className="rounded-2xl border-[#dfe5d8] p-4 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Station Sales Breakdown</h4>
          <span className="text-[11px] text-gray-500">Live KDS & BOT fulfillment analytics</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-orange-50/50 border border-orange-100">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-orange-100 text-orange-800">
                <UtensilsCrossed className="size-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-orange-950">Kitchen Orders (KDS)</span>
                <p className="text-[10px] text-orange-700 mt-0.5">
                  {report.kitchenItemCount} items sold · {report.totalSales > 0 ? Math.round((report.kitchenRevenue / report.totalSales) * 100) : 0}% of sales
                </p>
              </div>
            </div>
            <span className="font-mono font-bold text-xs sm:text-base text-orange-950">
              Rs. {report.kitchenRevenue.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/50 border border-amber-100">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Coffee className="size-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-950">Bar / Beverage Orders (BOT)</span>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  {report.barItemCount} items sold · {report.totalSales > 0 ? Math.round((report.barRevenue / report.totalSales) * 100) : 0}% of sales
                </p>
              </div>
            </div>
            <span className="font-mono font-bold text-xs sm:text-base text-amber-950">
              Rs. {report.barRevenue.toLocaleString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Category-Wise Sales Summary */}
      <Card className="rounded-2xl border-[#dfe5d8] bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-[#f7f8f4] border-b border-[#dfe5d8] py-3.5 px-5">
          <CardTitle className="font-serif text-base font-bold text-gray-900">
            Category-Wise Sales Breakdown
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Revenue and volume breakdown by menu category.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4">
          {report.categorySales.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {report.categorySales.map((cat, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#E5D8CF] bg-white hover:bg-[#FAF5F1] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#FAF5F1] text-[#808068] shrink-0 border border-[#E5D8CF]">
                      <UtensilsCrossed className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{cat.category}</p>
                      <p className="text-[10px] text-gray-500">
                        {cat.itemCount} items · {cat.percentageOfSales}%
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs text-[#D67B6B] shrink-0 ml-2">
                    Rs. {cat.totalRevenue.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-gray-400 text-sm">No category data for this period.</p>
          )}
        </CardContent>
      </Card>

      {/* Product-Wise Sales Table */}
      <Card className="rounded-2xl border-[#E5D8CF] bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-[#FAF5F1] border-b border-[#E5D8CF] py-3.5 px-5">
          <CardTitle className="font-serif text-base font-bold text-gray-900">
            Product-Wise Sales
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Volume and revenue generated by each menu item.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#FAF5F1] border-b border-[#E5D8CF] text-gray-600 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Qty Sold</th>
                  <th className="py-3 px-4">Share of Sales</th>
                  <th className="py-3 px-4 text-right">Revenue (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5D8CF]">
                {report.productSales.length > 0 ? (
                  report.productSales.map((p, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF5F1]">
                      <td className="py-3 px-4 text-gray-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900">{p.productName}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] font-semibold border-[#E5D8CF] text-gray-600">
                          {p.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">{p.quantitySold}</td>
                      <td className="py-3 px-4 min-w-36">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-[#808068] h-full rounded-full"
                              style={{ width: `${Math.min(100, p.percentageOfSales)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-gray-600">{p.percentageOfSales}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#D67B6B]">
                        Rs. {p.totalRevenue.toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      No products sold during this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Daily Summary Table */}
      <Card className="rounded-2xl border-[#E5D8CF] bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-[#FAF5F1] border-b border-[#E5D8CF] py-3.5 px-5">
          <CardTitle className="font-serif text-base font-bold text-gray-900">
            Daily / Chronological Summary
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Day-by-day transaction and revenue breakdown.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#FAF5F1] border-b border-[#E5D8CF] text-gray-600 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-right">Daily Revenue (Rs.)</th>
                  <th className="py-3 px-4 text-right">Service Charges (Rs.)</th>
                  <th className="py-3 px-4 text-right">Avg. Ticket (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5D8CF]">
                {report.dailySummaries.length > 0 ? (
                  report.dailySummaries.map((d, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF5F1]">
                      <td className="py-3 px-4 font-semibold text-gray-800">{d.date}</td>
                      <td className="py-3 px-4 text-center font-mono">{d.billCount}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#D67B6B]">
                        Rs. {d.totalRevenue.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-violet-700">
                        Rs. {d.totalServiceCharge.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-600">
                        Rs. {Math.round(d.totalRevenue / Math.max(1, d.billCount)).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400">
                      No daily records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Transaction Ledger Table */}
      <Card className="rounded-2xl border-[#dfe5d8] bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-[#f7f8f4] border-b border-[#dfe5d8] py-3.5 px-5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-serif text-base font-bold text-gray-900">
              Orders & Transaction Ledger
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Detailed breakdown of all {report.filteredOrders.length} transaction(s) in this period.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {report.filteredOrders.length} Records
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#fcfdfa] border-b border-[#dfe5d8] text-gray-600 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Order / Receipt</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Total (Rs.)</th>
                  <th className="py-3 px-4 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ea]">
                {report.filteredOrders.length > 0 ? (
                  report.filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-[#fafbf8]">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        {o.order_number}
                        {o.receipt_number && o.receipt_number !== o.order_number && (
                          <span className="block text-[10px] font-normal text-gray-500">
                            {o.receipt_number}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            o.department === "Coffee Bar"
                              ? "bg-amber-100 text-amber-900 border-amber-200"
                              : "bg-emerald-100 text-emerald-900 border-emerald-200"
                          }`}
                        >
                          {o.department || "Juice & Food"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-700">{o.table_name || "Takeaway"}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {new Date(o.created_at).toLocaleDateString()}{" "}
                        <span className="font-mono text-[11px]">
                          {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 max-w-[200px] truncate">
                        {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                      </td>
                      <td className="py-3 px-4">
                        {o.payment_method === "split" || (o.split_payments && o.split_payments.length > 0) ? (
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant="outline"
                              className="bg-indigo-50 text-indigo-800 border-indigo-200 capitalize text-[10px] font-bold w-fit"
                            >
                              ⚡ Split Tender
                            </Badge>
                            <div className="text-[10px] text-gray-600 font-mono leading-tight">
                              {(o.split_payments || []).map((sp, sIdx) => (
                                <span key={sIdx} className="inline-block mr-1.5 whitespace-nowrap">
                                  {sp.method.toUpperCase()}: Rs. {Number(sp.amount).toLocaleString()}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`capitalize text-[10px] font-semibold ${
                              o.payment_method === "cash"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : o.payment_method === "card"
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : o.payment_method === "bank_transfer"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : o.payment_method === "credit"
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : "bg-purple-50 text-purple-800 border-purple-200"
                            }`}
                          >
                            {o.payment_method === "qr"
                              ? "QR / Online"
                              : o.payment_method === "bank_transfer"
                              ? "Bank Transfer"
                              : o.payment_method === "credit"
                              ? "Customer Credit"
                              : o.payment_method}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#D67B6B]">
                        Rs. {o.total.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center print:hidden">
                        {onPrintReceipt && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onPrintReceipt(o)}
                            className="h-7 text-xs text-[#808068] hover:bg-[#FAF5F1] px-2 rounded-lg"
                          >
                            <Receipt className="size-3.5 mr-1" />
                            Receipt
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-gray-400">
                      No matching transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </>
      )}

      {/* ---------- TAB 2: EXPENSES & PROFIT/LOSS (P&L) ---------- */}
      {reportTab === "expenses" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl font-bold text-gray-900">Profit & Loss (P&L) & Operating Expenses</h3>
              <p className="text-xs text-gray-500">Track restaurant operational overheads and real-time net profitability.</p>
            </div>
            <Button
              onClick={() => setShowAddExpenseModal(true)}
              className="bg-[#D67B6B] text-white hover:bg-[#c26555] rounded-xl text-xs h-9 px-3 gap-1.5 shadow-sm"
            >
              <Plus className="size-3.5" />
              Log Expense
            </Button>
          </div>

          {/* P&L Financial Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-[#E5D8CF] p-4 bg-white shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Gross Sales Revenue</span>
              <p className="font-mono text-2xl font-bold text-[#D67B6B] mt-1.5">
                Rs. {report.totalSales.toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">From {report.billCount} completed orders</p>
            </Card>

            <Card className="rounded-2xl border-[#dfe5d8] p-4 bg-white shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Operating Expenses</span>
              <p className="font-mono text-2xl font-bold text-rose-700 mt-1.5">
                Rs. {totalExpenseAmount.toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">{expenses.length} logged expense entries</p>
            </Card>

            <Card className="rounded-2xl border-[#dfe5d8] p-4 bg-white shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Net Operating Profit</span>
              <p className={`font-mono text-2xl font-bold mt-1.5 ${netOperatingProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                Rs. {netOperatingProfit.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-1">
                <span>Revenue minus all expenses</span>
              </div>
            </Card>

            <Card className="rounded-2xl border-[#dfe5d8] p-4 bg-white shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Net Margin %</span>
              <p className={`font-mono text-2xl font-bold mt-1.5 ${profitMarginPercent >= 20 ? "text-emerald-700" : profitMarginPercent >= 0 ? "text-amber-700" : "text-rose-700"}`}>
                {profitMarginPercent}%
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Profitability ratio</p>
            </Card>
          </div>

          {/* Expenses by Category */}
          <Card className="rounded-2xl border-[#dfe5d8] bg-white shadow-sm p-4">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Expenses by Category</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {["Raw Ingredients", "Utilities", "Salaries", "Rent", "Maintenance", "Packaging", "Marketing", "Other"].map((cat) => {
                const catTotal = expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0)
                return (
                  <div key={cat} className="p-3 rounded-xl border border-[#edf1ea] bg-[#fafbf8]">
                    <span className="text-xs font-semibold text-gray-700 block truncate">{cat}</span>
                    <span className="font-mono text-sm font-bold text-gray-900 mt-1 block">
                      Rs. {catTotal.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Expenses Ledger Table */}
          <Card className="rounded-2xl border-[#dfe5d8] bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-[#f7f8f4] border-b border-[#dfe5d8] py-3.5 px-5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif text-base font-bold text-gray-900">Operating Expenses Ledger</CardTitle>
                <CardDescription className="text-xs text-gray-500">Itemized log of overhead expenditures.</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">{expenses.length} Records</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#fcfdfa] border-b border-[#dfe5d8] text-gray-600 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Recorded By</th>
                      <th className="py-3 px-4 text-right">Amount (Rs.)</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1ea]">
                    {expenses.length > 0 ? (
                      expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-[#fafbf8]">
                          <td className="py-3 px-4 font-mono text-xs text-gray-600">{exp.date}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px] font-semibold text-gray-700">
                              {exp.category}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">{exp.description}</td>
                          <td className="py-3 px-4 text-xs text-gray-500">{exp.recorded_by}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                            Rs. {exp.amount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">
                          No operating expenses logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---------- TAB 3: INVENTORY & STOCK HEALTH ---------- */}
      {reportTab === "stock" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl font-bold text-gray-900">Inventory Valuation & Stock Health</h3>
              <p className="text-xs text-gray-500">Real-time asset valuation, stock levels, and replenishment status.</p>
            </div>
            <Button
              onClick={() => window.print()}
              variant="outline"
              className="rounded-xl border-[#dfe5d8] text-xs h-9 px-3 gap-1.5 text-emerald-800 hover:bg-[#f0f4ed]"
            >
              <Printer className="size-3.5" />
              Print Stock Sheet
            </Button>
          </div>

          {/* Stock KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-[#dfe5d8] p-4 bg-white shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Products</span>
              <p className="font-mono text-2xl font-bold text-gray-900 mt-1.5">{inventoryValuation.totalItems}</p>
              <p className="text-[11px] text-gray-400 mt-1">Catalog items tracked</p>
            </Card>

            <Card className="rounded-2xl border-[#dfe5d8] p-4 bg-white shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Units on Hand</span>
              <p className="font-mono text-2xl font-bold text-blue-900 mt-1.5">{inventoryValuation.totalUnits}</p>
              <p className="text-[11px] text-gray-400 mt-1">Total physical stock</p>
            </Card>

            <Card className="rounded-2xl border-[#E5D8CF] p-4 bg-white shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Asset Valuation</span>
              <p className="font-mono text-2xl font-bold text-[#D67B6B] mt-1.5">
                Rs. {inventoryValuation.totalValue.toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Selling retail value</p>
            </Card>

            <Card className="rounded-2xl border-[#E5D8CF] p-4 bg-white shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Low Stock Warnings</span>
              <p className={`font-mono text-2xl font-bold mt-1.5 ${inventoryValuation.lowStock.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {inventoryValuation.lowStock.length}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Items below 10 units</p>
            </Card>
          </div>

          {/* Low Stock Warning Banner */}
          {inventoryValuation.lowStock.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-amber-950">Immediate Restock Attention Required</h5>
                <p className="text-xs text-amber-800 mt-0.5">
                  {inventoryValuation.lowStock.length} items are running below reorder thresholds:{" "}
                  {inventoryValuation.lowStock.slice(0, 4).map((i) => `${i.name} (${i.stock} left)`).join(", ")}
                  {inventoryValuation.lowStock.length > 4 && "..."}
                </p>
              </div>
            </div>
          )}

          {/* Product Stock Table */}
          <Card className="rounded-2xl border-[#E5D8CF] bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-[#FAF5F1] border-b border-[#E5D8CF] py-3.5 px-5">
              <CardTitle className="font-serif text-base font-bold text-gray-900">Catalog Stock & Valuation Sheet</CardTitle>
              <CardDescription className="text-xs text-gray-500">Live inventory balances and item valuation breakdown.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#FAF5F1] border-b border-[#E5D8CF] text-gray-600 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-center">In Stock</th>
                      <th className="py-3 px-4 text-right">Unit Price (Rs.)</th>
                      <th className="py-3 px-4 text-right">Total Value (Rs.)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5D8CF]">
                    {products.map((p) => {
                      const itemVal = p.price * (p.stock || 0)
                      const isLow = (p.stock || 0) > 0 && (p.stock || 0) <= 10
                      const isOut = (p.stock || 0) <= 0
                      return (
                        <tr key={p.id} className="hover:bg-[#FAF5F1]">
                          <td className="py-3 px-4 font-semibold text-gray-900">{p.name}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px] font-semibold text-gray-600">
                              {p.category}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            <span className={isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-[#808068]"}>
                              {p.stock ?? 0}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-gray-700">
                            Rs. {p.price.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[#D67B6B]">
                            Rs. {itemVal.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isOut ? (
                              <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">Out of Stock</Badge>
                            ) : isLow ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">Low Stock</Badge>
                            ) : (
                              <Badge className="bg-[#FAF5F1] text-[#808068] border border-[#EAB8B5] text-[10px]">Healthy</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#E5D8CF] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5D8CF] pb-3">
              <h3 className="font-serif text-lg font-bold text-gray-900">Log Operating Expense</h3>
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Expense Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full h-9 rounded-xl border border-[#E5D8CF] px-3 text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D67B6B]"
                >
                  <option value="Raw Ingredients">Raw Ingredients</option>
                  <option value="Utilities">Utilities (Electricity, Water, Gas)</option>
                  <option value="Salaries">Staff Salaries & Wages</option>
                  <option value="Rent">Shop Rent / Lease</option>
                  <option value="Maintenance">Maintenance & Repairs</option>
                  <option value="Packaging">Takeaway Packaging & Supplies</option>
                  <option value="Marketing">Marketing & Promotions</option>
                  <option value="Other">Other Expenses</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description / Notes</label>
                <Input
                  placeholder="e.g. Electricity bill for November"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="rounded-xl border-[#E5D8CF] text-xs h-9"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Amount (Rs.)</label>
                <Input
                  type="number"
                  placeholder="e.g. 15000"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="rounded-xl border-[#E5D8CF] text-xs h-9 font-mono"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="rounded-xl border-[#E5D8CF] text-xs h-9"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5D8CF]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="rounded-xl text-xs h-9 border-[#E5D8CF]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#D67B6B] text-white hover:bg-[#c26555] rounded-xl text-xs h-9 px-4 font-semibold"
                >
                  Save Expense
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary Footer */}
      <div className="print:hidden text-center py-2">
        <p className="text-[11px] text-gray-400">
          Report generated from {report.billCount} order(s) · POS Management System
        </p>
      </div>

      {/* Advanced Professional Excel Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-[#E5D8CF]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#808068] text-white shadow-sm">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-serif text-lg font-bold text-gray-900">
                  Export Sales Spreadsheet
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  Professional horizontal layout with native column auto-filters, brand sage headers (#808068), and multi-sheet audit ledgers.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Format Selector */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                1. Spreadsheet Format
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setExportFormat("excel")}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    exportFormat === "excel"
                      ? "border-[#D67B6B] bg-[#FAF5F1] ring-2 ring-[#D67B6B]/20"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-[#808068] flex items-center gap-1.5">
                      <FileSpreadsheet className="size-4 text-[#D67B6B]" />
                      Excel Workbook (.xlsx)
                    </span>
                    {exportFormat === "excel" && <CheckCircle2 className="size-3.5 text-[#D67B6B]" />}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Native Microsoft Excel (.xlsx) OpenXML workbook — zero warnings, native auto-filter dropdowns, and 5 detailed sheets.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setExportFormat("csv")}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    exportFormat === "csv"
                      ? "border-[#D67B6B] bg-[#FAF5F1] ring-2 ring-[#D67B6B]/20"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-gray-900 flex items-center gap-1.5">
                      <FileText className="size-4 text-gray-700" />
                      Horizontal CSV (.csv)
                    </span>
                    {exportFormat === "csv" && <CheckCircle2 className="size-3.5 text-[#D67B6B]" />}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    RFC-4180 horizontal table with UTF-8 BOM. Universal support in Excel, Google Sheets, &amp; Numbers.
                  </p>
                </button>
              </div>
            </div>

            {/* Station Scope Selection */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                2. Station Scope (Filter)
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={exportStation === "all" ? "default" : "outline"}
                  onClick={() => setExportStation("all")}
                  className={`rounded-xl text-xs h-8 ${
                    exportStation === "all" ? "bg-[#D67B6B] text-white shadow-xs" : "border-gray-200 text-gray-700 hover:bg-[#FAF5F1]"
                  }`}
                >
                  All Stations
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={exportStation === "bar" ? "default" : "outline"}
                  onClick={() => setExportStation("bar")}
                  className={`rounded-xl text-xs h-8 ${
                    exportStation === "bar" ? "bg-[#808068] text-white" : "border-gray-200 text-[#808068] hover:bg-[#FAF5F1]"
                  }`}
                >
                  🍹 Bar Only
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={exportStation === "kitchen" ? "default" : "outline"}
                  onClick={() => setExportStation("kitchen")}
                  className={`rounded-xl text-xs h-8 ${
                    exportStation === "kitchen" ? "bg-[#808068] text-white" : "border-gray-200 text-[#808068] hover:bg-[#FAF5F1]"
                  }`}
                >
                  🍳 Kitchen Only
                </Button>
              </div>
            </div>

            {/* Export Scope Summary Preview */}
            <div className="p-3.5 rounded-xl bg-[#FAF5F1] border border-[#E5D8CF] space-y-1.5">
              <div className="flex justify-between text-gray-600">
                <span>Date Range:</span>
                <span className="font-semibold text-gray-900">
                  {startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Until ${endDate}` : "All Time"}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Department:</span>
                <span className="font-semibold text-gray-900">{selectedDepartment === "all" ? "All Departments" : selectedDepartment}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Payment Method:</span>
                <span className="font-semibold text-gray-900">{selectedPayment === "all" ? "All Payment Methods" : selectedPayment}</span>
              </div>
              <div className="flex justify-between text-gray-600 pt-1.5 border-t border-[#E5D8CF] font-bold">
                <span>Orders Matching Filter:</span>
                <span className="text-[#D67B6B] font-mono">{report.billCount} records · Rs. {report.totalSales.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowExportModal(false)}
              className="rounded-xl text-xs h-9 border-[#E5D8CF]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleDownloadReport(exportFormat, exportStation)}
              className="bg-[#D67B6B] text-white hover:bg-[#c26555] rounded-xl text-xs h-9 gap-1.5 px-4 shadow-sm font-semibold"
            >
              <Download className="size-4" />
              Download {exportFormat === "excel" ? "Excel (.xlsx)" : "CSV (.csv)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
