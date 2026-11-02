"use client"

import { useEffect } from "react"
import { AlertCircle, RotateCcw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("POS Workspace runtime error:", error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full rounded-2xl border border-[#E5D8CF] bg-white p-8 shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-900 mb-4">
          <AlertCircle className="size-6" />
        </div>
        <p className="text-xs uppercase font-bold tracking-[0.2em] text-[#808068]">LAZY SUNDAY POS</p>
        <h2 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 mt-1">Workspace needs a refresh</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-2">
          A temporary state prevented this section from rendering properly.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 mt-6 justify-center">
          <Button
            onClick={() => reset()}
            className="rounded-xl bg-[#D67B6B] hover:bg-[#c36859] text-white gap-2 text-xs sm:text-sm h-10 px-4"
          >
            <RotateCcw className="size-4" />
            Reload view
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.assign("/?view=POS")}
            className="rounded-xl border-[#E5D8CF] hover:bg-[#FAF5F1] gap-2 text-xs sm:text-sm h-10 px-4"
          >
            <Home className="size-4" />
            Return to POS
          </Button>
        </div>
      </div>
    </div>
  )
}
