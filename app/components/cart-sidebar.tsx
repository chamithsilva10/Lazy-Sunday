"use client"

import { useRouter } from "next/navigation"
import { Minus, Plus, ShoppingCart, Trash2, MoreHorizontal, ReceiptText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useCart } from "../context/cart-context"

export default function CartSidebar() {
  const router = useRouter()
  const { cart, removeFromCart, updateQuantity, cartTotal, itemCount } = useCart()
  const serviceCharge = cartTotal * 0.1

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-[#E5D8CF] bg-[#F4EBE4] xl:w-[360px] xl:border-l xl:border-t-0">
      <div className="flex items-center justify-between border-b border-[#E5D8CF] px-6 py-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#808068]">Current order</p>
          <h2 className="mt-1 font-serif text-xl font-bold text-gray-900">
            Table 04 <span className="font-sans text-xs font-normal text-[#808068]">• Dine in</span>
          </h2>
        </div>
        <Button variant="ghost" size="icon" className="text-[#808068]">
          <MoreHorizontal />
        </Button>
      </div>

      <div className="flex max-h-[330px] flex-1 flex-col gap-4 overflow-y-auto p-6">
        {cart.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-[#FAF5F1] text-[#808068]">
              <ShoppingCart />
            </div>
            <p className="font-semibold text-gray-800">Your order is empty</p>
            <p className="mt-1 text-xs text-gray-500">Tap a menu item to add it</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="flex gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-[#FAF5F1]">
                <img src={item.image || "/placeholder.svg"} alt={item.name} className="size-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="text-sm font-bold text-[#D67B6B]">Rs. {(item.price * item.quantity).toLocaleString()}</p>
                </div>
                <p className="mt-1 text-xs text-gray-500">Rs. {item.price.toLocaleString()} each</p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6 rounded-lg border-[#E5D8CF]"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  >
                    <Minus />
                  </Button>
                  <span className="w-4 text-center text-xs font-semibold">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6 rounded-lg border-[#E5D8CF]"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-6 text-gray-400 hover:text-rose-600"
                    onClick={() => removeFromCart(item.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-[#E5D8CF] p-6 bg-white">
        <div className="mb-5 flex flex-col gap-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>
              Subtotal <span className="text-xs">({itemCount} items)</span>
            </span>
            <span>Rs. {cartTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>
              Service charge <span className="text-xs">(10%)</span>
            </span>
            <span>Rs. {serviceCharge.toLocaleString()}</span>
          </div>
          <Separator className="bg-[#E5D8CF]" />
          <div className="flex justify-between text-lg font-bold text-gray-900">
            <span>Total</span>
            <span className="text-[#D67B6B]">Rs. {(cartTotal + serviceCharge).toLocaleString()}</span>
          </div>
        </div>
        <Button
          className="h-12 w-full rounded-xl bg-[#D67B6B] text-base font-semibold text-white shadow-lg shadow-[#D67B6B]/20 hover:bg-[#c36859]"
          disabled={cart.length === 0}
          onClick={() => router.push("/checkout")}
        >
          <ReceiptText /> Proceed to payment
        </Button>
        <p className="mt-3 text-center text-[11px] text-gray-400">Prices include applicable taxes</p>
      </div>
    </aside>
  )
}
