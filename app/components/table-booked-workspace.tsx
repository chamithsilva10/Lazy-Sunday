"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  CalendarDays,
  Clock,
  Users,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
  Table2,
  Phone,
  ArrowRightLeft,
  ChevronRight,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SharedPosService, type SharedBooking, type SharedTable } from "@/lib/shared-pos-service"
import { toast } from "sonner"

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

function formatTimeOnly(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat("en-LK", {
      hour: "numeric",
      minute: "2-digit",
    }).format(d)
  } catch {
    return iso
  }
}

export function TableBookedWorkspace({
  onNavigateToTables,
}: {
  onNavigateToTables?: () => void
}) {
  const [bookings, setBookings] = useState<SharedBooking[]>([])
  const [tables, setTables] = useState<SharedTable[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loading, setLoading] = useState(false)

  // Modals
  const [showNewModal, setShowNewModal] = useState(false)
  const [editBooking, setEditBooking] = useState<SharedBooking | null>(null)
  const [saving, setSaving] = useState(false)

  // New Reservation Form
  const [newForm, setNewForm] = useState({
    customer_name: "",
    phone: "",
    party_size: "2",
    reserved_for: "",
    duration_minutes: "90",
    table_id: "",
    special_requests: "",
  })

  // Edit / Reschedule Form
  const [editForm, setEditForm] = useState({
    table_id: "",
    reserved_for: "",
    duration_minutes: "90",
    party_size: "2",
    customer_name: "",
    phone: "",
    special_requests: "",
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      await SharedPosService.refreshFromApi()
      setBookings(SharedPosService.getBookings())
      setTables(SharedPosService.getTables())
    } catch {
      setBookings(SharedPosService.getBookings())
      setTables(SharedPosService.getTables())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()

    const unsubBookings = SharedPosService.subscribeBookings((b) => setBookings([...b]))
    const unsubTables = SharedPosService.subscribeTables((t) => setTables([...t]))

    const onSync = () => void loadData()
    window.addEventListener("pos_bookings_updated", onSync)
    window.addEventListener("pos_tables_updated", onSync)
    window.addEventListener("pos_realtime_sync", onSync)

    return () => {
      unsubBookings()
      unsubTables()
      window.removeEventListener("pos_bookings_updated", onSync)
      window.removeEventListener("pos_tables_updated", onSync)
      window.removeEventListener("pos_realtime_sync", onSync)
    }
  }, [loadData])

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== "all") {
        if (statusFilter === "active" && !["pending", "confirmed", "arrived"].includes(b.status)) return false
        if (statusFilter === "seated" && b.status !== "seated" && b.status !== "completed") return false
        if (statusFilter === "cancelled" && b.status !== "cancelled" && b.status !== "no_show") return false
      }
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        b.customer_name.toLowerCase().includes(q) ||
        b.phone.toLowerCase().includes(q) ||
        (b.table_name && b.table_name.toLowerCase().includes(q))
      )
    })
  }, [bookings, statusFilter, search])

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = bookings.length
    const confirmed = bookings.filter((b) => b.status === "confirmed" || b.status === "pending").length
    const arrived = bookings.filter((b) => b.status === "arrived").length
    const seated = bookings.filter((b) => b.status === "seated" || b.status === "completed").length
    const availableTables = tables.filter((t) => t.status === "available").length
    return { total, confirmed, arrived, seated, availableTables }
  }, [bookings, tables])

  // Create Reservation
  async function handleCreateBooking() {
    if (!newForm.customer_name.trim() || !newForm.phone.trim()) {
      return toast.error("Guest name and phone are required")
    }
    if (!newForm.reserved_for) {
      return toast.error("Please pick reservation date and time")
    }
    const partySize = Number(newForm.party_size) || 2
    const duration = Number(newForm.duration_minutes) || 90

    setSaving(true)
    try {
      const selectedTable = tables.find((t) => t.id === newForm.table_id || t.name === newForm.table_id)
      await SharedPosService.addBooking({
        customer_name: newForm.customer_name.trim(),
        phone: newForm.phone.trim(),
        party_size: partySize,
        reserved_for: new Date(newForm.reserved_for).toISOString(),
        duration_minutes: duration,
        table_id: selectedTable?.id || (newForm.table_id ? newForm.table_id : undefined),
        table_name: selectedTable?.name || "Auto-assigned",
        special_requests: newForm.special_requests.trim(),
        status: "confirmed",
        source: "staff",
      })
      toast.success(`Reservation created for ${newForm.customer_name}!`)
      setShowNewModal(false)
      setNewForm({
        customer_name: "",
        phone: "",
        party_size: "2",
        reserved_for: "",
        duration_minutes: "90",
        table_id: "",
        special_requests: "",
      })
      await loadData()
    } catch (err: any) {
      toast.error(err.message || "Failed to create reservation")
    } finally {
      setSaving(false)
    }
  }

  // Open Edit / Reschedule Modal
  function openEditModal(booking: SharedBooking) {
    setEditBooking(booking)
    const localDateTime = booking.reserved_for
      ? new Date(booking.reserved_for).toISOString().slice(0, 16)
      : ""
    setEditForm({
      table_id: booking.table_id || "",
      reserved_for: localDateTime,
      duration_minutes: String(booking.duration_minutes || 90),
      party_size: String(booking.party_size || 2),
      customer_name: booking.customer_name,
      phone: booking.phone,
      special_requests: booking.special_requests || "",
    })
  }

  // Save Edit / Reschedule
  async function handleSaveEdit() {
    if (!editBooking) return
    const targetTable = tables.find((t) => t.id === editForm.table_id || t.name === editForm.table_id)
    const partySize = Number(editForm.party_size) || editBooking.party_size
    const duration = Number(editForm.duration_minutes) || editBooking.duration_minutes
    const startIso = editForm.reserved_for ? new Date(editForm.reserved_for).toISOString() : editBooking.reserved_for

    setSaving(true)
    try {
      await SharedPosService.updateBooking(editBooking.id, {
        customer_name: editForm.customer_name.trim(),
        phone: editForm.phone.trim(),
        party_size: partySize,
        duration_minutes: duration,
        reserved_for: startIso,
        table_id: targetTable ? targetTable.id : editBooking.table_id,
        table_name: targetTable ? targetTable.name : editBooking.table_name,
        special_requests: editForm.special_requests.trim(),
      })
      toast.success(`Booking updated & rescheduled to ${targetTable?.name || editBooking.table_name}`)
      setEditBooking(null)
      await loadData()
    } catch (err: any) {
      toast.error(err.message || "Failed to reschedule booking")
    } finally {
      setSaving(false)
    }
  }

  // Seat Booked Guests
  async function handleSeatGuests(booking: SharedBooking) {
    setSaving(true)
    try {
      await SharedPosService.seatBooking(booking.id, booking.party_size)
      toast.success(`${booking.customer_name} seated at ${booking.table_name}! Table is now Occupied.`)
      await loadData()
    } catch (err: any) {
      toast.error(err.message || "Failed to seat guests")
    } finally {
      setSaving(false)
    }
  }

  // Cancel Booking
  async function handleCancelBooking(booking: SharedBooking) {
    setSaving(true)
    try {
      await SharedPosService.updateBookingStatus(booking.id, "cancelled")
      toast.success(`Booking for ${booking.customer_name} cancelled`)
      await loadData()
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel booking")
    } finally {
      setSaving(false)
    }
  }

  // Mark Status
  async function handleStatusChange(booking: SharedBooking, status: SharedBooking["status"]) {
    setSaving(true)
    try {
      await SharedPosService.updateBookingStatus(booking.id, status)
      toast.success(`Marked as ${status}`)
      await loadData()
    } catch (err: any) {
      toast.error(err.message || "Failed to update status")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#dce6d9] bg-white/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex size-2 rounded-full bg-[#808068] animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#808068]">Table Reservations</p>
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#343428]">Table Booked</h2>
          <p className="text-sm text-[#808068]">
            Manage reservations, reschedule tables, and seat guests with live floor synchronization.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToTables && (
            <Button
              variant="outline"
              className="h-11 rounded-xl border-[#808068]/30 font-semibold gap-2"
              onClick={onNavigateToTables}
            >
              <Table2 className="size-4 text-[#808068]" /> View Floor Plan
            </Button>
          )}
          <Button
            className="h-11 rounded-xl bg-[#D67B6B] hover:bg-[#c26555] text-white font-semibold gap-2 shadow-xs"
            onClick={() => setShowNewModal(true)}
          >
            <Plus className="size-4" /> New Reservation
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-xl"
            onClick={() => void loadData()}
            disabled={loading}
            aria-label="Refresh bookings"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin text-[#D67B6B]" : "text-gray-600"}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#E5D8CF] bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-[#808068]">Active / Confirmed</p>
          <p className="font-serif text-2xl font-bold text-[#343428] mt-0.5">{metrics.confirmed}</p>
          <span className="text-[11px] text-violet-700 font-medium">Upcoming bookings</span>
        </div>
        <div className="rounded-2xl border border-[#E5D8CF] bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-[#808068]">Arrived Guests</p>
          <p className="font-serif text-2xl font-bold text-amber-900 mt-0.5">{metrics.arrived}</p>
          <span className="text-[11px] text-amber-700 font-medium">Ready to be seated</span>
        </div>
        <div className="rounded-2xl border border-[#E5D8CF] bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-[#808068]">Seated Today</p>
          <p className="font-serif text-2xl font-bold text-emerald-800 mt-0.5">{metrics.seated}</p>
          <span className="text-[11px] text-emerald-700 font-medium">Currently dining / finished</span>
        </div>
        <div className="rounded-2xl border border-[#E5D8CF] bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-[#808068]">Available Tables</p>
          <p className="font-serif text-2xl font-bold text-[#808068] mt-0.5">{metrics.availableTables} / {tables.length}</p>
          <span className="text-[11px] text-[#808068] font-medium">Ready for walk-in or booking</span>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            className="h-11 rounded-xl pl-9 bg-white"
            placeholder="Search by customer name, phone, or table..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              onClick={() => setStatusFilter(tab.key)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                statusFilter === tab.key
                  ? "bg-[#D67B6B] text-white shadow-xs"
                  : "text-[#808068] hover:text-[#343428]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-[#E5D8CF] p-8 text-center bg-white/60">
          <CalendarDays className="size-10 text-[#808068]/50 mx-auto mb-2" />
          <h4 className="font-semibold text-gray-800">No reservations found</h4>
          <p className="text-xs text-gray-500 mt-1">
            {search ? "Try adjusting your search criteria." : "Create your first reservation to hold tables for guests."}
          </p>
          <Button
            className="mt-4 h-9 bg-[#D67B6B] hover:bg-[#c26555] text-white rounded-xl text-xs"
            onClick={() => setShowNewModal(true)}
          >
            <Plus className="size-3.5 mr-1" /> New Reservation
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBookings.map((b) => {
            const table = tables.find((t) => t.id === b.table_id || t.name === b.table_name)
            const isTableOccupied = table?.status === "occupied" || table?.status === "bill_requested"

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
                              table.status === "occupied"
                                ? "bg-amber-200 text-amber-900"
                                : table.status === "reserved"
                                ? "bg-violet-200 text-violet-900"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {table.status.toUpperCase()}
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
                        onClick={() => void handleSeatGuests(b)}
                        disabled={saving}
                      >
                        <Users className="size-3.5" /> Seat Guests Now
                      </Button>
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-[11px] font-medium border-violet-200 text-violet-800 hover:bg-violet-50"
                          onClick={() => void handleStatusChange(b, "arrived")}
                          disabled={saving}
                        >
                          Arrived
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-[11px] font-medium border-gray-200 text-gray-700 hover:bg-gray-50"
                          onClick={() => openEditModal(b)}
                          disabled={saving}
                        >
                          <Edit2 className="size-3 mr-1" /> Move
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-[11px] font-medium border-rose-200 text-rose-700 hover:bg-rose-50"
                          onClick={() => void handleCancelBooking(b)}
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
                        onClick={() => void handleSeatGuests(b)}
                        disabled={saving}
                      >
                        <Users className="size-3.5" /> Seat Arrived Guests
                      </Button>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-[11px] font-medium border-gray-200"
                          onClick={() => openEditModal(b)}
                          disabled={saving}
                        >
                          <Edit2 className="size-3 mr-1" /> Reschedule / Move
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-[11px] font-medium border-amber-200 text-amber-800 hover:bg-amber-50"
                          onClick={() => void handleStatusChange(b, "no_show")}
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
                      {onNavigateToTables && (
                        <button
                          onClick={onNavigateToTables}
                          className="text-[11px] font-bold underline hover:text-emerald-950 flex items-center"
                        >
                          Floor <ChevronRight className="size-3" />
                        </button>
                      )}
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

      {/* New Reservation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-lg rounded-3xl bg-white shadow-xl">
            <CardHeader className="pb-3 border-b border-[#E5D8CF]">
              <CardTitle className="font-serif text-xl font-bold text-[#343428]">
                New Table Reservation
              </CardTitle>
              <p className="text-xs text-[#808068]">
                Book a table in advance. The table will be held and displayed in both Tables and POS.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Guest Name *</label>
                  <Input
                    placeholder="e.g. Maya Silva"
                    value={newForm.customer_name}
                    onChange={(e) => setNewForm({ ...newForm, customer_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Phone *</label>
                  <Input
                    placeholder="+94 77 123 4567"
                    value={newForm.phone}
                    onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Party Size</label>
                  <Input
                    type="number"
                    min="1"
                    value={newForm.party_size}
                    onChange={(e) => setNewForm({ ...newForm, party_size: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Table Assignment</label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                    value={newForm.table_id}
                    onChange={(e) => setNewForm({ ...newForm, table_id: e.target.value })}
                  >
                    <option value="">Auto-assign best table</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.capacity} seats) · {t.status.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Reservation Date &amp; Time *</label>
                <Input
                  type="datetime-local"
                  value={newForm.reserved_for}
                  onChange={(e) => setNewForm({ ...newForm, reserved_for: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Hold Duration</label>
                <div className="flex gap-2">
                  {[60, 90, 120].map((dur) => (
                    <Button
                      key={dur}
                      type="button"
                      variant={newForm.duration_minutes === String(dur) ? "default" : "outline"}
                      className={`flex-1 h-9 text-xs rounded-xl ${
                        newForm.duration_minutes === String(dur) ? "bg-[#808068] text-white" : ""
                      }`}
                      onClick={() => setNewForm({ ...newForm, duration_minutes: String(dur) })}
                    >
                      {dur} mins
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Special Requests / Notes</label>
                <Input
                  placeholder="e.g. Window seat, birthday celebration"
                  value={newForm.special_requests}
                  onChange={(e) => setNewForm({ ...newForm, special_requests: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5D8CF]">
                <Button variant="ghost" onClick={() => setShowNewModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#D67B6B] hover:bg-[#c26555] text-white"
                  disabled={saving || !newForm.customer_name || !newForm.phone || !newForm.reserved_for}
                  onClick={() => void handleCreateBooking()}
                >
                  {saving ? "Saving..." : "Confirm Reservation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit / Reschedule Modal */}
      {editBooking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-lg rounded-3xl bg-white shadow-xl">
            <CardHeader className="pb-3 border-b border-[#E5D8CF]">
              <CardTitle className="font-serif text-xl font-bold text-[#343428]">
                Reschedule / Move Reservation
              </CardTitle>
              <p className="text-xs text-[#808068]">
                Move {editBooking.customer_name} to another table or adjust booking time.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Select New Table</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                  value={editForm.table_id}
                  onChange={(e) => setEditForm({ ...editForm, table_id: e.target.value })}
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.capacity} seats) · {t.status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Reserved Date &amp; Time</label>
                <Input
                  type="datetime-local"
                  value={editForm.reserved_for}
                  onChange={(e) => setEditForm({ ...editForm, reserved_for: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Party Size</label>
                  <Input
                    type="number"
                    min="1"
                    value={editForm.party_size}
                    onChange={(e) => setEditForm({ ...editForm, party_size: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={editForm.duration_minutes}
                    onChange={(e) => setEditForm({ ...editForm, duration_minutes: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Guest Contact</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={editForm.customer_name}
                    onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                  />
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5D8CF]">
                <Button variant="ghost" onClick={() => setEditBooking(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#D67B6B] hover:bg-[#c26555] text-white"
                  disabled={saving || !editForm.table_id || !editForm.reserved_for}
                  onClick={() => void handleSaveEdit()}
                >
                  {saving ? "Saving..." : "Update & Reschedule"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
