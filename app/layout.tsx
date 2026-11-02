import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { CartProvider } from "./context/cart-context"
import { PermissionsProvider } from "@/hooks/use-permissions"
import { SessionIdleLock } from "./components/session-idle-lock"
import { ClientErrorFilter } from "./components/client-error-filter"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"] })

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#244f3d",
}

export const metadata: Metadata = {
  title: "Lazy Sunday POS · Coffee, kitchen and bar control",
  description: "A real-time point of sale and digital menu for Lazy Sunday.",
  generator: "v0.app",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-dark-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} bg-background text-foreground antialiased`}>
        <ClientErrorFilter />
        <CartProvider>
          <PermissionsProvider>
            <SessionIdleLock />
            {children}
            <Toaster position="top-center" richColors closeButton />
          </PermissionsProvider>
        </CartProvider>
      </body>
    </html>
  )
}
