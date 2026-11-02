"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Shield,
  Plus,
  Trash2,
  Edit3,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  Save,
  Users,
  Lock,
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
import { usePermissions } from "@/hooks/use-permissions"
import { SharedPosService } from "@/lib/shared-pos-service"

interface Permission {
  id: string
  code: string
  module: string
  name: string
  description: string
}

interface GroupedPermissions {
  module: string
  permissions: Permission[]
}

interface Role {
  id: string
  name: string
  description?: string
  is_system: boolean
  permissions: string[]
  user_count?: number
}

export function RoleManagementView() {
  const { refreshPermissions } = usePermissions()
  const [roles, setRoles] = useState<Role[]>([])
  const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string>("admin")
  const [currentPermissions, setCurrentPermissions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialogs
  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleDesc, setNewRoleDesc] = useState("")
  const [editRoleOpen, setEditRoleOpen] = useState(false)
  const [editRoleName, setEditRoleName] = useState("")
  const [editRoleDesc, setEditRoleDesc] = useState("")
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null)

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch("/api/admin/roles", { cache: "no-store" }),
        fetch("/api/admin/permissions", { cache: "no-store" }),
      ])

      if (rolesRes.ok) {
        const rData = await rolesRes.json()
        setRoles(rData.roles || [])
        // Set permissions for currently selected role
        const active = (rData.roles || []).find((r: Role) => r.id === selectedRoleId)
        if (active) {
          setCurrentPermissions(new Set(active.permissions || []))
        } else if (rData.roles && rData.roles.length > 0) {
          setSelectedRoleId(rData.roles[0].id)
          setCurrentPermissions(new Set(rData.roles[0].permissions || []))
        }
      }

      if (permsRes.ok) {
        const pData = await permsRes.json()
        setGroupedPermissions(pData.grouped || [])
      }
    } catch {
      if (!silent) toast.error("Failed to load roles and permissions.")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [selectedRoleId])

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

  const selectRole = (role: Role) => {
    setSelectedRoleId(role.id)
    setCurrentPermissions(new Set(role.permissions || []))
  }

  const togglePermission = (permCode: string) => {
    setCurrentPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(permCode)) {
        next.delete(permCode)
      } else {
        next.add(permCode)
      }
      return next
    })
  }

  const toggleModulePermissions = (modulePerms: Permission[], selectAll: boolean) => {
    setCurrentPermissions((prev) => {
      const next = new Set(prev)
      for (const p of modulePerms) {
        if (selectAll) {
          next.add(p.code)
        } else {
          next.delete(p.code)
        }
      }
      return next
    })
  }

  const handleSavePermissions = async () => {
    const role = roles.find((r) => r.id === selectedRoleId)
    if (!role) return

    setSaving(true)
    try {
      const permsArray = Array.from(currentPermissions)
      const res = await fetch(`/api/admin/roles/${role.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: permsArray }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update permissions.")

      toast.success(`Permissions saved for role "${role.name}"! Takes effect immediately.`)
      // Refresh context
      await refreshPermissions()
      await loadData()
      SharedPosService.broadcastRbac()
    } catch (err: any) {
      toast.error(err.message || "Failed to save permissions.")
    } finally {
      setSaving(false)
    }
  }

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim()) {
      toast.error("Role name is required.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDesc.trim(),
          permissions: [],
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create role.")

      toast.success(`Role "${data.role.name}" created! Configure permissions below.`)
      setCreateRoleOpen(false)
      setNewRoleName("")
      setNewRoleDesc("")
      setSelectedRoleId(data.role.id)
      await loadData()
      SharedPosService.broadcastRbac()
      void refreshPermissions()
    } catch (err: any) {
      toast.error(err.message || "Failed to create role.")
    } finally {
      setSaving(false)
    }
  }

  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault()
    const role = roles.find((r) => r.id === selectedRoleId)
    if (!role) return

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editRoleName.trim(),
          description: editRoleDesc.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update role.")

      toast.success("Role updated successfully!")
      setEditRoleOpen(false)
      await loadData()
      SharedPosService.broadcastRbac()
      void refreshPermissions()
    } catch (err: any) {
      toast.error(err.message || "Failed to update role.")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/roles/${deleteRoleTarget.id}`, {
        method: "DELETE",
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete role.")

      toast.success(`Role "${deleteRoleTarget.name}" deleted.`)
      setDeleteRoleTarget(null)
      setSelectedRoleId("admin")
      await loadData()
      SharedPosService.broadcastRbac()
      void refreshPermissions()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete role.")
    } finally {
      setSaving(false)
    }
  }

  const activeRole = roles.find((r) => r.id === selectedRoleId) || roles[0]

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
              {roles.length} Configured Roles
            </Badge>
          </div>
          <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-gray-900">
            Role-Based Access Control (RBAC)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Create custom roles and configure precise granular permissions grouped by module.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading}
            className="h-10 rounded-xl border-[#E5D8CF] text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            onClick={() => setCreateRoleOpen(true)}
            className="bg-[#D67B6B] hover:bg-[#c36859] text-white font-semibold text-xs sm:text-sm h-10 px-4 rounded-xl gap-2 shadow-sm"
          >
            <Plus className="size-4" />
            <span>Create Custom Role</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Roles List (Left) + Permissions Matrix (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6">
        {/* Roles List */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Select Role to Configure
          </p>

          <div className="space-y-2">
            {roles.map((r) => {
              const isSelected = r.id === selectedRoleId
              return (
                <button
                  key={r.id}
                  onClick={() => selectRole(r)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${
                    isSelected
                      ? "border-[#D67B6B] bg-[#FAF5F1] shadow-sm ring-1 ring-[#D67B6B]"
                      : "border-[#E5D8CF] bg-white hover:bg-gray-50/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif font-bold text-sm text-gray-900 flex items-center gap-1.5">
                      <Shield className={`size-4 ${isSelected ? "text-[#D67B6B]" : "text-gray-400"}`} />
                      {r.name}
                    </span>
                    {r.is_system ? (
                      <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-600">
                        System
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">
                        Custom
                      </Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                    {r.description || "No description provided."}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {r.user_count || 0} user{r.user_count === 1 ? "" : "s"}
                    </span>
                    <span className="font-mono text-emerald-800 font-semibold">
                      {r.permissions?.length || 0} perms
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Permissions Configuration Workspace */}
        {activeRole && (
          <div className="bg-white rounded-2xl border border-[#E5D8CF] p-5 sm:p-7 shadow-sm space-y-6">
            {/* Active Role Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5D8CF] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-gray-900">
                    {activeRole.name} Permissions
                  </h3>
                  {activeRole.is_system && (
                    <Badge className="bg-gray-100 text-gray-700 border-0 text-[10px] gap-1">
                      <Lock className="size-2.5" />
                      System Role
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {activeRole.description || "Manage module-level permissions for this role."}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {!activeRole.is_system && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditRoleName(activeRole.name)
                        setEditRoleDesc(activeRole.description || "")
                        setEditRoleOpen(true)
                      }}
                      className="text-xs h-9 rounded-xl border-gray-300 gap-1.5"
                    >
                      <Edit3 className="size-3.5" />
                      Rename Role
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteRoleTarget(activeRole)}
                      className="text-xs h-9 rounded-xl border-red-200 text-red-700 hover:bg-red-50 gap-1.5"
                    >
                      <Trash2 className="size-3.5" />
                      Delete Role
                    </Button>
                  </>
                )}

                <Button
                  onClick={handleSavePermissions}
                  disabled={saving}
                  className="bg-[#D67B6B] hover:bg-[#c36859] text-white font-bold text-xs h-9 px-4 rounded-xl gap-2 shadow-sm"
                >
                  <Save className="size-4" />
                  <span>{saving ? "Saving..." : "Save Role Permissions"}</span>
                </Button>
              </div>
            </div>

            {/* Modules & Checkboxes List */}
            <div className="space-y-6">
              {groupedPermissions.map((group) => {
                const modulePerms = group.permissions
                const allSelected = modulePerms.every((p) => currentPermissions.has(p.code))
                const someSelected = modulePerms.some((p) => currentPermissions.has(p.code))

                return (
                  <div
                    key={group.module}
                    className="border border-[#E5D8CF] rounded-2xl p-4 sm:p-5 bg-[#FAF5F1]"
                  >
                    {/* Module Header with Quick Actions */}
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200 gap-2 flex-wrap">
                      <div>
                        <h4 className="font-serif font-bold text-sm sm:text-base text-gray-900">
                          {group.module} Module
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          {modulePerms.filter((p) => currentPermissions.has(p.code)).length} of {modulePerms.length} allowed
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleModulePermissions(modulePerms, true)}
                          className="text-[11px] h-7 px-2 text-[#808068] hover:bg-[#FAF5F1] rounded-lg gap-1"
                        >
                          <CheckSquare className="size-3" />
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleModulePermissions(modulePerms, false)}
                          className="text-[11px] h-7 px-2 text-gray-500 hover:bg-gray-200/60 rounded-lg gap-1"
                        >
                          <Square className="size-3" />
                          Clear All
                        </Button>
                      </div>
                    </div>

                    {/* Checkboxes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-3">
                      {modulePerms.map((perm) => {
                        const isChecked = currentPermissions.has(perm.code)
                        return (
                          <label
                            key={perm.code}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-white border-[#D67B6B] shadow-sm"
                                : "bg-white/60 border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(perm.code)}
                              className="mt-0.5 size-4 rounded accent-[#D67B6B] cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 leading-snug">
                                {perm.name}
                              </p>
                              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                                {perm.description}
                              </p>
                              <span className="font-mono text-[10px] text-[#808068] font-semibold mt-1 inline-block">
                                {perm.code}
                              </span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* CREATE ROLE MODAL */}
      <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold text-gray-900">
              Create Custom Role
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Define a custom staff role (e.g. &quot;Floor Manager&quot;, &quot;Head Waiter&quot;, &quot;Inventory Auditor&quot;).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRole} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-gray-700">Role Name *</label>
              <Input
                placeholder="e.g. Floor Manager"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="mt-1 h-10 rounded-xl"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Description</label>
              <Input
                placeholder="Brief summary of duties and access permissions"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div className="pt-2 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateRoleOpen(false)}
                className="h-10 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#D67B6B] hover:bg-[#c36859] text-white font-bold text-xs h-10 px-5 rounded-xl shadow-sm"
              >
                {saving ? "Creating..." : "Create Role"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* RENAME ROLE MODAL */}
      <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold text-gray-900">
              Rename Role
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Update name or description for this role.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditRole} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-gray-700">Role Name</label>
              <Input
                value={editRoleName}
                onChange={(e) => setEditRoleName(e.target.value)}
                className="mt-1 h-10 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Description</label>
              <Input
                value={editRoleDesc}
                onChange={(e) => setEditRoleDesc(e.target.value)}
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div className="pt-2 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditRoleOpen(false)}
                className="h-10 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#D67B6B] hover:bg-[#c36859] text-white font-bold text-xs h-10 px-5 rounded-xl shadow-sm"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE ROLE MODAL */}
      <Dialog
        open={Boolean(deleteRoleTarget)}
        onOpenChange={(open) => !open && setDeleteRoleTarget(null)}
      >
        <DialogContent className="max-w-md rounded-2xl bg-white p-6">
          <div className="size-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center mb-3">
            <AlertCircle className="size-6" />
          </div>
          <DialogTitle className="font-serif text-xl font-bold text-gray-900">
            Delete Role &quot;{deleteRoleTarget?.name}&quot;?
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-600 leading-relaxed mt-2">
            Are you sure you want to delete this custom role?{" "}
            {(deleteRoleTarget?.user_count || 0) > 0 ? (
              <span className="block mt-2 font-bold text-red-700">
                Warning: {deleteRoleTarget?.user_count} user(s) currently have this role assigned.
                You must reassign them to another role before deleting.
              </span>
            ) : (
              "This action will remove the role and all its configured permissions."
            )}
          </DialogDescription>

          <div className="mt-5 flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteRoleTarget(null)}
              className="h-10 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteRole}
              disabled={saving || (deleteRoleTarget?.user_count || 0) > 0}
              className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-sm disabled:opacity-50"
            >
              {saving ? "Deleting..." : "Delete Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
