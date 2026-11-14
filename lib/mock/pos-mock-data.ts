/**
 * Comprehensive Mock Dataset for Lazy Sunday Mode
 * Matches the official 41 products (26 Bar, 15 Kitchen) and 13 Categories.
 */

import { resolveProductImage } from "@/lib/product-images"

export interface MockCategory {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export interface MockProduct {
  id: string
  name: string
  sku: string
  barcode: string
  price: number
  cost_price: number
  stock: number
  category: string
  category_id: string
  station: "bar" | "kitchen"
  department: string
  image: string
  description: string
  temperature?: "hot" | "cold" | "none"
  dietary_tags?: string[]
  tax_rate?: number
  active?: boolean
  is_active?: boolean
  is_archived?: boolean
}

export interface MockCustomer {
  id: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
  credit_limit: number
  current_credit: number
  loyalty_points: number
  vip: boolean
  total_orders: number
  total_spent: number
  created_at: string
}

export interface MockTable {
  id: string
  name: string
  capacity: number
  status: "available" | "occupied" | "reserved" | "cleaning"
  section: "Indoor" | "Terrace" | "VIP Lounge" | "Bar"
}

export interface MockOrderItem {
  id: string
  product_id: string
  name: string
  price: number
  quantity: number
  line_total: number
  station: "bar" | "kitchen"
  category: string
  notes?: string
}

export interface MockOrder {
  id: string
  order_number: string
  receipt_number: string
  table_name: string
  cashier_name: string
  department: "Juice & Food" | "Coffee Bar"
  order_type: "dine_in" | "takeaway" | "delivery"
  items: MockOrderItem[]
  subtotal: number
  service_charge: number
  service_charge_rate: number
  discount: number
  tax: number
  total: number
  payment_method: "cash" | "card" | "qr" | "split"
  split_payments?: Array<{ method: string; amount: number; reference?: string }>
  cash_received: number
  change_amount: number
  status: "paid" | "completed" | "refunded" | "cancelled"
  payment_status: "paid"
  kitchen_status: "pending" | "preparing" | "ready" | "served"
  bar_status: "pending" | "preparing" | "ready" | "served"
  customer_name: string
  customer_id?: string
  created_at: string
}

export interface MockIngredient {
  id: string
  sku: string
  name: string
  category: string
  current_stock: number
  base_unit: string
  reorder_level: number
  cost_per_unit: number
}

// ---------------------------------------------------------------------------
// 1. Mock Categories (13 total)
// ---------------------------------------------------------------------------
export const MOCK_CATEGORIES: MockCategory[] = [
  {
    "id": "cat-coffee-hot-drinks",
    "name": "Coffee & Hot Drinks",
    "sort_order": 1,
    "is_active": true
  },
  {
    "id": "cat-cold-drinks",
    "name": "Cold Drinks",
    "sort_order": 2,
    "is_active": true
  },
  {
    "id": "cat-meals",
    "name": "Meals",
    "sort_order": 3,
    "is_active": true
  },
  {
    "id": "cat-salads",
    "name": "Salads",
    "sort_order": 4,
    "is_active": true
  },
  {
    "id": "cat-bakery-desserts",
    "name": "Bakery & Desserts",
    "sort_order": 5,
    "is_active": true
  }
]

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    "id": "prod-101",
    "name": "Ristretto",
    "sku": "LS-BAR-001",
    "barcode": "890123456001",
    "price": 500,
    "cost_price": 120,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "/uploads/prod_1794637814975_5gmi8.jpg",
    "description": "Short, concentrated espresso extraction with a sweet, rich profile.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-102",
    "name": "Espresso",
    "sku": "LS-BAR-002",
    "barcode": "890123456002",
    "price": 500,
    "cost_price": 120,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "/uploads/prod_1794639566380_84t95.jpg",
    "description": "Full-bodied single origin espresso shot with thick golden crema.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-103",
    "name": "Long Black",
    "sku": "LS-BAR-003",
    "barcode": "890123456003",
    "price": 650,
    "cost_price": 140,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80",
    "description": "Double shot espresso poured over hot or iced mineral water.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-104",
    "name": "Flat White",
    "sku": "LS-BAR-004",
    "barcode": "890123456004",
    "price": 750,
    "cost_price": 180,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80",
    "description": "Velvety textured micro-foam over a double ristretto shot.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-105",
    "name": "Cappuccino",
    "sku": "LS-BAR-005",
    "barcode": "890123456005",
    "price": 750,
    "cost_price": 180,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80",
    "description": "Harmonious balance of espresso, steamed milk, and airy foam.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-106",
    "name": "Latte",
    "sku": "LS-BAR-006",
    "barcode": "890123456006",
    "price": 800,
    "cost_price": 190,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "/latte-coffee.png",
    "description": "Smooth espresso with gently steamed milk and a light foam cap.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-107",
    "name": "Mocha",
    "sku": "LS-BAR-007",
    "barcode": "890123456007",
    "price": 950,
    "cost_price": 240,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=600&q=80",
    "description": "Espresso blended with artisanal dark chocolate and steamed milk.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-108",
    "name": "V60 Pour Over",
    "sku": "LS-BAR-008",
    "barcode": "890123456008",
    "price": 1100,
    "cost_price": 280,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80",
    "description": "Single-origin pour over filter brew showcasing delicate florals and fruit notes.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-109",
    "name": "Matcha Latte",
    "sku": "LS-BAR-009",
    "barcode": "890123456009",
    "price": 950,
    "cost_price": 260,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
    "description": "Ceremonial grade Japanese green tea whisked with silky steamed milk.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-110",
    "name": "Chocolate",
    "sku": "LS-BAR-010",
    "barcode": "890123456010",
    "price": 900,
    "cost_price": 220,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=600&q=80",
    "description": "Rich melted cocoa crafted into decadent hot chocolate or iced chocolate.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-111",
    "name": "Ceylon Breakfast",
    "sku": "LS-BAR-011",
    "barcode": "890123456011",
    "price": 400,
    "cost_price": 80,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
    "description": "High-grown Nuwara Eliya whole leaf black tea with robust malty character.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-112",
    "name": "Green Tea",
    "sku": "LS-BAR-012",
    "barcode": "890123456012",
    "price": 450,
    "cost_price": 90,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=600&q=80",
    "description": "Clean, fresh steamed whole-leaf green tea rich in antioxidants.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-113",
    "name": "Ginger & Lemongrass",
    "sku": "LS-BAR-013",
    "barcode": "890123456013",
    "price": 450,
    "cost_price": 90,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80",
    "description": "Soothing natural herbal infusion of sun-dried lemongrass stalks and spicy ginger.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-114",
    "name": "Chai",
    "sku": "LS-BAR-014",
    "barcode": "890123456014",
    "price": 650,
    "cost_price": 160,
    "stock": 100,
    "category": "Coffee & Hot Drinks",
    "category_id": "cat-coffee-hot-drinks",
    "station": "bar",
    "department": "Coffee Bar",
    "image": "https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80",
    "description": "Aromatic black tea brewed with crushed cardamoms, cinnamon, cloves, and milk.",
    "temperature": "hot",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-115",
    "name": "Mango Matcha",
    "sku": "LS-BAR-015",
    "barcode": "890123456015",
    "price": 1050,
    "cost_price": 300,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
    "description": "Chilled tropical mango puree layered with iced ceremonial matcha.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-116",
    "name": "King Coconut",
    "sku": "LS-BAR-016",
    "barcode": "890123456016",
    "price": 450,
    "cost_price": 100,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80",
    "description": "Naturally sweet, isotonic fresh Sri Lankan thambili water served chilled.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-117",
    "name": "House Lime Soda",
    "sku": "LS-BAR-017",
    "barcode": "890123456017",
    "price": 650,
    "cost_price": 120,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    "description": "Freshly squeezed garden lime with bubbly soda water and pure cane syrup.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-118",
    "name": "House Pineapple & Mint Soda",
    "sku": "LS-BAR-018",
    "barcode": "890123456018",
    "price": 750,
    "cost_price": 160,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80",
    "description": "Crushed sweet pineapple and muddled garden mint topped with sparkling soda.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-119",
    "name": "Passion Soda",
    "sku": "LS-BAR-019",
    "barcode": "890123456019",
    "price": 750,
    "cost_price": 160,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    "description": "Tangy tropical passionfruit pulp, lime, and crisp sparkling soda.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-120",
    "name": "Mango Smoothie",
    "sku": "LS-BAR-020",
    "barcode": "890123456020",
    "price": 950,
    "cost_price": 250,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80",
    "description": "Thick, creamy blend of ripe tropical mangoes, banana, and chilled coconut milk.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-121",
    "name": "Peanut Butter Shake",
    "sku": "LS-BAR-021",
    "barcode": "890123456021",
    "price": 1100,
    "cost_price": 320,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80",
    "description": "Roasted artisanal peanut butter, banana, dairy milk, and dark honey.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-122",
    "name": "Pani Dodang & Sea Salt",
    "sku": "LS-BAR-022",
    "barcode": "890123456022",
    "price": 750,
    "cost_price": 200,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "/glass-of-orange-juice.png",
    "description": "Indigenous sweet orange infused with a subtle touch of natural sea salt.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-123",
    "name": "Ginger Lemonade",
    "sku": "LS-BAR-023",
    "barcode": "890123456023",
    "price": 750,
    "cost_price": 200,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    "description": "Fiery organic Sri Lankan ginger balanced with zesty lemon and sparkling spring water.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-124",
    "name": "Peach & Mango Iced Tea",
    "sku": "LS-BAR-024",
    "barcode": "890123456024",
    "price": 800,
    "cost_price": 220,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "/iced-tea.png",
    "description": "Cold brewed Ceylon black tea with natural orchard peach and luscious mango.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-125",
    "name": "Salted Coconut & Lime Sparkling",
    "sku": "LS-BAR-025",
    "barcode": "890123456025",
    "price": 800,
    "cost_price": 220,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80",
    "description": "Refreshing sparkling king coconut nectar with tangy lime and pinch of sea salt.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-126",
    "name": "Sparkling Water",
    "sku": "LS-BAR-026",
    "barcode": "890123456026",
    "price": 500,
    "cost_price": 110,
    "stock": 100,
    "category": "Cold Drinks",
    "category_id": "cat-cold-drinks",
    "station": "bar",
    "department": "Bar & Beverages",
    "image": "/bottled-water.png",
    "description": "Pure chilled carbonated mineral spring water with crisp effervescence.",
    "temperature": "cold",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-127",
    "name": "Creamy Mushrooms",
    "sku": "LS-KIT-027",
    "barcode": "890123456027",
    "price": 1800,
    "cost_price": 450,
    "stock": 100,
    "category": "Meals",
    "category_id": "cat-meals",
    "station": "kitchen",
    "department": "Kitchen Meals",
    "image": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
    "description": "Sautéed button & oyster mushrooms in garlic herb cream, served with Sourdough or Hashbrowns.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-128",
    "name": "Bacon and Eggs",
    "sku": "LS-KIT-028",
    "barcode": "890123456028",
    "price": 1900,
    "cost_price": 500,
    "stock": 100,
    "category": "Meals",
    "category_id": "cat-meals",
    "station": "kitchen",
    "department": "Kitchen Meals",
    "image": "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
    "description": "Crispy smoked bacon with two eggs (Scrambled / Fried) and choice of Sourdough or Hashbrowns.",
    "temperature": "none",
    "dietary_tags": [],
    "tax_rate": 0
  },
  {
    "id": "prod-129",
    "name": "Sri Lankan Chili Scramble",
    "sku": "LS-KIT-029",
    "barcode": "890123456029",
    "price": 1750,
    "cost_price": 420,
    "stock": 100,
    "category": "Meals",
    "category_id": "cat-meals",
    "station": "kitchen",
    "department": "Kitchen Meals",
    "image": "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
    "description": "Soft eggs scrambled with green chilies, shallots, curry leaves, and toasted sourdough.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-130",
    "name": "Pancakes",
    "sku": "LS-KIT-030",
    "barcode": "890123456030",
    "price": 1600,
    "cost_price": 380,
    "stock": 100,
    "category": "Meals",
    "category_id": "cat-meals",
    "station": "kitchen",
    "department": "Kitchen Meals",
    "image": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&q=80",
    "description": "Golden buttermilk pancake stack served with fresh tropical fruit, whipped butter, and kithul treacle.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-131",
    "name": "Grilled Chicken Sandwich",
    "sku": "LS-KIT-031",
    "barcode": "890123456031",
    "price": 1950,
    "cost_price": 520,
    "stock": 100,
    "category": "Meals",
    "category_id": "cat-meals",
    "station": "kitchen",
    "department": "Kitchen Meals",
    "image": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80",
    "description": "Herb-marinated chicken breast, garlic aioli, tomato, and baby greens on sourdough with Fries or Salad.",
    "temperature": "none",
    "dietary_tags": [],
    "tax_rate": 0
  },
  {
    "id": "prod-132",
    "name": "Hashbrown-Crust Bacon & Egg Quiche",
    "sku": "LS-KIT-032",
    "barcode": "890123456032",
    "price": 1850,
    "cost_price": 480,
    "stock": 100,
    "category": "Meals",
    "category_id": "cat-meals",
    "station": "kitchen",
    "department": "Kitchen Meals",
    "image": "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
    "description": "Golden shredded potato crust filled with savory smoked bacon, eggs, and aged cheddar with Fries or Salad.",
    "temperature": "none",
    "dietary_tags": [],
    "tax_rate": 0
  },
  {
    "id": "prod-133",
    "name": "Roast Vegetable Salad",
    "sku": "LS-KIT-033",
    "barcode": "890123456033",
    "price": 1750,
    "cost_price": 420,
    "stock": 100,
    "category": "Salads",
    "category_id": "cat-salads",
    "station": "kitchen",
    "department": "Kitchen Salads",
    "image": "/vibrant-mixed-salad.png",
    "description": "Oven-roasted pumpkin, sweet potato, bell peppers, mixed greens, toasted pumpkin seeds, and balsamic glaze.",
    "temperature": "none",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-134",
    "name": "Pesto Pasta Salad",
    "sku": "LS-KIT-034",
    "barcode": "890123456034",
    "price": 1850,
    "cost_price": 460,
    "stock": 100,
    "category": "Salads",
    "category_id": "cat-salads",
    "station": "kitchen",
    "department": "Kitchen Salads",
    "image": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80",
    "description": "Fusilli pasta tossed in fresh basil cashew pesto, cherry tomatoes, baby spinach, and parmesan shavings.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-135",
    "name": "Chickpea Salad",
    "sku": "LS-KIT-035",
    "barcode": "890123456035",
    "price": 1650,
    "cost_price": 380,
    "stock": 100,
    "category": "Salads",
    "category_id": "cat-salads",
    "station": "kitchen",
    "department": "Kitchen Salads",
    "image": "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",
    "description": "Crisp cucumbers, spiced chickpeas, Kalamata olives, fresh herbs, and zesty lemon tahini dressing.",
    "temperature": "none",
    "dietary_tags": [
      "Vegan",
      "Gluten-Free"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-136",
    "name": "Savoury Muffin",
    "sku": "LS-KIT-036",
    "barcode": "890123456036",
    "price": 650,
    "cost_price": 160,
    "stock": 100,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "station": "kitchen",
    "department": "Bakery & Desserts",
    "image": "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80",
    "description": "Freshly baked savory muffin loaded with baby spinach, sweet corn, and crumbled feta cheese.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-137",
    "name": "Banana Chocolate Chip Muffin",
    "sku": "LS-KIT-037",
    "barcode": "890123456037",
    "price": 600,
    "cost_price": 150,
    "stock": 100,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "station": "kitchen",
    "department": "Bakery & Desserts",
    "image": "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80",
    "description": "Moist ripe banana muffin baked with dark Belgian chocolate chips and cinnamon crumble.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-138",
    "name": "Sweet Scone with Tropical Jam & Cream",
    "sku": "LS-KIT-038",
    "barcode": "890123456038",
    "price": 650,
    "cost_price": 160,
    "stock": 100,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "station": "kitchen",
    "department": "Bakery & Desserts",
    "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    "description": "Traditional butter scone served warm with house-made tropical passion-mango jam and clotted cream.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-139",
    "name": "Cheese Scone with Karipincha Butter",
    "sku": "LS-KIT-039",
    "barcode": "890123456039",
    "price": 650,
    "cost_price": 160,
    "stock": 100,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "station": "kitchen",
    "department": "Bakery & Desserts",
    "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    "description": "Golden sharp cheddar cheese scone served with fragrant house-whipped curry leaf (karipincha) butter.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-140",
    "name": "Oaty Ginger Slice",
    "sku": "LS-KIT-040",
    "barcode": "890123456040",
    "price": 750,
    "cost_price": 180,
    "stock": 100,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "station": "kitchen",
    "department": "Bakery & Desserts",
    "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    "description": "Toasted rolled oats and golden syrup slice topped with spicy candied ginger icing.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  },
  {
    "id": "prod-141",
    "name": "Chocolate Brownie with Ice Cream",
    "sku": "LS-KIT-041",
    "barcode": "890123456041",
    "price": 850,
    "cost_price": 220,
    "stock": 100,
    "category": "Bakery & Desserts",
    "category_id": "cat-bakery-desserts",
    "station": "kitchen",
    "department": "Bakery & Desserts",
    "image": "/chocolate-brownie.png",
    "description": "Warm fudgy dark chocolate brownie dusted with cocoa, paired with a scoop of vanilla bean ice cream.",
    "temperature": "none",
    "dietary_tags": [
      "Vegetarian"
    ],
    "tax_rate": 0
  }
]

