"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Users,
  Search,
  Plus,
  Star,
  Gift,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  Trash2,
  Edit2,
  Receipt,
  MessageSquare,
  Award,
  Copy,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Tag,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  SharedPosService,
  SharedCustomer,
  SharedPromoOffer,
  SharedCustomerFeedback,
  SharedOrder,
} from "@/lib/shared-pos-service"

export function CustomerManagementView({ role = "cashier" }: { role?: string }) {
  const [activeTab, setActiveTab] = useState<"directory" | "loyalty" | "credit" | "feedback" | "promos">("directory")
  const [customers, setCustomers] = useState<SharedCustomer[]>([])
  const [promos, setPromos] = useState<SharedPromoOffer[]>([])
  const [feedback, setFeedback] = useState<SharedCustomerFeedback[]>([])
  const [orders, setOrders] = useState<SharedOrder[]>([])

  // Search and filter
  const [search, setSearch] = useState("")
  const [filterVip, setFilterVip] = useState(false)
  const [filterDebt, setFilterDebt] = useState(false)

  // Dialog states
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showEditCustomer, setShowEditCustomer] = useState<SharedCustomer | null>(null)
  const [showHistoryCustomer, setShowHistoryCustomer] = useState<SharedCustomer | null>(null)
  const [showSettleCredit, setShowSettleCredit] = useState<SharedCustomer | null>(null)
  const [showAddPromo, setShowAddPromo] = useState(false)
  const [showAddFeedback, setShowAddFeedback] = useState(false)

  // Forms
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    credit_limit: 15000,
    vip: false,
  })

  const [settleAmount, setSettleAmount] = useState("")
  const [settleMethod, setSettleMethod] = useState("cash")
  const [settleRef, setSettleRef] = useState("")

  const [promoForm, setPromoForm] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: 10,
    min_spend: 1000,
    valid_until: "2026-12-31",
  })

  const [feedbackForm, setFeedbackForm] = useState({
    customer_name: "",
    rating: 5,
    comment: "",
    table_name: "Table 01",
  })

  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Subscribe to real-time events
  useEffect(() => {
    setCustomers(SharedPosService.getCustomers())
    setPromos(SharedPosService.getPromos())
    setFeedback(SharedPosService.getFeedback())
    setOrders(SharedPosService.getOrders())

    const unsubCust = SharedPosService.subscribeCustomers(setCustomers)
    const unsubPromos = SharedPosService.subscribePromos(setPromos)
    const unsubFb = SharedPosService.subscribeFeedback(setFeedback)
    const unsubOrders = SharedPosService.subscribeOrders(setOrders)

    return () => {
      unsubCust()
      unsubPromos()
      unsubFb()
      unsubOrders()
    }
  }, [])

  // KPI Calculations
  const totalPoints = useMemo(() => customers.reduce((sum, c) => sum + (c.loyalty_points || 0), 0), [customers])
  const totalOutstandingCredit = useMemo(() => customers.reduce((sum, c) => sum + (c.credit_balance || 0), 0), [customers])
  const activePromoCount = useMemo(() => promos.filter((p) => p.active).length, [promos])
  const averageRating = useMemo(() => {
    if (!feedback.length) return 5
    return (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
  }, [feedback])

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
      const matchVip = !filterVip || c.vip
      const matchDebt = !filterDebt || (c.credit_balance || 0) > 0
      return matchSearch && matchVip && matchDebt
    })
  }, [customers, search, filterVip, filterDebt])

  // Handle customer create
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerForm.name.trim() || !customerForm.phone.trim()) return

    if (showEditCustomer) {
      SharedPosService.updateCustomer(showEditCustomer.id, {
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        email: customerForm.email.trim() || undefined,
        address: customerForm.address.trim() || undefined,
        notes: customerForm.notes.trim() || undefined,
        credit_limit: Number(customerForm.credit_limit) || 10000,
        vip: customerForm.vip,
      })
      setShowEditCustomer(null)
    } else {
      SharedPosService.addCustomer({
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        email: customerForm.email.trim() || undefined,
        address: customerForm.address.trim() || undefined,
        notes: customerForm.notes.trim() || undefined,
        loyalty_points: 0,
        credit_balance: 0,
        credit_limit: Number(customerForm.credit_limit) || 10000,
        vip: customerForm.vip,
      })
      setShowAddCustomer(false)
    }

    setCustomerForm({
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
      credit_limit: 15000,
      vip: false,
    })
  }

  // Handle debt settlement
  const handleSettleDebt = (e: React.FormEvent) => {
    e.preventDefault()
    if (!showSettleCredit) return
    const amount = Number(settleAmount)
    if (isNaN(amount) || amount <= 0) return

    SharedPosService.recordCreditPayment(
      showSettleCredit.id,
      amount,
      settleRef || undefined,
      `Paid via ${settleMethod.toUpperCase()}`
    )
    setShowSettleCredit(null)
    setSettleAmount("")
    setSettleRef("")
  }

  // Handle promo creation
  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoForm.code.trim()) return
    SharedPosService.addPromo({
      code: promoForm.code.trim().toUpperCase(),
      discount_type: promoForm.discount_type,
      discount_value: Number(promoForm.discount_value) || 10,
      min_spend: Number(promoForm.min_spend) || 0,
      valid_until: promoForm.valid_until,
      active: true,
      usage_count: 0,
    })
    setShowAddPromo(false)
    setPromoForm({
      code: "",
      discount_type: "percentage",
      discount_value: 10,
      min_spend: 1000,
      valid_until: "2026-12-31",
    })
  }

  // Handle feedback creation
  const handleSaveFeedback = (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedbackForm.customer_name.trim() || !feedbackForm.comment.trim()) return
    SharedPosService.addFeedback({
      customer_name: feedbackForm.customer_name.trim(),
      rating: Number(feedbackForm.rating) || 5,
      comment: feedbackForm.comment.trim(),
      table_name: feedbackForm.table_name,
    })
    setShowAddFeedback(false)
    setFeedbackForm({
      customer_name: "",
      rating: 5,
      comment: "",
      table_name: "Table 01",
    })
  }

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#2B2B28]">
              Customer Management & CRM
            </h1>
            <Badge className="bg-[#808068] text-white">Loyalty & Credit ERP</Badge>
          </div>
          <p className="text-sm text-gray-500">
            Guest directory, loyalty point rewards, credit ledger tabs, guest feedback & promotional campaigns
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setCustomerForm({
                name: "",
                phone: "",
                email: "",
                address: "",
                notes: "",
                credit_limit: 15000,
                vip: false,
              })
              setShowAddCustomer(true)
            }}
            className="gap-2 rounded-xl bg-[#D67B6B] text-white hover:bg-[#c36859] shadow-sm"
          >
            <Plus className="size-4" />
            Add Customer
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAddPromo(true)}
            className="gap-2 rounded-xl border-[#808068]/30 text-[#808068] hover:bg-[#FAF5F1]"
          >
            <Gift className="size-4" />
            New Promo Code
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border-[#E5D8CF] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Total Customers</span>
            <Users className="size-4 text-[#808068]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{customers.length}</p>
          <p className="mt-1 text-[11px] text-gray-400">
            {customers.filter((c) => c.vip).length} VIP accounts registered
          </p>
        </Card>

        <Card className="rounded-2xl border-[#E5D8CF] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Loyalty Points Active</span>
            <Award className="size-4 text-[#D67B6B]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#D67B6B]">{totalPoints.toLocaleString()} pts</p>
          <p className="mt-1 text-[11px] text-gray-400">
            1 pt per LKR 100 spent · LKR {(totalPoints * 2).toLocaleString()} value
          </p>
        </Card>

        <Card className="rounded-2xl border-[#E5D8CF] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Outstanding Customer Credit</span>
            <CreditCard className="size-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-700">LKR {totalOutstandingCredit.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-gray-400">
            {customers.filter((c) => (c.credit_balance || 0) > 0).length} customers with open tabs
          </p>
        </Card>

        <Card className="rounded-2xl border-[#E5D8CF] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Average Guest Rating</span>
            <Star className="size-4 text-amber-500 fill-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{averageRating} / 5.0</p>
          <p className="mt-1 text-[11px] text-gray-400">
            Based on {feedback.length} verified customer reviews
          </p>
        </Card>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap gap-2 border-b border-[#E5D8CF] pb-3">
        {[
          { key: "directory", label: "Customer Directory", icon: Users, badge: customers.length },
          { key: "loyalty", label: "Loyalty & Rewards", icon: Award, badge: `${totalPoints} pts` },
          { key: "credit", label: "Credit & Open Tabs", icon: CreditCard, badge: `LKR ${totalOutstandingCredit.toLocaleString()}` },
          { key: "feedback", label: "Guest Feedback", icon: MessageSquare, badge: feedback.length },
          { key: "promos", label: "Promotional Offers", icon: Gift, badge: activePromoCount },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                active
                  ? "bg-[#D67B6B] text-white shadow-sm"
                  : "bg-white text-gray-600 hover:bg-[#FAF5F1] hover:text-[#D67B6B] border border-[#E5D8CF]"
              }`}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {tab.badge}
              </span>
            </button>
          )
        })}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: CUSTOMER DIRECTORY                                */}
      {/* ======================================================== */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Search & filter toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-xl border-[#E5D8CF] bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={filterVip ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterVip(!filterVip)}
                className={`rounded-xl text-xs gap-1.5 ${
                  filterVip ? "bg-[#D67B6B] hover:bg-[#c36859] text-white" : "border-[#E5D8CF] text-gray-700"
                }`}
              >
                <Award className="size-3.5" />
                VIP Only
              </Button>
              <Button
                variant={filterDebt ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterDebt(!filterDebt)}
                className={`rounded-xl text-xs gap-1.5 ${
                  filterDebt ? "bg-rose-600 hover:bg-rose-700 text-white" : "border-[#E5D8CF] text-gray-700"
                }`}
              >
                <CreditCard className="size-3.5" />
                Open Tabs Only
              </Button>
            </div>
          </div>

          {/* Customer Cards Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCustomers.map((cust) => {
              const custOrders = orders.filter((o) => o.customer_id === cust.id || o.delivery_info?.phone === cust.phone)
              const hasDebt = (cust.credit_balance || 0) > 0

              return (
                <Card
                  key={cust.id}
                  className="rounded-2xl border-[#E5D8CF] bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-[#F4EBE4] text-[#808068] font-bold text-base">
                          {cust.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-gray-900">{cust.name}</h3>
                            {cust.vip && (
                              <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] px-1.5 py-0 font-bold">
                                VIP
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone className="size-3" />
                            {cust.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-gray-400 hover:text-gray-700"
                          onClick={() => {
                            setCustomerForm({
                              name: cust.name,
                              phone: cust.phone,
                              email: cust.email || "",
                              address: cust.address || "",
                              notes: cust.notes || "",
                              credit_limit: cust.credit_limit || 15000,
                              vip: cust.vip,
                            })
                            setShowEditCustomer(cust)
                          }}
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-400 hover:text-rose-600"
                          onClick={() => {
                            if (confirm(`Remove customer ${cust.name}?`)) {
                              SharedPosService.deleteCustomer(cust.id)
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {cust.email && (
                      <p className="text-xs text-gray-600 flex items-center gap-1.5">
                        <Mail className="size-3.5 text-gray-400" />
                        {cust.email}
                      </p>
                    )}

                    {cust.address && (
                      <p className="text-xs text-gray-600 flex items-center gap-1.5 line-clamp-1">
                        <MapPin className="size-3.5 text-gray-400 shrink-0" />
                        {cust.address}
                      </p>
                    )}

                    {cust.notes && (
                      <div className="rounded-xl bg-[#FAF5F1] p-2.5 text-xs text-gray-600 italic">
                        "{cust.notes}"
                      </div>
                    )}

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#F4EBE4]">
                      <div className="rounded-xl bg-[#FAF5F1] border border-[#E5D8CF] p-2">
                        <span className="text-[10px] uppercase font-bold text-[#808068] tracking-wider">Loyalty</span>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">{cust.loyalty_points || 0} pts</p>
                      </div>

                      <div
                        className={`rounded-xl border p-2 ${
                          hasDebt
                            ? "bg-rose-50/80 border-rose-200/60 text-rose-950"
                            : "bg-[#FAF5F1] border-[#E5D8CF] text-gray-900"
                        }`}
                      >
                        <span className="text-[10px] uppercase font-bold tracking-wider">Credit Tab</span>
                        <p className="text-sm font-bold mt-0.5">
                          {hasDebt ? `LKR ${cust.credit_balance.toLocaleString()}` : "Settled (Rs 0)"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center gap-2 pt-4 mt-2 border-t border-[#F4EBE4]">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHistoryCustomer(cust)}
                      className="flex-1 rounded-xl text-xs gap-1.5 border-[#E5D8CF] text-gray-700 hover:bg-[#FAF5F1]"
                    >
                      <Receipt className="size-3.5" />
                      Orders ({custOrders.length})
                    </Button>

                    {hasDebt && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setShowSettleCredit(cust)
                          setSettleAmount(String(cust.credit_balance))
                        }}
                        className="rounded-xl text-xs gap-1.5 bg-rose-600 text-white hover:bg-rose-700"
                      >
                        <DollarSign className="size-3.5" />
                        Settle Tab
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}

            {filteredCustomers.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <Users className="size-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-600">No customers found</p>
                <p className="text-xs text-gray-400 mt-1">Try adjusting your search or add a new customer</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: LOYALTY & REWARDS                                 */}
      {/* ======================================================== */}
      {activeTab === "loyalty" && (
        <div className="space-y-6">
          {/* Loyalty Explainer Card */}
          <Card className="rounded-2xl border-amber-200/80 bg-gradient-to-r from-amber-50 via-amber-100/40 to-white p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <Badge className="bg-amber-700 text-white font-bold">VIP Guest Rewards Program</Badge>
                <h2 className="font-serif text-xl font-bold text-amber-950">How Loyalty Points Work</h2>
                <p className="text-sm text-amber-900/80 max-w-2xl leading-relaxed">
                  Every guest automatically earns <strong>1 point for every LKR 100 spent</strong> across Food, Juice, and Coffee.
                  Points never expire and can be redeemed at POS checkout at the rate of <strong>100 points = LKR 200 discount</strong>.
                </p>
              </div>
              <div className="rounded-2xl bg-white/90 border border-amber-200 p-4 shrink-0 text-center shadow-sm">
                <span className="text-[11px] uppercase tracking-wider font-bold text-amber-800">Total Points Issued</span>
                <p className="text-3xl font-extrabold text-amber-900 mt-1">{totalPoints.toLocaleString()}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Worth LKR {(totalPoints * 2).toLocaleString()} in credits</p>
              </div>
            </div>
          </Card>

          {/* Tier Leaderboard */}
          <Card className="rounded-2xl border-[#E5D8CF] bg-white p-5 shadow-sm">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="font-serif text-base font-bold text-gray-900">
                Top Loyal Customers & Tiers
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Reward top patrons with special invitations, tasting events, and VIP perks
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[#F4EBE4]">
                {[...customers]
                  .sort((a, b) => (b.loyalty_points || 0) - (a.loyalty_points || 0))
                  .map((cust, idx) => {
                    const tier =
                      (cust.loyalty_points || 0) >= 500
                        ? { name: "Gold Tier", color: "bg-amber-100 text-amber-950 border-amber-300" }
                        : (cust.loyalty_points || 0) >= 200
                        ? { name: "Silver Tier", color: "bg-slate-100 text-slate-800 border-slate-300" }
                        : { name: "Bronze Tier", color: "bg-orange-50 text-orange-900 border-orange-200" }

                    return (
                      <div key={cust.id} className="flex items-center justify-between py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                              idx === 0
                                ? "bg-amber-400 text-amber-950"
                                : idx === 1
                                ? "bg-slate-300 text-slate-900"
                                : idx === 2
                                ? "bg-orange-300 text-orange-950"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-gray-900">{cust.name}</p>
                              <Badge className={`text-[10px] px-1.5 py-0 border ${tier.color}`}>{tier.name}</Badge>
                              {cust.vip && (
                                <Badge className="bg-[#808068] text-white text-[9px] px-1 py-0">VIP</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{cust.phone}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-amber-950">{cust.loyalty_points || 0} pts</p>
                          <p className="text-[11px] text-gray-400">
                            Redeemable: LKR {((cust.loyalty_points || 0) * 2).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: CUSTOMER CREDIT & OPEN TABS                       */}
      {/* ======================================================== */}
      {activeTab === "credit" && (
        <div className="space-y-6">
          {/* Outstanding Tab Alert Banner */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-rose-950 text-base">Customer Credit & Ledger Accounts</h3>
                <p className="text-xs text-rose-800/80 mt-1">
                  Trusted regulars and instructors can run an open dining tab that is settled weekly or monthly.
                  Total current debt owed to restaurant: <strong>LKR {totalOutstandingCredit.toLocaleString()}</strong>.
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <Badge className="bg-rose-600 text-white font-bold px-3 py-1 text-sm">
                LKR {totalOutstandingCredit.toLocaleString()}
              </Badge>
            </div>
          </div>

          {/* Table of Open Tabs */}
          <Card className="rounded-2xl border-[#E5D8CF] bg-white p-5 shadow-sm">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="font-serif text-base font-bold text-gray-900">
                Active Customer Tabs
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Record payments or adjust credit limits
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5D8CF] text-xs font-bold uppercase text-gray-500">
                      <th className="pb-3 pl-2">Customer</th>
                      <th className="pb-3">Contact</th>
                      <th className="pb-3">Credit Limit</th>
                      <th className="pb-3">Current Debt</th>
                      <th className="pb-3">Remaining Limit</th>
                      <th className="pb-3 pr-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4EBE4]">
                    {customers
                      .filter((c) => (c.credit_balance || 0) > 0)
                      .map((cust) => {
                        const remaining = Math.max(0, (cust.credit_limit || 15000) - (cust.credit_balance || 0))
                        return (
                          <tr key={cust.id} className="hover:bg-[#FAF5F1]">
                            <td className="py-3 pl-2 font-bold text-gray-900">{cust.name}</td>
                            <td className="py-3 text-xs text-gray-600">{cust.phone}</td>
                            <td className="py-3 text-xs text-gray-600">
                              LKR {(cust.credit_limit || 15000).toLocaleString()}
                            </td>
                            <td className="py-3 font-bold text-rose-600">
                              LKR {(cust.credit_balance || 0).toLocaleString()}
                            </td>
                            <td className="py-3 text-xs text-emerald-700 font-semibold">
                              LKR {remaining.toLocaleString()}
                            </td>
                            <td className="py-3 pr-2 text-right">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setShowSettleCredit(cust)
                                  setSettleAmount(String(cust.credit_balance))
                                }}
                                className="rounded-xl text-xs gap-1 bg-[#D67B6B] text-white hover:bg-[#c36859]"
                              >
                                <DollarSign className="size-3.5" />
                                Record Payment
                              </Button>
                            </td>
                          </tr>
                        )
                      })}

                    {customers.filter((c) => (c.credit_balance || 0) > 0).length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                          All customer tabs are fully settled! No outstanding balances.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: GUEST FEEDBACK & REVIEWS                          */}
      {/* ======================================================== */}
      {activeTab === "feedback" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-bold text-gray-900">Verified Customer Feedback</h2>
              <p className="text-xs text-gray-500">Service ratings and guest comments logged at tables and checkout</p>
            </div>
            <Button
              onClick={() => setShowAddFeedback(true)}
              className="gap-2 rounded-xl bg-[#D67B6B] text-white hover:bg-[#c36859]"
            >
              <Plus className="size-4" />
              Log Feedback
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {feedback.map((item) => (
              <Card key={item.id} className="rounded-2xl border-[#E5D8CF] bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`size-4 ${
                          star <= item.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  {item.table_name && (
                    <Badge variant="outline" className="text-[10px] border-[#E5D8CF] text-gray-500">
                      {item.table_name}
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-gray-700 italic leading-relaxed">
                  "{item.comment}"
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-[#F4EBE4] text-[11px] text-gray-500">
                  <span className="font-bold text-gray-900">{item.customer_name}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Card>
            ))}

            {feedback.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <MessageSquare className="size-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-600">No customer feedback recorded yet</p>
                <p className="text-xs text-gray-400 mt-1">Click &apos;+ Add Review&apos; above to log guest feedback and dining reviews.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: PROMOTIONAL OFFERS & COUPONS                      */}
      {/* ======================================================== */}
      {activeTab === "promos" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-bold text-gray-900">Promotional Discount Codes</h2>
              <p className="text-xs text-gray-500">
                Manage promotional coupon codes that staff can apply at POS checkout
              </p>
            </div>
            <Button
              onClick={() => setShowAddPromo(true)}
              className="gap-2 rounded-xl bg-[#D67B6B] text-white hover:bg-[#c36859]"
            >
              <Plus className="size-4" />
              New Promo Code
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {promos.map((promo) => (
              <Card
                key={promo.id}
                className={`rounded-2xl border p-5 shadow-sm transition-all ${
                  promo.active ? "border-[#E5D8CF] bg-white" : "border-gray-200 bg-gray-50 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-[#808068] tracking-wide">
                        {promo.code}
                      </span>
                      <button
                        onClick={() => handleCopyCode(promo.code)}
                        className="text-gray-400 hover:text-gray-700"
                        title="Copy code"
                      >
                        {copiedCode === promo.code ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-2xl font-black text-gray-900">
                      {promo.discount_type === "percentage"
                        ? `${promo.discount_value}% OFF`
                        : `LKR ${promo.discount_value} OFF`}
                    </p>
                  </div>

                  <Badge className={promo.active ? "bg-emerald-600 text-white" : "bg-gray-400 text-white"}>
                    {promo.active ? "Active" : "Disabled"}
                  </Badge>
                </div>

                <div className="mt-4 space-y-1 text-xs text-gray-600 pt-3 border-t border-[#F4EBE4]">
                  {promo.min_spend ? (
                    <p>Minimum order: LKR {promo.min_spend.toLocaleString()}</p>
                  ) : (
                    <p>No minimum spend required</p>
                  )}
                  {promo.valid_until && <p>Expires: {new Date(promo.valid_until).toLocaleDateString()}</p>}
                  <p className="text-[11px] text-gray-400">Used {promo.usage_count || 0} times</p>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-[#F4EBE4]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => SharedPosService.updatePromo(promo.id, { active: !promo.active })}
                    className="text-xs text-gray-600 hover:text-[#D67B6B]"
                  >
                    {promo.active ? "Deactivate" : "Activate"}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Delete promo code ${promo.code}?`)) {
                        SharedPosService.deletePromo(promo.id)
                      }
                    }}
                    className="size-8 text-rose-400 hover:text-rose-600"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </Card>
            ))}

            {promos.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <Tag className="size-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-600">No promotional coupon codes created yet</p>
                <p className="text-xs text-gray-400 mt-1">Click &apos;+ New Promo Code&apos; above to create a promotional discount.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT CUSTOMER                               */}
      {/* ======================================================== */}
      {(showAddCustomer || showEditCustomer) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg rounded-2xl border-none shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-[#808068] text-white p-5">
              <CardTitle className="font-serif text-lg font-bold">
                {showEditCustomer ? "Edit Customer Profile" : "Register New Customer"}
              </CardTitle>
              <CardDescription className="text-xs text-[#FAF5F1]/80">
                Add customer to directory for loyalty points, receipts, and dining tabs
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveCustomer}>
              <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-700">Full Name *</Label>
                    <Input
                      required
                      placeholder="e.g. Kasun Jayawardena"
                      value={customerForm.name}
                      onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-700">Phone Number *</Label>
                    <Input
                      required
                      placeholder="e.g. 077 123 4567"
                      value={customerForm.phone}
                      onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-700">Email Address</Label>
                    <Input
                      type="email"
                      placeholder="e.g. guest@gmail.com"
                      value={customerForm.email}
                      onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-700">Credit Limit (LKR)</Label>
                    <Input
                      type="number"
                      value={customerForm.credit_limit}
                      onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-700">Delivery / Residence Address</Label>
                  <Input
                    placeholder="e.g. Villa 4, Beach Road, Hiriketiya"
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-700">Preferences / Dietary Notes</Label>
                  <Input
                    placeholder="e.g. Vegan, oat milk flat white lover, surf instructor"
                    value={customerForm.notes}
                    onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="vip-check"
                    checked={customerForm.vip}
                    onChange={(e) => setCustomerForm({ ...customerForm, vip: e.target.checked })}
                    className="size-4 rounded text-[#D67B6B] focus:ring-[#D67B6B]"
                  />
                  <Label htmlFor="vip-check" className="text-xs font-bold text-gray-800 cursor-pointer">
                    Grant VIP Status (Priority table seating & special offers)
                  </Label>
                </div>
              </CardContent>

              <div className="flex items-center justify-end gap-2 p-5 bg-[#FAF5F1] border-t border-[#E5D8CF]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddCustomer(false)
                    setShowEditCustomer(null)
                  }}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl bg-[#D67B6B] text-white hover:bg-[#c36859]">
                  {showEditCustomer ? "Save Changes" : "Create Customer"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: SETTLE CREDIT / RECORD PAYMENT                     */}
      {/* ======================================================== */}
      {showSettleCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md rounded-2xl border-none shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-rose-700 text-white p-5">
              <CardTitle className="font-serif text-lg font-bold">Settle Customer Tab</CardTitle>
              <CardDescription className="text-xs text-rose-100">
                Record a payment to settle {showSettleCredit.name}'s credit balance
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSettleDebt}>
              <CardContent className="space-y-4 p-5">
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs">
                  <div className="flex justify-between font-semibold text-rose-900">
                    <span>Total Outstanding Debt:</span>
                    <span>LKR {showSettleCredit.credit_balance.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-700">Payment Amount (LKR) *</Label>
                  <Input
                    required
                    type="number"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-700">Payment Method</Label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-2 text-sm bg-white"
                  >
                    <option value="cash">Cash Payment</option>
                    <option value="card">Card Terminal</option>
                    <option value="bank_transfer">Bank Transfer / Slip</option>
                    <option value="qr">LankaQR</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-700">Reference / Receipt Number</Label>
                  <Input
                    placeholder="e.g. HNB-TXN-00129"
                    value={settleRef}
                    onChange={(e) => setSettleRef(e.target.value)}
                  />
                </div>
              </CardContent>

              <div className="flex items-center justify-end gap-2 p-5 bg-[#FAF5F1] border-t border-[#E5D8CF]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSettleCredit(null)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl bg-rose-600 text-white hover:bg-rose-700">
                  Confirm Payment
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CUSTOMER ORDER HISTORY                             */}
      {/* ======================================================== */}
      {showHistoryCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl rounded-2xl border-none shadow-2xl bg-white overflow-hidden max-h-[85vh] flex flex-col">
            <CardHeader className="bg-[#808068] text-white p-5 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-serif text-lg font-bold">
                    {showHistoryCustomer.name} - Order History
                  </CardTitle>
                  <CardDescription className="text-xs text-[#FAF5F1]/80">
                    {showHistoryCustomer.phone} · Loyalty Points: {showHistoryCustomer.loyalty_points || 0}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistoryCustomer(null)}
                  className="text-white hover:bg-white/20"
                >
                  Close
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5 overflow-y-auto space-y-3">
              {(() => {
                const custOrders = orders.filter(
                  (o) => o.customer_id === showHistoryCustomer.id || o.delivery_info?.phone === showHistoryCustomer.phone
                )

                if (custOrders.length === 0) {
                  return (
                    <div className="py-8 text-center text-sm text-gray-400">
                      No order history found for this customer.
                    </div>
                  )
                }

                return custOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-xl border border-[#E5D8CF] p-3.5 bg-white space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-gray-900">{ord.order_number}</span>
                      <span className="text-gray-400">{new Date(ord.created_at).toLocaleString()}</span>
                    </div>

                    <div className="divide-y divide-[#F4EBE4]">
                      {ord.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between py-1 text-gray-700">
                          <span>
                            {it.quantity}x {it.name}
                          </span>
                          <span>LKR {(it.price * it.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#F4EBE4] font-bold text-gray-900">
                      <span>Total Paid ({ord.payment_method?.toUpperCase()}):</span>
                      <span className="text-[#D67B6B]">LKR {ord.total.toLocaleString()}</span>
                    </div>
                  </div>
                ))
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD PROMO CODE                                    */}
      {/* ======================================================== */}
      {showAddPromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md rounded-2xl border-none shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-[#808068] text-white p-5">
              <CardTitle className="font-serif text-lg font-bold">Create Promo Code</CardTitle>
              <CardDescription className="text-xs text-[#FAF5F1]/80">
                Add discount coupon for special seasons or loyal guests
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreatePromo}>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-700">Promo Code *</Label>
                  <Input
                    required
                    placeholder="e.g. SURF20"
                    value={promoForm.code}
                    onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-700">Discount Type</Label>
                    <select
                      value={promoForm.discount_type}
                      onChange={(e) => setPromoForm({ ...promoForm, discount_type: e.target.value as any })}
                      className="w-full rounded-xl border border-gray-300 p-2 text-sm bg-white"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (LKR)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-700">Discount Value *</Label>
                    <Input
                      type="number"
                      required
                      value={promoForm.discount_value}
                      onChange={(e) => setPromoForm({ ...promoForm, discount_value: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-700">Min Spend (LKR)</Label>
                    <Input
                      type="number"
                      value={promoForm.min_spend}
                      onChange={(e) => setPromoForm({ ...promoForm, min_spend: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-700">Expiry Date</Label>
                    <Input
                      type="date"
                      value={promoForm.valid_until}
                      onChange={(e) => setPromoForm({ ...promoForm, valid_until: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>

              <div className="flex items-center justify-end gap-2 p-5 bg-[#FAF5F1] border-t border-[#E5D8CF]">
                <Button type="button" variant="outline" onClick={() => setShowAddPromo(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl bg-[#D67B6B] text-white hover:bg-[#c36859]">
                  Create Promo
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: LOG FEEDBACK                                      */}
      {/* ======================================================== */}
      {showAddFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md rounded-2xl border-none shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-[#808068] text-white p-5">
              <CardTitle className="font-serif text-lg font-bold">Log Guest Feedback</CardTitle>
              <CardDescription className="text-xs text-[#FAF5F1]/80">
                Capture customer reviews and dining impressions
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveFeedback}>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-700">Guest Name *</Label>
                  <Input
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={feedbackForm.customer_name}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, customer_name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-700">Rating (1 to 5 Stars)</Label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`size-6 ${
                            star <= feedbackForm.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-700">Table / Location</Label>
                  <Input
                    placeholder="e.g. Table 03, Garden Patio"
                    value={feedbackForm.table_name}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, table_name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-700">Comments *</Label>
                  <textarea
                    required
                    rows={3}
                    placeholder="What did the customer say about food, drinks, or service?"
                    value={feedbackForm.comment}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, comment: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#D67B6B]"
                  />
                </div>
              </CardContent>

              <div className="flex items-center justify-end gap-2 p-5 bg-[#FAF5F1] border-t border-[#E5D8CF]">
                <Button type="button" variant="outline" onClick={() => setShowAddFeedback(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl bg-[#D67B6B] text-white hover:bg-[#c36859]">
                  Save Feedback
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
