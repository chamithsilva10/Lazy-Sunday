import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeRequest } from "@/lib/rbac/middleware"
import { RbacService } from "@/lib/rbac/rbac-service"
import { writeSecurityAudit } from "@/lib/coffee/security"

export const dynamic = "force-dynamic"

const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
})

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, "roles.manage")
  if (!auth.allowed) return auth.response!

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const parsed = updatePermissionsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid permissions list." }, { status: 400 })
  }

  try {
    const role = await RbacService.updateRolePermissions(id, parsed.data.permissions)
    try {
      await writeSecurityAudit(request, "role_permissions_updated", auth.user?.id || null, id, {
        permissions: parsed.data.permissions,
        count: parsed.data.permissions.length,
      })
    } catch (auditErr) {
      console.warn("Security audit log write failed", auditErr)
    }

    return NextResponse.json({ success: true, role })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update role permissions." },
      { status: 400 }
    )
  }
}
