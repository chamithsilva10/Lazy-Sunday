"use client"

import { FormEvent, useState } from "react"
import { LockKeyhole, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaCode, setMfaCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setError("")

    try {
      if (mfaRequired) {
        const response = await fetch("/api/auth/verify-mfa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: mfaCode }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) {
          setError(result.error || "Invalid verification code.")
          return
        }
        window.location.assign("/")
        return
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(result.error || "Invalid username or password.")
        return
      }

      if (result.mfaRequired) {
        setMfaRequired(true)
        return
      }

      // Role-based redirection:
      // - Kitchen -> /?view=Kitchen
      // - Cashier -> /?view=POS
      // - Admin -> /?view=Orders
      // - Staff -> /?view=POS
      const userRole = (result.role || "").toLowerCase()
      if (userRole === "kitchen") {
        window.location.assign("/?view=Kitchen")
      } else if (userRole === "cashier") {
        window.location.assign("/?view=POS")
      } else if (userRole === "admin") {
        window.location.assign("/?view=Orders")
      } else {
        window.location.assign("/?view=POS")
      }
    } catch {
      setError("Unable to sign in right now. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main suppressHydrationWarning className="flex min-h-[100dvh] items-center justify-center bg-[#f4f5ef] p-3 sm:p-6 text-[#24352d]">
      <section suppressHydrationWarning className="grid w-full max-w-4xl overflow-hidden rounded-2xl sm:rounded-[28px] border border-[#dfe5d8] bg-white shadow-[0_20px_60px_rgba(36,79,61,.1)] md:grid-cols-[1.05fr_.95fr]">
        {/* Desktop Brand Visual Column */}
        <div suppressHydrationWarning className="hidden bg-[#244f3d] p-10 lg:p-12 text-[#eff7e7] md:flex md:flex-col md:justify-between">
          <div>
            <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-[#dce8c8] text-[#244f3d]">
              <UtensilsCrossed className="size-6" />
            </div>
            <p className="font-serif text-3xl lg:text-4xl font-bold leading-tight">A calmer way to run service.</p>
            <p className="mt-4 max-w-xs text-sm leading-6 text-[#c5d8c2]">
              Manage orders, tables, kitchen flow, and inventory from one connected workspace.
            </p>
          </div>
          <div className="pt-6 border-t border-[#346551]">
            <p className="text-xs uppercase tracking-[.2em] text-[#adc6ad]">RESTAURANT & BAR</p>
            <p className="text-[11px] text-[#8fa78f] mt-0.5">Point of Sale & Hospitality Management</p>
            <p className="text-[10px] text-[#98b598] mt-2 font-medium">Created by Chamith · Full Stack Developer</p>
          </div>
        </div>

        {/* Login Form Column (Mobile-First) */}
        <div suppressHydrationWarning className="p-5 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-between">
          <div>
            {/* Mobile Header Banner */}
            <div className="mb-6 flex items-center gap-3 md:hidden">
              <div className="flex size-11 items-center justify-center rounded-xl bg-[#244f3d] text-[#e8f2dc] shadow-sm">
                <UtensilsCrossed className="size-5" />
              </div>
              <div>
                <span className="font-serif text-lg font-bold tracking-tight">DEMO POS</span>
                <p className="text-[10px] uppercase tracking-[.2em] text-[#80907f]">Restaurant Terminal</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Demo Sandbox Mode • Mock Data Active
              </div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#80907f]">Staff access</p>
              <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-gray-900">Welcome to POS Demo</h1>
              <p className="mt-1 text-xs sm:text-sm text-[#7a857b]">Sign in to open your POS register & workspace.</p>

              {/* 1-Click Demo Accounts */}
              <div className="mt-4 rounded-xl border border-emerald-100 bg-[#f7faf5] p-3">
                <p className="text-[11px] font-bold text-[#244f3d] uppercase tracking-wider mb-2">
                  Select a Demo Role (1-Click Fill):
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setUsername("cashier")
                      setPassword("cashier123")
                    }}
                    className="flex flex-col items-start p-2 rounded-lg bg-white border border-[#dfe5d8] hover:border-[#244f3d] hover:bg-emerald-50/50 transition-all text-left shadow-2xs"
                  >
                    <span className="font-bold text-[#244f3d]">Cashier</span>
                    <span className="text-[10px] text-gray-500">cashier / cashier123</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUsername("manager")
                      setPassword("manager123")
                    }}
                    className="flex flex-col items-start p-2 rounded-lg bg-white border border-[#dfe5d8] hover:border-[#244f3d] hover:bg-emerald-50/50 transition-all text-left shadow-2xs"
                  >
                    <span className="font-bold text-[#244f3d]">Manager</span>
                    <span className="text-[10px] text-gray-500">manager / manager123</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUsername("admin")
                      setPassword("admin123")
                    }}
                    className="flex flex-col items-start p-2 rounded-lg bg-white border border-[#dfe5d8] hover:border-[#244f3d] hover:bg-emerald-50/50 transition-all text-left shadow-2xs"
                  >
                    <span className="font-bold text-[#244f3d]">Admin</span>
                    <span className="text-[10px] text-gray-500">admin / admin123</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUsername("kitchen")
                      setPassword("kitchen123")
                    }}
                    className="flex flex-col items-start p-2 rounded-lg bg-white border border-[#dfe5d8] hover:border-[#244f3d] hover:bg-emerald-50/50 transition-all text-left shadow-2xs"
                  >
                    <span className="font-bold text-[#244f3d]">Kitchen Chef</span>
                    <span className="text-[10px] text-gray-500">kitchen / kitchen123</span>
                  </button>
                </div>
              </div>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-semibold text-gray-700">
                Username
                <Input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="h-11 sm:h-12 text-sm sm:text-base rounded-xl border-[#d7ded0] focus:ring-[#244f3d]"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-semibold text-gray-700">
                Password
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 sm:h-12 text-sm sm:text-base rounded-xl border-[#d7ded0] focus:ring-[#244f3d]"
                />
              </label>

              {mfaRequired && (
                <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-semibold text-gray-700">
                  Authenticator code
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    className="h-11 sm:h-12 text-sm sm:text-base rounded-xl border-[#d7ded0] focus:ring-[#244f3d]"
                  />
                </label>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-11 sm:h-12 bg-[#244f3d] text-white hover:bg-[#193b2d] font-semibold text-sm sm:text-base rounded-xl mt-1 gap-2 shadow-sm"
              >
                {loading ? "Signing in…" : mfaRequired ? "Verify and continue" : "Sign in to POS"}
                <LockKeyhole className="size-4" />
              </Button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center space-y-1">
            <p className="text-[11px] text-[#8b948c]">
              POINT OF SALE • Optimized for touch, mobile, & desktop terminals.
            </p>
            <p className="text-[10px] text-[#9ba59c] font-medium tracking-wide">
              Created by Chamith · Full Stack Developer
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
