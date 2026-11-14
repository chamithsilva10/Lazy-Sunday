import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeRequest } from "@/lib/rbac/middleware"
import { RbacService } from "@/lib/rbac/rbac-service"
import { normalizeRole } from "@/lib/rbac/permissions"
import { writeSecurityAudit } from "@/lib/coffee/security"

export const dynamic = "force-dynamic"

const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(255).optional(),
  permissions: z.array(z.string()).default([]),
})

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request, "roles.manage")
  if (!auth.allowed) return auth.response!

  let roles = await RbacService.getRoles()

  // Overlay cookie overrides if present (ensuring instant cross-lambda sync in serverless)
  try {
    const cookieVal = request.cookies.get("pos_role_permissions_overrides")?.value
    if (cookieVal) {
      const overrides: Record<string, string[]> = JSON.parse(decodeURIComponent(cookieVal))
      roles = roles.map((r) => {
        const canonical = normalizeRole(r.name || r.id)
        const customPerms = overrides[r.id] || overrides[canonical] || overrides[`role-${canonical}`]
        if (Array.isArray(customPerms)) {
          return { ...r, permissions: customPerms }
        }
        return r
      })
    }
  } catch {}

  return NextResponse.json(
    { roles },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(request: NextRequest) {
  const auth = await authorizeRequest(request, "roles.manage")
  if (!auth.allowed) return auth.response!

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const parsed = createRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid role data.", details: parsed.error.format() },
      { status: 400 }
    )
  }

  try {
    const role = await RbacService.createRole(parsed.data)
    try {
      await writeSecurityAudit(request, "role_created", auth.user?.id || null, role.id, {
        role_name: role.name,
        permissions_count: role.permissions.length,
      })
    } catch (auditErr) {
      console.warn("Security audit log write failed", auditErr)
    }

    return NextResponse.json({ success: true, role }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create role." }, { status: 400 })
  }
}
