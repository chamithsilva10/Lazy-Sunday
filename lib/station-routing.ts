export type StationType = "kitchen" | "bar"

export interface StationRoutableItem {
  name?: string | null
  category?: string | null
  station?: string | null
  department?: string | null
  department_override?: string | null
}

/**
 * Determines whether an item routes to the Kitchen (food / eating) or the Bar (drinks / juice / coffee / beverages).
 */
export function determineItemStation(item: StationRoutableItem): StationType {
  // 1. Explicit station assignment
  const station = String(item.station || "").toLowerCase().trim()
  if (station === "bar") return "bar"
  if (station === "kitchen") return "kitchen"

  // 2. Explicit department check
  const dept = String(item.department_override || item.department || "").toLowerCase().trim()
  if (/\b(coffee\s*bar|bar\s*drinks?|bar|beverage\s*station)\b/i.test(dept)) return "bar"
  if (/\b(kitchen|food|chef|cook|bakery|hot\s*kitchen)\b/i.test(dept)) return "kitchen"

  const cat = String(item.category || "").toLowerCase().trim()
  const name = String(item.name || "").toLowerCase().trim()

  // 3. Exception for food bowls and eating items (e.g. smoothie bowl, buddha bowl, salads, soups)
  if (/\b(bowl|bowls|salad|salads|soup|soups|platter|tartare|curry|rotti|roti|rice|sandwich|sandwiches|burger|burgers|panini|toast|pancake|pancakes|waffle|waffles|muffin|croissant|cake|pie|cookie|fries|bread)\b/i.test(name)) {
    return "kitchen"
  }

  // 4. Category matching for Drinks/Bar
  if (
    /\b(bar|drinks?|drinking|beverages?|juices?|juice\s*bar|smoothies?|shakes?|milkshakes?|coffee|coffees?|hot\s*coffee|cold\s*coffee|teas?|add[\s-]?ons?|cocktails?|mocktails?|wines?|beers?|spirits?|liquor|sodas?|soft[\s-]?drinks?|waters?|coolers?|frappes?|brews?|latte|espresso|cappuccino)\b/i.test(
      cat,
    )
  ) {
    return "bar"
  }

  // 5. Category matching for Kitchen/Food
  if (
    /\b(kitchen|food|eating|mains?|meals?|dishes?|breakfast|lunch|dinner|handheld|burgers?|sandwiches?|panini|toast|appetizers?|starters?|salads?|soups?|pasta|pizza|desserts?|cakes?|pastr(y|ies)|bakery|buns?|snacks?|morning\s*breath|trendy|bowls?|curry|rice|noodles?|platter|grill)\b/i.test(
      cat,
    )
  ) {
    return "kitchen"
  }

  // 6. Name matching for Drinks/Bar (juices, drinking items)
  if (
    /\b(juice|juices|drink|drinks|drinking|beverage|beverages|coffee|tea|teas|smoothie|smoothies|shake|shakes|milkshake|milkshakes|mocktail|mocktails|cocktail|cocktails|wine|beer|spirit|liquor|soda|sodas|water|waters|coconut|cooler|coolers|frappe|espresso|latte|cappuccino|americano|macchiato|flat[\s-]?white|cold[\s-]?brew|lemonade|mojito|tonic|sprite|coke|cola|pepsi|fanta|iced|matcha|boba|chai|cortado|affogato|cider)\b/i.test(
      name,
    )
  ) {
    return "bar"
  }

  // 7. Name matching for Kitchen/Food
  if (
    /\b(burger|burgers|sandwich|sandwiches|panini|toast|wrap|wraps|pasta|spaghetti|fusilli|penne|pizza|salad|soup|tofu|fries|garlic[\s-]?bread|tartare|hummus|paratha|rotti|roti|rice|noodle|noodles|curry|dhal|sambol|gamberi|calamari|nasi[\s-]?goreng|shakshouka|chicken|beef|pork|fish|tuna|prawns?|seafood|steak|omelette|eggs?|benedict|pancake|pancakes|porridge|granola|bowl|waffle|muffin|croissant|cake|pie|pastry|cookie|bread|platter)\b/i.test(
      name,
    )
  ) {
    return "kitchen"
  }

  // Default fallback
  return "kitchen"
}

export function isBarItem(item: StationRoutableItem): boolean {
  return determineItemStation(item) === "bar"
}

export function isKitchenItem(item: StationRoutableItem): boolean {
  return determineItemStation(item) === "kitchen"
}

export type OrderStationScope = "bar" | "kitchen" | "mixed"

/**
 * Returns whether an entire order is purely bar items, purely kitchen items, or a mixed order.
 */
export function getOrderStationScope(items: StationRoutableItem[] | undefined | null): OrderStationScope {
  if (!items || items.length === 0) return "kitchen"
  let hasBar = false
  let hasKitchen = false
  for (const item of items) {
    const station = determineItemStation(item)
    if (station === "bar") hasBar = true
    if (station === "kitchen") hasKitchen = true
  }
  if (hasBar && hasKitchen) return "mixed"
  if (hasBar) return "bar"
  return "kitchen"
}

