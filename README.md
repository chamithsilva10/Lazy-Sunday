# 🍽️ Lazy Sunday — Restaurant & Cafe POS System

A modern, enterprise-grade **Point of Sale (POS), Kitchen Display System (KDS), Table Management, Inventory & Recipe BOM, and Financial Reporting Platform** built for restaurants, cafes, and bars.

Configured with an **isolated, standalone mock demo database** (`node:sqlite`) for client demonstrations with zero external cloud dependencies.

---

## 🚀 Quick Start (Runs in 60 Seconds)

### 1. Install Dependencies
```bash
pnpm install
# or: npm install
```

### 2. Launch the Demo POS Server
```bash
pnpm run dev:demo
# or: npm run dev:demo
```

### 3. Open in Browser
👉 **[http://localhost:3005](http://localhost:3005)**

---

## 🔑 Demo Staff Login Accounts (1-Click Fill on Login Screen)

| Role | Username | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| 👨‍💼 **Administrator** (Alexa Pheloung) | `admin` | `Welcome123` | Full access to all modules, audit logs, roles, and settings |
| 👔 **Store Manager** | `manager` | `manager123` | Financial reports, product catalog, inventory POs, and CRM |
| 💳 **Cashier** | `cashier` | `cashier123` | POS sales register, barcode scanner, cart checkout, split billing |
| 👨‍🍳 **Kitchen Chef** | `kitchen` | `kitchen123` | Kitchen Display System (KDS), ticket status bump bar |
| 🏃 **Floor Waiter** | `staff` | `staff123` | Tableside floor ordering and ticket sending |

---

## ✨ Key Features & Workspaces

- **🛒 POS Sales Register:** Category filtering, search, add-ons/modifiers (milks, syrups, extra shots), split payments (Cash, Card, QR, Bank Transfer, Customer Credit), dine-in / takeaway / delivery routing, and promo codes.
- **🍳 Kitchen Display System (KDS):** Live ticket cards color-coded by waiting time with item-level and ticket status bumping (`pending` → `preparing` → `ready` → `served`).
- **☕ Bar Display System (BDS):** Dedicated beverage queue with temperature tags (Hot / Iced) and barista modifier notes.
- **🪑 Interactive Table Floor Plan:** Live table states (`Available`, `Occupied`, `Reserved`, `Bill Requested`), seating timers, and running bill transfers.
- **📦 Inventory & BOM Recipe Engine:** Raw ingredient tracking, Bill of Materials (BOM) recipes, and automatic stock deduction upon order payment.
- **👥 Customer CRM & VIP Loyalty Rewards:** Contact directory, store credit ledger, and loyalty points engine (1 pt per Rs. 100 spent, redeemable at Rs. 200 discount per 100 pts).
- **📊 Financial Analytics & Excel Export:** Gross sales, net revenue, service charge totals, hourly heatmaps, food cost calculations, and multi-tab `.xlsx` and `.csv` exports.
- **🪪 Virtual Hardware Simulation:** Interactive barcode scanner with Web Audio API laser beep synthesizer (`playBarcodeBeep()`) and mechanical cash drawer kick sound effect (`playCashDrawerSound()`).
- **🖨️ Thermal Receipt Printing:** 80mm & 58mm ESC/POS compatible receipts with printable browser preview.
- **📖 Bilingual System User Guide:** Built-in operating manual with one-click toggle between English and Sinhala (සිංහල).
- **📱 Public Digital Menu:** Customer-facing mobile menu at `/menu`.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Frontend UI:** React 19, Tailwind CSS, Radix UI Primitives, Lucide Icons, Sonner
- **Database:** Local SQLite (`node:sqlite` DatabaseSync with WAL journal mode)
- **Audio Synthesizer:** Web Audio API (zero external audio files)
- **Exports:** SheetJS (XLSX) with professional table styling
- **Runtime:** Node.js v20+ / v25+ (macOS, Linux, Windows)

---

## 🗄️ Database Management

To reset the mock database back to its clean starting state:
```bash
node scripts/init-demo-sql.mjs
```
*(Or click the **"Reset Demo"** button directly in the top navigation bar of the POS.)*
