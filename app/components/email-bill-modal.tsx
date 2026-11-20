"use client"

import * as React from "react"
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Send,
  X,
  FileText,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export interface EmailBillModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bill: any
  defaultEmail?: string
  defaultName?: string
  onSentSuccess?: (recipientEmail: string) => void
}

export function EmailBillModal({
  open,
  onOpenChange,
  bill,
  defaultEmail = "",
  defaultName = "",
  onSentSuccess,
}: EmailBillModalProps) {
  const [email, setEmail] = React.useState(defaultEmail)
  const [customerName, setCustomerName] = React.useState(defaultName)
  const [touched, setTouched] = React.useState(false)
  const [emailError, setEmailError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<"idle" | "sending" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = React.useState<string>("")
  const [successInfo, setSuccessInfo] = React.useState<{ recipient: string; message?: string } | null>(null)

  // Reset state when modal opens or bill changes
  React.useEffect(() => {
    if (open) {
      const initialEmail =
        defaultEmail || bill?.customer_email || bill?.customerEmail || ""
      const initialName =
        defaultName || bill?.customer_name || bill?.customerName || ""
      setEmail(initialEmail)
      setCustomerName(initialName)
      setTouched(false)
      setEmailError(null)
      setStatus("idle")
      setErrorMessage("")
      setSuccessInfo(null)
    }
  }, [open, bill, defaultEmail, defaultName])

  // Validate email on change once touched
  const validate = (val: string): boolean => {
    const trimmed = val.trim()
    if (!trimmed) {
      setEmailError("Email address is required.")
      return false
    }
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
    if (!emailRegex.test(trimmed)) {
      setEmailError("Please enter a valid email address (e.g., customer@example.com).")
      return false
    }
    setEmailError(null)
    return true
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setEmail(val)
    if (touched) {
      validate(val)
    }
  }

  const handleBlur = () => {
    setTouched(true)
    validate(email)
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setTouched(true)
    if (!validate(email)) return
    if (!bill) {
      toast.error("No bill data available to email.")
      return
    }

    setStatus("sending")
    setErrorMessage("")

    try {
      const res = await fetch("/api/coffee/bills/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bill,
          recipientEmail: email.trim(),
          recipientName: customerName.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setStatus("error")
        const msg = data.error || data.details?.message || "Failed to send email. Please check your Brevo settings and retry."
        setErrorMessage(msg)
        toast.error(msg)
        return
      }

      setStatus("success")
      setSuccessInfo({
        recipient: email.trim(),
        message: data.message,
      })
      toast.success(data.message || `Bill sent to ${email.trim()}`)
      if (onSentSuccess) {
        onSentSuccess(email.trim())
      }
    } catch (err: any) {
      setStatus("error")
      const msg = err?.message || "Network error while connecting to email service."
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

  const billNumber =
    bill?.bill_number ||
    bill?.billNumber ||
    bill?.order_number ||
    bill?.orderNumber ||
    bill?.receipt_number ||
    "BILL"
  const cleanBillNumber = String(billNumber).replace(/^LS-/, "")
  const grandTotal =
    bill?.grand_total ?? bill?.total ?? bill?.total_after_discount ?? 0
  const itemsCount = Array.isArray(bill?.items) ? bill.items.length : 0
  const tableName = bill?.table_name || bill?.tableName || "Takeaway"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#E5D8CF]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#FAF5F1] text-[#808068] rounded-xl">
              <Mail className="size-5 text-[#808068]" />
            </div>
            <div>
              <DialogTitle className="font-serif text-lg font-bold text-gray-900">
                Email Bill Receipt
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Send the itemized bill and 80mm thermal PDF receipt to the customer
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Bill Summary Badge */}
        <div className="my-2 p-3 bg-[#FAF5F1] rounded-xl border border-[#E5D8CF]/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[#808068]" />
            <div>
              <span className="font-mono font-bold text-gray-900">
                ORDER #{cleanBillNumber}
              </span>
              <span className="text-gray-500 ml-1.5">
                • {tableName} • {itemsCount} item{itemsCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <Badge className="bg-[#808068] text-white font-mono text-xs font-semibold px-2.5 py-0.5">
            LKR {Number(grandTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Badge>
        </div>

        {/* Status: SUCCESS */}
        {status === "success" && (
          <div className="py-4 space-y-4 text-center">
            <div className="size-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-gray-900">
                Bill Sent Successfully!
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                An itemized receipt and 80mm PDF attachment have been emailed to:
              </p>
              <p className="font-mono font-bold text-xs text-gray-900 mt-0.5 bg-gray-100 py-1 px-3 rounded-lg inline-block">
                {successInfo?.recipient}
              </p>
            </div>
            <DialogFooter className="flex sm:justify-between gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStatus("idle")
                  setEmail("")
                  setTouched(false)
                }}
                className="text-xs rounded-xl h-10 border-[#E5D8CF]"
              >
                Send to Another Email
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                className="bg-[#808068] text-white hover:bg-[#6e6e58] text-xs rounded-xl h-10 px-6 font-semibold"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Status: IDLE / SENDING / ERROR */}
        {status !== "success" && (
          <form onSubmit={handleSend} className="space-y-4 py-1" noValidate>
            {/* Customer Email Input */}
            <div className="space-y-1.5">
              <Label htmlFor="customer-email" className="text-xs font-semibold text-gray-700">
                Customer Email Address <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="customer-email"
                  type="email"
                  autoComplete="email"
                  placeholder="e.g. customer@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={handleBlur}
                  disabled={status === "sending"}
                  aria-invalid={touched && !!emailError}
                  aria-describedby={touched && emailError ? "email-error-msg" : undefined}
                  className={`h-11 rounded-xl text-xs pl-3.5 pr-8 ${
                    touched && emailError
                      ? "border-red-500 focus-visible:ring-red-400 bg-red-50/20"
                      : "border-[#E5D8CF] focus-visible:ring-[#808068]"
                  }`}
                  autoFocus
                />
              </div>
              {touched && emailError && (
                <p id="email-error-msg" className="text-[11px] text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Customer Name (Optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="customer-name" className="text-xs font-semibold text-gray-700">
                Customer Name <span className="text-gray-400 font-normal">(Optional)</span>
              </Label>
              <Input
                id="customer-name"
                type="text"
                autoComplete="name"
                placeholder="e.g. Maya Fernando"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={status === "sending"}
                className="h-10 rounded-xl text-xs pl-3.5 border-[#E5D8CF] focus-visible:ring-[#808068]"
              />
            </div>

            {/* Error Message Box with Retry */}
            {status === "error" && errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Email Failed to Send</p>
                    <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Brevo Free Plan Notice */}
            <div className="p-2.5 bg-amber-50/60 border border-amber-200/70 rounded-xl text-[11px] text-amber-900 flex items-center justify-between">
              <span>Transactional Email • Brevo Free Plan (300/day)</span>
              <Badge variant="outline" className="border-amber-300 text-amber-800 text-[10px]">
                No Overages
              </Badge>
            </div>

            <DialogFooter className="flex sm:justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={status === "sending"}
                className="text-xs rounded-xl h-10 border-[#E5D8CF]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={status === "sending"}
                className="bg-[#D67B6B] hover:bg-[#c36859] text-white text-xs rounded-xl h-10 px-5 font-bold gap-1.5 shadow-sm"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending Bill...
                  </>
                ) : status === "error" ? (
                  <>
                    <RefreshCw className="size-4" />
                    Retry Sending
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Send Bill Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
