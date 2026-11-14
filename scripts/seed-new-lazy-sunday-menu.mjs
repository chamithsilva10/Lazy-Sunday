import pg from "pg"
import crypto from "node:crypto"

const connectionString = process.env.POSTGRES_URL || "postgresql://postgres:postgres@127.0.0.1:5432/pos_test"
const pool = new pg.Pool({ connectionString })

export const CATEGORIES_DATA = [
  { id: "cat-coffee-hot-drinks", name: "Coffee & Hot Drinks", sort_order: 1, station: "bar" },
  { id: "cat-cold-drinks", name: "Cold Drinks", sort_order: 2, station: "bar" },
  { id: "cat-meals", name: "Meals", sort_order: 3, station: "kitchen" },
  { id: "cat-salads", name: "Salads", sort_order: 4, station: "kitchen" },
  { id: "cat-bakery-desserts", name: "Bakery & Desserts", sort_order: 5, station: "kitchen" },
]

export const PRODUCTS_DATA = [
  // --- BAR: Coffee & Hot Drinks (14) ---
  {
    name: "Ristretto",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 500,
    cost: 120,
    temperature: "hot",
    description: "Short, concentrated espresso extraction with a sweet, rich profile.",
    image: "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Espresso",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 500,
    cost: 120,
    temperature: "hot",
    description: "Full-bodied single origin espresso shot with thick golden crema.",
    image: "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Long Black",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 650,
    cost: 140,
    temperature: "hot",
    description: "Double shot espresso poured over hot or iced mineral water.",
    image: "https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Flat White",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 750,
    cost: 180,
    temperature: "hot",
    description: "Velvety textured micro-foam over a double ristretto shot.",
    image: "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Cappuccino",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 750,
    cost: 180,
    temperature: "hot",
    description: "Harmonious balance of espresso, steamed milk, and airy foam.",
    image: "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Latte",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 800,
    cost: 190,
    temperature: "hot",
    description: "Smooth espresso with gently steamed milk and a light foam cap.",
    image: "/latte-coffee.png",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Mocha",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 950,
    cost: 240,
    temperature: "hot",
    description: "Espresso blended with artisanal dark chocolate and steamed milk.",
    image: "https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "V60 Pour Over",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 1100,
    cost: 280,
    temperature: "hot",
    description: "Single-origin pour over filter brew showcasing delicate florals and fruit notes.",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Matcha Latte",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 950,
    cost: 260,
    temperature: "hot",
    description: "Ceremonial grade Japanese green tea whisked with silky steamed milk.",
    image: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Chocolate",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 900,
    cost: 220,
    temperature: "hot",
    description: "Rich melted cocoa crafted into decadent hot chocolate or iced chocolate.",
    image: "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Ceylon Breakfast",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 400,
    cost: 80,
    temperature: "hot",
    description: "High-grown Nuwara Eliya whole leaf black tea with robust malty character.",
    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Green Tea",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 450,
    cost: 90,
    temperature: "hot",
    description: "Clean, fresh steamed whole-leaf green tea rich in antioxidants.",
    image: "https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Ginger & Lemongrass",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 450,
    cost: 90,
    temperature: "hot",
    description: "Soothing natural herbal infusion of sun-dried lemongrass stalks and spicy ginger.",
    image: "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Chai",
    category_name: "Coffee & Hot Drinks",
    station: "bar",
    department: "Coffee Bar",
    price: 650,
    cost: 160,
    temperature: "hot",
    description: "Aromatic black tea brewed with crushed cardamoms, cinnamon, cloves, and milk.",
    image: "https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },

  // --- BAR: Cold Drinks (12) ---
  {
    name: "Mango Matcha",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 1050,
    cost: 300,
    temperature: "cold",
    description: "Chilled tropical mango puree layered with iced ceremonial matcha.",
    image: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "King Coconut",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 450,
    cost: 100,
    temperature: "cold",
    description: "Naturally sweet, isotonic fresh Sri Lankan thambili water served chilled.",
    image: "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "House Lime Soda",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 650,
    cost: 120,
    temperature: "cold",
    description: "Freshly squeezed garden lime with bubbly soda water and pure cane syrup.",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "House Pineapple & Mint Soda",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 750,
    cost: 160,
    temperature: "cold",
    description: "Crushed sweet pineapple and muddled garden mint topped with sparkling soda.",
    image: "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Passion Soda",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 750,
    cost: 160,
    temperature: "cold",
    description: "Tangy tropical passionfruit pulp, lime, and crisp sparkling soda.",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Mango Smoothie",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 950,
    cost: 250,
    temperature: "cold",
    description: "Thick, creamy blend of ripe tropical mangoes, banana, and chilled coconut milk.",
    image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Peanut Butter Shake",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 1100,
    cost: 320,
    temperature: "cold",
    description: "Roasted artisanal peanut butter, banana, dairy milk, and dark honey.",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Pani Dodang & Sea Salt",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 750,
    cost: 200,
    temperature: "cold",
    description: "Indigenous sweet orange infused with a subtle touch of natural sea salt.",
    image: "/glass-of-orange-juice.png",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Ginger Lemonade",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 750,
    cost: 200,
    temperature: "cold",
    description: "Fiery organic Sri Lankan ginger balanced with zesty lemon and sparkling spring water.",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Peach & Mango Iced Tea",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 800,
    cost: 220,
    temperature: "cold",
    description: "Cold brewed Ceylon black tea with natural orchard peach and luscious mango.",
    image: "/iced-tea.png",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Salted Coconut & Lime Sparkling",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 800,
    cost: 220,
    temperature: "cold",
    description: "Refreshing sparkling king coconut nectar with tangy lime and pinch of sea salt.",
    image: "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Sparkling Water",
    category_name: "Cold Drinks",
    station: "bar",
    department: "Bar & Beverages",
    price: 500,
    cost: 110,
    temperature: "cold",
    description: "Pure chilled carbonated mineral spring water with crisp effervescence.",
    image: "/bottled-water.png",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },

  // --- KITCHEN: Meals (6) ---
  {
    name: "Creamy Mushrooms",
    category_name: "Meals",
    station: "kitchen",
    department: "Kitchen Meals",
    price: 1800,
    cost: 450,
    temperature: "none",
    description: "Sautéed button & oyster mushrooms in garlic herb cream, served with Sourdough or Hashbrowns.",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Bacon and Eggs",
    category_name: "Meals",
    station: "kitchen",
    department: "Kitchen Meals",
    price: 1900,
    cost: 500,
    temperature: "none",
    description: "Crispy smoked bacon with two eggs (Scrambled / Fried) and choice of Sourdough or Hashbrowns.",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
    dietary_tags: [],
  },
  {
    name: "Sri Lankan Chili Scramble",
    category_name: "Meals",
    station: "kitchen",
    department: "Kitchen Meals",
    price: 1750,
    cost: 420,
    temperature: "none",
    description: "Soft eggs scrambled with green chilies, shallots, curry leaves, and toasted sourdough.",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Pancakes",
    category_name: "Meals",
    station: "kitchen",
    department: "Kitchen Meals",
    price: 1600,
    cost: 380,
    temperature: "none",
    description: "Golden buttermilk pancake stack served with fresh tropical fruit, whipped butter, and kithul treacle.",
    image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Grilled Chicken Sandwich",
    category_name: "Meals",
    station: "kitchen",
    department: "Kitchen Meals",
    price: 1950,
    cost: 520,
    temperature: "none",
    description: "Herb-marinated chicken breast, garlic aioli, tomato, and baby greens on sourdough with Fries or Salad.",
    image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80",
    dietary_tags: [],
  },
  {
    name: "Hashbrown-Crust Bacon & Egg Quiche",
    category_name: "Meals",
    station: "kitchen",
    department: "Kitchen Meals",
    price: 1850,
    cost: 480,
    temperature: "none",
    description: "Golden shredded potato crust filled with savory smoked bacon, eggs, and aged cheddar with Fries or Salad.",
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
    dietary_tags: [],
  },

  // --- KITCHEN: Salads (3) ---
  {
    name: "Roast Vegetable Salad",
    category_name: "Salads",
    station: "kitchen",
    department: "Kitchen Salads",
    price: 1750,
    cost: 420,
    temperature: "none",
    description: "Oven-roasted pumpkin, sweet potato, bell peppers, mixed greens, toasted pumpkin seeds, and balsamic glaze.",
    image: "/vibrant-mixed-salad.png",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },
  {
    name: "Pesto Pasta Salad",
    category_name: "Salads",
    station: "kitchen",
    department: "Kitchen Salads",
    price: 1850,
    cost: 460,
    temperature: "none",
    description: "Fusilli pasta tossed in fresh basil cashew pesto, cherry tomatoes, baby spinach, and parmesan shavings.",
    image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Chickpea Salad",
    category_name: "Salads",
    station: "kitchen",
    department: "Kitchen Salads",
    price: 1650,
    cost: 380,
    temperature: "none",
    description: "Crisp cucumbers, spiced chickpeas, Kalamata olives, fresh herbs, and zesty lemon tahini dressing.",
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegan", "Gluten-Free"],
  },

  // --- KITCHEN: Bakery & Desserts (6) ---
  {
    name: "Savoury Muffin",
    category_name: "Bakery & Desserts",
    station: "kitchen",
    department: "Bakery & Desserts",
    price: 650,
    cost: 160,
    temperature: "none",
    description: "Freshly baked savory muffin loaded with baby spinach, sweet corn, and crumbled feta cheese.",
    image: "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Banana Chocolate Chip Muffin",
    category_name: "Bakery & Desserts",
    station: "kitchen",
    department: "Bakery & Desserts",
    price: 600,
    cost: 150,
    temperature: "none",
    description: "Moist ripe banana muffin baked with dark Belgian chocolate chips and cinnamon crumble.",
    image: "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Sweet Scone with Tropical Jam & Cream",
    category_name: "Bakery & Desserts",
    station: "kitchen",
    department: "Bakery & Desserts",
    price: 650,
    cost: 160,
    temperature: "none",
    description: "Traditional butter scone served warm with house-made tropical passion-mango jam and clotted cream.",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Cheese Scone with Karipincha Butter",
    category_name: "Bakery & Desserts",
    station: "kitchen",
    department: "Bakery & Desserts",
    price: 650,
    cost: 160,
    temperature: "none",
    description: "Golden sharp cheddar cheese scone served with fragrant house-whipped curry leaf (karipincha) butter.",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Oaty Ginger Slice",
    category_name: "Bakery & Desserts",
    station: "kitchen",
    department: "Bakery & Desserts",
    price: 750,
    cost: 180,
    temperature: "none",
    description: "Toasted rolled oats and golden syrup slice topped with spicy candied ginger icing.",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    dietary_tags: ["Vegetarian"],
  },
  {
    name: "Chocolate Brownie with Ice Cream",
    category_name: "Bakery & Desserts",
    station: "kitchen",
    department: "Bakery & Desserts",
    price: 850,
    cost: 220,
    temperature: "none",
    description: "Warm fudgy dark chocolate brownie dusted with cocoa, paired with a scoop of vanilla bean ice cream.",
    image: "/chocolate-brownie.png",
    dietary_tags: ["Vegetarian"],
  },
]

export const INGREDIENT_CATEGORIES_DATA = [
  { id: "ing-cat-coffee-tea", name: "Coffee & Teas", sort_order: 1 },
  { id: "ing-cat-dairy", name: "Dairy & Alternatives", sort_order: 2 },
  { id: "ing-cat-beverages", name: "Beverages & Sodas", sort_order: 3 },
  { id: "ing-cat-produce", name: "Produce & Fresh Herbs", sort_order: 4 },
  { id: "ing-cat-meat", name: "Meat & Poultry", sort_order: 5 },
  { id: "ing-cat-bakery-dry", name: "Bakery & Dry Goods", sort_order: 6 },
]

export const INGREDIENTS_DATA = [
  // Coffee & Teas
  { id: "ing-espresso-beans", name: "Espresso Coffee Beans", category_name: "Coffee & Teas", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 15000, reorder_level_base: 3000 },
  { id: "ing-v60-beans", name: "Single Origin V60 Coffee Beans", category_name: "Coffee & Teas", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 5000, reorder_level_base: 1000 },
  { id: "ing-matcha-powder", name: "Ceremonial Matcha Powder", category_name: "Coffee & Teas", dimension: "weight", base_unit: "g", default_purchase_unit: "g", current_stock_base: 2000, reorder_level_base: 500 },
  { id: "ing-cocoa-powder", name: "Artisanal Cocoa / Chocolate", category_name: "Coffee & Teas", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 5000, reorder_level_base: 1000 },
  { id: "ing-black-tea", name: "Ceylon Breakfast Tea Leaves", category_name: "Coffee & Teas", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 3000, reorder_level_base: 500 },
  { id: "ing-green-tea", name: "Green Tea Leaves", category_name: "Coffee & Teas", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 2000, reorder_level_base: 400 },
  { id: "ing-lemongrass-ginger", name: "Dried Lemongrass & Ginger", category_name: "Coffee & Teas", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 2000, reorder_level_base: 400 },
  { id: "ing-chai-spices", name: "Chai Spice Blend", category_name: "Coffee & Teas", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 2500, reorder_level_base: 500 },

  // Dairy & Alternatives
  { id: "ing-cow-milk", name: "Fresh Cow Milk", category_name: "Dairy & Alternatives", dimension: "volume", base_unit: "ml", default_purchase_unit: "l", current_stock_base: 40000, reorder_level_base: 10000 },
  { id: "ing-oat-milk", name: "Oat Milk", category_name: "Dairy & Alternatives", dimension: "volume", base_unit: "ml", default_purchase_unit: "l", current_stock_base: 20000, reorder_level_base: 5000 },
  { id: "ing-coconut-milk", name: "Coconut Milk", category_name: "Dairy & Alternatives", dimension: "volume", base_unit: "ml", default_purchase_unit: "l", current_stock_base: 15000, reorder_level_base: 4000 },
  { id: "ing-butter", name: "Salted Butter", category_name: "Dairy & Alternatives", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 5000, reorder_level_base: 1500 },
  { id: "ing-ice-cream", name: "Vanilla Bean Ice Cream", category_name: "Dairy & Alternatives", dimension: "volume", base_unit: "ml", default_purchase_unit: "l", current_stock_base: 8000, reorder_level_base: 2000 },
  { id: "ing-cheddar", name: "Aged Cheddar Cheese", category_name: "Dairy & Alternatives", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 4000, reorder_level_base: 1000 },
  { id: "ing-feta", name: "Feta Cheese", category_name: "Dairy & Alternatives", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 3000, reorder_level_base: 800 },

  // Beverages & Sodas
  { id: "ing-soda-water", name: "Soda Water", category_name: "Beverages & Sodas", dimension: "volume", base_unit: "ml", default_purchase_unit: "l", current_stock_base: 30000, reorder_level_base: 8000 },
  { id: "ing-sozo-pani-dodang", name: "SOZO Pani Dodang & Sea Salt", category_name: "Beverages & Sodas", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 48, reorder_level_base: 12 },
  { id: "ing-sozo-ginger-lemonade", name: "SOZO Ginger Lemonade", category_name: "Beverages & Sodas", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 48, reorder_level_base: 12 },
  { id: "ing-sozo-iced-tea", name: "SOZO Peach & Mango Iced Tea", category_name: "Beverages & Sodas", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 48, reorder_level_base: 12 },
  { id: "ing-sozo-salted-coconut", name: "SOZO Salted Coconut & Lime Sparkling", category_name: "Beverages & Sodas", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 48, reorder_level_base: 12 },
  { id: "ing-sozo-sparkling-water", name: "SOZO Sparkling Water", category_name: "Beverages & Sodas", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 60, reorder_level_base: 15 },

  // Produce & Fresh Herbs
  { id: "ing-king-coconuts", name: "Fresh King Coconuts", category_name: "Produce & Fresh Herbs", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 35, reorder_level_base: 10 },
  { id: "ing-limes", name: "Fresh Limes", category_name: "Produce & Fresh Herbs", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 80, reorder_level_base: 20 },
  { id: "ing-pineapples", name: "Fresh Pineapples", category_name: "Produce & Fresh Herbs", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 8000, reorder_level_base: 2000 },
  { id: "ing-mint", name: "Fresh Mint Leaves", category_name: "Produce & Fresh Herbs", dimension: "weight", base_unit: "g", default_purchase_unit: "g", current_stock_base: 1000, reorder_level_base: 300 },
  { id: "ing-passionfruit", name: "Passionfruit Pulp", category_name: "Produce & Fresh Herbs", dimension: "volume", base_unit: "ml", default_purchase_unit: "l", current_stock_base: 5000, reorder_level_base: 1500 },
  { id: "ing-mangoes", name: "Ripe Mangoes", category_name: "Produce & Fresh Herbs", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 10000, reorder_level_base: 2500 },
  { id: "ing-bananas", name: "Fresh Bananas", category_name: "Produce & Fresh Herbs", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 50, reorder_level_base: 15 },
  { id: "ing-mushrooms", name: "Button & Oyster Mushrooms", category_name: "Produce & Fresh Herbs", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 4000, reorder_level_base: 1000 },
  { id: "ing-mixed-greens", name: "Salad Mixed Greens", category_name: "Produce & Fresh Herbs", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 3500, reorder_level_base: 1000 },
  { id: "ing-karipincha", name: "Fresh Curry Leaves (Karipincha)", category_name: "Produce & Fresh Herbs", dimension: "weight", base_unit: "g", default_purchase_unit: "g", current_stock_base: 800, reorder_level_base: 200 },

  // Meat & Poultry
  { id: "ing-bacon", name: "Smoked Bacon Rashers", category_name: "Meat & Poultry", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 6000, reorder_level_base: 1500 },
  { id: "ing-chicken", name: "Chicken Breast Fillets", category_name: "Meat & Poultry", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 8000, reorder_level_base: 2000 },
  { id: "ing-eggs", name: "Farm Fresh Eggs", category_name: "Meat & Poultry", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 120, reorder_level_base: 30 },

  // Bakery & Dry Goods
  { id: "ing-sourdough", name: "Sourdough Bread Slices", category_name: "Bakery & Dry Goods", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 60, reorder_level_base: 15 },
  { id: "ing-hashbrowns", name: "Hashbrown Patties", category_name: "Bakery & Dry Goods", dimension: "count", base_unit: "pcs", default_purchase_unit: "pcs", current_stock_base: 50, reorder_level_base: 15 },
  { id: "ing-fries", name: "French Fries", category_name: "Bakery & Dry Goods", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 10000, reorder_level_base: 2500 },
  { id: "ing-fusilli", name: "Fusilli Pasta", category_name: "Bakery & Dry Goods", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 5000, reorder_level_base: 1500 },
  { id: "ing-chickpeas", name: "Cooked Chickpeas", category_name: "Bakery & Dry Goods", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 4000, reorder_level_base: 1000 },
  { id: "ing-pesto", name: "Basil Pesto Sauce", category_name: "Bakery & Dry Goods", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 2500, reorder_level_base: 600 },
  { id: "ing-peanut-butter", name: "Peanut Butter", category_name: "Bakery & Dry Goods", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 3000, reorder_level_base: 800 },
  { id: "ing-rolled-oats", name: "Rolled Oats", category_name: "Bakery & Dry Goods", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 5000, reorder_level_base: 1000 },
  { id: "ing-choc-chips", name: "Dark Chocolate Chips", category_name: "Bakery & Dry Goods", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 4000, reorder_level_base: 1000 },
  { id: "ing-pancake-mix", name: "Pancake Flour & Batter Mix", category_name: "Bakery & Dry Goods", dimension: "weight", base_unit: "g", default_purchase_unit: "kg", current_stock_base: 6000, reorder_level_base: 1500 },
]

export const RECIPES_DATA = {
  "Ristretto": [{ ingredient_id: "ing-espresso-beans", quantity_base: 18 }],
  "Espresso": [{ ingredient_id: "ing-espresso-beans", quantity_base: 18 }],
  "Long Black": [{ ingredient_id: "ing-espresso-beans", quantity_base: 18 }],
  "Flat White": [{ ingredient_id: "ing-espresso-beans", quantity_base: 18 }, { ingredient_id: "ing-cow-milk", quantity_base: 180 }],
  "Cappuccino": [{ ingredient_id: "ing-espresso-beans", quantity_base: 18 }, { ingredient_id: "ing-cow-milk", quantity_base: 160 }],
  "Latte": [{ ingredient_id: "ing-espresso-beans", quantity_base: 18 }, { ingredient_id: "ing-cow-milk", quantity_base: 220 }],
  "Mocha": [{ ingredient_id: "ing-espresso-beans", quantity_base: 18 }, { ingredient_id: "ing-cocoa-powder", quantity_base: 30 }, { ingredient_id: "ing-cow-milk", quantity_base: 200 }],
  "V60 Pour Over": [{ ingredient_id: "ing-v60-beans", quantity_base: 15 }],
  "Matcha Latte": [{ ingredient_id: "ing-matcha-powder", quantity_base: 5 }, { ingredient_id: "ing-cow-milk", quantity_base: 200 }],
  "Chocolate": [{ ingredient_id: "ing-cocoa-powder", quantity_base: 40 }, { ingredient_id: "ing-cow-milk", quantity_base: 220 }],
  "Ceylon Breakfast": [{ ingredient_id: "ing-black-tea", quantity_base: 3 }],
  "Green Tea": [{ ingredient_id: "ing-green-tea", quantity_base: 3 }],
  "Ginger & Lemongrass": [{ ingredient_id: "ing-lemongrass-ginger", quantity_base: 4 }],
  "Chai": [{ ingredient_id: "ing-chai-spices", quantity_base: 4 }, { ingredient_id: "ing-cow-milk", quantity_base: 150 }],
  "Mango Matcha": [{ ingredient_id: "ing-matcha-powder", quantity_base: 5 }, { ingredient_id: "ing-mangoes", quantity_base: 120 }],
  "King Coconut": [{ ingredient_id: "ing-king-coconuts", quantity_base: 1 }],
  "House Lime Soda": [{ ingredient_id: "ing-limes", quantity_base: 2 }, { ingredient_id: "ing-soda-water", quantity_base: 200 }],
  "House Pineapple & Mint Soda": [{ ingredient_id: "ing-pineapples", quantity_base: 80 }, { ingredient_id: "ing-mint", quantity_base: 5 }, { ingredient_id: "ing-soda-water", quantity_base: 180 }],
  "Passion Soda": [{ ingredient_id: "ing-passionfruit", quantity_base: 40 }, { ingredient_id: "ing-soda-water", quantity_base: 200 }],
  "Mango Smoothie": [{ ingredient_id: "ing-mangoes", quantity_base: 150 }, { ingredient_id: "ing-bananas", quantity_base: 1 }, { ingredient_id: "ing-coconut-milk", quantity_base: 100 }],
  "Peanut Butter Shake": [{ ingredient_id: "ing-peanut-butter", quantity_base: 50 }, { ingredient_id: "ing-bananas", quantity_base: 1 }, { ingredient_id: "ing-cow-milk", quantity_base: 200 }],
  "Pani Dodang & Sea Salt": [{ ingredient_id: "ing-sozo-pani-dodang", quantity_base: 1 }],
  "Ginger Lemonade": [{ ingredient_id: "ing-sozo-ginger-lemonade", quantity_base: 1 }],
  "Peach & Mango Iced Tea": [{ ingredient_id: "ing-sozo-iced-tea", quantity_base: 1 }],
  "Salted Coconut & Lime Sparkling": [{ ingredient_id: "ing-sozo-salted-coconut", quantity_base: 1 }],
  "Sparkling Water": [{ ingredient_id: "ing-sozo-sparkling-water", quantity_base: 1 }],
  "Creamy Mushrooms": [{ ingredient_id: "ing-mushrooms", quantity_base: 150 }, { ingredient_id: "ing-sourdough", quantity_base: 2 }],
  "Bacon and Eggs": [{ ingredient_id: "ing-bacon", quantity_base: 100 }, { ingredient_id: "ing-eggs", quantity_base: 2 }, { ingredient_id: "ing-sourdough", quantity_base: 2 }],
  "Sri Lankan Chili Scramble": [{ ingredient_id: "ing-eggs", quantity_base: 2 }, { ingredient_id: "ing-sourdough", quantity_base: 2 }, { ingredient_id: "ing-karipincha", quantity_base: 5 }],
  "Pancakes": [{ ingredient_id: "ing-pancake-mix", quantity_base: 150 }, { ingredient_id: "ing-butter", quantity_base: 20 }],
  "Grilled Chicken Sandwich": [{ ingredient_id: "ing-chicken", quantity_base: 180 }, { ingredient_id: "ing-sourdough", quantity_base: 2 }, { ingredient_id: "ing-fries", quantity_base: 150 }],
  "Hashbrown-Crust Bacon & Egg Quiche": [{ ingredient_id: "ing-hashbrowns", quantity_base: 2 }, { ingredient_id: "ing-bacon", quantity_base: 60 }, { ingredient_id: "ing-eggs", quantity_base: 2 }, { ingredient_id: "ing-cheddar", quantity_base: 30 }],
  "Roast Vegetable Salad": [{ ingredient_id: "ing-mixed-greens", quantity_base: 120 }],
  "Pesto Pasta Salad": [{ ingredient_id: "ing-fusilli", quantity_base: 100 }, { ingredient_id: "ing-pesto", quantity_base: 30 }],
  "Chickpea Salad": [{ ingredient_id: "ing-chickpeas", quantity_base: 120 }, { ingredient_id: "ing-mixed-greens", quantity_base: 60 }],
  "Savoury Muffin": [{ ingredient_id: "ing-feta", quantity_base: 25 }],
  "Banana Chocolate Chip Muffin": [{ ingredient_id: "ing-bananas", quantity_base: 1 }, { ingredient_id: "ing-choc-chips", quantity_base: 25 }],
  "Sweet Scone with Tropical Jam & Cream": [{ ingredient_id: "ing-butter", quantity_base: 20 }],
  "Cheese Scone with Karipincha Butter": [{ ingredient_id: "ing-cheddar", quantity_base: 20 }, { ingredient_id: "ing-karipincha", quantity_base: 5 }],
  "Oaty Ginger Slice": [{ ingredient_id: "ing-rolled-oats", quantity_base: 80 }],
  "Chocolate Brownie with Ice Cream": [{ ingredient_id: "ing-cocoa-powder", quantity_base: 40 }, { ingredient_id: "ing-ice-cream", quantity_base: 100 }],
}

async function run() {
  console.log("=== RESETTING DATABASE & SEEDING NEW MENU WITH 5 FILTERS & INVENTORY ===")
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // 1. Purge legacy orders & tickets
    console.log("1. Purging legacy orders, tickets, and bills...")
    await client.query("DELETE FROM station_tickets;")
    await client.query("DELETE FROM order_items;")
    await client.query("DELETE FROM pos_orders;")
    await client.query("DELETE FROM coffee_bill_items;")
    await client.query("DELETE FROM coffee_bills;")

    // 2. Purge inventory and recipes
    console.log("2. Purging legacy ingredients, recipes, and movements...")
    await client.query("DELETE FROM ingredient_stock_movements;")
    await client.query("DELETE FROM stock_movements;")
    await client.query("DELETE FROM recipe_items;")
    await client.query("DELETE FROM ingredients;")
    await client.query("DELETE FROM ingredient_categories;")

    // 3. Purge existing products and categories
    console.log("3. Purging existing products and categories...")
    await client.query("DELETE FROM coffee_products;")
    await client.query("DELETE FROM pos_products;")
    await client.query("DELETE FROM pos_categories;")

    // 4. Release all tables and table sessions
    console.log("4. Resetting table sessions to clean available status...")
    await client.query("DELETE FROM table_session_events;")
    await client.query("DELETE FROM table_sessions;")
    await client.query("UPDATE pos_tables SET status = 'available';")

    // 5. Insert New 5 Categories
    console.log("5. Inserting 5 New Categories (Coffee & Hot Drinks, Cold Drinks, Meals, Salads, Bakery & Desserts)...")
    const catIdMap = new Map()
    for (const cat of CATEGORIES_DATA) {
      const res = await client.query(
        `INSERT INTO pos_categories (name, sort_order, is_active, created_at)
         VALUES ($1, $2, true, now())
         RETURNING id, name`,
        [cat.name, cat.sort_order]
      )
      catIdMap.set(cat.name, res.rows[0].id)
    }

    // 6. Insert New 41 Products into pos_products & coffee_products
    console.log("6. Inserting 41 New Products...")
    const prodIdMap = new Map()
    let pIdx = 1
    for (const p of PRODUCTS_DATA) {
      const categoryId = catIdMap.get(p.category_name)
      const sku = `LS-${p.station === "bar" ? "BAR" : "KIT"}-${String(pIdx++).padStart(3, "0")}`
      const res = await client.query(
        `INSERT INTO pos_products (
          name, price, cost, stock, category_id, station, department_override,
          image, description, temperature, dietary_tags, active, is_archived,
          sort_order, sku, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 100, $4, $5, $6,
          $7, $8, $9, $10, true, false,
          $11, $12, now(), now()
        ) RETURNING id, name`,
        [
          p.name,
          p.price,
          p.cost,
          categoryId,
          p.station,
          p.department,
          p.image,
          p.description,
          p.temperature,
          p.dietary_tags,
          pIdx,
          sku,
        ]
      )
      prodIdMap.set(p.name, res.rows[0].id)

      // Also mirror Bar products into coffee_products
      if (p.station === "bar") {
        await client.query(
          `INSERT INTO coffee_products (
            id, name, category, size, price, image_url, status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, 'Regular', $4, $5, 'active', now(), now()
          )`,
          [res.rows[0].id, p.name, p.category_name, p.price, p.image]
        )
      }
    }

    // 7. Insert 6 Ingredient Categories
    console.log("7. Inserting 6 Ingredient Categories...")
    const ingCatIdMap = new Map()
    for (const ic of INGREDIENT_CATEGORIES_DATA) {
      const res = await client.query(
        `INSERT INTO ingredient_categories (id, name, sort_order, is_active, created_at)
         VALUES (gen_random_uuid(), $1, $2, true, now())
         RETURNING id, name`,
        [ic.name, ic.sort_order]
      )
      ingCatIdMap.set(ic.name, res.rows[0].id)
    }

    // 8. Insert 40 Ingredients
    console.log("8. Inserting 40 Ingredients with live stock...")
    const ingDbIdMap = new Map()
    let ingIdx = 1
    for (const ing of INGREDIENTS_DATA) {
      const categoryId = ingCatIdMap.get(ing.category_name)
      const sku = `ING-${String(ingIdx++).padStart(3, "0")}`
      const res = await client.query(
        `INSERT INTO ingredients (
          id, name, sku, category_id, dimension, base_unit, default_purchase_unit,
          current_stock_base, par_level_base, reorder_level_base, reorder_qty_base,
          is_perishable, is_active, is_archived, version, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          true, true, false, 1, now(), now()
        ) RETURNING id, name`,
        [
          ing.name,
          sku,
          categoryId,
          ing.dimension,
          ing.base_unit,
          ing.default_purchase_unit,
          ing.current_stock_base,
          ing.current_stock_base * 1.5,
          ing.reorder_level_base,
          ing.reorder_level_base * 2,
        ]
      )
      ingDbIdMap.set(ing.id, res.rows[0].id)
    }

    // 9. Insert Recipe Items
    console.log("9. Inserting Recipe Items...")
    for (const [prodName, lines] of Object.entries(RECIPES_DATA)) {
      const productId = prodIdMap.get(prodName)
      if (!productId) continue
      for (const line of lines) {
        const ingredientDbId = ingDbIdMap.get(line.ingredient_id)
        if (!ingredientDbId) continue
        await client.query(
          `INSERT INTO recipe_items (id, product_id, ingredient_id, quantity_base)
           VALUES (gen_random_uuid(), $1, $2, $3)`,
          [productId, ingredientDbId, line.quantity_base]
        )
      }
    }

    await client.query("COMMIT")
    console.log("✓ Successfully reset database and seeded:")
    console.log(`  - 5 Categories: ${CATEGORIES_DATA.map(c => c.name).join(", ")}`)
    console.log(`  - 41 Products (26 Bar, 15 Kitchen)`)
    console.log(`  - 6 Ingredient Categories`)
    console.log(`  - 40 Ingredients with live stock & reorder levels`)
    console.log(`  - Recipe lines for 41 products`)
    console.log("  - 0 Legacy Orders (clean slate)")
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("Failed to seed database:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

if (import.meta.url.endsWith(process.argv[1])) { run() }
