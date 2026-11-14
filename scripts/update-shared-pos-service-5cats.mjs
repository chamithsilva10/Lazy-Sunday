import fs from "fs"
import {
  CATEGORIES_DATA,
  PRODUCTS_DATA,
  INGREDIENT_CATEGORIES_DATA,
  INGREDIENTS_DATA,
  RECIPES_DATA,
} from "./seed-new-lazy-sunday-menu.mjs"

const catIdMap = {
  "Coffee & Hot Drinks": "cat-coffee-hot-drinks",
  "Cold Drinks": "cat-cold-drinks",
  "Meals": "cat-meals",
  "Salads": "cat-salads",
  "Bakery & Desserts": "cat-bakery-desserts",
}

const ingCatIdMap = {
  "Coffee & Teas": "ing-cat-coffee-tea",
  "Dairy & Alternatives": "ing-cat-dairy",
  "Beverages & Sodas": "ing-cat-beverages",
  "Produce & Fresh Herbs": "ing-cat-produce",
  "Meat & Poultry": "ing-cat-meat",
  "Bakery & Dry Goods": "ing-cat-bakery-dry",
}

// 1. UPDATE lib/shared-pos-service.ts
console.log("Updating lib/shared-pos-service.ts...")
let sharedPosContent = fs.readFileSync("lib/shared-pos-service.ts", "utf8")

const sharedCategories = CATEGORIES_DATA.map((c) => ({
  id: c.id,
  name: c.name,
  sort_order: c.sort_order,
}))

const sharedProducts = PRODUCTS_DATA.map((p, idx) => ({
  id: `prod-${101 + idx}`,
  name: p.name,
  price: p.price,
  category: p.category_name,
  category_id: catIdMap[p.category_name],
  image: p.image,
  stock: 100,
  description: p.description,
  temperature: (p.temperature === "hot" ? "hot" : p.temperature === "cold" ? "iced" : "none"),
  dietary_tags: p.dietary_tags,
  department: p.department,
  station: p.station,
  active: true,
  is_archived: false,
}))

const sharedIngCats = INGREDIENT_CATEGORIES_DATA.map((c) => ({
  id: c.id,
  name: c.name,
  sort_order: c.sort_order,
}))

const sharedIngs = INGREDIENTS_DATA.map((i) => ({
  id: i.id,
  name: i.name,
  dimension: i.dimension,
  base_unit: i.base_unit,
  default_purchase_unit: i.default_purchase_unit,
  current_stock_base: i.current_stock_base,
  reorder_level_base: i.reorder_level_base,
  category_id: ingCatIdMap[i.category_name],
}))

const sharedRecipes = {}
for (const [prodName, lines] of Object.entries(RECIPES_DATA)) {
  const prod = sharedProducts.find((p) => p.name === prodName)
  if (prod) {
    sharedRecipes[prod.id] = lines.map((l) => ({
      ingredient_id: l.ingredient_id,
      quantity_base: l.quantity_base,
    }))
    sharedRecipes[prod.name] = lines.map((l) => ({
      ingredient_id: l.ingredient_id,
      quantity_base: l.quantity_base,
    }))
  }
}

// Replace DEFAULT_ blocks
const blockStart = "export const DEFAULT_CATEGORIES: SharedCategory[] = []"
const blockEnd = "export const DEFAULT_INITIAL_ORDERS: SharedOrder[] = []"

const newBlock = `export const DEFAULT_CATEGORIES: SharedCategory[] = ${JSON.stringify(sharedCategories, null, 2)}

export const DEFAULT_INGREDIENT_CATEGORIES: SharedIngredientCategory[] = ${JSON.stringify(sharedIngCats, null, 2)}

export const DEFAULT_INGREDIENTS: SharedIngredient[] = ${JSON.stringify(sharedIngs, null, 2)}

export const DEFAULT_RECIPES: Record<string, SharedRecipeItem[]> = ${JSON.stringify(sharedRecipes, null, 2)}

export const DEFAULT_PRODUCTS: SharedProduct[] = ${JSON.stringify(sharedProducts, null, 2)}
`

if (!sharedPosContent.includes(blockStart)) throw new Error("Could not find blockStart in shared-pos-service.ts")
if (!sharedPosContent.includes(blockEnd)) throw new Error("Could not find blockEnd in shared-pos-service.ts")

const idxStart = sharedPosContent.indexOf(blockStart)
const idxEnd = sharedPosContent.indexOf(blockEnd)
sharedPosContent = sharedPosContent.slice(0, idxStart) + newBlock + "\n" + sharedPosContent.slice(idxEnd)

// Update caches
sharedPosContent = sharedPosContent.replace(
  "private static productsCache: SharedProduct[] = []",
  "private static productsCache: SharedProduct[] = DEFAULT_PRODUCTS.map((p) => ({ ...p }))"
)
sharedPosContent = sharedPosContent.replace(
  "private static categoriesCache: SharedCategory[] = []",
  "private static categoriesCache: SharedCategory[] = DEFAULT_CATEGORIES.map((c) => ({ ...c }))"
)
sharedPosContent = sharedPosContent.replace(
  "private static ingredientsCache: SharedIngredient[] = []",
  "private static ingredientsCache: SharedIngredient[] = DEFAULT_INGREDIENTS.map((i) => ({ ...i }))"
)
sharedPosContent = sharedPosContent.replace(
  "private static ingredientCategoriesCache: SharedIngredientCategory[] = []",
  "private static ingredientCategoriesCache: SharedIngredientCategory[] = DEFAULT_INGREDIENT_CATEGORIES.map((c) => ({ ...c }))"
)
sharedPosContent = sharedPosContent.replace(
  "private static recipesCache: Record<string, SharedRecipeItem[]> = {}",
  "private static recipesCache: Record<string, SharedRecipeItem[]> = { ...DEFAULT_RECIPES }"
)

