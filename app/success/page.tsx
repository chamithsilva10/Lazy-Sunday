"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Printer, ShoppingBag } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PosReceipt } from "@/components/ui/pos-receipt"
import { printThermalReceiptDoc } from "@/lib/thermal-printer"
import { useCart } from "../context/cart-context"

export default function SuccessPage() {
  const router = useRouter()
  const { cart, cartTotal, clearCart } = useCart()

  const [receiptNumber] = useState(() => `LS-RC-${Math.floor(100000 + Math.random() * 900000)}`)
  const [orderNumber] = useState(() => `LS-${Math.floor(100000 + Math.random() * 900000)}`)

  const serviceCharge = cartTotal * 0.1
  const grandTotal = cartTotal + serviceCharge

  useEffect(() => {
    // If there's no cart data, redirect to POS
    if (cart.length === 0) {
      router.push("/")
    }
  }, [cart, router])

  const handleBackToPOS = () => {
    clearCart()
    router.push("/")
  }

  const handlePrint = () => {
    printThermalReceiptDoc({
      order_number: orderNumber,
      receipt_number: receiptNumber,
      table_name: "Takeaway",
      cashier_name: "Alexa Pheloung",
      items: cart.map((i) => ({
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      subtotal: cartTotal,
      service_charge: serviceCharge,
      service_charge_rate: 0.1,
      discount: 0,
      total: grandTotal,
      payment_method: "cash",
      cash_received: grandTotal,
      change_amount: 0,
      order_type: "takeaway",
      created_at: new Date().toISOString(),
    }, false)
  }

  if (cart.length === 0) {
    return null
  }

  return (
    <main className="min-h-screen bg-[#F4EBE4] py-6 sm:py-10 px-4">
      <div className="container mx-auto max-w-md">
        <div className="mb-5 flex flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#808068] mb-2 shadow-xs border border-[#E5D8CF]">
            <Check className="h-6 w-6 text-[#D67B6B]" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-[#808068]">Lazy Sunday POS</p>
          <h1 className="text-2xl font-bold font-serif text-gray-900 mt-1">Payment Successful</h1>
          <p className="text-xs text-[#808068]">Order settled and thermal receipt generated</p>
        </div>

        <PosReceipt
          receiptNumber={receiptNumber}
          orderNumber={orderNumber}
          tableName="Takeaway"
          cashierName="Alexa Pheloung"
          orderType="takeaway"
          paymentMethod="CASH"
          items={cart.map((i) => ({
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          }))}
          subtotal={cartTotal}
          serviceCharge={serviceCharge}
          serviceChargeRate={0.1}
          discount={0}
          total={grandTotal}
          cashReceived={grandTotal}
          changeAmount={0}
          showBarcode={true}
          onPrintAgain={handlePrint}
        />

        <div className="mt-5 flex flex-col gap-2.5 print:hidden">
          <Button
            onClick={handlePrint}
            className="w-full bg-[#D67B6B] hover:bg-[#c26555] text-white font-bold h-11 rounded-xl gap-2 shadow-xs"
          >
            <Printer className="size-4" />
            Print Thermal Receipt (80mm)
          </Button>
          <Button
            onClick={handleBackToPOS}
            variant="outline"
            className="w-full border-[#E5D8CF] bg-white text-[#808068] hover:text-[#D67B6B] hover:bg-[#FAF5F1] font-semibold h-11 rounded-xl gap-2 shadow-xs"
          >
            <ShoppingBag className="size-4" />
            Back to POS
          </Button>
        </div>
      </div>
    </main>
  )
}
