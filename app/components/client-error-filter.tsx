"use client"

import { useEffect } from "react"

export function ClientErrorFilter() {
  useEffect(() => {
    if (typeof window === "undefined") return

    function isTransientNetOrExtErr(msg: string, stack?: string, fn?: string) {
      const str = ((msg || "") + " " + (stack || "") + " " + (fn || "")).toLowerCase()
      return (
        str.includes("metamask") ||
        str.includes("inpage.js") ||
        str.includes("failed to connect") ||
        str.includes("failed to fetch") ||
        str.includes("err_insufficient_resources") ||
        str.includes("load failed") ||
        str.includes("networkerror") ||
        str.includes("chrome-extension://") ||
        str.includes("bis_skin_checked") ||
        str.includes("bis_register") ||
        str.includes(".netlify/scripts/hud") ||
        str.includes("ejbalbakoplchlghecdalmeeeajnimhm")
      )
    }

    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e?.reason
      const msg = (reason && (reason.message || reason.stack)) || String(reason || "")
      if (isTransientNetOrExtErr(msg, reason?.stack)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    const onError = (e: ErrorEvent) => {
      const msg = e?.message
      const fn = e?.filename
      const stack = e?.error && e.error.stack
      if (isTransientNetOrExtErr(msg, stack, fn)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    window.addEventListener("unhandledrejection", onUnhandledRejection, true)
    window.addEventListener("error", onError, true)

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection, true)
      window.removeEventListener("error", onError, true)
    }
  }, [])

  return null
}
