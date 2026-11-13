"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface PosReceiptItem {
  id?: string | number
  name: string
  quantity: number
  price: number
  modifiers?: string[]
}

export interface PosSplitPaymentLine {
  id?: string
  method: string
  amount: number
  tendered?: number
  change_due?: number
  reference?: string
  customer_name?: string
}

export interface PosReceiptProps {
  brandName?: string
  brandSubtitle?: string
  brandAddress?: string
  currency?: string
  receiptNumber: string
  orderNumber: string
  tableName?: string
  cashierName?: string
  orderType?: string
  dateStr?: string
  timeStr?: string
  paymentMethod: string
  splitPayments?: PosSplitPaymentLine[]
  items: PosReceiptItem[]
  subtotal: number
  serviceCharge: number
  serviceChargeRate?: number
  discount?: number
  total: number
  cashReceived?: number
  changeAmount?: number
  className?: string
  animated?: boolean
  showBarcode?: boolean
  isGuestBill?: boolean
  onPrintAgain?: () => void
}

/** FNV-1a hash to generate consistent visual barcode pattern from receipt number */
function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function generateBarcodeBars(seed: string, count = 42): number[] {
  let h = hashSeed(seed)
  const bars: number[] = []
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
    bars.push((h % 3) + 1.2)
  }
  return bars
}