// Update init purge flag to populate storage
const oldPurgeAnchor = 'const PURE_ZERO_V7_FLAG = "pos_pure_zero_products_v7"'
const newPurgeCode = `const LAZY_SUNDAY_5CATS_FLAG = "pos_lazy_sunday_5cats_41prods_v2"
    if (this.isBrowser() && localStorage.getItem(LAZY_SUNDAY_5CATS_FLAG) !== "true") {
      try {
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS))
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES))
        localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(DEFAULT_INGREDIENTS))
        localStorage.setItem(INGREDIENT_CATEGORIES_KEY, JSON.stringify(DEFAULT_INGREDIENT_CATEGORIES))
        localStorage.setItem(RECIPES_KEY, JSON.stringify(DEFAULT_RECIPES))
        localStorage.removeItem(ORDERS_KEY)
        localStorage.removeItem(PURCHASES_KEY)
        localStorage.removeItem(WASTAGE_KEY)
        localStorage.removeItem(ADJUSTMENTS_KEY)
        localStorage.removeItem("pos_coffee_bills")
        localStorage.removeItem("pos_mock_orders")
        localStorage.setItem(ORDERS_KEY, "[]")
        localStorage.setItem(LAZY_SUNDAY_5CATS_FLAG, "true")
      } catch {}
    }

    ${oldPurgeAnchor}`

if (sharedPosContent.includes(oldPurgeAnchor)) {
  sharedPosContent = sharedPosContent.replace(oldPurgeAnchor, newPurgeCode)
}

fs.writeFileSync("lib/shared-pos-service.ts", sharedPosContent, "utf8")
console.log("✓ Successfully updated lib/shared-pos-service.ts!")

// 2. UPDATE app/data/products.tsx
console.log("Updating app/data/products.tsx...")
let dataProductsContent = `import type { Product } from "../context/cart-context"
import { resolveProductImage } from "@/lib/product-images"
import { determineItemStation } from "@/lib/station-routing"

export type MenuProduct = Product & {
  description?: string
  productType?: string
  isVegan?: boolean
  isGlutenFree?: boolean
  modifiers?: string[]
  station?: "kitchen" | "bar"
  department?: string
}

export const productCategories: string[] = [
  "Coffee & Hot Drinks",
  "Cold Drinks",
  "Meals",
  "Salads",
  "Bakery & Desserts",
]

export const products: MenuProduct[] = [
${PRODUCTS_DATA.map((p, idx) => {
  const isVegan = p.dietary_tags.includes("Vegan")
  const isGlutenFree = p.dietary_tags.includes("Gluten-Free")
  return `  {
    id: ${101 + idx},
    name: ${JSON.stringify(p.name)},
    price: ${p.price},
    category: ${JSON.stringify(p.category_name)},
    image: ${JSON.stringify(p.image)},
    description: ${JSON.stringify(p.description)},
    isVegan: ${isVegan},
    isGlutenFree: ${isGlutenFree},
    station: ${JSON.stringify(p.station)},
    department: ${JSON.stringify(p.department)},
  },`
}).join("\n")}
]

export const modifiers = [
  { name: "Hot", price: 0 },
  { name: "Iced", price: 0 },
  { name: "Oat Milk", price: 200 },
  { name: "Coconut Milk", price: 150 },
  { name: "Sourdough", price: 0 },
  { name: "Hashbrowns", price: 0 },
  { name: "Scrambled", price: 0 },
  { name: "Fried", price: 0 },
  { name: "Fries", price: 0 },
  { name: "Salad", price: 0 },
]

export { products as demoMenu }
`
fs.writeFileSync("app/data/products.tsx", dataProductsContent, "utf8")
console.log("✓ Successfully updated app/data/products.tsx!")

// 3. UPDATE lib/mock/pos-mock-data.ts
console.log("Updating lib/mock/pos-mock-data.ts...")
let mockContent = fs.readFileSync("lib/mock/pos-mock-data.ts", "utf8")

const mockCatsStr = `export const MOCK_CATEGORIES: MockCategory[] = ${JSON.stringify(
  CATEGORIES_DATA.map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sort_order,
    is_active: true,
  })),
  null,
  2
)}`

const mockProdsStr = `export const MOCK_PRODUCTS: MockProduct[] = ${JSON.stringify(
  PRODUCTS_DATA.map((p, idx) => ({
    id: `prod-${101 + idx}`,
    name: p.name,
    sku: `LS-${p.station === "bar" ? "BAR" : "KIT"}-${String(idx + 1).padStart(3, "0")}`,
    barcode: `890123456${String(idx + 1).padStart(3, "0")}`,
    price: p.price,
    cost_price: p.cost,
    stock: 100,
    category: p.category_name,
    category_id: catIdMap[p.category_name],
    station: p.station,
    department: p.department,
    image: p.image,
    description: p.description,
    temperature: p.temperature === "hot" ? "hot" : p.temperature === "cold" ? "cold" : "none",
    dietary_tags: p.dietary_tags,
    tax_rate: 0,
  })),
  null,
  2
)}`

mockContent = mockContent.replace("export const MOCK_CATEGORIES: MockCategory[] = []", mockCatsStr)
mockContent = mockContent.replace("export const MOCK_PRODUCTS: MockProduct[] = []", mockProdsStr)
fs.writeFileSync("lib/mock/pos-mock-data.ts", mockContent, "utf8")
console.log("✓ Successfully updated lib/mock/pos-mock-data.ts!")
