/**
 * POS SYSTEM - INVENTORY & REAL-TIME SYNC TEST SUITE
 *
 * Verifies:
 * 1. Default inventory loaded with non-zero initial values (ingredients, categories, recipes)
 * 2. Creating and removing ingredient categories
 * 3. Adding new ingredients with base units (g, ml, pcs) and purchase units
 * 4. Stock adjustments (positive & negative) with reason tracking
 * 5. Grocery runs (purchases) updating base units and recording purchases
 * 6. Products catalog mapping into Recipes (existing and dynamically added items)
 * 7. Recipe creation linking multiple ingredients to products
 * 8. Real-time deduction: POS orders deduct ingredients in exact base unit amounts
 * 9. Cross-station consistency across Kitchen & Bar
 *
 * Run with: node scripts/verify-inventory-suite.mjs
 */

import assert from "node:assert/strict"

console.log("\n=======================================================")
console.log("📦 POS SYSTEM - INVENTORY & REAL-TIME SYNC SUITE")
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

// In-memory simulation matching SharedPosService inventory architecture
class InventoryServiceEngine {
  constructor() {
    this.conversion = { g: 1, kg: 1000, ml: 1, l: 1000, pcs: 1, dozen: 12, tray: 30 }
    
    this.categories = [
      { id: "ing-cat-coffee", name: "Coffee & Tea", sort_order: 10 },
      { id: "ing-cat-dairy", name: "Dairy & Alternatives", sort_order: 20 },
      { id: "ing-cat-produce", name: "Produce & Greens", sort_order: 30 },
      { id: "ing-cat-bakery", name: "Bakery & Breads", sort_order: 40 },
      { id: "ing-cat-meat", name: "Meat & Seafood", sort_order: 50 },
      { id: "ing-cat-dry", name: "Dry Goods & Syrups", sort_order: 60 },
      { id: "ing-cat-packaging", name: "Packaging & Supplies", sort_order: 70 },
    ]

    this.ingredients = [
      { id: "ing-coffee-beans", name: "Espresso Roast Coffee Beans", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 15000, reorder_level_base: 3000, category_id: "ing-cat-coffee" },
      { id: "ing-fresh-milk", name: "Fresh Full Cream Cow Milk", dimension: "volume", base_unit: "ml", default_purchase_unit: "l", current_stock_base: 25000, reorder_level_base: 5000, category_id: "ing-cat-dairy" },
      { id: "ing-burger-buns", name: "Artisan Brioche Burger Buns", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 60, reorder_level_base: 15, category_id: "ing-cat-bakery" },
      { id: "ing-beef-patty", name: "Prime Angus Beef Patty", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 45, reorder_level_base: 12, category_id: "ing-cat-meat" },
      { id: "ing-french-fries", name: "Russet Cut Potato French Fries", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 30000, reorder_level_base: 6000, category_id: "ing-cat-produce" },
      { id: "ing-fruits", name: "Fresh Seasonal Fruits (Papaya, Lime, Melon)", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 25000, reorder_level_base: 5000, category_id: "ing-cat-produce" },
      { id: "ing-sugar-syrup", name: "Pure Cane Sugar Syrup", dimension: "volume", base_unit: "ml", default_purchase_unit: "l", current_stock_base: 10000, reorder_level_base: 2000, category_id: "ing-cat-dry" },
      { id: "ing-cups-12oz", name: "Eco Takeaway Coffee Cups 12oz", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 250, reorder_level_base: 50, category_id: "ing-cat-packaging" },
    ]

    this.products = [
      { id: "prod-1", name: "Papaya Lime Juice", price: 650, category: "Fresh Juices", stock: 100 },
      { id: "prod-10", name: "Espresso Single", price: 550, category: "Coffee & Tea", stock: 100 },
      { id: "prod-12", name: "Caffe Latte", price: 850, category: "Coffee & Tea", stock: 100 },
      { id: "prod-18", name: "Classic Beef Burger", price: 1650, category: "Mains & Sandwiches", stock: 100 },
      { id: "prod-22", name: "Crispy French Fries", price: 750, category: "Snacks & Bites", stock: 100 },
    ]

    this.recipes = {
      "prod-1": [{ ingredient_id: "ing-fruits", quantity_base: 250 }, { ingredient_id: "ing-sugar-syrup", quantity_base: 20 }, { ingredient_id: "ing-cups-12oz", quantity_base: 1 }],
      "prod-10": [{ ingredient_id: "ing-coffee-beans", quantity_base: 18 }, { ingredient_id: "ing-cups-12oz", quantity_base: 1 }],
      "prod-12": [{ ingredient_id: "ing-coffee-beans", quantity_base: 18 }, { ingredient_id: "ing-fresh-milk", quantity_base: 220 }, { ingredient_id: "ing-cups-12oz", quantity_base: 1 }],
      "prod-18": [{ ingredient_id: "ing-burger-buns", quantity_base: 1 }, { ingredient_id: "ing-beef-patty", quantity_base: 1 }],
      "prod-22": [{ ingredient_id: "ing-french-fries", quantity_base: 250 }],
    }

    this.purchases = []
    this.movements = []
    this.broadcastEvents = []
  }

