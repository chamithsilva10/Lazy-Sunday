import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeRequest } from "@/lib/rbac/middleware"
import { RbacService } from "@/lib/rbac/rbac-service"
import { writeSecurityAudit } from "@/lib/coffee/security"

export const dynamic = "force-dynamic"

const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  description: z.string().trim().max(255).optional(),
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, "roles.manage")
  if (!auth.allowed) return auth.response!

  const { id } = await context.params
  const role = await RbacService.getRoleById(id)
  if (!role) {
    return NextResponse.json({ error: "Role not found." }, { status: 404 })
  }

  return NextResponse.json({ role }, { headers: { "Cache-Control": "no-store" } })
}

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

  const parsed = updateRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role update data." }, { status: 400 })
  }

  try {
    const role = await RbacService.updateRole(id, parsed.data)
    try {
      await writeSecurityAudit(request, "role_updated", auth.user?.id || null, id, {
        updated_fields: parsed.data,
      })
    } catch (auditErr) {
      console.warn("Security audit log write failed", auditErr)
    }

    return NextResponse.json({ success: true, role })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update role." }, { status: 400 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, "roles.manage")
  if (!auth.allowed) return auth.response!

  const { id } = await context.params

  try {
    await RbacService.deleteRole(id)
    try {
      await writeSecurityAudit(request, "role_deleted", auth.user?.id || null, id)
    } catch (auditErr) {
      console.warn("Security audit log write failed", auditErr)
    }

    return NextResponse.json({ success: true, message: "Role deleted successfully." })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete role." }, { status: 400 })
  }
}
