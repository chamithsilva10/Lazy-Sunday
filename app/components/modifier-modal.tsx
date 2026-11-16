"use client"

import { useState, useEffect } from "react"
import type { Product } from "@/app/page"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { resolveProductImage } from "@/lib/product-images"
import { Check, AlertCircle, Ban } from "lucide-react"

export interface ProductChoiceOption {
  id: string
  label: string
  price: number
  available: boolean
}

export interface ProductChoiceGroup {
  id: string
  name: string
  title?: string
  instructions?: string
  required: boolean
  enabled?: boolean
  selection_type: "single" | "multiple"
  min_selections: number
  max_selections: number
  options: ProductChoiceOption[]
  defaultOption?: string
}

export interface SelectedChoiceSnapshot {
  group_id: string
  group_name: string
  option_id: string
  label: string
  option_name: string
  price: number
}

// Legacy aliases for backward compatibility
export type ModifierOption = ProductChoiceOption
export type ModifierGroup = ProductChoiceGroup

export function normalizeChoiceGroups(groups?: any[] | null): ProductChoiceGroup[] {
  if (!Array.isArray(groups)) return []
  return groups
    .filter((g) => g && typeof g === "object")
    .map((g, gIdx) => {
      const name = String(g.name || g.title || `Choice Group ${gIdx + 1}`).trim()
      const selectionType: "single" | "multiple" =
        g.selection_type === "multiple" ? "multiple" : "single"
      const required = Boolean(g.required ?? true)
      const enabled = g.enabled !== false
      const options: ProductChoiceOption[] = Array.isArray(g.options)
        ? g.options
            .filter((o: any) => o && String(o.label || "").trim().length > 0)
            .map((o: any, oIdx: number) => ({
              id: String(o.id || `opt-${gIdx}-${oIdx}-${String(o.label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
              label: String(o.label).trim(),
              price: Math.max(0, Number(o.price) || 0),
              available: o.available !== false,
            }))
        : []
      const minSelections = required
        ? Math.max(1, Number(g.min_selections) || 1)
        : Math.max(0, Number(g.min_selections) || 0)
      const maxSelections =
        selectionType === "single"
          ? 1
          : Math.max(minSelections || 1, Number(g.max_selections) || options.length || 1)

      return {
        id: String(g.id || `grp-${gIdx}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
        name,
        title: name,
        instructions: g.instructions ? String(g.instructions).trim() : "",
        required,
        enabled,
        selection_type: selectionType,
        min_selections: minSelections,
        max_selections: maxSelections,
        options,
        defaultOption: g.defaultOption,
      }
    })
    .filter((g) => g.options.length > 0)
}

export function getDefaultChoiceGroupsForProduct(productName: string): ProductChoiceGroup[] {
  const name = (productName || "").trim().toLowerCase()
  const groups: ProductChoiceGroup[] = []

  const isChocolateDrink =
    (name === "chocolate" ||
      name.startsWith("chocolate —") ||
      name.startsWith("chocolate -") ||
      name === "hot chocolate") &&
    !name.includes("brownie") &&
    !name.includes("muffin")

  const isMilkTea =
    name.includes("milk tea") ||
    name.includes("bubble tea") ||
    name === "tea" ||
    name.includes("iced tea") ||
    name.includes("black tea") ||
    name.includes("green tea")

  // 1. Milk Tea — Temperature: Iced or Hot, Milk choice: Oat milk or Coconut milk
  if (isMilkTea) {
    groups.push({
      id: "temperature",
      name: "Temperature",
      title: "Temperature",
      instructions: "Served iced or hot",
      required: true,
      enabled: true,
      selection_type: "single",
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: "temp-iced", label: "Iced", price: 0, available: true },
        { id: "temp-hot", label: "Hot", price: 0, available: true },
      ],
      defaultOption: name.includes("hot") ? "Hot" : "Iced",
    })
    groups.push({
      id: "milk_choice",
      name: "Milk choice",
      title: "Milk choice",
      instructions: "Select your preferred milk option",
      required: true,
      enabled: true,
      selection_type: "single",
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: "milk-fresh", label: "Fresh Dairy Milk", price: 0, available: true },
        { id: "milk-oat", label: "Oat milk", price: 200, available: true },
        { id: "milk-coconut", label: "Coconut milk", price: 150, available: true },
      ],
      defaultOption: "Fresh Dairy Milk",
    })
    return groups
  }

  const isCoffeeOrMilkDrink =
    name === "coffee" ||
    name.includes("flat white") ||
    name.includes("cappuccino") ||
    name === "latte" ||
    name.includes("caffe latte") ||
    name.includes("mocha") ||
    name.includes("matcha latte") ||
    name === "chai" ||
    name.includes("chai latte") ||
    isChocolateDrink

  // 2. Creamy Mushrooms / Bacon and Eggs — Choose a side: Hashbrowns or Sourdough
  if (name.includes("creamy mushrooms") || name.includes("bacon and eggs")) {
    groups.push({
      id: "choose_side",
      name: "Choose a side",
      title: "Choose a side",
      instructions: "Select 1 side to accompany your dish",
      required: true,
      enabled: true,
      selection_type: "single",
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: "side-hashbrowns", label: "Hashbrowns", price: 0, available: true },
        { id: "side-sourdough", label: "Sourdough", price: 0, available: true },
      ],
      defaultOption: "Hashbrowns",
    })
  }

  // 3. Egg Preparation for Bacon and Eggs
  if (name.includes("bacon and eggs")) {
    groups.push({
      id: "egg_style",
      name: "Egg Preparation",
      title: "Egg Preparation",
      instructions: "Choose how you would like your eggs prepared",
      required: true,
      enabled: true,
      selection_type: "single",
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: "egg-scrambled", label: "Scrambled", price: 0, available: true },
        { id: "egg-fried", label: "Fried", price: 0, available: true },
        { id: "egg-poached", label: "Poached", price: 0, available: true },
      ],
      defaultOption: "Scrambled",
    })
  }

  // 4. Coffee / Milk Drinks — Choose milk: Oat milk or Coconut milk (or Dairy Milk)
  if (isCoffeeOrMilkDrink) {
    groups.push({
      id: "choose_milk",
      name: "Choose milk",
      title: "Choose milk",
      instructions: "Select your preferred milk option",
      required: true,
      enabled: true,
      selection_type: "single",
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: "milk-standard", label: "Full Cream Dairy Milk", price: 0, available: true },
        { id: "milk-oat", label: "Oat milk", price: 200, available: true },
        { id: "milk-coconut", label: "Coconut milk", price: 150, available: true },
      ],
      defaultOption: "Full Cream Dairy Milk",
    })
  }

  // 5. Temperature: Hot / Iced
  if (
    name === "coffee" ||
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
      name: "Temperature",
      title: "Temperature",
      instructions: "Served hot or iced",
      required: true,
      enabled: true,
      selection_type: "single",
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: "temp-hot", label: "Hot", price: 0, available: true },
        { id: "temp-iced", label: "Iced", price: 0, available: true },
      ],
      defaultOption: name.includes("iced") ? "Iced" : "Hot",
    })
  }

  // 6. Side Choice: Fries / Salad for Sandwiches & Quiche
  if (name.includes("grilled chicken sandwich") || name.includes("quiche")) {
    groups.push({
      id: "side",
      name: "Choose a side",
      title: "Choose a side",
      instructions: "Select 1 side dish",
      required: true,
      enabled: true,
      selection_type: "single",
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: "side-fries", label: "Fries", price: 0, available: true },
        { id: "side-salad", label: "Salad", price: 0, available: true },
      ],
      defaultOption: "Fries",
    })
  }

  return groups
}

