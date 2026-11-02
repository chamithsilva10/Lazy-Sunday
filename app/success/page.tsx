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

  const [receiptNumber] = useState(() => `CFJ-RC-${Math.floor(100000 + Math.random() * 900000)}`)
  const [orderNumber] = useState(() => `CFJ-${Math.floor(100000 + Math.random() * 900000)}`)

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
      cashier_name: "System Administrator",
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
    <div className="container mx-auto max-w-md px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EBE4] text-[#808068] mb-2">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-black">Payment Successful</h1>
        <p className="text-xs text-gray-500">Receipt generated and settled</p>
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
          className="w-full bg-[#D67B6B] hover:bg-[#c36859] text-white font-bold h-11 rounded-xl gap-2 shadow-sm"
        >
          <Printer className="size-4" />
          Print Thermal Receipt (80mm)
        </Button>
        <Button
          onClick={handleBackToPOS}
          variant="outline"
          className="w-full border-gray-300 font-semibold h-11 rounded-xl gap-2"
        >
          <ShoppingBag className="size-4" />
          Back to POS
        </Button>
      </div>
    </div>
  )
}
