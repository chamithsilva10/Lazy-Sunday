"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Coffee,
  TrendingUp,
  Calendar,
  FileSpreadsheet,
  FileText,
  Printer,
  Filter,
  DollarSign,
  Receipt,
  RotateCcw,
  CreditCard,
  Banknote,
  ArrowUpRight,
  Download,
  CheckCircle2,
} from "lucide-react"
import { CoffeeReportSummary, CoffeeReportFilters, CoffeeProduct } from "@/lib/coffee/types"
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
import {
  generateCoffeeReportExcelXml,
  generateCoffeeReportCsv,
  downloadFile,
  CoffeeReportExportData,
} from "@/lib/excel-export"

export function CoffeeReportView() {
  const [report, setReport] = useState<CoffeeReportSummary>({
    totalSales: 0,
    billCount: 0,
    totalCupsSold: 0,
    averageBillValue: 0,
    cashSales: 0,
    cardSales: 0,
    transferSales: 0,
    productSales: [],
    dailySummaries: [],
  })
  const [products, setProducts] = useState<CoffeeProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week" | "month">("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedProduct, setSelectedProduct] = useState("all")
  const [selectedPayment, setSelectedPayment] = useState("all")

  // Advanced Excel Export Dialog State
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<"excel" | "csv">("excel")

  // Load products list for dropdown filter
  useEffect(() => {
    fetch("/api/coffee/products", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((result) => setProducts(result.products || []))
      .catch(() => toast.error("Failed to load coffee products"))
  }, [])

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

  // Load report data
  async function fetchReport() {
    setLoading(true)
    try {
      const filters: CoffeeReportFilters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        productId: selectedProduct !== "all" ? selectedProduct : undefined,
        paymentMethod: selectedPayment !== "all" ? selectedPayment : undefined,
      }

      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value)
      })
      const response = await fetch(`/api/coffee/reports?${params}`, { cache: "no-store" })
      if (!response.ok) throw new Error("Report request failed")
      const result = await response.json()
      setReport(result.report)
    } catch {
      toast.error("Failed to generate coffee report")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [startDate, endDate, selectedProduct, selectedPayment])

  // Reset filters
  function handleResetFilters() {
    setDatePreset("all")
    setStartDate("")
    setEndDate("")
    setSelectedProduct("all")
    setSelectedPayment("all")
  }

  // Handler to export Coffee Report in professional Excel (.xls) or Horizontal CSV (.csv) format
  function handleDownloadCoffeeReport(format: "excel" | "csv") {
    if (!report.billCount) {
      toast.error("No coffee sales data to export for selected range")
      return
    }

    const dateRangeLabel =
      startDate && endDate
        ? `${startDate} to ${endDate}`
        : startDate
        ? `From ${startDate}`
        : endDate
        ? `Until ${endDate}`
        : "All Time (Complete History)"

    const exportData: CoffeeReportExportData = {
      filters: {
        dateRange: dateRangeLabel,
        paymentMethod: selectedPayment === "all" ? "All Payment Methods" : selectedPayment.toUpperCase(),
        product: selectedProduct === "all" ? "All Coffee Items" : selectedProduct,
        generatedAt: new Date().toLocaleString(),
      },
      totalSales: report.totalSales,
      billCount: report.billCount,
      totalCupsSold: report.totalCupsSold,
      averageBillValue: report.averageBillValue,
      cashSales: report.cashSales,
      cardSales: report.cardSales,
      transferSales: report.transferSales,
      bills: report.bills || [],
      productSales: report.productSales,
      dailySummaries: report.dailySummaries,
    }

    const dateSlug = new Date().toISOString().substring(0, 10)

    if (format === "excel") {
      const xlsxBuffer = generateCoffeeReportExcelXml(exportData)
      downloadFile(xlsxBuffer, `Coffee_Report_${dateSlug}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      toast.success("Excel Workbook (.xlsx) exported with auto-filters & horizontal ledger!")
    } else {
      const csv = generateCoffeeReportCsv(exportData)
      downloadFile(csv, `Coffee_Report_${dateSlug}.csv`, "text/csv;charset=utf-8")
      toast.success("Horizontal CSV ledger exported successfully!")
    }

    setShowExportModal(false)
  }

  // Open Export Modal
  function exportToExcel() {
    setShowExportModal(true)
  }

  // 2. Export to PDF / Print
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
              <h2 className="font-serif text-2xl font-bold text-gray-900">Coffee Sales Report</h2>
              <Badge className="bg-[#FAF5F1] text-[#808068] border-[#E5D8CF] text-[10px] font-semibold">
                Independent Module
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Isolated coffee analytics, product-wise breakdown, and daily revenue summaries.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={exportToExcel}
            variant="outline"
            className="rounded-xl border-[#E5D8CF] text-xs h-10 gap-1.5 hover:bg-[#FAF5F1] text-[#808068] flex-1 sm:flex-initial"
          >
            <FileSpreadsheet className="size-4 text-[#808068]" />
            Export to Excel
          </Button>

          <Button
            onClick={printReport}
            className="bg-[#D67B6B] text-white hover:bg-[#c36859] rounded-xl text-xs h-10 px-4 gap-1.5 shadow-sm flex-1 sm:flex-initial"
          >
            <Printer className="size-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="rounded-2xl border-[#E5D8CF] bg-white p-4 shadow-sm print:hidden">
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-gray-600 mr-1 flex items-center gap-1">
                <Calendar className="size-3.5" /> Date Preset:
              </span>
              <Button
                size="sm"
                variant={datePreset === "all" ? "default" : "outline"}
                onClick={() => applyDatePreset("all")}
                className={`rounded-xl text-xs h-8 px-3 ${
                  datePreset === "all" ? "bg-[#D67B6B] text-white" : "border-[#E5D8CF] text-gray-700 hover:bg-[#FAF5F1]"
                }`}
              >
                All Time
              </Button>
              <Button
                size="sm"
                variant={datePreset === "today" ? "default" : "outline"}
                onClick={() => applyDatePreset("today")}
                className={`rounded-xl text-xs h-8 px-3 ${
                  datePreset === "today" ? "bg-[#D67B6B] text-white" : "border-[#E5D8CF] text-gray-700 hover:bg-[#FAF5F1]"
                }`}
              >
                Today
              </Button>
              <Button
                size="sm"
                variant={datePreset === "week" ? "default" : "outline"}
                onClick={() => applyDatePreset("week")}
                className={`rounded-xl text-xs h-8 px-3 ${
                  datePreset === "week" ? "bg-[#D67B6B] text-white" : "border-[#E5D8CF] text-gray-700 hover:bg-[#FAF5F1]"
                }`}
              >
                Last 7 Days
              </Button>
              <Button
                size="sm"
                variant={datePreset === "month" ? "default" : "outline"}
                onClick={() => applyDatePreset("month")}
                className={`rounded-xl text-xs h-8 px-3 ${
                  datePreset === "month" ? "bg-[#D67B6B] text-white" : "border-[#E5D8CF] text-gray-700 hover:bg-[#FAF5F1]"
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

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="text-[11px] font-semibold text-gray-600">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setDatePreset("all")
                }}
                className="mt-1 h-9 text-xs rounded-xl border-[#E5D8CF]"
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
                className="mt-1 h-9 text-xs rounded-xl border-[#E5D8CF]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600">Coffee Product</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-[#E5D8CF] px-3 text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D67B6B]"
              >
                <option value="all">All Coffee Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
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
                <option value="card">Card Only</option>
                <option value="transfer">QR / Online Transfer</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-[#E5D8CF] p-4 bg-white shadow-sm">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Coffee Revenue</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-[#D67B6B] mt-1.5">
            Rs. {report.totalSales.toLocaleString()}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-[#808068] mt-1">
            <ArrowUpRight className="size-3.5" />
            <span>Pure Coffee Module</span>
          </div>
        </Card>

        <Card className="rounded-2xl border-[#E5D8CF] p-4 bg-white shadow-sm">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Bills Issued</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-gray-900 mt-1.5">
            {report.billCount} <span className="text-xs font-normal text-gray-500">bills</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">COF- prefix invoices</p>
        </Card>

        <Card className="rounded-2xl border-[#E5D8CF] p-4 bg-white shadow-sm">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Cups Sold</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-[#808068] mt-1.5">
            {report.totalCupsSold} <span className="text-xs font-normal text-gray-500">cups</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Line item volume</p>
        </Card>

        <Card className="rounded-2xl border-[#E5D8CF] p-4 bg-white shadow-sm">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Average Bill Value</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-gray-900 mt-1.5">
            Rs. {report.averageBillValue.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Spend per coffee customer</p>
        </Card>
      </div>

      {/* Payment Settlements Breakdown */}
      <Card className="rounded-2xl border-[#E5D8CF] p-4 bg-white shadow-sm">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Settlement Breakdown</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF5F1] border border-[#E5D8CF]">
            <div className="flex items-center gap-2">
              <Banknote className="size-4 text-[#808068]" />
              <span className="text-xs font-semibold text-gray-900">Cash</span>
            </div>
            <span className="font-mono font-bold text-xs sm:text-sm text-gray-900">
              Rs. {report.cashSales.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF5F1] border border-[#E5D8CF]">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-[#808068]" />
              <span className="text-xs font-semibold text-gray-900">Card Terminal</span>
            </div>
            <span className="font-mono font-bold text-xs sm:text-sm text-gray-900">
              Rs. {report.cardSales.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF5F1] border border-[#E5D8CF]">
            <div className="flex items-center gap-2">
              <Coffee className="size-4 text-[#808068]" />
              <span className="text-xs font-semibold text-gray-900">QR / Transfer</span>
            </div>
            <span className="font-mono font-bold text-xs sm:text-sm text-gray-900">
              Rs. {report.transferSales.toLocaleString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Product-Wise Sales Table */}
      <Card className="rounded-2xl border-[#E5D8CF] bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-[#FAF5F1] border-b border-[#E5D8CF] py-3.5 px-5">
          <CardTitle className="font-serif text-base font-bold text-gray-900">
            Product-Wise Coffee Sales
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Volume and revenue generated by each coffee kind.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#FAF5F1] border-b border-[#E5D8CF] text-gray-600 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Coffee Product</th>
                  <th className="py-3 px-4">Size/Kind</th>
                  <th className="py-3 px-4 text-center">Cups Sold</th>
                  <th className="py-3 px-4">Share of Sales</th>
                  <th className="py-3 px-4 text-right">Revenue (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4EBE4]">
                {report.productSales.length > 0 ? (
                  report.productSales.map((p, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF5F1]">
                      <td className="py-3 px-4 font-semibold text-gray-900">{p.productName}</td>
                      <td className="py-3 px-4 text-gray-500">{p.category}</td>
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
                    <td colSpan={5} className="py-10 text-center text-gray-400">
                      No coffee products sold during this period.
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
            Daily coffee transaction breakdown.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#FAF5F1] border-b border-[#E5D8CF] text-gray-600 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Bills Count</th>
                  <th className="py-3 px-4 text-right">Daily Revenue (Rs.)</th>
                  <th className="py-3 px-4 text-right">Avg. Ticket (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4EBE4]">
                {report.dailySummaries.length > 0 ? (
                  report.dailySummaries.map((d, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF5F1]">
                      <td className="py-3 px-4 font-semibold text-gray-800">{d.date}</td>
                      <td className="py-3 px-4 text-center font-mono">{d.billCount}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#D67B6B]">
                        Rs. {d.totalRevenue.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-600">
                        Rs. {Math.round(d.totalRevenue / Math.max(1, d.billCount)).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-gray-400">
                      No daily records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Professional Coffee Excel Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-[#E5D8CF]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#808068] text-white shadow-sm">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-serif text-lg font-bold text-gray-900">
                  Export Coffee Sales Spreadsheet
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  Professional horizontal layout with native column auto-filters, warm brand headers (#808068), and multi-sheet audit ledgers.
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
                    <span className="font-bold text-gray-900 flex items-center gap-1.5">
                      <FileSpreadsheet className="size-4 text-[#808068]" />
                      Excel Workbook (.xlsx)
                    </span>
                    {exportFormat === "excel" && <CheckCircle2 className="size-3.5 text-[#D67B6B]" />}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Native Microsoft Excel (.xlsx) OpenXML workbook — zero warnings, native auto-filter dropdowns, and 4 detailed sheets.
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

            {/* Scope Summary Preview */}
            <div className="p-3.5 rounded-xl bg-[#FAF5F1] border border-[#E5D8CF] space-y-1.5">
              <div className="flex justify-between text-gray-600">
                <span>Date Range:</span>
                <span className="font-semibold text-gray-900">
                  {startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Until ${endDate}` : "All Time"}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Product Scope:</span>
                <span className="font-semibold text-gray-900">{selectedProduct === "all" ? "All Coffee Products" : selectedProduct}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Payment Method:</span>
                <span className="font-semibold text-gray-900">{selectedPayment === "all" ? "All Payment Methods" : selectedPayment}</span>
              </div>
              <div className="flex justify-between text-gray-600 pt-1.5 border-t border-gray-200 font-bold">
                <span>Bills Matching Filter:</span>
                <span className="text-[#D67B6B] font-mono">{report.billCount} bills · {report.totalCupsSold} cups · Rs. {report.totalSales.toLocaleString()}</span>
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
              onClick={() => handleDownloadCoffeeReport(exportFormat)}
              className="bg-[#D67B6B] text-white hover:bg-[#c36859] rounded-xl text-xs h-9 gap-1.5 px-4 shadow-sm font-semibold"
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
