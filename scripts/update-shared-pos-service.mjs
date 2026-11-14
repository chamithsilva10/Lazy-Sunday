import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.resolve(__dirname, "../lib/shared-pos-service.ts")
let content = fs.readFileSync(filePath, "utf-8")

// 1. New 41 Products string
const newDefaultProductsStr = `export const DEFAULT_PRODUCTS: SharedProduct[] = [
  // --- BAR: Coffee (7) ---
  { id: "prod-101", name: "Ristretto", price: 500, category: "Coffee", category_id: "cat-coffee", image: resolveProductImage("Ristretto", null, "Coffee"), stock: 100, description: "Short concentrated espresso shot with thick crema", temperature: "hot", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-102", name: "Espresso", price: 500, category: "Coffee", category_id: "cat-coffee", image: resolveProductImage("Espresso", null, "Coffee"), stock: 100, description: "Full-bodied single origin espresso extraction", temperature: "hot", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-103", name: "Long Black", price: 650, category: "Coffee", category_id: "cat-coffee", image: resolveProductImage("Long Black", null, "Coffee"), stock: 100, description: "Double shot espresso poured over hot or iced water", temperature: "hot", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-104", name: "Flat White", price: 750, category: "Coffee", category_id: "cat-coffee", image: resolveProductImage("Flat White", null, "Coffee"), stock: 100, description: "Velvety micro-foam over double ristretto", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-105", name: "Cappuccino", price: 750, category: "Coffee", category_id: "cat-coffee", image: resolveProductImage("Cappuccino", null, "Coffee"), stock: 100, description: "Rich espresso, steamed milk, and dense foam", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-106", name: "Latte", price: 800, category: "Coffee", category_id: "cat-coffee", image: "/latte-coffee.png", stock: 100, description: "Smooth espresso with gently steamed milk", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-107", name: "Mocha", price: 950, category: "Coffee", category_id: "cat-coffee", image: resolveProductImage("Mocha", null, "Coffee"), stock: 100, description: "Espresso blended with artisanal dark chocolate and steamed milk", temperature: "hot", department: "Coffee Bar", station: "bar" },

  // --- BAR: Filter Coffee (1) ---
  { id: "prod-108", name: "V60 Pour Over", price: 1100, category: "Filter Coffee", category_id: "cat-filter-coffee", image: resolveProductImage("V60 Pour Over", null, "Filter Coffee"), stock: 100, description: "Single-origin pour over filter brew", temperature: "hot", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },

  // --- BAR: Matcha & Chocolate (3) ---
  { id: "prod-109", name: "Matcha Latte", price: 950, category: "Matcha & Chocolate", category_id: "cat-matcha-chocolate", image: resolveProductImage("Matcha Latte", null, "Matcha & Chocolate"), stock: 100, description: "Ceremonial Japanese green tea whisked with silky milk", temperature: "hot", department: "Coffee Bar", station: "bar" },
  { id: "prod-110", name: "Mango Matcha", price: 1050, category: "Matcha & Chocolate", category_id: "cat-matcha-chocolate", image: resolveProductImage("Mango Matcha", null, "Matcha & Chocolate"), stock: 100, description: "Tropical mango puree layered with iced ceremonial matcha", temperature: "cold", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-111", name: "Chocolate — Hot / Iced", price: 900, category: "Matcha & Chocolate", category_id: "cat-matcha-chocolate", image: resolveProductImage("Chocolate — Hot / Iced", null, "Matcha & Chocolate"), stock: 100, description: "Rich melted dark cocoa served hot or over ice", temperature: "hot", department: "Coffee Bar", station: "bar" },

  // --- BAR: Tea (4) ---
  { id: "prod-112", name: "Ceylon Breakfast", price: 400, category: "Tea", category_id: "cat-tea", image: resolveProductImage("Ceylon Breakfast", null, "Tea"), stock: 100, description: "High-grown Nuwara Eliya whole leaf black tea", temperature: "hot", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-113", name: "Green Tea", price: 450, category: "Tea", category_id: "cat-tea", image: resolveProductImage("Green Tea", null, "Tea"), stock: 100, description: "Clean, fresh steamed whole-leaf green tea", temperature: "hot", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-114", name: "Ginger & Lemongrass", price: 450, category: "Tea", category_id: "cat-tea", image: resolveProductImage("Ginger & Lemongrass", null, "Tea"), stock: 100, description: "Herbal infusion of lemongrass stalks and spicy ginger", temperature: "hot", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-115", name: "Chai", price: 650, category: "Tea", category_id: "cat-tea", image: resolveProductImage("Chai", null, "Tea"), stock: 100, description: "Spiced black tea brewed with cardamoms, cinnamon, and milk", temperature: "hot", department: "Coffee Bar", station: "bar" },

  // --- BAR: Fresh Drinks & House Sodas (4) ---
  { id: "prod-116", name: "King Coconut", price: 450, category: "Fresh Drinks & House Sodas", category_id: "cat-fresh-sodas", image: resolveProductImage("King Coconut", null, "Fresh Drinks & House Sodas"), stock: 100, description: "Freshly cracked Sri Lankan thambili water served chilled", temperature: "cold", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-117", name: "House Lime Soda", price: 650, category: "Fresh Drinks & House Sodas", category_id: "cat-fresh-sodas", image: resolveProductImage("House Lime Soda", null, "Fresh Drinks & House Sodas"), stock: 100, description: "Fresh lime juice with sparkling soda and cane syrup", temperature: "cold", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-118", name: "House Pineapple & Mint Soda", price: 750, category: "Fresh Drinks & House Sodas", category_id: "cat-fresh-sodas", image: resolveProductImage("House Pineapple & Mint Soda", null, "Fresh Drinks & House Sodas"), stock: 100, description: "Crushed sweet pineapple and garden mint with bubbly soda", temperature: "cold", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-119", name: "Passion Soda", price: 750, category: "Fresh Drinks & House Sodas", category_id: "cat-fresh-sodas", image: resolveProductImage("Passion Soda", null, "Fresh Drinks & House Sodas"), stock: 100, description: "Tangy tropical passionfruit pulp, lime, and sparkling soda", temperature: "cold", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },

  // --- BAR: Smoothies & Shakes (2) ---
  { id: "prod-120", name: "Mango Smoothie", price: 950, category: "Smoothies & Shakes", category_id: "cat-smoothies-shakes", image: resolveProductImage("Mango Smoothie", null, "Smoothies & Shakes"), stock: 100, description: "Ripe mangoes, banana, and chilled coconut milk", temperature: "cold", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-121", name: "Peanut Butter Shake", price: 1100, category: "Smoothies & Shakes", category_id: "cat-smoothies-shakes", image: resolveProductImage("Peanut Butter Shake", null, "Smoothies & Shakes"), stock: 100, description: "Roasted peanut butter, banana, dairy milk, and honey", temperature: "cold", department: "Coffee Bar", station: "bar" },

  // --- BAR: SOZO Drinks (5) ---
  { id: "prod-122", name: "Pani Dodang & Sea Salt", price: 750, category: "SOZO Drinks", category_id: "cat-sozo-drinks", image: "/glass-of-orange-juice.png", stock: 100, description: "Sweet local orange infused with a subtle touch of sea salt", temperature: "cold", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-123", name: "Ginger Lemonade", price: 750, category: "SOZO Drinks", category_id: "cat-sozo-drinks", image: resolveProductImage("Ginger Lemonade", null, "SOZO Drinks"), stock: 100, description: "Fiery ginger with zesty lemon and sparkling spring water", temperature: "cold", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-124", name: "Peach & Mango Iced Tea", price: 800, category: "SOZO Drinks", category_id: "cat-sozo-drinks", image: "/iced-tea.png", stock: 100, description: "Cold brewed Ceylon black tea with orchard peach and mango", temperature: "cold", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-125", name: "Salted Coconut & Lime Sparkling", price: 800, category: "SOZO Drinks", category_id: "cat-sozo-drinks", image: resolveProductImage("Salted Coconut & Lime Sparkling", null, "SOZO Drinks"), stock: 100, description: "Sparkling king coconut water with tangy lime and sea salt", temperature: "cold", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },
  { id: "prod-126", name: "Sparkling Water", price: 500, category: "SOZO Drinks", category_id: "cat-sozo-drinks", image: "/bottled-water.png", stock: 100, description: "Pure chilled carbonated mineral spring water", temperature: "cold", department: "Coffee Bar", station: "bar", dietary_tags: ["VEG"] },

  // --- KITCHEN: Breakfast (4) ---
  { id: "prod-127", name: "Creamy Mushrooms", price: 1800, category: "Breakfast", category_id: "cat-breakfast", image: resolveProductImage("Creamy Mushrooms", null, "Breakfast"), stock: 100, description: "Sautéed mushrooms in garlic herb cream with Sourdough or Hashbrowns", temperature: "none", department: "Juice & Food", station: "kitchen" },
  { id: "prod-128", name: "Bacon and Eggs", price: 1900, category: "Breakfast", category_id: "cat-breakfast", image: resolveProductImage("Bacon and Eggs", null, "Breakfast"), stock: 100, description: "Smoked bacon, eggs (Scrambled / Fried) with Sourdough or Hashbrowns", temperature: "none", department: "Juice & Food", station: "kitchen" },
  { id: "prod-129", name: "Sri Lankan Chili Scramble", price: 1750, category: "Breakfast", category_id: "cat-breakfast", image: resolveProductImage("Sri Lankan Chili Scramble", null, "Breakfast"), stock: 100, description: "Eggs scrambled with green chilies, shallots, and toasted sourdough", temperature: "none", department: "Juice & Food", station: "kitchen" },
  { id: "prod-130", name: "Pancakes", price: 1600, category: "Breakfast", category_id: "cat-breakfast", image: resolveProductImage("Pancakes", null, "Breakfast"), stock: 100, description: "Golden buttermilk pancake stack with fruit, butter, and kithul treacle", temperature: "none", department: "Juice & Food", station: "kitchen" },

  // --- KITCHEN: Sandwiches (1) ---
  { id: "prod-131", name: "Grilled Chicken Sandwich", price: 1950, category: "Sandwiches", category_id: "cat-sandwiches", image: resolveProductImage("Grilled Chicken Sandwich", null, "Sandwiches"), stock: 100, description: "Herb-marinated chicken breast, garlic aioli, tomato with Fries or Salad", temperature: "none", department: "Juice & Food", station: "kitchen" },

  // --- KITCHEN: Salads (3) ---
  { id: "prod-132", name: "Roast Vegetable Salad", price: 1750, category: "Salads", category_id: "cat-salads", image: "/vibrant-mixed-salad.png", stock: 100, description: "Roasted pumpkin, sweet potato, seeds, greens, and balsamic glaze", temperature: "none", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },
  { id: "prod-133", name: "Pesto Pasta Salad", price: 1850, category: "Salads", category_id: "cat-salads", image: resolveProductImage("Pesto Pasta Salad", null, "Salads"), stock: 100, description: "Fusilli pasta tossed in basil cashew pesto, cherry tomatoes, and parmesan", temperature: "none", department: "Juice & Food", station: "kitchen" },
  { id: "prod-134", name: "Chickpea Salad", price: 1650, category: "Salads", category_id: "cat-salads", image: resolveProductImage("Chickpea Salad", null, "Salads"), stock: 100, description: "Cucumbers, spiced chickpeas, Kalamata olives, and lemon tahini dressing", temperature: "none", department: "Juice & Food", station: "kitchen", dietary_tags: ["VEG"] },

  // --- KITCHEN: Quiche (1) ---
  { id: "prod-135", name: "Hashbrown-Crust Bacon & Egg Quiche", price: 1850, category: "Quiche", category_id: "cat-quiche", image: resolveProductImage("Hashbrown-Crust Bacon & Egg Quiche", null, "Quiche"), stock: 100, description: "Shredded potato crust filled with bacon, eggs, cheddar with Fries or Salad", temperature: "none", department: "Juice & Food", station: "kitchen" },

  // --- KITCHEN: Bakery (4) ---
  { id: "prod-136", name: "Savoury Muffin", price: 650, category: "Bakery", category_id: "cat-bakery", image: resolveProductImage("Savoury Muffin", null, "Bakery"), stock: 100, description: "Freshly baked muffin with spinach, sweet corn, and crumbled feta", temperature: "none", department: "Juice & Food", station: "kitchen" },
  { id: "prod-137", name: "Banana Chocolate Chip Muffin", price: 600, category: "Bakery", category_id: "cat-bakery", image: resolveProductImage("Banana Chocolate Chip Muffin", null, "Bakery"), stock: 100, description: "Ripe banana muffin with dark Belgian chocolate chips", temperature: "none", department: "Juice & Food", station: "kitchen" },
  { id: "prod-138", name: "Sweet Scone with Tropical Jam & Cream", price: 650, category: "Bakery", category_id: "cat-bakery", image: resolveProductImage("Sweet Scone with Tropical Jam & Cream", null, "Bakery"), stock: 100, description: "Warm butter scone with tropical passion-mango jam and clotted cream", temperature: "none", department: "Juice & Food", station: "kitchen" },
  { id: "prod-139", name: "Cheese Scone with Karipincha Butter", price: 650, category: "Bakery", category_id: "cat-bakery", image: resolveProductImage("Cheese Scone with Karipincha Butter", null, "Bakery"), stock: 100, description: "Sharp cheddar scone with house-whipped curry leaf butter", temperature: "none", department: "Juice & Food", station: "kitchen" },

  // --- KITCHEN: Desserts (2) ---
  { id: "prod-140", name: "Oaty Ginger Slice", price: 750, category: "Desserts", category_id: "cat-desserts", image: resolveProductImage("Oaty Ginger Slice", null, "Desserts"), stock: 100, description: "Rolled oats and golden syrup slice topped with spicy candied ginger icing", temperature: "none", department: "Juice & Food", station: "kitchen" },
  { id: "prod-141", name: "Chocolate Brownie with Ice Cream", price: 850, category: "Desserts", category_id: "cat-desserts", image: "/chocolate-brownie.png", stock: 100, description: "Warm dark chocolate brownie paired with vanilla bean ice cream", temperature: "none", department: "Juice & Food", station: "kitchen" },
]`