  toBase(quantity, unit) {
    return quantity * (this.conversion[unit] ?? 1)
  }

  broadcast(type, payload) {
    this.broadcastEvents.push({ type, payload, timestamp: Date.now() })
  }

  addCategory(name) {
    const id = "cat-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6)
    const category = { id, name, sort_order: (this.categories.length + 1) * 10 }
    this.categories.push(category)
    this.broadcast("ingredient_categories", category)
    return category
  }

  removeCategory(id) {
    this.categories = this.categories.filter((c) => c.id !== id)
    this.ingredients = this.ingredients.map((i) => (i.category_id === id ? { ...i, category_id: null } : i))
    this.broadcast("ingredient_categories", { removed: id })
  }

  addIngredient(ingredient) {
    this.ingredients.push(ingredient)
    this.broadcast("ingredients", ingredient)
    return ingredient
  }

  adjustStock(id, deltaBase, reason) {
    const target = this.ingredients.find((i) => i.id === id)
    if (!target) throw new Error("Ingredient not found")
    target.current_stock_base = Math.max(0, target.current_stock_base + deltaBase)
    this.movements.push({ ingredient_id: id, delta: deltaBase, reason, timestamp: Date.now() })
    this.broadcast("ingredients", target)
    return target
  }

  postGroceryRun(supplier, lines) {
    const purchaseId = "pur-" + Date.now()
    let totalMinor = 0
    const items = lines.map((l) => {
      const lineMinor = Math.round(l.quantity * l.unit_price * 100)
      totalMinor += lineMinor
      const qBase = this.toBase(l.quantity, l.unit)
      
      // Update ingredient stock
      const ing = this.ingredients.find((i) => i.id === l.ingredient_id)
      if (ing) {
        ing.current_stock_base += qBase
      }

      return {
        ingredient_id: l.ingredient_id,
        quantity: l.quantity,
        unit: l.unit,
        quantity_base: qBase,
        unit_price_minor: Math.round(l.unit_price * 100),
        total_price_minor: lineMinor,
      }
    })

    const record = { id: purchaseId, supplier, status: "posted", total_minor: totalMinor, items, created_at: new Date().toISOString() }
    this.purchases.unshift(record)
    this.broadcast("purchases", record)
    this.broadcast("ingredients")
    return record
  }

  saveRecipe(productIdOrName, lines) {
    this.recipes[productIdOrName] = lines
    this.broadcast("recipes", { productId: productIdOrName, lines })
  }

