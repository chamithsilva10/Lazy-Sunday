/**
 * Demo Mode Configuration & Environment Guard
 * Ensures zero production data leakage and handles mock peripheral simulation.
 */

export function isDemoMode(): boolean {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      return true
    }
    // If neither Supabase URL nor explicit production flags exist, default to safe demo mode
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("dysnpzrmppcmqdebgtzt")) {
      // If user sets DEMO_MODE=false explicitly, permit production
      if (process.env.DEMO_MODE === "false") {
        return false
      }
      return true
    }
  }
  return true
}

export const DEMO_CONFIG = {
  storeName: "RESTAURANT & BAR (DEMO)",
  branchId: "branch-demo-01",
  currency: "LKR",
  currencySymbol: "Rs.",
  taxRate: 0.0,
  serviceChargeRate: 0.1,
  defaultCashier: {
    username: "cashier",
    name: "Alex Rivera",
    role: "cashier",
  },
  defaultManager: {
    username: "manager",
    name: "Elena Rostova",
    role: "manager",
  },
  defaultAdmin: {
    username: "admin",
    name: "Jordan Vance",
    role: "admin",
  },
  defaultKitchen: {
    username: "kitchen",
    name: "Chef Marco Silva",
    role: "kitchen",
  },
}

/**
 * Audio simulation for Barcode Scanner beep using Web Audio API
 */
export function playBarcodeBeep() {
  if (typeof window === "undefined") return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(2400, ctx.currentTime) // High pitch clean scanner beep
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  } catch {}
}

/**
 * Audio simulation for Cash Drawer Kick
 */
export function playCashDrawerSound() {
  if (typeof window === "undefined") return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(140, ctx.currentTime)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {}
}
