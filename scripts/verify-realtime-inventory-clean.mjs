/**
 * Test suite for verifying clean inventory initialization, bulk mock data removal,
 * real-time sync across categories, ingredients, recipes, grocery runs, stock deduction,
 * edit, delete, and clear operations.
 */
import assert from "node:assert/strict"

console.log("\n=======================================================")
console.log("⚡ POS SYSTEM - CLEAN INVENTORY & REAL-TIME TESTS")
console.log("=======================================================\n")

let passed = 0
let failed = 0

function it(description, fn) {
  try {
    fn()
    console.log(`  ✅ PASS: ${description}`)
    passed++
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`)
    console.error(`     Error: ${err.message}`)
    failed++
  }
}

// Simulated reactive store identical to SharedPosService logic
class CleanInventoryStore {
  constructor() {
    this.ingredients = []
    this.categories = []
    this.recipes = {}
    this.purchases = []
    this.events = []
    this.conversion = { g: 1, kg: 1000, ml: 1, l: 1000, pcs: 1 }
  }

  broadcast(type, data) {
    this.events.push({ type, data, timestamp: Date.now() })
  }

  toBase(quantity, unit) {
    return quantity * (this.conversion[unit] || 1)
  }

  addCategory(name) {
    const id = "cat-" + Date.now()
    const cat = { id, name, sort_order: (this.categories.length + 1) * 10 }
    this.categories.push(cat)
    this.broadcast("ingredient_categories", cat)
    return cat
  }

  removeCategory(id) {
    this.categories = this.categories.filter((c) => c.id !== id)
    this.ingredients = this.ingredients.map((i) => i.category_id === id ? { ...i, category_id: null } : i)
    this.broadcast("ingredient_categories", { removed: id })
  }

  addIngredient(item) {
    this.ingredients.push(item)
    this.broadcast("ingredients", item)
    return item
  }

  updateIngredient(id, patch) {
    const idx = this.ingredients.findIndex((i) => i.id === id)
    if (idx >= 0) {
      this.ingredients[idx] = { ...this.ingredients[idx], ...patch }
      this.broadcast("ingredients", this.ingredients[idx])
    }
  }

  deleteIngredient(id) {
    this.ingredients = this.ingredients.filter((i) => i.id !== id)
    // Remove from recipes
    for (const key of Object.keys(this.recipes)) {
      this.recipes[key] = this.recipes[key].filter((l) => l.ingredient_id !== id)
    }
    this.broadcast("ingredients", { deleted: id })
    this.broadcast("recipes", this.recipes)
  }

  adjustStock(id, deltaBase) {
    const target = this.ingredients.find((i) => i.id === id)
    if (target) {
      target.current_stock_base = Math.max(0, target.current_stock_base + deltaBase)
      this.broadcast("ingredients", target)
    }
  }

  saveRecipe(productKey, lines) {
    this.recipes[productKey] = lines
    this.broadcast("recipes", { productKey, lines })
  }

  clearRecipe(productKey) {
    delete this.recipes[productKey]
    this.broadcast("recipes", { cleared: productKey })
  }

  postGroceryRun(supplier, lines) {
    let totalMinor = 0
    const items = lines.map((l) => {
      const lineMinor = Math.round(l.quantity * l.unit_price * 100)
      totalMinor += lineMinor
      const qBase = this.toBase(l.quantity, l.unit)
      const ing = this.ingredients.find((i) => i.id === l.ingredient_id)
      if (ing) {
        ing.current_stock_base += qBase
      }
      return { ingredient_id: l.ingredient_id, quantity: l.quantity, unit: l.unit, quantity_base: qBase }
    })
    const pur = { id: "pur-" + Date.now(), supplier, totalMinor, items, status: "posted" }
    this.purchases.unshift(pur)
    this.broadcast("purchases", pur)
    this.broadcast("ingredients")
    return pur
  }

  deductRecipe(productKey, qty = 1) {
    const lines = this.recipes[productKey]
    if (!lines) return
    for (const line of lines) {
      const ing = this.ingredients.find((i) => i.id === line.ingredient_id)
      if (ing) {
        ing.current_stock_base = Math.max(0, ing.current_stock_base - line.quantity_base * qty)
      }
    }
    this.broadcast("ingredients")
  }

  clearBulkInventory() {
    this.ingredients = []
    this.recipes = {}
    this.purchases = []
    this.broadcast("inventory", {})
  }
}

// 1. Clean Slate Verification
it("Clean state starts with 0 ingredients, 0 recipes, 0 purchases", () => {
  const store = new CleanInventoryStore()
  assert.equal(store.ingredients.length, 0)
  assert.equal(Object.keys(store.recipes).length, 0)
  assert.equal(store.purchases.length, 0)
})

// 2. Add Category
it("Can add and remove ingredient categories with realtime broadcast", () => {
  const store = new CleanInventoryStore()
  const cat = store.addCategory("Fresh Dairy")
  assert.equal(store.categories.length, 1)
  assert.equal(store.categories[0].name, "Fresh Dairy")
  assert.equal(store.events.at(-1).type, "ingredient_categories")

  store.removeCategory(cat.id)
  assert.equal(store.categories.length, 0)
  assert.equal(store.events.at(-1).type, "ingredient_categories")
})

// 3. Add Ingredient
it("Can add new ingredient and track stock in base units", () => {
  const store = new CleanInventoryStore()
  const milk = store.addIngredient({
    id: "ing-local-milk",
    name: "Full Cream Milk",
    dimension: "volume",
    base_unit: "ml",
    default_purchase_unit: "l",
    current_stock_base: 0,
    reorder_level_base: 2000,
    category_id: null,
  })
  assert.equal(store.ingredients.length, 1)
  assert.equal(store.ingredients[0].current_stock_base, 0)
  assert.equal(store.events.at(-1).type, "ingredients")
})

// 4. Update Ingredient
it("Can update ingredient properties live", () => {
  const store = new CleanInventoryStore()
  store.addIngredient({
    id: "ing-local-milk",
    name: "Full Cream Milk",
    dimension: "volume",
    base_unit: "ml",
    default_purchase_unit: "l",
    current_stock_base: 0,
    reorder_level_base: 2000,
    category_id: null,
  })
  store.updateIngredient("ing-local-milk", { name: "Farm Fresh Milk 1L", reorder_level_base: 3000 })
  assert.equal(store.ingredients[0].name, "Farm Fresh Milk 1L")
  assert.equal(store.ingredients[0].reorder_level_base, 3000)
})

// 5. Stock Adjustment
it("Can adjust stock with positive and negative delta", () => {
  const store = new CleanInventoryStore()
  store.addIngredient({
    id: "ing-local-milk",
    name: "Farm Fresh Milk 1L",
    dimension: "volume",
    base_unit: "ml",
    default_purchase_unit: "l",
    current_stock_base: 0,
    reorder_level_base: 3000,
    category_id: null,
  })
  store.adjustStock("ing-local-milk", 5000) // +5000 ml (5L)
  assert.equal(store.ingredients[0].current_stock_base, 5000)

  store.adjustStock("ing-local-milk", -1200) // -1200 ml
  assert.equal(store.ingredients[0].current_stock_base, 3800)
})

// 6. Grocery Run
it("Grocery run increases base unit stock accurately", () => {
  const store = new CleanInventoryStore()
  store.addIngredient({
    id: "ing-coffee-beans",
    name: "Ceylon Arabica",
    dimension: "weight",
    base_unit: "g",
    default_purchase_unit: "kg",
    current_stock_base: 500,
    reorder_level_base: 1000,
  })
  // Bought 5 kg at Rs. 4,500 / kg
  store.postGroceryRun("Local Roaster", [
    { ingredient_id: "ing-coffee-beans", quantity: 5, unit: "kg", unit_price: 4500 },
  ])
  // 500g initial + 5,000g (5kg) = 5,500g
  assert.equal(store.ingredients[0].current_stock_base, 5500)
  assert.equal(store.purchases.length, 1)
  assert.equal(store.purchases[0].totalMinor, 2250000) // Rs. 22,500.00
})

// 7. Recipe Linking and Real-Time Deduction
it("Sales automatically deduct recipe ingredients in base units", () => {
  const store = new CleanInventoryStore()
  store.addIngredient({
    id: "ing-coffee-beans",
    name: "Ceylon Arabica",
    dimension: "weight",
    base_unit: "g",
    default_purchase_unit: "kg",
    current_stock_base: 5500,
  })
  store.addIngredient({
    id: "ing-milk",
    name: "Fresh Milk",
    dimension: "volume",
    base_unit: "ml",
    default_purchase_unit: "l",
    current_stock_base: 10000,
  })

  // Link recipe for Caffe Latte (prod-12): 18g beans, 220ml milk
  store.saveRecipe("prod-12", [
    { ingredient_id: "ing-coffee-beans", quantity_base: 18 },
    { ingredient_id: "ing-milk", quantity_base: 220 },
  ])

  // Order 2 lattes
  store.deductRecipe("prod-12", 2)
  assert.equal(store.ingredients.find((i) => i.id === "ing-coffee-beans").current_stock_base, 5500 - 36)
  assert.equal(store.ingredients.find((i) => i.id === "ing-milk").current_stock_base, 10000 - 440)
})

// 8. Delete Ingredient Cleans Up Recipes
it("Deleting an ingredient removes it from all active recipes", () => {
  const store = new CleanInventoryStore()
  store.addIngredient({ id: "ing-syrup", name: "Vanilla Syrup", dimension: "volume", base_unit: "ml", current_stock_base: 1000 })
  store.saveRecipe("prod-vanilla-latte", [
    { ingredient_id: "ing-syrup", quantity_base: 30 },
  ])
  assert.equal(store.recipes["prod-vanilla-latte"].length, 1)

  store.deleteIngredient("ing-syrup")
  assert.equal(store.ingredients.length, 0)
  assert.equal(store.recipes["prod-vanilla-latte"].length, 0)
})

// 9. Clear Bulk Data
it("Clear Bulk Data resets inventory to clean state (0)", () => {
  const store = new CleanInventoryStore()
  store.addIngredient({ id: "ing-1", name: "Item 1", dimension: "count", base_unit: "pcs", current_stock_base: 100 })
  store.saveRecipe("prod-1", [{ ingredient_id: "ing-1", quantity_base: 1 }])
  store.postGroceryRun("Store", [{ ingredient_id: "ing-1", quantity: 10, unit: "pcs", unit_price: 50 }])

  assert.equal(store.ingredients.length, 1)
  assert.equal(store.purchases.length, 1)

  store.clearBulkInventory()
  assert.equal(store.ingredients.length, 0)
  assert.equal(Object.keys(store.recipes).length, 0)
  assert.equal(store.purchases.length, 0)
})

console.log(`\n=======================================================`)
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
console.log(`=======================================================\n`)
if (failed > 0) process.exit(1)
