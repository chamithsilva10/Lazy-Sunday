"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import {
  Coffee,
  Plus,
  Minus,
  Trash2,
  Printer,
  Save,
  Receipt,
  Search,
  RotateCcw,
  CheckCircle2,
  Calendar,
  User,
  CreditCard,
  Banknote,
  QrCode,
  Edit,
  History,
  X,
  FileText,
  Table2,
} from "lucide-react"
import { CoffeeProduct, CoffeeBill, CoffeeBillItem, CoffeePaymentMethod } from "@/lib/coffee/types"
import { CoffeeStorageService } from "@/lib/coffee/storage"
import { SharedPosService, type SharedTable } from "@/lib/shared-pos-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PosReceipt } from "@/components/ui/pos-receipt"
import { printThermalReceiptDoc } from "@/lib/thermal-printer"
import { toast } from "sonner"

interface CoffeeBillViewProps {
  role?: "admin" | "cashier"
}

export function CoffeeBillView({ role = "cashier" }: CoffeeBillViewProps) {
  // Available active coffee products for picker
  const [activeProducts, setActiveProducts] = useState<CoffeeProduct[]>(() =>
    CoffeeStorageService.getCachedProducts().filter((p) => p.status === "active")
  )
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")

  // Current Bill Form State
  const [billNumber, setBillNumber] = useState("COF-1001")
  const [billDate, setBillDate] = useState(() => new Date().toISOString().substring(0, 10))
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [tables, setTables] = useState<SharedTable[]>([])
  const [selectedTable, setSelectedTable] = useState<string>("Takeaway")
  const [billItems, setBillItems] = useState<CoffeeBillItem[]>([])
  const [discount, setDiscount] = useState<string>("0")
  const [tax, setTax] = useState<string>("0")
  const [paymentMethod, setPaymentMethod] = useState<CoffeePaymentMethod>("cash")
  const [cashReceived, setCashReceived] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [editingBillId, setEditingBillId] = useState<string | null>(null)

  // Past Bills List Modal State
  const [historyOpen, setHistoryOpen] = useState(false)
  const [pastBills, setPastBills] = useState<CoffeeBill[]>([])
  const [historySearch, setHistorySearch] = useState("")

  // Print Receipt Modal State
  const [printReceiptBill, setPrintReceiptBill] = useState<CoffeeBill | null>(null)
  const [printModalOpen, setPrintModalOpen] = useState(false)

  // Load active products & next bill number
  async function loadInitialData() {
    try {
      const [productsResponse, billsResponse] = await Promise.all([
        fetch("/api/coffee/products?activeOnly=true", { cache: "no-store" }),
        fetch("/api/coffee/bills", { cache: "no-store" }),
      ])
      if (productsResponse.ok) {
        const productsResult = await productsResponse.json()
        if (Array.isArray(productsResult.products) && productsResult.products.length > 0) {
          setActiveProducts(productsResult.products)
          CoffeeStorageService.saveLocalProducts(productsResult.products)
        }
      }
      if (billsResponse.ok) {
        const billsResult = await billsResponse.json()
        if (!editingBillId) {
          setBillNumber(billsResult.nextBillNumber || "COF-1001")
        }
        setPastBills(billsResult.bills || [])
      }
    } catch {
      // Keep existing active products without throwing or wiping
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(() => {
    void loadInitialData()
    setTables(SharedPosService.getTables())
    const onTablesChange = (e: any) => {
      if (e.detail) setTables(e.detail)
    }
    const onProductsUpdated = (e: any) => {
      if (Array.isArray(e.detail) && e.detail.length > 0) {
        setActiveProducts(e.detail.filter((p: CoffeeProduct) => p.status === "active"))
      }
    }
    window.addEventListener("coffee_products_updated", onProductsUpdated)
    window.addEventListener("pos_tables_updated", onTablesChange)
    const unsubTables = SharedPosService.subscribeTables(setTables)

    return () => {
      window.removeEventListener("coffee_products_updated", onProductsUpdated)
      window.removeEventListener("pos_tables_updated", onTablesChange)
      unsubTables()
    }
  }, [])

  // Categories for picker
  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(activeProducts.map((p) => p.category)))]
  }, [activeProducts])

  // Filtered active products for picker
  const filteredProducts = useMemo(() => {
    return activeProducts.filter((p) => {
      const matchQuery =
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(productSearch.toLowerCase())
      const matchCat = selectedCategory === "All" || p.category === selectedCategory
      return matchQuery && matchCat
    })
  }, [activeProducts, productSearch, selectedCategory])

  // Current calculations
  const subtotal = useMemo(() => {
    return billItems.reduce((acc, item) => acc + item.line_total, 0)
  }, [billItems])

  const serviceCharge = useMemo(() => Math.round(subtotal * 0.10), [subtotal])
  const discountNum = Number(discount) || 0
  const taxNum = tax !== "0" && tax !== "" ? Number(tax) || 0 : serviceCharge
  const grandTotal = Math.max(0, subtotal - discountNum + taxNum)
  const cashReceivedNum = Number(cashReceived) || 0
  const changeDue = Math.max(0, cashReceivedNum - grandTotal)

  // Real-time table occupancy sync
  useEffect(() => {
    if (selectedTable && selectedTable !== "Takeaway" && billItems.length > 0) {
      SharedPosService.occupyTable(selectedTable, "Coffee Bar", billNumber, grandTotal, customerName)
    }
  }, [selectedTable, billItems.length, grandTotal, billNumber, customerName])

  // Add product to bill
  function handleAddItem(product: CoffeeProduct) {
    setBillItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.coffee_product_id === product.id)
      if (existingIndex > -1) {
        const next = [...prev]
        const currentQty = next[existingIndex].quantity + 1
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: currentQty,
          line_total: currentQty * next[existingIndex].unit_price,
        }
        return next
      }

      // Add new item with frozen name & unit price snapshot
      return [
        ...prev,
        {
          id: "item-" + Date.now() + "-" + Math.random().toString(36).substring(2, 5),
          coffee_product_id: product.id,
          item_name: product.name,
          size: product.size || "Regular",
          quantity: 1,
          unit_price: product.price,
          line_total: product.price,
        },
      ]
    })
  }

  // Update item quantity
  function handleUpdateQuantity(itemId: string, delta: number) {
    setBillItems((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const nextQty = item.quantity + delta
            if (nextQty <= 0) return null
            return {
              ...item,
              quantity: nextQty,
              line_total: nextQty * item.unit_price,
            }
          }
          return item
        })
        .filter(Boolean) as CoffeeBillItem[]
    )
  }

  // Remove item
  function handleRemoveItem(itemId: string) {
    setBillItems((prev) => prev.filter((i) => i.id !== itemId))
  }

  // Reset bill
  async function handleResetBill() {
    setSelectedTable("Takeaway")
    setEditingBillId(null)
    setBillItems([])
    setCustomerName("")
    setCustomerPhone("")
    setDiscount("0")
    setTax("0")
    setCashReceived("")
    setNotes("")
    setBillDate(new Date().toISOString().substring(0, 10))
    try {
      const response = await fetch("/api/coffee/bills", { cache: "no-store" })
      const result = await response.json()
      if (response.ok) setBillNumber(result.nextBillNumber || "COF-1001")
    } catch {
      toast.error("Unable to prepare the next bill")
    }
  }

  // Save bill
  async function handleSaveBill(shouldPrint = false) {
    if (billItems.length === 0) {
      toast.error("Please add at least one coffee item to the bill")
      return
    }

    try {
      if (editingBillId) {
        // Update existing bill via API
        const payload = {
          table_name: selectedTable,
          customer_name: customerName,
          customer_phone: customerPhone,
          items: billItems,
          subtotal,
          discount: discountNum,
          tax: taxNum,
          grand_total: grandTotal,
          payment_method: paymentMethod,
          notes,
        }

        const res = await fetch(`/api/coffee/bills/${editingBillId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          toast.error("Failed to update coffee bill")
          return
        }

        const result = await res.json()
        const updated = result.bill as CoffeeBill | undefined
        toast.success(`Bill #${billNumber} updated successfully`)

        if (selectedTable && selectedTable !== "Takeaway") {
          SharedPosService.occupyTable(selectedTable, "Coffee Bar", billNumber, grandTotal, customerName)
        }

        if (shouldPrint && updated) {
          setPrintReceiptBill({ ...updated, table_name: selectedTable })
          setPrintModalOpen(true)
        }

        handleResetBill()
      } else {
        // Create new bill via API
        const payload = {
          bill_number: billNumber,
          table_name: selectedTable,
          customer_name: customerName,
          customer_phone: customerPhone,
          items: billItems,
          subtotal,
          discount: discountNum,
          tax: taxNum,
          grand_total: grandTotal,
          payment_method: paymentMethod,
          notes,
        }

        const res = await fetch("/api/coffee/bills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          toast.error("Failed to save coffee bill")
          return
        }

        const result = await res.json()
        const saved = result.bill as CoffeeBill

        // Free table after settlement
        if (selectedTable && selectedTable !== "Takeaway") {
          SharedPosService.occupyTable(selectedTable, "Coffee Bar", billNumber, grandTotal, customerName)
        }

        // Deduct inventory movement for each coffee product
        for (const item of billItems) {
          SharedPosService.logMovement({
            product_id: item.coffee_product_id || item.id,
            product_name: item.item_name,
            department: "Coffee Bar",
            quantity_change: -item.quantity,
            reason: `Coffee Sale #${saved.bill_number}`,
          })
        }

        // Realtime sync to central Orders and Reports views
        void SharedPosService.saveOrder({
          id: String(saved.id || Date.now()),
          order_number: saved.bill_number,
          receipt_number: `CFE-${saved.bill_number}`,
          table_name: selectedTable,
          cashier_name: "Coffee Barista",
          department: "Coffee Bar",
          items: billItems.map((bi) => ({
            id: bi.coffee_product_id || bi.id,
            name: bi.item_name,
            price: bi.unit_price,
            quantity: bi.quantity,
          })),
          subtotal,
          service_charge: 0,
          service_charge_rate: 0,
          discount: discountNum,
          total: grandTotal,
          payment_method: paymentMethod,
          cash_received: grandTotal,
          change_amount: 0,
          status: "paid",
          kitchen_status: undefined,
          bar_status: "pending",
          created_at: new Date().toISOString(),
        })

        toast.success(`Coffee Bill #${saved.bill_number} generated successfully! Table released.`)

        if (shouldPrint) {
          setPrintReceiptBill({ ...saved, table_name: selectedTable })
          setPrintModalOpen(true)
        }

        handleResetBill()
      }

      // Refresh past bills list
      const response = await fetch("/api/coffee/bills", { cache: "no-store" })
      if (response.ok) setPastBills((await response.json()).bills || [])
    } catch (err: any) {
      toast.error(err.message || "Failed to save coffee bill")
    }
  }

  // Edit past bill
  function handleLoadPastBillForEdit(bill: CoffeeBill) {
    setEditingBillId(bill.id)
    setBillNumber(bill.bill_number)
    setBillDate(new Date(bill.bill_date).toISOString().substring(0, 10))
    setCustomerName(bill.customer_name || "")
    setCustomerPhone(bill.customer_phone || "")
    setBillItems(bill.items || [])
    setDiscount(String(bill.discount || 0))
    setTax(String(bill.tax || 0))
    setPaymentMethod(bill.payment_method)
    setNotes(bill.notes || "")
    setHistoryOpen(false)
    toast.info(`Loaded Bill #${bill.bill_number} for editing`)
  }

  // Delete past bill
  async function handleDeletePastBill(billId: string) {
    try {
      const res = await fetch(`/api/coffee/bills/${billId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        toast.error("Failed to delete bill")
        return
      }

      toast.success("Coffee bill deleted")
      const response = await fetch("/api/coffee/bills", { cache: "no-store" })
      if (response.ok) setPastBills((await response.json()).bills || [])
    } catch {
      toast.error("Failed to delete bill")
    }
  }

  // Trigger 80mm thermal print
  function handlePrintAction() {
    if (!printReceiptBill) return
    printThermalReceiptDoc({
      order_number: printReceiptBill.bill_number,
      receipt_number: printReceiptBill.bill_number,
      table_name: (printReceiptBill as any).table_name || selectedTable || "Takeaway",
      cashier_name: "Coffee Barista",
      items: printReceiptBill.items.map((i) => ({
        name: i.item_name,
        price: i.unit_price,
        quantity: i.quantity,
      })),
      subtotal: printReceiptBill.subtotal,
      service_charge: printReceiptBill.tax || Math.round(printReceiptBill.subtotal * 0.1),
      service_charge_rate: 0.1,
      discount: printReceiptBill.discount,
      total: printReceiptBill.grand_total,
      payment_method: printReceiptBill.payment_method,
      cash_received: printReceiptBill.grand_total,
      change_amount: 0,
      order_type: ((printReceiptBill as any).table_name || selectedTable) === "Takeaway" ? "takeaway" : "dine_in",
      created_at: printReceiptBill.bill_date,
    }, false)
  }

  // Filtered past bills
  const filteredPastBills = useMemo(() => {
    const search = historySearch.toLowerCase()
    return pastBills.filter((b) => {
      const billNumber = String(b.bill_number ?? "").toLowerCase()
      const customerName = String(b.customer_name ?? "").toLowerCase()
      return billNumber.includes(search) || customerName.includes(search)
    })
  }, [pastBills, historySearch])

  return (
    <div className="space-y-5">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E5D8CF] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#808068] text-white shadow-sm">
            <Coffee className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl font-bold text-gray-900">Coffee Bill</h2>
              <Badge className="bg-[#808068] text-white font-mono text-xs px-2.5 py-0.5">
                {editingBillId ? `Editing ${billNumber}` : billNumber}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Dedicated coffee billing counter. Saves product snapshots without altering master catalog.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setHistoryOpen(true)}
            className="rounded-xl border-[#E5D8CF] text-xs h-10 gap-2 flex-1 sm:flex-initial"
          >
            <History className="size-4 text-[#808068]" />
            Bill History ({pastBills.length})
          </Button>

          {editingBillId && (
            <Button
              variant="outline"
              onClick={handleResetBill}
              className="rounded-xl border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs h-10 gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Cancel Edit
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid: Left Side Item Picker, Right Side Bill Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Active Coffee Product Picker (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-2xl border-[#E5D8CF] bg-white p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-3 size-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Filter coffee menu..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl border-[#E5D8CF] text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={selectedCategory === cat ? "default" : "outline"}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-xl text-xs h-8 px-3 shrink-0 ${
                      selectedCategory === cat
                        ? "bg-[#D67B6B] text-white"
                        : "border-[#E5D8CF] text-gray-600 hover:bg-[#FAF5F1]"
                    }`}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {/* Active Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAddItem(p)}
                  className="flex flex-col text-left p-3.5 rounded-2xl border border-[#E5D8CF] bg-white hover:border-[#D67B6B] hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="w-full h-24 rounded-xl overflow-hidden bg-[#FAF5F1] mb-2.5 relative">
                    <img
                      src={p.image_url || "/latte-coffee.png"}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = "/latte-coffee.png"
                      }}
                    />
                    <Badge className="absolute top-2 right-2 bg-white/90 text-gray-800 text-[10px] backdrop-blur-sm shadow-sm font-semibold">
                      {p.size || "Regular"}
                    </Badge>
                  </div>
                  <p className="font-semibold text-xs sm:text-sm text-gray-900 line-clamp-1 group-hover:text-[#D67B6B]">
                    {p.name}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{p.category}</p>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between w-full">
                    <span className="font-bold text-xs sm:text-sm text-[#D67B6B] font-mono">
                      Rs. {p.price.toLocaleString()}
                    </span>
                    <span className="size-6 rounded-lg bg-[#FAF5F1] text-[#808068] group-hover:bg-[#D67B6B] group-hover:text-white flex items-center justify-center transition-colors">
                      <Plus className="size-3.5" />
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-dashed border-[#E5D8CF] text-gray-400">
                <Coffee className="size-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No active coffee items match your search.</p>
                <p className="text-xs text-gray-400 mt-1">Make sure items are set to "active" in Coffee Products.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Bill Workspace (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-2xl border-[#E5D8CF] bg-white shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="bg-[#FAF5F1] border-b border-[#E5D8CF] py-3.5 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-serif text-lg font-bold text-gray-900">Current Coffee Order</CardTitle>
                  <p className="text-[11px] text-gray-500">Bill No: {billNumber}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetBill}
                  className="size-8 rounded-lg hover:bg-red-50 text-red-600 p-0"
                  title="Clear Bill"
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Customer & Dining Table Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#FAF5F1] p-2.5 rounded-xl border border-[#E5D8CF]">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase flex items-center gap-1">
                    <Table2 className="size-3 text-[#808068]" /> Dining Table
                  </label>
                  <select
                    value={selectedTable}
                    onChange={(e) => {
                      const nextT = e.target.value
                      setSelectedTable(nextT)
                      if (nextT !== "Takeaway" && billItems.length > 0) {
                        SharedPosService.occupyTable(nextT, "Coffee Bar", billNumber, grandTotal, customerName)
                      }
                    }}
                    className="h-8 w-full text-xs rounded-lg border border-gray-200 mt-0.5 bg-white px-2 font-medium text-gray-900 outline-none focus:ring-1 focus:ring-[#D67B6B]"
                  >
                    <option value="Takeaway">Takeaway</option>
                    {tables
                      .filter((t) => t.name.toLowerCase() !== "takeaway")
                      .map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name} ({t.status.toUpperCase()})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Customer Name</label>
                  <Input
                    placeholder="Guest Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-8 text-xs rounded-lg border-gray-200 mt-0.5 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Contact / Phone</label>
                  <Input
                    placeholder="Optional"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-8 text-xs rounded-lg border-gray-200 mt-0.5 bg-white"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="min-h-[220px] max-h-[300px] overflow-y-auto divide-y divide-gray-100 pr-1">
                {billItems.length > 0 ? (
                  billItems.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs text-gray-900 truncate">{item.item_name}</p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          {item.size} • Rs. {item.unit_price} each
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="size-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="font-mono font-bold text-xs w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="size-6 rounded-md bg-[#808068] hover:bg-[#6e6e58] flex items-center justify-center text-white"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>

                      <div className="text-right shrink-0 min-w-16">
                        <p className="font-bold text-xs text-gray-900 font-mono">
                          Rs. {item.line_total.toLocaleString()}
                        </p>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-[10px] text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-gray-400">
                    <Receipt className="size-8 mx-auto mb-1.5 opacity-30" />
                    <p className="text-xs">No coffee items selected yet.</p>
                    <p className="text-[10px] text-gray-400">Tap items on the left to add to bill.</p>
                  </div>
                )}
              </div>

              {/* Totals & Adjustments Breakdown */}
              <div className="bg-[#FAF5F1] p-3.5 rounded-xl border border-[#E5D8CF] space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">Rs. {subtotal.toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200">
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium">Discount (Rs.):</label>
                    <Input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="h-7 text-xs rounded-md bg-white border-gray-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium">Tax / VAT (Rs.):</label>
                    <Input
                      type="number"
                      min="0"
                      value={tax}
                      onChange={(e) => setTax(e.target.value)}
                      className="h-7 text-xs rounded-md bg-white border-gray-200 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-gray-200">
                  <span className="font-bold text-sm text-gray-900">Grand Total:</span>
                  <span className="font-mono text-xl font-bold text-[#D67B6B]">
                    Rs. {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase">Payment Method</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all ${
                      paymentMethod === "cash"
                        ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-sm"
                        : "bg-white text-gray-700 border-[#E5D8CF] hover:bg-[#FAF5F1]"
                    }`}
                  >
                    <Banknote className="size-3.5" />
                    Cash
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all ${
                      paymentMethod === "card"
                        ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-sm"
                        : "bg-white text-gray-700 border-[#E5D8CF] hover:bg-[#FAF5F1]"
                    }`}
                  >
                    <CreditCard className="size-3.5" />
                    Card
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("transfer")}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all ${
                      paymentMethod === "transfer"
                        ? "bg-[#D67B6B] text-white border-[#D67B6B] shadow-sm"
                        : "bg-white text-gray-700 border-[#E5D8CF] hover:bg-[#FAF5F1]"
                    }`}
                  >
                    <QrCode className="size-3.5" />
                    QR / Online
                  </button>
                </div>
              </div>

              {/* Cash Received & Change Calculator */}
              {paymentMethod === "cash" && (
                <div className="grid grid-cols-2 gap-2 bg-[#FAF5F1] p-3 rounded-xl border border-[#E5D8CF]">
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase">Cash Received</label>
                    <Input
                      type="number"
                      placeholder="e.g. 2000"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="h-8 text-xs rounded-lg border-gray-200 mt-0.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase">Change Due</label>
                    <div className="h-8 flex items-center px-2 bg-white rounded-lg border border-gray-200 font-mono font-bold text-xs text-[#808068] mt-0.5">
                      Rs. {changeDue.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  onClick={() => handleSaveBill(false)}
                  disabled={billItems.length === 0}
                  className="bg-[#808068] text-white hover:bg-[#6e6e58] rounded-xl h-11 text-xs font-semibold gap-1.5 shadow-sm"
                >
                  <Save className="size-4" />
                  {editingBillId ? "Update Bill" : "Save Bill"}
                </Button>

                <Button
                  onClick={() => handleSaveBill(true)}
                  disabled={billItems.length === 0}
                  className="bg-[#D67B6B] text-white hover:bg-[#c36859] rounded-xl h-11 text-xs font-semibold gap-1.5 shadow-sm"
                >
                  <Printer className="size-4" />
                  Save & Print
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bill History List Modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-3xl rounded-2xl bg-white p-6 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold flex items-center justify-between">
              <span>Coffee Bills History</span>
              <Badge className="bg-[#808068] text-white">{pastBills.length} Bills</Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              View, reprint, edit, or delete past coffee bills. Line items preserve original pricing.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 size-4 text-gray-400" />
              <Input
                placeholder="Search by COF- bill number or customer..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-10 h-10 rounded-xl border-[#E5D8CF] text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border border-[#E5D8CF] rounded-xl divide-y divide-gray-100">
            {filteredPastBills.length > 0 ? (
              filteredPastBills.map((b) => (
                <div key={b.id} className="p-3.5 hover:bg-[#FAF5F1] transition-colors flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#808068]">{b.bill_number}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {b.payment_method}
                      </Badge>
                      <span className="text-[11px] text-gray-400">
                        {new Date(b.bill_date).toLocaleDateString()} {new Date(b.bill_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Customer: <strong>{b.customer_name || "Guest"}</strong> • {b.items.length} item(s)
                    </p>
                    <p className="text-[11px] text-gray-400 truncate max-w-md">
                      {b.items.map((i) => `${i.item_name} x${i.quantity}`).join(", ")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-gray-900 mr-2">
                      Rs. {b.grand_total.toLocaleString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPrintReceiptBill(b)
                        setPrintModalOpen(true)
                      }}
                      className="h-8 rounded-lg text-xs gap-1 border-gray-200"
                      title="Print Bill"
                    >
                      <Printer className="size-3.5" />
                      Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadPastBillForEdit(b)}
                      className="h-8 rounded-lg text-xs gap-1 border-gray-200"
                      title="Edit Bill"
                    >
                      <Edit className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePastBill(b.id)}
                      className="h-8 rounded-lg text-xs text-red-600 hover:bg-red-50 p-1.5"
                      title="Delete Bill"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400 text-xs">No coffee bills found.</div>
            )}
          </div>

          <DialogFooter className="mt-3">
            <Button
              variant="outline"
              onClick={() => setHistoryOpen(false)}
              className="rounded-xl border-[#E5D8CF] text-xs h-10 w-full"
            >
              Close History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printable Thermal Receipt Modal */}
      <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold text-center">Coffee Bill Slip</DialogTitle>
            <DialogDescription className="text-xs text-center text-gray-500">
              Lazy Sunday • Thermal Printer Slip
            </DialogDescription>
          </DialogHeader>

          {printReceiptBill && (
            <div className="py-2">
              <PosReceipt
                receiptNumber={printReceiptBill.bill_number}
                orderNumber={printReceiptBill.bill_number}
                tableName={(printReceiptBill as any).table_name || selectedTable || "Takeaway"}
                cashierName="Coffee Barista"
                orderType={((printReceiptBill as any).table_name || selectedTable) === "Takeaway" ? "takeaway" : "dine_in"}
                paymentMethod={printReceiptBill.payment_method}
                items={printReceiptBill.items.map((i) => ({
                  name: i.item_name,
                  price: i.unit_price,
                  quantity: i.quantity,
                }))}
                subtotal={printReceiptBill.subtotal}
                serviceCharge={printReceiptBill.tax || Math.round(printReceiptBill.subtotal * 0.1)}
                serviceChargeRate={0.1}
                discount={printReceiptBill.discount}
                total={printReceiptBill.grand_total}
                cashReceived={printReceiptBill.grand_total}
                changeAmount={0}
                showBarcode={true}
                onPrintAgain={handlePrintAction}
              />
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-end mt-2">
            <Button
              variant="outline"
              onClick={() => setPrintModalOpen(false)}
              className="rounded-xl border-[#E5D8CF] text-xs h-10"
            >
              Close
            </Button>
            <Button
              onClick={handlePrintAction}
              className="bg-[#D67B6B] text-white hover:bg-[#c36859] rounded-xl text-xs h-10 px-5 gap-1.5 shadow-sm font-bold"
            >
              <Printer className="size-4" />
              Print Thermal Slip (80mm)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
