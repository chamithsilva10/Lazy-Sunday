/**
 * Comprehensive Mock Dataset for Client Demo Mode
 * Zero production data leakage - pristine, isolated, and realistic.
 */

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
// 1. Mock Categories
// ---------------------------------------------------------------------------
export const MOCK_CATEGORIES: MockCategory[] = [
  { id: "cat-1", name: "Specialty Coffee", sort_order: 1, is_active: true },
  { id: "cat-2", name: "Artisan Teas", sort_order: 2, is_active: true },
  { id: "cat-3", name: "Bakery & Pastries", sort_order: 3, is_active: true },
  { id: "cat-4", name: "Breakfast & Brunch", sort_order: 4, is_active: true },
  { id: "cat-5", name: "Gourmet Burgers", sort_order: 5, is_active: true },
  { id: "cat-6", name: "Fresh Salads & Bowls", sort_order: 6, is_active: true },
  { id: "cat-7", name: "Sides & Starters", sort_order: 7, is_active: true },
  { id: "cat-8", name: "Cold Pressed Juices", sort_order: 8, is_active: true },
]

// ---------------------------------------------------------------------------
// 2. Mock Products (40+ Diverse Items with SKUs and Barcodes)
// ---------------------------------------------------------------------------
export const MOCK_PRODUCTS: MockProduct[] = [
  // --- Specialty Coffee ---
  {
    id: "prod-101",
    name: "Espresso Single Origin",
    sku: "SKU-COF-001",
    barcode: "890100100001",
    price: 450,
    cost_price: 120,
    stock: 120,
    category: "Specialty Coffee",
    category_id: "cat-1",
    station: "bar",
    department: "Coffee Bar",
    image: "/latte-coffee.png",
    description: "Rich crema with notes of dark cocoa and citrus blossom.",
    temperature: "hot",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-102",
    name: "Double Ristretto",
    sku: "SKU-COF-002",
    barcode: "890100100002",
    price: 550,
    cost_price: 150,
    stock: 95,
    category: "Specialty Coffee",
    category_id: "cat-1",
    station: "bar",
    department: "Coffee Bar",
    image: "/latte-coffee.png",
    description: "Short extracted double shot offering intense sweet body.",
    temperature: "hot",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-103",
    name: "Velvet Flat White",
    sku: "SKU-COF-003",
    barcode: "890100100003",
    price: 750,
    cost_price: 220,
    stock: 80,
    category: "Specialty Coffee",
    category_id: "cat-1",
    station: "bar",
    department: "Coffee Bar",
    image: "/latte-coffee.png",
    description: "Silky micro-foam poured over a double ristretto shot.",
    temperature: "hot",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },
  {
    id: "prod-104",
    name: "Classic Cappuccino",
    sku: "SKU-COF-004",
    barcode: "890100100004",
    price: 750,
    cost_price: 210,
    stock: 110,
    category: "Specialty Coffee",
    category_id: "cat-1",
    station: "bar",
    department: "Coffee Bar",
    image: "/latte-coffee.png",
    description: "Balanced espresso, steamed milk, and dense foam with chocolate dust.",
    temperature: "hot",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },
  {
    id: "prod-105",
    name: "Salted Caramel Latte",
    sku: "SKU-COF-005",
    barcode: "890100100005",
    price: 900,
    cost_price: 280,
    stock: 65,
    category: "Specialty Coffee",
    category_id: "cat-1",
    station: "bar",
    department: "Coffee Bar",
    image: "/latte-coffee.png",
    description: "Espresso with steamed milk, house-made salted caramel syrup.",
    temperature: "hot",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },
  {
    id: "prod-106",
    name: "Iced Vanilla Bean Latte",
    sku: "SKU-COF-006",
    barcode: "890100100006",
    price: 950,
    cost_price: 290,
    stock: 75,
    category: "Specialty Coffee",
    category_id: "cat-1",
    station: "bar",
    department: "Coffee Bar",
    image: "/iced-tea.png",
    description: "Madagascar vanilla, double shot espresso over crystal ice cubes.",
    temperature: "cold",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },
  {
    id: "prod-107",
    name: "Cold Brew Reserve (16hr Steep)",
    sku: "SKU-COF-007",
    barcode: "890100100007",
    price: 850,
    cost_price: 200,
    stock: 45,
    category: "Specialty Coffee",
    category_id: "cat-1",
    station: "bar",
    department: "Coffee Bar",
    image: "/iced-tea.png",
    description: "Steeped slowly for 16 hours; crisp, low acidity, naturally sweet.",
    temperature: "cold",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-108",
    name: "Mocha Belgian Chocolate",
    sku: "SKU-COF-008",
    barcode: "890100100008",
    price: 1100,
    cost_price: 350,
    stock: 50,
    category: "Specialty Coffee",
    category_id: "cat-1",
    station: "bar",
    department: "Coffee Bar",
    image: "/latte-coffee.png",
    description: "Ghirardelli Belgian dark chocolate sauce with rich espresso & milk.",
    temperature: "hot",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },

  // --- Artisan Teas ---
  {
    id: "prod-109",
    name: "Ceremonial Matcha Latte",
    sku: "SKU-TEA-001",
    barcode: "890100100009",
    price: 950,
    cost_price: 320,
    stock: 60,
    category: "Artisan Teas",
    category_id: "cat-2",
    station: "bar",
    department: "Coffee Bar",
    image: "/iced-tea.png",
    description: "Organic Uji Kyoto green tea whisked with oat milk.",
    temperature: "hot",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-110",
    name: "Highland Ceylon Black Tea",
    sku: "SKU-TEA-002",
    barcode: "890100100010",
    price: 350,
    cost_price: 70,
    stock: 150,
    category: "Artisan Teas",
    category_id: "cat-2",
    station: "bar",
    department: "Coffee Bar",
    image: "/iced-tea.png",
    description: "Single-estate Nuwara Eliya whole leaf golden pekoe.",
    temperature: "hot",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-111",
    name: "Lemongrass & Ginger Infusion",
    sku: "SKU-TEA-003",
    barcode: "890100100011",
    price: 450,
    cost_price: 90,
    stock: 90,
    category: "Artisan Teas",
    category_id: "cat-2",
    station: "bar",
    department: "Coffee Bar",
    image: "/iced-tea.png",
    description: "Caffeine-free soothing tisane with fresh spicy ginger root.",
    temperature: "hot",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-112",
    name: "Iced Hibiscus Berry Tea",
    sku: "SKU-TEA-004",
    barcode: "890100100012",
    price: 650,
    cost_price: 130,
    stock: 85,
    category: "Artisan Teas",
    category_id: "cat-2",
    station: "bar",
    department: "Coffee Bar",
    image: "/iced-tea.png",
    description: "Tart Egyptian hibiscus flower with crushed wild blackberries & mint.",
    temperature: "cold",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },

  // --- Bakery & Pastries ---
  {
    id: "prod-113",
    name: "French Almond Butter Croissant",
    sku: "SKU-BAK-001",
    barcode: "890100100013",
    price: 750,
    cost_price: 240,
    stock: 35,
    category: "Bakery & Pastries",
    category_id: "cat-3",
    station: "kitchen",
    department: "Juice & Food",
    image: "/apple-pie-slice.png",
    description: "Flaky European cultured butter pastry loaded with almond frangipane.",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },
  {
    id: "prod-114",
    name: "Belgian Chocolate Fudge Brownie",
    sku: "SKU-BAK-002",
    barcode: "890100100014",
    price: 650,
    cost_price: 180,
    stock: 40,
    category: "Bakery & Pastries",
    category_id: "cat-3",
    station: "kitchen",
    department: "Juice & Food",
    image: "/chocolate-brownie.png",
    description: "Warm fudgy dark chocolate square dusted with sea salt flakes.",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },
  {
    id: "prod-115",
    name: "New York Vanilla Cheesecake",
    sku: "SKU-BAK-003",
    barcode: "890100100015",
    price: 850,
    cost_price: 260,
    stock: 25,
    category: "Bakery & Pastries",
    category_id: "cat-3",
    station: "kitchen",
    department: "Juice & Food",
    image: "/cheesecake-slice.png",
    description: "Creamy baked cheesecake with a buttery graham cracker crust.",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },
  {
    id: "prod-116",
    name: "Artisan Cinnamon Swirl Brioche",
    sku: "SKU-BAK-004",
    barcode: "890100100016",
    price: 600,
    cost_price: 160,
    stock: 30,
    category: "Bakery & Pastries",
    category_id: "cat-3",
    station: "kitchen",
    department: "Juice & Food",
    image: "/apple-pie-slice.png",
    description: "Soft glazed brioche roll infused with Ceylon cinnamon glaze.",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },

  // --- Breakfast & Brunch ---
  {
    id: "prod-117",
    name: "Avocado Toast with Poached Eggs",
    sku: "SKU-BRN-001",
    barcode: "890100100017",
    price: 1800,
    cost_price: 520,
    stock: 50,
    category: "Breakfast & Brunch",
    category_id: "cat-4",
    station: "kitchen",
    department: "Juice & Food",
    image: "/vibrant-mixed-salad.png",
    description: "Smashed Hass avocado, two pasture-raised poached eggs, sourdough toast.",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },
  {
    id: "prod-118",
    name: "Royal Eggs Benedict",
    sku: "SKU-BRN-002",
    barcode: "890100100018",
    price: 2100,
    cost_price: 650,
    stock: 45,
    category: "Breakfast & Brunch",
    category_id: "cat-4",
    station: "kitchen",
    department: "Juice & Food",
    image: "/vibrant-mixed-salad.png",
    description: "English muffins, hickory smoked bacon, soft poached eggs, hollandaise.",
    dietary_tags: [],
    tax_rate: 0,
  },
  {
    id: "prod-119",
    name: "Fluffy Buttermilk Pancake Stack",
    sku: "SKU-BRN-003",
    barcode: "890100100019",
    price: 1600,
    cost_price: 400,
    stock: 40,
    category: "Breakfast & Brunch",
    category_id: "cat-4",
    station: "kitchen",
    department: "Juice & Food",
    image: "/ice-cream-sundae.png",
    description: "Triple stack pancakes, organic maple syrup, fresh berries, whipped butter.",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },
  {
    id: "prod-120",
    name: "Amazonian Acai Super Bowl",
    sku: "SKU-BRN-004",
    barcode: "890100100020",
    price: 1900,
    cost_price: 580,
    stock: 35,
    category: "Breakfast & Brunch",
    category_id: "cat-4",
    station: "kitchen",
    department: "Juice & Food",
    image: "/ice-cream-sundae.png",
    description: "Pure organic acai blend topped with chia seeds, banana, house granola.",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-121",
    name: "Breakfast Burrito Grande",
    sku: "SKU-BRN-005",
    barcode: "890100100021",
    price: 1950,
    cost_price: 550,
    stock: 40,
    category: "Breakfast & Brunch",
    category_id: "cat-4",
    station: "kitchen",
    department: "Juice & Food",
    image: "/classic-beef-burger.png",
    description: "Scrambled eggs, cheddar cheese, chorizo sausage, black beans, salsa.",
    dietary_tags: [],
    tax_rate: 0,
  },

  // --- Gourmet Burgers ---
  {
    id: "prod-122",
    name: "Prime Angus Cheeseburger",
    sku: "SKU-BGR-001",
    barcode: "890100100022",
    price: 2400,
    cost_price: 780,
    stock: 65,
    category: "Gourmet Burgers",
    category_id: "cat-5",
    station: "kitchen",
    department: "Juice & Food",
    image: "/classic-beef-burger.png",
    description: "200g prime Angus beef patty, aged cheddar, pickles, house relish on brioche.",
    dietary_tags: [],
    tax_rate: 0,
  },
  {
    id: "prod-123",
    name: "Crispy Buttermilk Chicken Burger",
    sku: "SKU-BGR-002",
    barcode: "890100100023",
    price: 2200,
    cost_price: 680,
    stock: 55,
    category: "Gourmet Burgers",
    category_id: "cat-5",
    station: "kitchen",
    department: "Juice & Food",
    image: "/classic-beef-burger.png",
    description: "Fried spiced chicken breast, creamy coleslaw, chipotle mayo, brioche.",
    dietary_tags: [],
    tax_rate: 0,
  },
  {
    id: "prod-124",
    name: "Portobello Truffle Vegan Burger",
    sku: "SKU-BGR-003",
    barcode: "890100100024",
    price: 2100,
    cost_price: 600,
    stock: 40,
    category: "Gourmet Burgers",
    category_id: "cat-5",
    station: "kitchen",
    department: "Juice & Food",
    image: "/classic-beef-burger.png",
    description: "Grilled marinated portobello mushroom, vegan truffle aioli, arugula.",
    dietary_tags: ["Vegan"],
    tax_rate: 0,
  },
  {
    id: "prod-125",
    name: "Smoked Bacon & BBQ Stack",
    sku: "SKU-BGR-004",
    barcode: "890100100025",
    price: 2600,
    cost_price: 850,
    stock: 45,
    category: "Gourmet Burgers",
    category_id: "cat-5",
    station: "kitchen",
    department: "Juice & Food",
    image: "/classic-beef-burger.png",
    description: "Angus beef, double crispy bacon, smoked cheddar, crispy onion rings, BBQ sauce.",
    dietary_tags: [],
    tax_rate: 0,
  },

  // --- Fresh Salads & Bowls ---
  {
    id: "prod-126",
    name: "Mediterranean Grilled Chicken Salad",
    sku: "SKU-SLD-001",
    barcode: "890100100026",
    price: 1950,
    cost_price: 580,
    stock: 40,
    category: "Fresh Salads & Bowls",
    category_id: "cat-6",
    station: "kitchen",
    department: "Juice & Food",
    image: "/vibrant-mixed-salad.png",
    description: "Herb-marinated chicken breast, Kalamata olives, feta, cherry tomatoes, lemon vinaigrette.",
    dietary_tags: ["Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-127",
    name: "Pacific Salmon Poke Bowl",
    sku: "SKU-SLD-002",
    barcode: "890100100027",
    price: 2600,
    cost_price: 900,
    stock: 35,
    category: "Fresh Salads & Bowls",
    category_id: "cat-6",
    station: "kitchen",
    department: "Juice & Food",
    image: "/vibrant-mixed-salad.png",
    description: "Sashimi grade salmon cubes, edamame, sushi rice, wakame, sesame soy dressing.",
    dietary_tags: ["Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-128",
    name: "Golden Quinoa & Roast Veggie Bowl",
    sku: "SKU-SLD-003",
    barcode: "890100100028",
    price: 1800,
    cost_price: 490,
    stock: 45,
    category: "Fresh Salads & Bowls",
    category_id: "cat-6",
    station: "kitchen",
    department: "Juice & Food",
    image: "/vibrant-mixed-salad.png",
    description: "Organic quinoa, roasted butternut squash, kale, pumpkin seeds, tahini drizzle.",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },

  // --- Sides & Starters ---
  {
    id: "prod-129",
    name: "Crispy Truffle Parmesan Fries",
    sku: "SKU-SID-001",
    barcode: "890100100029",
    price: 1400,
    cost_price: 350,
    stock: 90,
    category: "Sides & Starters",
    category_id: "cat-7",
    station: "kitchen",
    department: "Juice & Food",
    image: "/crispy-french-fries.png",
    description: "Hand-cut Idaho russet potato fries tossed in white truffle oil & aged parmesan.",
    dietary_tags: ["Vegetarian", "Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-130",
    name: "Garlic Parmesan Chicken Wings",
    sku: "SKU-SID-002",
    barcode: "890100100030",
    price: 1800,
    cost_price: 580,
    stock: 60,
    category: "Sides & Starters",
    category_id: "cat-7",
    station: "kitchen",
    department: "Juice & Food",
    image: "/crispy-chicken-wings.png",
    description: "Crispy fried jumbo wings tossed in roasted garlic butter and aged parmesan.",
    dietary_tags: ["Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-131",
    name: "Artisan Mozzarella Sticks",
    sku: "SKU-SID-003",
    barcode: "890100100031",
    price: 1300,
    cost_price: 360,
    stock: 50,
    category: "Sides & Starters",
    category_id: "cat-7",
    station: "kitchen",
    department: "Juice & Food",
    image: "/crispy-french-fries.png",
    description: "Herb-crusted melted mozzarella served with warm marinara dipping sauce.",
    dietary_tags: ["Vegetarian"],
    tax_rate: 0,
  },
  {
    id: "prod-132",
    name: "Wood-Fired Garlic Herb Flatbread",
    sku: "SKU-SID-004",
    barcode: "890100100032",
    price: 1100,
    cost_price: 250,
    stock: 55,
    category: "Sides & Starters",
    category_id: "cat-7",
    station: "kitchen",
    department: "Juice & Food",
    image: "/delicious-pizza.png",
    description: "Fresh dough baked with roasted garlic, rosemary, and extra virgin olive oil.",
    dietary_tags: ["Vegan"],
    tax_rate: 0,
  },

  // --- Cold Pressed Juices ---
  {
    id: "prod-133",
    name: "Green Cleanse Vitality Juice",
    sku: "SKU-JUC-001",
    barcode: "890100100033",
    price: 850,
    cost_price: 220,
    stock: 70,
    category: "Cold Pressed Juices",
    category_id: "cat-8",
    station: "bar",
    department: "Coffee Bar",
    image: "/glass-of-orange-juice.png",
    description: "Cold-pressed green apple, celery, cucumber, kale, and fresh lime.",
    temperature: "cold",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-134",
    name: "Sunburst Orange & Ginger Press",
    sku: "SKU-JUC-002",
    barcode: "890100100034",
    price: 800,
    cost_price: 200,
    stock: 80,
    category: "Cold Pressed Juices",
    category_id: "cat-8",
    station: "bar",
    department: "Coffee Bar",
    image: "/glass-of-orange-juice.png",
    description: "100% freshly pressed Valencia oranges with a warming touch of ginger.",
    temperature: "cold",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-135",
    name: "Tropical Passionfruit Cooler",
    sku: "SKU-JUC-003",
    barcode: "890100100035",
    price: 850,
    cost_price: 210,
    stock: 65,
    category: "Cold Pressed Juices",
    category_id: "cat-8",
    station: "bar",
    department: "Coffee Bar",
    image: "/glass-of-orange-juice.png",
    description: "Fresh passionfruit pulp, pineapple, mint leaves, sparkling spring water.",
    temperature: "cold",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },
  {
    id: "prod-136",
    name: "Pure Sparkling Mineral Water",
    sku: "SKU-JUC-004",
    barcode: "890100100036",
    price: 400,
    cost_price: 90,
    stock: 120,
    category: "Cold Pressed Juices",
    category_id: "cat-8",
    station: "bar",
    department: "Coffee Bar",
    image: "/bottled-water.png",
    description: "Natural carbonated mineral spring water in glass bottle 500ml.",
    temperature: "cold",
    dietary_tags: ["Vegan", "Gluten-Free"],
    tax_rate: 0,
  },
]

// ---------------------------------------------------------------------------
// 3. Mock Customers (Loyalty Members)
// ---------------------------------------------------------------------------
export const MOCK_CUSTOMERS: MockCustomer[] = [
  {
    id: "cust-1",
    name: "Sarah Jenkins",
    phone: "+94 77 123 4567",
    email: "sarah.j@example.com",
    address: "12 Beach Road, Hiriketiya",
    notes: "Prefers oat milk in coffee. Regular morning guest.",
    credit_limit: 25000,
    current_credit: 3500,
    loyalty_points: 340,
    vip: true,
    total_orders: 28,
    total_spent: 42500,
    created_at: "2026-08-10T08:30:00Z",
  },
  {
    id: "cust-2",
    name: "David De Silva",
    phone: "+94 71 987 6543",
    email: "david.desilva@example.com",
    address: "45 Ocean View Lane, Dikwella",
    notes: "Enjoys prime angus burger and flat white.",
    credit_limit: 15000,
    current_credit: 0,
    loyalty_points: 180,
    vip: false,
    total_orders: 14,
    total_spent: 24600,
    created_at: "2026-09-02T11:15:00Z",
  },
  {
    id: "cust-3",
    name: "Elena Rostova",
    phone: "+94 76 555 4321",
    email: "elena.rostova@example.com",
    address: "Villa 3, Coral Reef Grove",
    notes: "Remote worker, frequently books Terrace Table 4.",
    credit_limit: 30000,
    current_credit: 8200,
    loyalty_points: 520,
    vip: true,
    total_orders: 41,
    total_spent: 68900,
    created_at: "2026-07-15T09:40:00Z",
  },
  {
    id: "cust-4",
    name: "Liam O'Connor",
    phone: "+94 70 333 7788",
    email: "liam.oc@example.com",
    address: "Sunset Point Road, Hiriketiya",
    notes: "Surf instructor, large groups for brunch.",
    credit_limit: 20000,
    current_credit: 0,
    loyalty_points: 210,
    vip: false,
    total_orders: 19,
    total_spent: 31200,
    created_at: "2026-09-18T14:20:00Z",
  },
  {
    id: "cust-5",
    name: "Ananya Patel",
    phone: "+94 77 888 9911",
    email: "ananya.p@example.com",
    address: "7 Temple View Crest",
    notes: "Strict vegetarian, loves Matcha and Acai bowls.",
    credit_limit: 15000,
    current_credit: 0,
    loyalty_points: 290,
    vip: true,
    total_orders: 22,
    total_spent: 36400,
    created_at: "2026-08-25T16:00:00Z",
  },
]

// ---------------------------------------------------------------------------
// 4. Mock Tables
// ---------------------------------------------------------------------------
export const MOCK_TABLES: MockTable[] = [
  { id: "tbl-1", name: "Table 1", capacity: 2, status: "available", section: "Indoor" },
  { id: "tbl-2", name: "Table 2", capacity: 4, status: "occupied", section: "Indoor" },
  { id: "tbl-3", name: "Table 3", capacity: 4, status: "available", section: "Indoor" },
  { id: "tbl-4", name: "Table 4", capacity: 6, status: "available", section: "Indoor" },
  { id: "tbl-5", name: "Table 5", capacity: 2, status: "available", section: "Indoor" },
  { id: "tbl-6", name: "Table 6", capacity: 4, status: "available", section: "Indoor" },
  { id: "tbl-7", name: "Terrace 1", capacity: 2, status: "available", section: "Terrace" },
  { id: "tbl-8", name: "Terrace 2", capacity: 4, status: "occupied", section: "Terrace" },
  { id: "tbl-9", name: "Terrace 3", capacity: 4, status: "available", section: "Terrace" },
  { id: "tbl-10", name: "Terrace 4", capacity: 6, status: "reserved", section: "Terrace" },
  { id: "tbl-11", name: "VIP Lounge", capacity: 8, status: "available", section: "VIP Lounge" },
  { id: "tbl-12", name: "Bar Counter 1", capacity: 1, status: "available", section: "Bar" },
  { id: "tbl-13", name: "Bar Counter 2", capacity: 1, status: "available", section: "Bar" },
  { id: "tbl-14", name: "Bar Counter 3", capacity: 1, status: "available", section: "Bar" },
]

// ---------------------------------------------------------------------------
// 5. Mock Inventory Ingredients
// ---------------------------------------------------------------------------
export const MOCK_INGREDIENTS: MockIngredient[] = [
  { id: "ing-1", sku: "ING-BEA-01", name: "Single Origin Arabica Beans", category: "Coffee", current_stock: 45.5, base_unit: "kg", reorder_level: 10, cost_per_unit: 4200 },
  { id: "ing-2", sku: "ING-MLK-01", name: "Fresh Farm Dairy Milk", category: "Dairy", current_stock: 62.0, base_unit: "L", reorder_level: 20, cost_per_unit: 450 },
  { id: "ing-3", sku: "ING-OAT-01", name: "Barista Edition Oat Milk", category: "Dairy", current_stock: 34.0, base_unit: "L", reorder_level: 12, cost_per_unit: 950 },
  { id: "ing-4", sku: "ING-BEEF-01", name: "Prime Angus Beef Mince", category: "Meat", current_stock: 28.0, base_unit: "kg", reorder_level: 8, cost_per_unit: 3800 },
  { id: "ing-5", sku: "ING-CHK-01", name: "Free Range Chicken Breast", category: "Meat", current_stock: 35.0, base_unit: "kg", reorder_level: 10, cost_per_unit: 2200 },
  { id: "ing-6", sku: "ING-AVO-01", name: "Fresh Hass Avocado", category: "Produce", current_stock: 24.5, base_unit: "kg", reorder_level: 6, cost_per_unit: 1400 },
  { id: "ing-7", sku: "ING-POT-01", name: "Idaho Russet Potatoes", category: "Produce", current_stock: 80.0, base_unit: "kg", reorder_level: 25, cost_per_unit: 380 },
  { id: "ing-8", sku: "ING-EGG-01", name: "Pasture Raised Free Range Eggs", category: "Dairy", current_stock: 240, base_unit: "pcs", reorder_level: 60, cost_per_unit: 45 },
  { id: "ing-9", sku: "ING-BUN-01", name: "Artisan Brioche Burger Buns", category: "Bakery", current_stock: 95, base_unit: "pcs", reorder_level: 30, cost_per_unit: 180 },
  { id: "ing-10", sku: "ING-CHD-01", name: "Aged Cheddar Cheese Blocks", category: "Dairy", current_stock: 16.0, base_unit: "kg", reorder_level: 5, cost_per_unit: 3200 },
]

// ---------------------------------------------------------------------------
// 6. Mock Historical Orders & Transactions (Last 7 Days)
// ---------------------------------------------------------------------------
function makeOrderTime(daysAgo: number, hour: number, minute: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const MOCK_HISTORICAL_ORDERS: MockOrder[] = [
  {
    id: "ord-ls-001",
    order_number: "LS-000101",
    receipt_number: "LS-RC-000101",
    table_name: "Table 1",
    cashier_name: "Alexa Pheloung",
    department: "Juice & Food",
    order_type: "dine_in",
    items: [
      { id: "item-ls-1", product_id: "prod-103", name: "Velvet Flat White", price: 750, quantity: 2, line_total: 1500, station: "bar", category: "Specialty Coffee" },
      { id: "item-ls-2", product_id: "prod-117", name: "Avocado Toast with Poached Eggs", price: 1800, quantity: 1, line_total: 1800, station: "kitchen", category: "Breakfast & Brunch" },
    ],
    subtotal: 3300,
    service_charge: 330,
    service_charge_rate: 0.1,
    discount: 0,
    tax: 0,
    total: 3630,
    payment_method: "card",
    cash_received: 3630,
    change_amount: 0,
    status: "completed",
    payment_status: "paid",
    kitchen_status: "served",
    bar_status: "served",
    customer_name: "Liam O'Connor",
    customer_id: "cust-4",
    created_at: makeOrderTime(0, 8, 30),
  },
  {
    id: "ord-ls-002",
    order_number: "LS-000102",
    receipt_number: "LS-RC-000102",
    table_name: "Takeaway",
    cashier_name: "Alexa Pheloung",
    department: "Coffee Bar",
    order_type: "takeaway",
    items: [
      { id: "item-ls-3", product_id: "prod-106", name: "Iced Vanilla Bean Latte", price: 950, quantity: 1, line_total: 950, station: "bar", category: "Specialty Coffee" },
      { id: "item-ls-4", product_id: "prod-113", name: "French Almond Butter Croissant", price: 750, quantity: 1, line_total: 750, station: "kitchen", category: "Bakery & Pastries" },
    ],
    subtotal: 1700,
    service_charge: 0,
    service_charge_rate: 0,
    discount: 0,
    tax: 0,
    total: 1700,
    payment_method: "cash",
    cash_received: 2000,
    change_amount: 300,
    status: "completed",
    payment_status: "paid",
    kitchen_status: "served",
    bar_status: "served",
    customer_name: "Walk-in Guest",
    created_at: makeOrderTime(0, 9, 15),
  },
  {
    id: "ord-ls-003",
    order_number: "LS-000103",
    receipt_number: "LS-RC-000103",
    table_name: "Table 3",
    cashier_name: "Alexa Pheloung",
    department: "Juice & Food",
    order_type: "dine_in",
    items: [
      { id: "item-ls-5", product_id: "prod-109", name: "Ceremonial Matcha Latte", price: 950, quantity: 1, line_total: 950, station: "bar", category: "Artisan Teas" },
      { id: "item-ls-6", product_id: "prod-135", name: "Tropical Passionfruit Cooler", price: 850, quantity: 1, line_total: 850, station: "bar", category: "Cold Pressed Juices" },
      { id: "item-ls-7", product_id: "prod-129", name: "Crispy Truffle Parmesan Fries", price: 1400, quantity: 1, line_total: 1400, station: "kitchen", category: "Sides & Starters" },
    ],
    subtotal: 3200,
    service_charge: 320,
    service_charge_rate: 0.1,
    discount: 0,
    tax: 0,
    total: 3520,
    payment_method: "card",
    cash_received: 3520,
    change_amount: 0,
    status: "paid",
    payment_status: "paid",
    kitchen_status: "preparing",
    bar_status: "preparing",
    customer_name: "Sarah Jenkins",
    customer_id: "cust-1",
    created_at: makeOrderTime(0, 10, 5),
  },
]
