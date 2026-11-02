"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { SharedPosService } from "@/lib/shared-pos-service"
import { resolveProductImage } from "@/lib/product-images"

type Category = { id: string; name: string; sort_order: number; available_until: string | null }
type Product = { id: string; name: string; description: string; price: number; category_id: string; dietary_tags: string[]; temperature: string; active: boolean; is_archived: boolean; available_until: string | null; category?: string }

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
          supabase.from("pos_products").select("id,name,description,price,category_id,dietary_tags,temperature,active,is_archived,available_until").eq("active", true).eq("is_archived", false).order("sort_order").order("name"),
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
            })
          })
        }
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
    <main className="min-h-screen bg-[#1d2b24] px-4 py-8 text-[#f7f2e7] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 border-b border-[#6c806c]/40 pb-8 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#d5a83b]">Hiriketiya · Sri Lanka</p>
          <h1 className="font-serif text-5xl font-bold tracking-tight text-[#f7f2e7]">LAZY SUNDAY</h1>
          <p className="mt-3 text-sm text-[#b7c6b3]">Good coffee, honest food, slow mornings.</p>
        </header>

        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#789377]/40 bg-[#2b4838] p-5"><p className="text-sm font-semibold text-[#eef4e8]">Add to any drink</p><p className="mt-1 text-xs text-[#b7c6b3]">Oat milk · coconut milk · extra shot</p></div>
          <div className="rounded-2xl border border-[#789377]/40 bg-[#2b4838] p-5"><p className="text-sm font-semibold text-[#eef4e8]">Brewed slow, served cold</p><p className="mt-1 text-xs text-[#b7c6b3]">Ask our team about today&apos;s specials.</p></div>
        </div>

        {loading ? <p className="py-20 text-center text-[#b7c6b3]">Loading today&apos;s menu...</p> : grouped.map(({ category, items }) => (
          <section key={category.id} className="mb-10">
            <div className="mb-4 flex items-end justify-between border-b border-[#6c806c]/30 pb-2"><h2 className="font-serif text-2xl font-bold text-[#f7f2e7]">{category.name}</h2>{cutoffLabel(category.available_until) && <span className="text-xs text-[#d5a83b]">{cutoffLabel(category.available_until)}</span>}</div>
            <div className="space-y-4">{items.map((item) => <article key={item.id} className="flex items-center gap-4 py-2 border-b border-[#6c806c]/15 last:border-b-0">
              <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl bg-[#2b4838] border border-[#789377]/40 shadow-xs">
                <img
                  src={resolveProductImage(item.name, null, category.name)}
                  alt={item.name}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/vibrant-mixed-salad.png";
                  }}
                  className="size-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-semibold text-[#f7f2e7] text-base">{item.name}</h3>
                  <p className="shrink-0 font-semibold text-[#d5a83b]">{money(Number(item.price))}</p>
                </div>
                {item.description && <p className="mt-0.5 text-xs sm:text-sm leading-5 text-[#b7c6b3] line-clamp-2">{item.description}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {item.dietary_tags?.includes("VEG") && <Badge className="border-[#789377] bg-transparent text-[#a9d49d] text-[10px]">VEG</Badge>}
                  {item.temperature !== "none" && <Badge className="border-[#789377]/50 bg-transparent text-[#b7c6b3] text-[10px]">{item.temperature}</Badge>}
                </div>
              </div>
            </article>)}</div>
          </section>
        ))}

        <footer className="border-t border-[#6c806c]/40 pt-6 text-center text-xs text-[#9faf9b]">All prices in Sri Lankan Rupees · subject to 10% service charge</footer>
      </div>
    </main>
  )
}
