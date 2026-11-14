"use client"

import { useEffect, useRef, useState } from "react"
import { LockKeyhole, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function LoginPage() {
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const mfaRef = useRef<HTMLInputElement>(null)

  const [mfaRequired, setMfaRequired] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Clean up any stray query parameters (e.g. from previous GET submissions)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  async function submit() {
    if (loading) return
    if (typeof document !== "undefined") {
      const btn = document.getElementById("login-submit-btn")
      if (btn?.getAttribute("data-submitting") === "true") return
    }

    const userEl = (usernameRef.current?.value ?? (typeof document !== "undefined" ? (document.getElementById("username") as HTMLInputElement)?.value : "")) || ""
    const passEl = (passwordRef.current?.value ?? (typeof document !== "undefined" ? (document.getElementById("password") as HTMLInputElement)?.value : "")) || ""
    const mfaEl = (mfaRef.current?.value ?? (typeof document !== "undefined" ? (document.getElementById("mfaCode") as HTMLInputElement)?.value : "")) || ""

    const u = userEl.trim()
    const p = passEl
    const mfa = mfaEl.trim()

    if (!u) {
      setError("Please enter your username.")
      return
    }
    if (!p) {
      setError("Please enter your password.")
      return
    }
    setLoading(true)
    setError("")

    try {
      if (mfaRequired) {
        const response = await fetch("/api/auth/verify-mfa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: mfa }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) {
          setError(result.error || "Invalid verification code.")
          setLoading(false)
          return
        }
        window.location.replace("/?view=POS")
        return
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) {
        setError(result.error || "Invalid username or password.")
        setLoading(false)
        return
      }

      if (result.mfaRequired) {
        setMfaRequired(true)
        setLoading(false)
        return
      }

      // Role-based redirection: Kitchen -> /?view=Kitchen, everyone else -> /?view=POS
      const userRole = (result.role || "").toLowerCase()
      const targetUrl = userRole === "kitchen" ? "/?view=Kitchen" : "/?view=POS"
      window.location.replace(targetUrl)
    } catch {
      setError("Unable to sign in right now. Please try again.")
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

            <div className="mb-6">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                <span className="size-2 rounded-full bg-emerald-500" />
                Online POS Terminal • Authoritative Database
              </div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#808068]">Staff access</p>
              <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-gray-900">Welcome to Lazy Sunday</h1>
              <p className="mt-1 text-xs sm:text-sm text-[#808068]/80">Sign in to open your POS register & workspace.</p>
            </div>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-semibold text-gray-700">
                Username
                <Input
                  ref={usernameRef}
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  defaultValue=""
                  placeholder="Enter username"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void submit()
                    }
                  }}
                  className="h-11 sm:h-12 text-sm sm:text-base rounded-xl border-[#E5D8CF] focus:ring-[#D67B6B] focus:border-[#D67B6B]"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-semibold text-gray-700">
                Password
                <Input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  defaultValue=""
                  placeholder="••••••••"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void submit()
                    }
                  }}
                  className="h-11 sm:h-12 text-sm sm:text-base rounded-xl border-[#E5D8CF] focus:ring-[#D67B6B] focus:border-[#D67B6B]"
                />
              </label>

              {mfaRequired && (
                <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-semibold text-gray-700">
                  Authenticator code
                  <Input
                    ref={mfaRef}
                    id="mfaCode"
                    name="mfaCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    defaultValue=""
                    placeholder="6-digit code"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void submit()
                      }
                    }}
                    className="h-11 sm:h-12 text-sm sm:text-base rounded-xl border-[#E5D8CF] focus:ring-[#D67B6B]"
                  />
                </label>
              )}

              <div
                id="login-error-msg"
                role="alert"
                aria-live="polite"
                className={`p-3 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-600 ${error ? "block" : "hidden"}`}
              >
                {error}
              </div>

              <Button
                id="login-submit-btn"
                type="button"
                onClick={() => void submit()}
                disabled={loading}
                className="h-11 sm:h-12 bg-[#D67B6B] hover:bg-[#c26555] text-white font-semibold text-sm sm:text-base rounded-xl mt-1 gap-2 shadow-sm transition-all cursor-pointer"
              >
                {loading ? "Signing in…" : mfaRequired ? "Verify and continue" : "Sign in to POS"}
                <LockKeyhole className="size-4" />
              </Button>
            </div>

            {/* Instant event binder for immediate action before and after React hydration */}
            <script
              dangerouslySetInnerHTML={{
                __html: `
(function() {
  function tryInstantLogin(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    var btn = document.getElementById('login-submit-btn');
    if (!btn) return;
    if (btn.hasAttribute('disabled') || btn.getAttribute('data-submitting') === 'true') return;

    var uInput = document.getElementById('username');
    var pInput = document.getElementById('password');
    var u = uInput ? (uInput.value || '').trim() : '';
    var p = pInput ? (pInput.value || '') : '';
    if (!u || !p) return;

    btn.setAttribute('data-submitting', 'true');
    btn.setAttribute('disabled', 'true');
    var originalText = btn.innerHTML;
    btn.textContent = 'Signing in…';

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data && data.success) {
        var role = (data.role || '').toLowerCase();
        var target = role === 'kitchen' ? '/?view=Kitchen' : '/?view=POS';
        window.location.replace(target);
      } else {
        btn.removeAttribute('data-submitting');
        btn.removeAttribute('disabled');
        btn.innerHTML = originalText;
        var errEl = document.getElementById('login-error-msg');
        if (errEl) {
          errEl.textContent = (data && data.error) || 'Invalid username or password.';
          errEl.className = 'p-3 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-600 block';
        }
      }
    })
    .catch(function() {
      btn.removeAttribute('data-submitting');
      btn.removeAttribute('disabled');
      btn.innerHTML = originalText;
      var errEl = document.getElementById('login-error-msg');
      if (errEl) {
        errEl.textContent = 'Unable to sign in right now. Please try again.';
        errEl.className = 'p-3 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-600 block';
      }
    });
  }

  function bindEvents() {
    var btn = document.getElementById('login-submit-btn');
    if (btn && !btn.__boundInstantLogin) {
      btn.__boundInstantLogin = true;
      btn.addEventListener('click', tryInstantLogin);
    }
    var userIn = document.getElementById('username');
    if (userIn && !userIn.__boundInstantLogin) {
      userIn.__boundInstantLogin = true;
      userIn.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter') tryInstantLogin(ev);
      });
    }
    var passIn = document.getElementById('password');
    if (passIn && !passIn.__boundInstantLogin) {
      passIn.__boundInstantLogin = true;
      passIn.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter') tryInstantLogin(ev);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }
  setTimeout(bindEvents, 50);
  setTimeout(bindEvents, 200);
})();
`,
              }}
            />
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
