export type SplitMethod = "by_items" | "by_percentage" | "by_amount"

export interface SplitDiner {
  id: string
  name: string
  percentage?: number
  fixed_amount?: number
}

export interface SplitItemAssignment {
  item_key: string
  item_name: string
  quantity: number
  unit_price: number
  line_total: number
  mode: "single" | "shared_even" | "shared_custom"
  single_diner_id?: string
  shared_diner_ids?: string[]
  custom_shares?: Record<string, number>
  custom_share_type?: "portions" | "lkr"
}

export interface DinerAssignedProductSummary {
  item_key: string
  item_name: string
  share_label: string
  amount: number
}

export interface DinerCalculatedShare {
  diner_id: string
  diner_name: string
  percentage: number
  assigned_products: DinerAssignedProductSummary[]
  subtotal: number
  discount_share: number
  charges_share: number // Service charge + tax share
  total_owed: number
  amount_paid: number
  remaining_balance: number
  status: "unpaid" | "partial" | "paid" | "refunded"
}

export interface SplitPaymentRecord {
  id: string
  diner_id?: string
  diner_name?: string
  method: "cash" | "card" | "qr" | "bank_transfer" | "credit" | string
  amount: number
  tendered?: number
  change_due?: number
  reference?: string
  customer_id?: string
  customer_name?: string
  status?: "paid" | "refunded" | "voided"
  paid_at?: string
  refunded_at?: string
  refund_reason?: string
}

export interface OrderSplitConfig {
  method: SplitMethod
  confirmed: boolean
  diners: SplitDiner[]
  item_assignments: Record<string, SplitItemAssignment>
  diner_shares: DinerCalculatedShare[]
  payments: SplitPaymentRecord[]
  total_bill: number
  total_paid: number
  total_remaining: number
  updated_at: string
}

export function roundCurrency(value: number): number {
  const num = Number(value) || 0
  return Math.round((num + Number.EPSILON) * 100) / 100
}

/**
 * Allocates `totalAmount` across `weights` using largest-remainder rounding at 0.01 precision
 * so the sum of returned values ALWAYS equals `roundCurrency(totalAmount)` exactly.
 */