export function PosReceipt({
  brandName = "ABC COFFEE",
  brandSubtitle = "SPECIALTY COFFEE",
  brandAddress = "123, Main Street",
  currency = "LKR",
  receiptNumber,
  orderNumber,
  tableName = "04",
  cashierName = "Admin",
  orderType = "DINE_IN",
  dateStr,
  timeStr,
  paymentMethod = "CASH",
  splitPayments,
  items,
  subtotal,
  serviceCharge,
  serviceChargeRate = 0.1,
  discount = 0,
  total,
  cashReceived,
  changeAmount,
  className,
  animated = false,
  showBarcode = false,
  isGuestBill = false,
  onPrintAgain,
}: PosReceiptProps) {
  const now = new Date()
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const day = now.getDate().toString().padStart(2, "0")
  const month = monthNames[now.getMonth()]
  const year = now.getFullYear()
  const hours = now.getHours().toString().padStart(2, "0")
  const minutes = now.getMinutes().toString().padStart(2, "0")

  const displayDate = dateStr || `${day} ${month} ${year}`
  const displayTime = timeStr || `${hours}:${minutes}`
  const serviceChargePercent = Math.round((serviceChargeRate || 0.1) * 100)

  const bars = React.useMemo(() => generateBarcodeBars(receiptNumber || orderNumber), [receiptNumber, orderNumber])

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const orderNumClean = (orderNumber || "").replace(/^LS-/, "")
  const isTakeaway = (orderType || "").toLowerCase().includes("takeaway") || (tableName || "").toLowerCase() === "takeaway"
  const tableNumOnly = tableName ? tableName.replace(/^(Table|Tab)\s*/i, "").trim() : "01"
  const tableDisplay = isTakeaway
    ? "TAKEAWAY"
    : `DINE IN / TABLE ${tableNumOnly.length < 2 ? `0${tableNumOnly}` : tableNumOnly}`

  const isSplit = splitPayments && splitPayments.length > 0
  const isCash = (paymentMethod || "CASH").toUpperCase() === "CASH"

  return (
    <div
      data-receipt="true"
      data-slot="pos-receipt"
      className={cn(
        "w-full max-w-[340px] sm:max-w-[360px] mx-auto text-black font-sans text-xs select-none print:w-[72mm] print:max-w-[72mm] print:p-0 print:border-none print:shadow-none print:rounded-none",
        animated && "animate-in fade-in slide-in-from-top-4 duration-400",
        className
      )}
    >
      <article className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden print:p-2 print:border-none print:shadow-none print:rounded-none">
        {/* Top Header matching reference image */}
        <header className="text-center space-y-1">
          {/* Sleek Tilted Coffee Bean Icon */}
          <svg
            className="w-7 h-7 mx-auto text-black"
            viewBox="0 0 100 100"
            fill="currentColor"
            style={{ transform: "rotate(-22deg)" }}
          >
            <path d="M48,8 C28,10 14,28 14,50 C14,64 22,78 34,88 C38,82 40,72 40,62 C40,46 32,36 38,22 C41,15 45,10 48,8 Z" />
            <path d="M54,8 C56,12 58,18 56,26 C52,40 60,50 60,66 C60,76 56,86 52,92 C72,88 86,72 86,50 C86,30 72,12 54,8 Z" />
          </svg>
          <h2 className="font-sans text-xl font-extrabold tracking-[0.16em] uppercase text-black pt-0.5">
            {brandName}
          </h2>
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-black">
            {brandSubtitle}
          </p>
          <p className="text-[10px] text-gray-700 tracking-wide">
            {brandAddress}
          </p>
        </header>

        <div className="border-t border-black my-3" />

        {/* Order Metadata */}
        <div className="text-xs text-black space-y-0.5">
          <div className="font-extrabold tracking-wide uppercase text-sm">
            ORDER {orderNumClean}
          </div>
          <div className="font-medium tracking-wider uppercase text-[11px]">
            {tableDisplay}
          </div>
          <div className="text-[11px] text-gray-800">
            {displayDate} · {displayTime}
          </div>
          <div className="text-[11px] text-gray-800">
            Cashier: {cashierName}
          </div>
        </div>

        <div className="border-t border-black my-3" />

        {/* Table Column Header */}
        <div className="flex justify-between text-[11px] font-bold tracking-wider uppercase text-black pb-1">
          <span className="w-[14%]">QTY</span>
          <span className="flex-1 px-1">ITEM</span>
          <span className="w-[32%] text-right">{currency}</span>
        </div>

        <div className="border-t border-black my-1" />

        {/* Items List */}
        <div className="py-1 space-y-1.5 text-xs text-black">
          {items.map((item, idx) => {
            const lineTotal = item.price * item.quantity
            return (
              <div key={idx} className="flex items-baseline justify-between py-0.5">
                <span className="w-[14%] font-medium">{item.quantity}</span>
                <div className="flex-1 px-1">
                  <p className="font-medium leading-tight">{item.name}</p>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {item.modifiers.map((m) => `+ ${m}`).join(", ")}
                    </p>
                  )}
                </div>
                <span className="w-[32%] text-right font-medium tabular-nums">
                  {formatCurrency(lineTotal)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="border-t border-black my-3" />

        {/* Subtotal & Discounts Breakdown */}
        <div className="space-y-1 text-xs text-black leading-relaxed">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>

          {serviceCharge > 0 && (
            <div className="flex justify-between">
              <span>Service Charge ({serviceChargePercent}%)</span>
              <span className="tabular-nums">{formatCurrency(serviceCharge)}</span>
            </div>
          )}

          {discount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span className="tabular-nums">-{formatCurrency(discount)}</span>
            </div>
          )}
        </div>

        <div className="border-t-[1.5px] border-black my-2.5" />

        {/* TOTAL / LKR Banner */}
        <div className="flex justify-between items-baseline py-1">
          <span className="text-sm font-extrabold tracking-wider uppercase">
            TOTAL / {currency}
          </span>
          <span className="text-2xl sm:text-[26px] font-black tracking-tight tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>

        <div className="border-t-[1.5px] border-black my-2.5" />

        {/* Payment & Change Section */}
        <div className="space-y-1 text-xs text-black leading-relaxed">
          {isGuestBill ? (
            <div className="text-center font-bold text-xs uppercase tracking-wider py-1">
              PLEASE PAY AT CASHIER COUNTER
            </div>
          ) : isSplit ? (
            <>
              {splitPayments.map((sp, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{sp.method.toUpperCase()}{sp.reference ? ` (${sp.reference})` : ""}</span>
                  <span className="tabular-nums">{formatCurrency(sp.amount)}</span>
                </div>
              ))}
              {changeAmount !== undefined && changeAmount > 0 && (
                <div className="flex justify-between font-semibold">
                  <span>Change</span>
                  <span className="tabular-nums">{formatCurrency(changeAmount)}</span>
                </div>
              )}
            </>
          ) : isCash ? (
            <>
              <div className="flex justify-between">
                <span>Cash</span>
                <span className="tabular-nums">{formatCurrency(cashReceived ?? total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change</span>
                <span className="tabular-nums">{formatCurrency(changeAmount ?? 0)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span>{paymentMethod.toUpperCase()}</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change</span>
                <span className="tabular-nums">0.00</span>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-black my-3" />

        {/* Footer matching reference image */}
        <footer className="text-center pt-2 space-y-1.5 text-black">
          <p className="text-xs font-medium">Good coffee. Good day.</p>
          <p className="text-[10px] font-semibold tracking-[0.35em] uppercase text-black">
            T H A N K &nbsp; Y O U
          </p>
        </footer>

        {/* Barcode Section (if requested) */}
        {showBarcode && (
          <div className="mt-4 text-center">
            <div aria-hidden="true" className="mx-auto flex h-8 w-fit items-stretch bg-white px-2 py-0.5">
              {bars.map((w, b) => (
                <span
                  key={b}
                  className={b % 2 === 0 ? "bg-black" : "bg-transparent"}
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
            <p className="text-[10px] tracking-[0.25em] text-black uppercase mt-1 font-mono font-bold">
              *{receiptNumber || orderNumber}*
            </p>
          </div>
        )}

        {/* Print Again Button */}
        {onPrintAgain && (
          <div className="mt-5 text-center print:hidden">
            <button
              type="button"
              onClick={onPrintAgain}
              className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-lg font-bold text-xs shadow-sm transition-colors uppercase tracking-wider"
            >
              Print Receipt
            </button>
          </div>
        )}
      </article>
    </div>
  )
}
