"use client"

import type React from "react"
import { Coffee, IceCream, LayoutGrid, Utensils, Sandwich, CakeSlice, GlassWater } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CategorySidebarProps { selectedCategory: string; onSelectCategory: (category: string) => void; mode?: "restaurant" | "coffee" }
interface CategoryItem { id: string; name: string; icon: React.ElementType }

const foodCategories: CategoryItem[] = [
  { id: "all", name: "All menu", icon: LayoutGrid }, { id: "food", name: "Mains & food", icon: Utensils },
  { id: "drinks", name: "Drinks", icon: GlassWater }, { id: "desserts", name: "Desserts", icon: CakeSlice },
]
const coffeeCategories: CategoryItem[] = [
  { id: "all", name: "Popular", icon: LayoutGrid }, { id: "drinks", name: "Coffee", icon: Coffee },
  { id: "food", name: "Quick bites", icon: Sandwich }, { id: "desserts", name: "Sweet treats", icon: IceCream },
]

export default function CategorySidebar({ selectedCategory, onSelectCategory, mode = "restaurant" }: CategorySidebarProps) {
  const categories = mode === "coffee" ? coffeeCategories : foodCategories
  return <div className="mb-7 flex gap-2 overflow-x-auto pb-1">
    {categories.map(({ id, name, icon: Icon }) => <Button key={id} variant="ghost" onClick={() => onSelectCategory(id)} className={cn("h-auto shrink-0 gap-2 rounded-xl border px-4 py-2.5", selectedCategory === id ? "border-[#2f6047] bg-[#2f6047] text-white hover:bg-[#2f6047] hover:text-white" : "border-[#e1e5da] bg-white text-[#68736a] hover:bg-[#edf2e8]") }><Icon />{name}</Button>)}
  </div>
}