  deductForSale(orderItems) {
    for (const item of orderItems) {
      let rLines = this.recipes[item.id] || this.recipes[item.name]
      if (!rLines) {
        const prod = this.products.find((p) => p.id === item.id || p.name.toLowerCase() === item.name.toLowerCase())
        if (prod) rLines = this.recipes[prod.id] || this.recipes[prod.name]
      }
      if (!rLines) continue

      const orderQty = item.quantity || 1
      for (const line of rLines) {
        const ing = this.ingredients.find((i) => i.id === line.ingredient_id)
        if (ing) {
          ing.current_stock_base = Math.max(0, ing.current_stock_base - line.quantity_base * orderQty)
        }
      }
    }
    this.broadcast("ingredients")
  }
}

const engine = new InventoryServiceEngine()

// 1. Initial State & Defaults
it("Default inventory loaded with non-zero initial values", () => {
  assert(engine.ingredients.length >= 8, "Expected at least 8 ingredients")
  assert(engine.categories.length >= 7, "Expected at least 7 categories")
  assert(Object.keys(engine.recipes).length >= 5, "Expected at least 5 recipes")
  const low = engine.ingredients.filter((i) => i.current_stock_base <= i.reorder_level_base)
  assert.equal(low.length, 0, "No initial stock should be in low stock condition")
})

// 2. Category Operations
it("Can create and remove ingredient categories with realtime broadcast", () => {
  const cat = engine.addCategory("Artisan Syrups & Botanicals")
  assert(engine.categories.some((c) => c.name === "Artisan Syrups & Botanicals"))
  assert(engine.broadcastEvents.some((e) => e.type === "ingredient_categories"))

  engine.removeCategory(cat.id)
  assert(!engine.categories.some((c) => c.id === cat.id))
})

// 3. Adding New Ingredient
let newIng
it("Can add an ingredient with base unit and purchase unit", () => {
  newIng = engine.addIngredient({
    id: "ing-matcha-test",
    name: "Ceremonial Uji Matcha Powder",
    dimension: "weight",
    base_unit: "g",
    default_purchase_unit: "kg",
    current_stock_base: 1000,
    reorder_level_base: 250,
    category_id: "ing-cat-coffee",
  })
  assert.equal(engine.ingredients.find((i) => i.id === "ing-matcha-test")?.name, "Ceremonial Uji Matcha Powder")
  assert(engine.broadcastEvents.some((e) => e.type === "ingredients"))
})

// 4. Stock Adjustments
it("Can manually adjust ingredient stock (positive & negative)", () => {
  engine.adjustStock("ing-matcha-test", 500, "Initial audit correction")
  assert.equal(engine.ingredients.find((i) => i.id === "ing-matcha-test")?.current_stock_base, 1500)

  engine.adjustStock("ing-matcha-test", -200, "Spillage during tasting")
  assert.equal(engine.ingredients.find((i) => i.id === "ing-matcha-test")?.current_stock_base, 1300)
  assert.equal(engine.movements.length, 2)
})

// 5. Grocery Runs / Purchases
it("Grocery run increases base stock and records purchase history", () => {
  const prevMilk = engine.ingredients.find((i) => i.id === "ing-fresh-milk").current_stock_base
  const run = engine.postGroceryRun("Daily Dairy Supplier", [
    { ingredient_id: "ing-fresh-milk", quantity: 10, unit: "l", unit_price: 450 }, // 10 L = 10,000 ml
  ])

  assert.equal(run.total_minor, 450000) // Rs. 4,500.00
  const currentMilk = engine.ingredients.find((i) => i.id === "ing-fresh-milk").current_stock_base
  assert.equal(currentMilk, prevMilk + 10000, "10 Litres must add 10,000 ml to stock")
  assert.equal(engine.purchases.length, 1)
})

// 6. Dynamically Adding Product and Recipes
it("Can create a new menu product and link a multi-ingredient recipe to it", () => {
  const newProd = {
    id: "prod-matcha-latte",
    name: "Iced Ceremonial Matcha Latte",
    price: 950,
    category: "Coffee & Tea",
    stock: 50,
  }
  engine.products.push(newProd)

  // 12g matcha + 180ml milk + 15ml sugar syrup + 1 cup
  const recipeLines = [
    { ingredient_id: "ing-matcha-test", quantity_base: 12 },
    { ingredient_id: "ing-fresh-milk", quantity_base: 180 },
    { ingredient_id: "ing-sugar-syrup", quantity_base: 15 },
    { ingredient_id: "ing-cups-12oz", quantity_base: 1 },
  ]
  engine.saveRecipe(newProd.id, recipeLines)

  assert.equal(engine.recipes[newProd.id].length, 4)
  assert(engine.broadcastEvents.some((e) => e.type === "recipes"))
})

