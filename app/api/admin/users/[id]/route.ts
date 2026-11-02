import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeRequest } from "@/lib/rbac/middleware"
import { RbacService } from "@/lib/rbac/rbac-service"
import { writeSecurityAudit } from "@/lib/coffee/security"

export const dynamic = "force-dynamic"

const updateUserSchema = z.object({
  full_name: z.string().trim().min(2).max(100).optional(),
  email: z.string().email().optional().or(z.literal("")),
  role_id: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(6).max(100).optional(),
})

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, "users.manage")
  if (!auth.allowed) return auth.response!

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user update data." }, { status: 400 })
  }

  try {
    const user = await RbacService.updateUser(id, parsed.data, auth.user?.id)
    try {
      await writeSecurityAudit(request, "user_updated", auth.user?.id || null, id, {
        updated_fields: Object.keys(parsed.data),
      })
    } catch (auditErr) {
      console.warn("Security audit log write failed", auditErr)
    }

    const { password_hash, ...safeUser } = user
    return NextResponse.json({ success: true, user: safeUser })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update user." }, { status: 400 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, "users.manage")
  if (!auth.allowed) return auth.response!

  const { id } = await context.params

  try {
    await RbacService.deleteUser(id, auth.user?.id)
    try {
      await writeSecurityAudit(request, "user_deleted", auth.user?.id || null, id)
    } catch (auditErr) {
      console.warn("Security audit log write failed", auditErr)
    }

    return NextResponse.json({ success: true, message: "User deleted successfully." })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete user." }, { status: 400 })
  }
}