export const MOCK_ORDERS: MockOrder[] = []
export const MOCK_HISTORICAL_ORDERS: MockOrder[] = []
export const MOCK_INGREDIENTS: MockIngredient[] = []
export const MOCK_CUSTOMERS: MockCustomer[] = [
  {
    id: "cust-1",
    name: "Kasun Perera",
    phone: "+94 77 123 4567",
    email: "kasun.p@example.com",
    address: "42 Galle Road, Colombo 03",
    notes: "Regular morning patron. Prefers Flat White with Oat Milk.",
    credit_limit: 10000,
    current_credit: 0,
    loyalty_points: 340,
    vip: true,
    total_orders: 28,
    total_spent: 42500,
    created_at: "2026-08-12T10:00:00Z",
  },
  {
    id: "cust-2",
    name: "Dinithi Silva",
    phone: "+94 71 987 6543",
    email: "dinithi.s@example.com",
    address: "18 Flower Road, Colombo 07",
    notes: "Loves iced coffee and chocolate brownies.",
    credit_limit: 15000,
    current_credit: 0,
    loyalty_points: 180,
    vip: false,
    total_orders: 14,
    total_spent: 19800,
    created_at: "2026-09-01T11:30:00Z",
  },
  {
    id: "cust-3",
    name: "Malik Fernando",
    phone: "+94 76 555 4321",
    email: "malik.f@example.com",
    address: "105 Marine Drive, Bambalapitiya",
    notes: "Weekend brunch regular.",
    credit_limit: 25000,
    current_credit: 0,
    loyalty_points: 520,
    vip: true,
    total_orders: 45,
    total_spent: 68900,
    created_at: "2026-07-15T09:15:00Z",
  },
]
export const MOCK_TABLES: MockTable[] = [
  { id: "tbl-1", name: "Table 1", capacity: 2, status: "available", section: "Indoor" },
  { id: "tbl-2", name: "Table 2", capacity: 4, status: "available", section: "Indoor" },
  { id: "tbl-3", name: "Table 3", capacity: 4, status: "available", section: "Indoor" },
  { id: "tbl-4", name: "Table 4", capacity: 6, status: "available", section: "Indoor" },
  { id: "tbl-5", name: "Table 5", capacity: 2, status: "available", section: "Indoor" },
  { id: "tbl-6", name: "Table 6", capacity: 4, status: "available", section: "Indoor" },
  { id: "tbl-7", name: "Terrace 1", capacity: 2, status: "available", section: "Terrace" },
  { id: "tbl-8", name: "Terrace 2", capacity: 4, status: "available", section: "Terrace" },
  { id: "tbl-9", name: "Terrace 3", capacity: 4, status: "available", section: "Terrace" },
  { id: "tbl-10", name: "Terrace 4", capacity: 6, status: "available", section: "Terrace" },
  { id: "tbl-11", name: "VIP Lounge", capacity: 8, status: "available", section: "VIP Lounge" },
  { id: "tbl-12", name: "Bar Counter 1", capacity: 1, status: "available", section: "Bar" },
  { id: "tbl-13", name: "Bar Counter 2", capacity: 1, status: "available", section: "Bar" },
  { id: "tbl-14", name: "Bar Counter 3", capacity: 1, status: "available", section: "Bar" },
]
