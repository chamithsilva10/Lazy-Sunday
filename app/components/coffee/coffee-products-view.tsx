"use client"

import { useState, useEffect, useMemo } from "react"
import { Coffee, Plus, Search, Edit2, Trash2, ShieldAlert, Camera, Upload, CheckCircle2, XCircle, ArrowUpDown, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { CoffeeProduct, CoffeeStatus } from "@/lib/coffee/types"
import { CoffeeStorageService } from "@/lib/coffee/storage"
import { SharedPosService } from "@/lib/shared-pos-service"
import { compressImageFile } from "@/lib/image-compress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { normalizeRole } from "@/lib/rbac/permissions"

interface CoffeeProductsViewProps {
  role?: string
}

export function CoffeeProductsView({ role }: CoffeeProductsViewProps) {
  const [products, setProducts] = useState<CoffeeProduct[]>(() => CoffeeStorageService.getCachedProducts())
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("All")
  const isAdmin = normalizeRole(role) === "admin"

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<CoffeeProduct | null>(null)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  async function handleImageFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // 1. Client-side compress down to max 480x480 (~20-30KB) to prevent 413 Content Too Large
      const { dataUrl, blob } = await compressImageFile(file, 480, 0.8)
      setFormData((f) => ({ ...f, image_url: dataUrl }))

      try {
        const data = new FormData()
        data.append("file", blob, file.name.replace(/\.[^/.]+$/, ".jpg"))
        const res = await fetch("/api/upload", {
          method: "POST",
          body: data,
        })
        if (res.ok) {
          const json = await res.json().catch(() => ({}))
          if (json?.success && json?.url) {
            setFormData((f) => ({ ...f, image_url: json.url }))
            toast.success("Photo uploaded successfully")
          } else {
            toast.info("Photo loaded")
          }
        } else {
          toast.info("Photo loaded")
        }
      } catch {
        toast.info("Photo loaded")
      }
    } catch (compressErr) {
      console.warn("Coffee image compression failed", compressErr)
      toast.error("Failed to process image file")
    }
  }

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    category: "Milk Coffee",
    size: "Regular",
    price: "",
    image_url: "/latte-coffee.png",
    status: "active" as CoffeeStatus,
  })

  // Load products
  async function loadProducts() {
    try {
      const response = await fetch("/api/coffee/products", { cache: "no-store" })
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data.products)) {
          setProducts(data.products)
          CoffeeStorageService.saveLocalProducts(data.products)
          return
        }
      }
    } catch {
      // Keep existing cached products - never wipe out
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProducts()

    const onLocalUpdate = (e: any) => {
      if (Array.isArray(e.detail) && e.detail.length > 0) {
        setProducts(e.detail)
      }
    }
    window.addEventListener("coffee_products_updated", onLocalUpdate)

    const supabase = createClient()
    const channel = supabase
      .channel("coffee-products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coffee_products" },
        () => void loadProducts(),
      )
      .subscribe()

    return () => {
      window.removeEventListener("coffee_products_updated", onLocalUpdate)
      void supabase.removeChannel(channel)
    }
  }, [])

  // Categories list
  const categories = useMemo(() => {
    const list = ["All", ...Array.from(new Set(products.map((p) => p.category)))]
    return list
  }, [products])

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.size && p.size.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCat = categoryFilter === "All" || p.category === categoryFilter
      return matchesSearch && matchesCat
    })
  }, [products, searchQuery, categoryFilter])

  // Paginated items
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage))
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(start, start + itemsPerPage)
  }, [filteredProducts, currentPage])

  // Open Add Dialog
  function handleOpenAdd() {
    setEditingProduct(null)
    setFormData({
      name: "",
      category: "Milk Coffee",
      size: "Regular",
      price: "",
      image_url: "/latte-coffee.png",
      status: "active",
    })
    setDialogOpen(true)
  }

  // Open Edit Dialog
  function handleOpenEdit(product: CoffeeProduct) {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      category: product.category,
      size: product.size || "Regular",
      price: String(product.price),
      image_url: product.image_url || "/latte-coffee.png",
      status: product.status,
    })
    setDialogOpen(true)
  }

  // Save (Create or Update) with backend API call and optimistic local storage sync
  async function handleSaveProduct() {
    if (!formData.name.trim()) {
      toast.error("Please enter a coffee name")
      return
    }
    const priceNum = parseFloat(formData.price)
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Please enter a valid price greater than 0")
      return
    }

    try {
      if (editingProduct) {
        const updated = products.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                name: formData.name.trim(),
                category: formData.category,
                size: formData.size,
                price: priceNum,
                image_url: formData.image_url,
                status: formData.status,
                updated_at: new Date().toISOString(),
              }
            : p
        )
        setProducts(updated)
        CoffeeStorageService.saveLocalProducts(updated)

        // Sync with SharedPosService so POS & Catalog views update immediately
        SharedPosService.saveProduct({
          id: editingProduct.id,
          name: formData.name.trim(),
          category: formData.category,
          price: priceNum,
          image: formData.image_url,
          department: "Coffee Bar",
          station: "bar",
          active: formData.status === "active",
        })
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("pos_products_updated"))
        }

        // Call API endpoint in background
        void fetch(`/api/coffee/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            category: formData.category,
            size: formData.size,
            price: priceNum,
            image_url: formData.image_url,
            status: formData.status,
          }),
        })

        toast.success(`Updated "${formData.name}" successfully`)
      } else {
        const newProduct: CoffeeProduct = {
          id: "cof-" + Date.now(),
          name: formData.name.trim(),
          category: formData.category,
          size: formData.size,
          price: priceNum,
          image_url: formData.image_url,
          status: formData.status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        const updated = [newProduct, ...products]
        setProducts(updated)
        CoffeeStorageService.saveLocalProducts(updated)

        // Sync with SharedPosService
        SharedPosService.saveProduct({
          id: newProduct.id,
          name: formData.name.trim(),
          category: formData.category,
          price: priceNum,
          image: formData.image_url,
          department: "Coffee Bar",
          station: "bar",
          active: formData.status === "active",
        })
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("pos_products_updated"))
        }

        // Call API endpoint in background
        void fetch("/api/coffee/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            category: formData.category,
            size: formData.size,
            price: priceNum,
            image_url: formData.image_url,
            status: formData.status,
          }),
        })

        toast.success(`Added "${formData.name}" to Coffee catalog`)
      }

      setDialogOpen(false)
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred")
    }
  }

  // Toggle status
  async function handleToggleStatus(product: CoffeeProduct) {
    if (!isAdmin) return
    const newStatus: CoffeeStatus = product.status === "active" ? "inactive" : "active"
    const updated = products.map((p) => (p.id === product.id ? { ...p, status: newStatus } : p))
    setProducts(updated)
    CoffeeStorageService.saveLocalProducts(updated)
    SharedPosService.saveProduct({
      id: product.id,
      name: product.name,
      price: product.price,
      active: newStatus === "active",
      department: "Coffee Bar",
      station: "bar",
    })
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos_products_updated"))
    }
    try {
      void fetch(`/api/coffee/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      toast.success(`${product.name} is now ${newStatus}`)
    } catch {
      toast.error("Failed to toggle status")
    }
  }

  // Delete product
  async function handleDeleteProduct(id: string) {
    if (!isAdmin) return
    const updated = products.filter((p) => p.id !== id)
    setProducts(updated)
    CoffeeStorageService.saveLocalProducts(updated)
    SharedPosService.deleteProduct(id)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos_products_updated"))
    }
    setDeleteConfirmId(null)
    toast.success("Coffee product removed")
    try {
      void fetch(`/api/coffee/products/${id}`, { method: "DELETE" })
    } catch {
      // Ignored
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E5D8CF] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#808068] text-white shadow-sm">
            <Coffee className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl font-bold text-gray-900">Coffee Products</h2>
              <Badge className={isAdmin ? "bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-semibold" : "bg-[#FAF5F1] text-[#808068] border-[#E5D8CF] text-[10px] font-semibold"}>
                {isAdmin ? "Admin Console" : "Staff View"}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage coffee kinds, categories, sizes, pricing, and active status.
            </p>
          </div>
        </div>

        {isAdmin && (
          <Button
            onClick={handleOpenAdd}
            className="bg-[#D67B6B] text-white hover:bg-[#c36859] gap-2 rounded-xl h-11 px-4 shadow-sm w-full sm:w-auto"
          >
            <Plus className="size-4" />
            Add Coffee Product
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card className="rounded-2xl border-[#E5D8CF] bg-white p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 size-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, category, or size..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-10 h-10 rounded-xl border-[#E5D8CF] text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={categoryFilter === cat ? "default" : "outline"}
                onClick={() => {
                  setCategoryFilter(cat)
                  setCurrentPage(1)
                }}
                className={`rounded-xl text-xs h-8 px-3 shrink-0 ${
                  categoryFilter === cat ? "bg-[#D67B6B] text-white" : "border-[#E5D8CF] text-gray-600 hover:bg-[#FAF5F1]"
                }`}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Paginated Products List */}
      <Card className="rounded-2xl border-[#E5D8CF] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#FAF5F1] border-b border-[#E5D8CF] text-gray-600 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Coffee Item</th>
                <th className="py-3 px-4">Kind / Category</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4EBE4]">
              {paginatedProducts.length > 0 ? (
                paginatedProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAF5F1] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image_url || "/latte-coffee.png"}
                          alt={p.name}
                          className="size-10 rounded-xl object-cover border border-gray-200 bg-[#FAF5F1] shrink-0"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src = "/latte-coffee.png"
                          }}
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{p.name}</p>
                          <p className="text-[11px] text-gray-500 font-mono">ID: {p.id.substring(0, 10)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="rounded-lg bg-gray-50 text-gray-700 border-gray-200">
                        {p.category}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-700">{p.size || "Regular"}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#D67B6B] font-mono text-sm">
                        Rs. {p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleStatus(p)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                          p.status === "active"
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                        title="Click to toggle active/inactive"
                      >
                        {p.status === "active" ? (
                          <>
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="size-3 text-gray-400" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(p)}
                            className="size-8 rounded-lg hover:bg-gray-100 text-gray-600"
                            title="Edit Product"
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmId(p.id)}
                            className="size-8 rounded-lg hover:bg-red-50 text-red-600"
                            title="Delete Product"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium">View only</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <Coffee className="size-10 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No coffee products found matching your search.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-[#E5D8CF] bg-[#FAF5F1] text-xs text-gray-600">
          <p>
            Showing <strong>{filteredProducts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to{" "}
            <strong>{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</strong> of{" "}
            <strong>{filteredProducts.length}</strong> items
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 rounded-lg border-[#E5D8CF] text-xs"
            >
              <ChevronLeft className="size-3.5 mr-1" />
              Previous
            </Button>
            <span className="px-3 py-1 bg-white border border-[#E5D8CF] rounded-lg font-mono font-semibold">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 rounded-lg border-[#E5D8CF] text-xs"
            >
              Next
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Add / Edit Coffee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold">
              {editingProduct ? "Edit Coffee Product" : "Add New Coffee Kind"}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Only active coffee products will appear in the Coffee Bill item picker.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Coffee Name *</Label>
              <Input
                placeholder="e.g. Espresso, Latte, Cappuccino, Flat White"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 h-10 rounded-xl border-[#E5D8CF] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Category / Kind</Label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-[#E5D8CF] px-3 text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D67B6B]"
                >
                  <option value="Espresso">Espresso</option>
                  <option value="Milk Coffee">Milk Coffee</option>
                  <option value="Black Coffee">Black Coffee</option>
                  <option value="Cold Coffee">Cold Coffee</option>
                  <option value="Specialty">Specialty</option>
                  <option value="Blended">Blended</option>
                  <option value="Manual Brew">Manual Brew</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Serving Size</Label>
                <select
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-[#E5D8CF] px-3 text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D67B6B]"
                >
                  <option value="Single">Single</option>
                  <option value="Double">Double</option>
                  <option value="Regular">Regular (8oz)</option>
                  <option value="Large">Large (12oz)</option>
                  <option value="Jumbo">Jumbo (16oz)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Price (Rs.) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="850.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="mt-1 h-10 rounded-xl border-[#E5D8CF] font-mono text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Initial Status</Label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as CoffeeStatus })}
                  className="mt-1 h-10 w-full rounded-xl border border-[#E5D8CF] px-3 text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D67B6B]"
                >
                  <option value="active">Active (Visible in Bill)</option>
                  <option value="inactive">Inactive (Hidden)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-700">Product Photo</Label>
                {formData.image_url && (
                  <button
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, image_url: "" }))}
                    className="text-[11px] text-red-500 hover:text-red-700 font-semibold"
                  >
                    Clear photo
                  </button>
                )}
              </div>

              {formData.image_url ? (
                <div className="relative group rounded-xl overflow-hidden border border-[#E5D8CF] bg-[#FAF5F1] aspect-[16/9] max-h-36 flex items-center justify-center">
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/latte-coffee.png"
                    }}
                  />
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <label className="cursor-pointer bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-100 flex items-center gap-1.5">
                      <Upload className="size-3.5" />
                      Replace
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileUpload}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-[#E5D8CF] hover:border-[#D67B6B] bg-[#FAF5F1]/60 hover:bg-[#FAF5F1] rounded-xl cursor-pointer transition-colors text-center group">
                  <Camera className="size-5 text-[#D67B6B] mb-1" />
                  <span className="text-xs font-bold text-gray-700">Upload Photo</span>
                  <span className="text-[10px] text-gray-400">Choose from device or camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImageFileUpload}
                  />
                </label>
              )}

              <Input
                placeholder="Or paste image URL (https://... or /uploads/...)"
                value={formData.image_url}
                onChange={(e) => setFormData((f) => ({ ...f, image_url: e.target.value }))}
                className="h-8 text-xs rounded-lg bg-white/70"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl border-[#E5D8CF] text-xs h-10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProduct}
              className="bg-[#D67B6B] text-white hover:bg-[#c36859] rounded-xl text-xs h-10 px-5 shadow-sm"
            >
              {editingProduct ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold text-red-900">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Are you sure you want to permanently remove this coffee product from the catalog? Existing past bills will retain their original item name and price snapshot.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="rounded-xl border-[#E5D8CF] text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteProduct(deleteConfirmId)}
              className="rounded-xl text-xs h-9 px-4"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
