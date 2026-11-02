/**
 * Title-matching food & beverage photography mapping for POS and Digital Menu.
 * Contains high-definition, curated photos for every drink, tea, coffee, breakfast,
 * bowl, burger, salad, soup, and main course item.
 */

export const PRODUCT_IMAGE_MAP: Record<string, string> = {
  // Tea
  "Black Tea": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
  "Ginger Tea": "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80",
  "Green Tea": "https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=600&q=80",
  "Cinnamon Tea": "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80",
  "Cardamom Tea": "https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80",

  // Hot Coffee
  "Espresso": "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80",
  "Espresso Single": "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80",
  "Espresso Double": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
  "Cappuccino": "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80",
  "Mocha": "https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=600&q=80",
  "Latte": "/latte-coffee.png",
  "Caffe Latte": "/latte-coffee.png",
  "Flat White": "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80",
  "Americano": "https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80",
  "Bumble Coffee": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
  "Espresso Tonic": "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80",
  "Coffee V60": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80",
  "Cold Brew Reserve": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80",

  // Cold Coffee & Matcha
  "Matcha Latte": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
  "Iced Cappuccino": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80",
  "Iced Latte": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80",
  "Iced Americano": "https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=600&q=80",
  "Iced Matcha Latte": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
  "Iced Lemon Tea": "/iced-tea.png",

  // Add-ons & Dairy Alternatives
  "Extra Vanilla": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
  "Extra Caramel": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
  "Oat Milk": "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
  "Soya Milk": "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
  "Almond Milk": "https://images.unsplash.com/photo-1568651316335-51dc5d82dc8c?auto=format&fit=crop&w=600&q=80",

  // Beverages & Juices
  "Water": "/bottled-water.png",
  "Fresh Coconut": "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80",
  "King Coconut Fresh": "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80",
  "Soft Drinks": "/refreshing-cola.png",
  "Fresh Juice": "/glass-of-orange-juice.png",
  "Mix Juice": "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80",
  "Papaya Lime Juice": "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80",
  "Watermelon Cooler": "https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?auto=format&fit=crop&w=600&q=80",
  "Pineapple Mint Zing": "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80",
  "Passion Fruit Sparkler": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
  "Mango Passion Smoothie": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80",
  "Dragonfruit Dream Shake": "https://images.unsplash.com/photo-1553530979-fcd4916a4f7e?auto=format&fit=crop&w=600&q=80",
  "Peanut Butter Banana Shake": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80",

  // Appetizers
  "Crispy Tofu": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
  "Garlic Bread with Mozzarella": "https://images.unsplash.com/photo-1619860860774-1e2e17343432?auto=format&fit=crop&w=600&q=80",
  "French Fries": "/crispy-french-fries.png",
  "Crispy French Fries": "/crispy-french-fries.png",
  "Cheesy Garlic Fries": "https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=600&q=80",
  "Crispy Chicken Wings": "/crispy-chicken-wings.png",

  // Salads
  "Fresh Green Salad": "/vibrant-mixed-salad.png",
  "Avocado Salad": "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",
  "Catalana di Gamberi": "https://images.unsplash.com/photo-1559742811-822873691df8?auto=format&fit=crop&w=600&q=80",
  "Chicken Salad": "https://images.unsplash.com/photo-1580013759032-c96505e24c1f?auto=format&fit=crop&w=600&q=80",
  "Hiriketiya Salad Bowl": "/vibrant-mixed-salad.png",

  // Soups
  "Pumpkin Soup": "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=600&q=80",
  "Vegan Noodles Soup": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80",
  "Creamy Chicken Soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80",

  // Mains
  "Tuna Tartare": "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80",
  "Hummus with Paratha Rotti": "https://images.unsplash.com/photo-1577906096429-f73c2c312435?auto=format&fit=crop&w=600&q=80",
  "BBQ Tofu Rice": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80",
  "Buddha Bowl": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
  "Vegan Spaghetti Bolognese": "https://images.unsplash.com/photo-1621996346565-e3d5d6281146?auto=format&fit=crop&w=600&q=80",
  "Black Chicken Curry": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80",
  "Zucchini Gamberi": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
  "Gnocchi con Calamari": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80",
  "Nasi Goreng": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80",
  "Shakshouka": "https://images.unsplash.com/photo-1590412200988-a436970781fa?auto=format&fit=crop&w=600&q=80",
  "Grilled Tuna": "https://images.unsplash.com/photo-1501595091296-3aa970afb3ff?auto=format&fit=crop&w=600&q=80",
  "Vegan Penne Ai Funghi": "https://images.unsplash.com/photo-1556760544-74068565f05c?auto=format&fit=crop&w=600&q=80",
  "Seafood Marinara": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
  "Delicious Handcrafted Pizza": "/delicious-pizza.png",

  // Handheld (Burgers & Paninis)
  "Prime Angus Burger": "/classic-beef-burger.png",
  "Classic Beef Burger": "/classic-beef-burger.png",
  "Mushroom Burger": "https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=600&q=80",
  "Veggie Panini": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80",
  "Signature Chicken Panini": "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80",
  "Egg and Cheese Panini": "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
  "Coconut Sambol Panini": "https://images.unsplash.com/photo-1619860860774-1e2e17343432?auto=format&fit=crop&w=600&q=80",
  "Club Sandwich": "https://images.unsplash.com/photo-1567234669003-dce7a7a88821?auto=format&fit=crop&w=600&q=80",

  // Breakfast & Brunch (Morning Breath)
  "Fruit Platter": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=600&q=80",
  "Best Bowl": "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
  "Eggs Benedict": "https://images.unsplash.com/photo-1608039829572-78524f79c4c7?auto=format&fit=crop&w=600&q=80",
  "Spinach and Potato Omelette": "https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=600&q=80",
  "Scrambled Tofu": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
  "Vegan New York Pancake": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&q=80",
  "Sri Lankan Coconut Rotti": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80",
  "Breaky Burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",

  // Smoothie & Grain Bowls (Trendy and Catchy)
  "Mango Smoothie Bowl": "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80",
  "Tropical Green Bowl": "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80",
  "Coco Banana Smoothie Bowl": "https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=600&q=80",
  "Vegan Porridge Bowl": "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=600&q=80",
  "Granola Bowl": "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=600&q=80",

  // Desserts
  "Warm Apple Pie Slice": "/apple-pie-slice.png",
  "New York Cheesecake Slice": "/cheesecake-slice.png",
  "Chocolate Fudge Brownie": "/chocolate-brownie.png",
  "Chocolate Cake Slice": "/chocolate-cake-slice.png",
  "Artisan Ice Cream Sundae": "/ice-cream-sundae.png",
}