export function getApplicableModifierGroups(
  productOrName: string | { name?: string; choice_groups?: ProductChoiceGroup[] | null } | null | undefined
): ProductChoiceGroup[] {
  if (!productOrName) return []
  if (typeof productOrName === "object") {
    if (Array.isArray(productOrName.choice_groups)) {
      return normalizeChoiceGroups(productOrName.choice_groups).filter((g) => g.enabled !== false)
    }
    return getDefaultChoiceGroupsForProduct(productOrName.name || "").filter((g) => g.enabled !== false)
  }
  return getDefaultChoiceGroupsForProduct(productOrName).filter((g) => g.enabled !== false)
}

export function formatChoiceSnapshotLabel(choice: SelectedChoiceSnapshot): string {
  const baseLabel = `${choice.group_name}: ${choice.label}`
  if (choice.price > 0) {
    return `${baseLabel} (+LKR ${choice.price.toLocaleString()})`
  }
  return baseLabel
}

export interface ModifierModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onAdd: (
    product: Product,
    selectedModifiers: string[],
    extraPrice: number,
    notes?: string,
    selectedChoices?: SelectedChoiceSnapshot[],
    cartItemId?: string
  ) => void
  initialSelectedChoices?: SelectedChoiceSnapshot[]
  initialNotes?: string
  cartItemId?: string
  isEditing?: boolean
}

