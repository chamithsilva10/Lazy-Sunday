"use client"

import { FormEvent, useState } from "react"
import { LockKeyhole, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function LoginPage() {
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("Welcome123")
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
        window.location.assign("/?view=POS")
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

      // Role-based redirection: Kitchen -> /?view=Kitchen, everyone else -> /?view=POS
      const userRole = (result.role || "").toLowerCase()
      if (userRole === "kitchen") {
        window.location.assign("/?view=Kitchen")
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
    <main suppressHydrationWarning className="flex min-h-[100dvh] items-center justify-center bg-[#F4EBE4] p-3 sm:p-6 text-[#343428]">
      <section suppressHydrationWarning className="grid w-full max-w-4xl overflow-hidden rounded-2xl sm:rounded-[28px] border border-[#E5D8CF] bg-white shadow-[0_20px_60px_rgba(128,128,104,0.12)] md:grid-cols-[1.05fr_.95fr]">
        {/* Desktop Brand Visual Column */}
        <div suppressHydrationWarning className="hidden bg-[#808068] p-10 lg:p-12 text-[#F4EBE4] md:flex md:flex-col md:justify-between">
          <div>
            <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-[#EAB8B5] text-[#808068] shadow-sm">
              <UtensilsCrossed className="size-6" />
            </div>
            <p className="font-serif text-3xl lg:text-4xl font-bold leading-tight">A calmer way to run service.</p>
            <p className="mt-4 max-w-xs text-sm leading-6 text-[#F4EBE4]/85">
              Manage orders, tables, kitchen flow, and inventory from one connected workspace.
            </p>
          </div>
          <div className="pt-6 border-t border-[#9c9c82]">
            <p className="text-xs uppercase tracking-[.25em] text-[#EAB8B5] font-bold">LAZY SUNDAY</p>
            <p className="text-[11px] text-[#F4EBE4]/75 mt-0.5">Point of Sale & Hospitality Management</p>
            <p className="text-[10px] text-[#F4EBE4]/65 mt-2 font-medium">Created by Chamith · Full Stack Developer</p>
          </div>
        </div>

        {/* Login Form Column (Mobile-First) */}
        <div suppressHydrationWarning className="p-5 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-between">
          <div>
            {/* Mobile Header Banner */}
            <div className="mb-6 flex items-center gap-3 md:hidden">
              <div className="flex size-11 items-center justify-center rounded-xl bg-[#808068] text-[#F4EBE4] shadow-sm">
                <UtensilsCrossed className="size-5" />
              </div>
              <div>
                <span className="font-serif text-lg font-bold tracking-tight text-[#343428]">LAZY SUNDAY</span>
                <p className="text-[10px] uppercase tracking-[.2em] text-[#808068]">Restaurant Terminal</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                <span className="size-2 rounded-full bg-emerald-500" />
                Online POS Terminal • Authoritative Database
              </div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#808068]">Staff access</p>
              <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-gray-900">Welcome to Lazy Sunday</h1>
              <p className="mt-1 text-xs sm:text-sm text-[#808068]/80">Sign in to open your POS register & workspace.</p>
            </div>

            {/* Quick Staff Account Selection */}
            <div className="mb-5 rounded-2xl border border-[#E5D8CF] bg-[#FAF5F1]/60 p-3 sm:p-4">
              <p className="text-[11px] font-bold text-[#808068] uppercase tracking-wider mb-2">
                Quick Sign-in (Select Staff Account):
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { role: "Admin", user: "admin", desc: "Full Access" },
                  { role: "Manager", user: "manager", desc: "Store Ops" },
                  { role: "Cashier", user: "cashier", desc: "POS Register" },
                  { role: "Kitchen", user: "kitchen", desc: "KDS Screen" },
                  { role: "Staff", user: "staff", desc: "Dine-in Floor" },
                ].map((account) => (
                  <button
                    key={account.user}
                    type="button"
                    onClick={() => {
                      setUsername(account.user)
                      setPassword("Welcome123")
                      setError("")
                    }}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all text-left flex flex-col justify-center ${
                      username === account.user
                        ? "bg-[#808068] text-white border-[#808068] shadow-xs scale-[1.02]"
                        : "bg-white text-[#343428] border-[#E5D8CF] hover:border-[#808068]/60 hover:bg-white/80"
                    }`}
                  >
                    <span className="font-bold">{account.role}</span>
                    <span className={`text-[10px] ${username === account.user ? "text-white/80" : "text-[#808068]"}`}>
                      @{account.user}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <form action="#" method="POST" onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-semibold text-gray-700">
                Username
                <Input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="h-11 sm:h-12 text-sm sm:text-base rounded-xl border-[#E5D8CF] focus:ring-[#D67B6B] focus:border-[#D67B6B]"
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
                  className="h-11 sm:h-12 text-sm sm:text-base rounded-xl border-[#E5D8CF] focus:ring-[#D67B6B] focus:border-[#D67B6B]"
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
                    className="h-11 sm:h-12 text-sm sm:text-base rounded-xl border-[#E5D8CF] focus:ring-[#D67B6B]"
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
                className="h-11 sm:h-12 bg-[#D67B6B] hover:bg-[#c26555] text-white font-semibold text-sm sm:text-base rounded-xl mt-1 gap-2 shadow-sm transition-all"
              >
                {loading ? "Signing in…" : mfaRequired ? "Verify and continue" : "Sign in to POS"}
                <LockKeyhole className="size-4" />
              </Button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center space-y-1">
            <p className="text-[11px] text-[#808068]">
              LAZY SUNDAY POS • Optimized for touch, mobile, & desktop terminals.
            </p>
            <p className="text-[10px] text-[#808068]/70 font-medium tracking-wide">
              Created by Chamith · Full Stack Developer
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
