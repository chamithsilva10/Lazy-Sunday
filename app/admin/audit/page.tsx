"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Search, Shield, ShieldCheck } from "lucide-react"
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
    <main className="min-h-screen bg-[#F4EBE4] p-4 text-[#343428] sm:p-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#808068] hover:text-[#D67B6B] bg-white border border-[#E5D8CF] px-3 py-1.5 rounded-xl shadow-xs transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to POS
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#808068] bg-[#FAF5F1] px-3 py-1 rounded-full border border-[#E5D8CF]">
            <ShieldCheck className="size-3.5 text-[#D67B6B]" />
            <span>Administrator Security Logs</span>
          </div>
        </div>

        <header className="mb-6 border-b border-[#E5D8CF] pb-5">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#808068]">Lazy Sunday Administration</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-gray-900">Security Audit Log</h1>
        </header>

        <form
          className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#E5D8CF] bg-white p-4 sm:flex-row sm:items-end shadow-xs"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-semibold text-gray-700">
            Action Filter
            <Input
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="e.g. login, payment, void..."
              className="h-10 rounded-xl border-[#E5D8CF] bg-[#FAF5F1]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-700">
            From Date
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-10 rounded-xl border-[#E5D8CF] bg-[#FAF5F1]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-700">
            To Date
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-10 rounded-xl border-[#E5D8CF] bg-[#FAF5F1]"
            />
          </label>
          <Button
            type="submit"
            aria-label="Apply audit filters"
            title="Apply filters"
            className="h-10 px-4 bg-[#D67B6B] hover:bg-[#c26555] text-white rounded-xl shadow-xs shrink-0 font-semibold text-xs gap-1.5"
          >
            <Search className="size-4" />
            Filter
          </Button>
        </form>

        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-[#E5D8CF] bg-white shadow-xs">
          <table className="w-full min-w-[760px] text-left text-xs sm:text-sm">
            <thead className="border-b border-[#E5D8CF] bg-[#FAF5F1] text-[10px] uppercase font-bold tracking-wider text-[#808068]">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Client Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top hover:bg-gray-50/50">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600 font-mono">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{entry.action}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#808068]">{entry.actor_user_id || "Unidentified"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{entry.target_id || "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{entry.ip_address || "-"}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-xs text-gray-400" title={entry.user_agent || ""}>
                    {entry.user_agent || "-"}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-[#808068]">
                    No audit events recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
