"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Sparkles, Coffee } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { SharedPosService } from "@/lib/shared-pos-service"
import { resolveProductImage } from "@/lib/product-images"

type Category = { id: string; name: string; sort_order: number; available_until: string | null }
type Product = { id: string; name: string; description: string; price: number; category_id: string; dietary_tags: string[]; temperature: string; active: boolean; is_archived: boolean; available_until: string | null; category?: string; image?: string | null }

function money(price: number) {
  return `Rs. ${Number(price).toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function cutoffLabel(value: string | null) {
  if (!value) return null
  const [hour, minute] = value.split(":").map(Number)
  const suffix = hour >= 12 ? "pm" : "am"
  const displayHour = hour % 12 || 12
  return `Served until ${displayHour}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${suffix}`
}

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      try {
        const [{ data: categoryRows }, { data: productRows }] = await Promise.all([
          supabase.from("pos_categories").select("id,name,sort_order,available_until").eq("is_active", true).order("sort_order"),
          supabase.from("pos_products").select("id,name,description,price,category_id,image,dietary_tags,temperature,active,is_archived,available_until").eq("active", true).eq("is_archived", false).order("sort_order").order("name"),
        ])
        const sharedCats = SharedPosService.getCategories()
        const sharedProds = SharedPosService.getProducts()

        const catMap = new Map<string, Category>()
        sharedCats.forEach((c, idx) => {
          catMap.set(c.name.trim().toLowerCase(), { id: String(c.id), name: c.name, sort_order: c.sort_order ?? idx + 1, available_until: null })
        })
        if (categoryRows && categoryRows.length > 0) {
          categoryRows.forEach((c: any) => {
            const key = c.name.trim().toLowerCase()
            const existing = catMap.get(key)
            catMap.set(key, { id: String(c.id), name: c.name, sort_order: c.sort_order ?? existing?.sort_order ?? 99, available_until: c.available_until ?? existing?.available_until ?? null })
          })
        }
        setCategories(Array.from(catMap.values()).sort((a, b) => a.sort_order - b.sort_order))

        const prodMap = new Map<string, Product>()
        sharedProds.forEach((p) => {
          prodMap.set(p.name.trim().toLowerCase(), {
            id: String(p.id),
            name: p.name,
            description: p.description || "",
            price: Number(p.price),
            category_id: String(p.category_id || p.category),
            category: p.category,
            dietary_tags: p.dietary_tags || [],
            temperature: p.temperature || "none",
            active: p.active !== false,
            is_archived: p.is_archived === true,
            available_until: null,
            image: p.image || null,
          })
        })
        if (productRows && productRows.length > 0) {
          productRows.forEach((p: any) => {
            const key = p.name.trim().toLowerCase()
            const existing = prodMap.get(key)
            prodMap.set(key, {
              id: String(p.id),
              name: p.name,
              description: p.description || existing?.description || "",
              price: Number(p.price ?? existing?.price ?? 0),
              category_id: String(p.category_id || existing?.category_id || p.category || "General"),
              category: p.category || existing?.category || "General",
              dietary_tags: p.dietary_tags || existing?.dietary_tags || [],
              temperature: p.temperature || existing?.temperature || "none",
              active: p.active !== false,
              is_archived: p.is_archived === true,
              available_until: p.available_until ?? existing?.available_until ?? null,
              image: p.image || existing?.image || null,
            })
          })
        }

        // Direct API overlay for authoritative demo SQLite or backend data
        try {
          const apiRes = await fetch("/api/products")
          if (apiRes.ok) {
            const apiJson = await apiRes.json()
            if (Array.isArray(apiJson?.products)) {
              apiJson.products.forEach((p: any) => {
                const key = p.name.trim().toLowerCase()
                const existing = prodMap.get(key)
                prodMap.set(key, {
                  id: String(p.id),
                  name: p.name,
                  description: p.description || existing?.description || "",
                  price: Number(p.price != null ? p.price : (existing?.price ?? 0)),
                  category_id: String(p.category_id || existing?.category_id || "General"),
                  category: p.category || p.category_name || existing?.category || "General",
                  dietary_tags: Array.isArray(p.dietary_tags) ? p.dietary_tags : (existing?.dietary_tags || []),
                  temperature: p.temperature || existing?.temperature || "none",
                  active: p.active !== false && p.is_active !== false,
                  is_archived: p.is_archived === true,
                  available_until: p.available_until ?? existing?.available_until ?? null,
                  image: p.image || existing?.image || null,
                })
              })
            }
          }
        } catch {}

        setProducts(Array.from(prodMap.values()).filter((p) => p.active && !p.is_archived))
      } catch {
        const sharedCats = SharedPosService.getCategories()
        const sharedProds = SharedPosService.getProducts()
        setCategories(sharedCats.map((c, idx) => ({ id: String(c.id), name: c.name, sort_order: idx + 1, available_until: null })))
        setProducts(sharedProds.map((p) => ({
          id: String(p.id),
          name: p.name,
          description: p.description || "",
          price: Number(p.price),
          category_id: String(p.category_id || p.category),
          category: p.category,
          dietary_tags: p.dietary_tags || [],
          temperature: p.temperature || "none",
          active: true,
          is_archived: false,
          available_until: null,
          image: p.image || null,
        })))
      } finally {
        setLoading(false)
      }
    }
    void load()

    let menuTimer: any = null
    const onRealtime = () => {
      if (menuTimer) clearTimeout(menuTimer)
      menuTimer = setTimeout(() => void load(), 200)
    }
    window.addEventListener("pos_realtime_sync", onRealtime)
    window.addEventListener("pos_products_updated", onRealtime)
    window.addEventListener("pos_categories_updated", onRealtime)
    window.addEventListener("focus", onRealtime)

    const unsubP = SharedPosService.subscribeProducts(() => onRealtime())
    const unsubC = SharedPosService.subscribeCategories(() => onRealtime())

    let channel: any
    try {
      channel = supabase.channel("pos-demo-public-menu")
        .on("postgres_changes", { event: "*", schema: "public", table: "pos_products" }, onRealtime)
        .on("postgres_changes", { event: "*", schema: "public", table: "pos_categories" }, onRealtime)
        .subscribe()
    } catch {
      // realtime fallback
    }

    return () => {
      if (menuTimer) clearTimeout(menuTimer)
      window.removeEventListener("pos_realtime_sync", onRealtime)
      window.removeEventListener("pos_products_updated", onRealtime)
      window.removeEventListener("pos_categories_updated", onRealtime)
      window.removeEventListener("focus", onRealtime)
      unsubP()
      unsubC()
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  const grouped = useMemo(() => {
    const catMap = new Map<string, Category>()
    categories.forEach((c) => catMap.set(c.name.trim().toLowerCase(), c))

    // Ensure any categories appearing on products are accounted for
    products.forEach((p) => {
      const catName = (p.category || "General").trim()
      const key = catName.toLowerCase()
      if (!catMap.has(key)) {
        catMap.set(key, { id: `cat-${key}`, name: catName, sort_order: 99, available_until: null })
      }
    })

    const allCategories = Array.from(catMap.values()).sort((a, b) => a.sort_order - b.sort_order)

    return allCategories
      .map((category) => {
        const catKey = category.name.trim().toLowerCase()
        return {
          category,
          items: products.filter(
            (product) =>
              product.category_id === category.id ||
              (product.category && product.category.trim().toLowerCase() === catKey) ||
              String(product.category_id).toLowerCase() === catKey
          ),
        }
      })
      .filter((group) => group.items.length > 0)
  }, [categories, products])

  return (
    <main className="min-h-screen bg-[#F4EBE4] px-4 py-6 sm:py-10 text-[#343428] sm:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Navigation Bar */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#808068] hover:text-[#D67B6B] bg-white border border-[#E5D8CF] px-3 py-1.5 rounded-xl shadow-xs transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to POS
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#808068] bg-[#FAF5F1] px-3 py-1 rounded-full border border-[#E5D8CF]">
            <Coffee className="size-3.5 text-[#D67B6B]" />
            <span>Digital Guest Menu</span>
          </div>
        </div>

        <header className="mb-8 border-b border-[#E5D8CF] pb-8 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-[#808068]">Hiriketiya · Sri Lanka</p>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-[#343428]">LAZY SUNDAY</h1>
          <p className="mt-2 text-sm text-[#808068]">Good coffee, honest food, slow mornings.</p>
        </header>

        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#E5D8CF] bg-white p-4 sm:p-5 shadow-xs">
            <p className="text-sm font-semibold text-[#343428] flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-[#D67B6B]" />
              Add to any drink
            </p>
            <p className="mt-1 text-xs text-[#808068]">Oat milk · coconut milk · extra espresso shot</p>
          </div>
          <div className="rounded-2xl border border-[#E5D8CF] bg-white p-4 sm:p-5 shadow-xs">
            <p className="text-sm font-semibold text-[#343428] flex items-center gap-1.5">
              <Coffee className="size-3.5 text-[#D67B6B]" />
              Brewed slow, served cold
            </p>
            <p className="mt-1 text-xs text-[#808068]">Ask our team about today&apos;s special origin roasts.</p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#808068] font-medium">Loading today&apos;s menu...</div>
        ) : grouped.length === 0 ? (
          <div className="py-20 text-center text-[#808068] bg-white rounded-3xl border border-[#E5D8CF] p-8">
            <Coffee className="size-10 mx-auto mb-3 text-[#D67B6B]/40" />
            <p className="font-serif text-xl font-bold text-[#343428]">Menu is Empty</p>
            <p className="text-xs text-[#808068] mt-1 max-w-sm mx-auto">No products are currently published in the catalog.</p>
          </div>
        ) : (
          grouped.map(({ category, items }) => (
            <section key={category.id} className="mb-8">
              <div className="mb-4 flex items-end justify-between border-b border-[#E5D8CF] pb-2">
                <h2 className="font-serif text-2xl font-bold text-[#343428]">{category.name}</h2>
                {cutoffLabel(category.available_until) && (
                  <span className="text-xs font-semibold text-[#D67B6B]">{cutoffLabel(category.available_until)}</span>
                )}
              </div>
              <div className="space-y-3">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="flex items-center gap-3.5 sm:gap-4 p-3 sm:p-3.5 rounded-2xl bg-white border border-[#E5D8CF] shadow-xs hover:border-[#EAB8B5] transition-all"
                  >
                    <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl bg-[#FAF5F1] border border-[#E5D8CF] shadow-2xs">
                      <img
                        src={resolveProductImage(item.name, item.image, category.name)}
                        alt={item.name}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = "/placeholder.svg"
                        }}
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base leading-snug">{item.name}</h3>
                        <p className="shrink-0 font-bold font-mono text-[#D67B6B] text-sm sm:text-base">
                          {money(Number(item.price))}
                        </p>
                      </div>
                      {item.description && (
                        <p className="mt-0.5 text-xs sm:text-sm leading-5 text-gray-600 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.dietary_tags?.includes("VEG") && (
                          <Badge className="border-[#EAB8B5] bg-[#FAF5F1] text-[#808068] text-[10px] font-semibold">
                            🌱 VEG
                          </Badge>
                        )}
                        {item.temperature !== "none" && (
                          <Badge className="border-[#E5D8CF] bg-[#FAF5F1] text-[#808068] text-[10px]">
                            {item.temperature}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}

        <footer className="border-t border-[#E5D8CF] pt-6 text-center text-xs text-[#808068]">
          All prices in Sri Lankan Rupees (Rs.) · subject to 10% service charge
        </footer>
      </div>
    </main>
  )
}
