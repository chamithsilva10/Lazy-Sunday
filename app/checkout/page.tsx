"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CreditCard, Wallet, ShoppingBag, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useCart } from "../context/cart-context"

export default function CheckoutPage() {
  const router = useRouter()
  const { cart, cartTotal, clearCart } = useCart()
  const [paymentMethod, setPaymentMethod] = useState("card")

  const serviceCharge = cartTotal * 0.1
  const grandTotal = cartTotal + serviceCharge

  const handlePayment = () => {
    router.push("/success")
  }

  if (cart.length === 0) {
    return (
      <main className="min-h-screen bg-[#F4EBE4] flex items-center justify-center p-4 text-[#343428]">
        <div className="text-center max-w-sm rounded-2xl bg-white border border-[#E5D8CF] p-8 shadow-xs">
          <div className="size-12 rounded-full bg-[#FAF5F1] text-[#808068] mx-auto flex items-center justify-center mb-4 border border-[#E5D8CF]">
            <ShoppingBag className="size-6" />
          </div>
          <h1 className="text-xl font-bold font-serif text-gray-900">Your cart is empty</h1>
          <p className="mt-2 text-xs text-[#808068]">Add items from the Lazy Sunday POS register before checkout.</p>
          <Button
            className="mt-5 w-full bg-[#D67B6B] hover:bg-[#c26555] text-white font-semibold rounded-xl h-10 shadow-xs"
            onClick={() => router.push("/")}
          >
            Return to POS
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F4EBE4] text-[#343428] px-4 py-6 sm:py-10">
      <div className="container mx-auto max-w-4xl">
        <Button
          variant="outline"
          className="mb-6 rounded-xl border-[#E5D8CF] bg-white text-xs font-semibold text-[#808068] hover:text-[#D67B6B] hover:bg-[#FAF5F1]"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back to POS
        </Button>

        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#808068]">Lazy Sunday Hiriketiya</p>
          <h1 className="font-serif text-3xl font-bold text-gray-900 mt-1">Settle &amp; Checkout</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2 items-start">
          {/* ORDER SUMMARY */}
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#808068]">Order Summary</h2>
            <div className="rounded-2xl border border-[#E5D8CF] p-5 bg-white shadow-xs">
              <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex justify-between items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                      <p className="text-xs text-[#808068]">
                        Rs. {Number(item.price).toLocaleString()} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-mono font-bold text-sm text-gray-900 shrink-0">
                      Rs. {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <Separator className="my-4 bg-[#E5D8CF]" />

              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium text-gray-900">Rs. {cartTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Charge (10%)</span>
                  <span className="font-mono font-medium text-gray-900">Rs. {serviceCharge.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100 font-bold text-sm text-gray-900">
                  <span>Grand Total</span>
                  <span className="font-mono text-base font-extrabold text-[#D67B6B]">
                    Rs. {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PAYMENT METHOD */}
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#808068]">Payment Method</h2>
            <div className="rounded-2xl border border-[#E5D8CF] p-5 bg-white shadow-xs">
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                <label
                  htmlFor="card"
                  className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition-all ${
                    paymentMethod === "card"
                      ? "border-[#D67B6B] bg-[#FAF5F1] shadow-2xs"
                      : "border-[#E5D8CF] bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="card" id="card" />
                    <span className="flex items-center text-xs font-semibold text-gray-800">
                      <CreditCard className="mr-2 h-4 w-4 text-[#808068]" />
                      Credit / Debit Card
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#808068] uppercase">Visa / Master</span>
                </label>

                <label
                  htmlFor="cash"
                  className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition-all ${
                    paymentMethod === "cash"
                      ? "border-[#D67B6B] bg-[#FAF5F1] shadow-2xs"
                      : "border-[#E5D8CF] bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="cash" id="cash" />
                    <span className="flex items-center text-xs font-semibold text-gray-800">
                      <Wallet className="mr-2 h-4 w-4 text-[#808068]" />
                      Cash Tendered
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#808068] uppercase">LKR Cash</span>
                </label>
              </RadioGroup>

              <div className="mt-4 p-3 rounded-xl bg-[#FAF5F1] border border-[#E5D8CF] flex items-center gap-2 text-[11px] text-[#808068]">
                <ShieldCheck className="size-4 text-[#808068] shrink-0" />
                <span>Instant fiscal settlement &amp; automated receipt dispatch</span>
              </div>

              <Button
                className="mt-5 w-full bg-[#D67B6B] hover:bg-[#c26555] text-white font-bold h-11 rounded-xl text-sm shadow-xs gap-2"
                onClick={handlePayment}
              >
                Complete Payment (Rs. {grandTotal.toLocaleString()})
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
