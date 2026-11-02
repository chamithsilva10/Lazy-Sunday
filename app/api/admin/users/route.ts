import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeRequest } from "@/lib/rbac/middleware"
import { RbacService } from "@/lib/rbac/rbac-service"
import { writeSecurityAudit } from "@/lib/coffee/security"

export const dynamic = "force-dynamic"

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(30),
  full_name: z.string().trim().min(2).max(100),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6).max(100),
  role_id: z.string().min(1),
})

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request, "users.manage")
  if (!auth.allowed) return auth.response!

  const users = await RbacService.getUsers()
  // Sanitize out password hashes
  const safeUsers = users.map(({ password_hash, ...rest }) => rest)

  return NextResponse.json(
    { users: safeUsers },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(request: NextRequest) {
  const auth = await authorizeRequest(request, "users.manage")
  if (!auth.allowed) return auth.response!

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid user details.", details: parsed.error.format() },
      { status: 400 }
    )
  }

  try {
    const user = await RbacService.createUser(parsed.data)
    try {
      await writeSecurityAudit(request, "user_created", auth.user?.id || null, user.id, {
        username: user.username,
        role_id: user.role_id,
      })
    } catch (auditErr) {
      console.warn("Security audit log write failed", auditErr)
    }

    const { password_hash, ...safeUser } = user
    return NextResponse.json({ success: true, user: safeUser }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create user." }, { status: 400 })
  }
}