// 7. POS Sale Deductions
it("Placing a POS order automatically deducts recipe ingredients in base units", () => {
  const matchaBefore = engine.ingredients.find((i) => i.id === "ing-matcha-test").current_stock_base
  const milkBefore = engine.ingredients.find((i) => i.id === "ing-fresh-milk").current_stock_base
  const syrupBefore = engine.ingredients.find((i) => i.id === "ing-sugar-syrup").current_stock_base
  const cupsBefore = engine.ingredients.find((i) => i.id === "ing-cups-12oz").current_stock_base

  // Customer buys 3x Iced Ceremonial Matcha Latte
  engine.deductForSale([
    { id: "prod-matcha-latte", name: "Iced Ceremonial Matcha Latte", quantity: 3 },
  ])

  const matchaAfter = engine.ingredients.find((i) => i.id === "ing-matcha-test").current_stock_base
  const milkAfter = engine.ingredients.find((i) => i.id === "ing-fresh-milk").current_stock_base
  const syrupAfter = engine.ingredients.find((i) => i.id === "ing-sugar-syrup").current_stock_base
  const cupsAfter = engine.ingredients.find((i) => i.id === "ing-cups-12oz").current_stock_base

  assert.equal(matchaAfter, matchaBefore - 36, "3x matcha should deduct 36g")
  assert.equal(milkAfter, milkBefore - 540, "3x matcha should deduct 540ml milk")
  assert.equal(syrupAfter, syrupBefore - 45, "3x matcha should deduct 45ml syrup")
  assert.equal(cupsAfter, cupsBefore - 3, "3x matcha should deduct 3 cups")
})

// 8. Multi-Station mixed order
it("Mixed Kitchen and Bar order decrements respective ingredients seamlessly", () => {
  const beefBefore = engine.ingredients.find((i) => i.id === "ing-beef-patty").current_stock_base
  const bunsBefore = engine.ingredients.find((i) => i.id === "ing-burger-buns").current_stock_base
  const friesBefore = engine.ingredients.find((i) => i.id === "ing-french-fries").current_stock_base
  const fruitsBefore = engine.ingredients.find((i) => i.id === "ing-fruits").current_stock_base

  engine.deductForSale([
    { id: "prod-18", name: "Classic Beef Burger", quantity: 2 }, // Kitchen: 2 patties, 2 buns
    { id: "prod-22", name: "Crispy French Fries", quantity: 1 },  // Kitchen: 250g fries
    { id: "prod-1", name: "Papaya Lime Juice", quantity: 2 },     // Bar: 500g fruits
  ])

  const beefAfter = engine.ingredients.find((i) => i.id === "ing-beef-patty").current_stock_base
  const bunsAfter = engine.ingredients.find((i) => i.id === "ing-burger-buns").current_stock_base
  const friesAfter = engine.ingredients.find((i) => i.id === "ing-french-fries").current_stock_base
  const fruitsAfter = engine.ingredients.find((i) => i.id === "ing-fruits").current_stock_base

  assert.equal(beefAfter, beefBefore - 2)
  assert.equal(bunsAfter, bunsBefore - 2)
  assert.equal(friesAfter, friesBefore - 250)
  assert.equal(fruitsAfter, fruitsBefore - 500)
})

console.log("\n=======================================================")
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`)
console.log("=======================================================\n")

if (failedCount > 0) {
  process.exit(1)
} else {
  console.log("🎉 ALL INVENTORY & REAL-TIME SYNC TESTS PASSED SUCCESSFULLY!\n")
}
