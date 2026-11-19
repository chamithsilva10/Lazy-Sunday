"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Split,
  Users,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Banknote,
  CreditCard,
  QrCode,
  Landmark,
  UserCheck,
  RotateCcw,
  Printer,
  CheckCircle2,
  Percent,
  ShoppingBag,
  Coins,
  Edit2,
} from "lucide-react"
import {
  type SplitMethod,
  type SplitDiner,
  type SplitItemAssignment,
  type SplitPaymentRecord,
  type OrderSplitConfig,
  type DinerCalculatedShare,
  roundCurrency,
  allocateProportionally,
  calculateSplitBillSummary,
} from "@/lib/split-bill-utils"
import type { SharedCustomer } from "@/lib/shared-pos-service"
import { toast } from "sonner"

export interface SplitBillCartItem {
  id: string
  cartItemId?: string
  name: string
  price: number
  quantity: number
  modifiers?: string[]
  notes?: string
}

export interface SplitBillModalProps {
  isOpen?: boolean
  open?: boolean
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  orderNumber: string
  tableName: string
  items: SplitBillCartItem[]
  subtotal: number
  discount: number
  serviceCharge: number
  serviceChargeRate?: number
  tax: number
  isTaxIncluded?: boolean
  total: number
  customers: SharedCustomer[]
  existingSplitConfig?: OrderSplitConfig | null
  initialSplitConfig?: OrderSplitConfig | null
  onSaveSplitOrder: (config: OrderSplitConfig, finalizeAsPaid: boolean) => Promise<void> | void
  onPrintSplitBill?: (config: OrderSplitConfig) => void
}

