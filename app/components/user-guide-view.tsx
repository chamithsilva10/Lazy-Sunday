"use client"

import { useState, useMemo } from "react"
import {
  BookOpen,
  Search,
  Languages,
  Printer,
  ChevronDown,
  ChevronRight,
  Shield,
  CreditCard,
  UtensilsCrossed,
  Table2,
  ChefHat,
  Coffee,
  Package,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  Laptop,
  Smartphone,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type Language = "en" | "si"
type Category =
  | "all"
  | "roles"
  | "pos"
  | "tables"
  | "kitchen"
  | "billing"
  | "coffee"
  | "products"
  | "inventory"
  | "reports"
  | "admin"

interface GuideSection {
  id: string
  category: Category
  icon: typeof BookOpen
  titleEn: string
  titleSi: string
  descriptionEn: string
  descriptionSi: string
  roles: string[]
  quickView?: string
  stepsEn: { title: string; desc: string; tip?: string }[]
  stepsSi: { title: string; desc: string; tip?: string }[]
  proTipEn?: string
  proTipSi?: string
  warningEn?: string
  warningSi?: string
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "roles-overview",
    category: "roles",
    icon: Shield,
    titleEn: "Staff Roles & Access Permissions",
    titleSi: "සේවක භූමිකා සහ ප්‍රවේශ අවසර (Staff Roles)",
    descriptionEn: "Understanding role responsibilities, default privileges, and who does what in the restaurant.",
    descriptionSi: "ආපනශාලාවේ එක් එක් සේවකයාගේ වගකීම් සහ පද්ධතියේ ප්‍රවේශ බලතල පිළිබඳ විස්තරය.",
    roles: ["Admin", "Cashier", "Kitchen Chef", "Floor Waiter"],
    stepsEn: [
      {
        title: "Admin (Full Control)",
        desc: "Responsible for menu pricing, creating staff accounts, setting RBAC permissions, monitoring live revenue reports, and overseeing raw inventory stock.",
        tip: "Keep admin credentials confidential and create individual staff accounts for audit logging.",
      },
      {
        title: "Cashier (Checkout & Terminal Control)",
        desc: "Processes customer orders, selects Dine-In/Takeaway, applies authorized discounts, manages table tabs, and settles payments via Cash, Card, or QR.",
        tip: "Cashiers can see real-time table statuses and customer split bills.",
      },
      {
        title: "Kitchen Chef (KDS Operations)",
        desc: "Uses the Kitchen Display Screen (KDS) to track incoming food tickets, marks items as 'Preparing', 'Ready', and 'Served' with automated chimes.",
        tip: "Food items automatically separate from bar drink tickets.",
      },
      {
        title: "Floor Waiter / Staff (Floor Ordering)",
        desc: "Carries tablets or mobile phones to guest tables, takes live orders, assigns table numbers (e.g. Table 05), and fires rounds directly to kitchen/bar.",
        tip: "Waiters can add Round 2 drinks or desserts to an already open table tab.",
      },
    ],
    stepsSi: [
      {
        title: "ප්‍රධාන පරිපාලක (Admin - සම්පූර්ණ පාලනය)",
        desc: "ආහාර මෙනුවේ මිල ගණන් වෙනස් කිරීම, සේවක ගිණුම් සාදා අවසර ලබා දීම, දෛනික ආදායම් වාර්තා බැලීම සහ අමුද්‍රව්‍ය තොග පාලනය කිරීම සිදු කරයි.",
        tip: "Admin මුරපදය ආරක්ෂිතව තබා ගන්න. සියලු සේවකයින්ට වෙන වෙනම ගිණුම් සාදා දෙන්න.",
      },
      {
        title: "අයකැමි (Cashier - මුදල් අයකැමි කවුළුව)",
        desc: "පාරිභෝගික ඇණවුම් ලබා ගැනීම, Dine-In (මේසයේ හිඳ ආහාර ගැනීම) හෝ Takeaway තෝරා ගැනීම, මුදල්/කාඩ්පත්/QR ගෙවීම් ලබා ගැනීම සහ බිල්පත් නිකුත් කිරීම.",
        tip: "මේස වල පවතින බිල්පත් සහ තත්ත්වය අයකැමිට එකවර දැකගත හැක.",
      },
      {
        title: "කුස්සියේ ප්‍රධානී (Kitchen Chef - KDS පද්ධතිය)",
        desc: "කුස්සියේ තිරය (KDS) මඟින් පැමිණෙන ආහාර ඇණවුම් බලා, ඒවා පිළියෙල වෙමින් පවතින (Preparing), සූදානම් (Ready), සහ පිළිගන්වන ලද (Served) ලෙස යාවත්කාලීන කිරීම.",
        tip: "බීම වර්ග සහ ආහාර වර්ග ස්වයංක්‍රීයව වෙන වෙනම බෙදී කුස්සියට හා බාර් එකට යොමු වේ.",
      },
      {
        title: "වේටර් / සේවක මණ්ඩලය (Floor Waiter - මේස ඇණවුම්)",
        desc: "ස්මාර්ට්ෆෝන් හෝ ටැබ්ලට් මඟින් පාරිභෝගිකයින් අසලට ගොස් මේස අංකය තෝරා (උදා: Table 05) ඇණවුම් සෘජුවම කුස්සියට හෝ බාර් එකට යැවීම.",
        tip: "මේසයකට අමතර බීම හෝ අතුරුපස (Round 2) එකතු කිරීමටද පහසුකම් ඇත.",
      },
    ],
    proTipEn: "Staff members can operate from any device simultaneously (iPad, phone, touchscreen terminal) with instant cloud sync.",
    proTipSi: "ඕනෑම ටැබ්ලට් එකකින් හෝ දුරකථනයකින් සේවකයින්ට එකවර වැඩ කළ හැකි අතර තොරතුරු ක්ෂණිකව සජීවීව යාවත්කාලීන වේ.",
  },
  {
    id: "taking-orders",
    category: "pos",
    icon: UtensilsCrossed,
    titleEn: "POS Register & Placing Orders",
    titleSi: "POS කවුළුව සහ ඇණවුම් ඇතුලත් කිරීම",
    descriptionEn: "Step-by-step instructions on navigating categories, adding items to cart, and sending tickets.",
    descriptionSi: "ආහාර වර්ග තෝරා ගැනීම, කරත්තයට (Cart) දැමීම සහ කුස්සියට යැවීමේ සම්පූර්ණ පියවර.",
    roles: ["Cashier", "Floor Waiter", "Admin"],
    quickView: "POS",
    stepsEn: [
      {
        title: "1. Select Service / Table",
        desc: "Click on the Dining Option at the top: Dine-In, Takeaway, or Delivery. For Dine-In, choose the customer's table (e.g. Table 01 - Table 12).",
        tip: "Green tables are available; orange tables have open running tabs.",
      },
      {
        title: "2. Browse Categories & Add Items",
        desc: "Use the top category pills (Fresh Juices, Smoothies, Coffee, Mains, Snacks, Desserts) or search bar to find dishes. Tap an item to add to the active cart.",
      },
      {
        title: "3. Adjust Quantities & Special Notes",
        desc: "In the right-hand Cart sidebar, tap '+' or '–' to adjust item counts. Review the subtotal and tax/service calculations in real-time.",
      },
      {
        title: "4. Send to Kitchen & Bar (Fire Ticket)",
        desc: "Click 'Send to Kitchen / Bar' or 'Hold / Open Tab'. This automatically creates Round 1 tickets on the Chef's and Barista's screens with audio alerts.",
      },
    ],
    stepsSi: [
      {
        title: "1. මේසය හෝ සේවා ක්‍රමය තෝරන්න",
        desc: "ඉහළින් ඇති Dine-In (ආපනශාලාවේ හිඳීම), Takeaway (රැගෙන යාම) හෝ Delivery තෝරන්න. Dine-In නම් අදාළ මේසය (උදා: Table 01 - Table 12) තෝරන්න.",
        tip: "කොළ පැහැති මේස හිස් ඒවා වන අතර, තැඹිලි පැහැති මේස දැනට පාරිභෝගිකයින් සිටින ඒවා වේ.",
      },
      {
        title: "2. මෙනුවෙන් ආහාර තෝරන්න",
        desc: "Fresh Juices, Smoothies, Coffee, Mains වැනි කාණ්ඩ මඟින් හෝ Search තීරුවෙන් ආහාර/බීම තෝරා ඒවා මත ක්ලික් කරන්න.",
      },
      {
        title: "3. ප්‍රමාණයන් (Quantity) සකසන්න",
        desc: "දකුණු පස ඇති Cart එකෙන් '+' හෝ '–' ඔබා ප්‍රමාණයන් වෙනස් කරන්න. මුළු මුදල ස්වයංක්‍රීයව ගණනය වේ.",
      },
      {
        title: "4. කුස්සියට හා බාර් එකට යවන්න (Send Order)",
        desc: "'Send to Kitchen' බොත්තම ඔබන්න. ක්ෂණිකව කුස්සියේ හා බාර් එකේ තිර වලට අදාළ ටිකට්පත සීනු නාදයක් සමඟින් දිස්වේ.",
      },
    ],
    proTipEn: "Use the Acceptance Test button (Zap icon) to instantly simulate a realistic Table 05 order for training new staff.",
    proTipSi: "නව සේවකයින් පුහුණු කිරීම සඳහා ඉහළ ඇති Zap (විදුලි කෙටීම) අයිකනය මඟින් පරීක්ෂණ ඇණවුමක් (Test Order) දමා පෙන්විය හැක.",
  },
  {
    id: "table-management",
    category: "tables",
    icon: Table2,
    titleEn: "Table Management & Floor Plan",
    titleSi: "මේස කළමනාකරණය සහ සැලැස්ම (Tables Workspace)",
    descriptionEn: "How to monitor occupied tables, track seated duration, merge tabs, and release tables.",
    descriptionSi: "ආපනශාලාවේ මේස වල තත්ත්වය, ගතවූ වේලාව සහ ගෙවීම් අවසන් වූ පසු මේස නිදහස් කිරීම.",
    roles: ["Floor Waiter", "Cashier", "Admin"],
    quickView: "Tables",
    stepsEn: [
      {
        title: "1. Monitor Table Status Colors",
        desc: "Green = Available for guests. Amber = Occupied with running tab. Blue = Bill requested by guest. Violet = Cleaning in progress.",
      },
      {
        title: "2. View Active Table Orders",
        desc: "Click on any occupied table to see what they have ordered, their current total, seated time, and whether food is still being prepared.",
      },
      {
        title: "3. Add Items to Existing Table Tab",
        desc: "Click 'Add to Tab' on an occupied table. Any new items added will be labeled as 'Round 2' or 'Round 3' so the kitchen knows it is an additional order.",
      },
      {
        title: "4. Settle Bill & Free Up Table",
        desc: "Once payment is confirmed at the cash register, click 'Mark Table Available' or settle the order to open the table for the next incoming guests.",
      },
    ],
    stepsSi: [
      {
        title: "1. මේස වල වර්ණ හඳුනාගන්න",
        desc: "කොළ පැහැය = හිස් මේස (Available). තැඹිලි = පාරිභෝගිකයින් සිටී (Occupied). නිල් = බිල ඉල්ලා ඇත (Bill Requested). දම් = පිරිසිදු කරමින් පවතී.",
      },
      {
        title: "2. මේසයේ ඇණවුම් විස්තර බැලීම",
        desc: "ඕනෑම මේසයක් මත ක්ලික් කිරීමෙන් ඔවුන් ඇණවුම් කළ දෑ, මුළු බිල සහ ගතවූ කාලය බලාගත හැක.",
      },
      {
        title: "3. පවතින මේසයට තව දෑ එකතු කිරීම (Add to Tab)",
        desc: "පාරිභෝගිකයා අමතර බීම හෝ කෑම ඉල්ලූ විට 'Add to Tab' ඔබන්න. එය 'Round 2' ලෙස කුස්සියට යොමු වේ.",
      },
      {
        title: "4. ගෙවීම අවසන් කර මේසය නිදහස් කිරීම",
        desc: "අයකැමි විසින් බිල ගෙවීම් කළ පසු මේසය නැවත අලුත් අමුත්තන් සඳහා සූදානම් (Available) තත්ත්වයට පත්වේ.",
      },
    ],
  },
  {
    id: "kitchen-bar-kds",
    category: "kitchen",
    icon: ChefHat,
    titleEn: "Kitchen & Bar Display System (KDS)",
    titleSi: "කුස්සිය සහ බාර් සංදර්ශක පද්ධතිය (KDS Screens)",
    descriptionEn: "Paperless live order tracking with status progression and acoustic chimes for chefs & baristas.",
    descriptionSi: "කඩදාසි රහිතව කුස්සියට සහ බාර් එකට ලැබෙන ඇණවුම් පිළියෙල කිරීමේ ක්‍රියාවලිය.",
    roles: ["Kitchen Chef", "Barista", "Admin"],
    quickView: "Kitchen",
    stepsEn: [
      {
        title: "1. Dedicated Stations (Kitchen vs Bar)",
        desc: "Kitchen chefs see food, burgers, sandwiches, and bowls. Baristas see fresh juices, smoothies, coffees, and cocktails on the 'Bar' view.",
      },
      {
        title: "2. Incoming Ticket Alerts",
        desc: "New tickets flash at the top with table number, waiter name, and timestamp. An audio alert sounds when a new order arrives.",
      },
      {
        title: "3. Status Progression",
        desc: "Click 'Start Preparing' when the order goes to the stove/blender (turns orange). Click 'Mark Ready' when plated (turns green).",
      },
      {
        title: "4. Hand-off to Service Staff",
        desc: "Once runners take the food to the guest table, tap 'Served' to archive the ticket from the active screen.",
      },
    ],
    stepsSi: [
      {
        title: "1. වෙනම තිර (කුස්සිය සහ බාර්)",
        desc: "කුස්සියේ තිරයට (Kitchen) ආහාර වර්ග පමණක්ද, බාර් තිරයට (Bar) ජූස්, ස්මූති සහ කෝපි වර්ග පමණක්ද ස්වයංක්‍රීයව වෙන්ව ලැබේ.",
      },
      {
        title: "2. අලුත් ඇණවුම් පැමිණීම (Alerts)",
        desc: "අලුත් ඇණවුමක් ආ විට තිරයේ ඉහළින්ම මේස අංකය සහ වේලාව සමඟ සීනු නාදයක් ඇසේ.",
      },
      {
        title: "3. පිළියෙල කිරීමේ තත්ත්වය වෙනස් කිරීම",
        desc: "ආහාරය සෑදීම ආරම්භ කළ විට 'Start Preparing' ඔබන්න. සාදා අවසන් වූ විට 'Mark Ready' ඔබන්න.",
      },
      {
        title: "4. මේසයට පිළිගැන්වීම (Served)",
        desc: "වේටර් විසින් ආහාරය මේසයට රැගෙන ගිය පසු 'Served' ඔබන්න. එවිට එය සක්‍රිය තිරයෙන් ඉවත් වේ.",
      },
    ],
    warningEn: "Always check the 'Special Notes' section on each ticket for allergy or dietary requests (e.g. no nuts, dairy-free).",
    warningSi: "ආසාත්මිකතා හෝ අමතර උපදෙස් (Allergy notes, No sugar) සඳහා ටිකට්පතේ ඇති සටහන් හොඳින් පරීක්ෂා කරන්න.",
  },
  {
    id: "billing-receipts",
    category: "billing",
    icon: CreditCard,
    titleEn: "Billing, Payments & Receipts",
    titleSi: "බිල්පත් පියවීම, ගෙවීම් සහ රිසිට්පත්",
    descriptionEn: "Accepting cash, cards, and QR payments, calculating change, and printing 80mm thermal receipts.",
    descriptionSi: "මුදල්, බැංකු කාඩ්පත් හෝ QR මඟින් ගෙවීම් ලබා ගැනීම සහ රිසිට්පත් මුද්‍රණය.",
    roles: ["Cashier", "Admin"],
    quickView: "POS",
    stepsEn: [
      {
        title: "1. Review Total & Service Charge",
        desc: "In the Checkout modal, verify food items, 10% service charge (if applicable), and any custom manager discount.",
      },
      {
        title: "2. Select Payment Method",
        desc: "Choose Cash, Card (Visa/Mastercard), or QR / Mobile Pay. For cash, type the received sum to see the exact change to return to the guest.",
      },
      {
        title: "3. Complete Payment",
        desc: "Click 'Complete & Print Receipt'. The transaction is securely stored in Supabase with invoice receipt number (e.g. #REC-2026-0042).",
      },
      {
        title: "4. Print Receipt",
        desc: "A clean 80mm/58mm thermal-style receipt is displayed. Click 'Print Receipt' to send directly to your POS thermal printer or Bluetooth printer.",
      },
    ],
    stepsSi: [
      {
        title: "1. මුළු මුදල සහ සේවා ගාස්තු පරීක්ෂාව",
        desc: "Checkout කොටසේදී ආහාර වල මිල, 10% සේවා ගාස්තුව (Service Charge) සහ වට්ටම් (Discounts) පරීක්ෂා කරන්න.",
      },
      {
        title: "2. ගෙවීම් ක්‍රමය තෝරන්න",
        desc: "Cash (මුදල්), Card (කාඩ්පත්) හෝ QR තෝරන්න. මුදල් නම්, පාරිභෝගිකයා දුන් මුදල ඇතුළත් කළ විට ඉතිරි මුදල (Change) පෙන්වයි.",
      },
      {
        title: "3. ගෙවීම සම්පූර්ණ කිරීම",
        desc: "'Complete & Print' බොත්තම ඔබන්න. ගෙවීම් විස්තර සුරක්ෂිතව සටහන් වී නිල රිසිට් අංකයක් නිකුත් වේ.",
      },
      {
        title: "4. රිසිට්පත මුද්‍රණය (Thermal Print)",
        desc: "පැහැදිලි රිසිට්පතක් තිරයේ දිස්වන අතර, 'Print Receipt' මඟින් ඔබේ Thermal Receipt මුද්‍රණ යන්ත්‍රයට යොමු කළ හැක.",
      },
    ],
  },
  {
    id: "coffee-bar-module",
    category: "coffee",
    icon: Coffee,
    titleEn: "Specialized Coffee Bar Module",
    titleSi: "කෝපි බාර් විශේෂ පද්ධතිය (Coffee Bar Module)",
    descriptionEn: "Independent workspace for specialty espresso, single origins, fast barista billing, and coffee-specific reports.",
    descriptionSi: "කෝපි සහ බීම සඳහාම වෙන්වූ විශේෂ බිල්පත් සහ වාර්තා ලබාගැනීමේ පද්ධතිය.",
    roles: ["Barista", "Cashier", "Admin"],
    quickView: "CoffeeBill",
    stepsEn: [
      {
        title: "1. Dedicated Coffee Products Catalog",
        desc: "Manage espresso drinks, pourovers, oat/almond milk options, and specialty beans separately from main kitchen foods.",
      },
      {
        title: "2. Fast Coffee Quick Bill",
        desc: "Instant one-tap barista ordering interface designed for rapid morning rush takeaway queues.",
      },
      {
        title: "3. Dedicated Coffee Reports",
        desc: "View coffee bean consumption, cup counts, and beverage revenue isolated from food sales.",
      },
    ],
    stepsSi: [
      {
        title: "1. විශේෂ කෝපි මෙනුව (Coffee Products)",
        desc: "එස්ප්‍රෙසෝ, ලැටේ, කෝපි බෝංචි වර්ග සහ ආමන්ඩ්/ඕට් කිරි විකල්ප වෙනම කළමනාකරණය කිරීමේ හැකියාව.",
      },
      {
        title: "2. ක්ෂණික කෝපි බිල්පත (Coffee Quick Bill)",
        desc: "උදෑසන කෝපි රැගෙන යන පාරිභෝගිකයින් සඳහා තත්පර කිහිපයකින් බිලක් දමා දිය හැකි වේගවත් ක්‍රමය.",
      },
      {
        title: "3. කෝපි අංශයේ වාර්තා (Coffee Reports)",
        desc: "දිනපතා විකිණුනු කෝපි කෝප්ප ගණන සහ ආදායම ආහාර ආදායමෙන් වෙන්ව බලාගැනීම.",
      },
    ],
  },
  {
    id: "inventory-ingredients",
    category: "inventory",
    icon: Package,
    titleEn: "Inventory & Raw Ingredient Tracking",
    titleSi: "තොග සහ අමුද්‍රව්‍ය පාලනය (Inventory Workspace)",
    descriptionEn: "Track stock quantities, low-stock warnings, unit costs, and supplier reordering.",
    descriptionSi: "අමුද්‍රව්‍ය ප්‍රමාණයන්, තොග අවසන් වීමේ අනතුරු ඇඟවීම් සහ මිලදී ගැනීම් පාලනය.",
    roles: ["Admin", "Inventory Manager"],
    quickView: "Inventory",
    stepsEn: [
      {
        title: "1. View Ingredient Stock Levels",
        desc: "Open 'Inventory' in the Management menu. See current grams/kilograms/liters/units of all ingredients.",
      },
      {
        title: "2. Low Stock Alerts",
        desc: "Items dipping below their minimum threshold trigger red 'Low Stock' banners so you never run out during busy shifts.",
      },
      {
        title: "3. Quick Adjustments & Restock",
        desc: "Click 'Adjust Stock' to record incoming supplier shipments, spoilage, or periodic physical count corrections.",
      },
    ],
    stepsSi: [
      {
        title: "1. අමුද්‍රව්‍ය තොග ප්‍රමාණය බැලීම",
        desc: "මෙනුවේ 'Inventory' තෝරා දැනට පවතින කිලෝග්‍රෑම්, ලීටර් හෝ ඒකක ප්‍රමාණයන් සජීවීව පරීක්ෂා කරන්න.",
      },
      {
        title: "2. තොග අවසන් වීමේ අනතුරු ඇඟවීම් (Low Stock)",
        desc: "අවම ප්‍රමාණයට වඩා අඩුවන විට රතු පැහැයෙන් අනතුරු අඟවන බැවින් කලින්ම ඇනවුම් කිරීමට හැකියාව ලැබේ.",
      },
      {
        title: "3. අලුත් තොග ඇතුළත් කිරීම (Restock)",
        desc: "නව අමුද්‍රව්‍ය ලැබුණු විට 'Adjust Stock' මඟින් නව ප්‍රමාණයන් එක් කරන්න.",
      },
    ],
  },
  {
    id: "reports-analytics",
    category: "reports",
    icon: TrendingUp,
    titleEn: "Sales Reports & Analytics",
    titleSi: "විකුණුම් වාර්තා සහ ආදායම් විශ්ලේෂණය",
    descriptionEn: "Analyze daily gross revenue, net profit, popular dishes, peak hours, and cash vs card totals.",
    descriptionSi: "දෛනික මුළු ආදායම, වැඩිපුරම විකිණුනු ආහාර සහ මුදල්/කාඩ්පත් විස්තර විශ්ලේෂණය.",
    roles: ["Admin"],
    quickView: "Reports",
    stepsEn: [
      {
        title: "1. Date Range Filtering",
        desc: "Filter reports by Today, Yesterday, This Week, This Month, or pick a custom date span.",
      },
      {
        title: "2. Payment Method Breakdown",
        desc: "Compare exact intake for Cash drawer vs Credit Card POS terminal vs QR transfers for easy daily till reconciliation.",
      },
      {
        title: "3. Top Performers & Peak Hours",
        desc: "Identify your most profitable dishes, highest-selling drinks, and hourly traffic distribution to optimize kitchen prep.",
      },
    ],
    stepsSi: [
      {
        title: "1. දිනය අනුව වාර්තා පරීක්ෂාව",
        desc: "අද දින, ඊයේ, මෙම සතිය හෝ මාසය තෝරා නිවැරදි ආදායම් වාර්තා ලබා ගන්න.",
      },
      {
        title: "2. ගෙවීම් ක්‍රම අනුව විස්තර",
        desc: "මුදල් පෙට්ටියේ ඇති මුදල් (Cash) සහ කාඩ්පත් මඟින් ලැබුණු මුදල් වෙන වෙනම ගණනය කර දවසේ ගිණුම් පියවන්න.",
      },
      {
        title: "3. වැඩිපුරම අලෙවි වූ ආහාර (Top Selling)",
        desc: "පාරිභෝගිකයින් වැඩිපුරම කැමති ආහාර සහ වැඩිම ආදායමක් ලැබුණු වේලාවන් හඳුනා ගන්න.",
      },
    ],
  },
  {
    id: "user-management-rbac",
    category: "admin",
    icon: Users,
    titleEn: "Admin User Management & Role Permissions (RBAC)",
    titleSi: "පරිපාලක, සේවක ගිණුම් සහ අවසර (Staff & Roles)",
    descriptionEn: "Creating new staff credentials, modifying role permissions, security audit trails, and session security.",
    descriptionSi: "නව සේවක ගිණුම් සෑදීම, ඔවුන්ට අවසර ලබා දීම සහ පද්ධතියේ ආරක්ෂාව පාලනය.",
    roles: ["Admin"],
    quickView: "Users",
    stepsEn: [
      {
        title: "1. Create New Staff User",
        desc: "Go to Management -> Users. Click 'Add User', set their full name, username, secure password, and select their role (Admin, Cashier, Kitchen, Staff).",
      },
      {
        title: "2. Configure Role Permissions",
        desc: "Under Management -> Roles, you can fine-tune what each role is permitted to see (e.g. restrict kitchen staff from viewing revenue reports).",
      },
      {
        title: "3. Security Audit Trail",
        desc: "All critical actions (voided orders, manual discounts, price changes) are logged with the responsible staff username and timestamp.",
      },
    ],
    stepsSi: [
      {
        title: "1. නව සේවක ගිණුමක් සෑදීම",
        desc: "Management -> Users වෙත ගොස් 'Add User' ඔබන්න. නම, Username, Password සහ ඔවුන්ගේ තනතුර (Role) තෝරා සුරකින්න.",
      },
      {
        title: "2. අවසර සීමා කිරීම (Permissions)",
        desc: "Management -> Roles මඟින් එක් එක් සේවකයාට දැකිය හැකි පිටු සීමා කළ හැක (උදා: කුස්සියේ අයට ආදායම් වාර්තා බැලීම වැළැක්වීම).",
      },
      {
        title: "3. ආරක්ෂිත සටහන් (Audit Trail)",
        desc: "ඕනෑම වැදගත් වෙනස්කමක් හෝ ඇණවුම් අවලංගු කිරීමක් සිදුකළ සේවකයාගේ නම සහ වේලාව ස්වයංක්‍රීයව සටහන් වේ.",
      },
    ],
  },
]

