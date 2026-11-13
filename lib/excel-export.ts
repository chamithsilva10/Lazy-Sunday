/**
 * Executive-Grade Excel (.xlsx) & CSV Export Engine
 * Generates genuine Microsoft Excel Workbooks (.xlsx OpenXML) with 100% visual fidelity
 * matching the Lazy Sunday branded dashboard design (Deep Navy #0F2C59 headers, Mint #D4F1E8
 * KPI summary cards and totals, side-by-side split payment and station summary tables,
 * currency and quantity number formats, and multi-sheet operational ledgers).
 */

import ExcelJS from "exceljs"
import { determineItemStation, getOrderStationScope } from "./station-routing"

// ---------- Brand Palette Constants (ARGB) ----------
const BRAND = {
  NAVY: "FF0F2C59", // Primary Deep Navy #0F2C59
  NAVY_BORDER: "FF1E3A8A", // Border for navy header cells
  WHITE: "FFFFFFFF", // Crisp White #FFFFFF
  MINT_BG: "FFD4F1E8", // Mint Green Summary Fill #D4F1E8
  MINT_CARD: "FFD8F3EC", // KPI Card Soft Mint Fill #D8F3EC
  MINT_CARD_BORDER: "FFB6E5D8",
  TEAL_ACCENT: "FF0D9488", // Dark Teal #0D9488 accent line
  SLATE_TEXT: "FF475569", // Subtitle & Meta text #475569
  MUTED_TEXT: "FF64748B", // Secondary text #64748B
  ROW_TEXT: "FF1E293B", // Data text #1E293B
  BORDER_LIGHT: "FFE2E8F0", // Cell border #E2E8F0
  BADGE_BG: "FFD1F4E8", // Paid badge fill
  BADGE_TEXT: "FF065F46", // Paid badge text
  FONT_FAMILY: "Segoe UI",
}

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
// MAIN POS SALES REPORT: EXECUTIVE EXCEL (.xlsx) GENERATOR
// ============================================================================
export async function generateSalesReportExcelXml(data: SalesReportExportData): Promise<Uint8Array> {
  return generateSalesReportXlsx(data)
}

