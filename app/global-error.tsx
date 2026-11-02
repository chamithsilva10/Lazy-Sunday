"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  if (typeof window !== "undefined") {
    console.error("Global POS error boundary triggered:", error)
  }

  const handleReload = () => {
    try {
      reset()
    } catch {}
    if (typeof window !== "undefined") {
      window.location.href = "/"
    }
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0d1714] text-[#f3f0e8]">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-[#c6a15b]">DEMO POS SYSTEM</p>
          <h1 className="font-serif text-3xl font-semibold">The POS needs a refresh</h1>
          <p className="text-sm text-[#aab8b0]">A temporary browser error prevented the workspace from loading.</p>
          <button
            onClick={handleReload}
            className="rounded-lg bg-[#c6a15b] hover:bg-[#b08d48] px-5 py-2.5 text-sm font-semibold text-[#17251f] cursor-pointer transition-colors shadow-sm"
          >
            Reload workspace
          </button>
        </main>
      </body>
    </html>
  )
}
