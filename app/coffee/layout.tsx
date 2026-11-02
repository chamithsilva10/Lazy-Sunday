"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Coffee, ArrowLeft } from "lucide-react"

export default function CoffeeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const navItems = [
    { label: "Coffee Bill", href: "/coffee/bill" },
    { label: "Coffee Report", href: "/coffee/report" },
    { label: "Products (Admin)", href: "/coffee/products" },
  ]

  return (
    <div className="min-h-screen bg-[#F4EBE4] text-[#343428]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E5D8CF] bg-[#FAF5F1] px-4 sm:px-8 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#808068] hover:text-[#D67B6B] bg-white border border-[#E5D8CF] px-3 py-1.5 rounded-xl shadow-xs transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to POS
          </Link>
          <div className="h-4 w-px bg-[#E5D8CF] mx-1" />
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-[#808068] text-white shadow-xs">
              <Coffee className="size-4" />
            </div>
            <div>
              <p className="font-serif text-sm font-bold leading-tight text-gray-900">LAZY SUNDAY</p>
              <p className="text-[9px] uppercase tracking-wider text-[#808068]">Coffee &amp; Bar Station</p>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#D67B6B] text-white shadow-xs"
                    : "text-[#808068] hover:bg-white hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">{children}</main>
    </div>
  )
}
