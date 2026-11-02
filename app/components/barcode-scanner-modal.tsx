"use client"

import { useState } from "react"
import { Barcode, Scan, CheckCircle2, Zap, Search, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { playBarcodeBeep } from "@/lib/config/demo"
import { MOCK_PRODUCTS, MockProduct } from "@/lib/mock/pos-mock-data"

interface BarcodeScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (barcodeOrSku: string) => void
}

export function BarcodeScannerModal({ open, onOpenChange, onScan }: BarcodeScannerModalProps) {
  const [manualCode, setManualCode] = useState("")
  const [searchFilter, setSearchFilter] = useState("")
  const [scannedItemName, setScannedItemName] = useState<string | null>(null)

  function handleScan(code: string, itemName?: string) {
    playBarcodeBeep()
    setScannedItemName(itemName || code)
    onScan(code)
    setTimeout(() => {
      setScannedItemName(null)
    }, 1500)
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualCode.trim()) return
    const match = MOCK_PRODUCTS.find(
      (p) => p.barcode === manualCode.trim() || p.sku.toLowerCase() === manualCode.trim().toLowerCase()
    )
    handleScan(manualCode.trim(), match?.name)
    setManualCode("")
  }

  const sampleItems = MOCK_PRODUCTS.slice(0, 12).filter((p) =>
    searchFilter ? p.name.toLowerCase().includes(searchFilter.toLowerCase()) || p.barcode.includes(searchFilter) : true
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#F4EBE4] text-[#808068]">
              <Barcode className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Simulate Barcode Scanner</DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Simulates real hardware laser scanner triggers with sound & instant cart addition.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Laser Scanner Visual Simulation Box */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-emerald-950/90 p-4 text-center text-white shadow-inner flex flex-col items-center justify-center min-h-[90px]">
          <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-[0_0_8px_#ff0000] animate-bounce opacity-80" />
          <Scan className="size-6 text-emerald-400 mb-1" />
          <p className="text-xs font-mono text-emerald-300">HARDWARE SCANNER SIMULATOR READY</p>
          {scannedItemName ? (
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-200 bg-emerald-800/80 px-3 py-1 rounded-full animate-pulse">
              <CheckCircle2 className="size-3.5 text-emerald-300" />
              Scanned: {scannedItemName}
            </div>
          ) : (
            <p className="text-[11px] text-emerald-400/80 mt-0.5">Click any product barcode below or type an SKU</p>
          )}
        </div>

        {/* Manual Barcode Input */}
        <form onSubmit={handleManualSubmit} className="flex gap-2 mt-3">
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Type Barcode or SKU (e.g. 890100100022 or SKU-BGR-001)..."
            className="text-xs sm:text-sm h-10 font-mono"
            autoFocus
          />
          <Button type="submit" className="h-10 bg-[#D67B6B] hover:bg-[#c36859] text-white text-xs px-4">
            Scan
          </Button>
        </form>

        {/* Sample Barcode Catalog for 1-Click Scan */}
        <div className="flex-1 overflow-y-auto mt-3 pr-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Quick Scan Items (Click to Scan):
            </p>
            <div className="relative w-40">
              <Search className="size-3 absolute left-2 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Filter items..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full text-[11px] pl-6 pr-2 py-1 border rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            {sampleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleScan(item.barcode, item.name)}
                className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 hover:border-[#D67B6B] hover:bg-[#FAF5F1] transition-all text-left group"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-[#D67B6B]">
                    {item.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {item.barcode}
                    </span>
                    <span className="text-[10px] text-gray-400">{item.category}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-[#D67B6B]">Rs. {item.price.toLocaleString()}</p>
                  <span className="text-[10px] font-medium text-[#808068] bg-[#F4EBE4] px-1.5 py-0.5 rounded">
                    Tap to Scan
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
