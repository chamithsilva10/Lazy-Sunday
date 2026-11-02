import type { BaseUnit, InventoryDimension } from "./types"

const FACTORS: Record<string, number> = { g: 1, kg: 1000, ml: 1, l: 1000, pcs: 1, dozen: 12, tray: 30 }
export function parseDecimal(value: string | number) { const parsed = Number(String(value).trim().replace(",", ".")); return Number.isFinite(parsed) && Math.abs(parsed * 1000 - Math.round(parsed * 1000)) < 0.0001 ? parsed : null }
export function toBase(qty: number, unit: string) { return qty * (FACTORS[unit.toLowerCase()] ?? 1) }
export function unitsFor(dimension: InventoryDimension) { return dimension === "weight" ? ["kg", "g"] : dimension === "volume" ? ["L", "ml"] : ["pcs", "dozen", "tray"] }
export function fromBase(qtyBase: number, dimension: InventoryDimension) { const unit: BaseUnit = dimension === "weight" ? "g" : dimension === "volume" ? "ml" : "pcs"; const divisor = unit === "pcs" ? 1 : 1000; const value = qtyBase / divisor; const formatted = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""); return `${formatted} ${unit === "g" && qtyBase >= 1000 ? "kg" : unit === "ml" && qtyBase >= 1000 ? "L" : unit}` }
