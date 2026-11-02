"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const idleLimitMs = 10 * 60 * 1000
const heartbeatIntervalMs = 2 * 60 * 1000

export function SessionIdleLock() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === "/auth/login") return

    let lastActivity = Date.now()
    let lastHeartbeat = Date.now()

    const markActivity = () => {
      lastActivity = Date.now()
    }

    const interval = window.setInterval(async () => {
      const now = Date.now()
      if (now - lastActivity >= idleLimitMs) {
        window.location.assign("/auth/login")
        return
      }
      if (now - lastHeartbeat < heartbeatIntervalMs) return
      lastHeartbeat = now
      try {
        const response = await fetch("/api/auth/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
        if (!response.ok) window.location.assign("/auth/login")
      } catch {
        window.location.assign("/auth/login")
      }
    }, 15_000)

    window.addEventListener("pointerdown", markActivity, { passive: true })
    window.addEventListener("keydown", markActivity)
    window.addEventListener("touchstart", markActivity, { passive: true })
    window.addEventListener("wheel", markActivity, { passive: true })

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("pointerdown", markActivity)
      window.removeEventListener("keydown", markActivity)
      window.removeEventListener("touchstart", markActivity)
      window.removeEventListener("wheel", markActivity)
    }
  }, [pathname])

  return null
}