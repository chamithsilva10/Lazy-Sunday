"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Users,
  UserPlus,
  Search,
  Shield,
  KeyRound,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { SharedPosService } from "@/lib/shared-pos-service"
import { usePermissions } from "@/hooks/use-permissions"

interface Role {
  id: string
  name: string
  is_system: boolean
}

interface AppUser {
  id: string
  username: string
  full_name: string
  email?: string
  role_id: string
  role?: Role
  is_active: boolean
  last_login_at?: string | null
  created_at?: string
}

export function UserManagementView() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [deleteUserTarget, setDeleteUserTarget] = useState<AppUser | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
    role_id: "cashier",
    is_active: true,
  })
  const { refreshPermissions } = usePermissions()
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/roles", { cache: "no-store" }),
      ])

      if (usersRes.ok) {
        const uData = await usersRes.json()
        setUsers(uData.users || [])
      } else if (!silent) {
        toast.error("Unable to load user accounts.")
      }

      if (rolesRes.ok) {
        const rData = await rolesRes.json()
        setRoles(rData.roles || [])
      }
    } catch {
      if (!silent) toast.error("Failed to connect to user service.")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()

    const handleSync = () => {
      void loadData(true)
    }

    let bc: BroadcastChannel | null = null
    if (typeof window !== "undefined") {
      window.addEventListener("pos_realtime_rbac", handleSync)
      window.addEventListener("pos_rbac_sync", handleSync)
      try {
        if ("BroadcastChannel" in window) {
          bc = new BroadcastChannel("pos_realtime_sync")
          bc.onmessage = (event) => {
            const { type } = event.data || {}
            if (type === "rbac" || type === "users" || type === "roles") {
              void loadData(true)
            }
          }
        }
      } catch {}
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("pos_realtime_rbac", handleSync)
        window.removeEventListener("pos_rbac_sync", handleSync)
      }
      if (bc) {
        try {
          bc.close()
        } catch {}
      }
    }
  }, [loadData])

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.username.trim() || !formData.full_name.trim() || !formData.password) {
      toast.error("Please fill in all required fields.")
      return
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username.trim().toLowerCase(),
          full_name: formData.full_name.trim(),
          email: formData.email.trim() || undefined,
          password: formData.password,
          role_id: formData.role_id,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create user.")

      toast.success(`User "${data.user.username}" created successfully!`)
      setCreateOpen(false)
      setFormData({
        username: "",
        full_name: "",
        email: "",
        password: "",
        role_id: "cashier",
        is_active: true,
      })
      await loadData()
      SharedPosService.broadcastRbac()
      void refreshPermissions()
    } catch (err: any) {
      toast.error(err.message || "Failed to create user.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return

    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim() || undefined,
        role_id: formData.role_id,
        is_active: formData.is_active,
      }
      if (formData.password && formData.password.trim().length >= 6) {
        payload.password = formData.password.trim()
      }

      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update user.")

      toast.success(`User "${editUser.username}" updated!`)
      setEditUser(null)
      await loadData()
      SharedPosService.broadcastRbac()
      void refreshPermissions()
    } catch (err: any) {
      toast.error(err.message || "Failed to update user.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteUserTarget) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteUserTarget.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete user.")

      toast.success(`User "${deleteUserTarget.username}" deleted.`)
      setDeleteUserTarget(null)
      await loadData()
      SharedPosService.broadcastRbac()
      void refreshPermissions()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user.")
    } finally {
      setSubmitting(false)
    }
  }

  const toggleUserActive = async (user: AppUser) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to toggle status.")

      toast.success(`User "${user.username}" ${!user.is_active ? "activated" : "deactivated"}.`)
      await loadData()
      SharedPosService.broadcastRbac()
      void refreshPermissions()
    } catch (err: any) {
      toast.error(err.message || "Could not change user status.")
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase()
    return (
      u.username.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.role_id.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5D8CF] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[.18em] text-[#808068]">
              Administration
            </span>
            <Badge className="bg-[#F4EBE4] text-[#808068] border-0 text-[11px]">
              {users.length} Total Users
            </Badge>
          </div>
          <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-gray-900">
            User & Staff Accounts
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage staff credentials, assigned roles, and login access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading}
            className="h-10 rounded-xl border-[#E5D8CF] text-gray-700 hover:bg-gray-50"
            title="Refresh user list"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            onClick={() => {
              setFormData({
                username: "",
                full_name: "",
                email: "",
                password: "",
                role_id: roles[0]?.id || "cashier",
                is_active: true,
              })
              setCreateOpen(true)
            }}
            className="bg-[#D67B6B] hover:bg-[#c36859] text-white font-semibold text-xs sm:text-sm h-10 px-4 rounded-xl gap-2 shadow-sm"
          >
            <UserPlus className="size-4" />
            <span>Add User</span>
          </Button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-2.5 size-4 text-[#808068]" />
        <Input
          placeholder="Search by name, username, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 pl-10 rounded-xl border-[#E5D8CF] bg-white text-xs sm:text-sm"
        />
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-[#E5D8CF] bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-[#E5D8CF] bg-[#FAF5F1] text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 sm:px-6 py-3">Staff Member</th>
                <th className="px-4 sm:px-6 py-3">Assigned Role</th>
                <th className="px-4 sm:px-6 py-3">Status</th>
                <th className="px-4 sm:px-6 py-3 hidden md:table-cell">Last Login</th>
                <th className="px-4 sm:px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((u) => {
                const roleObj = roles.find((r) => r.id === u.role_id)
                const isPrimaryAdmin = u.username === "admin"
                return (
                  <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* User Identity */}
                    <td className="px-4 sm:px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-[#F4EBE4] text-[#808068] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {u.full_name.charAt(0) || u.username.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate flex items-center gap-1.5">
                            {u.full_name}
                            {isPrimaryAdmin && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 bg-amber-50 text-amber-800">
                                Primary Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 font-mono">@{u.username}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 sm:px-6 py-3.5">
                      <Badge
                        className={`capitalize font-semibold text-xs border-0 ${
                          u.role_id === "admin"
                            ? "bg-purple-100 text-purple-900"
                            : u.role_id === "cashier"
                            ? "bg-emerald-100 text-emerald-900"
                            : u.role_id === "kitchen"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-blue-100 text-blue-900"
                        }`}
                      >
                        <Shield className="size-3 mr-1 inline" />
                        {roleObj ? roleObj.name : u.role_id}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="px-4 sm:px-6 py-3.5">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="size-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                          <XCircle className="size-3.5" />
                          Deactivated
                        </span>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="px-4 sm:px-6 py-3.5 text-xs text-gray-500 hidden md:table-cell">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Never logged in"}
                    </td>

                    {/* Actions */}
                    <td className="px-4 sm:px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditUser(u)
                            setFormData({
                              username: u.username,
                              full_name: u.full_name,
                              email: u.email || "",
                              password: "",
                              role_id: u.role_id,
                              is_active: u.is_active,
                            })
                          }}
                          className="size-8 p-0 text-gray-600 hover:text-[#D67B6B] hover:bg-[#FAF5F1] rounded-lg"
                          title="Edit user details"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleUserActive(u)}
                          disabled={isPrimaryAdmin}
                          className="size-8 p-0 text-gray-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg"
                          title={u.is_active ? "Deactivate account" : "Activate account"}
                        >
                          {u.is_active ? (
                            <XCircle className="size-3.5 text-amber-600" />
                          ) : (
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteUserTarget(u)}
                          disabled={isPrimaryAdmin}
                          className="size-8 p-0 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title={isPrimaryAdmin ? "Primary admin cannot be deleted" : "Delete user"}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredUsers.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <Users className="size-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-semibold text-sm text-gray-700">No staff accounts found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {search ? `No accounts match "${search}"` : "Click 'Add User' to register your first staff account."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold text-gray-900">
              Create Staff User
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Add a new staff member to access the POS, Kitchen, or Admin register.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-gray-700">Username *</label>
              <Input
                placeholder="e.g. sashi_cashier"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="mt-1 h-10 rounded-xl"
                autoFocus
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">Letters, numbers, and hyphens only.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Full Name *</label>
              <Input
                placeholder="e.g. John Doe"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="mt-1 h-10 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Email (Optional)</label>
              <Input
                type="email"
                placeholder="staff@posdemo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Password *</label>
              <Input
                type="password"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1 h-10 rounded-xl"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Assigned Role *</label>
              <select
                value={formData.role_id}
                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                className="mt-1 w-full h-10 rounded-xl border border-gray-300 bg-white px-3 text-xs sm:text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-[#D67B6B]"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.is_system ? "(System Role)" : "(Custom Role)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="h-10 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#D67B6B] hover:bg-[#c36859] text-white font-bold text-xs h-10 px-5 rounded-xl shadow-sm"
              >
                {submitting ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT USER DIALOG */}
      <Dialog open={Boolean(editUser)} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold text-gray-900">
              Edit Staff Member: @{editUser?.username}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Update role assignment, contact details, or set a new password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-gray-700">Full Name</label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="mt-1 h-10 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Email Address</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Assigned Role</label>
              <select
                value={formData.role_id}
                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                disabled={editUser?.username === "admin"}
                className="mt-1 w-full h-10 rounded-xl border border-gray-300 bg-white px-3 text-xs sm:text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-[#D67B6B] disabled:bg-gray-100 disabled:text-gray-400"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.is_system ? "(System Role)" : "(Custom Role)"}
                  </option>
                ))}
              </select>
              {editUser?.username === "admin" && (
                <p className="text-[10px] text-amber-700 mt-1">Primary Admin role cannot be demoted.</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Account Access Status</label>
              <div className="mt-1 flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="is_active"
                    checked={formData.is_active === true}
                    onChange={() => setFormData({ ...formData, is_active: true })}
                    className="accent-[#D67B6B]"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="is_active"
                    checked={formData.is_active === false}
                    onChange={() => setFormData({ ...formData, is_active: false })}
                    disabled={editUser?.username === "admin"}
                    className="accent-[#D67B6B]"
                  />
                  Deactivated
                </label>
              </div>
            </div>

            <div className="pt-2 border-t">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-[#808068]" />
                Reset Password (Optional)
              </label>
              <Input
                type="password"
                placeholder="Leave blank to keep existing password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1 h-10 rounded-xl"
                minLength={6}
              />
            </div>

            <div className="pt-2 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditUser(null)}
                className="h-10 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#D67B6B] hover:bg-[#c36859] text-white font-bold text-xs h-10 px-5 rounded-xl shadow-sm"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog
        open={Boolean(deleteUserTarget)}
        onOpenChange={(open) => !open && setDeleteUserTarget(null)}
      >
        <DialogContent className="max-w-md rounded-2xl bg-white p-6">
          <div className="size-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center mb-3">
            <AlertTriangle className="size-6" />
          </div>
          <DialogTitle className="font-serif text-xl font-bold text-gray-900">
            Delete Staff Account?
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-600 leading-relaxed mt-2">
            Are you sure you want to permanently delete{" "}
            <strong>@{deleteUserTarget?.username}</strong> ({deleteUserTarget?.full_name})? This
            action cannot be undone and will revoke their login access immediately.
          </DialogDescription>

          <div className="mt-5 flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteUserTarget(null)}
              className="h-10 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              disabled={submitting}
              className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-sm"
            >
              {submitting ? "Deleting..." : "Permanently Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
