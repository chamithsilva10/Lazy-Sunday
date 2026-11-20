import { NextRequest, NextResponse } from "next/server"
import {
  generateBillHtml,
  generateBillPdfBuffer,
  validateEmail,
  type EmailBillPayload,
  type EmailBillItem,
} from "@/lib/bill-email-utils"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Normalizes bill payload from different sources (CoffeeBill, OrderRecord, PosReceipt props)
 * into standard EmailBillPayload.
 */
function normalizeBill(rawBill: any): EmailBillPayload {
  const billNumber =
    rawBill.bill_number ||
    rawBill.billNumber ||
    rawBill.order_number ||
    rawBill.orderNumber ||
    rawBill.receipt_number ||
    rawBill.receiptNumber ||
    "COF-1001"

  const orderNumber =
    rawBill.order_number ||
    rawBill.orderNumber ||
    rawBill.receipt_number ||
    rawBill.receiptNumber ||
    billNumber

  const tableName = rawBill.table_name || rawBill.tableName || "Takeaway"
  const cashierName = rawBill.cashier_name || rawBill.cashierName || "Barista"
  const customerName = rawBill.customer_name || rawBill.customerName || ""
  const customerPhone = rawBill.customer_phone || rawBill.customerPhone || ""
  const orderType =
    rawBill.order_type ||
    rawBill.orderType ||
    (tableName.toLowerCase().includes("takeaway") ? "takeaway" : "dine_in")

  const dateStr = rawBill.bill_date || rawBill.dateStr
  const timeStr = rawBill.timeStr

  // Items normalization
  const items: EmailBillItem[] = Array.isArray(rawBill.items)
    ? rawBill.items.map((it: any) => ({
        id: it.id || it.product_id,
        name: it.item_name || it.name || "Item",
        quantity: Number(it.quantity || 1),
        price: Number(it.unit_price ?? it.price ?? 0),
        base_price: it.base_price ? Number(it.base_price) : undefined,
        modifiers: Array.isArray(it.modifiers) ? it.modifiers : undefined,
        selected_choices: Array.isArray(it.selected_choices) ? it.selected_choices : undefined,
      }))
    : []

  const subtotal = Number(rawBill.subtotal || 0)
  const serviceCharge = Number(
    rawBill.service_charge ?? rawBill.serviceCharge ?? rawBill.tax ?? 0
  )
  const serviceChargeRate = Number(
    rawBill.service_charge_rate ?? rawBill.serviceChargeRate ?? 0.1
  )
  const discount = Number(rawBill.discount || 0)
  const total = Number(
    rawBill.grand_total ?? rawBill.total ?? Math.max(0, subtotal + serviceCharge - discount)
  )

  const paymentMethod = rawBill.payment_method || rawBill.paymentMethod || "CASH"
  const cashReceived = rawBill.cash_received !== undefined ? Number(rawBill.cash_received) : undefined
  const changeAmount = rawBill.change_amount !== undefined ? Number(rawBill.change_amount) : undefined

  const splitConfig = rawBill.split_config || rawBill.splitConfig
  const splitPayments = rawBill.split_payments || rawBill.splitPayments
  const notes = rawBill.notes

  return {
    billNumber,
    orderNumber,
    tableName,
    cashierName,
    customerName,
    customerPhone,
    orderType,
    dateStr,
    timeStr,
    items,
    subtotal,
    serviceCharge,
    serviceChargeRate,
    discount,
    total,
    paymentMethod,
    cashReceived,
    changeAmount,
    splitConfig,
    splitPayments,
    notes,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bill: rawBill, recipientEmail, recipientName } = body

    if (!rawBill) {
      return NextResponse.json(
        { success: false, error: "Bill data is required." },
        { status: 400 }
      )
    }

    // 1. Email format validation
    const emailValidation = validateEmail(recipientEmail)
    if (!emailValidation.isValid) {
      return NextResponse.json(
        { success: false, error: emailValidation.error },
        { status: 400 }
      )
    }

    const cleanEmail = recipientEmail.trim()
    const normalizedBill = normalizeBill(rawBill)
    const cleanNumber = (normalizedBill.billNumber || "BILL").replace(/^LS-/, "")

    // 2. Generate HTML template and PDF attachment
    const htmlContent = generateBillHtml(normalizedBill)
    const pdfBuffer = await generateBillPdfBuffer(normalizedBill)
    const pdfBase64 = pdfBuffer.toString("base64")

    // 3. Brevo Transactional Email API credentials from environment variables
    const apiKey = process.env.BREVO_API_KEY
    const senderEmail = process.env.BREVO_SENDER_EMAIL || "orders@lazysunday.lk"
    const senderName = process.env.BREVO_SENDER_NAME || "Lazy Sunday Cafe"

    // Check if API key is provided
    if (!apiKey) {
      // In demo mode without API key, provide helpful guidance while allowing mock verification
      const isDemo =
        process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true"

      if (isDemo) {
        return NextResponse.json({
          success: true,
          simulated: true,
          recipient: cleanEmail,
          message: `Bill #${cleanNumber} prepared successfully. (Demo Mode: Add BREVO_API_KEY in .env.local to send live emails to customers).`,
        })
      }

      return NextResponse.json(
        {
          success: false,
          error: "Brevo API key is not configured.",
          code: "MISSING_API_KEY",
          details:
            "Please configure BREVO_API_KEY and BREVO_SENDER_EMAIL in your .env.local file on the server.",
        },
        { status: 500 }
      )
    }

    // 4. Send via Brevo Transactional Email API
    const brevoPayload = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: cleanEmail,
          name: recipientName?.trim() || normalizedBill.customerName || "Customer",
        },
      ],
      subject: `Your Bill Receipt from Lazy Sunday Cafe - #${cleanNumber}`,
      htmlContent,
      attachment: [
        {
          name: `LazySunday-Receipt-${cleanNumber}.pdf`,
          content: pdfBase64,
        },
      ],
    }

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(brevoPayload),
    })

    const brevoData = await brevoResponse.json().catch(() => ({}))

    if (!brevoResponse.ok) {
      // Handle Free Plan Limit (300 emails/day)
      const errCode = (brevoData?.code || "").toLowerCase()
      const errMsg = (brevoData?.message || "").toLowerCase()
      const isLimitExceeded =
        brevoResponse.status === 402 ||
        brevoResponse.status === 429 ||
        errCode.includes("not_enough_credits") ||
        errCode.includes("credit") ||
        errMsg.includes("limit") ||
        errMsg.includes("credit") ||
        errMsg.includes("quota")

      if (isLimitExceeded) {
        return NextResponse.json(
          {
            success: false,
            code: "FREE_PLAN_LIMIT_REACHED",
            error:
              "Brevo Free Plan daily limit reached (300 emails/day). The limit will reset tomorrow at midnight UTC with no automatic charges or upgrades.",
          },
          { status: 429 }
        )
      }

      // Handle unverified sender
      if (
        errMsg.includes("sender") ||
        errMsg.includes("unverified") ||
        errCode.includes("unauthorized")
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "UNVERIFIED_SENDER",
            error: `Sender email (${senderEmail}) is not verified in Brevo. Please verify it in your Brevo account dashboard under Senders & IP.`,
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: brevoData?.message || "Failed to send email via Brevo.",
          details: brevoData,
        },
        { status: brevoResponse.status }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: brevoData?.messageId || "sent",
      recipient: cleanEmail,
      message: `Bill #${cleanNumber} was successfully emailed to ${cleanEmail}.`,
    })
  } catch (error: any) {
    console.error("Error in email bill route:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error while processing bill email.",
      },
      { status: 500 }
    )
  }
}
