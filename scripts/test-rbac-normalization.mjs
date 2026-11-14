import assert from "node:assert";

// Test role normalization logic directly
export function normalizeRole(raw) {
  if (!raw) return "cashier";
  const clean = String(raw).trim().toLowerCase();
  if (
    clean === "admin" ||
    clean === "role-admin" ||
    clean === "role_admin" ||
    clean === "administrator" ||
    clean.startsWith("role-admin") ||
    clean.startsWith("role_admin") ||
    clean.includes("admin")
  ) {
    return "admin";
  }
  if (
    clean === "manager" ||
    clean === "role-manager" ||
    clean === "role_manager" ||
    clean.startsWith("role-manager") ||
    clean.includes("manager")
  ) {
    return "manager";
  }
  if (
    clean === "cashier" ||
    clean === "role-cashier" ||
    clean === "role_cashier" ||
    clean.startsWith("role-cashier") ||
    clean.includes("cashier")
  ) {
    return "cashier";
  }
  if (
    clean === "kitchen" ||
    clean === "role-kitchen" ||
    clean === "role_kitchen" ||
    clean.startsWith("role-kitchen") ||
    clean.includes("kitchen") ||
    clean.includes("chef")
  ) {
    return "kitchen";
  }
  if (
    clean === "staff" ||
    clean === "role-staff" ||
    clean === "role_staff" ||
    clean.startsWith("role-staff") ||
    clean.includes("staff") ||
    clean.includes("waiter")
  ) {
    return "staff";
  }
  if (
    clean === "viewer" ||
    clean === "guest" ||
    clean === "anonymous" ||
    clean === "unauthorized" ||
    clean.includes("viewer") ||
    clean.includes("guest")
  ) {
    return "viewer";
  }
  const stripped = clean.replace(/^role[-_]/, "");
  if (stripped === "admin") return "admin";
  if (stripped === "manager") return "manager";
  if (stripped === "cashier") return "cashier";
  if (stripped === "kitchen") return "kitchen";
  if (stripped === "staff") return "staff";
  if (stripped === "viewer") return "viewer";
  return "viewer";
}

export function getRoleDisplayName(raw) {
  const norm = normalizeRole(raw);
  return norm.charAt(0).toUpperCase() + norm.slice(1);
}

export function canManageProducts(role, permissions = []) {
  const norm = normalizeRole(role);
  if (norm === "admin" || norm === "manager" || norm === "cashier") return true;
  if (
    permissions.includes("*") ||
    permissions.includes("products.create") ||
    permissions.includes("products.edit") ||
    permissions.includes("products.manage") ||
    permissions.includes("products.delete")
  ) {
    return true;
  }
  return false;
}

export function canManageCategories(role, permissions = []) {
  const norm = normalizeRole(role);
  if (norm === "admin" || norm === "manager" || norm === "cashier") return true;
  if (
    permissions.includes("*") ||
    permissions.includes("products.create") ||
    permissions.includes("products.manage")
  ) {
    return true;
  }
  return false;
}

export function canManageTables(role, permissions = []) {
  const norm = normalizeRole(role);
  if (norm === "admin" || norm === "manager") return true;
  if (
    permissions.includes("*") ||
    permissions.includes("tables.manage") ||
    permissions.includes("orders.cancel")
  ) {
    return true;
  }
  return false;
}

export function canAdjustStock(role, permissions = []) {
  const norm = normalizeRole(role);
  if (norm === "admin" || norm === "manager" || norm === "cashier") return true;
  if (
    permissions.includes("*") ||
    permissions.includes("inventory.update") ||
    permissions.includes("inventory.view")
  ) {
    return true;
  }
  return false;
}

console.log("Running RBAC & Role Normalization Unit Tests...");

// 1. Role normalization tests
assert.strictEqual(normalizeRole("role-admin"), "admin");
assert.strictEqual(normalizeRole("role_admin"), "admin");
assert.strictEqual(normalizeRole("Role-admin"), "admin");
assert.strictEqual(normalizeRole("admin"), "admin");
assert.strictEqual(normalizeRole("ADMIN"), "admin");
assert.strictEqual(normalizeRole("Administrator"), "admin");

assert.strictEqual(normalizeRole("role-manager"), "manager");
assert.strictEqual(normalizeRole("manager"), "manager");
assert.strictEqual(normalizeRole("Store Manager"), "manager");

assert.strictEqual(normalizeRole("role-cashier"), "cashier");
assert.strictEqual(normalizeRole("cashier"), "cashier");
assert.strictEqual(normalizeRole("Head Cashier"), "cashier");

assert.strictEqual(normalizeRole("role-kitchen"), "kitchen");
assert.strictEqual(normalizeRole("kitchen"), "kitchen");
assert.strictEqual(normalizeRole("chef"), "kitchen");

assert.strictEqual(normalizeRole("role-staff"), "staff");
assert.strictEqual(normalizeRole("staff"), "staff");

assert.strictEqual(normalizeRole(null), "cashier");
assert.strictEqual(normalizeRole(undefined), "cashier");

// 2. Display Name tests (No "Role-admin" ever!)
assert.strictEqual(getRoleDisplayName("role-admin"), "Admin");
assert.strictEqual(getRoleDisplayName("admin"), "Admin");
assert.strictEqual(getRoleDisplayName("role-manager"), "Manager");
assert.strictEqual(getRoleDisplayName("role-cashier"), "Cashier");
assert.strictEqual(getRoleDisplayName("role-kitchen"), "Kitchen");

// 3. canManageProducts tests
assert.strictEqual(canManageProducts("role-admin"), true);
assert.strictEqual(canManageProducts("admin"), true);
assert.strictEqual(canManageProducts("role-manager"), true);
assert.strictEqual(canManageProducts("manager"), true);
assert.strictEqual(canManageProducts("role-cashier"), true);
assert.strictEqual(canManageProducts("cashier"), true);
assert.strictEqual(canManageProducts("kitchen"), false);
assert.strictEqual(canManageProducts("kitchen", ["products.edit"]), true);
assert.strictEqual(canManageProducts("kitchen", ["*"]), true);
assert.strictEqual(canManageProducts("viewer"), false);

// 4. canManageTables tests
assert.strictEqual(canManageTables("role-admin"), true);
assert.strictEqual(canManageTables("admin"), true);
assert.strictEqual(canManageTables("role-manager"), true);
assert.strictEqual(canManageTables("cashier"), false);
assert.strictEqual(canManageTables("viewer"), false);

// 5. canManageCategories tests
assert.strictEqual(canManageCategories("role-admin"), true);
assert.strictEqual(canManageCategories("cashier"), true);
assert.strictEqual(canManageCategories("viewer"), false);

// 6. canAdjustStock tests
assert.strictEqual(canAdjustStock("role-admin"), true);
assert.strictEqual(canAdjustStock("cashier"), true);
assert.strictEqual(canAdjustStock("viewer"), false);

console.log("All RBAC and Role Normalization Unit Tests Passed Successfully!");
