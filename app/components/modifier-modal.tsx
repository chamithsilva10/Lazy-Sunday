"use client"

import { useState, useEffect } from "react"
import type { Product } from "@/app/page"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { resolveProductImage } from "@/lib/product-images"
import { Check } from "lucide-react"

export interface ModifierOption {
  label: string
  price: number
}

export interface ModifierGroup {
  id: string
  title: string
  options: ModifierOption[]
  defaultOption: string
}

export function getApplicableModifierGroups(productName: string): ModifierGroup[] {
  const name = (productName || "").trim().toLowerCase()
  const groups: ModifierGroup[] = []

  const isChocolateDrink = (name === "chocolate" || name.startsWith("chocolate —") || name.startsWith("chocolate -") || name === "hot chocolate") && !name.includes("brownie") && !name.includes("muffin")

  // 1. Temperature: Hot / Iced
  // Apply to: Long Black; Cappuccino; Latte; Mocha; V60 Pour Over; Matcha Latte; Chocolate; Chai
  if (
    name.includes("long black") ||
    name.includes("cappuccino") ||
    name === "latte" ||
    name.includes("caffe latte") ||
    name.includes("mocha") ||
    name.includes("pour over") ||
    name.includes("v60") ||
    name.includes("matcha latte") ||
    isChocolateDrink ||
    name === "chai" ||
    name.includes("chai latte")
  ) {
    groups.push({
      id: "temperature",
      title: "Temperature",
      options: [
        { label: "Hot", price: 0 },
        { label: "Iced", price: 0 },
      ],
      defaultOption: name.includes("iced") ? "Iced" : "Hot",
    })
  }

  // 2. Alternative Milk: Oat Milk / Coconut Milk
  // Apply to: Eligible milk-based drinks (Flat White; Cappuccino; Latte; Mocha; Matcha Latte; Chai; Chocolate)
  if (
    name.includes("flat white") ||
    name.includes("cappuccino") ||
    name === "latte" ||
    name.includes("caffe latte") ||
    name.includes("mocha") ||
    name.includes("matcha latte") ||
    name === "chai" ||
    name.includes("chai latte") ||
    isChocolateDrink
  ) {
    groups.push({
      id: "milk",
      title: "Milk Choice",
      options: [
        { label: "Standard Milk", price: 0 },
        { label: "Oat Milk", price: 200 },
        { label: "Coconut Milk", price: 150 },
      ],
      defaultOption: "Standard Milk",
    })
  }

  // 3. Base Choice: Sourdough / Hashbrowns
  // Apply to: Creamy Mushrooms; Bacon and Eggs
  if (name.includes("creamy mushrooms") || name.includes("bacon and eggs")) {
    groups.push({
      id: "base",
      title: "Base Choice",
      options: [
        { label: "Sourdough", price: 0 },
        { label: "Hashbrowns", price: 0 },
      ],
      defaultOption: "Sourdough",
    })
  }

  // 4. Egg Style: Scrambled / Fried
  // Apply to: Bacon and Eggs
  if (name.includes("bacon and eggs")) {
    groups.push({
      id: "egg_style",
      title: "Egg Preparation",
      options: [
        { label: "Scrambled", price: 0 },
        { label: "Fried", price: 0 },
      ],
      defaultOption: "Scrambled",
    })
  }

  // 5. Side Choice: Fries / Salad
  // Apply to: Grilled Chicken Sandwich; Hashbrown-Crust Bacon & Egg Quiche
  if (name.includes("grilled chicken sandwich") || name.includes("quiche")) {
    groups.push({
      id: "side",
      title: "Side Choice",
      options: [
        { label: "Fries", price: 0 },
        { label: "Salad", price: 0 },
      ],
      defaultOption: "Fries",
    })
  }

  return groups
}

interface ModifierModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onAdd: (product: Product, selectedModifiers: string[], extraPrice: number, notes?: string) => void
}

export function ModifierModal({ product, isOpen, onClose, onAdd }: ModifierModalProps) {
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [note, setNote] = useState("")

  const groups = product ? getApplicableModifierGroups(product.name) : []

  useEffect(() => {
    if (product) {
      const initial: Record<string, string> = {}
      groups.forEach((g) => {
        initial[g.id] = g.defaultOption
      })
      setSelections(initial)
      setNote("")
    }
  }, [product?.id])

  if (!product) return null

  // Calculate extra price
  let extraPrice = 0
  const chosenModifiers: string[] = []

  groups.forEach((g) => {
    const selLabel = selections[g.id] || g.defaultOption
    const opt = g.options.find((o) => o.label === selLabel)
    if (opt) {
      extraPrice += opt.price
      if (opt.label !== "Standard Milk") {
        chosenModifiers.push(opt.label)
      }
    }
  })

  const totalPrice = Number(product.price || 0) + extraPrice

  function handleConfirm() {
    if (!product) return
    onAdd(product, chosenModifiers, extraPrice, note.trim() || undefined)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md p-5 sm:p-6 rounded-2xl bg-white border-[#E5D8CF]">
        <DialogHeader className="pb-3 border-b border-[#E5D8CF]">
          <div className="flex items-center gap-3">
            <img
              src={resolveProductImage(product.name, product.image, product.category)}
              alt={product.name}
              className="size-14 rounded-xl object-cover border border-[#E5D8CF]"
            />
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-serif text-lg font-bold text-[#343428] truncate">
                {product.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#808068] mt-0.5">
                Base price: Rs. {Number(product.price).toLocaleString()} • {product.category}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-3 space-y-4 max-h-[50vh] overflow-y-auto">
          {groups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#808068]">
                {group.title}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {group.options.map((opt) => {
                  const isSelected = (selections[group.id] || group.defaultOption) === opt.label
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setSelections((prev) => ({ ...prev, [group.id]: opt.label }))}
                      className={`relative flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? "border-[#D67B6B] bg-[#FAF5F1] text-[#D67B6B] shadow-xs"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <span className="truncate w-full text-center">{opt.label}</span>
                      {opt.price > 0 && (
                        <span className="text-[10px] text-gray-500 font-mono mt-0.5">
                          +Rs. {opt.price}
                        </span>
                      )}
                      {isSelected && (
                        <div className="absolute top-1 right-1 size-3.5 rounded-full bg-[#D67B6B] text-white flex items-center justify-center">
                          <Check className="size-2.5" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[#808068]">
              Special Instructions
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Extra hot, syrup on side, less sweet…"
              className="text-xs sm:text-sm h-10 rounded-xl border-[#E5D8CF] focus:ring-[#D67B6B]"
            />
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-[#E5D8CF] flex sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl border-gray-200 text-gray-700 h-11"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-xl bg-[#D67B6B] hover:bg-[#c26555] text-white font-semibold h-11 shadow-sm"
          >
            Add to Order • Rs. {totalPrice.toLocaleString()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