export function SplitBillModal({
  isOpen: propIsOpen,
  open: propOpen,
  onClose: propOnClose,
  onOpenChange: propOnOpenChange,
  orderNumber,
  tableName,
  items,
  subtotal,
  discount,
  serviceCharge,
  serviceChargeRate,
  tax,
  isTaxIncluded,
  total,
  customers,
  existingSplitConfig,
  initialSplitConfig,
  onSaveSplitOrder,
  onPrintSplitBill,
}: SplitBillModalProps) {
  const isModalOpen = propOpen !== undefined ? propOpen : Boolean(propIsOpen)
  const handleClose = () => {
    if (propOnOpenChange) propOnOpenChange(false)
    if (propOnClose) propOnClose()
  }
  const effectiveInitialConfig = existingSplitConfig || initialSplitConfig || null
  const [method, setMethod] = useState<SplitMethod>("by_items")
  const [diners, setDiners] = useState<SplitDiner[]>([
    { id: "diner-1", name: "Person 1", percentage: 50, fixed_amount: 0 },
    { id: "diner-2", name: "Person 2", percentage: 50, fixed_amount: 0 },
  ])
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">("none")
  const [discountValueInput, setDiscountValueInput] = useState<string>("")
  const [itemAssignments, setItemAssignments] = useState<Record<string, SplitItemAssignment>>({})
  const [payments, setPayments] = useState<SplitPaymentRecord[]>([])
  const [splitConfirmed, setSplitConfirmed] = useState(false)
  // Allow expanding multi-qty items into individual units for granular per-unit assignment
  const [expandedItemKeys, setExpandedItemKeys] = useState<Record<string, boolean>>({})

  // Active Diner Payment Drawer State
  const [payingDinerId, setPayingDinerId] = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "qr" | "bank_transfer" | "credit">("cash")
  const [payAmountInput, setPayAmountInput] = useState("")
  const [cashTenderedInput, setCashTenderedInput] = useState("")
  const [payReference, setPayReference] = useState("")
  const [payCustomerId, setPayCustomerId] = useState("")
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

  // Normalize assignable items (expanding any item whose base key is in expandedItemKeys)
  const assignableItems = useMemo(() => {
    const list: {
      key: string
      baseKey: string
      name: string
      quantity: number
      price: number
      modifiers?: string[]
      canExpand: boolean
      isExpandedUnit: boolean
    }[] = []

    items.forEach((it, idx) => {
      const baseKey = String(it.cartItemId || it.id || `item-${idx}`)
      const qty = Math.max(1, Number(it.quantity) || 1)
      if (qty > 1 && expandedItemKeys[baseKey]) {
        for (let u = 1; u <= qty; u++) {
          list.push({
            key: `${baseKey}__unit_${u}`,
            baseKey,
            name: `${it.name} (Unit ${u} of ${qty})`,
            quantity: 1,
            price: Number(it.price) || 0,
            modifiers: it.modifiers,
            canExpand: false,
            isExpandedUnit: true,
          })
        }
      } else {
        list.push({
          key: baseKey,
          baseKey,
          name: it.name,
          quantity: qty,
          price: Number(it.price) || 0,
          modifiers: it.modifiers,
          canExpand: qty > 1,
          isExpandedUnit: false,
        })
      }
    })
    return list
  }, [items, expandedItemKeys])

  // Initialize state when modal opens
  useEffect(() => {
    if (!isModalOpen) return

    if (effectiveInitialConfig && effectiveInitialConfig.diners?.length >= 2) {
      setMethod(effectiveInitialConfig.method || "by_items")
      setDiners(effectiveInitialConfig.diners)
      setItemAssignments(effectiveInitialConfig.item_assignments || {})
      setPayments(effectiveInitialConfig.payments || [])
      setSplitConfirmed(Boolean(effectiveInitialConfig.confirmed))
      setPayingDinerId(null)
      if (effectiveInitialConfig.discount_type) {
        setDiscountType(effectiveInitialConfig.discount_type)
        setDiscountValueInput(
          effectiveInitialConfig.discount_value !== undefined && effectiveInitialConfig.discount_value > 0
            ? String(effectiveInitialConfig.discount_value)
            : ""
        )
      } else if (discount > 0) {
        setDiscountType("fixed")
        setDiscountValueInput(String(discount))
      } else {
        setDiscountType("none")
        setDiscountValueInput("")
      }
      return
    }

    // Default fresh split initialization
    const originalBillTotal = roundCurrency(subtotal + serviceCharge + tax > 0 ? subtotal + serviceCharge + tax : total)
    let initialDiscVal = 0
    if (discount > 0) {
      initialDiscVal = roundCurrency(discount)
      setDiscountType("fixed")
      setDiscountValueInput(String(discount))
    } else {
      setDiscountType("none")
      setDiscountValueInput("")
    }
    const initialFinalTotal = Math.max(0, roundCurrency(originalBillTotal - initialDiscVal))
    const evenAmounts = allocateProportionally(initialFinalTotal, [1, 1])
    const defaultDiners: SplitDiner[] = [
      { id: "diner-1", name: "Person 1", percentage: 50, fixed_amount: evenAmounts[0] || 0 },
      { id: "diner-2", name: "Person 2", percentage: 50, fixed_amount: evenAmounts[1] || 0 },
    ]
    setDiners(defaultDiners)
    setMethod("by_items")
    setPayments([])
    setSplitConfirmed(false)
    setPayingDinerId(null)
    setExpandedItemKeys({})

    // Pre-assign items alternating across the 2 default diners so staff see immediate example & can adjust freely
    const initialMap: Record<string, SplitItemAssignment> = {}
    items.forEach((it, idx) => {
      const key = String(it.cartItemId || it.id || `item-${idx}`)
      const targetDiner = defaultDiners[idx % defaultDiners.length]
      initialMap[key] = {
        item_key: key,
        item_name: it.name,
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.price) || 0,
        line_total: roundCurrency((Number(it.price) || 0) * (Number(it.quantity) || 1)),
        mode: "single",
        single_diner_id: targetDiner.id,
        shared_diner_ids: defaultDiners.map((d) => d.id),
        custom_shares: Object.fromEntries(defaultDiners.map((d) => [d.id, 1])),
        custom_share_type: "portions",
      }
    })
    setItemAssignments(initialMap)
  }, [isModalOpen, effectiveInitialConfig?.updated_at])

  // Ensure all assignableItems have an entry in itemAssignments
  useEffect(() => {
    if (!isModalOpen) return
    setItemAssignments((prev) => {
      const next = { ...prev }
      let changed = false
      assignableItems.forEach((it, idx) => {
        if (!next[it.key]) {
          changed = true
          const targetDiner = diners[idx % Math.max(1, diners.length)]
          next[it.key] = {
            item_key: it.key,
            item_name: it.name,
            quantity: it.quantity,
            unit_price: it.price,
            line_total: roundCurrency(it.price * it.quantity),
            mode: "single",
            single_diner_id: targetDiner?.id,
            shared_diner_ids: diners.map((d) => d.id),
            custom_shares: Object.fromEntries(diners.map((d) => [d.id, 1])),
            custom_share_type: "portions",
          }
        }
      })
      return changed ? next : prev
    })
  }, [assignableItems, diners, isModalOpen])

  const chargesTotal = useMemo(() => roundCurrency(serviceCharge + tax), [serviceCharge, tax])
  const originalBillTotal = useMemo(
    () => roundCurrency(subtotal + chargesTotal > 0 ? subtotal + chargesTotal : total),
    [subtotal, chargesTotal, total]
  )

  const parsedDiscountValue = useMemo(() => {
    if (discountType === "none") return 0
    const val = parseFloat(discountValueInput)
    return isNaN(val) ? 0 : Math.max(0, val)
  }, [discountType, discountValueInput])

  const splitSummary = useMemo(() => {
    return calculateSplitBillSummary({
      method,
      diners,
      items: assignableItems,
      itemAssignments,
      payments,
      subtotal,
      discount: parsedDiscountValue,
      charges: chargesTotal,
      total,
      originalTotal: originalBillTotal,
      discountType,
      discountValue: parsedDiscountValue,
    })
  }, [
    method,
    diners,
    assignableItems,
    itemAssignments,
    payments,
    subtotal,
    parsedDiscountValue,
    chargesTotal,
    total,
    originalBillTotal,
    discountType,
  ])

  const activePayingDinerShare = useMemo(() => {
    if (!payingDinerId) return null
    return splitSummary.dinerShares.find((ds) => ds.diner_id === payingDinerId) || null
  }, [payingDinerId, splitSummary.dinerShares])

  function handleAddDiner() {
    const nextNum = diners.length + 1
    const newId = `diner-${Date.now()}-${nextNum}`
    const newDiner: SplitDiner = {
      id: newId,
      name: `Person ${nextNum}`,
      percentage: 0,
      fixed_amount: 0,
    }
    const nextDiners = [...diners, newDiner]
    setDiners(nextDiners)
    setSplitConfirmed(false)
  }

  function handleRemoveDiner(dinerId: string) {
    if (diners.length <= 2) {
      toast.error("At least 2 people are required to split a bill.")
      return
    }
    const hasPaid = payments.some(
      (p) => p.diner_id === dinerId && p.status !== "refunded" && p.status !== "voided"
    )
    if (hasPaid) {
      toast.error("Cannot remove a diner who has already made a payment. Refund/void their payment first.")
      return
    }
    const remainingDiners = diners.filter((d) => d.id !== dinerId)
    setDiners(remainingDiners)
    setSplitConfirmed(false)

    // Reassign any single items owned by removed diner to first diner
    setItemAssignments((prev) => {
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        const a = next[k]
        if (a.single_diner_id === dinerId) {
          next[k] = { ...a, single_diner_id: remainingDiners[0]?.id }
        }
        if (a.shared_diner_ids?.includes(dinerId)) {
          const filtered = a.shared_diner_ids.filter((id) => id !== dinerId)
          next[k] = {
            ...a,
            shared_diner_ids: filtered.length > 0 ? filtered : [remainingDiners[0]?.id],
          }
        }
      }
      return next
    })
  }

  function handleRenameDiner(dinerId: string, newName: string) {
    setDiners((prev) =>
      prev.map((d) => (d.id === dinerId ? { ...d, name: newName } : d))
    )
  }

  function handleDistributePercentageEvenly() {
    const count = diners.length
    if (count === 0) return
    const basePct = Math.floor((100 / count) * 100) / 100
    const remPct = roundCurrency(100 - basePct * count)
    setDiners((prev) =>
      prev.map((d, idx) => ({
        ...d,
        percentage: idx === count - 1 ? roundCurrency(basePct + remPct) : basePct,
      }))
    )
    setSplitConfirmed(false)
  }

  function handleDistributeAmountEvenly() {
    const count = diners.length
    if (count === 0) return
    const targetTotal = splitSummary.finalTotal
    const evenShares = allocateProportionally(targetTotal, new Array(count).fill(1))
    setDiners((prev) =>
      prev.map((d, idx) => ({
        ...d,
        fixed_amount: evenShares[idx],
      }))
    )
    setSplitConfirmed(false)
  }

  function handleFillRemainingAmount(dinerId: string) {
    const targetTotal = splitSummary.finalTotal
    const otherSum = diners
      .filter((d) => d.id !== dinerId)
      .reduce((acc, d) => acc + (Number(d.fixed_amount) || 0), 0)
    const rem = Math.max(0, roundCurrency(targetTotal - otherSum))
    setDiners((prev) =>
      prev.map((d) => (d.id === dinerId ? { ...d, fixed_amount: rem } : d))
    )
    setSplitConfirmed(false)
  }

  function handleFillRemainingPercentage(dinerId: string) {
    const otherSum = diners
      .filter((d) => d.id !== dinerId)
      .reduce((acc, d) => acc + (Number(d.percentage) || 0), 0)
    const rem = Math.max(0, roundCurrency(100 - otherSum))
    setDiners((prev) =>
      prev.map((d) => (d.id === dinerId ? { ...d, percentage: rem } : d))
    )
    setSplitConfirmed(false)
  }

  function updateItemAssignment(key: string, patch: Partial<SplitItemAssignment>) {
    setSplitConfirmed(false)
    setItemAssignments((prev) => {
      const existing = prev[key]
      if (!existing) return prev
      return {
        ...prev,
        [key]: {
          ...existing,
          ...patch,
        },
      }
    })
  }

  function toggleExpandUnits(baseKey: string, expand: boolean) {
    setSplitConfirmed(false)
    setExpandedItemKeys((prev) => ({ ...prev, [baseKey]: expand }))
    setItemAssignments((prev) => {
      const next = { ...prev }
      if (expand) {
        delete next[baseKey]
      } else {
        Object.keys(next).forEach((k) => {
          if (k.startsWith(`${baseKey}__unit_`)) {
            delete next[k]
          }
        })
      }
      return next
    })
  }

  function handleConfirmSplit() {
    if (!splitSummary.isValidSplit) {
      toast.error(splitSummary.validationErrors[0] || "Please resolve split validation errors first.")
      return
    }
    setSplitConfirmed(true)
    toast.success("Bill split confirmed! Each person can now pay their share separately.")
  }

  function openDinerPaymentDrawer(dinerShare: DinerCalculatedShare) {
    if (!splitSummary.isValidSplit) {
      toast.error(splitSummary.validationErrors[0] || "Please complete the bill split configuration first.")
      return
    }
    setSplitConfirmed(true)
    setPayingDinerId(dinerShare.diner_id)
    setPayMethod("cash")
    setPayAmountInput(String(dinerShare.remaining_balance))
    setCashTenderedInput(String(dinerShare.remaining_balance))
    setPayReference("")
    setPayCustomerId("")
  }

  function buildOrderSplitConfig(
    nextPayments: SplitPaymentRecord[],
    confirmedFlag: boolean
  ): OrderSplitConfig {
    const calc = calculateSplitBillSummary({
      method,
      diners,
      items: assignableItems,
      itemAssignments,
      payments: nextPayments,
      subtotal,
      discount: parsedDiscountValue,
      charges: chargesTotal,
      total,
      originalTotal: originalBillTotal,
      discountType,
      discountValue: parsedDiscountValue,
    })

    return {
      method,
      confirmed: confirmedFlag,
      diners,
      item_assignments: itemAssignments,
      diner_shares: calc.dinerShares,
      payments: nextPayments,
      original_total: calc.originalTotal,
      discount_type: calc.discountType,
      discount_value: calc.discountValue,
      discount_amount: calc.discountAmount,
      final_total: calc.finalTotal,
      total_bill: calc.finalTotal,
      total_paid: calc.totalPaid,
      total_remaining: calc.totalRemaining,
      updated_at: new Date().toISOString(),
    }
  }

  async function handleRecordDinerPayment() {
    if (!activePayingDinerShare || isSubmittingPayment) return

    const amountToPay = roundCurrency(Number(payAmountInput) || 0)
    const maxPayable = roundCurrency(activePayingDinerShare.remaining_balance)

    if (amountToPay <= 0) {
      toast.error("Enter a valid payment amount greater than LKR 0.")
      return
    }

    if (amountToPay > maxPayable + 0.01) {
      toast.error(
        `Overpayment prevented: ${activePayingDinerShare.diner_name} only owes LKR ${maxPayable.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`
      )
      return
    }

    let tendered = amountToPay
    let changeDue = 0

    if (payMethod === "cash") {
      tendered = roundCurrency(Number(cashTenderedInput) || 0)
      if (tendered < amountToPay - 0.01) {
        toast.error(
          `Cash tendered (LKR ${tendered.toLocaleString()}) is less than the payment amount (LKR ${amountToPay.toLocaleString()}).`
        )
        return
      }
      changeDue = Math.max(0, roundCurrency(tendered - amountToPay))
    } else if (payMethod === "card") {
      if (!payReference.trim()) {
        toast.error("Please enter the card terminal approval / reference code.")
        return
      }
    } else if (payMethod === "bank_transfer") {
      if (!payReference.trim()) {
        toast.error("Please enter the bank transfer slip / reference number.")
        return
      }
    } else if (payMethod === "credit") {
      if (!payCustomerId) {
        toast.error("Please select a customer account for Credit settlement.")
        return
      }
      const cust = customers.find((c) => c.id === payCustomerId)
      if (cust && cust.credit_balance + amountToPay > cust.credit_limit) {
        toast.error(`Credit limit exceeded for ${cust.name}.`)
        return
      }
    }

    const selectedCustomer = customers.find((c) => c.id === payCustomerId)

    const newPayment: SplitPaymentRecord = {
      id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      diner_id: activePayingDinerShare.diner_id,
      diner_name: activePayingDinerShare.diner_name,
      method: payMethod,
      amount: amountToPay,
      tendered: payMethod === "cash" ? tendered : amountToPay,
      change_due: payMethod === "cash" ? changeDue : 0,
      reference: payReference.trim() || undefined,
      customer_id: payMethod === "credit" ? payCustomerId : undefined,
      customer_name: payMethod === "credit" ? selectedCustomer?.name : activePayingDinerShare.diner_name,
      status: "paid",
      paid_at: new Date().toISOString(),
    }

    const nextPayments = [...payments, newPayment]
    setPayments(nextPayments)
    setPayingDinerId(null)

    const nextConfig = buildOrderSplitConfig(nextPayments, true)
    const isNowFullyPaid = nextConfig.total_remaining <= 0.01

    setIsSubmittingPayment(true)
    try {
      await onSaveSplitOrder(nextConfig, isNowFullyPaid)
      if (isNowFullyPaid) {
        toast.success("All diner shares have been paid! Bill marked as PAID.")
      } else {
        toast.success(
          `Recorded LKR ${amountToPay.toLocaleString()} from ${activePayingDinerShare.diner_name}. Remaining unpaid balance: LKR ${nextConfig.total_remaining.toLocaleString()}.`
        )
      }
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  async function handleRefundDinerPayment(paymentId: string) {
    const target = payments.find((p) => p.id === paymentId)
    if (!target || target.status === "refunded" || target.status === "voided") return

    const nextPayments = payments.map((p) =>
      p.id === paymentId
        ? {
            ...p,
            status: "refunded" as const,
            refunded_at: new Date().toISOString(),
            refund_reason: `Refunded share for ${p.diner_name || "Diner"}`,
          }
        : p
    )
    setPayments(nextPayments)
    const nextConfig = buildOrderSplitConfig(nextPayments, true)
    await onSaveSplitOrder(nextConfig, false)
    toast.success(
      `Refunded LKR ${target.amount.toLocaleString()} payment for ${target.diner_name || "Diner"}. Share is now unpaid.`
    )
  }

  async function handleSaveOpenSplit() {
    if (!splitSummary.isValidSplit) {
      toast.error(splitSummary.validationErrors[0] || "Complete the split allocation before saving.")
      return
    }
    const config = buildOrderSplitConfig(payments, true)
    setSplitConfirmed(true)
    await onSaveSplitOrder(config, config.total_remaining <= 0.01)
    toast.success("Split bill saved on open order.")
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="w-[96vw] sm:max-w-3xl lg:max-w-5xl max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-[#E5D8CF] bg-[#FAF5F1] shadow-2xl [&>button:last-child]:text-white [&>button:last-child]:opacity-90 [&>button:last-child]:hover:opacity-100 [&>button:last-child]:top-4 [&>button:last-child]:right-4">
        {/* TOP HEADER */}
        <DialogHeader className="bg-[#808068] text-white p-4 sm:p-5 pr-12 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="font-serif text-lg sm:text-xl text-white flex items-center gap-2">
                <Split className="size-5 text-[#EAB8B5]" />
                FLEXIBLE BILL SPLITTING &amp; PAYMENTS
              </DialogTitle>
              <DialogDescription className="text-xs text-[#F4EBE4]/85 mt-0.5">
                Order #{orderNumber} • {tableName} • Final Bill Total: LKR {splitSummary.finalTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/15 text-white border border-white/25 font-mono text-xs px-2.5 py-1">
                Paid: LKR {splitSummary.totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Badge>
              <Badge
                className={`font-mono text-xs px-2.5 py-1 border-0 ${
                  splitSummary.totalRemaining <= 0.01
                    ? "bg-emerald-500 text-white"
                    : "bg-[#D67B6B] text-white"
                }`}
              >
                Unpaid: LKR {splitSummary.totalRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 1. SPLIT METHOD SELECTOR + PEOPLE BAR */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5D8CF] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#343428]">
                  1. Choose Split Method
                </p>
                <p className="text-[11px] text-gray-500">
                  Taxes, service charges, and discounts are applied proportionally and rounded to match LKR {splitSummary.finalTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1.5 bg-[#FAF5F1] p-1 rounded-xl border border-[#E5D8CF]">
                <button
                  type="button"
                  onClick={() => {
                    setMethod("by_items")
                    setSplitConfirmed(false)
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    method === "by_items"
                      ? "bg-[#D67B6B] text-white shadow-xs"
                      : "text-[#545442] hover:bg-white"
                  }`}
                >
                  <ShoppingBag className="size-3.5 shrink-0" />
                  <span>By Products</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMethod("by_percentage")
                    setSplitConfirmed(false)
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    method === "by_percentage"
                      ? "bg-[#D67B6B] text-white shadow-xs"
                      : "text-[#545442] hover:bg-white"
                  }`}
                >
                  <Percent className="size-3.5 shrink-0" />
                  <span>By Percentage</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMethod("by_amount")
                    setSplitConfirmed(false)
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    method === "by_amount"
                      ? "bg-[#D67B6B] text-white shadow-xs"
                      : "text-[#545442] hover:bg-white"
                  }`}
                >
                  <Coins className="size-3.5 shrink-0" />
                  <span>By LKR Amount</span>
                </button>
              </div>
            </div>

            {/* PEOPLE ON THIS BILL ROW */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#808068] flex items-center gap-1.5">
                  <Users className="size-3.5 text-[#D67B6B]" />
                  People on this Bill ({diners.length})
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddDiner}
                  className="h-8 text-xs rounded-xl border-[#D67B6B]/40 text-[#D67B6B] hover:bg-[#FAF5F1] gap-1 font-semibold"
                >
                  <Plus className="size-3.5" />
                  Add Person
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {diners.map((diner, idx) => {
                  const share = splitSummary.dinerShares[idx]
                  const hasPaid = (share?.amount_paid || 0) > 0
                  return (
                    <div
                      key={diner.id}
                      className="flex items-center gap-1.5 bg-[#FAF5F1] border border-[#E5D8CF] rounded-xl px-2.5 py-1.5"
                    >
                      <span className="size-5 rounded-full bg-[#808068] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={diner.name}
                        aria-label={`Person ${idx + 1} Name`}
                        onChange={(e) => handleRenameDiner(diner.id, e.target.value)}
                        className="w-24 sm:w-28 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#D67B6B]"
                      />
                      {diners.length > 2 && !hasPaid && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDiner(diner.id)}
                          title={`Remove ${diner.name}`}
                          className="text-gray-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* BILL DISCOUNT & FINANCIAL BASE */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5D8CF] shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#343428] flex items-center gap-1.5">
                  <Percent className="size-3.5 text-[#D67B6B]" />
                  Bill Discount &amp; Allocation Base
                </p>
                <p className="text-[11px] text-gray-500">
                  Apply percentage or fixed LKR discount before allocating shares. Distributed proportionally across shares.
                </p>
              </div>
              {/* Discount Type Selector */}
              <div className="grid grid-cols-3 gap-1 bg-[#FAF5F1] p-1 rounded-xl border border-[#E5D8CF] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType("none")
                    setDiscountValueInput("")
                    setSplitConfirmed(false)
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    discountType === "none"
                      ? "bg-[#808068] text-white shadow-xs"
                      : "text-[#545442] hover:bg-white"
                  }`}
                >
                  No Discount
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType("percent")
                    setSplitConfirmed(false)
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    discountType === "percent"
                      ? "bg-[#D67B6B] text-white shadow-xs"
                      : "text-[#545442] hover:bg-white"
                  }`}
                >
                  % Percentage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType("fixed")
                    setSplitConfirmed(false)
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    discountType === "fixed"
                      ? "bg-[#D67B6B] text-white shadow-xs"
                      : "text-[#545442] hover:bg-white"
                  }`}
                >
                  Fixed LKR
                </button>
              </div>
            </div>

            {/* Discount Input & Preset Chips */}
            {discountType !== "none" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF5F1]/60 p-3 rounded-xl border border-[#E5D8CF]">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700 whitespace-nowrap">
                    {discountType === "percent" ? "Discount Rate:" : "Discount Amount:"}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {discountType === "fixed" && <span className="text-xs font-bold text-gray-500">LKR</span>}
                    <Input
                      type="number"
                      min="0"
                      max={discountType === "percent" ? 100 : splitSummary.originalTotal}
                      step={discountType === "percent" ? "1" : "50"}
                      placeholder={discountType === "percent" ? "10" : "500"}
                      value={discountValueInput}
                      onChange={(e) => {
                        setDiscountValueInput(e.target.value)
                        setSplitConfirmed(false)
                      }}
                      className="w-28 h-9 text-right font-mono font-bold text-sm bg-white border-[#E5D8CF] rounded-lg"
                    />
                    {discountType === "percent" && <span className="text-xs font-bold text-gray-500">%</span>}
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold text-gray-500">Quick presets:</span>
                  {(discountType === "percent" ? [5, 10, 15, 20] : [250, 500, 1000, 2000]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setDiscountValueInput(String(preset))
                        setSplitConfirmed(false)
                      }}
                      className="px-2 py-1 rounded-md bg-white border border-[#E5D8CF] text-[11px] font-bold text-[#808068] hover:border-[#D67B6B] hover:text-[#D67B6B] transition-colors"
                    >
                      {discountType === "percent" ? `${preset}%` : `LKR ${preset}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Real-time Financial Breakdown Banner */}
            <div className="grid grid-cols-3 gap-2 bg-[#FAF5F1] p-3 rounded-xl border border-[#E5D8CF] text-center">
              <div className="p-1">
                <p className="text-[10px] uppercase font-bold text-gray-500">Original Total</p>
                <p className="font-mono text-xs sm:text-sm font-bold text-[#343428] mt-0.5">
                  LKR {splitSummary.originalTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-1 border-x border-[#E5D8CF]">
                <p className="text-[10px] uppercase font-bold text-red-600">
                  Discount {splitSummary.discountType === "percent" && splitSummary.discountValue > 0 ? `(${splitSummary.discountValue}%)` : ""}
                </p>
                <p className="font-mono text-xs sm:text-sm font-bold text-red-600 mt-0.5">
                  -LKR {splitSummary.discountAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-1">
                <p className="text-[10px] uppercase font-bold text-emerald-700">Final Total to Split</p>
                <p className="font-mono text-xs sm:text-sm font-extrabold text-emerald-700 mt-0.5">
                  LKR {splitSummary.finalTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* 2. METHOD-SPECIFIC CONFIGURATION PANEL */}
          {method === "by_items" && (
            <div className="bg-white rounded-2xl p-4 border border-[#E5D8CF] shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#343428]">
                    2. Assign Products to People
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Assign each product to a single person, or share a product across multiple people (even split or custom share).
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSplitConfirmed(false)
                    const nextMap: Record<string, SplitItemAssignment> = {}
                    assignableItems.forEach((it) => {
                      nextMap[it.key] = {
                        item_key: it.key,
                        item_name: it.name,
                        quantity: it.quantity,
                        unit_price: it.price,
                        line_total: roundCurrency(it.price * it.quantity),
                        mode: "shared_even",
                        shared_diner_ids: diners.map((d) => d.id),
                        custom_shares: Object.fromEntries(diners.map((d) => [d.id, 1])),
                        custom_share_type: "portions",
                      }
                    })
                    setItemAssignments(nextMap)
                  }}
                  className="h-8 text-xs rounded-xl border-[#E5D8CF] text-[#808068] hover:bg-[#FAF5F1]"
                >
                  Share All Products Evenly
                </Button>
              </div>

              <div className="divide-y divide-gray-100 border border-[#E5D8CF] rounded-xl overflow-hidden">
                {assignableItems.map((it) => {
                  const lineTotal = roundCurrency(it.price * it.quantity)
                  const assign = itemAssignments[it.key] || {
                    item_key: it.key,
                    item_name: it.name,
                    quantity: it.quantity,
                    unit_price: it.price,
                    line_total: lineTotal,
                    mode: "single" as const,
                    single_diner_id: diners[0]?.id,
                  }

                  return (
                    <div key={it.key} className="p-3 sm:p-3.5 bg-white hover:bg-[#FAF5F1]/40 transition-colors space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-[#343428]">
                              {it.quantity}x {it.name}
                            </span>
                            <span className="font-mono text-xs font-bold text-[#D67B6B]">
                              LKR {lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                            {it.canExpand && (
                              <button
                                type="button"
                                onClick={() => toggleExpandUnits(it.baseKey, true)}
                                className="text-[10px] font-semibold text-[#808068] underline hover:text-[#D67B6B]"
                              >
                                Split {it.quantity} units individually
                              </button>
                            )}
                            {it.isExpandedUnit && (
                              <button
                                type="button"
                                onClick={() => toggleExpandUnits(it.baseKey, false)}
                                className="text-[10px] font-semibold text-gray-500 underline hover:text-gray-800"
                              >
                                Merge units back
                              </button>
                            )}
                          </div>
                          {it.modifiers && it.modifiers.length > 0 && (
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {it.modifiers.join(" • ")}
                            </p>
                          )}
                        </div>

                        {/* Mode Selector: Single Person vs Shared Even vs Shared Custom */}
                        <div className="flex items-center gap-1 bg-[#FAF5F1] p-1 rounded-lg border border-[#E5D8CF] self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() =>
                              updateItemAssignment(it.key, {
                                mode: "single",
                                single_diner_id: assign.single_diner_id || diners[0]?.id,
                              })
                            }
                            className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                              assign.mode === "single"
                                ? "bg-[#808068] text-white"
                                : "text-gray-600 hover:bg-white"
                            }`}
                          >
                            Single Person
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateItemAssignment(it.key, {
                                mode: "shared_even",
                                shared_diner_ids:
                                  assign.shared_diner_ids && assign.shared_diner_ids.length > 0
                                    ? assign.shared_diner_ids
                                    : diners.map((d) => d.id),
                              })
                            }
                            className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                              assign.mode === "shared_even"
                                ? "bg-[#808068] text-white"
                                : "text-gray-600 hover:bg-white"
                            }`}
                          >
                            Shared (Even)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateItemAssignment(it.key, {
                                mode: "shared_custom",
                                custom_share_type: assign.custom_share_type || "portions",
                                custom_shares:
                                  assign.custom_shares ||
                                  Object.fromEntries(diners.map((d) => [d.id, 1])),
                              })
                            }
                            className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                              assign.mode === "shared_custom"
                                ? "bg-[#808068] text-white"
                                : "text-gray-600 hover:bg-white"
                            }`}
                          >
                            Shared (Custom)
                          </button>
                        </div>
                      </div>

                      {/* Controls for the chosen assignment mode */}
                      {assign.mode === "single" && (
                        <div className="flex flex-wrap gap-1.5">
                          {diners.map((d) => {
                            const isSelected = assign.single_diner_id === d.id
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() =>
                                  updateItemAssignment(it.key, {
                                    mode: "single",
                                    single_diner_id: d.id,
                                  })
                                }
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                                  isSelected
                                    ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-2xs"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-[#D67B6B]/50"
                                }`}
                              >
                                {isSelected && <Check className="size-3 stroke-[3]" />}
                                <span>{d.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {assign.mode === "shared_even" && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-medium text-gray-500">
                            Select people sharing this item evenly:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {diners.map((d) => {
                              const selectedIds = assign.shared_diner_ids || []
                              const isIncluded = selectedIds.includes(d.id)
                              const eachAmt =
                                isIncluded && selectedIds.length > 0
                                  ? roundCurrency(lineTotal / selectedIds.length)
                                  : 0
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => {
                                    const nextIds = isIncluded
                                      ? selectedIds.filter((id) => id !== d.id)
                                      : [...selectedIds, d.id]
                                    updateItemAssignment(it.key, {
                                      shared_diner_ids: nextIds,
                                    })
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                                    isIncluded
                                      ? "bg-[#808068] text-white border-[#808068]"
                                      : "bg-white text-gray-600 border-gray-200"
                                  }`}
                                >
                                  {isIncluded && <Check className="size-3 stroke-[3]" />}
                                  <span>{d.name}</span>
                                  {isIncluded && (
                                    <span className="text-[10px] opacity-85 font-mono">
                                      (~LKR {eachAmt.toLocaleString()})
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {assign.mode === "shared_custom" && (
                        <div className="bg-[#FAF5F1] rounded-xl p-2.5 border border-[#E5D8CF] space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase text-[#808068]">
                              Enter each person&apos;s share:
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  updateItemAssignment(it.key, {
                                    custom_share_type: "portions",
                                    custom_shares: Object.fromEntries(diners.map((d) => [d.id, 1])),
                                  })
                                }
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  (assign.custom_share_type || "portions") === "portions"
                                    ? "bg-[#D67B6B] text-white"
                                    : "bg-white text-gray-600 border border-gray-200"
                                }`}
                              >
                                By Portions / Ratio
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const even = allocateProportionally(
                                    lineTotal,
                                    new Array(diners.length).fill(1)
                                  )
                                  updateItemAssignment(it.key, {
                                    custom_share_type: "lkr",
                                    custom_shares: Object.fromEntries(
                                      diners.map((d, idx) => [d.id, even[idx]])
                                    ),
                                  })
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  assign.custom_share_type === "lkr"
                                    ? "bg-[#D67B6B] text-white"
                                    : "bg-white text-gray-600 border border-gray-200"
                                }`}
                              >
                                By Exact LKR
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {diners.map((d) => {
                              const val = assign.custom_shares?.[d.id] ?? 0
                              return (
                                <div key={d.id} className="bg-white rounded-lg p-2 border border-gray-200">
                                  <label className="block text-[10px] font-bold text-gray-700 truncate">
                                    {d.name} ({assign.custom_share_type === "lkr" ? "LKR" : "Share"})
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step={assign.custom_share_type === "lkr" ? "10" : "1"}
                                    value={val}
                                    onChange={(e) => {
                                      const nextVal = Math.max(0, Number(e.target.value) || 0)
                                      updateItemAssignment(it.key, {
                                        custom_shares: {
                                          ...(assign.custom_shares || {}),
                                          [d.id]: nextVal,
                                        },
                                      })
                                    }}
                                    className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs font-mono font-bold text-gray-900"
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {method === "by_percentage" && (
            <div className="bg-white rounded-2xl p-4 border border-[#E5D8CF] shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#343428]">
                    2. Assign Percentage per Person (Must Total 100%)
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Enter the percentage of the bill for each person. Shares are calculated directly from the discounted bill total.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDistributePercentageEvenly}
                  className="h-8 text-xs rounded-xl border-[#E5D8CF] text-[#808068] hover:bg-[#FAF5F1]"
                >
                  Split Evenly (100% / {diners.length})
                </Button>
              </div>

              {/* Percentage Progress Indicator */}
              <div
                className={`rounded-xl p-3 border flex items-center justify-between text-xs font-bold ${
                  Math.abs(splitSummary.percentageTotal - 100) <= 0.01
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                <span>
                  Total Percentage Allocated: {splitSummary.percentageTotal}% / 100%
                </span>
                <span>
                  {Math.abs(splitSummary.percentageTotal - 100) <= 0.01
                    ? "Exact 100% Allocated ✓"
                    : splitSummary.percentageTotal < 100
                    ? `${roundCurrency(100 - splitSummary.percentageTotal)}% Remaining`
                    : `Over by ${roundCurrency(splitSummary.percentageTotal - 100)}%`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {diners.map((diner, idx) => {
                  const share = splitSummary.dinerShares[idx]
                  return (
                    <div
                      key={diner.id}
                      className="rounded-xl border border-[#E5D8CF] bg-[#FAF5F1]/60 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-[#343428] truncate">{diner.name}</p>
                        <p className="text-xs font-mono font-bold text-[#D67B6B] mt-0.5">
                          LKR {(share?.total_owed || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleFillRemainingPercentage(diner.id)}
                          className="text-[10px] text-[#808068] underline hover:text-[#D67B6B] mt-0.5"
                        >
                          Assign remaining %
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          aria-label={`${diner.name} Percentage`}
                          value={diner.percentage ?? 0}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0)
                            setSplitConfirmed(false)
                            setDiners((prev) =>
                              prev.map((d) => (d.id === diner.id ? { ...d, percentage: val } : d))
                            )
                          }}
                          className="w-24 h-10 text-right font-mono font-bold text-sm bg-white border-[#E5D8CF] rounded-xl"
                        />
                        <span className="text-sm font-bold text-gray-600">%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {method === "by_amount" && (
            <div className="bg-white rounded-2xl p-4 border border-[#E5D8CF] shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#343428]">
                    2. Enter Fixed LKR Amount per Person
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Enter the exact LKR amount each person will pay. Confirmation is enabled once the discounted bill total is fully allocated.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDistributeAmountEvenly}
                  className="h-8 text-xs rounded-xl border-[#E5D8CF] text-[#808068] hover:bg-[#FAF5F1]"
                >
                  Split Evenly (LKR {splitSummary.finalTotal.toLocaleString()})
                </Button>
              </div>

              {/* Live LKR Remaining Allocation Banner */}
              <div
                className={`rounded-xl p-3 border flex flex-wrap items-center justify-between gap-2 text-xs font-bold ${
                  Math.abs(splitSummary.unallocatedAmount) <= 0.01
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                <span>
                  Allocated: LKR {splitSummary.allocatedAmountTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} / LKR {splitSummary.finalTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
                <span>
                  {Math.abs(splitSummary.unallocatedAmount) <= 0.01
                    ? "Full Bill Total Allocated ✓"
                    : splitSummary.unallocatedAmount > 0
                    ? `Remaining to Allocate: LKR ${splitSummary.unallocatedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                    : `Over-allocated by LKR ${Math.abs(splitSummary.unallocatedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {diners.map((diner, idx) => {
                  const share = splitSummary.dinerShares[idx]
                  return (
                    <div
                      key={diner.id}
                      className="rounded-xl border border-[#E5D8CF] bg-[#FAF5F1]/60 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-[#343428] truncate">{diner.name}</p>
                        <p className="text-[11px] text-gray-500">
                          {share?.percentage || 0}% of total bill
                        </p>
                        <button
                          type="button"
                          onClick={() => handleFillRemainingAmount(diner.id)}
                          className="text-[10px] text-[#808068] underline hover:text-[#D67B6B] mt-0.5"
                        >
                          Allocate remaining LKR
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-500">LKR</span>
                        <Input
                          type="number"
                          min="0"
                          step="10"
                          aria-label={`${diner.name} LKR Amount`}
                          value={diner.fixed_amount ?? 0}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0)
                            setSplitConfirmed(false)
                            setDiners((prev) =>
                              prev.map((d) => (d.id === diner.id ? { ...d, fixed_amount: val } : d))
                            )
                          }}
                          className="w-28 sm:w-32 h-10 text-right font-mono font-bold text-sm bg-white border-[#E5D8CF] rounded-xl"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* VALIDATION ERRORS & CONFIRM SPLIT BAR */}
          {!splitSummary.isValidSplit ? (
            <div
              role="alert"
              className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800 flex items-start gap-2.5"
            >
              <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Incomplete or Invalid Split:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {splitSummary.validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-emerald-900">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Split Balanced Exactly:</strong> All {diners.length} shares add up to{" "}
                  <strong className="font-mono">LKR {splitSummary.finalTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>.
                </span>
              </div>
              {!splitConfirmed ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmSplit}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl h-8 px-4 text-xs font-bold"
                >
                  Confirm Split Allocation
                </Button>
              ) : (
                <Badge className="bg-emerald-700 text-white border-0 text-[10px] px-2.5 py-1">
                  Split Confirmed ✓
                </Badge>
              )}
            </div>
          )}

          {/* 3. SHARE BREAKDOWN & INDIVIDUAL PAYMENTS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#343428]">
                3. Share Breakdown &amp; Individual Payments per Person
              </p>
              <span className="text-[11px] text-gray-500">
                Bill stays OPEN until every person&apos;s share is paid in full.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {splitSummary.dinerShares.map((share) => {
                const dinerPayments = payments.filter((p) => p.diner_id === share.diner_id)
                const isPayingThisDiner = payingDinerId === share.diner_id

                return (
                  <div
                    key={share.diner_id}
                    className={`rounded-2xl border bg-white p-4 shadow-xs flex flex-col justify-between gap-3 transition-all ${
                      share.status === "paid"
                        ? "border-emerald-300 bg-emerald-50/20"
                        : isPayingThisDiner
                        ? "border-[#D67B6B] ring-2 ring-[#D67B6B]/20"
                        : "border-[#E5D8CF]"
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-serif font-bold text-base text-[#343428]">
                              {share.diner_name}
                            </h4>
                            <span className="text-[11px] text-gray-500 font-mono">
                              ({share.percentage}%)
                            </span>
                          </div>
                        </div>
                        <Badge
                          className={`text-[10px] uppercase font-bold px-2.5 py-0.5 border-0 ${
                            share.status === "paid"
                              ? "bg-emerald-600 text-white"
                              : share.status === "partial"
                              ? "bg-amber-500 text-white"
                              : share.status === "refunded"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {share.status === "paid"
                            ? "PAID ✓"
                            : share.status === "partial"
                            ? "PARTIALLY PAID"
                            : share.status === "refunded"
                            ? "REFUNDED / UNPAID"
                            : "UNPAID"}
                        </Badge>
                      </div>

                      {/* Assigned Products (if Split by Products) */}
                      {method === "by_items" && (
                        <div className="space-y-1 bg-[#FAF5F1]/70 rounded-xl p-2.5 border border-[#E5D8CF]/60 text-xs">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#808068]">
                            Assigned Products ({share.assigned_products.length})
                          </p>
                          {share.assigned_products.length > 0 ? (
                            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                              {share.assigned_products.map((ap, i) => (
                                <div key={`${ap.item_key}-${i}`} className="flex justify-between text-[11px]">
                                  <span className="text-gray-700 truncate pr-2">
                                    {ap.item_name}{" "}
                                    <span className="text-[10px] text-[#808068] font-semibold">
                                      ({ap.share_label})
                                    </span>
                                  </span>
                                  <span className="font-mono font-medium text-gray-900 shrink-0">
                                    LKR {ap.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-amber-700 italic">No products assigned</p>
                          )}
                        </div>
                      )}

                      {/* Financial Breakdown for Diner */}
                      <div className="space-y-1 text-xs pt-0.5">
                        <div className="flex justify-between text-gray-600">
                          <span>Subtotal Share</span>
                          <span className="font-mono">
                            LKR {share.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {share.discount_share > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Discount Share</span>
                            <span className="font-mono">
                              -LKR {share.discount_share.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {share.charges_share !== 0 && (
                          <div className="flex justify-between text-gray-600">
                            <span>Service Charge &amp; Tax Share</span>
                            <span className="font-mono">
                              LKR {share.charges_share.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-sm text-[#343428] pt-1 border-t border-gray-100">
                          <span>Total Share Owed</span>
                          <span className="font-mono">
                            LKR {share.total_owed.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-emerald-700 font-semibold">
                          <span>Amount Paid</span>
                          <span className="font-mono">
                            LKR {share.amount_paid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between font-extrabold text-[#D67B6B]">
                          <span>Remaining Balance</span>
                          <span className="font-mono">
                            LKR {share.remaining_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Recorded Payments History for this Diner */}
                      {dinerPayments.length > 0 && (
                        <div className="pt-2 border-t border-gray-100 space-y-1">
                          <p className="text-[10px] font-bold uppercase text-gray-400">
                            Payment Records
                          </p>
                          {dinerPayments.map((p) => {
                            const isRefunded = p.status === "refunded" || p.status === "voided"
                            return (
                              <div
                                key={p.id}
                                className={`flex items-center justify-between text-[11px] rounded-lg px-2 py-1 ${
                                  isRefunded ? "bg-rose-50 text-rose-700 line-through" : "bg-emerald-50 text-emerald-900"
                                }`}
                              >
                                <span>
                                  {String(p.method).toUpperCase()} • LKR{" "}
                                  {Number(p.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                  {p.reference ? ` (Ref: ${p.reference})` : ""}
                                  {p.change_due && p.change_due > 0 ? ` [Change: LKR ${p.change_due}]` : ""}
                                </span>
                                {!isRefunded && (
                                  <button
                                    type="button"
                                    onClick={() => handleRefundDinerPayment(p.id)}
                                    className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 hover:underline ml-2"
                                    title="Void or refund this diner's payment"
                                  >
                                    <RotateCcw className="size-3" />
                                    Refund
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Action Button or Active Inline Payment Form */}
                    {isPayingThisDiner ? (
                      <div className="rounded-xl bg-[#FAF5F1] border border-[#D67B6B] p-3 space-y-3 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold uppercase text-[#343428]">
                            Pay {share.diner_name}&apos;s Share
                          </span>
                          <button
                            type="button"
                            onClick={() => setPayingDinerId(null)}
                            className="text-[11px] text-gray-500 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                        </div>

                        {/* Payment Method Selector */}
                        <div className="grid grid-cols-5 gap-1">
                          {(
                            [
                              { id: "cash", label: "Cash", icon: Banknote },
                              { id: "card", label: "Card", icon: CreditCard },
                              { id: "qr", label: "QR", icon: QrCode },
                              { id: "bank_transfer", label: "Bank", icon: Landmark },
                              { id: "credit", label: "Credit", icon: UserCheck },
                            ] as const
                          ).map((pm) => {
                            const Icon = pm.icon
                            const active = payMethod === pm.id
                            return (
                              <button
                                key={pm.id}
                                type="button"
                                onClick={() => setPayMethod(pm.id)}
                                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border text-[10px] font-bold transition-all ${
                                  active
                                    ? "bg-[#D67B6B] text-white border-[#D67B6B]"
                                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                <Icon className="size-3.5 mb-0.5" />
                                {pm.label}
                              </button>
                            )
                          })}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                              Share Amount (LKR)
                            </label>
                            <Input
                              type="number"
                              min="1"
                              max={share.remaining_balance}
                              step="0.01"
                              value={payAmountInput}
                              onChange={(e) => {
                                setPayAmountInput(e.target.value)
                                if (payMethod === "cash") {
                                  setCashTenderedInput(e.target.value)
                                }
                              }}
                              className="h-9 text-xs font-mono font-bold bg-white"
                            />
                          </div>

                          {payMethod === "cash" && (
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                                Cash Tendered (LKR)
                              </label>
                              <Input
                                type="number"
                                min={Number(payAmountInput) || 0}
                                step="10"
                                value={cashTenderedInput}
                                onChange={(e) => setCashTenderedInput(e.target.value)}
                                className="h-9 text-xs font-mono font-bold bg-white"
                              />
                            </div>
                          )}

                          {(payMethod === "card" || payMethod === "qr" || payMethod === "bank_transfer") && (
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                                {payMethod === "card" ? "Approval Code *" : payMethod === "bank_transfer" ? "Slip Ref *" : "QR Ref (Opt)"}
                              </label>
                              <Input
                                type="text"
                                placeholder={payMethod === "card" ? "e.g. AUTH-4812" : "Reference #"}
                                value={payReference}
                                onChange={(e) => setPayReference(e.target.value)}
                                className="h-9 text-xs font-mono bg-white"
                              />
                            </div>
                          )}

                          {payMethod === "credit" && (
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                                Customer Account *
                              </label>
                              <select
                                value={payCustomerId}
                                onChange={(e) => setPayCustomerId(e.target.value)}
                                className="w-full h-9 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium"
                              >
                                <option value="">Select customer…</option>
                                {customers.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} (Avail: LKR {(c.credit_limit - c.credit_balance).toLocaleString()})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {payMethod === "cash" &&
                          (Number(cashTenderedInput) || 0) > (Number(payAmountInput) || 0) && (
                            <div className="flex justify-between text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                              <span>Change Due to {share.diner_name}:</span>
                              <span className="font-mono">
                                LKR{" "}
                                {roundCurrency(
                                  (Number(cashTenderedInput) || 0) - (Number(payAmountInput) || 0)
                                ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}

                        <Button
                          type="button"
                          disabled={isSubmittingPayment}
                          onClick={handleRecordDinerPayment}
                          className="w-full h-10 rounded-xl bg-[#D67B6B] hover:bg-[#c26555] text-white font-bold text-xs shadow-sm"
                        >
                          {isSubmittingPayment
                            ? "Recording Payment…"
                            : `Complete Payment for ${share.diner_name} • LKR ${roundCurrency(Number(payAmountInput) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                        </Button>
                      </div>
                    ) : share.remaining_balance > 0.01 ? (
                      <Button
                        type="button"
                        disabled={!splitSummary.isValidSplit || share.total_owed <= 0}
                        onClick={() => openDinerPaymentDrawer(share)}
                        className="w-full h-10 rounded-xl bg-[#808068] hover:bg-[#6b6b56] text-white font-bold text-xs shadow-xs"
                      >
                        Pay {share.diner_name}&apos;s Share • LKR{" "}
                        {share.remaining_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </Button>
                    ) : (
                      <div className="w-full h-10 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        {share.diner_name}&apos;s Share Paid in Full
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-white border-t border-[#E5D8CF] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {onPrintSplitBill && (
              <Button
                type="button"
                variant="outline"
                disabled={!splitSummary.isValidSplit}
                onClick={() => onPrintSplitBill(buildOrderSplitConfig(payments, true))}
                className="h-10 rounded-xl border-[#E5D8CF] text-[#343428] text-xs font-semibold gap-1.5"
              >
                <Printer className="size-4" />
                Print Split Bill / Receipt
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="h-10 rounded-xl border-gray-200 text-gray-700 text-xs font-semibold px-4"
            >
              Close
            </Button>

            {splitSummary.totalRemaining > 0.01 && (
              <Button
                type="button"
                disabled={!splitSummary.isValidSplit}
                onClick={handleSaveOpenSplit}
                className="h-10 rounded-xl bg-[#808068] hover:bg-[#6b6b56] text-white text-xs font-bold px-4"
              >
                Save Split &amp; Keep Bill Open (LKR {splitSummary.totalRemaining.toLocaleString()} Unpaid)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
