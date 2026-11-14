import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { webcrypto } from "node:crypto"

const code = ts.transpileModule(fs.readFileSync("lib/shared-pos-service.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
let fetchImpl
let tick
let intervalMs
const exports = {}
vm.runInNewContext(code, {
  exports, console, crypto: webcrypto,
  localStorage: { setItem() {} },
  fetch: (...args) => fetchImpl(...args),
  setInterval: (callback, ms) => { tick = callback; intervalMs = ms; return 1 },
  require: name => {
    if (name === "@/lib/supabase/client") return { isSupabaseConfigured: () => false }
    if (name === "@/lib/product-images") return { PRODUCT_IMAGE_MAP: {} }
    if (name === "@/lib/station-routing") return { determineItemStation: () => "kitchen" }
    throw new Error(`Unexpected dependency ${name}`)
  },
})
const service = exports.SharedPosService
service.init = () => {}
service.isBrowser = () => true
service.ordersCache = []
service.productsCache = []
service.emitOrders = () => {}
service.broadcast = () => {}
const order = { id: "00000000-0000-4000-8000-000000000001", order_number: "LS-000999", table_name: "Takeaway", status: "open", items: [] }
for (const response of [
  { ok: false, json: async () => ({ error: "Database unavailable" }) },
  { ok: true, json: async () => ({ success: false }) },
  { ok: true, json: async () => ({ success: true }) },
]) {
  fetchImpl = async () => response
  await assert.rejects(service.saveOrder(order))
  assert.equal(service.ordersCache.length, 0, "Rejected saves must not enter the order cache")
}
fetchImpl = async () => { throw new Error("Network disconnected") }
await assert.rejects(service.saveOrder(order), /Network disconnected/)
assert.equal(service.ordersCache.length, 0)
fetchImpl = async () => ({ ok: true, json: async () => ({ success: true, order }) })
assert.equal((await service.saveOrder(order)).order_number, order.order_number)
assert.equal(service.ordersCache.length, 1)

let refreshes = 0
let orderRefreshes = 0
service.refresh = async () => { refreshes++ }
service.refreshOrdersFromCloud = async () => { orderRefreshes++ }
service.startCloudRealtime()
assert.equal(refreshes, 1)
assert.equal(orderRefreshes, 1, "API orders must load even without Supabase")
assert.equal(intervalMs, 5000)
tick()
assert.equal(orderRefreshes, 2, "Polling must refresh orders as well as tables")
console.log("Order save failures, successful saves, and API synchronization checks passed.")
