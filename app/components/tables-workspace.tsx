"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit2,
  Loader2,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShoppingBag,
  Split,
  Table2,
  Users,
  X,
  ArrowRightLeft,
  GitMerge,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { SharedPosService, tablesMatch, normalizeTableName, type SharedOrder, type SharedBooking, type SharedTable } from "@/lib/shared-pos-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { canManageTables, normalizeRole } from "@/lib/rbac/permissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Table = SharedTable
type Reservation = {
  id: string
  customer_name: string
  phone: string
  party_size: number
  reserved_for: string
  duration_minutes: number
  table_id: string | null
  table_name?: string
  status: string
  source: string
  special_requests: string
}
type Session = {
  id: string
  table_id: string
  table_name?: string
  customer_name: string
  phone: string | null
  guest_count: number
  seated_at: string
  status: string
  notes: string
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

const emptyBooking = {
  customer_name: "",
  phone: "",
  party_size: "2",
  reserved_for: "",
  duration_minutes: "90",
  table_id: "",
  special_requests: "",
}
const emptySeat = {
  customer_name: "Walk-in",
  phone: "",
  guest_count: "2",
  notes: "",
}

function formatTime(value: string) {
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return new Intl.DateTimeFormat("en-LK", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(d)
  } catch {
    return value
  }
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat("en-LK", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d)
  } catch {
    return iso
  }
}

function minutesSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
}

function bookingWindow(booking: { reserved_for: string; duration_minutes: number }) {
  const start = new Date(booking.reserved_for).getTime()
  return { start: start - HOLD_BEFORE_MIN * 60000, end: start + booking.duration_minutes * 60000 }
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end
}

