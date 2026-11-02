"use client"

import * as React from "react"
import { PosReceipt, type PosReceiptItem } from "./pos-receipt"

export type ReceiptPeriod = "monthly" | "yearly"

export interface ReceiptItem {
  label: string
  value: string
}

export interface ReceiptPlan {
  id: string
  name: string
  tagline?: string
  monthly: number
  yearly?: number
  items: ReceiptItem[]
  cta?: string
  featured?: boolean
}

export interface ReceiptPricingProps extends React.ComponentProps<"section"> {
  plans: ReceiptPlan[]
  period?: ReceiptPeriod
  defaultPeriod?: ReceiptPeriod
  onPeriodChange?: (period: ReceiptPeriod) => void
  onSelectPlan?: (plan: ReceiptPlan, period: ReceiptPeriod) => void
  monthsFree?: number
  currency?: string
  locale?: string
  merchant?: string
  merchantNote?: string
  orderPrefix?: string
  periodLabels?: [string, string]
  stampLabel?: string
  showStamp?: boolean
  showBarcode?: boolean
  printOnReveal?: boolean
  printMs?: number
  tearMs?: number
  stagger?: number
  toothWidth?: number
  toothDepth?: number
  grain?: number
  children?: React.ReactNode
}

export function ReceiptPricing({
  plans,
  merchant = "LAZY SUNDAY",
  children,
  ...rest
}: ReceiptPricingProps) {
  return (
    <section className="w-full" {...rest}>
      {children}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {plans.map((p) => {
          const items: PosReceiptItem[] = p.items.map((it) => ({
            name: it.label,
            quantity: 1,
            price: Number(it.value) || p.monthly,
          }))
          return (
            <PosReceipt
              key={p.id}
              orderNumber={`CFJ-${p.id.toUpperCase()}`}
              receiptNumber={`CFJ-RC-${p.id.toUpperCase()}`}
              paymentMethod="CARD"
              items={items}
              subtotal={p.monthly}
              serviceCharge={p.monthly * 0.1}
              total={p.monthly * 1.1}
            />
          )
        })}
      </div>
    </section>
  )
}

export function ReceiptSlip(props: any) {
  return <PosReceipt {...props} />
}

export default ReceiptPricing
