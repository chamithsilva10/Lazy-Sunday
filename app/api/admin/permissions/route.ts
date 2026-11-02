import { NextRequest, NextResponse } from "next/server"
import { authorizeRequest } from "@/lib/rbac/middleware"
import { RbacService } from "@/lib/rbac/rbac-service"
import { PERMISSION_MODULES } from "@/lib/rbac/permissions"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request, "roles.manage")
  if (!auth.allowed) return auth.response!

  const permissions = RbacService.getAllPermissions()
  const grouped = PERMISSION_MODULES.map((moduleName) => ({
    module: moduleName,
    permissions: permissions.filter((p) => p.module === moduleName),
  }))

  return NextResponse.json(
    {
      modules: PERMISSION_MODULES,
      grouped,
      all: permissions,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