interface UserGuideViewProps {
  onNavigateView?: (view: string) => void
}

export function UserGuideView({ onNavigateView }: UserGuideViewProps) {
  const [lang, setLang] = useState<Language>("en")
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<Category>("all")
  const [expandedId, setExpandedId] = useState<string | null>("roles-overview")

  const categories: { id: Category; labelEn: string; labelSi: string }[] = [
    { id: "all", labelEn: "All Topics", labelSi: "සියලු අංශ" },
    { id: "roles", labelEn: "Roles & Access", labelSi: "සේවක භූමිකා" },
    { id: "pos", labelEn: "POS & Orders", labelSi: "ඇණවුම් ලබා ගැනීම" },
    { id: "tables", labelEn: "Tables", labelSi: "මේස කළමනාකරණය" },
    { id: "kitchen", labelEn: "Kitchen & Bar", labelSi: "කුස්සිය සහ බාර් (KDS)" },
    { id: "billing", labelEn: "Billing & Receipts", labelSi: "බිල්පත් සහ රිසිට්" },
    { id: "coffee", labelEn: "Coffee Bar", labelSi: "කෝපි බාර් පද්ධතිය" },
    { id: "inventory", labelEn: "Inventory", labelSi: "තොග පාලනය" },
    { id: "reports", labelEn: "Reports", labelSi: "විකුණුම් වාර්තා" },
    { id: "admin", labelEn: "Admin & Staff", labelSi: "පරිපාලක සහ සේවකයින්" },
  ]

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase()
    return GUIDE_SECTIONS.filter((section) => {
      // Category filter
      if (selectedCategory !== "all" && section.category !== selectedCategory) {
        return false
      }
      // Search filter
      if (!q) return true
      const matchEn =
        section.titleEn.toLowerCase().includes(q) ||
        section.descriptionEn.toLowerCase().includes(q) ||
        section.stepsEn.some((s) => s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q))
      const matchSi =
        section.titleSi.toLowerCase().includes(q) ||
        section.descriptionSi.toLowerCase().includes(q) ||
        section.stepsSi.some((s) => s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q))
      const matchRoles = section.roles.some((r) => r.toLowerCase().includes(q))

      return matchEn || matchSi || matchRoles
    })
  }, [search, selectedCategory])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[#dfe5d8] bg-gradient-to-br from-[#244f3d] via-[#1c4232] to-[#153326] p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#dce8c8] text-[#244f3d] hover:bg-[#dce8c8] text-xs font-bold uppercase tracking-wider px-2.5 py-0.5">
                {lang === "en" ? "System Manual & Guide" : "පද්ධති අත්පොත සහ මාර්ගෝපදේශය"}
              </Badge>
              <span className="text-xs text-[#b8d4b3] font-mono">v2.4 Production</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-[#f4faee]">
              {lang === "en" ? "Lazy Sunday POS User Guide" : "Lazy Sunday POS පරිශීලක මාර්ගෝපදේශය"}
            </h1>
            <p className="text-xs sm:text-sm text-[#c8dec4] max-w-xl leading-relaxed">
              {lang === "en"
                ? "Complete operating instructions for Restaurant Managers, Cashiers, Kitchen Chefs, and Floor Staff. Follow these standard operating procedures for smooth service."
                : "ආපනශාලා කළමනාකරුවන්, අයකැමියන්, කුස්සියේ ප්‍රධානීන් සහ වේටර්වරුන් සඳහා වන සම්පූර්ණ මෙහෙයුම් උපදෙස් මාලාව."}
            </p>
          </div>

          {/* Action Controls: Language Toggle & Print */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Language Selector */}
            <div className="inline-flex rounded-2xl bg-white/10 p-1 border border-white/20 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  lang === "en"
                    ? "bg-white text-[#244f3d] shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <span>🇬🇧 English</span>
              </button>
              <button
                type="button"
                onClick={() => setLang("si")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  lang === "si"
                    ? "bg-white text-[#244f3d] shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <span>🇱🇰 සිංහල</span>
              </button>
            </div>

            {/* Print Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white rounded-xl h-9 gap-1.5 text-xs font-semibold backdrop-blur-sm"
            >
              <Printer className="size-3.5" />
              <span className="hidden sm:inline">{lang === "en" ? "Print Manual" : "මුද්‍රණය කරන්න"}</span>
            </Button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 size-60 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                lang === "en"
                  ? "Search topics (e.g. order, kitchen, discount, table)..."
                  : "මාතෘකා සොයන්න (උදා: ඇණවුම්, කුස්සිය, බිල්පත්, මේස)..."
              }
              className="pl-9 h-11 rounded-2xl border-[#dce3d5] bg-white text-xs sm:text-sm focus:ring-[#244f3d] shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Summary Pill */}
          <div className="text-xs text-[#6e7a70] flex items-center gap-2 self-end sm:self-center font-medium">
            <span>
              {lang === "en"
                ? `Showing ${filteredSections.length} of ${GUIDE_SECTIONS.length} guides`
                : `මාර්ගෝපදේශ ${GUIDE_SECTIONS.length} න් ${filteredSections.length} ක් පෙන්වයි`}
            </span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-[#244f3d] text-white shadow-sm"
                  : "bg-white text-[#5b685d] border border-[#dce3d5] hover:bg-[#f1f5ed]"
              }`}
            >
              {lang === "en" ? cat.labelEn : cat.labelSi}
            </button>
          ))}
        </div>
      </div>

      {/* Guide Cards Accordion */}
      <div className="space-y-4">
        {filteredSections.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-[#dfe5d8] space-y-3">
            <BookOpen className="size-10 text-gray-300 mx-auto" />
            <p className="text-sm font-semibold text-gray-700">
              {lang === "en" ? "No guide topics found matching your query." : "සෙවූ වචන වලට අදාළ මාතෘකා කිසිවක් හමු නොවීය."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("")
                setSelectedCategory("all")
              }}
              className="rounded-xl text-xs"
            >
              {lang === "en" ? "Reset Filters" : "සියල්ල නැවත පෙන්වන්න"}
            </Button>
          </div>
        ) : (
          filteredSections.map((section) => {
            const isExpanded = expandedId === section.id
            const Icon = section.icon
            const title = lang === "en" ? section.titleEn : section.titleSi
            const desc = lang === "en" ? section.descriptionEn : section.descriptionSi
            const steps = lang === "en" ? section.stepsEn : section.stepsSi
            const proTip = lang === "en" ? section.proTipEn : section.proTipSi
            const warning = lang === "en" ? section.warningEn : section.warningSi

            return (
              <div
                key={section.id}
                className={`overflow-hidden rounded-2xl sm:rounded-3xl border transition-all ${
                  isExpanded
                    ? "border-[#244f3d]/40 bg-white shadow-md ring-1 ring-[#244f3d]/10"
                    : "border-[#dfe5d8] bg-white hover:border-[#244f3d]/30 hover:bg-[#fafbf8]"
                }`}
              >
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(section.id)}
                  className="w-full p-4 sm:p-5 flex items-start sm:items-center justify-between text-left gap-4 cursor-pointer"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div
                      className={`flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                        isExpanded ? "bg-[#244f3d] text-white" : "bg-[#ecf3e7] text-[#244f3d]"
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                        <h2 className="font-serif text-base sm:text-lg font-bold text-gray-900 truncate">
                          {title}
                        </h2>
                        {section.roles.map((r) => (
                          <Badge
                            key={r}
                            variant="secondary"
                            className="bg-[#f0f4ec] text-[#34533f] text-[10px] px-1.5 py-0 border-0 font-medium"
                          >
                            {r}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-[#6e7a70] line-clamp-2 leading-relaxed">{desc}</p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <div
                      className={`flex size-8 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition-transform duration-200 ${
                        isExpanded ? "rotate-180 bg-[#ecf3e7] text-[#244f3d]" : ""
                      }`}
                    >
                      <ChevronDown className="size-4" />
                    </div>
                  </div>
                </button>

                {/* Expanded Content Body */}
                {isExpanded && (
                  <div className="border-t border-[#edf2e8] bg-[#fcfdfa] p-4 sm:p-6 space-y-5 animate-in fade-in-50 duration-200">
                    {/* Steps Grid */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#718073]">
                        {lang === "en" ? "Standard Operating Steps" : "ක්‍රියාත්මක කිරීමේ පියවර"}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="rounded-2xl border border-[#e1e7dc] bg-white p-3.5 sm:p-4 shadow-2xs space-y-2 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#244f3d] text-white text-[10px] font-bold">
                                  {idx + 1}
                                </span>
                                <h3 className="text-xs sm:text-sm font-bold text-gray-900">{step.title}</h3>
                              </div>
                              <p className="text-xs text-[#5f6c61] leading-relaxed pl-7">{step.desc}</p>
                            </div>
                            {step.tip && (
                              <div className="mt-2 ml-7 p-2 rounded-xl bg-[#f4f7f1] border border-[#e4ebde] text-[11px] text-[#425e4c] flex items-start gap-1.5">
                                <Lightbulb className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span>{step.tip}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pro Tip Alert */}
                    {proTip && (
                      <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-3.5 flex items-start gap-3 text-xs text-amber-900">
                        <Lightbulb className="size-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block mb-0.5">
                            {lang === "en" ? "Pro Tip for Speed & Accuracy" : "වේගවත් සහ නිවැරදි සේවාවක් සඳහා උපදෙස්"}
                          </span>
                          <span className="leading-relaxed">{proTip}</span>
                        </div>
                      </div>
                    )}

                    {/* Warning Alert */}
                    {warning && (
                      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-3 text-xs text-rose-900">
                        <AlertTriangle className="size-4 text-rose-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block mb-0.5">
                            {lang === "en" ? "Important Warning" : "වැදගත් අවධානයට"}
                          </span>
                          <span className="leading-relaxed">{warning}</span>
                        </div>
                      </div>
                    )}

                    {/* Quick Jump Action if available */}
                    {section.quickView && onNavigateView && (
                      <div className="pt-2 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onNavigateView(section.quickView!)}
                          className="rounded-xl text-xs gap-1.5 border-[#244f3d]/30 text-[#244f3d] hover:bg-[#244f3d] hover:text-white transition-colors"
                        >
                          <span>
                            {lang === "en"
                              ? `Open ${section.quickView} Workspace`
                              : `${section.quickView} වෙත යන්න`}
                          </span>
                          <ExternalLink className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer Support Notice & Developer Credit */}
      <div className="rounded-2xl border border-[#dfe5d8] bg-[#f8faf6] p-5 text-center space-y-2">
        <p className="text-xs font-semibold text-[#244f3d]">
          {lang === "en" ? "Lazy Sunday Restaurant Management System" : "Lazy Sunday ආපනශාලා කළමනාකරණ පද්ධතිය"}
        </p>
        <p className="text-[11px] text-[#718073] max-w-md mx-auto leading-relaxed">
          {lang === "en"
            ? "Need custom POS features, receipt adjustments, or hardware integration? Contact your system developer."
            : "අමතර විශේෂාංග හෝ තාක්ෂණික සහාය සඳහා පද්ධති සංවර්ධකයා (Developer) අමතන්න."}
        </p>
        <div className="pt-1">
          <Badge className="bg-[#244f3d] text-white hover:bg-[#244f3d] text-[10px] font-medium px-2.5 py-0.5">
            Created by Chamith · Full Stack Developer
          </Badge>
        </div>
      </div>
    </div>
  )
}
