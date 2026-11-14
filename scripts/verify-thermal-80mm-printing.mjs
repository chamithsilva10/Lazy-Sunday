import fs from "fs"
import path from "path"
import assert from "assert"

const root = process.cwd()

console.log("=== Modern 80mm Thermal Receipt Printer Verification ===")

// 1. Check lib/thermal-printer.ts
const thermalPrinterSrc = fs.readFileSync(path.join(root, "lib/thermal-printer.ts"), "utf-8")

assert(
  thermalPrinterSrc.includes("size: 80mm auto;"),
  "thermal-printer.ts must specify @page { size: 80mm auto; }"
)
assert(
  !thermalPrinterSrc.includes("3.1in"),
  "thermal-printer.ts must not contain legacy 3.1in dimensions"
)
assert(
  !thermalPrinterSrc.includes("2.9in"),
  "thermal-printer.ts must not contain legacy 2.9in dimensions"
)
assert(
  thermalPrinterSrc.includes("width: 72mm"),
  "thermal-printer.ts must calibrate printable width to 72mm (standard for 80mm thermal roll printheads)"
)
assert(
  thermalPrinterSrc.includes("12mm"),
  "thermal-printer.ts must include 12mm cutter feed margin to prevent cutting text/barcode"
)
assert(
  thermalPrinterSrc.includes("BAR ORDER TICKET"),
  "thermal-printer.ts must support Bar Order Ticket (BOT)"
)
assert(
  thermalPrinterSrc.includes("KITCHEN ORDER TICKET"),
  "thermal-printer.ts must support Kitchen Order Ticket (KOT)"
)
assert(
  thermalPrinterSrc.includes("LAZY SUNDAY"),
  "thermal-printer.ts must default to LAZY SUNDAY branding"
)
assert(
  thermalPrinterSrc.includes("SPECIALTY COFFEE"),
  "thermal-printer.ts must include SPECIALTY COFFEE subtitle"
)
assert(
  thermalPrinterSrc.includes("TOTAL /"),
  "thermal-printer.ts must format total line as TOTAL / <CURRENCY>"
)
assert(
  thermalPrinterSrc.includes("Good coffee. Good day."),
  "thermal-printer.ts must include 'Good coffee. Good day.' footer tagline"
)
assert(
  thermalPrinterSrc.includes("T H A N K &nbsp; Y O U") || thermalPrinterSrc.includes("T H A N K   Y O U"),
  "thermal-printer.ts must include tracked 'THANK YOU' footer"
)

console.log("✓ lib/thermal-printer.ts: Calibrated for modern 80mm paper (72mm printhead width, ABC Coffee layout, 12mm cutter margin, KOT & BOT)")

// 2. Check app/globals.css
const globalsCss = fs.readFileSync(path.join(root, "app/globals.css"), "utf-8")

assert(
  globalsCss.includes("@page {\n  size: 80mm auto;\n  margin: 0;\n}"),
  "app/globals.css must specify global @page { size: 80mm auto; margin: 0; }"
)
assert(
  globalsCss.includes("width: 72mm !important;"),
  "app/globals.css must restrict [data-receipt='true'] and [data-ticket='true'] to 72mm printable width"
)
assert(
  !globalsCss.includes("max-width: 420px;"),
  "app/globals.css must not use 420px (over-width) for receipts"
)

console.log("✓ app/globals.css: Global @media print rules set to 80mm paper & 72mm printable boundary")

// 3. Check components/ui/pos-receipt.tsx
const posReceiptSrc = fs.readFileSync(path.join(root, "components/ui/pos-receipt.tsx"), "utf-8")

assert(
  posReceiptSrc.includes("print:w-[72mm]"),
  "components/ui/pos-receipt.tsx must include print:w-[72mm]"
)
assert(
  posReceiptSrc.includes("LAZY SUNDAY"),
  "components/ui/pos-receipt.tsx must support LAZY SUNDAY header"
)
assert(
  posReceiptSrc.includes("Good coffee. Good day."),
  "components/ui/pos-receipt.tsx must include 'Good coffee. Good day.' footer"
)

console.log("✓ components/ui/pos-receipt.tsx: Modern minimalist 80mm layout & coffee bean branding verified")

// 4. Check app/page.tsx
const pageSrc = fs.readFileSync(path.join(root, "app/page.tsx"), "utf-8")

assert(
  !pageSrc.includes("PRINT RECEIPT (4-INCH)"),
  "app/page.tsx must not contain legacy 'PRINT RECEIPT (4-INCH)' button text"
)
assert(
  pageSrc.includes("PRINT RECEIPT (80mm)"),
  "app/page.tsx must have updated 'PRINT RECEIPT (80mm)' button label"
)
assert(
  pageSrc.includes("Test Thermal Printer (80mm)"),
  "app/page.tsx must have updated 'Test Thermal Printer (80mm)' button"
)
assert(
  pageSrc.includes("KITCHEN ORDER TICKET") && pageSrc.includes("BAR ORDER TICKET"),
  "app/page.tsx must render modern KOT and BOT tickets"
)

console.log("✓ app/page.tsx: Modern KOT/BOT ticket preview and 80mm thermal print triggers verified")
console.log("\nALL MODERN 80mm THERMAL RECEIPT & KOT/BOT CHECKS PASSED (100%)!")
