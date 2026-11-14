import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"

// Run the real modules with isolated identity/database providers. No live writes.
function load(file, dependencies) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(compiled, {
    exports, Headers, URL, process: { env: {} },
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
      return dependencies[name]
    },
  }, { filename: file })
  return exports
}

const NextResponse = {
  json: (body, options = {}) => ({ body, status: options.status || 200, headers: new Headers(), cookies: { set() {} } }),
  next: () => ({ status: 200, headers: new Headers(), cookies: { set() {} } }),
}
const role = { id: "cashier", name: "cashier", permissions: ["orders.view"] }
let active = true
const middleware = load("lib/rbac/middleware.ts", {
  "next/server": { NextResponse },
  "@/lib/coffee/auth": { getStaffIdentity: async () => ({ userId: "cashier", role: "cashier", email: "cashier@example.test" }) },
  "./permissions": { normalizeRole: value => value },
  "./rbac-service": { RbacService: {
    getUserByUsername: async () => ({ id: "cashier", role_id: "cashier", role, is_active: active }),
    getRoleById: async () => role,
  } },
})
const request = { cookies: { get: () => ({ value: encodeURIComponent(JSON.stringify({ cashier: ["*"] })) }) } }
assert.equal((await middleware.authorizeRequest(request, "orders.view")).allowed, true)
assert.equal((await middleware.authorizeRequest(request, "users.manage")).response.status, 403)
assert.equal((await middleware.requireAdmin()(request)).response.status, 403)
active = false
assert.equal((await middleware.authorizeRequest(request, "orders.view")).response.status, 403)

const proxy = load("proxy.ts", {
  "next/server": { NextResponse },
  "@supabase/ssr": {},
  "@/lib/config/demo": { isDemoMode: () => true },
  "@/lib/coffee/session": {
    SESSION_COOKIE_NAME: "pos-session-state",
    verifyAndExtractSession: async () => null,
  },
}).proxy
let checks = 4
for (const pathname of ["/api/tables", "/api/tables/bookings"]) {
  for (const method of ["GET", "POST"]) {
    const result = await proxy({ method, nextUrl: { pathname }, headers: new Headers(), cookies: { get() {}, getAll: () => [] } })
    assert.equal(result.status, 401, `${method} ${pathname} must require login`)
    checks++
  }
}
assert.equal((await proxy({ method: "GET", nextUrl: { pathname: "/api/products" }, headers: new Headers() })).status, 200)
console.log(`${checks + 1} access boundary checks passed (real authorization and proxy modules).`)
