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
  receiptNumber,
  orderNumber,
  tableName = "Table 05",
  cashierName = "System Administrator",
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
  showBarcode = true,
  isGuestBill = false,
  onPrintAgain,
}: PosReceiptProps) {
  const now = new Date()
  const displayDate = dateStr || now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  const displayTime = timeStr || now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  const serviceChargePercent = Math.round((serviceChargeRate || 0.1) * 100)

  const bars = React.useMemo(() => generateBarcodeBars(receiptNumber || orderNumber), [receiptNumber, orderNumber])

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const titleHeader = isGuestBill ? "GUEST BILL / TABLE CHECK" : "TAX INVOICE / RECEIPT"
  const subtitleNotice = isGuestBill
    ? "PLEASE PAY AT CASHIER COUNTER OR TO FLOOR SERVER"
    : "PAYMENT COMPLETED & SETTLED"

  const paymentFormatted =
    splitPayments && splitPayments.length > 0
      ? "SPLIT / MIXED TENDER"
      : paymentMethod === "qr" || paymentMethod === "transfer"
      ? "LANKA QR / DIGITAL"
      : (paymentMethod || "CASH").toUpperCase()

  const orderTypeFormatted = (orderType || "DINE_IN").toUpperCase().replace("-", "_")

  return (
    <div
      data-receipt="true"
      data-slot="pos-receipt"
      className={cn(
        "w-full max-w-[340px] sm:max-w-[360px] mx-auto text-black font-mono text-xs select-none",
        animated && "animate-in fade-in slide-in-from-top-4 duration-400",
        className
      )}
    >
      <article className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden">
        {/* Top Header */}
        <header className="text-center space-y-0.5">
          <h2 className="font-sans text-xl sm:text-2xl font-black tracking-[0.18em] uppercase text-black">
            RESTAURANT &amp; BAR
          </h2>
          <p className="text-[11px] font-extrabold tracking-[0.16em] uppercase text-black">
            POINT OF SALE RECEIPT
          </p>
          <p className="text-[10px] tracking-wide text-gray-600 italic">
            Tropical Bites &amp; Specialty Coffee
          </p>
          <p className="text-[9px] text-gray-500">
            Beach Road, Hiriketiya Bay · Tel: +94 41 227 1122
          </p>
          <div className="pt-1">
            <span className="inline-block bg-black text-white text-[10px] sm:text-[11px] font-black px-3 py-1 rounded tracking-wider uppercase">
              {titleHeader}
            </span>
          </div>
        </header>

        <DashedRule className="my-2.5" />

        {/* Chit Metadata (2 Column Clean Grid) */}
        <div className="text-[11px] leading-relaxed text-black space-y-0.5">
          <div className="flex justify-between items-baseline">
            <span>Receipt #: <strong>{receiptNumber || orderNumber}</strong></span>
            <span className="text-right">Order #: <strong>{orderNumber}</strong></span>
          </div>
          <div className="flex justify-between items-baseline">
            <span>Table: <strong>{tableName || "Takeaway"}</strong></span>
            <span className="text-right">Type: <strong>{orderTypeFormatted}</strong></span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="truncate max-w-[55%]">Cashier: {cashierName}</span>
            <span className="text-right">{displayDate} {displayTime}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span>Payment: <strong>{paymentFormatted}</strong></span>
          </div>
        </div>

        <DashedRule className="my-2.5" />

        {/* Items Table Header */}
        <div className="flex justify-between text-[10px] font-extrabold tracking-wider uppercase text-black pb-1 border-b border-dashed border-gray-400">
          <span className="w-[14%]">QTY</span>
          <span className="w-[52%]">ITEM DESCRIPTION</span>
          <span className="w-[34%] text-right">TOTAL (RS.)</span>
        </div>

        {/* Items List */}
        <div className="divide-y divide-gray-100 py-1">
          {items.map((item, idx) => {
            const lineTotal = item.price * item.quantity
            return (
              <div key={idx} className="py-1 text-xs">
                <div className="flex items-start justify-between">
                  <span className="w-[14%] font-bold text-black">{item.quantity}x</span>
                  <div className="w-[52%] pr-1">
                    <p className="font-bold text-black leading-tight">{item.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono">@ Rs. {formatCurrency(item.price)} ea</p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="text-[9.5px] text-gray-500 space-y-0.5 mt-0.5">
                        {item.modifiers.map((mod, mIdx) => (
                          <p key={mIdx}>+ {mod}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="w-[34%] text-right font-bold text-black font-mono">
                    Rs. {formatCurrency(lineTotal)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <DashedRule className="my-2.5" />

        {/* Totals Breakdown */}
        <div className="space-y-1 text-xs text-black">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-mono">Rs. {formatCurrency(subtotal)}</span>
          </div>

          <div className="flex justify-between">
            <span>Hospitality Service Charge ({serviceChargePercent}%)</span>
            <span className="font-mono">Rs. {formatCurrency(serviceCharge)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between font-semibold">
              <span>Discount Applied</span>
              <span className="font-mono">-Rs. {formatCurrency(discount)}</span>
            </div>
          )}
        </div>

        {/* TOTAL DUE Solid Border Box */}
        <div className="border-2 border-black p-2 my-2.5 flex justify-between items-baseline font-black">
          <span className="text-xs sm:text-sm tracking-wider uppercase">TOTAL DUE</span>
          <span className="font-mono text-base sm:text-lg">
            Rs. {formatCurrency(total)}
          </span>
        </div>

        {/* Split Payments Breakdown or Single Cash Tendered & Change */}
        {splitPayments && splitPayments.length > 0 ? (
          <div className="space-y-1.5 text-xs text-black py-1 border-t border-dashed border-gray-400 mt-2">
            <div className="flex justify-between font-black text-[10px] tracking-wider uppercase text-black">
              <span>SPLIT TENDER SETTLEMENT</span>
              <span>{splitPayments.length} PAYMENTS</span>
            </div>
            {splitPayments.map((sp, idx) => (
              <div key={idx} className="space-y-0.5 bg-gray-50 p-2 rounded-lg border border-gray-200">
                <div className="flex justify-between font-bold">
                  <span>
                    • {sp.method.toUpperCase()}
                    {sp.reference ? ` [${sp.reference}]` : ""}
                    {sp.customer_name ? ` (${sp.customer_name})` : ""}
                  </span>
                  <span className="font-mono">Rs. {formatCurrency(sp.amount)}</span>
                </div>
                {sp.method.toLowerCase() === "cash" && sp.tendered && sp.tendered > sp.amount && (
                  <div className="flex justify-between text-[10px] text-gray-600 pl-2">
                    <span>Tendered: Rs. {formatCurrency(sp.tendered)}</span>
                    <span className="font-semibold text-emerald-700">
                      Change: Rs. {formatCurrency(sp.change_due ?? (sp.tendered - sp.amount))}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {changeAmount !== undefined && changeAmount > 0 && (
              <div className="flex justify-between font-black text-xs pt-1.5 border-t border-gray-300">
                <span>TOTAL CHANGE RETURNED:</span>
                <span className="font-mono text-emerald-800">Rs. {formatCurrency(changeAmount)}</span>
              </div>
            )}
          </div>
        ) : (
          paymentMethod.toUpperCase() === "CASH" && (cashReceived !== undefined || (total > 0 && !isGuestBill)) && (
            <div className="space-y-1 text-xs text-black py-0.5">
              <div className="flex justify-between">
                <span>Cash Tendered:</span>
                <span className="font-mono font-bold">Rs. {formatCurrency(cashReceived ?? total)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Change Returned:</span>
                <span className="font-mono">Rs. {formatCurrency(changeAmount ?? 0)}</span>
              </div>
            </div>
          )
        )}

        {/* Double Solid Line */}
        <div className="border-t-2 border-b border-black h-[3px] my-3" />

        {/* Footer */}
        <footer className="text-center space-y-1 text-[10px] text-gray-700">
          <p className="font-black text-[11px] text-black tracking-wide">*** THANK YOU FOR DINING WITH US ***</p>
          <p className="font-semibold uppercase text-black">{subtitleNotice}</p>
          <p>Free WiFi: <strong>GuestWiFi</strong> · Pass: <strong>welcome2026</strong></p>
          <p>Customer Support: support@posdemo.com</p>
        </footer>

        {/* Barcode Section */}
        {showBarcode && (
          <div className="mt-3 text-center">
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
          <div className="mt-4 text-center print:hidden">
            <button
              type="button"
              onClick={onPrintAgain}
              className="bg-[#244f3d] hover:bg-[#1a382b] text-white px-6 py-2 rounded-lg font-bold text-xs shadow-sm transition-colors"
            >
              Print Again
            </button>
          </div>
        )}
      </article>
    </div>
  )
}

function DashedRule({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("border-t border-dashed border-gray-400 w-full", className)} />
}