/**
 * Resolves the appropriate title-matching photo URL for any product.
 * Returns the provided image if it's already a valid non-placeholder image,
 * otherwise matches the product name or category keywords against curated photos.
 */
export function resolveProductImage(name: string, currentImage?: string | null, category?: string): string {
  // If a valid custom image is already provided and not a placeholder, use it
  if (
    currentImage &&
    !currentImage.includes("placeholder") &&
    currentImage.trim() !== ""
  ) {
    return currentImage
  }

  const cleanName = (name || "").trim()

  // 1. Direct exact match
  if (PRODUCT_IMAGE_MAP[cleanName]) {
    return PRODUCT_IMAGE_MAP[cleanName]
  }

  // 2. Case-insensitive match
  const lowerName = cleanName.toLowerCase()
  for (const [key, url] of Object.entries(PRODUCT_IMAGE_MAP)) {
    if (key.toLowerCase() === lowerName) {
      return url
    }
  }

  // 3. Keyword / partial matching
  if (lowerName.includes("burger")) return "/classic-beef-burger.png"
  if (lowerName.includes("fries")) return "/crispy-french-fries.png"
  if (lowerName.includes("pizza")) return "/delicious-pizza.png"
  if (lowerName.includes("salad")) return "/vibrant-mixed-salad.png"
  if (lowerName.includes("wing")) return "/crispy-chicken-wings.png"
  if (lowerName.includes("latte") || lowerName.includes("cappuccino") || lowerName.includes("flat white")) return "/latte-coffee.png"
  if (lowerName.includes("espresso") || lowerName.includes("americano") || lowerName.includes("coffee")) return "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80"
  if (lowerName.includes("tea")) return "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80"
  if (lowerName.includes("juice") || lowerName.includes("cooler")) return "/glass-of-orange-juice.png"
  if (lowerName.includes("shake") || lowerName.includes("smoothie")) return "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80"
  if (lowerName.includes("bowl")) return "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80"
  if (lowerName.includes("soup")) return "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=600&q=80"
  if (lowerName.includes("panini") || lowerName.includes("sandwich")) return "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80"
  if (lowerName.includes("cake") || lowerName.includes("cheesecake")) return "/cheesecake-slice.png"
  if (lowerName.includes("brownie") || lowerName.includes("chocolate")) return "/chocolate-brownie.png"
  if (lowerName.includes("pie")) return "/apple-pie-slice.png"
  if (lowerName.includes("sundae") || lowerName.includes("ice cream")) return "/ice-cream-sundae.png"
  if (lowerName.includes("curry") || lowerName.includes("rice")) return "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80"
  if (lowerName.includes("pasta") || lowerName.includes("spaghetti") || lowerName.includes("penne")) return "https://images.unsplash.com/photo-1621996346565-e3d5d6281146?auto=format&fit=crop&w=600&q=80"
  if (lowerName.includes("rotti") || lowerName.includes("bread") || lowerName.includes("pancake")) return "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&q=80"
  if (lowerName.includes("coconut")) return "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80"
  if (lowerName.includes("cola") || lowerName.includes("soda") || lowerName.includes("drink")) return "/refreshing-cola.png"
  if (lowerName.includes("water")) return "/bottled-water.png"

  // 4. Category-based fallback
  const cat = (category || "").toLowerCase()
  if (cat.includes("coffee")) return "/latte-coffee.png"
  if (cat.includes("tea")) return "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80"
  if (cat.includes("juice") || cat.includes("beverage")) return "/glass-of-orange-juice.png"
  if (cat.includes("burger") || cat.includes("handheld")) return "/classic-beef-burger.png"
  if (cat.includes("salad")) return "/vibrant-mixed-salad.png"
  if (cat.includes("soup")) return "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=600&q=80"
  if (cat.includes("dessert")) return "/cheesecake-slice.png"

  return "/vibrant-mixed-salad.png"
}
