import React from "react"
import Link from "next/link"
import { Coffee, ArrowLeft } from "lucide-react"

export default function CoffeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4EBE4] text-gray-900">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E5D8CF] bg-[#FAF5F1] px-4 sm:px-8 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#D67B6B] bg-white border border-[#E5D8CF] px-3 py-1.5 rounded-xl transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to POS
          </Link>
          <div className="h-4 w-px bg-gray-300 mx-1" />
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#808068] text-white">
              <Coffee className="size-4" />
            </div>
            <div>
              <p className="font-serif text-sm font-bold leading-tight">LAZY SUNDAY</p>
              <p className="text-[9px] uppercase tracking-wider text-gray-500">Coffee & Bar Menu</p>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/coffee/bill"
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-gray-700 hover:bg-[#FAF5F1] transition-colors"
          >
            Coffee Bill
          </Link>
          <Link
            href="/coffee/report"
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-gray-700 hover:bg-[#FAF5F1] transition-colors"
          >
            Coffee Report
          </Link>
          <Link
            href="/coffee/products"
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            Products (Admin)
          </Link>
        </nav>
      </header>

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">{children}</main>
    </div>
  )
}
