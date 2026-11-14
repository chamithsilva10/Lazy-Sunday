import { NextRequest, NextResponse } from "next/server"
import { getStaffIdentity } from "@/lib/coffee/auth"
import { RbacService } from "./rbac-service"
import { AppUser, Role, normalizeRole } from "./permissions"

export type AuthContext = {
  allowed: boolean
  user: AppUser | null
  role: Role | null
  permissions: string[]
  response?: NextResponse
}

export async function authorizeRequest(
  request: NextRequest,
  requiredPermission?: string
): Promise<AuthContext> {
  // 1. Identify staff member from verified HMAC session or Supabase Auth
  const identity = await getStaffIdentity(request)
  if (!identity) {
    return {
      allowed: false,
      user: null,
      role: null,
      permissions: [],
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    }
  }
  const username = identity.email?.split("@")[0] || identity.role

  // 2. Load user record
  let user = await RbacService.getUserByUsername(username)
  if (!user) {
    // If not found in app_users, fallback to checking role directly
    const roleId = identity.role
    const role = await RbacService.getRoleById(roleId)
    if (!role) {
      return {
        allowed: false,
        user: null,
        role: null,
        permissions: [],
        response: NextResponse.json(
          { error: "Authentication required." },
          { status: 401, headers: { "Cache-Control": "no-store" } }
        ),
      }
    }

    user = {
      id: identity?.userId || "local-staff",
      username,
      full_name: username.charAt(0).toUpperCase() + username.slice(1),
      role_id: role.id,
      role,
      is_active: true,
    }
  }

  if (!user.is_active) {
    return {
      allowed: false,
      user,
      role: null,
      permissions: [],
      response: NextResponse.json(
        { error: "This user account has been deactivated. Please contact an administrator." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    }
  }

  // 3. Resolve role and permissions
  const role = user.role || (await RbacService.getRoleById(user.role_id))
  const normRole = normalizeRole(role?.name || user.role_id)
  const permissions = role?.permissions || []

  // 4. Verify permission if required
  if (requiredPermission) {
    const hasPerm =
      normRole === "admin" ||
      role?.id === "admin" ||
      permissions.includes(requiredPermission) ||
      permissions.includes("*")

    if (!hasPerm) {
      return {
        allowed: false,
        user,
        role,
        permissions,
        response: NextResponse.json(
          {
            error: "Forbidden: You do not have permission to perform this action.",
            requiredPermission,
          },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        ),
      }
    }
  }

  return {
    allowed: true,
    user,
    role,
    permissions,
  }
}

export function requirePermission(permissionCode: string) {
  return async (request: NextRequest) => {
    return authorizeRequest(request, permissionCode)
  }
}

export function requireAdmin() {
  return async (request: NextRequest) => {
    const auth = await authorizeRequest(request)
    if (!auth.allowed || !auth.user) return auth
    const norm = normalizeRole(auth.role?.name || auth.user.role_id)
    if (norm !== "admin" && auth.role?.id !== "admin") {
      return {
        allowed: false,
        user: auth.user,
        role: auth.role,
        permissions: auth.permissions,
        response: NextResponse.json(
          { error: "Forbidden: Administrator privilege required." },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        ),
      }
    }
    return auth
  }
}
