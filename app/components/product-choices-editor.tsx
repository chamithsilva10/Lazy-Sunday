"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Sparkles, Check, Ban } from "lucide-react"
import {
  type ProductChoiceGroup,
  type ProductChoiceOption,
  getDefaultChoiceGroupsForProduct,
} from "@/app/components/modifier-modal"

export interface ProductChoicesEditorProps {
  productName: string
  choiceGroups?: ProductChoiceGroup[]
  value?: ProductChoiceGroup[]
  onChange: (groups: ProductChoiceGroup[]) => void
}

export function ProductChoicesEditor({
  productName,
  choiceGroups: rawGroups,
  value,
  onChange,
}: ProductChoicesEditorProps) {
  const choiceGroups = rawGroups || value || []
  function handleAddGroup() {
    const newGroup: ProductChoiceGroup = {
      id: `grp-${Date.now()}-${choiceGroups.length + 1}`,
      name: choiceGroups.length === 0 ? "Choose a side" : `Choice Group ${choiceGroups.length + 1}`,
      title: choiceGroups.length === 0 ? "Choose a side" : `Choice Group ${choiceGroups.length + 1}`,
      instructions: "Select your preferred option",
      required: true,
      selection_type: "single",
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: `opt-${Date.now()}-1`, label: "Option 1", price: 0, available: true },
        { id: `opt-${Date.now()}-2`, label: "Option 2", price: 0, available: true },
      ],
    }
    onChange([...choiceGroups, newGroup])
  }

  function handleLoadDefaults() {
    const defaults = getDefaultChoiceGroupsForProduct(productName)
    if (defaults.length > 0) {
      onChange(defaults)
    } else {
      onChange([
        {
          id: `grp-${Date.now()}-side`,
          name: "Choose a side",
          title: "Choose a side",
          instructions: "Select 1 side",
          required: true,
          selection_type: "single",
          min_selections: 1,
          max_selections: 1,
          options: [
            { id: `opt-${Date.now()}-1`, label: "Hashbrowns", price: 0, available: true },
            { id: `opt-${Date.now()}-2`, label: "Sourdough", price: 0, available: true },
          ],
        },
      ])
    }
  }

  function updateGroup(idx: number, patch: Partial<ProductChoiceGroup>) {
    const next = choiceGroups.map((g, i) => {
      if (i !== idx) return g
      const updated = { ...g, ...patch }
      if (patch.name !== undefined) {
        updated.title = patch.name
      }
      if (updated.selection_type === "single") {
        updated.max_selections = 1
        updated.min_selections = updated.required ? 1 : 0
      } else {
        updated.min_selections = updated.required
          ? Math.max(1, Number(updated.min_selections) || 1)
          : Math.max(0, Number(updated.min_selections) || 0)
        updated.max_selections = Math.max(
          updated.min_selections || 1,
          Number(updated.max_selections) || updated.options.length || 1
        )
      }
      return updated
    })
    onChange(next)
  }

  function removeGroup(idx: number) {
    onChange(choiceGroups.filter((_, i) => i !== idx))
  }

  function addOption(groupIdx: number) {
    const target = choiceGroups[groupIdx]
    if (!target) return
    const nextOpt: ProductChoiceOption = {
      id: `opt-${Date.now()}-${target.options.length + 1}`,
      label: "",
      price: 0,
      available: true,
    }
    updateGroup(groupIdx, {
      options: [...target.options, nextOpt],
    })
  }

  function updateOption(
    groupIdx: number,
    optIdx: number,
    patch: Partial<ProductChoiceOption>
  ) {
    const target = choiceGroups[groupIdx]
    if (!target) return
    const nextOpts = target.options.map((o, i) => (i === optIdx ? { ...o, ...patch } : o))
    updateGroup(groupIdx, { options: nextOpts })
  }

  function removeOption(groupIdx: number, optIdx: number) {
    const target = choiceGroups[groupIdx]
    if (!target) return
    updateGroup(groupIdx, {
      options: target.options.filter((_, i) => i !== optIdx),
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[#E5D8CF] bg-[#FAF5F1]/60 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#343428]">
            Configurable Menu Choice Groups ({choiceGroups.length})
          </p>
          <p className="text-[11px] text-gray-500">
            Configure sides, milk options, temperatures, or add-ons with LKR pricing &amp; availability.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleLoadDefaults}
            className="h-8 text-[11px] rounded-xl border-[#E5D8CF] text-[#808068] bg-white hover:bg-[#FAF5F1] gap-1"
          >
            <Sparkles className="size-3.5 text-[#D67B6B]" />
            Load Preset
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAddGroup}
            className="h-8 text-[11px] rounded-xl bg-[#808068] hover:bg-[#6b6b56] text-white gap-1"
          >
            <Plus className="size-3.5" />
            Add Choice Group
          </Button>
        </div>
      </div>

      {choiceGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5D8CF] bg-white p-4 text-center text-xs text-gray-500">
          No configurable choice groups on this item. Click <strong>Add Choice Group</strong> to add options (e.g. &ldquo;Choose a side: Hashbrowns or Sourdough&rdquo; or &ldquo;Choose milk: Oat milk or Coconut milk&rdquo;).
        </div>
      ) : (
        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
          {choiceGroups.map((group, gIdx) => (
            <div
              key={group.id || gIdx}
              className="rounded-xl border border-[#E5D8CF] bg-white p-3 space-y-2.5 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge className="bg-[#FAF5F1] text-[#808068] border border-[#E5D8CF] text-[10px]">
                  Group #{gIdx + 1}
                </Badge>
                <button
                  type="button"
                  onClick={() => removeGroup(gIdx)}
                  className="text-xs text-red-600 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <Trash2 className="size-3.5" />
                  Remove Group
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-0.5">
                    Group Name *
                  </label>
                  <Input
                    value={group.name}
                    onChange={(e) => updateGroup(gIdx, { name: e.target.value })}
                    placeholder="e.g. Choose a side, Choose milk"
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-0.5">
                    Customer / Staff Instructions
                  </label>
                  <Input
                    value={group.instructions || ""}
                    onChange={(e) => updateGroup(gIdx, { instructions: e.target.value })}
                    placeholder="e.g. Select 1 side dish"
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
              </div>

              {/* Group Rules: Required/Optional, Single/Multi, Min/Max */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-0.5">
                    Requirement
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      updateGroup(gIdx, {
                        required: !group.required,
                        min_selections: !group.required ? 1 : 0,
                      })
                    }
                    className={`w-full h-8 rounded-lg border text-xs font-bold transition-colors ${
                      group.required
                        ? "bg-[#D67B6B] text-white border-[#D67B6B]"
                        : "bg-gray-50 text-gray-700 border-gray-200"
                    }`}
                  >
                    {group.required ? "Required" : "Optional"}
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-0.5">
                    Selection Type
                  </label>
                  <select
                    value={group.selection_type}
                    onChange={(e) =>
                      updateGroup(gIdx, {
                        selection_type: e.target.value as "single" | "multiple",
                        max_selections:
                          e.target.value === "single" ? 1 : Math.max(2, group.options.length),
                      })
                    }
                    className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold"
                  >
                    <option value="single">Single-select</option>
                    <option value="multiple">Multi-select</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-0.5">
                    Min Choices
                  </label>
                  <Input
                    type="number"
                    min={group.required ? 1 : 0}
                    max={group.selection_type === "single" ? 1 : Math.max(1, group.options.length)}
                    disabled={group.selection_type === "single"}
                    value={group.min_selections}
                    onChange={(e) =>
                      updateGroup(gIdx, { min_selections: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="h-8 text-xs font-mono rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-0.5">
                    Max Choices
                  </label>
                  <Input
                    type="number"
                    min={Math.max(1, group.min_selections)}
                    max={Math.max(1, group.options.length)}
                    disabled={group.selection_type === "single"}
                    value={group.max_selections}
                    onChange={(e) =>
                      updateGroup(gIdx, { max_selections: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="h-8 text-xs font-mono rounded-lg"
                  />
                </div>
              </div>

              {/* Choices List */}
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-gray-500">
                    Choices &amp; Additional LKR Prices
                  </span>
                  <button
                    type="button"
                    onClick={() => addOption(gIdx)}
                    className="text-[11px] font-bold text-[#D67B6B] hover:underline inline-flex items-center gap-0.5"
                  >
                    <Plus className="size-3" />
                    Add Choice
                  </button>
                </div>

                {group.options.map((opt, oIdx) => (
                  <div key={opt.id || oIdx} className="flex items-center gap-1.5">
                    <Input
                      value={opt.label}
                      onChange={(e) => updateOption(gIdx, oIdx, { label: e.target.value })}
                      placeholder="Choice name (e.g. Oat milk)"
                      className="h-8 text-xs flex-1 rounded-lg"
                    />
                    <div className="flex items-center gap-1 w-28 shrink-0">
                      <span className="text-[10px] text-gray-500 font-semibold">+LKR</span>
                      <Input
                        type="number"
                        min="0"
                        step="10"
                        value={opt.price}
                        onChange={(e) =>
                          updateOption(gIdx, oIdx, { price: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="h-8 text-xs font-mono rounded-lg px-2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => updateOption(gIdx, oIdx, { available: !opt.available })}
                      title={opt.available !== false ? "Mark Unavailable" : "Mark Available"}
                      className={`h-8 px-2 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 shrink-0 ${
                        opt.available !== false
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-gray-100 text-gray-500 border-gray-200"
                      }`}
                    >
                      {opt.available !== false ? (
                        <>
                          <Check className="size-3 text-emerald-600" />
                          Available
                        </>
                      ) : (
                        <>
                          <Ban className="size-3 text-gray-400" />
                          Sold Out
                        </>
                      )}
                    </button>
                    {group.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOption(gIdx, oIdx)}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                        title="Delete choice"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