export function allocateProportionally(totalAmount: number, weights: number[]): number[] {
  const count = weights.length
  if (count === 0) return []
  const target = roundCurrency(totalAmount)
  if (target === 0) return new Array(count).fill(0)

  const cleanWeights = weights.map((w) => Math.max(0, Number(w) || 0))
  const weightSum = cleanWeights.reduce((acc, w) => acc + w, 0)
  if (weightSum <= 0) {
    return new Array(count).fill(0)
  }

  const sign = target < 0 ? -1 : 1
  const absTargetCents = Math.round(Math.abs(target) * 100)

  const rawCents = cleanWeights.map((w) => (absTargetCents * w) / weightSum)
  const flooredCents = rawCents.map((c) => Math.floor(c + 1e-9))
  let remainderCents = absTargetCents - flooredCents.reduce((a, b) => a + b, 0)

  const indicesWithRemainders = rawCents
    .map((c, idx) => ({
      idx,
      rem: c - flooredCents[idx],
      weight: cleanWeights[idx],
    }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.rem - a.rem || a.idx - b.idx)

  let ptr = 0
  while (remainderCents > 0 && indicesWithRemainders.length > 0) {
    const targetIdx = indicesWithRemainders[ptr % indicesWithRemainders.length].idx
    flooredCents[targetIdx] += 1
    remainderCents -= 1
    ptr += 1
  }

  return flooredCents.map((cents) => roundCurrency((cents / 100) * sign))
}

export interface SplitCalculationInput {
  method: SplitMethod
  diners: SplitDiner[]
  items: {
    key: string
    name: string
    quantity: number
    price: number
    modifiers?: string[]
  }[]
  itemAssignments: Record<string, SplitItemAssignment>
  payments: SplitPaymentRecord[]
  subtotal: number
  discount: number
  charges: number // serviceCharge + tax
  total: number
}

export interface SplitCalculationResult {
  dinerShares: DinerCalculatedShare[]
  isValidSplit: boolean
  validationErrors: string[]
  unassignedItems: string[]
  percentageTotal: number
  allocatedAmountTotal: number
  unallocatedAmount: number
  totalPaid: number
  totalRemaining: number
  allSharesPaid: boolean
}

export function calculateSplitBillSummary(input: SplitCalculationInput): SplitCalculationResult {
  const {
    method,
    diners,
    items,
    itemAssignments,
    payments = [],
    subtotal,
    discount,
    charges,
    total,
  } = input

  const validationErrors: string[] = []
  const unassignedItems: string[] = []

  if (!diners || diners.length < 2) {
    validationErrors.push("Add at least 2 diners to split the bill.")
  }

  const dinerCount = diners.length
  const dinerSubtotals: number[] = new Array(dinerCount).fill(0)
  const dinerDiscounts: number[] = new Array(dinerCount).fill(0)
  const dinerCharges: number[] = new Array(dinerCount).fill(0)
  const dinerTotals: number[] = new Array(dinerCount).fill(0)
  const dinerPercentages: number[] = new Array(dinerCount).fill(0)
  const dinerAssignedMap: Record<string, DinerAssignedProductSummary[]> = {}
  diners.forEach((d) => {
    dinerAssignedMap[d.id] = []
  })

  const effectiveCharges = roundCurrency(total - subtotal + discount)
  const effectiveChargesToUse = Math.abs(effectiveCharges - charges) <= 1 ? effectiveCharges : roundCurrency(charges)

  let percentageTotal = 0
  let allocatedAmountTotal = 0

  if (method === "by_items") {
    for (const item of items) {
      const lineTotal = roundCurrency(item.price * item.quantity)
      const assignment = itemAssignments[item.key]

      if (!assignment) {
        unassignedItems.push(item.name)
        continue
      }

      if (assignment.mode === "single") {
        const dinerIdx = diners.findIndex((d) => d.id === assignment.single_diner_id)
        if (dinerIdx === -1) {
          unassignedItems.push(item.name)
        } else {
          dinerSubtotals[dinerIdx] = roundCurrency(dinerSubtotals[dinerIdx] + lineTotal)
          dinerAssignedMap[diners[dinerIdx].id].push({
            item_key: item.key,
            item_name: item.name,
            share_label: `${item.quantity}x`,
            amount: lineTotal,
          })
        }
      } else if (assignment.mode === "shared_even") {
        const validIds = (assignment.shared_diner_ids || []).filter((id) =>
          diners.some((d) => d.id === id)
        )
        if (validIds.length === 0) {
          unassignedItems.push(item.name)
        } else {
          const weights = diners.map((d) => (validIds.includes(d.id) ? 1 : 0))
          const itemShares = allocateProportionally(lineTotal, weights)
          itemShares.forEach((shareAmt, idx) => {
            if (weights[idx] > 0) {
              dinerSubtotals[idx] = roundCurrency(dinerSubtotals[idx] + shareAmt)
              dinerAssignedMap[diners[idx].id].push({
                item_key: item.key,
                item_name: item.name,
                share_label: validIds.length === 1 ? `${item.quantity}x` : `1/${validIds.length} shared`,
                amount: shareAmt,
              })
            }
          })
        }
      } else if (assignment.mode === "shared_custom") {
        const sharesMap = assignment.custom_shares || {}
        const shareType = assignment.custom_share_type || "portions"
        const weights = diners.map((d) => Math.max(0, Number(sharesMap[d.id]) || 0))
        const sumShares = roundCurrency(weights.reduce((a, b) => a + b, 0))

        if (sumShares <= 0) {
          unassignedItems.push(item.name)
        } else if (shareType === "lkr") {
          if (Math.abs(sumShares - lineTotal) > 0.05) {
            const diff = roundCurrency(lineTotal - sumShares)
            validationErrors.push(
              `"${item.name}" custom LKR shares total LKR ${sumShares.toLocaleString()} (must equal LKR ${lineTotal.toLocaleString()}, ${
                diff > 0 ? `LKR ${diff.toLocaleString()} remaining` : `over by LKR ${Math.abs(diff).toLocaleString()}`
              }).`
            )
          }
          weights.forEach((amt, idx) => {
            if (amt > 0) {
              const roundedAmt = roundCurrency(amt)
              dinerSubtotals[idx] = roundCurrency(dinerSubtotals[idx] + roundedAmt)
              dinerAssignedMap[diners[idx].id].push({
                item_key: item.key,
                item_name: item.name,
                share_label: `Custom LKR`,
                amount: roundedAmt,
              })
            }
          })
        } else {
          // Portions / ratio split
          const itemShares = allocateProportionally(lineTotal, weights)
          itemShares.forEach((shareAmt, idx) => {
            if (weights[idx] > 0) {
              dinerSubtotals[idx] = roundCurrency(dinerSubtotals[idx] + shareAmt)
              dinerAssignedMap[diners[idx].id].push({
                item_key: item.key,
                item_name: item.name,
                share_label: `${weights[idx]}/${sumShares} share`,
                amount: shareAmt,
              })
            }
          })
        }
      }
    }

    if (unassignedItems.length > 0) {
      validationErrors.push(
        `Assign all products to diners before confirming (${unassignedItems.length} unassigned: ${unassignedItems.slice(0, 3).join(", ")}${
          unassignedItems.length > 3 ? "…" : ""
        }).`
      )
    }

    const assignedSubtotalSum = roundCurrency(dinerSubtotals.reduce((a, b) => a + b, 0))
    const discountAlloc = allocateProportionally(discount, dinerSubtotals)
    const chargesAlloc = allocateProportionally(effectiveChargesToUse, dinerSubtotals)

    for (let i = 0; i < dinerCount; i++) {
      dinerDiscounts[i] = discountAlloc[i]
      dinerCharges[i] = chargesAlloc[i]
      dinerTotals[i] = roundCurrency(dinerSubtotals[i] - dinerDiscounts[i] + dinerCharges[i])
      dinerPercentages[i] =
        subtotal > 0 ? roundCurrency((dinerSubtotals[i] / subtotal) * 100) : 0
    }

    // Reconcile any 1-cent difference if all items are assigned
    if (unassignedItems.length === 0 && Math.abs(assignedSubtotalSum - subtotal) <= 0.05 && dinerCount > 0) {
      const currentTotalSum = roundCurrency(dinerTotals.reduce((a, b) => a + b, 0))
      const diff = roundCurrency(total - currentTotalSum)
      if (Math.abs(diff) > 0 && Math.abs(diff) <= 0.05) {
        // Add remainder to last diner with positive subtotal
        for (let i = dinerCount - 1; i >= 0; i--) {
          if (dinerSubtotals[i] > 0) {
            dinerCharges[i] = roundCurrency(dinerCharges[i] + diff)
            dinerTotals[i] = roundCurrency(dinerTotals[i] + diff)
            break
          }
        }
      }
    }

    allocatedAmountTotal = roundCurrency(dinerTotals.reduce((a, b) => a + b, 0))
    percentageTotal = roundCurrency(dinerPercentages.reduce((a, b) => a + b, 0))
  } else if (method === "by_percentage") {
    const pctWeights = diners.map((d) => Math.max(0, Number(d.percentage) || 0))
    percentageTotal = roundCurrency(pctWeights.reduce((a, b) => a + b, 0))

    if (Math.abs(percentageTotal - 100) > 0.01) {
      const remPct = roundCurrency(100 - percentageTotal)
      validationErrors.push(
        remPct > 0
          ? `Percentages total ${percentageTotal}% — must total exactly 100% (${remPct}% remaining).`
          : `Percentages total ${percentageTotal}% — exceeds 100% by ${Math.abs(remPct)}%.`
      )
    }

    const subAlloc = allocateProportionally(subtotal, pctWeights)
    const discAlloc = allocateProportionally(discount, pctWeights)
    const chgAlloc = allocateProportionally(effectiveChargesToUse, pctWeights)
    const totAlloc = allocateProportionally(total, pctWeights)

    for (let i = 0; i < dinerCount; i++) {
      dinerPercentages[i] = roundCurrency(pctWeights[i])
      if (Math.abs(percentageTotal - 100) <= 0.01) {
        dinerSubtotals[i] = subAlloc[i]
        dinerDiscounts[i] = discAlloc[i]
        dinerTotals[i] = totAlloc[i]
        dinerCharges[i] = roundCurrency(dinerTotals[i] - dinerSubtotals[i] + dinerDiscounts[i])
      } else {
        // Preview proportional to current percentage (out of 100%)
        const ratio = pctWeights[i] / 100
        dinerSubtotals[i] = roundCurrency(subtotal * ratio)
        dinerDiscounts[i] = roundCurrency(discount * ratio)
        dinerCharges[i] = roundCurrency(effectiveChargesToUse * ratio)
        dinerTotals[i] = roundCurrency(total * ratio)
      }
    }

    allocatedAmountTotal = roundCurrency(dinerTotals.reduce((a, b) => a + b, 0))
  } else if (method === "by_amount") {
    const fixedAmounts = diners.map((d) => Math.max(0, roundCurrency(Number(d.fixed_amount) || 0)))
    allocatedAmountTotal = roundCurrency(fixedAmounts.reduce((a, b) => a + b, 0))
    const diff = roundCurrency(total - allocatedAmountTotal)

    if (Math.abs(diff) > 0.01) {
      validationErrors.push(
        diff > 0
          ? `LKR ${diff.toLocaleString("en-US", { minimumFractionDigits: 2 })} remaining to allocate (allocated LKR ${allocatedAmountTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} of LKR ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}).`
          : `Allocated amount exceeds bill total by LKR ${Math.abs(diff).toLocaleString("en-US", { minimumFractionDigits: 2 })}.`
      )
    }

    const subAlloc = allocateProportionally(subtotal, fixedAmounts)
    const discAlloc = allocateProportionally(discount, fixedAmounts)

    for (let i = 0; i < dinerCount; i++) {
      dinerTotals[i] = fixedAmounts[i]
      dinerPercentages[i] = total > 0 ? roundCurrency((fixedAmounts[i] / total) * 100) : 0
      if (Math.abs(diff) <= 0.01) {
        dinerSubtotals[i] = subAlloc[i]
        dinerDiscounts[i] = discAlloc[i]
        dinerCharges[i] = roundCurrency(dinerTotals[i] - dinerSubtotals[i] + dinerDiscounts[i])
      } else {
        const ratio = total > 0 ? fixedAmounts[i] / total : 0
        dinerSubtotals[i] = roundCurrency(subtotal * ratio)
        dinerDiscounts[i] = roundCurrency(discount * ratio)
        dinerCharges[i] = roundCurrency(dinerTotals[i] - dinerSubtotals[i] + dinerDiscounts[i])
      }
    }

    percentageTotal = roundCurrency(dinerPercentages.reduce((a, b) => a + b, 0))
  }

  // Compute per-diner payment totals (excluding voided/refunded payments)
  const activePayments = payments.filter((p) => p.status !== "refunded" && p.status !== "voided")
  const refundedPayments = payments.filter((p) => p.status === "refunded" || p.status === "voided")

  const dinerShares: DinerCalculatedShare[] = diners.map((d, idx) => {
    const dActivePayments = activePayments.filter((p) => p.diner_id === d.id)
    const dRefundedPayments = refundedPayments.filter((p) => p.diner_id === d.id)
    const paidSum = roundCurrency(dActivePayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0))
    const owed = roundCurrency(dinerTotals[idx])
    const rem = Math.max(0, roundCurrency(owed - paidSum))

    // Prevent reducing a diner's share below what they have already paid
    if (paidSum > owed + 0.01) {
      validationErrors.push(
        `${d.name} has already paid LKR ${paidSum.toLocaleString()}, which exceeds their assigned share of LKR ${owed.toLocaleString()}.`
      )
    }

    let status: "unpaid" | "partial" | "paid" | "refunded" = "unpaid"
    if (owed > 0 && rem <= 0.01 && paidSum >= owed - 0.01) {
      status = "paid"
    } else if (paidSum > 0) {
      status = "partial"
    } else if (dRefundedPayments.length > 0) {
      status = "refunded"
    }

    return {
      diner_id: d.id,
      diner_name: d.name,
      percentage: dinerPercentages[idx],
      assigned_products: dinerAssignedMap[d.id] || [],
      subtotal: dinerSubtotals[idx],
      discount_share: dinerDiscounts[idx],
      charges_share: dinerCharges[idx],
      total_owed: owed,
      amount_paid: paidSum,
      remaining_balance: rem,
      status,
    }
  })

  // Also include any legacy unlinked split payments in totalPaid
  const totalPaid = roundCurrency(
    activePayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  )
  const totalRemaining = Math.max(0, roundCurrency(total - totalPaid))
  const unallocatedAmount = roundCurrency(total - allocatedAmountTotal)
  const isValidSplit = validationErrors.length === 0 && Math.abs(unallocatedAmount) <= 0.01
  const allSharesPaid = isValidSplit && total > 0 && totalRemaining <= 0.01

  return {
    dinerShares,
    isValidSplit,
    validationErrors,
    unassignedItems,
    percentageTotal,
    allocatedAmountTotal,
    unallocatedAmount,
    totalPaid,
    totalRemaining,
    allSharesPaid,
  }
}
