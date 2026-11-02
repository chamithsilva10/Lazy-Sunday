"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type AuditEntry = {
  id: string
  actor_user_id: string | null
  action: string
  target_id: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [action, setAction] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const params = new URLSearchParams()
    if (action) params.set("action", action)
    if (from) params.set("from", new Date(`${from}T00:00:00.000Z`).toISOString())
    if (to) params.set("to", new Date(`${to}T23:59:59.999Z`).toISOString())
    fetch(`/api/admin/audit?${params}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Unable to load audit logs.")
        setEntries(body.entries || [])
        setError("")
      })
      .catch((requestError) => setError(requestError.message))
  }, [action, from, to])

  return (
    <main className="min-h-screen bg-[#f5f6f0] p-4 text-[#25332c] sm:p-8">
      <section className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-[#dfe5d8] pb-5">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#80907f]">Administration</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-gray-900">Security audit log</h1>
        </header>

        <form className="mb-5 flex flex-col gap-3 rounded-xl border border-[#dfe5d8] bg-white p-4 sm:flex-row sm:items-end" onSubmit={(event) => event.preventDefault()}>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-semibold text-gray-700">
            Action
            <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Filter by action" className="h-10 rounded-lg border-[#d7ded0]" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-700">
            From
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-lg border-[#d7ded0]" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-700">
            To
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-lg border-[#d7ded0]" />
          </label>
          <Button type="submit" variant="outline" size="icon" aria-label="Apply audit filters" title="Apply filters" className="size-10 shrink-0 border-[#d7ded0]">
            <Search className="size-4" />
          </Button>
        </form>

        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="overflow-x-auto rounded-xl border border-[#dfe5d8] bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[#e5e8df] bg-[#f8f9f5] text-xs uppercase text-[#68756a]">
              <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">IP</th><th className="px-4 py-3">Device</th></tr>
            </thead>
            <tbody className="divide-y divide-[#eef0e9]">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3">{new Date(entry.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{entry.action}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.actor_user_id || "Unidentified"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.target_id || "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.ip_address || "-"}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-xs" title={entry.user_agent || ""}>{entry.user_agent || "-"}</td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#80907f]">No audit events found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}