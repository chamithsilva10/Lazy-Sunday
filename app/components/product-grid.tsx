"use client"

import { useMemo, useState, useEffect } from "react"
import Image from "next/image"
import { Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "../context/cart-context"
import { SharedPosService, type SharedProduct } from "@/lib/shared-pos-service"
import { products as fallbackProducts } from "../data/products"

interface ProductGridProps {
  category: string
  searchQuery: string
  mode?: "restaurant" | "coffee"
  products?: any[]
}

export default function ProductGrid({ category, searchQuery, mode = "restaurant", products: propProducts }: ProductGridProps) {
  const { addToCart } = useCart()
  const [sharedProducts, setSharedProducts] = useState<any[]>(() => {
    if (propProducts && propProducts.length > 0) return propProducts
    const s = SharedPosService.getProducts()
    return s.length > 0 ? s : fallbackProducts
  })

  useEffect(() => {
    if (propProducts && propProducts.length > 0) {
      setSharedProducts(propProducts)
      return
    }
    const unsub = SharedPosService.subscribeProducts((prods) => {
      if (prods.length > 0) setSharedProducts(prods)
    })
    return () => unsub()
  }, [propProducts])

  const activeProducts = propProducts && propProducts.length > 0 ? propProducts : sharedProducts

  const filteredProducts = useMemo(() => {
    return activeProducts.filter((product) => {
      const matchesCat =
        category === "all" ||
        category === "All" ||
        product.category === category ||
        (product.category && product.category.toLowerCase() === category.toLowerCase())
      const matchesSearch = (product.name || "").toLowerCase().includes((searchQuery || "").toLowerCase())
      return matchesCat && matchesSearch
    })
  }, [activeProducts, category, searchQuery])

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-4">
      {filteredProducts.map((product) => (
        <Card
          key={product.id}
          onClick={() => addToCart(product)}
          className="group cursor-pointer overflow-hidden rounded-2xl border-[#e4e6dc] bg-white shadow-none transition-all hover:-translate-y-1 hover:border-[#b5c9a6] hover:shadow-lg"
        >
          <div className="relative aspect-[1.15] overflow-hidden bg-[#eef2e9]">
            <Image
              src={product.image || "/placeholder.svg"}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-xl bg-white text-[#2f6047] opacity-0 shadow-md transition-opacity group-hover:opacity-100">
              <Plus />
            </div>
          </div>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-[#2c3d33]">{product.name}</h3>
                <p className="mt-1 text-xs text-[#88928a]">{product.description || "Freshly prepared"}</p>
              </div>
              <p className="shrink-0 text-sm font-bold text-[#2f6047]">
                Rs. {Number(product.price).toLocaleString()}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#79916c]">
              <span className="rounded-full bg-[#edf5e7] px-2 py-1">
                {mode === "coffee" ? "Bar" : "Available"}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
      {filteredProducts.length === 0 && (
        <div className="col-span-full rounded-2xl border border-dashed border-[#d9ded5] py-16 text-center text-sm text-[#7f897f]">
          No items found in this category
        </div>
      )}
    </div>
  )
}