export function ModifierModal({
  product,
  isOpen,
  onClose,
  onAdd,
  initialSelectedChoices,
  initialNotes,
  cartItemId,
  isEditing = false,
}: ModifierModalProps) {
  // Map of group.id -> array of selected option labels
  const [selections, setSelections] = useState<Record<string, string[]>>({})
  const [note, setNote] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)

  const groups = product ? getApplicableModifierGroups(product) : []

  useEffect(() => {
    if (product && isOpen) {
      const initial: Record<string, string[]> = {}
      const prodGroups = getApplicableModifierGroups(product)
      prodGroups.forEach((g) => {
        const matchingChoices = Array.isArray(initialSelectedChoices)
          ? initialSelectedChoices.filter(
              (c) =>
                c.group_id === g.id ||
                c.group_name.trim().toLowerCase() === g.name.trim().toLowerCase()
            )
          : []

        if (matchingChoices.length > 0) {
          const matchedLabels = matchingChoices
            .map((c) => c.label || c.option_name)
            .filter((lbl) => g.options.some((o) => o.label === lbl))
          initial[g.id] = matchedLabels
        } else {
          const availableOpts = g.options.filter((o) => o.available !== false)
          if (g.defaultOption && availableOpts.some((o) => o.label === g.defaultOption)) {
            initial[g.id] = [g.defaultOption]
          } else {
            initial[g.id] = []
          }
        }
      })
      setSelections(initial)
      setNote(initialNotes || "")
      setValidationError(null)
    }
  }, [product?.id, isOpen, initialSelectedChoices, initialNotes])

  if (!product) return null

  function toggleOption(group: ProductChoiceGroup, opt: ProductChoiceOption) {
    if (opt.available === false) return
    setValidationError(null)

    setSelections((prev) => {
      const current = prev[group.id] || []
      const isSelected = current.includes(opt.label)

      if (group.selection_type === "single") {
        if (isSelected) {
          // Allow deselecting only if the group is optional (min_selections === 0 and !required)
          if (!group.required && (group.min_selections || 0) === 0) {
            return { ...prev, [group.id]: [] }
          }
          return prev
        }
        return { ...prev, [group.id]: [opt.label] }
      } else {
        // Multi-select
        if (isSelected) {
          return { ...prev, [group.id]: current.filter((item) => item !== opt.label) }
        }
        const maxAllowed = Math.max(1, group.max_selections || group.options.length)
        if (current.length >= maxAllowed) {
          setValidationError(`You can select at most ${maxAllowed} option${maxAllowed > 1 ? "s" : ""} for "${group.name}".`)
          return prev
        }
        return { ...prev, [group.id]: [...current, opt.label] }
      }
    })
  }

  // Calculate extra price and build snapshots
  let extraPrice = 0
  const chosenModifiers: string[] = []
  const selectedChoices: SelectedChoiceSnapshot[] = []

  const missingGroups: string[] = []

  groups.forEach((g) => {
    const chosenLabels = selections[g.id] || []
    const minReq = g.required ? Math.max(1, g.min_selections || 1) : Math.max(0, g.min_selections || 0)
    const maxReq = g.selection_type === "single" ? 1 : Math.max(minReq || 1, g.max_selections || g.options.length)

    if (chosenLabels.length < minReq) {
      missingGroups.push(
        minReq > 1 ? `${g.name} (select at least ${minReq})` : `${g.name}`
      )
    } else if (chosenLabels.length > maxReq) {
      missingGroups.push(`${g.name} (max ${maxReq})`)
    }

    chosenLabels.forEach((lbl) => {
      const opt = g.options.find((o) => o.label === lbl && o.available !== false)
      if (opt) {
        const priceNum = Math.max(0, Number(opt.price) || 0)
        extraPrice += priceNum
        const snap: SelectedChoiceSnapshot = {
          group_id: g.id,
          group_name: g.name,
          option_id: opt.id,
          label: opt.label,
          option_name: opt.label,
          price: priceNum,
        }
        selectedChoices.push(snap)
        chosenModifiers.push(formatChoiceSnapshotLabel(snap))
      }
    })
  })

  const totalPrice = Number(product.price || 0) + extraPrice

  function handleConfirm() {
    if (!product) return
    if (missingGroups.length > 0) {
      setValidationError(`Please complete required choices: ${missingGroups.join(", ")}`)
      return
    }
    onAdd(product, chosenModifiers, extraPrice, note.trim() || undefined, selectedChoices, cartItemId)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg p-5 sm:p-6 rounded-2xl bg-white border-[#E5D8CF]">
        <DialogHeader className="pb-3 border-b border-[#E5D8CF]">
          <div className="flex items-center gap-3">
            <img
              src={resolveProductImage(product.name, product.image, product.category)}
              alt={product.name}
              className="size-14 rounded-xl object-cover border border-[#E5D8CF]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="font-serif text-lg font-bold text-[#343428] truncate">
                  {product.name}
                </DialogTitle>
                {isEditing && (
                  <Badge className="bg-[#FAF5F1] text-[#808068] border border-[#E5D8CF] text-[10px]">
                    Editing Options
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-[#808068] mt-0.5">
                Base price: LKR {Number(product.price).toLocaleString()} • {product.category}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-3 space-y-4 max-h-[58vh] overflow-y-auto pr-1">
          {validationError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
              <span>{validationError}</span>
            </div>
          )}

          {groups.map((group) => {
            const currentSelected = selections[group.id] || []
            const minReq = group.required ? Math.max(1, group.min_selections || 1) : Math.max(0, group.min_selections || 0)
            const maxReq = group.selection_type === "single" ? 1 : Math.max(minReq || 1, group.max_selections || group.options.length)
            const isSatisfied = currentSelected.length >= minReq && currentSelected.length <= maxReq

            return (
              <fieldset key={group.id} className="space-y-2 rounded-xl border border-[#E5D8CF]/80 bg-[#FAF5F1]/45 p-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <legend className="text-xs font-bold uppercase tracking-wider text-[#343428]">
                    {group.name}
                  </legend>
                  <div className="flex items-center gap-1.5">
                    {group.required ? (
                      <Badge
                        className={`text-[10px] px-2 py-0 border-0 ${
                          isSatisfied
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-[#D67B6B] text-white"
                        }`}
                      >
                        {isSatisfied ? "Required ✓" : "Required"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-2 py-0 text-gray-500 border-gray-300">
                        Optional
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-[#808068] border-[#E5D8CF] bg-white">
                      {group.selection_type === "single"
                        ? "Single-select"
                        : minReq > 0
                        ? `Select ${minReq}–${maxReq}`
                        : `Up to ${maxReq}`}
                    </Badge>
                  </div>
                </div>

                {group.instructions && (
                  <p className="text-[11px] text-[#808068]">{group.instructions}</p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
                  {group.options.map((opt) => {
                    const isSelected = currentSelected.includes(opt.label)
                    const isUnavailable = opt.available === false
                    return (
                      <button
                        key={opt.id || opt.label}
                        type="button"
                        disabled={isUnavailable}
                        onClick={() => toggleOption(group, opt)}
                        className={`relative flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all text-center min-h-[58px] ${
                          isUnavailable
                            ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-65"
                            : isSelected
                            ? "border-[#D67B6B] bg-white text-[#D67B6B] shadow-xs ring-2 ring-[#D67B6B]/20"
                            : "border-gray-200 bg-white text-gray-700 hover:border-[#D67B6B]/50"
                        }`}
                      >
                        <span className="w-full text-center leading-tight break-words">{opt.label}</span>
                        {isUnavailable ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-red-500 font-medium mt-1">
                            <Ban className="size-2.5" />
                            Unavailable
                          </span>
                        ) : opt.price > 0 ? (
                          <span className="text-[10px] text-[#808068] font-mono font-bold mt-1">
                            +LKR {opt.price.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-normal mt-1">
                            Included
                          </span>
                        )}
                        {isSelected && !isUnavailable && (
                          <div className="absolute top-1.5 right-1.5 size-4 rounded-full bg-[#D67B6B] text-white flex items-center justify-center">
                            <Check className="size-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}

          <div className="space-y-1.5 pt-1">
            <label htmlFor="modifier-special-note" className="text-xs font-bold uppercase tracking-wider text-[#808068]">
              Special Instructions (Optional)
            </label>
            <Input
              id="modifier-special-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Extra hot, syrup on side, less sweet…"
              className="text-xs sm:text-sm h-10 rounded-xl border-[#E5D8CF] focus:ring-[#D67B6B]"
            />
          </div>
        </div>

        {/* Summary breakdown footer */}
        <div className="rounded-xl bg-[#FAF5F1] border border-[#E5D8CF] px-3.5 py-2.5 text-xs flex items-center justify-between">
          <div className="text-gray-600">
            <span>Base: LKR {Number(product.price || 0).toLocaleString()}</span>
            {extraPrice > 0 && (
              <span className="ml-2 font-semibold text-[#D67B6B]">
                + Options: LKR {extraPrice.toLocaleString()}
              </span>
            )}
          </div>
          <span className="font-mono font-bold text-sm text-[#343428]">
            Total: LKR {totalPrice.toLocaleString()}
          </span>
        </div>

        <DialogFooter className="pt-2 border-t border-[#E5D8CF] flex sm:flex-row gap-2">
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
            {isEditing
              ? `Update Order • LKR ${totalPrice.toLocaleString()}`
              : `Add to Order • LKR ${totalPrice.toLocaleString()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
