"use client"

import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AccessDeniedProps {
  requiredPermission?: string
  role?: string
  onBackToAllowed?: () => void
}

export function AccessDenied({
  requiredPermission,
  role,
  onBackToAllowed,
}: AccessDeniedProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-white border border-[#dfe5d8] rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="size-14 mx-auto mb-4 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
          <ShieldAlert className="size-7" />
        </div>
        <p className="text-xs uppercase tracking-[.2em] font-bold text-[#80907f]">Permission Denied</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-gray-900">Access Restricted</h2>
        <p className="mt-2 text-xs sm:text-sm text-gray-600 leading-relaxed">
          Your current account role{" "}
          {role && (
            <span className="font-semibold uppercase text-[#244f3d] bg-[#eef4ea] px-1.5 py-0.5 rounded text-xs">
              {role}
            </span>
          )}{" "}
          does not have permission to view or manage this workspace.
        </p>

        {requiredPermission && (
          <div className="mt-4 p-2.5 bg-gray-50 border rounded-xl text-left">
            <p className="text-[11px] font-mono text-gray-500">
              Required Permission: <strong className="text-gray-800">{requiredPermission}</strong>
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          {onBackToAllowed && (
            <Button
              onClick={onBackToAllowed}
              className="bg-[#244f3d] hover:bg-[#1a3b2e] text-white font-semibold text-xs h-10 rounded-xl gap-2"
            >
              <ArrowLeft className="size-4" />
              Return to Register
            </Button>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" })
              window.location.assign("/auth/login")
            }}
            className="text-xs h-10 border-gray-300 rounded-xl gap-2 hover:bg-gray-50 text-gray-700"
          >
            <LogOut className="size-4" />
            Switch Account
          </Button>
        </div>
      </div>
    </div>
  )
}