export async function generateSalesReportXlsx(data: SalesReportExportData): Promise<Uint8Array> {
  const { filters } = data
  const wb = new ExcelJS.Workbook()
  wb.creator = "Lazy Sunday POS"
  wb.lastModifiedBy = filters.generatedBy || "POS Staff"
  wb.created = new Date()
  wb.modified = new Date()

  // --------------------------------------------------------------------------
  // 1. WORKSHEET 1: TRANSACTIONS LEDGER (EXACT MATCH TO REFERENCE IMAGE)
  // --------------------------------------------------------------------------
  const wsLedger = wb.addWorksheet("Transactions Ledger", {
    views: [{ showGridLines: true }],
  })

  // Configure column widths for 16 columns A to P
  wsLedger.columns = [
    { key: "orderNum", width: 14 }, // A: Order Number
    { key: "receiptNum", width: 14 }, // B: Receipt #
    { key: "date", width: 14 }, // C: Date
    { key: "time", width: 10 }, // D: Time
    { key: "station", width: 12 }, // E: Station
    { key: "department", width: 16 }, // F: Department
    { key: "table", width: 14 }, // G: Table / Place
    { key: "cashier", width: 13 }, // H: Cashier
    { key: "items", width: 38 }, // I: Items Ordered
    { key: "qty", width: 10 }, // J: Total Qty
    { key: "subtotal", width: 15 }, // K: Subtotal (Rs.)
    { key: "discount", width: 14 }, // L: Discount (Rs.)
    { key: "serviceCharge", width: 16 }, // M: Service Chg (Rs.)
    { key: "netTotal", width: 16 }, // N: Net Total (Rs.)
    { key: "paymentMethod", width: 16 }, // O: Payment Method
    { key: "status", width: 12 }, // P: Status
  ]

  // Top Header Area
  // Row 1: Brand Title + Sample / Live Data Tag
  wsLedger.mergeCells("A1:D1")
  const a1 = wsLedger.getCell("A1")
  a1.value = "LAZY SUNDAY"
  a1.font = { name: BRAND.FONT_FAMILY, size: 18, bold: true, color: { argb: BRAND.NAVY } }
  a1.alignment = { vertical: "middle", horizontal: "left" }
  a1.border = { left: { style: "medium", color: { argb: BRAND.TEAL_ACCENT } } }

  wsLedger.mergeCells("M1:P1")
  const m1 = wsLedger.getCell("M1")
  m1.value = "SAMPLE DATA"
  m1.font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
  m1.alignment = { vertical: "middle", horizontal: "right" }
  wsLedger.getRow(1).height = 24

  // Row 2: Subtitle + Date Tag
  wsLedger.mergeCells("A2:D2")
  const a2 = wsLedger.getCell("A2")
  a2.value = "SALES & TRANSACTIONS REGISTER"
  a2.font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
  a2.alignment = { vertical: "middle", horizontal: "left" }
  a2.border = { left: { style: "medium", color: { argb: BRAND.TEAL_ACCENT } } }

  wsLedger.mergeCells("M2:P2")
  const m2 = wsLedger.getCell("M2")
  const exportDateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
  m2.value = exportDateStr
  m2.font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
  m2.alignment = { vertical: "middle", horizontal: "right" }
  wsLedger.getRow(2).height = 18

  // Row 3: Meta Scope & Service Charges
  wsLedger.mergeCells("A3:H3")
  const a3 = wsLedger.getCell("A3")
  a3.value = `${filters.dateRange}  /  ${filters.stationScope}  /  ${filters.departmentScope}  /  ${filters.paymentMethod}`
  a3.font = { name: BRAND.FONT_FAMILY, size: 9, color: { argb: BRAND.SLATE_TEXT } }
  a3.alignment = { vertical: "middle", horizontal: "left" }

  wsLedger.mergeCells("L3:P3")
  const l3 = wsLedger.getCell("L3")
  l3.value = `Service charges: Rs. ${Number(data.totalServiceCharge || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  l3.font = { name: BRAND.FONT_FAMILY, size: 9, italic: true, color: { argb: BRAND.SLATE_TEXT } }
  l3.alignment = { vertical: "middle", horizontal: "right" }
  wsLedger.getRow(3).height = 20

  // Row 4: Spacer
  wsLedger.getRow(4).height = 8

  // Row 5: KPI Summary Cards Row (4 horizontal pill cards with teal accent)
  wsLedger.getRow(5).height = 32

  const setupKpiCard = (range: string, text: string) => {
    wsLedger.mergeCells(range)
    const [startCellKey, endCellKey] = range.split(":")
    const cell = wsLedger.getCell(startCellKey)
    cell.value = text
    cell.font = { name: BRAND.FONT_FAMILY, size: 11, bold: true, color: { argb: BRAND.NAVY } }
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 }

    const startCol = startCellKey.charCodeAt(0) - 64
    const endCol = endCellKey.charCodeAt(0) - 64

    for (let c = startCol; c <= endCol; c++) {
      const cCell = wsLedger.getRow(5).getCell(c)
      cCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND.MINT_CARD },
      }
      cCell.border = {
        top: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
        bottom: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
        left: c === startCol ? { style: "thick", color: { argb: BRAND.TEAL_ACCENT } } : undefined,
        right: c === endCol ? { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } } : undefined,
      }
    }
  }

  const formattedSales = Number(data.totalSales || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formattedAvgBill = Number(data.averageBillValue || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  setupKpiCard("A5:C5", `NET SALES · Rs. ${formattedSales}`)
  setupKpiCard("D5:F5", `ORDERS · ${data.billCount || 0}`)
  setupKpiCard("G5:I5", `ITEMS SOLD · ${data.totalItemsSold || 0}`)
  setupKpiCard("J5:P5", `AVERAGE BILL · Rs. ${formattedAvgBill}`)

  // Row 6: Spacer
  wsLedger.getRow(6).height = 10

  // Row 7: Section 01 Header
  wsLedger.mergeCells("A7:H7")
  const a7 = wsLedger.getCell("A7")
  a7.value = "01 / TRANSACTIONS LEDGER"
  a7.font = { name: BRAND.FONT_FAMILY, size: 12, bold: true, color: { argb: BRAND.NAVY } }
  a7.alignment = { vertical: "middle", horizontal: "left" }

  wsLedger.mergeCells("L7:P7")
  const l7 = wsLedger.getCell("L7")
  const ordersList = data.orders || []
  l7.value = `Preview: ${ordersList.length} sample orders`
  l7.font = { name: BRAND.FONT_FAMILY, size: 9.5, italic: true, color: { argb: BRAND.MUTED_TEXT } }
  l7.alignment = { vertical: "middle", horizontal: "right" }
  wsLedger.getRow(7).height = 22

  // Row 8: Table Header Row (Navy Blue #0F2C59 with white bold text & sorting arrows)
  const ledgerHeaders = [
    "Order Number ▼",
    "Receipt # ▼",
    "Date ▼",
    "Time ▼",
    "Station ▼",
    "Department ▼",
    "Table / Place ▼",
    "Cashier ▼",
    "Items Ordered ▼",
    "Total Qty ▼",
    "Subtotal (Rs.) ▼",
    "Discount (Rs.) ▼",
    "Service Chg (Rs.) ▼",
    "Net Total (Rs.) ▼",
    "Payment Method ▼",
    "Status ▼",
  ]

  const headerRow = wsLedger.getRow(8)
  headerRow.height = 26

  ledgerHeaders.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = h
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.NAVY },
    }
    cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, bold: true, color: { argb: BRAND.WHITE } }
    cell.border = {
      top: { style: "thin", color: { argb: BRAND.NAVY_BORDER } },
      bottom: { style: "thin", color: { argb: BRAND.NAVY_BORDER } },
      left: { style: "thin", color: { argb: BRAND.NAVY_BORDER } },
      right: { style: "thin", color: { argb: BRAND.NAVY_BORDER } },
    }
    const isNum = idx >= 9 && idx <= 13
    const isCenter = [0, 1, 2, 3, 4, 6, 7, 14, 15].includes(idx)
    cell.alignment = {
      vertical: "middle",
      horizontal: isNum ? "right" : isCenter ? "center" : "left",
    }
  })

  // Data Rows (Order by Order)
  let currentRowIdx = 9
  let sumSubtotal = 0
  let sumDiscount = 0
  let sumServiceCharge = 0
  let sumNetTotal = 0
  let sumQty = 0

  ordersList.forEach((order) => {
    const dObj = new Date(order.created_at)
    const dateFormatted = !isNaN(dObj.getTime())
      ? dObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : order.created_at
    const timeFormatted = !isNaN(dObj.getTime())
      ? dObj.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
      : ""

    const stationScope = getOrderStationScope(order.items)
    const stationLabel =
      stationScope === "mixed" ? "Mixed" : stationScope === "bar" ? "Bar" : "Kitchen"

    const itemsSummary = (order.items || [])
      .map((i) => `${i.quantity}x ${i.name}`)
      .join(", ")

    const orderQty = (order.items || []).reduce((sum, i) => sum + i.quantity, 0)
    const sub = order.subtotal || 0
    const disc = order.discount || 0
    const sc = order.service_charge || 0
    const net = order.total || 0

    sumSubtotal += sub
    sumDiscount += disc
    sumServiceCharge += sc
    sumNetTotal += net
    sumQty += orderQty

    const payDisplay =
      order.split_payments && order.split_payments.length > 0
        ? `SPLIT (${order.split_payments.map((sp) => `${(sp.method || "").toUpperCase()}: ${Number(sp.amount || 0).toLocaleString()}`).join(" / ")})`
        : (order.payment_method || "CASH").toUpperCase()

    const row = wsLedger.getRow(currentRowIdx)
    row.height = 22

    row.getCell(1).value = order.order_number
    row.getCell(2).value = order.receipt_number || order.order_number
    row.getCell(3).value = dateFormatted
    row.getCell(4).value = timeFormatted
    row.getCell(5).value = stationLabel
    row.getCell(6).value = order.department || "Juice & Food"
    row.getCell(7).value = order.table_name || "Counter"
    row.getCell(8).value = order.cashier_name || "Cashier"
    row.getCell(9).value = itemsSummary
    row.getCell(10).value = orderQty
    row.getCell(11).value = sub
    row.getCell(12).value = disc
    row.getCell(13).value = sc
    row.getCell(14).value = net
    row.getCell(15).value = payDisplay
    row.getCell(16).value = (order.status || "PAID").toUpperCase()

    for (let c = 1; c <= 16; c++) {
      const cell = row.getCell(c)
      cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.ROW_TEXT } }
      cell.border = {
        top: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        bottom: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        left: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        right: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
      }

      if (c === 10) {
        cell.numFmt = "#,##0"
        cell.alignment = { vertical: "middle", horizontal: "center" }
      } else if (c >= 11 && c <= 14) {
        cell.numFmt = "#,##0.00"
        cell.alignment = { vertical: "middle", horizontal: "right" }
        if (c === 14) {
          cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, bold: true, color: { argb: BRAND.NAVY } }
        }
      } else if ([1, 2, 3, 4, 5, 7, 8, 15].includes(c)) {
        cell.alignment = { vertical: "middle", horizontal: "center" }
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" }
      }

      // Status Badge (Paid)
      if (c === 16) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.BADGE_BG },
        }
        cell.font = { name: BRAND.FONT_FAMILY, size: 9, bold: true, color: { argb: BRAND.BADGE_TEXT } }
        cell.alignment = { vertical: "middle", horizontal: "center" }
        cell.border = {
          top: { style: "thin", color: { argb: "FFB4E8D8" } },
          bottom: { style: "thin", color: { argb: "FFB4E8D8" } },
          left: { style: "thin", color: { argb: "FFB4E8D8" } },
          right: { style: "thin", color: { argb: "FFB4E8D8" } },
        }
      }
    }
    currentRowIdx++
  })

  // Summary Row (PREVIEW TOTAL · X orders) in Mint Green #D4F1E8
  const sumRowIdx = currentRowIdx
  const sumRow = wsLedger.getRow(sumRowIdx)
  sumRow.height = 24

  wsLedger.mergeCells(`A${sumRowIdx}:I${sumRowIdx}`)
  const sumLabel = sumRow.getCell(1)
  sumLabel.value = `PREVIEW TOTAL · ${ordersList.length} orders`
  sumLabel.font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
  sumLabel.alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  sumRow.getCell(10).value = sumQty
  sumRow.getCell(10).numFmt = "#,##0"
  sumRow.getCell(10).alignment = { vertical: "middle", horizontal: "center" }

  sumRow.getCell(11).value = sumSubtotal
  sumRow.getCell(11).numFmt = "#,##0.00"
  sumRow.getCell(11).alignment = { vertical: "middle", horizontal: "right" }

  sumRow.getCell(12).value = sumDiscount
  sumRow.getCell(12).numFmt = "#,##0.00"
  sumRow.getCell(12).alignment = { vertical: "middle", horizontal: "right" }

  sumRow.getCell(13).value = sumServiceCharge
  sumRow.getCell(13).numFmt = "#,##0.00"
  sumRow.getCell(13).alignment = { vertical: "middle", horizontal: "right" }

  sumRow.getCell(14).value = sumNetTotal
  sumRow.getCell(14).numFmt = "#,##0.00"
  sumRow.getCell(14).alignment = { vertical: "middle", horizontal: "right" }

  for (let c = 1; c <= 16; c++) {
    const cell = sumRow.getCell(c)
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.MINT_BG },
    }
    cell.font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
    cell.border = {
      top: { style: "medium", color: { argb: BRAND.NAVY } },
      bottom: { style: "medium", color: { argb: BRAND.NAVY } },
      left: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
      right: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
    }
  }

  // Spacer before Split Tables
  currentRowIdx = sumRowIdx + 2
  wsLedger.getRow(currentRowIdx - 1).height = 16

  // --------------------------------------------------------------------------
  // DUAL SPLIT TABLES (SIDE-BY-SIDE): 02 / PAYMENT SUMMARY & 03 / STATION SUMMARY
  // --------------------------------------------------------------------------
  const titlesRowIdx = currentRowIdx
  wsLedger.mergeCells(`A${titlesRowIdx}:E${titlesRowIdx}`)
  const t2 = wsLedger.getCell(`A${titlesRowIdx}`)
  t2.value = "02 / PAYMENT SUMMARY"
  t2.font = { name: BRAND.FONT_FAMILY, size: 11, bold: true, color: { argb: BRAND.NAVY } }
  t2.alignment = { vertical: "middle", horizontal: "left" }

  wsLedger.mergeCells(`I${titlesRowIdx}:P${titlesRowIdx}`)
  const t3 = wsLedger.getCell(`I${titlesRowIdx}`)
  t3.value = "03 / STATION SUMMARY"
  t3.font = { name: BRAND.FONT_FAMILY, size: 11, bold: true, color: { argb: BRAND.NAVY } }
  t3.alignment = { vertical: "middle", horizontal: "left" }
  wsLedger.getRow(titlesRowIdx).height = 22

  // Split Table Header Row
  const splitHeaderIdx = titlesRowIdx + 1
  const sHRow = wsLedger.getRow(splitHeaderIdx)
  sHRow.height = 24

  // Left Headers (Table 02): Payment Method, Amount, Share
  wsLedger.mergeCells(`A${splitHeaderIdx}:B${splitHeaderIdx}`)
  const sh1 = sHRow.getCell(1)
  sh1.value = "Payment Method ▼"
  sh1.alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  wsLedger.mergeCells(`C${splitHeaderIdx}:D${splitHeaderIdx}`)
  const sh2 = sHRow.getCell(3)
  sh2.value = "Amount (Rs.) ▼"
  sh2.alignment = { vertical: "middle", horizontal: "right" }

  const sh3 = sHRow.getCell(5)
  sh3.value = "Share ▼"
  sh3.alignment = { vertical: "middle", horizontal: "right" }

  // Right Headers (Table 03): Station, Items Sold, Revenue
  wsLedger.mergeCells(`I${splitHeaderIdx}:J${splitHeaderIdx}`)
  const sh4 = sHRow.getCell(9)
  sh4.value = "Station ▼"
  sh4.alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  wsLedger.mergeCells(`K${splitHeaderIdx}:L${splitHeaderIdx}`)
  const sh5 = sHRow.getCell(11)
  sh5.value = "Items Sold ▼"
  sh5.alignment = { vertical: "middle", horizontal: "right" }

  wsLedger.mergeCells(`M${splitHeaderIdx}:P${splitHeaderIdx}`)
  const sh6 = sHRow.getCell(13)
  sh6.value = "Revenue (Rs.) ▼"
  sh6.alignment = { vertical: "middle", horizontal: "right" }

  const applyHeaderStyle = (row: ExcelJS.Row, start: number, end: number) => {
    for (let c = start; c <= end; c++) {
      const cell = row.getCell(c)
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND.NAVY },
      }
      cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, bold: true, color: { argb: BRAND.WHITE } }
      cell.border = {
        top: { style: "thin", color: { argb: BRAND.NAVY_BORDER } },
        bottom: { style: "thin", color: { argb: BRAND.NAVY_BORDER } },
        left: { style: "thin", color: { argb: BRAND.NAVY_BORDER } },
        right: { style: "thin", color: { argb: BRAND.NAVY_BORDER } },
      }
    }
  }
  applyHeaderStyle(sHRow, 1, 5)
  applyHeaderStyle(sHRow, 9, 16)

  // Payment Breakdown Items
  const totalSalesVal = data.totalSales || 1
  const paymentBreakdown = [
    {
      method: "Cash",
      amount: data.cashSales || 0,
      share: `${data.totalSales > 0 ? ((data.cashSales / totalSalesVal) * 100).toFixed(2) : "0.00"}%`,
    },
    {
      method: "Card",
      amount: data.cardSales || 0,
      share: `${data.totalSales > 0 ? ((data.cardSales / totalSalesVal) * 100).toFixed(2) : "0.00"}%`,
    },
  ]
  if (data.qrSales > 0) {
    paymentBreakdown.push({
      method: "QR / Online",
      amount: data.qrSales,
      share: `${((data.qrSales / totalSalesVal) * 100).toFixed(2)}%`,
    })
  }
  if (data.bankTransferSales > 0) {
    paymentBreakdown.push({
      method: "Bank Transfer",
      amount: data.bankTransferSales,
      share: `${((data.bankTransferSales / totalSalesVal) * 100).toFixed(2)}%`,
    })
  }
  if (data.creditSales > 0) {
    paymentBreakdown.push({
      method: "Customer Credit",
      amount: data.creditSales,
      share: `${((data.creditSales / totalSalesVal) * 100).toFixed(2)}%`,
    })
  }

  // Station Breakdown Items
  const stationBreakdown = [
    {
      station: "Kitchen",
      items: data.kitchenItemCount || 0,
      revenue: data.kitchenRevenue || 0,
    },
    {
      station: "Bar",
      items: data.barItemCount || 0,
      revenue: data.barRevenue || 0,
    },
  ]

  const maxSubRows = Math.max(paymentBreakdown.length, stationBreakdown.length)
  let subRowStart = splitHeaderIdx + 1

  for (let r = 0; r < maxSubRows; r++) {
    const sRow = wsLedger.getRow(subRowStart + r)
    sRow.height = 22

    // Left Table Data (Payment)
    const pItem = paymentBreakdown[r]
    if (pItem) {
      wsLedger.mergeCells(`A${subRowStart + r}:B${subRowStart + r}`)
      sRow.getCell(1).value = pItem.method
      sRow.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 }

      wsLedger.mergeCells(`C${subRowStart + r}:D${subRowStart + r}`)
      sRow.getCell(3).value = pItem.amount
      sRow.getCell(3).numFmt = "#,##0.00"
      sRow.getCell(3).alignment = { vertical: "middle", horizontal: "right" }

      sRow.getCell(5).value = pItem.share
      sRow.getCell(5).alignment = { vertical: "middle", horizontal: "right" }

      for (let c = 1; c <= 5; c++) {
        const cell = sRow.getCell(c)
        cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.ROW_TEXT } }
        cell.border = {
          top: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
          bottom: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
          left: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
          right: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        }
      }
    }

    // Right Table Data (Station)
    const stItem = stationBreakdown[r]
    if (stItem) {
      wsLedger.mergeCells(`I${subRowStart + r}:J${subRowStart + r}`)
      sRow.getCell(9).value = stItem.station
      sRow.getCell(9).alignment = { vertical: "middle", horizontal: "left", indent: 1 }

      wsLedger.mergeCells(`K${subRowStart + r}:L${subRowStart + r}`)
      sRow.getCell(11).value = stItem.items
      sRow.getCell(11).numFmt = "#,##0"
      sRow.getCell(11).alignment = { vertical: "middle", horizontal: "right" }

      wsLedger.mergeCells(`M${subRowStart + r}:P${subRowStart + r}`)
      sRow.getCell(13).value = stItem.revenue
      sRow.getCell(13).numFmt = "#,##0.00"
      sRow.getCell(13).alignment = { vertical: "middle", horizontal: "right" }

      for (let c = 9; c <= 16; c++) {
        const cell = sRow.getCell(c)
        cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.ROW_TEXT } }
        cell.border = {
          top: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
          bottom: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
          left: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
          right: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        }
      }
    }
  }

  // Totals Row for Split Tables
  const splitTotalIdx = subRowStart + maxSubRows
  const splitTotalRow = wsLedger.getRow(splitTotalIdx)
  splitTotalRow.height = 24

  // Table 02 Total
  wsLedger.mergeCells(`A${splitTotalIdx}:B${splitTotalIdx}`)
  splitTotalRow.getCell(1).value = "TOTAL"
  splitTotalRow.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  wsLedger.mergeCells(`C${splitTotalIdx}:D${splitTotalIdx}`)
  splitTotalRow.getCell(3).value = data.totalSales || 0
  splitTotalRow.getCell(3).numFmt = "#,##0.00"
  splitTotalRow.getCell(3).alignment = { vertical: "middle", horizontal: "right" }

  splitTotalRow.getCell(5).value = "100.00%"
  splitTotalRow.getCell(5).alignment = { vertical: "middle", horizontal: "right" }

  // Table 03 Total
  wsLedger.mergeCells(`I${splitTotalIdx}:J${splitTotalIdx}`)
  splitTotalRow.getCell(9).value = "TOTAL"
  splitTotalRow.getCell(9).alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  wsLedger.mergeCells(`K${splitTotalIdx}:L${splitTotalIdx}`)
  splitTotalRow.getCell(11).value = data.totalItemsSold || (data.kitchenItemCount + data.barItemCount)
  splitTotalRow.getCell(11).numFmt = "#,##0"
  splitTotalRow.getCell(11).alignment = { vertical: "middle", horizontal: "right" }

  wsLedger.mergeCells(`M${splitTotalIdx}:P${splitTotalIdx}`)
  splitTotalRow.getCell(13).value = data.totalSales || (data.kitchenRevenue + data.barRevenue)
  splitTotalRow.getCell(13).numFmt = "#,##0.00"
  splitTotalRow.getCell(13).alignment = { vertical: "middle", horizontal: "right" }

  const applyTotalStyle = (start: number, end: number) => {
    for (let c = start; c <= end; c++) {
      const cell = splitTotalRow.getCell(c)
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND.MINT_BG },
      }
      cell.font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
      cell.border = {
        top: { style: "medium", color: { argb: BRAND.NAVY } },
        bottom: { style: "medium", color: { argb: BRAND.NAVY } },
        left: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
        right: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
      }
    }
  }
  applyTotalStyle(1, 5)
  applyTotalStyle(9, 16)

  // Footer Note: Design concept • Illustrative data
  const footerIdx = splitTotalIdx + 2
  wsLedger.mergeCells(`L${footerIdx}:P${footerIdx}`)
  const fCell = wsLedger.getCell(`L${footerIdx}`)
  fCell.value = "Design concept • Illustrative data"
  fCell.font = { name: BRAND.FONT_FAMILY, size: 9, italic: true, color: { argb: BRAND.MUTED_TEXT } }
  fCell.alignment = { vertical: "middle", horizontal: "right" }

  // --------------------------------------------------------------------------
  // 2. WORKSHEET 2: PRODUCT SALES
  // --------------------------------------------------------------------------
  const wsProd = wb.addWorksheet("Product Sales", {
    views: [{ showGridLines: true }],
  })
  wsProd.columns = [
    { width: 10 }, // Rank
    { width: 30 }, // Product Name
    { width: 18 }, // Category
    { width: 15 }, // Station
    { width: 14 }, // Units Sold
    { width: 20 }, // Avg Unit Price
    { width: 22 }, // Total Revenue
    { width: 18 }, // Share of Sales
  ]

  // Banner Header
  wsProd.mergeCells("A1:D1")
  const pA1 = wsProd.getCell("A1")
  pA1.value = "LAZY SUNDAY — PRODUCT PERFORMANCE"
  pA1.font = { name: BRAND.FONT_FAMILY, size: 14, bold: true, color: { argb: BRAND.NAVY } }
  pA1.alignment = { vertical: "middle", horizontal: "left" }
  pA1.border = { left: { style: "medium", color: { argb: BRAND.TEAL_ACCENT } } }

  wsProd.mergeCells("A2:H2")
  wsProd.getCell("A2").value = `Date Range: ${filters.dateRange}  |  Station Scope: ${filters.stationScope}  |  Ranked by Total Revenue`
  wsProd.getCell("A2").font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.SLATE_TEXT } }
  wsProd.getRow(1).height = 24
  wsProd.getRow(2).height = 18
  wsProd.getRow(3).height = 10

  const prodHeaders = [
    "Rank (#) ▼",
    "Product Name ▼",
    "Category ▼",
    "Station ▼",
    "Units Sold ▼",
    "Avg Unit Price (Rs.) ▼",
    "Total Revenue (Rs.) ▼",
    "Share of Sales (%) ▼",
  ]
  const pHeaderRow = wsProd.getRow(4)
  pHeaderRow.height = 26
  prodHeaders.forEach((h, idx) => {
    const cell = pHeaderRow.getCell(idx + 1)
    cell.value = h
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.NAVY } }
    cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, bold: true, color: { argb: BRAND.WHITE } }
    cell.alignment = {
      vertical: "middle",
      horizontal: idx >= 4 ? "right" : idx === 0 || idx === 3 ? "center" : "left",
    }
  })

  let pRowIdx = 5
  let pSumQty = 0
  let pSumRev = 0

  data.productSales.forEach((p, idx) => {
    const station = determineItemStation({ name: p.productName, category: p.category })
    const stationLabel = station === "bar" ? "Bar" : "Kitchen"
    const avgPrice = p.quantitySold > 0 ? Math.round(p.totalRevenue / p.quantitySold) : 0

    pSumQty += p.quantitySold
    pSumRev += p.totalRevenue

    const row = wsProd.getRow(pRowIdx)
    row.height = 22
    row.getCell(1).value = idx + 1
    row.getCell(2).value = p.productName
    row.getCell(3).value = p.category
    row.getCell(4).value = stationLabel
    row.getCell(5).value = p.quantitySold
    row.getCell(6).value = avgPrice
    row.getCell(7).value = p.totalRevenue
    row.getCell(8).value = `${p.percentageOfSales}%`

    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" }
    row.getCell(2).alignment = { vertical: "middle", horizontal: "left" }
    row.getCell(3).alignment = { vertical: "middle", horizontal: "left" }
    row.getCell(4).alignment = { vertical: "middle", horizontal: "center" }
    row.getCell(5).alignment = { vertical: "middle", horizontal: "right" }
    row.getCell(6).alignment = { vertical: "middle", horizontal: "right" }
    row.getCell(7).alignment = { vertical: "middle", horizontal: "right" }
    row.getCell(8).alignment = { vertical: "middle", horizontal: "right" }

    row.getCell(5).numFmt = "#,##0"
    row.getCell(6).numFmt = "#,##0.00"
    row.getCell(7).numFmt = "#,##0.00"

    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c)
      cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.ROW_TEXT } }
      cell.border = {
        top: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        bottom: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        left: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        right: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
      }
    }
    pRowIdx++
  })

  // Product Total Row
  const pSumRow = wsProd.getRow(pRowIdx)
  pSumRow.height = 24
  wsProd.mergeCells(`A${pRowIdx}:D${pRowIdx}`)
  pSumRow.getCell(1).value = `TOTAL (${data.productSales.length} Products)`
  pSumRow.getCell(1).font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
  pSumRow.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  pSumRow.getCell(5).value = pSumQty
  pSumRow.getCell(5).numFmt = "#,##0"
  pSumRow.getCell(5).alignment = { vertical: "middle", horizontal: "right" }

  pSumRow.getCell(6).value = "-"
  pSumRow.getCell(6).alignment = { vertical: "middle", horizontal: "center" }

  pSumRow.getCell(7).value = pSumRev
  pSumRow.getCell(7).numFmt = "#,##0.00"
  pSumRow.getCell(7).alignment = { vertical: "middle", horizontal: "right" }

  pSumRow.getCell(8).value = "100.0%"
  pSumRow.getCell(8).alignment = { vertical: "middle", horizontal: "right" }

  for (let c = 1; c <= 8; c++) {
    const cell = pSumRow.getCell(c)
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.MINT_BG } }
    cell.font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
    cell.border = {
      top: { style: "medium", color: { argb: BRAND.NAVY } },
      bottom: { style: "medium", color: { argb: BRAND.NAVY } },
      left: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
      right: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
    }
  }

  // --------------------------------------------------------------------------
  // 3. WORKSHEET 3: CATEGORY & STATION ANALYSIS
  // --------------------------------------------------------------------------
  const wsCat = wb.addWorksheet("Category & Station", {
    views: [{ showGridLines: true }],
  })
  wsCat.columns = [
    { width: 24 }, // Category
    { width: 22 }, // Station
    { width: 18 }, // Items Sold
    { width: 22 }, // Total Revenue
    { width: 18 }, // Contribution
  ]

  wsCat.mergeCells("A1:D1")
  const cA1 = wsCat.getCell("A1")
  cA1.value = "LAZY SUNDAY — CATEGORY & STATION ANALYSIS"
  cA1.font = { name: BRAND.FONT_FAMILY, size: 14, bold: true, color: { argb: BRAND.NAVY } }
  cA1.alignment = { vertical: "middle", horizontal: "left" }
  cA1.border = { left: { style: "medium", color: { argb: BRAND.TEAL_ACCENT } } }

  wsCat.mergeCells("A2:E2")
  wsCat.getCell("A2").value = `Date Range: ${filters.dateRange}  |  Station Scope: ${filters.stationScope}`
  wsCat.getCell("A2").font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.SLATE_TEXT } }
  wsCat.getRow(1).height = 24
  wsCat.getRow(2).height = 18
  wsCat.getRow(3).height = 10

  const catHeaders = [
    "Menu Category ▼",
    "Primary Station ▼",
    "Items Sold (Units) ▼",
    "Total Revenue (Rs.) ▼",
    "Contribution (%) ▼",
  ]
  const cHeaderRow = wsCat.getRow(4)
  cHeaderRow.height = 26
  catHeaders.forEach((h, idx) => {
    const cell = cHeaderRow.getCell(idx + 1)
    cell.value = h
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.NAVY } }
    cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, bold: true, color: { argb: BRAND.WHITE } }
    cell.alignment = {
      vertical: "middle",
      horizontal: idx >= 2 ? "right" : idx === 1 ? "center" : "left",
    }
  })

  let cRowIdx = 5
  let cSumQty = 0
  let cSumRev = 0

  data.categorySales.forEach((c) => {
    const station = determineItemStation({ category: c.category })
    const stationLabel = station === "bar" ? "Bar (Beverages)" : "Kitchen (Food)"

    cSumQty += c.itemCount
    cSumRev += c.totalRevenue

    const row = wsCat.getRow(cRowIdx)
    row.height = 22
    row.getCell(1).value = c.category
    row.getCell(2).value = stationLabel
    row.getCell(3).value = c.itemCount
    row.getCell(4).value = c.totalRevenue
    row.getCell(5).value = `${c.percentageOfSales}%`

    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" }
    row.getCell(2).alignment = { vertical: "middle", horizontal: "center" }
    row.getCell(3).alignment = { vertical: "middle", horizontal: "right" }
    row.getCell(4).alignment = { vertical: "middle", horizontal: "right" }
    row.getCell(5).alignment = { vertical: "middle", horizontal: "right" }

    row.getCell(3).numFmt = "#,##0"
    row.getCell(4).numFmt = "#,##0.00"

    for (let col = 1; col <= 5; col++) {
      const cell = row.getCell(col)
      cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.ROW_TEXT } }
      cell.border = {
        top: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        bottom: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        left: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        right: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
      }
    }
    cRowIdx++
  })

  // Category Total Row
  const cSumRow = wsCat.getRow(cRowIdx)
  cSumRow.height = 24
  wsCat.mergeCells(`A${cRowIdx}:B${cRowIdx}`)
  cSumRow.getCell(1).value = `TOTAL (${data.categorySales.length} Categories)`
  cSumRow.getCell(1).font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
  cSumRow.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  cSumRow.getCell(3).value = cSumQty
  cSumRow.getCell(3).numFmt = "#,##0"
  cSumRow.getCell(3).alignment = { vertical: "middle", horizontal: "right" }

  cSumRow.getCell(4).value = cSumRev
  cSumRow.getCell(4).numFmt = "#,##0.00"
  cSumRow.getCell(4).alignment = { vertical: "middle", horizontal: "right" }

  cSumRow.getCell(5).value = "100.0%"
  cSumRow.getCell(5).alignment = { vertical: "middle", horizontal: "right" }

  for (let col = 1; col <= 5; col++) {
    const cell = cSumRow.getCell(col)
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.MINT_BG } }
    cell.font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
    cell.border = {
      top: { style: "medium", color: { argb: BRAND.NAVY } },
      bottom: { style: "medium", color: { argb: BRAND.NAVY } },
      left: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
      right: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
    }
  }

  // --------------------------------------------------------------------------
  // 4. WORKSHEET 4: DAILY REVENUE
  // --------------------------------------------------------------------------
  const wsDaily = wb.addWorksheet("Daily Revenue", {
    views: [{ showGridLines: true }],
  })
  wsDaily.columns = [
    { width: 14 }, // Date
    { width: 14 }, // Day of Week
    { width: 14 }, // Orders Count
    { width: 20 }, // Sales Subtotal
    { width: 20 }, // Service Charge
    { width: 20 }, // Total Revenue
    { width: 20 }, // Average Ticket
  ]

  wsDaily.mergeCells("A1:D1")
  const dA1 = wsDaily.getCell("A1")
  dA1.value = "LAZY SUNDAY — DAILY REVENUE REGISTER"
  dA1.font = { name: BRAND.FONT_FAMILY, size: 14, bold: true, color: { argb: BRAND.NAVY } }
  dA1.alignment = { vertical: "middle", horizontal: "left" }
  dA1.border = { left: { style: "medium", color: { argb: BRAND.TEAL_ACCENT } } }

  wsDaily.mergeCells("A2:G2")
  wsDaily.getCell("A2").value = `Chronological day-by-day revenue breakdown  |  Date Range: ${filters.dateRange}`
  wsDaily.getCell("A2").font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.SLATE_TEXT } }
  wsDaily.getRow(1).height = 24
  wsDaily.getRow(2).height = 18
  wsDaily.getRow(3).height = 10

  const dailyHeaders = [
    "Date ▼",
    "Day of Week ▼",
    "Orders Count ▼",
    "Sales Subtotal (Rs.) ▼",
    "Service Charge (Rs.) ▼",
    "Total Revenue (Rs.) ▼",
    "Average Ticket (Rs.) ▼",
  ]
  const dHeaderRow = wsDaily.getRow(4)
  dHeaderRow.height = 26
  dailyHeaders.forEach((h, idx) => {
    const cell = dHeaderRow.getCell(idx + 1)
    cell.value = h
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.NAVY } }
    cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, bold: true, color: { argb: BRAND.WHITE } }
    cell.alignment = {
      vertical: "middle",
      horizontal: idx >= 2 ? "right" : "center",
    }
  })

  let dRowIdx = 5
  let dSumBills = 0
  let dSumSub = 0
  let dSumService = 0
  let dSumRev = 0

  data.dailySummaries.forEach((d) => {
    const dDate = new Date(d.date)
    const dayOfWeek = !isNaN(dDate.getTime())
      ? dDate.toLocaleDateString("en-US", { weekday: "short" })
      : ""
    const subtotal = d.totalRevenue - d.totalServiceCharge
    const avgTicket = d.billCount > 0 ? Math.round(d.totalRevenue / d.billCount) : 0

    dSumBills += d.billCount
    dSumSub += subtotal
    dSumService += d.totalServiceCharge
    dSumRev += d.totalRevenue

    const row = wsDaily.getRow(dRowIdx)
    row.height = 22
    row.getCell(1).value = d.date
    row.getCell(2).value = dayOfWeek
    row.getCell(3).value = d.billCount
    row.getCell(4).value = subtotal
    row.getCell(5).value = d.totalServiceCharge
    row.getCell(6).value = d.totalRevenue
    row.getCell(7).value = avgTicket

    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" }
    row.getCell(2).alignment = { vertical: "middle", horizontal: "center" }
    row.getCell(3).alignment = { vertical: "middle", horizontal: "right" }
    row.getCell(4).alignment = { vertical: "middle", horizontal: "right" }
    row.getCell(5).alignment = { vertical: "middle", horizontal: "right" }
    row.getCell(6).alignment = { vertical: "middle", horizontal: "right" }
    row.getCell(7).alignment = { vertical: "middle", horizontal: "right" }

    row.getCell(3).numFmt = "#,##0"
    row.getCell(4).numFmt = "#,##0.00"
    row.getCell(5).numFmt = "#,##0.00"
    row.getCell(6).numFmt = "#,##0.00"
    row.getCell(7).numFmt = "#,##0.00"

    for (let col = 1; col <= 7; col++) {
      const cell = row.getCell(col)
      cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.ROW_TEXT } }
      cell.border = {
        top: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        bottom: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        left: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        right: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
      }
    }
    dRowIdx++
  })

  // Daily Total Row
  const dSumRow = wsDaily.getRow(dRowIdx)
  dSumRow.height = 24
  wsDaily.mergeCells(`A${dRowIdx}:B${dRowIdx}`)
  dSumRow.getCell(1).value = `TOTAL (${data.dailySummaries.length} Days)`
  dSumRow.getCell(1).font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
  dSumRow.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  dSumRow.getCell(3).value = dSumBills
  dSumRow.getCell(3).numFmt = "#,##0"
  dSumRow.getCell(3).alignment = { vertical: "middle", horizontal: "right" }

  dSumRow.getCell(4).value = dSumSub
  dSumRow.getCell(4).numFmt = "#,##0.00"
  dSumRow.getCell(4).alignment = { vertical: "middle", horizontal: "right" }

  dSumRow.getCell(5).value = dSumService
  dSumRow.getCell(5).numFmt = "#,##0.00"
  dSumRow.getCell(5).alignment = { vertical: "middle", horizontal: "right" }

  dSumRow.getCell(6).value = dSumRev
  dSumRow.getCell(6).numFmt = "#,##0.00"
  dSumRow.getCell(6).alignment = { vertical: "middle", horizontal: "right" }

  dSumRow.getCell(7).value = dSumBills > 0 ? Math.round(dSumRev / dSumBills) : 0
  dSumRow.getCell(7).numFmt = "#,##0.00"
  dSumRow.getCell(7).alignment = { vertical: "middle", horizontal: "right" }

  for (let col = 1; col <= 7; col++) {
    const cell = dSumRow.getCell(col)
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.MINT_BG } }
    cell.font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
    cell.border = {
      top: { style: "medium", color: { argb: BRAND.NAVY } },
      bottom: { style: "medium", color: { argb: BRAND.NAVY } },
      left: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
      right: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
    }
  }

  // --------------------------------------------------------------------------
  // 5. WORKSHEET 5: EXECUTIVE KPIS (HORIZONTAL)
  // --------------------------------------------------------------------------
  const wsExec = wb.addWorksheet("Executive KPIs", {
    views: [{ showGridLines: true }],
  })
  wsExec.columns = [
    { width: 18 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
  ]

  wsExec.mergeCells("A1:D1")
  const eA1 = wsExec.getCell("A1")
  eA1.value = "LAZY SUNDAY — EXECUTIVE KPIS"
  eA1.font = { name: BRAND.FONT_FAMILY, size: 14, bold: true, color: { argb: BRAND.NAVY } }
  eA1.alignment = { vertical: "middle", horizontal: "left" }
  eA1.border = { left: { style: "medium", color: { argb: BRAND.TEAL_ACCENT } } }

  wsExec.mergeCells("A2:O2")
  wsExec.getCell("A2").value = "All core sales metrics arranged side-by-side horizontally for instant executive review."
  wsExec.getCell("A2").font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.SLATE_TEXT } }
  wsExec.getRow(1).height = 24
  wsExec.getRow(2).height = 18
  wsExec.getRow(3).height = 10

  const execHeaders = [
    "Date Scope ▼",
    "Station Filter ▼",
    "Total Orders ▼",
    "Items Sold ▼",
    "Gross Revenue (Rs.) ▼",
    "Service Charges (Rs.) ▼",
    "Net Total (Rs.) ▼",
    "Average Ticket (Rs.) ▼",
    "Cash Sales (Rs.) ▼",
    "Card Terminal (Rs.) ▼",
    "QR / Online (Rs.) ▼",
    "Bank Transfer (Rs.) ▼",
    "Customer Credit (Rs.) ▼",
    "Kitchen Share (%) ▼",
    "Bar Share (%) ▼",
  ]
  const eHeaderRow = wsExec.getRow(4)
  eHeaderRow.height = 26
  execHeaders.forEach((h, idx) => {
    const cell = eHeaderRow.getCell(idx + 1)
    cell.value = h
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.NAVY } }
    cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, bold: true, color: { argb: BRAND.WHITE } }
    cell.alignment = {
      vertical: "middle",
      horizontal: idx >= 2 ? "right" : "center",
    }
  })

  const kitchenSharePct = data.totalSales > 0 ? Math.round((data.kitchenRevenue / data.totalSales) * 100) : 0
  const barSharePct = data.totalSales > 0 ? Math.round((data.barRevenue / data.totalSales) * 100) : 0

  const eDataRow = wsExec.getRow(5)
  eDataRow.height = 24
  eDataRow.getCell(1).value = filters.dateRange
  eDataRow.getCell(2).value = filters.stationScope
  eDataRow.getCell(3).value = data.billCount
  eDataRow.getCell(4).value = data.totalItemsSold
  eDataRow.getCell(5).value = data.totalSales - data.totalServiceCharge
  eDataRow.getCell(6).value = data.totalServiceCharge
  eDataRow.getCell(7).value = data.totalSales
  eDataRow.getCell(8).value = data.averageBillValue
  eDataRow.getCell(9).value = data.cashSales
  eDataRow.getCell(10).value = data.cardSales
  eDataRow.getCell(11).value = data.qrSales
  eDataRow.getCell(12).value = data.bankTransferSales
  eDataRow.getCell(13).value = data.creditSales
  eDataRow.getCell(14).value = `${kitchenSharePct}%`
  eDataRow.getCell(15).value = `${barSharePct}%`

  eDataRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" }
  eDataRow.getCell(2).alignment = { vertical: "middle", horizontal: "center" }
  for (let c = 3; c <= 15; c++) {
    eDataRow.getCell(c).alignment = { vertical: "middle", horizontal: "right" }
    if (c === 3 || c === 4) {
      eDataRow.getCell(c).numFmt = "#,##0"
    } else if (c >= 5 && c <= 13) {
      eDataRow.getCell(c).numFmt = "#,##0.00"
    }
  }

  for (let col = 1; col <= 15; col++) {
    const cell = eDataRow.getCell(col)
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.MINT_CARD } }
    cell.font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
    cell.border = {
      top: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
      bottom: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
      left: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
      right: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
    }
  }

  // Generate binary XLSX buffer
  const buffer = await wb.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

// ============================================================================
// MAIN POS SALES REPORT: HORIZONTAL CSV GENERATOR
// ============================================================================
export function generateSalesReportCsv(data: SalesReportExportData): string {
  const { filters } = data
  let out = "\uFEFF" // UTF-8 BOM so Excel opens with proper encoding

  // Header Title & Metadata
  out += `LAZY SUNDAY - TRANSACTIONS & SALES REGISTER\r\n`
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
      stationScope === "mixed" ? "Mixed" : stationScope === "bar" ? "Bar" : "Kitchen"

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
// COFFEE MODULE REPORT: EXECUTIVE EXCEL (.xlsx) GENERATOR
// ============================================================================
export async function generateCoffeeReportExcelXml(data: CoffeeReportExportData): Promise<Uint8Array> {
  return generateCoffeeReportXlsx(data)
}

export async function generateCoffeeReportXlsx(data: CoffeeReportExportData): Promise<Uint8Array> {
  const { filters } = data
  const wb = new ExcelJS.Workbook()
  wb.creator = "Lazy Sunday Coffee POS"
  wb.created = new Date()

  // 1. WORKSHEET 1: COFFEE BILLS LEDGER
  const wsLedger = wb.addWorksheet("Coffee Bills Ledger", {
    views: [{ showGridLines: true }],
  })
  wsLedger.columns = [
    { width: 14 }, // Bill Number
    { width: 13 }, // Date
    { width: 10 }, // Time
    { width: 14 }, // Station
    { width: 16 }, // Table
    { width: 16 }, // Customer
    { width: 36 }, // Items
    { width: 10 }, // Cups
    { width: 15 }, // Subtotal
    { width: 14 }, // Discount
    { width: 16 }, // Grand Total
    { width: 15 }, // Payment Method
  ]

  wsLedger.mergeCells("A1:D1")
  const a1 = wsLedger.getCell("A1")
  a1.value = "LAZY SUNDAY COFFEE"
  a1.font = { name: BRAND.FONT_FAMILY, size: 16, bold: true, color: { argb: BRAND.NAVY } }
  a1.border = { left: { style: "medium", color: { argb: BRAND.TEAL_ACCENT } } }

  wsLedger.mergeCells("A2:L2")
  wsLedger.getCell("A2").value = `COFFEE BAR — SALES & BILLS REGISTER  |  Date Range: ${filters.dateRange}  |  Payment: ${filters.paymentMethod}`
  wsLedger.getCell("A2").font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.SLATE_TEXT } }
  wsLedger.getRow(1).height = 24
  wsLedger.getRow(2).height = 18
  wsLedger.getRow(3).height = 10

  const headers = [
    "Bill Number ▼",
    "Date ▼",
    "Time ▼",
    "Station ▼",
    "Table / Counter ▼",
    "Customer ▼",
    "Coffee Items Ordered ▼",
    "Cups Qty ▼",
    "Subtotal (Rs.) ▼",
    "Discount (Rs.) ▼",
    "Grand Total (Rs.) ▼",
    "Payment Method ▼",
  ]
  const hRow = wsLedger.getRow(4)
  hRow.height = 26
  headers.forEach((h, idx) => {
    const cell = hRow.getCell(idx + 1)
    cell.value = h
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.NAVY } }
    cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, bold: true, color: { argb: BRAND.WHITE } }
    cell.alignment = {
      vertical: "middle",
      horizontal: idx >= 7 && idx <= 10 ? "right" : [0, 1, 2, 3, 11].includes(idx) ? "center" : "left",
    }
  })

  let rowIdx = 5
  let totalCups = 0
  let totalSub = 0
  let totalDisc = 0
  let totalGrand = 0
  const billsList = data.bills || []

  billsList.forEach((bill) => {
    const dObj = new Date(bill.bill_date)
    const dateStr = !isNaN(dObj.getTime())
      ? dObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : bill.bill_date
    const timeStr = !isNaN(dObj.getTime())
      ? dObj.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
      : ""

    const itemsSummary = (bill.items || [])
      .map((i) => `${i.quantity}x ${i.item_name}${i.size ? ` (${i.size})` : ""}`)
      .join(", ")

    const cups = (bill.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0)
    totalCups += cups
    totalSub += bill.subtotal || 0
    totalDisc += bill.discount || 0
    totalGrand += bill.grand_total || 0

    const row = wsLedger.getRow(rowIdx)
    row.height = 22
    row.getCell(1).value = bill.bill_number
    row.getCell(2).value = dateStr
    row.getCell(3).value = timeStr
    row.getCell(4).value = "Coffee Bar"
    row.getCell(5).value = bill.table_name || "Takeaway"
    row.getCell(6).value = bill.customer_name || "Guest"
    row.getCell(7).value = itemsSummary
    row.getCell(8).value = cups
    row.getCell(9).value = bill.subtotal || 0
    row.getCell(10).value = bill.discount || 0
    row.getCell(11).value = bill.grand_total || 0
    row.getCell(12).value = (bill.payment_method || "CASH").toUpperCase()

    row.getCell(8).numFmt = "#,##0"
    row.getCell(9).numFmt = "#,##0.00"
    row.getCell(10).numFmt = "#,##0.00"
    row.getCell(11).numFmt = "#,##0.00"

    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c)
      cell.font = { name: BRAND.FONT_FAMILY, size: 9.5, color: { argb: BRAND.ROW_TEXT } }
      cell.border = {
        top: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        bottom: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        left: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
        right: { style: "thin", color: { argb: BRAND.BORDER_LIGHT } },
      }
    }
    rowIdx++
  })

  // Summary Row
  const sumRow = wsLedger.getRow(rowIdx)
  sumRow.height = 24
  wsLedger.mergeCells(`A${rowIdx}:G${rowIdx}`)
  sumRow.getCell(1).value = `TOTAL (${billsList.length} Bills)`
  sumRow.getCell(1).font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
  sumRow.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  sumRow.getCell(8).value = totalCups
  sumRow.getCell(8).numFmt = "#,##0"
  sumRow.getCell(8).alignment = { vertical: "middle", horizontal: "right" }

  sumRow.getCell(9).value = totalSub
  sumRow.getCell(9).numFmt = "#,##0.00"
  sumRow.getCell(9).alignment = { vertical: "middle", horizontal: "right" }

  sumRow.getCell(10).value = totalDisc
  sumRow.getCell(10).numFmt = "#,##0.00"
  sumRow.getCell(10).alignment = { vertical: "middle", horizontal: "right" }

  sumRow.getCell(11).value = totalGrand
  sumRow.getCell(11).numFmt = "#,##0.00"
  sumRow.getCell(11).alignment = { vertical: "middle", horizontal: "right" }

  sumRow.getCell(12).value = "-"
  sumRow.getCell(12).alignment = { vertical: "middle", horizontal: "center" }

  for (let c = 1; c <= 12; c++) {
    const cell = sumRow.getCell(c)
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.MINT_BG } }
    cell.font = { name: BRAND.FONT_FAMILY, size: 10, bold: true, color: { argb: BRAND.NAVY } }
    cell.border = {
      top: { style: "medium", color: { argb: BRAND.NAVY } },
      bottom: { style: "medium", color: { argb: BRAND.NAVY } },
      left: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
      right: { style: "thin", color: { argb: BRAND.MINT_CARD_BORDER } },
    }
  }

  // Worksheets for coffee items, daily summary, and KPIs
  wb.addWorksheet("Coffee Products")
  wb.addWorksheet("Daily Coffee Sales")
  wb.addWorksheet("Executive KPIs")

  const buffer = await wb.xlsx.writeBuffer()
  return new Uint8Array(buffer)
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
