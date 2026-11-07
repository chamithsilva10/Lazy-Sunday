"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, Check, Loader2, Plus, RefreshCw, Search, ShoppingBag, Users, X, ArrowRightLeft, GitMerge, Split, Receipt } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { SharedPosService, type SharedOrder } from "@/lib/shared-pos-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Table = { id: string; name: string; capacity: number; status: string }
type Reservation = {
  id: string; customer_name: string; phone: string; party_size: number; reserved_for: string
  duration_minutes: number; table_id: string | null; table_name?: string; status: string; source: string; special_requests: string
}
type Session = {
  id: string; table_id: string; table_name?: string; customer_name: string; phone: string | null; guest_count: number
  seated_at: string; status: string; notes: string
}

const ACTIVE_BOOKING = ["pending", "confirmed", "arrived"]
// A booking holds its table from 30 minutes before arrival until it ends.
const HOLD_BEFORE_MIN = 30

const statusStyles: Record<string, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-800",
  reserved: "border-violet-200 bg-violet-50 text-violet-800",
  occupied: "border-amber-200 bg-amber-50 text-amber-900",
  cleaning: "border-sky-200 bg-sky-50 text-sky-800",
  bill_requested: "border-rose-200 bg-rose-50 text-rose-800",
}

const emptyBooking = { customer_name: "", phone: "", party_size: "2", reserved_for: "", duration_minutes: "90", table_id: "", special_requests: "" }
const emptySeat = { customer_name: "Walk-in", phone: "", guest_count: "2", notes: "" }

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-LK", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value))
}
function minutesSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
}
function bookingWindow(booking: Reservation) {
  const start = new Date(booking.reserved_for).getTime()
  return { start: start - HOLD_BEFORE_MIN * 60000, end: start + booking.duration_minutes * 60000 }
}
function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end
}
/** `datetime-local` has no timezone; convert using the browser's zone so Postgres stores the right instant. */
function toIso(local: string) {
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function TablesWorkspace({
  role = "cashier",
  onStartOrder,
}: {
  role?: "admin" | "cashier"
  onStartOrder?: (tableName: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [tables, setTables] = useState<Table[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<Table | null>(null)
  const [search, setSearch] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showBooking, setShowBooking] = useState(false)
  const [showSeat, setShowSeat] = useState(false)
  const [showAddTable, setShowAddTable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [seatTableId, setSeatTableId] = useState("")
  const [seatBookingId, setSeatBookingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyBooking)
  const [seatForm, setSeatForm] = useState(emptySeat)
  const [tableForm, setTableForm] = useState({ name: "", capacity: "4" })

  const [orders, setOrders] = useState<SharedOrder[]>(() => SharedPosService.getOrders())
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferSource, setTransferSource] = useState("")
  const [transferTarget, setTransferTarget] = useState("")

  const [showMerge, setShowMerge] = useState(false)
  const [mergePrimary, setMergePrimary] = useState("")
  const [mergeSecondary, setMergeSecondary] = useState("")
  const [zoneFilter, setZoneFilter] = useState<"all" | "indoor" | "patio" | "bar">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "occupied" | "reserved" | "cleaning">("all")

  useEffect(() => {
    return SharedPosService.subscribeOrders(setOrders)
  }, [])

  const load = useCallback(async () => {
    // 1. Get ground truth from SharedPosService
    const sharedTables = SharedPosService.getTables()
    const sharedBookings = SharedPosService.getBookings()
    const sharedSessions = SharedPosService.getSessions()

    // 2. Query Supabase / remote if configured
    try {
      const [tableRes, reservationRes, sessionRes] = await Promise.all([
        supabase.from("pos_tables").select("id,name,capacity,status").order("name"),
        supabase
          .from("reservations")
          .select("id,customer_name,phone,party_size,reserved_for,duration_minutes,table_id,table_name,status,source,special_requests")
          .in("status", ACTIVE_BOOKING)
          .order("reserved_for"),
        supabase
          .from("table_sessions")
          .select("id,table_id,customer_name,phone,guest_count,seated_at,status,notes")
          .in("status", ["open", "bill_requested"]),
      ])

      const mergedSessions = [...sharedSessions]
      if (sessionRes.data && Array.isArray(sessionRes.data)) {
        for (const s of sessionRes.data as any[]) {
          const idx = mergedSessions.findIndex((ms) => ms.id === s.id || ms.table_id === s.table_id)
          if (idx >= 0) {
            mergedSessions[idx] = { ...mergedSessions[idx], ...s }
          } else {
            mergedSessions.push(s)
          }
        }
      }

      const mergedBookings = [...sharedBookings]
      if (reservationRes.data && Array.isArray(reservationRes.data)) {
        for (const b of reservationRes.data as any[]) {
          const idx = mergedBookings.findIndex((mb) => mb.id === b.id)
          if (idx >= 0) {
            mergedBookings[idx] = { ...mergedBookings[idx], ...b }
          } else {
            mergedBookings.push(b)
          }
        }
      }

      // Synchronize tables from shared floor state
      const remoteTables = (tableRes.data && Array.isArray(tableRes.data) && tableRes.data.length > 0)
        ? (tableRes.data as Table[]).map((rt) => {
            const local = sharedTables.find((st) => st.id === rt.id || st.name.toLowerCase() === rt.name.toLowerCase())
            return local ? { ...rt, status: local.status } : rt
          })
        : sharedTables.map((t) => ({ id: t.id, name: t.name, capacity: t.capacity, status: t.status }))

      setTables(remoteTables)
      setReservations(
        mergedBookings
          .filter((b) => ACTIVE_BOOKING.includes(b.status))
          .map((b) => ({
            id: b.id,
            customer_name: b.customer_name,
            phone: b.phone,
            party_size: b.party_size,
            reserved_for: b.reserved_for,
            duration_minutes: b.duration_minutes,
            table_id: b.table_id,
            table_name: b.table_name || sharedTables.find((t) => t.id === b.table_id || t.name === b.table_id)?.name || "",
            status: b.status,
            source: b.source || "staff",
            special_requests: b.special_requests || "",
          })),
      )
      setSessions(
        mergedSessions
          .filter((s) => s.status !== "closed")
          .map((s) => ({
            id: s.id,
            table_id: s.table_id,
            table_name: s.table_name,
            customer_name: s.customer_name,
            phone: s.phone || null,
            guest_count: s.guest_count,
            seated_at: s.seated_at,
            status: s.status,
            notes: s.notes || "",
          })),
      )
      setLoadError(null)
      return
    } catch {}

    setTables(sharedTables.map((t) => ({ id: t.id, name: t.name, capacity: t.capacity, status: t.status })))
    setReservations(
      sharedBookings
        .filter((b) => ACTIVE_BOOKING.includes(b.status))
        .map((b) => ({
          id: b.id,
          customer_name: b.customer_name,
          phone: b.phone,
          party_size: b.party_size,
          reserved_for: b.reserved_for,
          duration_minutes: b.duration_minutes,
          table_id: b.table_id,
          table_name: b.table_name || sharedTables.find((t) => t.id === b.table_id || t.name === b.table_id)?.name || "",
          status: b.status,
          source: b.source || "staff",
          special_requests: b.special_requests || "",
        })),
    )
    setSessions(
      sharedSessions
        .filter((s) => s.status !== "closed")
        .map((s) => ({
          id: s.id,
          table_id: s.table_id,
          table_name: s.table_name,
          customer_name: s.customer_name,
          phone: s.phone || null,
          guest_count: s.guest_count,
          seated_at: s.seated_at,
          status: s.status,
          notes: s.notes || "",
        })),
    )
    setLoadError(null)
  }, [supabase])

  useEffect(() => {
    void load()

    const unsubTables = SharedPosService.subscribeTables(() => void load())
    const unsubBookings = SharedPosService.subscribeBookings(() => void load())
    const unsubSessions = SharedPosService.subscribeSessions(() => void load())

    let syncTimer: any = null
    const onRealtimeSync = () => {
      if (syncTimer) clearTimeout(syncTimer)
      syncTimer = setTimeout(() => void load(), 200)
    }
    window.addEventListener("pos_realtime_sync", onRealtimeSync)
    window.addEventListener("pos_tables_updated", onRealtimeSync)
    window.addEventListener("pos_sessions_updated", onRealtimeSync)
    window.addEventListener("pos_bookings_updated", onRealtimeSync)

    const channel = supabase
      .channel("tables-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "pos_tables" }, onRealtimeSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, onRealtimeSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, onRealtimeSync)
      .subscribe()

    // Polling + focus refresh cover dropped websockets so the floor never goes stale.
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void load()
    }, 12000)
    const onVisible = () => document.visibilityState === "visible" && void load()
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      unsubTables()
      unsubBookings()
      unsubSessions()
      if (syncTimer) clearTimeout(syncTimer)
      window.removeEventListener("pos_realtime_sync", onRealtimeSync)
      window.removeEventListener("pos_tables_updated", onRealtimeSync)
      window.removeEventListener("pos_sessions_updated", onRealtimeSync)
      window.removeEventListener("pos_bookings_updated", onRealtimeSync)
      void supabase.removeChannel(channel)
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load, supabase])

  const sessionFor = (table: Table) =>
    sessions.find(
      (item) =>
        (item.table_id === table.id || item.table_name?.toLowerCase() === table.name.toLowerCase()) &&
        item.status !== "closed"
    )
  const bookingsFor = (table: Table) =>
    reservations.filter((item) => {
      if (item.table_id && (item.table_id === table.id || String(item.table_id) === String(table.id))) {
        return true
      }
      if (item.table_name && table.name && item.table_name.trim().toLowerCase() === table.name.trim().toLowerCase()) {
        return true
      }
      return false
    })

  /** Any active or upcoming booking that holds or reserves this table */
  const activeBookingFor = (table: Table) => {
    const tableBookings = bookingsFor(table).filter((b) => ACTIVE_BOOKING.includes(b.status))
    if (!tableBookings.length) return null

    const now = Date.now()
    // 1. Arrived or within holding window (starts 30m before until duration ends)
    const current = tableBookings.find((b) => {
      const window = bookingWindow(b)
      return b.status === "arrived" || (now >= window.start && now <= window.end)
    })
    if (current) return current

    // 2. Nearest upcoming booking that has not ended yet
    const upcoming = tableBookings
      .filter((b) => {
        const window = bookingWindow(b)
        return window.end > now
      })
      .sort((a, b) => new Date(a.reserved_for).getTime() - new Date(b.reserved_for).getTime())

    return upcoming[0] || tableBookings[0] || null
  }

  const heldBookingFor = (table: Table) => activeBookingFor(table)

  const statusFor = (table: Table): "available" | "occupied" | "reserved" | "cleaning" | "bill_requested" => {
    const session = sessionFor(table)
    if (session && session.status !== "closed") {
      return session.status === "bill_requested" ? "bill_requested" : "occupied"
    }
    const booking = activeBookingFor(table)
    if (booking) return "reserved"

    if (table.status === "occupied" || table.status === "bill_requested" || table.status === "cleaning" || table.status === "reserved") {
      return table.status
    }
    return "available"
  }

  const visibleTables = tables.filter((table) => {
    const q = search.trim().toLowerCase()
    const st = statusFor(table)
    if (statusFilter !== "all" && st !== statusFilter) return false

    const matchesSearch =
      !q ||
      table.name.toLowerCase().includes(q) ||
      sessionFor(table)?.customer_name.toLowerCase().includes(q) ||
      bookingsFor(table).some((b) => b.customer_name.toLowerCase().includes(q))
    if (!matchesSearch) return false

    if (zoneFilter === "indoor") return !table.name.toLowerCase().includes("patio") && !table.name.toLowerCase().includes("bar") && !table.name.toLowerCase().includes("terrace")
    if (zoneFilter === "patio") return table.name.toLowerCase().includes("patio") || table.name.toLowerCase().includes("terrace") || table.name.toLowerCase().includes("garden") || Number(table.name.replace(/\D/g, "")) >= 7
    if (zoneFilter === "bar") return table.name.toLowerCase().includes("bar") || table.name.toLowerCase().includes("counter")
    return true
  })

  const counts = useMemo(() => {
    const tally = { available: 0, reserved: 0, occupied: 0, cleaning: 0, bill_requested: 0 } as Record<string, number>
    tables.forEach((table) => {
      const st = statusFor(table)
      tally[st] = (tally[st] || 0) + 1
    })
    return tally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, sessions, reservations])

  const selectedSession = selected ? sessionFor(selected) : undefined
  const selectedBookings = selected ? bookingsFor(selected) : []
  const upcoming = reservations

  function fail(message: string) {
    toast.error(message)
  }

  /** Smallest free table that fits the party and has no clashing booking. */
  function pickTable(partySize: number, startIso: string, duration: number, ignoreBookingId?: string) {
    const window = { start: new Date(startIso).getTime() - HOLD_BEFORE_MIN * 60000, end: new Date(startIso).getTime() + duration * 60000 }
    const candidates = tables
      .filter((table) => table.capacity >= partySize)
      .filter((table) => !bookingsFor(table).some((b) => b.id !== ignoreBookingId && overlaps(window, bookingWindow(b))))
      .sort((a, b) => a.capacity - b.capacity || a.name.localeCompare(b.name))
    return candidates[0]
  }

  async function createBooking() {
    const partySize = Number(form.party_size)
    const duration = Number(form.duration_minutes)
    const startIso = toIso(form.reserved_for)
    if (!form.customer_name.trim() || !form.phone.trim()) return fail("Name and phone are required")
    if (!startIso) return fail("Choose a valid date and time")
    if (!Number.isInteger(partySize) || partySize < 1) return fail("Guests must be at least 1")
    if (new Date(startIso).getTime() < Date.now() - 15 * 60000) return fail("Booking time is in the past")

    let tableId = form.table_id
    if (tableId) {
      const table = tables.find((item) => item.id === tableId)
      if (!table) return fail("Selected table no longer exists")
      if (table.capacity < partySize) return fail(`${table.name} seats ${table.capacity}`)
      const clash = bookingsFor(table).find((b) => overlaps(
        { start: new Date(startIso).getTime() - HOLD_BEFORE_MIN * 60000, end: new Date(startIso).getTime() + duration * 60000 },
        bookingWindow(b),
      ))
      if (clash) return fail(`${table.name} is already booked at ${formatTime(clash.reserved_for)} for ${clash.customer_name}`)
    } else {
      const auto = pickTable(partySize, startIso, duration)
      if (!auto) return fail("No table is free for that party size and time")
      tableId = auto.id
    }

    setSaving(true)
    try {
      const targetTable = tables.find((t) => t.id === tableId)
      await SharedPosService.addBooking({
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        party_size: partySize,
        reserved_for: startIso,
        duration_minutes: duration,
        table_id: tableId,
        table_name: targetTable?.name || "Table",
        special_requests: form.special_requests.trim(),
        status: "confirmed",
        source: "staff",
      })
      toast.success(`Booked ${targetTable?.name || "Table"} for ${form.customer_name.trim()}`)
      setShowBooking(false)
      setForm(emptyBooking)
      await load()
    } catch (err: any) {
      fail(`Could not save booking: ${err.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleTransferTable() {
    if (!transferSource || !transferTarget) return fail("Select both source and target tables")
    if (transferSource === transferTarget) return fail("Source and target must be different")
    setSaving(true)
    try {
      const ok = SharedPosService.transferTable(transferSource, transferTarget)
      if (ok) {
        toast.success(`Table transferred successfully`)
        setShowTransfer(false)
        setTransferSource("")
        setTransferTarget("")
        await load()
      } else {
        fail("Could not transfer table")
      }
    } catch (err: any) {
      fail(err.message || "Failed to transfer table")
    } finally {
      setSaving(false)
    }
  }

  async function handleMergeTables() {
    if (!mergePrimary || !mergeSecondary) return fail("Select two tables to merge")
    if (mergePrimary === mergeSecondary) return fail("Primary and secondary tables must be different")
    setSaving(true)
    try {
      const ok = SharedPosService.mergeTables(mergePrimary, mergeSecondary)
      if (ok) {
        toast.success("Tables merged successfully for large group")
        setShowMerge(false)
        setMergePrimary("")
        setMergeSecondary("")
        await load()
      } else {
        fail("Could not merge tables")
      }
    } catch (err: any) {
      fail(err.message || "Failed to merge tables")
    } finally {
      setSaving(false)
    }
  }

  async function handleSplitTable(tableId: string) {
    setSaving(true)
    try {
      const ok = SharedPosService.splitTable(tableId)
      if (ok) {
        toast.success("Merged table split back to individual tables")
        await load()
      }
    } catch (err: any) {
      fail(err.message || "Failed to split table")
    } finally {
      setSaving(false)
    }
  }

  function openSeat(table: Table | null, booking?: Reservation) {
    setSeatTableId(table?.id || "")
    setSeatBookingId(booking?.id || null)
    setSeatForm(
      booking
        ? { customer_name: booking.customer_name, phone: booking.phone, guest_count: String(booking.party_size), notes: booking.special_requests || "" }
        : { ...emptySeat, guest_count: String(Math.min(2, table?.capacity || 2)) },
    )
    setShowSeat(true)
  }

  async function seatGuests() {
    const table = tables.find((item) => item.id === seatTableId)
    if (!table) return fail("Choose a table to seat the guests")
    const guests = Number(seatForm.guest_count)
    if (!Number.isInteger(guests) || guests < 1) return fail("Guests must be at least 1")
    if (guests > table.capacity) return fail(`${table.name} seats ${table.capacity}`)
    if (sessionFor(table)) return fail(`${table.name} is already occupied`)

    setSaving(true)
    try {
      await SharedPosService.occupyTable(
        table.name,
        "Juice & Food",
        undefined,
        undefined,
        seatForm.customer_name.trim() || "Guests",
      )
      if (seatBookingId) {
        await SharedPosService.updateBookingStatus(seatBookingId, "completed")
      }
      toast.success(`${seatForm.customer_name.trim() || "Guests"} seated at ${table.name}`)
      setShowSeat(false)
      setSeatBookingId(null)
      setSelected(table)
      await load()
    } catch (err: any) {
      fail(`Could not seat guests: ${err.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  async function updateSession(status: "bill_requested" | "closed" | "available") {
    if (!selected) return
    setSaving(true)
    try {
      if (status === "closed" || status === "available") {
        await SharedPosService.releaseTable(selected.name)
        toast.success(`${selected.name} is free & marked available`)
      } else {
        await SharedPosService.setTableStatus(selected.id, "bill_requested")
        toast.success(`Bill requested for ${selected.name}`)
      }
      await load()
    } catch (err: any) {
      fail(`Could not update session: ${err.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  async function setTableState(table: Table, status: "available" | "occupied" | "cleaning" | "reserved" | "bill_requested") {
    try {
      if (status === "available") {
        await SharedPosService.releaseTable(table.name)
        toast.success(`${table.name} marked available`)
      } else if (status === "occupied") {
        await SharedPosService.occupyTable(table.name)
        toast.success(`${table.name} marked occupied`)
      } else {
        await SharedPosService.setTableStatus(table.id, status)
        toast.success(`${table.name} marked ${status.replace("_", " ")}`)
      }
      await load()
    } catch (err: any) {
      fail(err.message || "Failed to update table")
    }
  }

  async function updateBooking(booking: Reservation, status: "arrived" | "cancelled" | "no_show") {
    try {
      await SharedPosService.updateBookingStatus(booking.id, status)
      toast.success(status === "arrived" ? "Marked arrived" : status === "no_show" ? "Marked no-show" : "Booking cancelled")
      await load()
    } catch (err: any) {
      fail(`Could not update booking: ${err.message || err}`)
    }
  }

  async function addTable() {
    const capacity = Number(tableForm.capacity)
    if (!Number.isInteger(capacity) || capacity < 1) return fail("Seats must be at least 1")
    setSaving(true)
    try {
      await SharedPosService.addTable(tableForm.name, capacity)
      toast.success(`${tableForm.name.trim()} added`)
      setShowAddTable(false)
      setTableForm({ name: "", capacity: "4" })
      await load()
    } catch (error) {
      fail(error instanceof Error ? error.message : "Could not add table")
    } finally {
      setSaving(false)
    }
  }

  const availableForSeating = tables.filter((table) => !sessionFor(table))
  const tableName = (id: string | null, name?: string | null) => name || tables.find((t) => t.id === id || t.name === id)?.name || "Unassigned"

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#dce6d9] bg-white/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#808068]">Live floor</p>
          <h3 className="font-serif text-2xl font-bold text-[#343428]">Tables &amp; bookings</h3>
          <p className="text-sm text-[#808068]">Seat guests, track tabs and keep the floor moving.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="h-11 rounded-xl bg-[#D67B6B] hover:bg-[#c26555] text-white" onClick={() => openSeat(selected && !sessionFor(selected) ? selected : null)}>
            <Users className="size-4" /> Seat guests
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => { setForm({ ...emptyBooking, table_id: selected?.id || "" }); setShowBooking(true) }}>
            <Plus className="size-4" /> New booking
          </Button>
          <Button variant="outline" className="h-11 rounded-xl gap-1.5" onClick={() => setShowTransfer(true)}>
            <ArrowRightLeft className="size-4" /> Transfer Table
          </Button>
          <Button variant="outline" className="h-11 rounded-xl gap-1.5" onClick={() => setShowMerge(true)}>
            <GitMerge className="size-4" /> Merge Tables
          </Button>
          {role === "admin" && (
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setShowAddTable(true)}>
              <Plus className="size-4" /> Add table
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => void load()} aria-label="Refresh tables">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Could not load the floor: {loadError}. Apply the latest Supabase migrations and make sure you are signed in.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input className="h-11 rounded-xl pl-9" placeholder="Search table or guest" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E5D8CF]">
          {[
            { key: "all", label: "All Floor" },
            { key: "indoor", label: "Indoor AC" },
            { key: "patio", label: "Garden Patio" },
            { key: "bar", label: "Bar Counter" },
          ].map((z) => (
            <button
              key={z.key}
              onClick={() => setZoneFilter(z.key as any)}
              className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                zoneFilter === z.key ? "bg-[#D67B6B] text-white shadow-xs" : "text-[#808068] hover:text-[#343428]"
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              statusFilter === "all"
                ? "bg-[#343428] text-white border-[#343428] shadow-xs font-bold"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            All ({tables.length})
          </button>
          {(["available", "occupied", "reserved", "cleaning"] as const).map((key) => {
            const active = statusFilter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(active ? "all" : key)}
                className={`rounded-full border px-3 py-1.5 text-xs capitalize transition-all ${
                  statusStyles[key]
                } ${active ? "ring-2 ring-[#D67B6B] font-bold shadow-xs scale-105" : "hover:opacity-90"}`}
              >
                {counts[key] || 0} {key}
              </button>
            )
          })}
          <Badge className="rounded-full bg-[#FAF5F1] px-3 py-1.5 text-[#808068] border border-[#EAB8B5]">Live sync</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleTables.map((table) => {
          const status = statusFor(table)
          const session = sessionFor(table)
          const booking = activeBookingFor(table)
          return (
            <button
              key={table.id}
              onClick={() => setSelected(table)}
              className={`min-h-[168px] rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                statusStyles[status] || statusStyles.available
              } ${selected?.id === table.id ? "ring-2 ring-[#D67B6B]" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold">{table.name}</p>
                  <p className="text-xs opacity-70">Seats {table.capacity}</p>
                </div>
                <Badge
                  className={`capitalize font-semibold text-xs border ${
                    status === "reserved"
                      ? "bg-violet-100 text-violet-900 border-violet-300"
                      : "bg-white/80 text-current border-transparent"
                  }`}
                >
                  {status === "reserved" && booking
                    ? `Booked ${formatTime(booking.reserved_for)}`
                    : status.replace("_", " ")}
                </Badge>
              </div>
              {session ? (
                <div className="mt-5 space-y-0.5">
                  <p className="font-bold text-base truncate">{session.customer_name}</p>
                  <p className="text-xs opacity-80">{session.guest_count} guests · {minutesSince(session.seated_at)} min open</p>
                </div>
              ) : booking ? (
                <div className="mt-5 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-violet-950 truncate">
                    <CalendarDays className="size-4 shrink-0 text-violet-600" />
                    <span>{booking.customer_name}</span>
                  </div>
                  <p className="text-xs text-violet-800 font-medium">
                    {booking.party_size} guests · {booking.phone}
                  </p>
                  <p className="text-[11px] text-violet-600 font-medium">
                    Booked for {formatTime(booking.reserved_for)} ({booking.duration_minutes} min)
                  </p>
                  {booking.special_requests && (
                    <p className="text-[11px] text-violet-700/80 italic truncate">
                      “{booking.special_requests}”
                    </p>
                  )}
                </div>
              ) : status === "occupied" ? (
                <div className="mt-5 space-y-0.5">
                  <p className="font-bold text-base">Occupied</p>
                  <p className="text-xs opacity-80">Dine-in guests seated</p>
                </div>
              ) : (
                <p className="mt-8 text-sm font-medium">{status === "cleaning" ? "Being cleaned" : "Ready for guests"}</p>
              )}
            </button>
          )
        })}
        {!visibleTables.length && !loadError && (
          <p className="col-span-full rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {tables.length ? "No tables match your search." : "No tables yet. An admin can add tables with “Add table”."}
          </p>
        )}
      </div>

      <Card className="rounded-2xl border-[#dce6d9]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="size-4" /> Upcoming bookings ({reservations.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.map((booking) => (
            <div key={booking.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-semibold">{booking.customer_name} · {booking.party_size} guests</p>
                <p className="text-xs text-muted-foreground">{formatTime(booking.reserved_for)} · {booking.duration_minutes} min · {tableName(booking.table_id, booking.table_name)} · {booking.phone}</p>
                {booking.special_requests && <p className="text-xs text-muted-foreground">“{booking.special_requests}”</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" className="bg-[#D67B6B] hover:bg-[#c26555] text-white" onClick={() => openSeat(tables.find((t) => t.id === booking.table_id || t.name === booking.table_name) || null, booking)}>Seat now</Button>
                <Button size="sm" variant="outline" onClick={() => void updateBooking(booking, "no_show")}>No-show</Button>
                <Button size="sm" variant="ghost" onClick={() => void updateBooking(booking, "cancelled")}>Cancel</Button>
              </div>
            </div>
          ))}
          {!upcoming.length && <p className="py-4 text-center text-sm text-muted-foreground">No upcoming bookings.</p>}
        </CardContent>
      </Card>

      {selected && (
        <Card className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] overflow-auto rounded-t-3xl border-[#E5D8CF] bg-[#FAF5F1] shadow-2xl sm:inset-y-4 sm:left-auto sm:right-4 sm:w-[420px] sm:rounded-3xl">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#808068]">Table panel</p>
                <CardTitle className="text-2xl text-[#343428]">{selected.name}</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Capacity: {selected.capacity} guests</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Close table panel"><X className="size-5" /></Button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Badge className={`${statusStyles[statusFor(selected)]} w-fit capitalize font-semibold`}>
                {statusFor(selected).replace("_", " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Status Selector: Staff can directly update table status with 1 click */}
            <div className="rounded-2xl border border-[#E5D8CF] bg-white p-3 space-y-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Update Table Status</p>
              <div className="grid grid-cols-5 gap-1">
                <Button
                  size="sm"
                  type="button"
                  variant={statusFor(selected) === "available" ? "default" : "outline"}
                  className={statusFor(selected) === "available" ? "bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-8 px-1" : "text-[11px] h-8 px-1"}
                  onClick={() => void setTableState(selected, "available")}
                >
                  Available
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={statusFor(selected) === "occupied" ? "default" : "outline"}
                  className={statusFor(selected) === "occupied" ? "bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-8 px-1" : "text-[11px] h-8 px-1"}
                  onClick={() => void setTableState(selected, "occupied")}
                >
                  Occupied
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={statusFor(selected) === "reserved" ? "default" : "outline"}
                  className={statusFor(selected) === "reserved" ? "bg-violet-600 hover:bg-violet-700 text-white text-[11px] h-8 px-1" : "text-[11px] h-8 px-1"}
                  onClick={() => void setTableState(selected, "reserved")}
                >
                  Reserved
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={statusFor(selected) === "cleaning" ? "default" : "outline"}
                  className={statusFor(selected) === "cleaning" ? "bg-blue-600 hover:bg-blue-700 text-white text-[11px] h-8 px-1" : "text-[11px] h-8 px-1"}
                  onClick={() => void setTableState(selected, "cleaning")}
                >
                  Cleaning
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={statusFor(selected) === "bill_requested" ? "default" : "outline"}
                  className={statusFor(selected) === "bill_requested" ? "bg-purple-600 hover:bg-purple-700 text-white text-[11px] h-8 px-1" : "text-[11px] h-8 px-1"}
                  onClick={() => void setTableState(selected, "bill_requested")}
                >
                  Bill Req.
                </Button>
              </div>
            </div>

            {(statusFor(selected) === "occupied" || statusFor(selected) === "bill_requested" || selectedSession) ? (
              <>
                <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{selectedSession?.customer_name || "Dine-in Guests"}</p>
                    <Badge className="bg-amber-200 text-amber-900 border-none text-[10px]">
                      {statusFor(selected) === "bill_requested" ? "Bill Requested" : "Active Tab"}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedSession ? `${selectedSession.guest_count} guests · ${minutesSince(selectedSession.seated_at)} minutes open` : "Guests seated at table"}
                  </p>
                  <p className="mt-2 text-xs text-amber-800">
                    When guests leave, click below to free this table for incoming guests.
                  </p>
                </div>

                {(() => {
                  const activeOrder = orders.find(
                    (o) => o.table_name.toLowerCase() === selected.name.toLowerCase() && (o.status === "open" || o.status === "paid")
                  )
                  if (!activeOrder) return null
                  return (
                    <div className="rounded-2xl border border-[#E5D8CF] bg-white p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-gray-900">
                        <span className="font-mono">{activeOrder.order_number}</span>
                        <Badge className="bg-[#808068] text-white">LKR {activeOrder.total.toLocaleString()}</Badge>
                      </div>
                      <div className="divide-y divide-gray-100 max-h-36 overflow-y-auto">
                        {activeOrder.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between py-1 text-gray-600">
                            <span>{it.quantity}x {it.name}</span>
                            <span>LKR {(it.price * it.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Main Action to release when guests leave */}
                <Button
                  className="h-12 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm gap-2"
                  onClick={() => void updateSession("closed")}
                  disabled={saving}
                >
                  <Check className="size-4" /> Guests Left · Mark Available
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl"
                    onClick={() => void updateSession("bill_requested")}
                    disabled={saving || statusFor(selected) === "bill_requested"}
                  >
                    <Receipt className="size-4 mr-1.5" /> Request bill
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl"
                    onClick={() => void setTableState(selected, "cleaning")}
                    disabled={saving}
                  >
                    Mark cleaning
                  </Button>
                </div>

                {onStartOrder && (
                  <Button
                    className="h-11 w-full bg-[#D67B6B] hover:bg-[#c26555] text-white rounded-xl gap-2"
                    onClick={() => onStartOrder(selected.name)}
                  >
                    <ShoppingBag className="size-4" /> Take / add items in POS
                  </Button>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-11 flex-1 gap-1.5 rounded-xl border-[#808068]/30 text-[#808068] hover:bg-[#FAF5F1]"
                    onClick={() => {
                      setTransferSource(selected.id)
                      setShowTransfer(true)
                    }}
                  >
                    <ArrowRightLeft className="size-4" /> Transfer Tab
                  </Button>
                  {selected.name.includes("+") && (
                    <Button
                      variant="outline"
                      className="h-11 flex-1 gap-1.5 rounded-xl border-amber-600/40 text-amber-900 hover:bg-amber-50"
                      onClick={() => handleSplitTable(selected.id)}
                    >
                      <Split className="size-4" /> Split Merged
                    </Button>
                  )}
                </div>
              </>
            ) : statusFor(selected) === "reserved" ? (
              <>
                {(() => {
                  const b = activeBookingFor(selected) || bookingsFor(selected)[0]
                  return (
                    <div className="rounded-2xl border-2 border-violet-300 bg-violet-50/80 p-4 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-violet-200 rounded-xl text-violet-800">
                            <CalendarDays className="size-5" />
                          </div>
                          <div>
                            <p className="font-bold text-violet-950 text-base leading-tight">
                              {b?.customer_name || "Reserved Guest"}
                            </p>
                            <p className="text-xs text-violet-700">{b?.phone || "No phone provided"}</p>
                          </div>
                        </div>
                        <Badge className="bg-violet-200 text-violet-900 border-violet-300 capitalize text-xs font-semibold px-2.5 py-0.5">
                          {b?.status || "Reserved"}
                        </Badge>
                      </div>

                      {b && (
                        <div className="grid grid-cols-2 gap-2 text-xs bg-white/90 p-3 rounded-xl border border-violet-200 text-violet-950">
                          <div>
                            <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Party Size</span>
                            <span className="font-bold text-sm">{b.party_size} Guests</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Reserved Time</span>
                            <span className="font-bold text-sm">{formatTime(b.reserved_for)}</span>
                          </div>
                          <div className="col-span-2 pt-1.5 border-t border-violet-100 flex items-center justify-between text-[11px] text-gray-600">
                            <span>Duration: {b.duration_minutes} minutes</span>
                            {b.special_requests && (
                              <span className="text-violet-800 italic truncate max-w-[200px]" title={b.special_requests}>
                                “{b.special_requests}”
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Primary Action: Seat Guests Now */}
                      <Button
                        className="h-12 w-full bg-[#D67B6B] hover:bg-[#c26555] text-white font-semibold text-sm rounded-xl shadow-sm gap-2"
                        onClick={() => openSeat(selected, b)}
                        disabled={saving}
                      >
                        <Users className="size-4" /> Seat Guests Now
                      </Button>

                      <div className="grid grid-cols-2 gap-2">
                        {b && b.status !== "arrived" ? (
                          <Button
                            variant="outline"
                            className="h-10 rounded-xl border-violet-300 text-violet-800 hover:bg-violet-100 font-semibold text-xs"
                            onClick={() => void updateBooking(b, "arrived")}
                            disabled={saving}
                          >
                            Mark Arrived
                          </Button>
                        ) : b ? (
                          <Button
                            variant="outline"
                            className="h-10 rounded-xl border-amber-300 text-amber-900 hover:bg-amber-50 font-semibold text-xs"
                            onClick={() => void updateBooking(b, "no_show")}
                            disabled={saving}
                          >
                            Mark No-show
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          className="h-10 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold text-xs"
                          onClick={() => {
                            if (b) {
                              void updateBooking(b, "cancelled")
                            } else {
                              void setTableState(selected, "available")
                            }
                          }}
                          disabled={saving}
                        >
                          Cancel Booking
                        </Button>
                      </div>

                      {onStartOrder && (
                        <Button
                          variant="outline"
                          className="h-10 w-full border-[#808068] text-[#808068] hover:bg-white rounded-xl gap-2 font-semibold text-xs"
                          onClick={() => {
                            if (b) void openSeat(selected, b)
                            onStartOrder(selected.name)
                          }}
                        >
                          <ShoppingBag className="size-4" /> Seat &amp; Start Dine-in Order in POS
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        className="w-full text-xs text-gray-600 hover:text-gray-900"
                        onClick={() => void setTableState(selected, "available")}
                        disabled={saving}
                      >
                        Release Table to Available
                      </Button>
                    </div>
                  )
                })()}
              </>
            ) : (
              <>
                {selectedBookings.map((booking) => (
                  <div key={booking.id} className="space-y-2 rounded-2xl bg-violet-50 p-4">
                    <p className="font-semibold">{booking.customer_name}</p>
                    <p className="text-sm">{booking.party_size} guests · {formatTime(booking.reserved_for)} · {booking.duration_minutes} min</p>
                    <p className="text-sm">{booking.phone}</p>
                    {booking.special_requests && <p className="text-xs">{booking.special_requests}</p>}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => void updateBooking(booking, "arrived")}>Mark arrived</Button>
                      <Button size="sm" className="bg-[#D67B6B] hover:bg-[#c26555] text-white" onClick={() => openSeat(selected, booking)}>Seat now</Button>
                    </div>
                    <Button size="sm" variant="ghost" className="w-full" onClick={() => void updateBooking(booking, "cancelled")}>Cancel booking</Button>
                  </div>
                ))}
                <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                  {selected.status === "cleaning"
                    ? "Table is currently marked for cleaning."
                    : selectedBookings.length
                    ? "Walk-ins can still be seated before the next booking."
                    : "No active session. Seat walk-in guests or take an order."}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-11 bg-[#D67B6B] hover:bg-[#c26555] text-white rounded-xl" onClick={() => openSeat(selected)}>Seat guests</Button>
                  <Button variant="outline" className="h-11 rounded-xl" onClick={() => { setForm({ ...emptyBooking, table_id: selected.id }); setShowBooking(true) }}>New booking</Button>
                </div>
                {onStartOrder && (
                  <Button
                    variant="outline"
                    className="h-11 w-full border-[#D67B6B] text-[#D67B6B] hover:bg-[#FAF5F1] rounded-xl gap-2"
                    onClick={() => onStartOrder(selected.name)}
                  >
                    <ShoppingBag className="size-4" /> Start POS Order
                  </Button>
                )}
                <Button variant="ghost" className="w-full" onClick={() => void setTableState(selected, selected.status === "cleaning" ? "available" : "cleaning")}>
                  {selected.status === "cleaning" ? "Mark clean & available" : "Mark as cleaning"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {showBooking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl">
            <CardHeader><CardTitle>New booking</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Customer name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" min="1" placeholder="Guests" value={form.party_size} onChange={(e) => setForm({ ...form, party_size: e.target.value })} />
                <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Table" value={form.table_id} onChange={(e) => setForm({ ...form, table_id: e.target.value })}>
                  <option value="">Auto assign table</option>
                  {tables.filter((t) => t.capacity >= Number(form.party_size || 1)).map((t) => <option key={t.id} value={t.id}>{t.name} · {t.capacity} seats</option>)}
                </select>
              </div>
              <Input type="datetime-local" value={form.reserved_for} onChange={(e) => setForm({ ...form, reserved_for: e.target.value })} />
              <div className="flex gap-2">
                {[60, 90, 120].map((value) => (
                  <Button key={value} type="button" variant={form.duration_minutes === String(value) ? "default" : "outline"} onClick={() => setForm({ ...form, duration_minutes: String(value) })}>{value} min</Button>
                ))}
              </div>
              <Input placeholder="Special requests" value={form.special_requests} onChange={(e) => setForm({ ...form, special_requests: e.target.value })} />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowBooking(false)}>Cancel</Button>
                <Button className="bg-[#D67B6B] hover:bg-[#c26555] text-white" disabled={saving || !form.customer_name || !form.phone || !form.reserved_for} onClick={() => void createBooking()}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarDays className="size-4" />} Confirm booking
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showSeat && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-lg rounded-3xl">
            <CardHeader><CardTitle>Seat guests</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label="Table to seat" value={seatTableId} onChange={(e) => setSeatTableId(e.target.value)}>
                <option value="">Choose a table…</option>
                {availableForSeating.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.capacity} seats</option>)}
              </select>
              <Input placeholder="Customer name" value={seatForm.customer_name} onChange={(e) => setSeatForm({ ...seatForm, customer_name: e.target.value })} />
              <Input placeholder="Phone (optional)" value={seatForm.phone} onChange={(e) => setSeatForm({ ...seatForm, phone: e.target.value })} />
              <Input type="number" min="1" placeholder="Guests" value={seatForm.guest_count} onChange={(e) => setSeatForm({ ...seatForm, guest_count: e.target.value })} />
              <Input placeholder="Notes" value={seatForm.notes} onChange={(e) => setSeatForm({ ...seatForm, notes: e.target.value })} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setShowSeat(false); setSeatBookingId(null) }}>Cancel</Button>
                <Button className="bg-[#D67B6B] hover:bg-[#c26555] text-white" disabled={saving || !seatTableId} onClick={() => void seatGuests()}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Seat guests
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showAddTable && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-sm rounded-3xl">
            <CardHeader><CardTitle>Add table</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Table name (e.g. Table 09)" value={tableForm.name} onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })} />
              <Input type="number" min="1" placeholder="Seats" value={tableForm.capacity} onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowAddTable(false)}>Cancel</Button>
                <Button className="bg-[#D67B6B] hover:bg-[#c26555] text-white" disabled={saving || !tableForm.name.trim()} onClick={() => void addTable()}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add table
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: TRANSFER TABLE */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <CardHeader className="bg-[#808068] text-white rounded-t-3xl p-5">
              <CardTitle className="text-lg font-serif">Transfer Table / Open Tab</CardTitle>
              <p className="text-xs text-[#F4EBE4]/85">
                Move guests and their active order tab from one table to another
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Source Table (Current Occupied)</label>
                <select
                  value={transferSource}
                  onChange={(e) => setTransferSource(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm bg-white"
                >
                  <option value="">-- Choose Occupied Table --</option>
                  {tables
                    .filter((t) => sessionFor(t) || t.status === "occupied")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({sessionFor(t)?.customer_name || "Occupied"})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Target Table (Move To)</label>
                <select
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm bg-white"
                >
                  <option value="">-- Choose Available Table --</option>
                  {tables
                    .filter((t) => !sessionFor(t) && t.status !== "occupied" && t.id !== transferSource)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.capacity} seats
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="ghost" onClick={() => setShowTransfer(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#D67B6B] text-white hover:bg-[#c26555]"
                  disabled={saving || !transferSource || !transferTarget}
                  onClick={() => void handleTransferTable()}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <ArrowRightLeft className="size-4" />}
                  Confirm Transfer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: MERGE TABLES */}
      {showMerge && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <CardHeader className="bg-[#808068] text-white rounded-t-3xl p-5">
              <CardTitle className="text-lg font-serif">Merge Tables for Group</CardTitle>
              <p className="text-xs text-[#F4EBE4]/85">
                Combine two tables to seat large parties under a single combined tab
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Primary Table</label>
                <select
                  value={mergePrimary}
                  onChange={(e) => setMergePrimary(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm bg-white"
                >
                  <option value="">-- Choose Primary Table --</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.capacity} seats ({t.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Secondary Table to Join</label>
                <select
                  value={mergeSecondary}
                  onChange={(e) => setMergeSecondary(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm bg-white"
                >
                  <option value="">-- Choose Table to Merge --</option>
                  {tables
                    .filter((t) => t.id !== mergePrimary)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.capacity} seats ({t.status})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="ghost" onClick={() => setShowMerge(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#D67B6B] text-white hover:bg-[#c26555]"
                  disabled={saving || !mergePrimary || !mergeSecondary}
                  onClick={() => void handleMergeTables()}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />}
                  Confirm Merge
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default TablesWorkspace