function toIso(local: string) {
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function TablesWorkspace({
  role = "cashier",
  initialTab = "floor",
  onStartOrder,
  onNavigateToBooked,
}: {
  role?: "admin" | "cashier"
  initialTab?: "floor" | "bookings"
  onStartOrder?: (tableName: string) => void
  onNavigateToBooked?: () => void
}) {
  const supabase = useMemo(() => createClient(), [])

  // Primary workspace view: "floor" (floor plan) or "bookings" (reservations list)
  const [activeTab, setActiveTab] = useState<"floor" | "bookings">(initialTab)

  const [tables, setTables] = useState<Table[]>([])
  const [allBookings, setAllBookings] = useState<SharedBooking[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<Table | null>(null)
  const [search, setSearch] = useState("")
  const [bookingSearch, setBookingSearch] = useState("")
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("all")
  const [loadError, setLoadError] = useState<string | null>(null)

  // Modals
  const [showBooking, setShowBooking] = useState(false)
  const [showSeat, setShowSeat] = useState(false)
  const [showAddTable, setShowAddTable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [seatTableId, setSeatTableId] = useState("")
  const [seatBookingId, setSeatBookingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyBooking)
  const [seatForm, setSeatForm] = useState(emptySeat)
  const [tableForm, setTableForm] = useState({ name: "", capacity: "4" })

  // Reschedule / Move modal state
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleData, setRescheduleData] = useState<{
    booking: Reservation | SharedBooking | null
    table_id: string
    reserved_for: string
    duration_minutes: string
    party_size: string
    customer_name: string
    phone: string
    special_requests: string
  }>({
    booking: null,
    table_id: "",
    reserved_for: "",
    duration_minutes: "90",
    party_size: "2",
    customer_name: "",
    phone: "",
    special_requests: "",
  })

  const [orders, setOrders] = useState<SharedOrder[]>(() => SharedPosService.getOrders())
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferSource, setTransferSource] = useState("")
  const [transferTarget, setTransferTarget] = useState("")

  const [showMerge, setShowMerge] = useState(false)
  const [mergePrimary, setMergePrimary] = useState("")
  const [mergeSecondary, setMergeSecondary] = useState("")
  const [zoneFilter, setZoneFilter] = useState<"all" | "indoor" | "patio" | "bar">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "occupied" | "reserved" | "cleaning" | "paid" | "unpaid">("all")

  useEffect(() => {
    return SharedPosService.subscribeOrders(setOrders)
  }, [])

  const syncFromCache = useCallback(() => {
    const sharedTables = SharedPosService.getTables()
    const sharedBookings = SharedPosService.getBookings()
    const sharedSessions = SharedPosService.getSessions()

    setTables(sharedTables.map((t) => ({ ...t })))
    setAllBookings(sharedBookings)
    setOrders(SharedPosService.getOrders())
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
          table_id: b.table_id || null,
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
    setSelected((prev) => {
      if (!prev) return null
      const updated = sharedTables.find((t) => t.id === prev.id || tablesMatch(t.name, prev.name))
      return updated ? { ...updated } : prev
    })
    setLoadError(null)
  }, [])

  const load = useCallback(async () => {
    try {
      await SharedPosService.refreshFromApi(true)
    } catch {}
    syncFromCache()
  }, [syncFromCache])

  useEffect(() => {
    // 1. Instant local sync from cache (zero layout shift / flicker)
    syncFromCache()

    // 2. Fetch authoritative database state once in background
    void SharedPosService.refreshFromApi(true).then(() => syncFromCache())

    // 3. Subscribe to SharedPosService cache updates (pure state updates, NO recursive fetch!)
    const unsubTables = SharedPosService.subscribeTables(() => syncFromCache())
    const unsubBookings = SharedPosService.subscribeBookings(() => syncFromCache())
    const unsubSessions = SharedPosService.subscribeSessions(() => syncFromCache())

    // 4. Stable background polling at calm 15-second interval
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void SharedPosService.refreshFromApi(false).then(() => syncFromCache())
    }, 15000)

    // 5. Hydrate on tab focus
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void SharedPosService.refreshFromApi(true).then(() => syncFromCache())
      }
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      unsubTables()
      unsubBookings()
      unsubSessions()
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [syncFromCache])

  const sessionFor = (table: Table) =>
    sessions.find(
      (item) =>
        (item.table_id === table.id || (item.table_name && item.table_name !== "Table" && tablesMatch(item.table_name, table.name))) &&
        item.status !== "closed"
    )

  const bookingsFor = (table: Table) =>
    reservations.filter((item) => {
      if (item.table_id && (item.table_id === table.id || String(item.table_id) === String(table.id))) {
        return true
      }
      if (item.table_name && table.name && tablesMatch(item.table_name, table.name)) {
        return true
      }
      return false
    })

  /** Active booking holding this table right now according to hold rules (arrived or in 30m window) */
  const heldBookingFor = (table: Table) => {
    const tableBookings = bookingsFor(table).filter((b) => ACTIVE_BOOKING.includes(b.status))
    if (!tableBookings.length) return null

    const now = Date.now()
    return (
      tableBookings.find((b) => {
        const window = bookingWindow(b)
        return b.status === "arrived" || (now >= window.start && now <= window.end)
      }) || null
    )
  }

  /** Nearest upcoming booking scheduled for later */
  const nextUpcomingBookingFor = (table: Table) => {
    const tableBookings = bookingsFor(table).filter((b) => ACTIVE_BOOKING.includes(b.status))
    const now = Date.now()
    const future = tableBookings
      .filter((b) => new Date(b.reserved_for).getTime() > now)
      .sort((a, b) => new Date(a.reserved_for).getTime() - new Date(b.reserved_for).getTime())
    return future[0] || null
  }

  const activeBookingFor = (table: Table) => heldBookingFor(table) || nextUpcomingBookingFor(table)

  const statusFor = (table: Table): "available" | "occupied" | "reserved" | "cleaning" | "bill_requested" => {
    // 1. First priority: active seating session (open or bill_requested)
    const session = sessionFor(table)
    if (session && session.status !== "closed") {
      return session.status === "bill_requested" ? "bill_requested" : "occupied"
    }

    // 2. Second priority: active open (unpaid) dine-in order
    const openOrder = orders.find(
      (o) => o.status === "open" && tablesMatch(o.table_name, table.name)
    )
    if (openOrder) return "occupied"

    // 3. Third priority: active reservation currently holding this table
    const held = heldBookingFor(table)
    if (held) return "reserved"

    // 4. Fourth priority: table explicit status, respecting release timestamps
    if (table.status === "occupied" || table.status === "bill_requested") {
      if (table.releasedAt && table.occupiedAt) {
        if (new Date(table.releasedAt).getTime() >= new Date(table.occupiedAt).getTime()) {
          return "available"
        }
      }
      return table.status
    }

    if (table.status === "cleaning" || table.status === "reserved") {
      return table.status
    }

    return "available"
  }

  const getActiveOrderForTable = (table: Table | null | undefined): SharedOrder | undefined => {
    if (!table) return undefined
    const session = sessionFor(table)
    const isOccupied = (session && session.status !== "closed") || table.status === "occupied" || table.status === "bill_requested"
    if (!isOccupied) return undefined

    const orderMatch = session?.notes?.match(/Order\s*#?([A-Za-z0-9-]+)/i)
    const sessionOrderNum = orderMatch ? orderMatch[1] : table.orderNumber

    // 1. First priority: any active "open" (unpaid) order directly matching this table
    const openOrder = orders.find(
      (o) => o.status === "open" && tablesMatch(o.table_name, table.name)
    )
    if (openOrder) return openOrder

    // 2. Second priority: order referenced explicitly by session notes or table.orderNumber, MUST match this table
    if (sessionOrderNum) {
      const match = orders.find(
        (o) =>
          o.order_number?.toLowerCase() === sessionOrderNum.toLowerCase() &&
          (tablesMatch(o.table_name, table.name) || !o.table_name)
      )
      if (match) return match
    }

    // 3. Third priority: Most recent order for this table (open or paid)
    const releasedTime = table.releasedAt ? new Date(table.releasedAt).getTime() : 0
    const now = Date.now()

    const recentOrder = orders.find((o) => {
      if (!tablesMatch(o.table_name, table.name)) return false
      if (o.status !== "open" && o.status !== "paid") return false
      if (!o.created_at) return true
      const orderTime = new Date(o.created_at).getTime()
      if (now - orderTime > 12 * 60 * 60 * 1000) return false
      if (releasedTime && releasedTime >= orderTime) return false
      return true
    })

    return recentOrder
  }

  const visibleTables = tables.filter((table) => {
    const q = search.trim().toLowerCase()
    const st = statusFor(table)

    if (statusFilter === "paid") {
      if (st !== "occupied" && st !== "bill_requested") return false
      const o = getActiveOrderForTable(table)
      return Boolean(o && (o.status === "paid" || o.payment_status === "paid"))
    }
    if (statusFilter === "unpaid") {
      if (st !== "occupied" && st !== "bill_requested") return false
      const o = getActiveOrderForTable(table)
      return Boolean(!o || (o.status !== "paid" && o.payment_status !== "paid"))
    }
    if (statusFilter !== "all" && st !== statusFilter) return false

    const matchesSearch =
      !q ||
      table.name.toLowerCase().includes(q) ||
      sessionFor(table)?.customer_name.toLowerCase().includes(q) ||
      bookingsFor(table).some((b) => b.customer_name.toLowerCase().includes(q))
    if (!matchesSearch) return false

    if (zoneFilter === "indoor")
      return !table.name.toLowerCase().includes("patio") && !table.name.toLowerCase().includes("bar") && !table.name.toLowerCase().includes("terrace")
    if (zoneFilter === "patio")
      return table.name.toLowerCase().includes("patio") || table.name.toLowerCase().includes("terrace") || table.name.toLowerCase().includes("garden") || Number(table.name.replace(/\D/g, "")) >= 7
    if (zoneFilter === "bar")
      return table.name.toLowerCase().includes("bar") || table.name.toLowerCase().includes("counter")
    return true
  })

  // Filtered reservations for the Reservations tab
  const filteredBookings = useMemo(() => {
    return allBookings.filter((b) => {
      if (bookingStatusFilter !== "all") {
        if (bookingStatusFilter === "active" && !["pending", "confirmed", "arrived"].includes(b.status)) return false
        if (bookingStatusFilter === "seated" && b.status !== "seated" && b.status !== "completed") return false
        if (bookingStatusFilter === "cancelled" && b.status !== "cancelled" && b.status !== "no_show") return false
      }
      if (!bookingSearch.trim()) return true
      const q = bookingSearch.toLowerCase()
      return (
        b.customer_name.toLowerCase().includes(q) ||
        b.phone.toLowerCase().includes(q) ||
        (b.table_name && b.table_name.toLowerCase().includes(q))
      )
    })
  }, [allBookings, bookingStatusFilter, bookingSearch])

  // KPI Metrics for Reservations
  const bookingMetrics = useMemo(() => {
    const total = allBookings.length
    const confirmed = allBookings.filter((b) => b.status === "confirmed" || b.status === "pending").length
    const arrived = allBookings.filter((b) => b.status === "arrived").length
    const seated = allBookings.filter((b) => b.status === "seated" || b.status === "completed").length
    const availableTables = tables.filter((t) => statusFor(t) === "available").length
    return { total, confirmed, arrived, seated, availableTables }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBookings, tables, sessions, reservations])

  const counts = useMemo(() => {
    const tally = { available: 0, reserved: 0, occupied: 0, cleaning: 0, bill_requested: 0, paid: 0, unpaid: 0 } as Record<string, number>
    tables.forEach((table) => {
      const st = statusFor(table)
      tally[st] = (tally[st] || 0) + 1
      if (st === "occupied" || st === "bill_requested") {
        const o = getActiveOrderForTable(table)
        if (o && (o.status === "paid" || o.payment_status === "paid")) {
          tally.paid = (tally.paid || 0) + 1
        } else {
          tally.unpaid = (tally.unpaid || 0) + 1
        }
      }
    })
    return tally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, sessions, reservations, orders])

  const selectedSession = selected ? sessionFor(selected) : undefined
  const selectedBookings = selected ? bookingsFor(selected) : []
  const upcoming = reservations

  function fail(message: string) {
    toast.error(message)
  }

  /** Smallest free table that fits the party and has no clashing booking. */
  function pickTable(partySize: number, startIso: string, duration: number, ignoreBookingId?: string) {
    const window = {
      start: new Date(startIso).getTime() - HOLD_BEFORE_MIN * 60000,
      end: new Date(startIso).getTime() + duration * 60000,
    }
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
      const table = tables.find((item) => item.id === tableId || item.name === tableId)
      if (!table) return fail("Selected table no longer exists")
      if (table.capacity < partySize) return fail(`${table.name} seats ${table.capacity}`)
      const clash = bookingsFor(table).find((b) =>
        overlaps(
          { start: new Date(startIso).getTime() - HOLD_BEFORE_MIN * 60000, end: new Date(startIso).getTime() + duration * 60000 },
          bookingWindow(b),
        ),
      )
      if (clash) return fail(`${table.name} is already booked at ${formatTime(clash.reserved_for)} for ${clash.customer_name}`)
    } else {
      const auto = pickTable(partySize, startIso, duration)
      if (!auto) return fail("No table is free for that party size and time")
      tableId = auto.id
    }

    setSaving(true)
    try {
      const targetTable = tables.find((t) => t.id === tableId || t.name === tableId)
      await SharedPosService.addBooking({
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        party_size: partySize,
        reserved_for: startIso,
        duration_minutes: duration,
        table_id: targetTable?.id || tableId,
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

  function openSeat(table: Table | null, booking?: Reservation | SharedBooking) {
    setSeatTableId(table?.id || "")
    setSeatBookingId(booking?.id || null)
    setSeatForm(
      booking
        ? {
            customer_name: booking.customer_name,
            phone: booking.phone,
            guest_count: String(booking.party_size),
            notes: booking.special_requests || "",
          }
        : { ...emptySeat, guest_count: String(Math.min(2, table?.capacity || 2)) },
    )
    setShowSeat(true)
  }

  function openReschedule(booking: Reservation | SharedBooking) {
    const localDateTime = booking.reserved_for ? new Date(booking.reserved_for).toISOString().slice(0, 16) : ""
    setRescheduleData({
      booking,
      table_id: booking.table_id || "",
      reserved_for: localDateTime,
      duration_minutes: String(booking.duration_minutes || 90),
      party_size: String(booking.party_size || 2),
      customer_name: booking.customer_name,
      phone: booking.phone,
      special_requests: booking.special_requests || "",
    })
    setShowReschedule(true)
  }

  async function handleReschedule() {
    if (!rescheduleData.booking || !rescheduleData.table_id) return fail("Choose a table")
    const target = tables.find((t) => t.id === rescheduleData.table_id || t.name === rescheduleData.table_id)
    if (!target) return fail("Target table not found")
    setSaving(true)
    try {
      await SharedPosService.updateBooking(rescheduleData.booking.id, {
        customer_name: rescheduleData.customer_name.trim(),
        phone: rescheduleData.phone.trim(),
        party_size: Number(rescheduleData.party_size) || 2,
        duration_minutes: Number(rescheduleData.duration_minutes) || 90,
        reserved_for: rescheduleData.reserved_for
          ? new Date(rescheduleData.reserved_for).toISOString()
          : rescheduleData.booking.reserved_for,
        table_id: target.id,
        table_name: target.name,
        special_requests: rescheduleData.special_requests.trim(),
      })
      toast.success(`Rescheduled booking to ${target.name}`)
      setShowReschedule(false)
      await load()
    } catch (err: any) {
      fail(err.message || "Failed to reschedule booking")
    } finally {
      setSaving(false)
    }
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
      if (seatBookingId) {
        await SharedPosService.seatBooking(seatBookingId, guests)
      } else {
        await SharedPosService.seatWalkIn(table.name, {
          customer_name: seatForm.customer_name.trim() || "Walk-in Guest",
          phone: seatForm.phone.trim() || undefined,
          guest_count: guests,
          notes: seatForm.notes.trim() || undefined,
        })
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
    const curName = selected.name
    setSaving(true)
    try {
      if (status === "closed" || status === "available") {
        const newStatus = await SharedPosService.releaseTable(curName)
        toast.success(`Table ${curName} closed (now ${newStatus || "available"})`)
        setSelected(null)
      } else {
        await SharedPosService.setTableStatus(selected.id, "bill_requested")
        toast.success(`Bill requested for ${curName}`)
      }
      syncFromCache()
      void SharedPosService.refreshFromApi(true).then(() => syncFromCache())
    } catch (err: any) {
      fail(`Could not update session: ${err.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  async function setTableState(
    table: Table,
    status: "available" | "occupied" | "cleaning" | "reserved" | "bill_requested",
  ) {
    try {
      if (status === "available") {
        const newStatus = await SharedPosService.releaseTable(table.name)
        toast.success(`${table.name} released (now ${newStatus || "available"})`)
      } else if (status === "occupied") {
        await SharedPosService.occupyTable(table.name, "Juice & Food", undefined, undefined, "Dine-in Guest")
        toast.success(`${table.name} marked occupied`)
      } else {
        await SharedPosService.setTableStatus(table.id, status)
        toast.success(`${table.name} marked ${status.replace("_", " ")}`)
      }
      syncFromCache()
      void SharedPosService.refreshFromApi(true).then(() => syncFromCache())
    } catch (err: any) {
      fail(err.message || "Failed to update table")
    }
  }

  async function updateBooking(
    booking: Reservation | SharedBooking,
    status: "arrived" | "cancelled" | "no_show" | "confirmed",
  ) {
    try {
      await SharedPosService.updateBookingStatus(booking.id, status)
      toast.success(
        status === "arrived"
          ? "Marked arrived · table held"
          : status === "no_show"
          ? "Marked no-show"
          : status === "confirmed"
          ? "Booking confirmed"
          : "Booking cancelled",
      )
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
  const tableName = (id: string | null, name?: string | null) =>
    name || tables.find((t) => t.id === id || t.name === id)?.name || "Unassigned"

  return (
    <div className="space-y-4">
      {/* Top Banner & Unified Actions */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#dce6d9] bg-white/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex size-2 rounded-full bg-emerald-500 shadow-xs" />
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#808068]">Table Management</p>
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#343428]">Tables &amp; Bookings</h2>
          <p className="text-sm text-[#808068]">
            Manage dining floor tables, seat walk-ins, and schedule reservations in one synchronized place.
          </p>
        </div>

        {/* View Switcher Tabs & Quick Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Floor / Bookings Sub-navigation */}
          <div className="flex items-center rounded-xl bg-[#FAF5F1] p-1 border border-[#E5D8CF]">
            <button
              type="button"
              onClick={() => setActiveTab("floor")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "floor"
                  ? "bg-[#D67B6B] text-white shadow-xs"
                  : "text-[#808068] hover:text-[#343428]"
              }`}
            >
              <Table2 className="size-3.5" /> Floor Plan ({tables.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bookings")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "bookings"
                  ? "bg-violet-700 text-white shadow-xs"
                  : "text-[#808068] hover:text-[#343428]"
              }`}
            >
              <CalendarDays className="size-3.5" /> Bookings ({reservations.length})
            </button>
          </div>

          <Button
            className="h-10 rounded-xl bg-[#D67B6B] hover:bg-[#c26555] text-white text-xs font-semibold gap-1.5"
            onClick={() => {
              setForm({ ...emptyBooking, table_id: selected?.id || "" })
              setShowBooking(true)
            }}
          >
            <Plus className="size-3.5" /> New Booking
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl text-xs font-semibold border-amber-300 text-amber-900 hover:bg-amber-50 gap-1.5"
            onClick={() => openSeat(selected && !sessionFor(selected) ? selected : null)}
          >
            <Users className="size-3.5 text-amber-700" /> Seat Walk-in
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl text-xs gap-1.5 border-[#808068]/30 text-[#808068] hover:bg-[#FAF5F1]"
            onClick={() => setShowTransfer(true)}
          >
            <ArrowRightLeft className="size-3.5" /> Transfer
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl text-xs gap-1.5 border-[#808068]/30 text-[#808068] hover:bg-[#FAF5F1]"
            onClick={() => setShowMerge(true)}
          >
            <GitMerge className="size-3.5" /> Merge
          </Button>

          {canManageTables(role) && (
            <Button
              variant="outline"
              className="h-10 rounded-xl text-xs gap-1"
              onClick={() => setShowAddTable(true)}
            >
              <Plus className="size-3.5" /> Add Table
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={() => void load()}
            aria-label="Refresh floor and bookings"
          >
            <RefreshCw className="size-4 text-[#808068]" />
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Could not load the floor: {loadError}. Make sure you are signed in and SQLite database is accessible.
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. FLOOR PLAN VIEW TAB                                                    */}
      {/* ========================================================================= */}
      {activeTab === "floor" && (
        <div className="space-y-4">
          {/* Floor Search & Zone / Status Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                className="h-11 rounded-xl pl-9 bg-white"
                placeholder="Search table, seated diner, or booking guest..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
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
                  type="button"
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
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "paid" ? "all" : "paid")}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                  statusFilter === "paid"
                    ? "bg-emerald-600 text-white border-emerald-600 font-bold ring-2 ring-emerald-400 shadow-xs scale-105"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                {counts.paid || 0} Paid
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "unpaid" ? "all" : "unpaid")}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                  statusFilter === "unpaid"
                    ? "bg-amber-600 text-white border-amber-600 font-bold ring-2 ring-amber-400 shadow-xs scale-105"
                    : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                }`}
              >
                {counts.unpaid || 0} Unpaid
              </button>
              <Badge className="rounded-full bg-[#FAF5F1] px-3 py-1.5 text-[#808068] border border-[#EAB8B5]">
                Live sync
              </Badge>
            </div>
          </div>

          {/* Floor Tables Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleTables.map((table) => {
              const status = statusFor(table)
              const session = sessionFor(table)
              const heldBooking = heldBookingFor(table)
              const nextBooking = nextUpcomingBookingFor(table)
              const cardOrder = getActiveOrderForTable(table)
              return (
                <button
                  key={table.id}
                  onClick={() => setSelected(table)}
                  className={`min-h-[168px] rounded-2xl border p-4 text-left shadow-xs transition-colors duration-150 hover:shadow-sm ${
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
                      {status === "reserved" && heldBooking
                        ? `Booked ${formatTime(heldBooking.reserved_for)}`
                        : status.replace("_", " ")}
                    </Badge>
                  </div>
                  {session ? (
                    <div className="mt-4 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-bold text-base truncate">{session.customer_name}</p>
                        {cardOrder && (
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 uppercase ${
                              cardOrder.status === "paid" || cardOrder.payment_status === "paid"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {cardOrder.status === "paid" || cardOrder.payment_status === "paid" ? "PAID" : "UNPAID"}
                          </span>
                        )}
                      </div>
                      {cardOrder ? (
                        <div className="flex items-center justify-between text-xs font-semibold text-gray-700 bg-white/70 px-2 py-1 rounded-lg border border-black/5">
                          <span className="font-mono text-[11px] truncate">#{cardOrder.order_number}</span>
                          <span className="font-bold">LKR {Number(cardOrder.total || 0).toLocaleString()}</span>
                        </div>
                      ) : (
                        <p className="text-xs opacity-80">
                          {session.guest_count} guests · {minutesSince(session.seated_at)} min open
                        </p>
                      )}
                      {nextBooking && (
                        <p className="text-[10px] text-amber-900/80 truncate mt-1">
                          Later: {formatTime(nextBooking.reserved_for)} ({nextBooking.customer_name})
                        </p>
                      )}
                    </div>
                  ) : heldBooking ? (
                    <div className="mt-5 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-violet-950 truncate">
                        <CalendarDays className="size-4 shrink-0 text-violet-600" />
                        <span>{heldBooking.customer_name}</span>
                      </div>
                      <p className="text-xs text-violet-800 font-medium">
                        {heldBooking.party_size} guests · {heldBooking.phone}
                      </p>
                      <p className="text-[11px] text-violet-600 font-medium">
                        Booked for {formatTime(heldBooking.reserved_for)} ({heldBooking.duration_minutes} min)
                      </p>
                      {heldBooking.special_requests && (
                        <p className="text-[11px] text-violet-700/80 italic truncate">
                          “{heldBooking.special_requests}”
                        </p>
                      )}
                    </div>
                  ) : status === "occupied" ? (
                    <div className="mt-4 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-bold text-base">Occupied</p>
                        {cardOrder && (
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 uppercase ${
                              cardOrder.status === "paid" || cardOrder.payment_status === "paid"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {cardOrder.status === "paid" || cardOrder.payment_status === "paid" ? "PAID" : "UNPAID"}
                          </span>
                        )}
                      </div>
                      {cardOrder ? (
                        <div className="flex items-center justify-between text-xs font-semibold text-gray-700 bg-white/70 px-2 py-1 rounded-lg border border-black/5">
                          <span className="font-mono text-[11px] truncate">#{cardOrder.order_number}</span>
                          <span className="font-bold">LKR {Number(cardOrder.total || 0).toLocaleString()}</span>
                        </div>
                      ) : (
                        <p className="text-xs opacity-80">Dine-in guests seated</p>
                      )}
                      {nextBooking && (
                        <p className="text-[10px] text-amber-900/80 truncate mt-1">
                          Later: {formatTime(nextBooking.reserved_for)} ({nextBooking.customer_name})
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-5 space-y-1">
                      <p className="text-sm font-medium">{status === "cleaning" ? "Being cleaned" : "Ready for guests"}</p>
                      {nextBooking && (
                        <div className="flex items-center gap-1 text-[11px] text-violet-800 bg-violet-100/70 px-2 py-1 rounded-lg truncate">
                          <CalendarDays className="size-3 shrink-0 text-violet-600" />
                          <span className="truncate">
                            Next: {formatTime(nextBooking.reserved_for)} · {nextBooking.customer_name}
                          </span>
                        </div>
                      )}
                    </div>
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

          {/* Upcoming Bookings Quick Tray */}
          <Card className="rounded-2xl border-[#dce6d9] bg-white/95">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="size-4 text-violet-600" /> Upcoming bookings ({reservations.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-violet-800 hover:text-violet-950 font-semibold gap-1"
                  onClick={() => setActiveTab("bookings")}
                >
                  View Full Bookings Workspace <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.map((booking) => (
                <div
                  key={booking.id}
                  className="flex flex-col gap-2 rounded-xl border border-violet-100 bg-violet-50/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">
                      {booking.customer_name} · {booking.party_size} guests
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(booking.reserved_for)} · {booking.duration_minutes} min ·{" "}
                      {tableName(booking.table_id, booking.table_name)} · {booking.phone}
                    </p>
                    {booking.special_requests && (
                      <p className="text-xs text-violet-800 italic">“{booking.special_requests}”</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      className="bg-[#D67B6B] hover:bg-[#c26555] text-white"
                      onClick={() =>
                        openSeat(
                          tables.find((t) => t.id === booking.table_id || t.name === booking.table_name) || null,
                          booking,
                        )
                      }
                    >
                      Seat now
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openReschedule(booking)}>
                      Move
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void updateBooking(booking, "no_show")}>
                      No-show
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void updateBooking(booking, "cancelled")}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
              {!upcoming.length && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No upcoming reservations. Click “New Booking” above to hold a table.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DEDICATED RESERVATIONS & BOOKINGS TAB                                  */}
      {/* ========================================================================= */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {/* Booking KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#E5D8CF] bg-white p-3.5 shadow-2xs">
              <p className="text-xs font-semibold text-[#808068]">Active / Confirmed</p>
              <p className="font-serif text-2xl font-bold text-[#343428] mt-0.5">{bookingMetrics.confirmed}</p>
              <span className="text-[11px] text-violet-700 font-medium">Upcoming bookings</span>
            </div>
            <div className="rounded-2xl border border-[#E5D8CF] bg-white p-3.5 shadow-2xs">
              <p className="text-xs font-semibold text-[#808068]">Arrived Guests</p>
              <p className="font-serif text-2xl font-bold text-amber-900 mt-0.5">{bookingMetrics.arrived}</p>
              <span className="text-[11px] text-amber-700 font-medium">Ready to be seated</span>
            </div>
            <div className="rounded-2xl border border-[#E5D8CF] bg-white p-3.5 shadow-2xs">
              <p className="text-xs font-semibold text-[#808068]">Seated Today</p>
              <p className="font-serif text-2xl font-bold text-emerald-800 mt-0.5">{bookingMetrics.seated}</p>
              <span className="text-[11px] text-emerald-700 font-medium">Currently dining / finished</span>
            </div>
            <div className="rounded-2xl border border-[#E5D8CF] bg-white p-3.5 shadow-2xs">
              <p className="text-xs font-semibold text-[#808068]">Available Tables</p>
              <p className="font-serif text-2xl font-bold text-[#808068] mt-0.5">
                {bookingMetrics.availableTables} / {tables.length}
              </p>
              <span className="text-[11px] text-[#808068] font-medium">Ready for walk-in or booking</span>
            </div>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                className="h-11 rounded-xl pl-9 bg-white"
                placeholder="Search by customer name, phone, or table..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E5D8CF] overflow-x-auto">
              {[
                { key: "all", label: "All Bookings" },
                { key: "active", label: "Upcoming / Arrived" },
                { key: "seated", label: "Seated" },
                { key: "cancelled", label: "Cancelled / No-show" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setBookingStatusFilter(tab.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                    bookingStatusFilter === tab.key
                      ? "bg-[#D67B6B] text-white shadow-xs"
                      : "text-[#808068] hover:text-[#343428]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bookings Grid */}
          {filteredBookings.length === 0 ? (
            <Card className="rounded-2xl border border-dashed border-[#E5D8CF] p-8 text-center bg-white/60">
              <CalendarDays className="size-10 text-[#808068]/50 mx-auto mb-2" />
              <h4 className="font-semibold text-gray-800">No reservations found</h4>
              <p className="text-xs text-gray-500 mt-1">
                {bookingSearch ? "Try adjusting your search query." : "Hold tables in advance by creating a new reservation."}
              </p>
              <Button
                className="mt-4 h-9 bg-[#D67B6B] hover:bg-[#c26555] text-white rounded-xl text-xs"
                onClick={() => {
                  setForm(emptyBooking)
                  setShowBooking(true)
                }}
              >
                <Plus className="size-3.5 mr-1" /> New Reservation
              </Button>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBookings.map((b) => {
                const table = tables.find((t) => t.id === b.table_id || t.name === b.table_name)
                const currentStatus = table ? statusFor(table) : "available"

                return (
                  <Card
                    key={b.id}
                    className="rounded-2xl border border-[#E5D8CF] bg-white shadow-xs transition hover:shadow-sm"
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 text-base">{b.customer_name}</span>
                            {b.party_size && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-300">
                                {b.party_size} Guests
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone className="size-3 text-gray-400" /> {b.phone || "No phone"}
                          </p>
                        </div>

                        <Badge
                          className={`capitalize text-[10px] font-bold px-2 py-0.5 border-none ${
                            b.status === "confirmed"
                              ? "bg-violet-100 text-violet-800"
                              : b.status === "arrived"
                              ? "bg-amber-100 text-amber-800"
                              : b.status === "seated" || b.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {b.status}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3">
                      {/* Reservation Timing & Table Info */}
                      <div className="rounded-xl bg-[#FAF5F1] p-2.5 text-xs space-y-1.5 border border-[#E5D8CF]/60">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 flex items-center gap-1">
                            <Clock className="size-3.5 text-[#808068]" /> Scheduled:
                          </span>
                          <span className="font-bold text-gray-800">{formatDateTime(b.reserved_for)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 flex items-center gap-1">
                            <Table2 className="size-3.5 text-[#808068]" /> Table:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900">{b.table_name || "Unassigned"}</span>
                            {table && (
                              <Badge
                                className={`text-[9px] px-1.5 py-0 border-none ${
                                  currentStatus === "occupied"
                                    ? "bg-amber-200 text-amber-900"
                                    : currentStatus === "reserved"
                                    ? "bg-violet-200 text-violet-900"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {currentStatus.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {b.duration_minutes && (
                          <div className="flex items-center justify-between text-[11px] text-gray-500">
                            <span>Duration:</span>
                            <span>{b.duration_minutes} min hold</span>
                          </div>
                        )}

                        {b.special_requests && (
                          <div className="pt-1 border-t border-[#E5D8CF]/80 text-[11px] text-[#808068] italic truncate">
                            “{b.special_requests}”
                          </div>
                        )}
                      </div>

                      {/* Actions according to status */}
                      {b.status === "confirmed" && (
                        <div className="space-y-1.5">
                          <Button
                            className="h-10 w-full bg-[#D67B6B] hover:bg-[#c26555] text-white rounded-xl text-xs font-semibold gap-1.5"
                            onClick={() => openSeat(table || null, b)}
                            disabled={saving}
                          >
                            <Users className="size-3.5" /> Seat Guests Now
                          </Button>
                          <div className="grid grid-cols-3 gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg text-[11px] font-medium border-violet-200 text-violet-800 hover:bg-violet-50"
                              onClick={() => void updateBooking(b, "arrived")}
                              disabled={saving}
                            >
                              Arrived
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg text-[11px] font-medium border-gray-200 text-gray-700 hover:bg-gray-50"
                              onClick={() => openReschedule(b)}
                              disabled={saving}
                            >
                              <Edit2 className="size-3 mr-1" /> Move
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg text-[11px] font-medium border-rose-200 text-rose-700 hover:bg-rose-50"
                              onClick={() => void updateBooking(b, "cancelled")}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {b.status === "arrived" && (
                        <div className="space-y-1.5">
                          <Button
                            className="h-10 w-full bg-[#D67B6B] hover:bg-[#c26555] text-white rounded-xl text-xs font-semibold gap-1.5"
                            onClick={() => openSeat(table || null, b)}
                            disabled={saving}
                          >
                            <Users className="size-3.5" /> Seat Arrived Guests
                          </Button>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg text-[11px] font-medium border-gray-200"
                              onClick={() => openReschedule(b)}
                              disabled={saving}
                            >
                              <Edit2 className="size-3 mr-1" /> Reschedule / Move
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg text-[11px] font-medium border-amber-200 text-amber-800 hover:bg-amber-50"
                              onClick={() => void updateBooking(b, "no_show")}
                              disabled={saving}
                            >
                              No-show
                            </Button>
                          </div>
                        </div>
                      )}

                      {(b.status === "seated" || b.status === "completed") && (
                        <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl">
                          <span className="flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="size-3.5 text-emerald-600" /> Guests Seated
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (table) setSelected(table)
                              setActiveTab("floor")
                            }}
                            className="text-[11px] font-bold underline hover:text-emerald-950 flex items-center"
                          >
                            View on Floor <ChevronRight className="size-3" />
                          </button>
                        </div>
                      )}

                      {(b.status === "cancelled" || b.status === "no_show") && (
                        <div className="text-center text-xs text-gray-500 py-1 bg-gray-50 rounded-xl">
                          Booking {b.status.replace("_", " ")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TABLE DETAILS SLIDE-OVER DRAWER (Available in both tabs)              */}
      {/* ========================================================================= */}
      {selected && (
        <Card className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] overflow-auto rounded-t-3xl border-[#E5D8CF] bg-[#FAF5F1] shadow-2xl sm:inset-y-4 sm:left-auto sm:right-4 sm:w-[420px] sm:rounded-3xl">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#808068]">Table panel</p>
                <CardTitle className="text-2xl text-[#343428]">{selected.name}</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Capacity: {selected.capacity} guests</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelected(null)}
                aria-label="Close table panel"
              >
                <X className="size-5" />
              </Button>
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
                  className={
                    statusFor(selected) === "available"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-8 px-1"
                      : "text-[11px] h-8 px-1"
                  }
                  onClick={() => void setTableState(selected, "available")}
                >
                  Available
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={statusFor(selected) === "occupied" ? "default" : "outline"}
                  className={
                    statusFor(selected) === "occupied"
                      ? "bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-8 px-1"
                      : "text-[11px] h-8 px-1"
                  }
                  onClick={() => void setTableState(selected, "occupied")}
                >
                  Occupied
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={statusFor(selected) === "reserved" ? "default" : "outline"}
                  className={
                    statusFor(selected) === "reserved"
                      ? "bg-violet-600 hover:bg-violet-700 text-white text-[11px] h-8 px-1"
                      : "text-[11px] h-8 px-1"
                  }
                  onClick={() => void setTableState(selected, "reserved")}
                >
                  Reserved
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={statusFor(selected) === "cleaning" ? "default" : "outline"}
                  className={
                    statusFor(selected) === "cleaning"
                      ? "bg-blue-600 hover:bg-blue-700 text-white text-[11px] h-8 px-1"
                      : "text-[11px] h-8 px-1"
                  }
                  onClick={() => void setTableState(selected, "cleaning")}
                >
                  Cleaning
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={statusFor(selected) === "bill_requested" ? "default" : "outline"}
                  className={
                    statusFor(selected) === "bill_requested"
                      ? "bg-purple-600 hover:bg-purple-700 text-white text-[11px] h-8 px-1"
                      : "text-[11px] h-8 px-1"
                  }
                  onClick={() => void setTableState(selected, "bill_requested")}
                >
                  Bill Req.
                </Button>
              </div>
            </div>

            {statusFor(selected) === "occupied" || statusFor(selected) === "bill_requested" || selectedSession ? (
              <>
                <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{selectedSession?.customer_name || "Dine-in Guests"}</p>
                    <Badge className="bg-amber-200 text-amber-900 border-none text-[10px]">
                      {statusFor(selected) === "bill_requested" ? "Bill Requested" : "Active Tab"}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedSession
                      ? `${selectedSession.guest_count} guests · ${minutesSince(selectedSession.seated_at)} minutes open`
                      : "Guests seated at table"}
                  </p>
                  <p className="mt-2 text-xs text-amber-800">
                    When guests leave, click below to free this table for incoming guests.
                  </p>
                </div>

                {(() => {
                  const activeOrder = getActiveOrderForTable(selected)
                  if (!activeOrder) return null
                  const isPaid = activeOrder.status === "paid" || activeOrder.payment_status === "paid"
                  return (
                    <div className="rounded-2xl border border-[#E5D8CF] bg-white p-3.5 space-y-2.5 text-xs shadow-xs">
                      <div className="flex items-center justify-between font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#808068]">
                            #{activeOrder.order_number}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isPaid
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {isPaid ? "Paid Order" : "Unpaid Order"}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">
                          LKR {Number(activeOrder.total || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100 max-h-40 overflow-y-auto pr-1">
                        {activeOrder.items?.map((it, idx) => (
                          <div key={idx} className="flex justify-between py-1 text-gray-600">
                            <span>
                              {it.quantity}x {it.name}
                            </span>
                            <span className="font-medium">
                              LKR {(Number(it.price) * Number(it.quantity)).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                      {isPaid && (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-[11px] text-emerald-800 flex items-center gap-1.5">
                          <Check className="size-3.5 text-emerald-600 shrink-0" />
                          <span>Payment completed. Table stays occupied until guests leave and staff closes the table.</span>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {(() => {
                  const nb = nextUpcomingBookingFor(selected)
                  if (!nb) return null
                  return (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-3 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-violet-900">
                        <CalendarDays className="size-3.5 text-violet-600" />
                        <span>Later Reservation: {formatTime(nb.reserved_for)}</span>
                      </div>
                      <p className="text-violet-800">
                        {nb.customer_name} ({nb.party_size} guests) · {nb.duration_minutes} min hold
                      </p>
                      <p className="text-[10px] text-violet-600">
                        Closing this table leaves this upcoming reservation intact.
                      </p>
                    </div>
                  )
                })()}

                {/* Main Action to release when guests leave */}
                <Button
                  className="h-12 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm gap-2"
                  onClick={() => void updateSession("closed")}
                  disabled={saving}
                >
                  <Check className="size-4" /> Close Table (Guests Left · Mark Available)
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
                            <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">
                              Party Size
                            </span>
                            <span className="font-bold text-sm">{b.party_size} Guests</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">
                              Reserved Time
                            </span>
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
                        {b && (
                          <Button
                            variant="outline"
                            className="h-10 rounded-xl border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold text-xs"
                            onClick={() => openReschedule(b)}
                            disabled={saving}
                          >
                            <ArrowRightLeft className="size-3.5 mr-1" /> Move / Reschedule
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="h-10 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold text-xs col-span-2"
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
                    <p className="text-sm">
                      {booking.party_size} guests · {formatTime(booking.reserved_for)} · {booking.duration_minutes} min
                    </p>
                    <p className="text-sm">{booking.phone}</p>
                    {booking.special_requests && <p className="text-xs">{booking.special_requests}</p>}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => void updateBooking(booking, "arrived")}>
                        Mark arrived
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#D67B6B] hover:bg-[#c26555] text-white"
                        onClick={() => openSeat(selected, booking)}
                      >
                        Seat now
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full"
                      onClick={() => void updateBooking(booking, "cancelled")}
                    >
                      Cancel booking
                    </Button>
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
                  <Button
                    className="h-11 bg-[#D67B6B] hover:bg-[#c26555] text-white rounded-xl"
                    onClick={() => openSeat(selected)}
                  >
                    Seat guests
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl"
                    onClick={() => {
                      setForm({ ...emptyBooking, table_id: selected.id })
                      setShowBooking(true)
                    }}
                  >
                    New booking
                  </Button>
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
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => void setTableState(selected, selected.status === "cleaning" ? "available" : "cleaning")}
                >
                  {selected.status === "cleaning" ? "Mark clean & available" : "Mark as cleaning"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS (BOOKING, SEATING, RESCHEDULE, TRANSFER, MERGE, ADD TABLE)      */}
      {/* ========================================================================= */}

      {/* MODAL: NEW RESERVATION */}
      {showBooking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl bg-white shadow-2xl">
            <CardHeader className="pb-3 border-b border-[#E5D8CF]">
              <CardTitle className="font-serif text-xl font-bold text-[#343428]">New Table Reservation</CardTitle>
              <p className="text-xs text-[#808068]">
                Book a table in advance. The table will be held and displayed across Tables and POS floor views.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Guest Name *</label>
                  <Input
                    placeholder="e.g. Maya Silva"
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Phone *</label>
                  <Input
                    placeholder="+94 77 123 4567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Party Size</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Guests"
                    value={form.party_size}
                    onChange={(e) => setForm({ ...form, party_size: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Table Assignment</label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                    aria-label="Table"
                    value={form.table_id}
                    onChange={(e) => setForm({ ...form, table_id: e.target.value })}
                  >
                    <option value="">Auto-assign best table</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.capacity} seats ({t.status.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Reservation Date &amp; Time *</label>
                <Input
                  type="datetime-local"
                  value={form.reserved_for}
                  onChange={(e) => setForm({ ...form, reserved_for: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Hold Duration</label>
                <div className="flex gap-2">
                  {[60, 90, 120].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={form.duration_minutes === String(value) ? "default" : "outline"}
                      className={`flex-1 h-9 text-xs rounded-xl ${
                        form.duration_minutes === String(value) ? "bg-[#808068] text-white" : ""
                      }`}
                      onClick={() => setForm({ ...form, duration_minutes: String(value) })}
                    >
                      {value} min
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Special Requests / Notes</label>
                <Input
                  placeholder="e.g. Window seat, anniversary dinner"
                  value={form.special_requests}
                  onChange={(e) => setForm({ ...form, special_requests: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5D8CF]">
                <Button variant="ghost" onClick={() => setShowBooking(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#D67B6B] hover:bg-[#c26555] text-white"
                  disabled={saving || !form.customer_name || !form.phone || !form.reserved_for}
                  onClick={() => void createBooking()}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarDays className="size-4" />} Confirm Booking
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: SEAT GUESTS */}
      {showSeat && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
            <CardHeader className="pb-3 border-b border-[#E5D8CF]">
              <CardTitle className="font-serif text-xl font-bold text-[#343428]">
                {seatBookingId ? "Seat Booked Party" : "Seat Walk-in Guests"}
              </CardTitle>
              <p className="text-xs text-[#808068]">
                Assigns the table to these guests and opens a new dine-in session.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Table *</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                  aria-label="Table to seat"
                  value={seatTableId}
                  onChange={(e) => setSeatTableId(e.target.value)}
                >
                  <option value="">Choose a table…</option>
                  {availableForSeating.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.capacity} seats ({t.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Guest / Party Name</label>
                  <Input
                    placeholder="Customer name"
                    value={seatForm.customer_name}
                    onChange={(e) => setSeatForm({ ...seatForm, customer_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Phone (optional)</label>
                  <Input
                    placeholder="Phone"
                    value={seatForm.phone}
                    onChange={(e) => setSeatForm({ ...seatForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Number of Guests</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Guests"
                    value={seatForm.guest_count}
                    onChange={(e) => setSeatForm({ ...seatForm, guest_count: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Notes</label>
                  <Input
                    placeholder="Notes"
                    value={seatForm.notes}
                    onChange={(e) => setSeatForm({ ...seatForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5D8CF]">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowSeat(false)
                    setSeatBookingId(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#D67B6B] hover:bg-[#c26555] text-white"
                  disabled={saving || !seatTableId}
                  onClick={() => void seatGuests()}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Seat Guests
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: RESCHEDULE / MOVE RESERVATION */}
      {showReschedule && rescheduleData.booking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
            <CardHeader className="bg-[#808068] text-white rounded-t-3xl p-5">
              <CardTitle className="text-lg font-serif">Move / Reschedule Reservation</CardTitle>
              <p className="text-xs text-[#F4EBE4]/85">
                Move {rescheduleData.customer_name} to another table or adjust booking schedule
              </p>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Select Table *</label>
                <select
                  value={rescheduleData.table_id}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, table_id: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs bg-white"
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.capacity} seats ({t.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Reserved Date &amp; Time *</label>
                <Input
                  type="datetime-local"
                  value={rescheduleData.reserved_for}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, reserved_for: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Party Size</label>
                  <Input
                    type="number"
                    min="1"
                    value={rescheduleData.party_size}
                    onChange={(e) => setRescheduleData({ ...rescheduleData, party_size: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={rescheduleData.duration_minutes}
                    onChange={(e) => setRescheduleData({ ...rescheduleData, duration_minutes: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Customer Name</label>
                  <Input
                    value={rescheduleData.customer_name}
                    onChange={(e) => setRescheduleData({ ...rescheduleData, customer_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Phone</label>
                  <Input
                    value={rescheduleData.phone}
                    onChange={(e) => setRescheduleData({ ...rescheduleData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Special Requests</label>
                <Input
                  value={rescheduleData.special_requests}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, special_requests: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="ghost" onClick={() => setShowReschedule(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#D67B6B] text-white hover:bg-[#c26555]"
                  disabled={saving || !rescheduleData.table_id || !rescheduleData.reserved_for}
                  onClick={() => void handleReschedule()}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <ArrowRightLeft className="size-4" />}
                  Confirm Move &amp; Update
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

      {/* MODAL: ADD TABLE (Admin) */}
      {showAddTable && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-sm rounded-3xl bg-white shadow-2xl">
            <CardHeader className="pb-3 border-b border-[#E5D8CF]">
              <CardTitle className="font-serif text-xl font-bold text-[#343428]">Add Table</CardTitle>
              <p className="text-xs text-[#808068]">Create a new dining table on the live floor plan.</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <Input
                placeholder="Table name (e.g. Table 15)"
                value={tableForm.name}
                onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
              />
              <Input
                type="number"
                min="1"
                placeholder="Seats"
                value={tableForm.capacity}
                onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })}
              />
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="ghost" onClick={() => setShowAddTable(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#D67B6B] hover:bg-[#c26555] text-white"
                  disabled={saving || !tableForm.name.trim()}
                  onClick={() => void addTable()}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add Table
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
