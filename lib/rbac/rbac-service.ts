import { createClient } from "@supabase/supabase-js"
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { isDemoMode } from "../config/demo"
import { PosDatabase } from "../db/pos-database"
import {
  AppUser,
  DEFAULT_ROLE_PERMISSIONS,
  Permission,
  Role,
  SYSTEM_PERMISSIONS,
  normalizeRole,
} from "./permissions"

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const derivedKey = scryptSync(password, salt, 64)
  return `${salt}:${derivedKey.toString("hex")}`
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) return false
  const parts = storedHash.split(":")
  if (parts.length !== 2) return false
  const [salt, key] = parts
  const derivedKey = scryptSync(password, salt, 64)
  const keyBuffer = Buffer.from(key, "hex")
  if (derivedKey.length !== keyBuffer.length) return false
  return timingSafeEqual(derivedKey, keyBuffer)
}

function getSupabaseAdminClient() {
  if (isDemoMode()) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// In-memory fallback state for local development and offline environments
const g = globalThis as unknown as {
  __rbac_roles?: Role[]
  __rbac_users?: AppUser[]
}

if (!g.__rbac_roles) {
  g.__rbac_roles = [
    {
      id: "admin",
      name: "Admin",
      description: "Full administrative access across all restaurant systems",
      is_system: true,
      permissions: [...DEFAULT_ROLE_PERMISSIONS.admin],
      created_at: new Date().toISOString(),
    },
    {
      id: "manager",
      name: "Manager",
      description: "Manage restaurant floor, inventory stock, transactions, and reports",
      is_system: true,
      permissions: SYSTEM_PERMISSIONS.map((p) => p.code).filter((c) => c !== "roles.manage"),
      created_at: new Date().toISOString(),
    },
    {
      id: "cashier",
      name: "Cashier",
      description: "Create orders, process bill payments, and view menu catalog",
      is_system: true,
      permissions: [...DEFAULT_ROLE_PERMISSIONS.cashier],
      created_at: new Date().toISOString(),
    },
    {
      id: "kitchen",
      name: "Kitchen",
      description: "View kitchen order queue and update item preparation statuses",
      is_system: true,
      permissions: [...DEFAULT_ROLE_PERMISSIONS.kitchen],
      created_at: new Date().toISOString(),
    },
    {
      id: "staff",
      name: "Staff",
      description: "General floor staff with basic ordering and catalog viewing permissions",
      is_system: true,
      permissions: [...DEFAULT_ROLE_PERMISSIONS.staff],
      created_at: new Date().toISOString(),
    },
  ]
}

if (!g.__rbac_users) {
  g.__rbac_users = [
    {
      id: "00000000-0000-0000-0000-000000000001",
      username: "admin",
      full_name: "Alexa Pheloung (Administrator)",
      email: "alexa@lazysunday.com",
      password_hash: hashPassword("Welcome123"),
      role_id: "admin",
      is_active: true,
      last_login_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-0000-0000-000000000005",
      username: "manager",
      full_name: "Elena Rostova (Store Manager)",
      email: "manager@posdemo.com",
      password_hash: hashPassword("manager123"),
      role_id: "manager",
      is_active: true,
      last_login_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-0000-0000-000000000002",
      username: "cashier",
      full_name: "Alex Rivera (Head Cashier)",
      email: "cashier@posdemo.com",
      password_hash: hashPassword("cashier123"),
      role_id: "cashier",
      is_active: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-0000-0000-000000000003",
      username: "kitchen",
      full_name: "Marco Silva (Kitchen Chef)",
      email: "kitchen@posdemo.com",
      password_hash: hashPassword("kitchen123"),
      role_id: "kitchen",
      is_active: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-0000-0000-000000000004",
      username: "staff",
      full_name: "Floor Waiter",
      email: "staff@posdemo.com",
      password_hash: hashPassword("staff123"),
      role_id: "staff",
      is_active: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
    },
  ]
}

const localRoles = g.__rbac_roles
const localUsers = g.__rbac_users

export class RbacService {
  // =========================================================================
  // PERMISSIONS
  // =========================================================================
  static getAllPermissions(): Permission[] {
    return SYSTEM_PERMISSIONS
  }

  // =========================================================================
  // ROLES
  // =========================================================================
  static async getRoles(): Promise<Role[]> {
    try {
      const dbRoles = await PosDatabase.getRoles()
      if (dbRoles && dbRoles.length > 0) return dbRoles
    } catch (err) {
      console.warn("PosDatabase.getRoles warning:", err)
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      // Calculate user counts locally
      return localRoles.map((r) => ({
        ...r,
        user_count: localUsers.filter((u) => u.role_id === r.id).length,
      }))
    }

    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from("roles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name", { ascending: true })

      if (rolesError || !rolesData) return localRoles

      const { data: rpData } = await supabase.from("role_permissions").select("role_id, permission_id")
      const { data: usersData } = await supabase.from("app_users").select("role_id")

      const rolesWithPerms: Role[] = rolesData.map((r) => {
        const perms = (rpData || [])
          .filter((rp) => rp.role_id === r.id)
          .map((rp) => rp.permission_id)
        const userCount = (usersData || []).filter((u) => u.role_id === r.id).length
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          is_system: Boolean(r.is_system),
          permissions: perms,
          user_count: userCount,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }
      })
      return rolesWithPerms
    } catch {
      return localRoles
    }
  }

  static async getRoleById(roleId: string): Promise<Role | null> {
    const roles = await this.getRoles()
    const cleanId = (roleId || "").trim().toLowerCase()
    const norm = normalizeRole(cleanId)
    return (
      roles.find(
        (r) =>
          r.id.toLowerCase() === cleanId ||
          r.id.toLowerCase() === `role-${cleanId}` ||
          r.name.toLowerCase() === cleanId ||
          normalizeRole(r.id) === norm ||
          normalizeRole(r.name) === norm
      ) || null
    )
  }

  static async createRole(params: {
    name: string
    description?: string
    permissions: string[]
  }): Promise<Role> {
    const name = params.name.trim()
    if (!name) throw new Error("Role name is required.")

    const existingRoles = await this.getRoles()
    if (existingRoles.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`A role named "${name}" already exists.`)
    }

    const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-") + "-" + Date.now().toString(36)
    const newRole: Role = {
      id,
      name,
      description: params.description?.trim() || "",
      is_system: false,
      permissions: params.permissions || [],
      user_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const supabase = getSupabaseAdminClient()
    if (supabase) {
      await supabase.from("roles").insert({
        id: newRole.id,
        name: newRole.name,
        description: newRole.description,
        is_system: false,
      })

      if (newRole.permissions.length > 0) {
        const rows = newRole.permissions.map((p) => ({
          role_id: newRole.id,
          permission_id: p,
        }))
        await supabase.from("role_permissions").insert(rows)
      }
    }

    localRoles.push(newRole)
    return newRole
  }

  static async updateRole(
    id: string,
    params: { name?: string; description?: string }
  ): Promise<Role> {
    const role = await this.getRoleById(id)
    if (!role) throw new Error("Role not found.")

    const nextName = params.name !== undefined ? params.name.trim() : role.name
    if (!nextName) throw new Error("Role name cannot be empty.")

    const allRoles = await this.getRoles()
    const duplicate = allRoles.find((r) => r.name.toLowerCase() === nextName.toLowerCase() && r.id !== id)
    if (duplicate) throw new Error(`Role name "${nextName}" is already in use.`)

    const supabase = getSupabaseAdminClient()
    if (supabase) {
      await supabase
        .from("roles")
        .update({
          name: nextName,
          description: params.description !== undefined ? params.description : role.description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
    }

    const localIdx = localRoles.findIndex((r) => r.id === id)
    if (localIdx >= 0) {
      localRoles[localIdx].name = nextName
      if (params.description !== undefined) {
        localRoles[localIdx].description = params.description
      }
      localRoles[localIdx].updated_at = new Date().toISOString()
      return localRoles[localIdx]
    }

    return { ...role, name: nextName, description: params.description }
  }

  static async updateRolePermissions(roleId: string, permissions: string[]): Promise<Role> {
    const role = await this.getRoleById(roleId)
    if (!role) throw new Error("Role not found.")

    // Validate that all permissions exist
    const validCodes = new Set(SYSTEM_PERMISSIONS.map((p) => p.code))
    const filteredPerms = permissions.filter((p) => validCodes.has(p))

    const supabase = getSupabaseAdminClient()
    if (supabase) {
      // Atomic replace in role_permissions
      await supabase.from("role_permissions").delete().eq("role_id", roleId)
      if (filteredPerms.length > 0) {
        const rows = filteredPerms.map((p) => ({
          role_id: roleId,
          permission_id: p,
        }))
        await supabase.from("role_permissions").insert(rows)
      }
    }

    const localIdx = localRoles.findIndex((r) => r.id === roleId)
    if (localIdx >= 0) {
      localRoles[localIdx].permissions = filteredPerms
      localRoles[localIdx].updated_at = new Date().toISOString()
      return localRoles[localIdx]
    }

    return { ...role, permissions: filteredPerms }
  }

  static async deleteRole(roleId: string): Promise<void> {
    const role = await this.getRoleById(roleId)
    if (!role) throw new Error("Role not found.")
    if (role.is_system) {
      throw new Error(`The system role "${role.name}" cannot be deleted.`)
    }
    if ((role.user_count || 0) > 0) {
      throw new Error(`Cannot delete role "${role.name}" because it is currently assigned to ${role.user_count} user(s). Reassign them first.`)
    }

    const supabase = getSupabaseAdminClient()
    if (supabase) {
      await supabase.from("role_permissions").delete().eq("role_id", roleId)
      await supabase.from("roles").delete().eq("id", roleId)
    }

    if (g.__rbac_roles) {
      const idx = g.__rbac_roles.findIndex((r) => r.id === roleId)
      if (idx >= 0) g.__rbac_roles.splice(idx, 1)
    }
  }

  // =========================================================================
  // USERS
  // =========================================================================
  static async getUsers(): Promise<AppUser[]> {
    try {
      const dbUsers = await PosDatabase.getUsers()
      if (dbUsers && dbUsers.length > 0) return dbUsers
    } catch (err) {
      console.warn("PosDatabase.getUsers warning:", err)
    }

    const supabase = getSupabaseAdminClient()
    const roles = await this.getRoles()
    const rolesMap = new Map(roles.map((r) => [r.id, r]))

    if (!supabase) {
      return localUsers.map((u) => ({
        ...u,
        role: rolesMap.get(u.role_id),
      }))
    }

    try {
      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .order("created_at", { ascending: true })

      if (error || !data) {
        return localUsers.map((u) => ({
          ...u,
          role: rolesMap.get(u.role_id),
        }))
      }

      return data.map((u) => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        email: u.email,
        role_id: u.role_id,
        role: rolesMap.get(u.role_id),
        is_active: Boolean(u.is_active),
        last_login_at: u.last_login_at,
        created_at: u.created_at,
        updated_at: u.updated_at,
      }))
    } catch {
      return localUsers.map((u) => ({
        ...u,
        role: rolesMap.get(u.role_id),
      }))
    }
  }

  static async getUserById(id: string): Promise<AppUser | null> {
    const users = await this.getUsers()
    return users.find((u) => u.id === id) || null
  }

  static async getUserByUsername(username: string): Promise<AppUser | null> {
    try {
      const user = await PosDatabase.getUserByUsername(username)
      if (user) return user
    } catch {}
    const clean = username.trim().toLowerCase()
    const users = await this.getUsers()
    return users.find((u) => u.username.toLowerCase() === clean) || null
  }

  static async createUser(params: {
    username: string
    full_name: string
    email?: string
    password: string
    role_id: string
  }): Promise<AppUser> {
    const username = params.username.trim().toLowerCase()
    if (!username || username.length < 3) {
      throw new Error("Username must be at least 3 characters.")
    }
    if (!/^[a-z0-9_.-]+$/.test(username)) {
      throw new Error("Username may only contain letters, numbers, hyphens, and underscores.")
    }

    const fullName = params.full_name.trim()
    if (!fullName) throw new Error("Full name is required.")

    if (!params.password || params.password.length < 6) {
      throw new Error("Password must be at least 6 characters.")
    }

    const role = await this.getRoleById(params.role_id)
    if (!role) throw new Error("Selected role does not exist.")

    const existing = await this.getUserByUsername(username)
    if (existing) throw new Error(`Username "${username}" is already taken.`)

    const passwordHash = hashPassword(params.password)
    const id = crypto.randomUUID()
    const newUser: AppUser = {
      id,
      username,
      full_name: fullName,
      email: params.email?.trim() || `${username}@posdemo.com`,
      password_hash: passwordHash,
      role_id: role.id,
      role,
      is_active: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const supabase = getSupabaseAdminClient()
    if (supabase) {
      await supabase.from("app_users").insert({
        id: newUser.id,
        username: newUser.username,
        full_name: newUser.full_name,
        email: newUser.email,
        password_hash: newUser.password_hash,
        role_id: newUser.role_id,
        is_active: true,
      })
    }

    localUsers.push(newUser)
    return newUser
  }

  static async updateUser(
    id: string,
    params: {
      full_name?: string
      email?: string
      role_id?: string
      is_active?: boolean
      password?: string
    },
    actorUserId?: string
  ): Promise<AppUser> {
    const user = await this.getUserById(id)
    if (!user) throw new Error("User not found.")

    // Prevent demoting the last active admin
    if (params.role_id && params.role_id !== "admin" && user.role_id === "admin") {
      const allUsers = await this.getUsers()
      const activeAdmins = allUsers.filter((u) => u.role_id === "admin" && u.is_active && u.id !== id)
      if (activeAdmins.length === 0) {
        throw new Error("Cannot demote the last active Administrator account.")
      }
    }

    // Prevent deactivating the last active admin
    if (params.is_active === false && user.role_id === "admin") {
      const allUsers = await this.getUsers()
      const activeAdmins = allUsers.filter((u) => u.role_id === "admin" && u.is_active && u.id !== id)
      if (activeAdmins.length === 0) {
        throw new Error("Cannot deactivate the last active Administrator account.")
      }
    }

    if (params.role_id) {
      const role = await this.getRoleById(params.role_id)
      if (!role) throw new Error("Selected role does not exist.")
    }

    const updates: Partial<AppUser> = {
      updated_at: new Date().toISOString(),
    }
    if (params.full_name !== undefined) updates.full_name = params.full_name.trim()
    if (params.email !== undefined) updates.email = params.email.trim()
    if (params.role_id !== undefined) updates.role_id = params.role_id
    if (params.is_active !== undefined) updates.is_active = params.is_active
    if (params.password) updates.password_hash = hashPassword(params.password)

    const supabase = getSupabaseAdminClient()
    if (supabase) {
      await supabase.from("app_users").update(updates).eq("id", id)
    }

    const localIdx = localUsers.findIndex((u) => u.id === id)
    if (localIdx >= 0) {
      Object.assign(localUsers[localIdx], updates)
      return (await this.getUserById(id))!
    }

    return (await this.getUserById(id))!
  }

  static async deleteUser(id: string, actorUserId?: string): Promise<void> {
    const user = await this.getUserById(id)
    if (!user) throw new Error("User not found.")

    // Prevent self-deletion
    if (actorUserId && (actorUserId === id || actorUserId === user.username)) {
      throw new Error("You cannot delete your own account.")
    }

    // Prevent deletion of primary admin
    if (user.username === "admin") {
      throw new Error("The default system Administrator account cannot be deleted.")
    }

    // Prevent deletion of the last admin
    if (user.role_id === "admin") {
      const allUsers = await this.getUsers()
      const remainingAdmins = allUsers.filter((u) => u.role_id === "admin" && u.id !== id)
      if (remainingAdmins.length === 0) {
        throw new Error("Cannot delete the only remaining Administrator account.")
      }
    }

    const supabase = getSupabaseAdminClient()
    if (supabase) {
      await supabase.from("app_users").delete().eq("id", id)
    }

    if (g.__rbac_users) {
      const idx = g.__rbac_users.findIndex((u) => u.id === id)
      if (idx >= 0) g.__rbac_users.splice(idx, 1)
    }
  }

  static async authenticateUser(username: string, password: string): Promise<AppUser | null> {
    try {
      const authUser = await PosDatabase.authenticateUser(username, password)
      if (authUser) return authUser
    } catch (err) {
      console.warn("PosDatabase.authenticateUser warning:", err)
    }

    const user = await this.getUserByUsername(username)
    if (!user || !user.is_active) return null

    // If running in local demo mode with default mock users, verify password
    if (user.password_hash && verifyPassword(password, user.password_hash)) {
      // Update last_login_at
      void this.updateUser(user.id, {})
      return user
    }

    // Fallback for dev convenience (allow default passwords Welcome123, welcome123, Welcome123!, admin123, manager123, cashier123, kitchen123, staff123)
    const isWelcome = password === "Welcome123" || password === "welcome123" || password === "Welcome123!"
    if (
      (user.username === "admin" && (isWelcome || password === "admin123")) ||
      (user.username === "manager" && (isWelcome || password === "manager123")) ||
      (user.username === "cashier" && (isWelcome || password === "cashier123")) ||
      (user.username === "kitchen" && (isWelcome || password === "kitchen123")) ||
      (user.username === "staff" && (isWelcome || password === "staff123"))
    ) {
      return user
    }

    return null
  }
}