// Replace from `export const DEFAULT_PRODUCTS: SharedProduct[] = [` to `export const DEFAULT_INITIAL_ORDERS`
const startIdx = content.indexOf("export const DEFAULT_PRODUCTS: SharedProduct[] = [")
const endIdx = content.indexOf("export const DEFAULT_INITIAL_ORDERS: SharedOrder[] = []")

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find start or end index for DEFAULT_PRODUCTS", { startIdx, endIdx })
  process.exit(1)
}

content = content.slice(0, startIdx) + newDefaultProductsStr + "\n\n" + content.slice(endIdx)

// 2. Add local storage purge in `init()`
const purgeCode = `    // Clean-slate purge for Lazy Sunday 41-product menu and clean inventory/orders
    const LAZY_SUNDAY_MENU_V5_FLAG = "pos_lazy_sunday_menu_41_pure_v5"
    if (this.isBrowser() && localStorage.getItem(LAZY_SUNDAY_MENU_V5_FLAG) !== "true") {
      try {
        localStorage.removeItem(PRODUCTS_KEY)
        localStorage.removeItem(CATEGORIES_KEY)
        localStorage.removeItem(ORDERS_KEY)
        localStorage.removeItem(INGREDIENTS_KEY)
        localStorage.removeItem(RECIPES_KEY)
        localStorage.removeItem(PURCHASES_KEY)
        localStorage.removeItem(WASTAGE_KEY)
        localStorage.removeItem(ADJUSTMENTS_KEY)
        localStorage.removeItem("pos_coffee_bills")
        localStorage.removeItem("pos_mock_orders")
        localStorage.setItem(LAZY_SUNDAY_MENU_V5_FLAG, "true")
      } catch {}
    }
`

if (!content.includes("pos_lazy_sunday_menu_41_pure_v5")) {
  const initIdx = content.indexOf("this.initialized = true\n")
  if (initIdx !== -1) {
    const insertPos = initIdx + "this.initialized = true\n".length
    content = content.slice(0, insertPos) + "\n" + purgeCode + content.slice(insertPos)
  }
}

fs.writeFileSync(filePath, content, "utf-8")
console.log("✓ Successfully updated lib/shared-pos-service.ts with 41 products and local storage purge!")
