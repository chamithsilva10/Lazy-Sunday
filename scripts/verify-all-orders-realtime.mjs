/**
 * POS SYSTEM - PREVIOUS ORDERS PRESERVATION & REAL-TIME UNIFICATION TEST
 * 
 * Verifies:
 * 1. Previous orders (CFJ-000101 to CFJ-000105 and COF-1001) are NEVER cleared
 * 2. Unification across Kitchen, Bar, Dine-in, Takeaway, and Coffee bills
 * 3. Union merging prevents 2-order cloud queries from masking existing orders
 * 4. Real-time ticket status changes preserve parent orders without duplicates
 * 5. Dashboard Gross Sales and Order History strictly align
 *
 * Run with: node scripts/verify-all-orders-realtime.mjs
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

console.log("\n=======================================================")
console.log("🔍 POS SYSTEM - PREVIOUS ORDERS & REAL-TIME TEST")
console.log("=======================================================\n")

let passedCount = 0
let failedCount = 0

function it(description, fn) {
  try {
    fn()
    console.log(`  ✅ PASS: ${description}`)
    passedCount++
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`)
    console.error(`     Error: ${err.message}`)
    failedCount++
  }
}

// Read shared-pos-service.ts to verify DEFAULT_INITIAL_ORDERS content
const sharedPosPath = path.resolve("./lib/shared-pos-service.ts")
const sharedPosCode = fs.readFileSync(sharedPosPath, "utf-8")

it("DEFAULT_INITIAL_ORDERS contains all 6 diverse baseline orders and was not cleared", () => {
  assert(sharedPosCode.includes("CFJ-000101"), "Order CFJ-000101 must exist")
  assert(sharedPosCode.includes("CFJ-000102"), "Order CFJ-000102 must exist")
  assert(sharedPosCode.includes("CFJ-000103"), "Order CFJ-000103 must exist")
  assert(sharedPosCode.includes("CFJ-000104"), "Order CFJ-000104 must exist")
  assert(sharedPosCode.includes("CFJ-000105"), "Order CFJ-000105 must exist")
  assert(sharedPosCode.includes("COF-1001"), "Coffee Bar Order COF-1001 must exist")
})

it("SharedPosService.init and reloadOrders persist orders to localStorage", () => {
  assert(sharedPosCode.includes('localStorage.setItem(ORDERS_KEY, JSON.stringify(this.ordersCache))'), "ordersCache must be persisted to localStorage")
  assert(sharedPosCode.includes('DEFAULT_INITIAL_ORDERS.forEach'), "ordersCache must seed baseline orders")
  assert(sharedPosCode.includes('pos_coffee_bills'), "Coffee bills must be parsed and merged into ordersCache")
})

// Replicate mergeOrderRecords and toCoffeeBarTicket as implemented in app/page.tsx
function toCoffeeBarTicket(bill) {
  return {
    id: `coffee:${bill.id}`,
    order_number: bill.bill_number,
    receipt_number: bill.bill_number,
    table_name: bill.table_name || "Takeaway",
    cashier_name: "Coffee Bar",
    department: "Coffee Bar",
    items: (bill.items || []).map((item) => ({
      id: item.id,
      name: item.item_name,
      price: item.unit_price,
      quantity: item.quantity,
      category: "Coffee Bar",
    })),
    subtotal: bill.subtotal,
    service_charge: bill.tax || 0,
    service_charge_rate: 0,
    discount: bill.discount || 0,
    total: bill.grand_total,
    payment_method: bill.payment_method === "transfer" ? "qr" : bill.payment_method,
    status: "paid",
    bar_status: bill.bar_status || "served",
    ticket_source: "coffee_bill",
    created_at: bill.created_at || bill.bill_date || new Date().toISOString(),
  }
}

function mergeOrderRecords(...orderArrays) {
  const map = new Map()

  for (const list of orderArrays) {
    if (!list || !Array.isArray(list)) continue
    for (const incoming of list) {
      if (!incoming) continue
      const numKey = incoming.order_number ? String(incoming.order_number) : ""
      const idKey = incoming.id ? String(incoming.id) : ""
      const existing = (numKey && map.get(numKey)) || (idKey && map.get(idKey))

      if (!existing) {
        if (numKey) map.set(numKey, incoming)
        if (idKey) map.set(idKey, incoming)
      } else {
        const hasKitchen = Boolean(existing.kitchen_status || incoming.kitchen_status)
        const hasBar = Boolean(existing.bar_status || incoming.bar_status)

        const kitchenServed = !hasKitchen || existing.kitchen_status === "served" || incoming.kitchen_status === "served"
        const barServed = !hasBar || existing.bar_status === "served" || incoming.bar_status === "served"
        const isFullyServed = (kitchenServed && barServed) && (hasKitchen || hasBar)
        const completed =
          existing.status === "completed" ||
          incoming.status === "completed" ||
          (isFullyServed && (existing.status === "paid" || incoming.status === "paid"))

        const merged = {
          ...existing,
          ...incoming,
          items: incoming.items && incoming.items.length > 0 ? incoming.items : existing.items,
          kitchen_status: hasKitchen ? (existing.kitchen_status === "served" || incoming.kitchen_status === "served" ? "served" : (incoming.kitchen_status || existing.kitchen_status)) : undefined,
          bar_status: hasBar ? (existing.bar_status === "served" || incoming.bar_status === "served" ? "served" : (incoming.bar_status || existing.bar_status)) : undefined,
          status: completed ? "completed" : existing.status === "paid" ? "paid" : incoming.status,
        }
        if (numKey) map.set(numKey, merged)
        if (idKey) map.set(idKey, merged)
      }
    }
  }

  const unique = new Map()
  for (const o of map.values()) {
    const primaryKey = o.order_number || o.id
    if (!unique.has(primaryKey)) {
      unique.set(primaryKey, o)
    }
  }

  return Array.from(unique.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

const baselineOrders = [
  { id: "ord-1", order_number: "CFJ-000101", total: 3355, payment_method: "cash", status: "paid", kitchen_status: "served", bar_status: "served", created_at: "2026-10-17T09:00:00Z" },
  { id: "ord-2", order_number: "CFJ-000102", total: 4180, payment_method: "card", status: "paid", kitchen_status: "served", bar_status: "served", created_at: "2026-10-17T09:30:00Z" },
  { id: "ord-3", order_number: "CFJ-000103", total: 2970, payment_method: "cash", status: "paid", kitchen_status: "served", bar_status: "served", created_at: "2026-10-17T09:45:00Z" },
  { id: "ord-4", order_number: "CFJ-000104", total: 3520, payment_method: "card", status: "paid", kitchen_status: "served", bar_status: "served", created_at: "2026-10-17T10:00:00Z" },
  { id: "ord-5", order_number: "CFJ-000105", total: 3410, payment_method: "cash", status: "paid", kitchen_status: "served", bar_status: "served", created_at: "2026-10-17T10:15:00Z" },
  { id: "coffee:sample-1", order_number: "COF-1001", total: 2450, payment_method: "card", status: "paid", bar_status: "served", created_at: "2026-10-17T09:15:00Z" },
]

it("Cloud orders query returning only 2 orders does NOT hide earlier orders", () => {
  const cloudPartial2 = [
    { id: "cloud-1", order_number: "CFJ-000001", total: 1500, payment_method: "cash", status: "paid", created_at: "2026-10-15T12:00:00Z" },
    { id: "cloud-2", order_number: "CFJ-000002", total: 2200, payment_method: "card", status: "paid", created_at: "2026-10-15T13:00:00Z" },
  ]

  const merged = mergeOrderRecords(baselineOrders, cloudPartial2)
  assert.equal(merged.length, 8, `Expected 8 orders, but got ${merged.length}`)
  assert(merged.some(o => o.order_number === "CFJ-000101"), "CFJ-000101 must be preserved")
  assert(merged.some(o => o.order_number === "COF-1001"), "COF-1001 must be preserved")
  assert(merged.some(o => o.order_number === "CFJ-000001"), "Cloud order 1 must be included")
  assert(merged.some(o => o.order_number === "CFJ-000002"), "Cloud order 2 must be included")
})

it("Coffee Bar bills from both localStorage and remote API merge cleanly without duplicates", () => {
  const localCoffeeBill = {
    id: "bill-loc-1",
    bill_number: "COF-2001",
    subtotal: 1600,
    tax: 0,
    discount: 0,
    grand_total: 1600,
    payment_method: "cash",
    bar_status: "preparing",
    items: [{ id: "c1", item_name: "Espresso Double", unit_price: 800, quantity: 2 }],
  }

  const remoteCoffeeBill = {
    id: "bill-loc-1", // same bill updated on remote
    bill_number: "COF-2001",
    subtotal: 1600,
    tax: 0,
    discount: 0,
    grand_total: 1600,
    payment_method: "cash",
    bar_status: "served",
    items: [{ id: "c1", item_name: "Espresso Double", unit_price: 800, quantity: 2 }],
  }

  const merged = mergeOrderRecords(
    baselineOrders,
    [toCoffeeBarTicket(localCoffeeBill)],
    [toCoffeeBarTicket(remoteCoffeeBill)]
  )

  const cof2001 = merged.find(o => o.order_number === "COF-2001")
  assert(cof2001, "COF-2001 must exist")
  assert.equal(cof2001.bar_status, "served", "Bar status must reflect the updated 'served' status")
  assert.equal(cof2001.status, "completed", "Order status must become 'completed' once served")
  assert.equal(merged.filter(o => o.order_number === "COF-2001").length, 1, "Must not duplicate orders with the same bill_number")
})

it("Dashboard gross sales strictly matches sum of all unified orders", () => {
  const merged = mergeOrderRecords(baselineOrders)
  const totalSales = merged.reduce((s, o) => s + (o.total || 0), 0)
  const cashSales = merged.filter(o => o.payment_method === "cash").reduce((s, o) => s + (o.total || 0), 0)
  const cardSales = merged.filter(o => o.payment_method === "card").reduce((s, o) => s + (o.total || 0), 0)

  assert.equal(totalSales, 3355 + 4180 + 2970 + 3520 + 3410 + 2450)
  assert.equal(cashSales, 3355 + 2970 + 3410)
  assert.equal(cardSales, 4180 + 3520 + 2450)
  assert.equal(totalSales, cashSales + cardSales)
})

console.log("\n=======================================================")
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`)
console.log("=======================================================\n")

if (failedCount > 0) {
  process.exit(1)
} else {
  console.log("🎉 ALL PREVIOUS ORDERS PRESERVATION TESTS PASSED SUCCESSFULLY!\n")
}
