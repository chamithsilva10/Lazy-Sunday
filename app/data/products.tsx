import type { Product } from "../context/cart-context"
import { resolveProductImage } from "@/lib/product-images"
import { determineItemStation } from "@/lib/station-routing"

type MenuProduct = Product & {
  description?: string
  productType?: string
  isVegan?: boolean
  isGlutenFree?: boolean
  modifiers?: string[]
  station?: "kitchen" | "bar"
  department?: string
}

const item = (id: number, name: string, price: number, category: string, description = "", isVegan?: boolean, isGlutenFree?: boolean): MenuProduct => {
  const station = determineItemStation({ name, category })
  return {
    id,
    name,
    price,
    category,
    image: resolveProductImage(name, undefined, category),
    description,
    isVegan,
    isGlutenFree,
    station,
    department: station === "bar" ? "Coffee Bar" : "Juice & Food",
  }
}

export const products: MenuProduct[] = [
  ...[
    ["Black Tea",250],["Ginger Tea",300],["Green Tea",300],["Cinnamon Tea",300],["Cardamom Tea",300],
  ].map(([name, price], i) => item(i + 1, name as string, price as number, "Tea", "Freshly brewed tea")),
  ...[
    ["Espresso",500],["Cappuccino",700],["Mocha",1200],["Latte",800],["Flat White",650],["Americano",600],["Bumble Coffee",1200],["Espresso Tonic",1000],
  ].map(([name, price], i) => item(i + 6, name as string, price as number, "Hot Coffee", "Specialty coffee")),
  ...[
    ["Matcha Latte",800],["Iced Cappuccino",800],["Iced Latte",900],["Iced Americano",700],["Iced Matcha Latte",1000],
  ].map(([name, price], i) => item(i + 14, name as string, price as number, "Cold Coffee", "Chilled coffee beverage")),
  ...[
    ["Extra Vanilla",200],["Extra Caramel",200],["Oat Milk",500],["Soya Milk",500],["Almond Milk",500],["Coffee V60",1100],
  ].map(([name, price], i) => item(i + 19, name as string, price as number, "Add-ons", "Optional coffee modifier")),
  item(25, "Water", 250, "Beverages"), item(26, "Fresh Coconut", 350, "Beverages"), item(27, "Soft Drinks", 400, "Beverages", "Soda, Coca-Cola, Sprite, Ginger Beer, Coke Zero"), item(28, "Fresh Juice", 800, "Beverages", "Lime, Mango, Papaya, Pineapple, Watermelon, Passion Fruit, Banana"), item(29, "Mix Juice", 900, "Beverages", "Mixed fresh juice"),
  item(30, "Crispy Tofu", 1000, "Appetizer", "Crispy tofu", true), item(31, "Garlic Bread with Mozzarella", 1300, "Appetizer"), item(32, "French Fries", 1500, "Appetizer"),
  item(33, "Fresh Green Salad", 1400, "Salad", "Cabbage, cucumber, spring onion, tomato, carrot and vinaigrette dressing", true), item(34, "Avocado Salad", 1800, "Salad", "Avocado, cucumber, tomato, parsley and olive oil", true), item(35, "Catalana di Gamberi", 1800, "Salad", "Prawns, leeks, tomatoes, olive oil and lime"), item(36, "Chicken Salad", 1900, "Salad", "Chicken, vegetables, Parmesan, mayonnaise and olive oil"),
  item(37, "Pumpkin Soup", 1800, "Soup", "With herbs, served with garlic bread", true), item(38, "Vegan Noodles Soup", 1800, "Soup", "Fresh vegetables, rice noodles, tofu and coconut milk", true), item(39, "Creamy Chicken Soup", 1900, "Soup", "Chicken, carrot, potato, cabbage, leeks, pumpkin, onion and garlic"),
  item(40, "Tuna Tartare", 2300, "Mains", "Fresh tuna, avocado, onion, tomato, capers and olive oil"), item(41, "Hummus with Paratha Rotti", 1800, "Mains", "Chickpea, tahini, garlic, cumin and lime", true), item(42, "BBQ Tofu Rice", 2000, "Mains", "Tofu, vegan BBQ sauce, bell pepper, onion and tomato", true, true), item(43, "Buddha Bowl", 2500, "Mains", "Beans, chickpeas, vegetables, tofu, salad and rice", true, true), item(44, "Vegan Spaghetti Bolognese", 2200, "Mains", "Minced soya, tomato concasse sauce and herbs", true), item(45, "Black Chicken Curry", 2300, "Mains", "Coconut rotti, rice and coconut sambol"), item(46, "Zucchini Gamberi", 2500, "Mains", "Fusilli with zucchini pesto and prawns"), item(47, "Gnocchi con Calamari", 2300, "Mains", "Homemade potato gnocchi with calamari and tomato sauce"), item(48, "Nasi Goreng", 2000, "Mains", "Asian rice with seafood and fried egg"), item(49, "Shakshouka", 2000, "Mains", "Two eggs in tomato concasse with bread"), item(50, "Grilled Tuna", 2500, "Mains", "Boiled vegetables, mashed potato and BBQ sauce"), item(51, "Vegan Penne Ai Funghi", 2000, "Mains", "Coconut milk, mushroom and herbs", true), item(52, "Seafood Marinara", 2500, "Mains", "Fish, calamari, prawns and herbs"),
  item(53, "Prime Angus Burger", 2000, "Handheld", "Signature house patty with fries and salad", true), item(54, "Mushroom Burger", 2200, "Handheld", "Plant-based patty with fries and salad", true), item(55, "Veggie Panini", 1800, "Handheld", "Vegetables, lettuce, tomato, cucumber and fries", true), item(56, "Signature Chicken Panini", 1800, "Handheld", "Signature vegetables, lettuce, tomato, cucumber and fries", true), item(57, "Egg and Cheese Panini", 1900, "Handheld", "Egg, tomato, cucumber, lettuce and fries"), item(58, "Coconut Sambol Panini", 2000, "Handheld", "Mozzarella, fried egg, salad and fries"), item(59, "Club Sandwich", 2200, "Handheld", "Chicken ham, lettuce, tomato, onion, egg and fries"),
  item(60, "Fruit Platter", 1400, "Morning Breath"), item(61, "Best Bowl", 1800, "Morning Breath", "Avocado, hash browns, bacon, sausage, sourdough and eggs"), item(62, "Eggs Benedict", 1900, "Morning Breath", "Poached eggs, Hollandaise, bacon, avocado and sourdough"), item(63, "Spinach and Potato Omelette", 1700, "Morning Breath", "Spinach, potato, onion, tomato and sourdough"), item(64, "Scrambled Tofu", 1800, "Morning Breath", "Avocado, sourdough and spinach", true), item(65, "Vegan New York Pancake", 1800, "Morning Breath", "Banana and treacle with chocolate sauce", true), item(66, "Sri Lankan Coconut Rotti", 1800, "Morning Breath", "Dhal curry and coconut sambol", true), item(67, "Breaky Burger", 1900, "Morning Breath", "Hash browns, bacon, fried egg and fresh leaves"),
  item(68, "Mango Smoothie Bowl", 1900, "Trendy and Catchy", "Mango, banana, coconut milk, seeds and fresh fruit", true), item(69, "Coco Banana Smoothie Bowl", 1800, "Trendy and Catchy", "Cocoa, banana, coconut milk, seeds and fresh fruit", true), item(70, "Vegan Porridge Bowl", 1900, "Trendy and Catchy", "Oats, coconut milk, dates, raisins, peanut and banana", true), item(71, "Granola Bowl", 2000, "Trendy and Catchy", "Granola, curd, fresh fruit and treacle"),
].map((p, i) => ({ ...p, id: i + 1 }))

export const modifiers = [
  { name: "Extra Vanilla", price: 200 }, { name: "Extra Caramel", price: 200 }, { name: "Oat Milk", price: 500 }, { name: "Soya Milk", price: 500 }, { name: "Almond Milk", price: 500 },
]

export const productCategories = ["All", "Tea", "Hot Coffee", "Cold Coffee", "Add-ons", "Beverages", "Appetizer", "Salad", "Soup", "Mains", "Handheld", "Morning Breath", "Trendy and Catchy"]

export { products as demoMenu }
export type { MenuProduct }
