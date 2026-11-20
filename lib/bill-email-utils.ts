import PDFDocument from "pdfkit"
import { LAZY_SUNDAY_LOGO_BLACK_DATA_URL } from "./brand-logo"

export interface EmailBillItem {
  id?: string | number
  name: string
  quantity: number
  price: number
  base_price?: number
  modifiers?: string[]
  selected_choices?: Array<{
    group_id?: string
    group_name?: string
    option_id?: string
    option_name: string
    price?: number
  }>
}

export interface EmailBillSplitShare {
  diner_id?: string
  diner_name: string
  percentage?: number
  total_owed: number
  amount_paid?: number
  remaining_balance?: number
  status?: string
  assigned_items?: Array<{
    name: string
    share_label?: string
    amount: number
  }>
}

export interface EmailBillPayload {
  billNumber: string
  orderNumber?: string
  receiptNumber?: string
  tableName?: string
  cashierName?: string
  orderType?: string
  dateStr?: string
  timeStr?: string
  items: EmailBillItem[]
  subtotal: number
  serviceCharge: number
  serviceChargeRate?: number
  discount?: number
  total: number
  paymentMethod?: string
  cashReceived?: number
  changeAmount?: number
  splitConfig?: {
    method?: string
    num_diners?: number
    discount_amount?: number
    total_after_discount?: number
    remaining_balance?: number
    calculated_shares?: EmailBillSplitShare[]
  }
  splitPayments?: Array<{
    diner_name?: string
    method: string
    amount: number
    reference?: string
    status?: string
  }>
  customerName?: string
  customerPhone?: string
  notes?: string
}

export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== "string") {
    return { isValid: false, error: "Email address is required." }
  }
  const trimmed = email.trim()
  if (trimmed.length === 0) {
    return { isValid: false, error: "Email address cannot be empty." }
  }
  if (trimmed.length > 254) {
    return { isValid: false, error: "Email address is too long." }
  }
  // Standard RFC 5322 regex for valid email format
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: "Please enter a valid email address (e.g., customer@example.com)." }
  }
  return { isValid: true }
}

export function formatCurrency(amount: number): string {
  return (amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Generates an exact-replica HTML email matching the PosReceipt thermal layout.
 * Styled with robust inline CSS to ensure cross-client compatibility (Gmail, Apple Mail, Outlook).
 */
export function generateBillHtml(bill: EmailBillPayload): string {
  const brandName = "LAZY SUNDAY"
  const brandSubtitle = "CAFE"
  const brandAddress = "Tel: +94 76 912 9153"
  const currency = "LKR"

  const now = new Date()
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const day = now.getDate().toString().padStart(2, "0")
  const month = monthNames[now.getMonth()]
  const year = now.getFullYear()
  const hours = now.getHours().toString().padStart(2, "0")
  const minutes = now.getMinutes().toString().padStart(2, "0")

  const displayDate = bill.dateStr || `${day} ${month} ${year}`
  const displayTime = bill.timeStr || `${hours}:${minutes}`
  const serviceChargePercent = Math.round((bill.serviceChargeRate ?? 0.1) * 100)

  const isTakeaway =
    (bill.orderType || "").toLowerCase().includes("takeaway") ||
    (bill.tableName || "").toLowerCase() === "takeaway"
  const tableNumOnly = bill.tableName
    ? bill.tableName.replace(/^(Table|Tab)\s*/i, "").trim()
    : "01"
  const tableDisplay = isTakeaway
    ? "TAKEAWAY"
    : `DINE IN / TABLE ${tableNumOnly.length < 2 ? `0${tableNumOnly}` : tableNumOnly}`

  const orderNumClean = (bill.orderNumber || bill.billNumber || "").replace(/^LS-/, "")
  const isSplit =
    (bill.splitPayments && bill.splitPayments.length > 0) ||
    (bill.paymentMethod || "").toLowerCase() === "split" ||
    !!bill.splitConfig
  const isCash = (bill.paymentMethod || "CASH").toUpperCase() === "CASH"

  // Render items rows
  const itemsHtml = bill.items
    .map((item) => {
      const lineTotal = item.price * item.quantity
      const hasStructuredChoices =
        Array.isArray(item.selected_choices) && item.selected_choices.length > 0
      const hasModifiers =
        !hasStructuredChoices && Array.isArray(item.modifiers) && item.modifiers.length > 0

      let choicesHtml = ""
      if (hasStructuredChoices) {
        choicesHtml = item.selected_choices!
          .map(
            (sc) =>
              `<div style="font-size: 11px; color: #4b5563; line-height: 1.3; margin-top: 2px;">+ ${
                sc.group_name ? `${sc.group_name}: ` : ""
              }${sc.option_name}${
                Number(sc.price) > 0 ? ` (+${currency} ${formatCurrency(Number(sc.price))})` : ""
              }</div>`
          )
          .join("")
      } else if (hasModifiers) {
        choicesHtml = `<div style="font-size: 11px; color: #4b5563; line-height: 1.3; margin-top: 2px;">${item
          .modifiers!.map((m) => `+ ${m}`)
          .join(", ")}</div>`
      }

      return `
        <tr>
          <td style="padding: 6px 0; vertical-align: top; width: 14%; font-weight: 600; font-size: 12px; color: #111827;">
            ${item.quantity}
          </td>
          <td style="padding: 6px 8px; vertical-align: top; font-size: 12px; color: #111827;">
            <div style="font-weight: 600; line-height: 1.3;">${item.name}</div>
            ${choicesHtml}
          </td>
          <td style="padding: 6px 0; vertical-align: top; width: 32%; text-align: right; font-weight: 600; font-size: 12px; color: #111827; font-variant-numeric: tabular-nums;">
            ${formatCurrency(lineTotal)}
          </td>
        </tr>
      `
    })
    .join("")

  // Render split breakdown if present
  let splitHtml = ""
  if (
    bill.splitConfig &&
    Array.isArray(bill.splitConfig.calculated_shares) &&
    bill.splitConfig.calculated_shares.length > 0
  ) {
    const splitMethodLabel =
      bill.splitConfig.method === "by_items"
        ? "BY PRODUCTS"
        : bill.splitConfig.method === "by_percentage"
        ? "BY PERCENTAGE"
        : "BY AMOUNT"

    const sharesHtml = bill.splitConfig.calculated_shares
      .map((share) => {
        let assignedItemsHtml = ""
        if (Array.isArray(share.assigned_items) && share.assigned_items.length > 0) {
          assignedItemsHtml = share.assigned_items
            .map(
              (ai) => `
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: #6b7280; margin-top: 2px;">
                <span>• ${ai.name} (${ai.share_label || "100%"})</span>
                <span style="font-variant-numeric: tabular-nums;">${formatCurrency(ai.amount)}</span>
              </div>
            `
            )
            .join("")
        }

        const isPaid = share.status === "paid"
        const dueText = isPaid
          ? `<span style="color: #059669; font-weight: 700;">PAID &#10003;</span>`
          : `<span style="color: #dc2626; font-weight: 700;">DUE: ${formatCurrency(
              share.remaining_balance ?? share.total_owed
            )}</span>`

        return `
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; background-color: #f9fafb;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; font-weight: 700; font-size: 12px; color: #111827;">
              <span>${share.diner_name}${
                bill.splitConfig?.method === "by_percentage" && share.percentage != null
                  ? ` (${Number(share.percentage).toFixed(1)}%)`
                  : ""
              }</span>
              <span style="font-variant-numeric: tabular-nums;">${formatCurrency(share.total_owed)}</span>
            </div>
            ${assignedItemsHtml}
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #4b5563; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e5e7eb;">
              <span>Paid: ${formatCurrency(share.amount_paid || 0)}</span>
              <span>${dueText}</span>
            </div>
          </div>
        `
      })
      .join("")

    splitHtml = `
      <div style="border-top: 1px solid #111827; margin: 12px 0;"></div>
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #111827; margin-bottom: 6px;">
          <span>SPLIT BILL (${splitMethodLabel})</span>
          <span>SHARE (${currency})</span>
        </div>
        ${sharesHtml}
      </div>
    `
  }

  // Payment breakdown
  let paymentLinesHtml = ""
  if (isSplit && bill.splitPayments && bill.splitPayments.length > 0) {
    const validSplitPayments = bill.splitPayments.filter(
      (sp) => sp.status !== "refunded" && sp.status !== "voided"
    )
    paymentLinesHtml = `
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #4b5563; margin-bottom: 4px;">
        Recorded Split Payments
      </div>
      ${validSplitPayments
        .map(
          (sp) => `
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #111827; margin-bottom: 3px;">
            <span>${sp.diner_name ? `${sp.diner_name} &middot; ` : ""}${sp.method.toUpperCase()}${
            sp.reference ? ` (${sp.reference})` : ""
          }</span>
            <span style="font-variant-numeric: tabular-nums;">${formatCurrency(sp.amount)}</span>
          </div>
        `
        )
        .join("")}
      ${
        bill.splitConfig && Number(bill.splitConfig.remaining_balance) > 0
          ? `
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #b45309; padding-top: 4px; border-top: 1px dashed #d1d5db;">
            <span>Unpaid Balance Due</span>
            <span style="font-variant-numeric: tabular-nums;">${formatCurrency(
              Number(bill.splitConfig.remaining_balance)
            )}</span>
          </div>
        `
          : ""
      }
      ${
        bill.changeAmount !== undefined && bill.changeAmount > 0
          ? `
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #111827; margin-top: 3px;">
            <span>Change</span>
            <span style="font-variant-numeric: tabular-nums;">${formatCurrency(bill.changeAmount)}</span>
          </div>
        `
          : ""
      }
    `
  } else if (isCash) {
    paymentLinesHtml = `
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: #111827; margin-bottom: 3px;">
        <span>Cash</span>
        <span style="font-variant-numeric: tabular-nums;">${formatCurrency(
          bill.cashReceived ?? bill.total
        )}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: #111827;">
        <span>Change</span>
        <span style="font-variant-numeric: tabular-nums;">${formatCurrency(
          bill.changeAmount ?? 0
        )}</span>
      </div>
    `
  } else {
    paymentLinesHtml = `
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: #111827; margin-bottom: 3px;">
        <span>${(bill.paymentMethod || "CARD").toUpperCase()}</span>
        <span style="font-variant-numeric: tabular-nums;">${formatCurrency(bill.total)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: #111827;">
        <span>Change</span>
        <span style="font-variant-numeric: tabular-nums;">0.00</span>
      </div>
    `
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt ${orderNumClean} - ${brandName}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #faf5f1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; line-height: 1.4;">
  <div style="max-width: 360px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5d8cf; border-radius: 20px; padding: 28px 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
    
    <!-- Top Branding Header -->
    <div style="text-align: center; margin-bottom: 12px;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; color: #111827;">
        ${brandName}
      </h1>
      <div style="margin-top: 3px; font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #111827;">
        ${brandSubtitle}
      </div>
      <div style="margin-top: 2px; font-size: 11px; color: #374151; font-weight: 500;">
        ${brandAddress}
      </div>
    </div>

    <!-- Solid Divider -->
    <div style="border-top: 1px solid #111827; margin: 12px 0;"></div>

    <!-- Order Metadata -->
    <div style="font-size: 12px; color: #111827; line-height: 1.45;">
      <div style="font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
        ORDER ${orderNumClean}
      </div>
      <div style="font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #111827;">
        ${tableDisplay}
      </div>
      <div style="font-size: 11px; color: #4b5563;">
        ${displayDate} &middot; ${displayTime}
      </div>
      <div style="font-size: 11px; color: #4b5563;">
        Cashier: ${bill.cashierName || "Barista"}
      </div>
      ${
        bill.customerName
          ? `<div style="font-size: 11px; color: #4b5563;">Customer: <strong>${bill.customerName}</strong></div>`
          : ""
      }
    </div>

    <!-- Solid Divider -->
    <div style="border-top: 1px solid #111827; margin: 12px 0;"></div>

    <!-- Table Header -->
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #111827; margin-bottom: 4px;">
      <tr>
        <td style="width: 14%; padding: 0 0 4px 0;">QTY</td>
        <td style="padding: 0 8px 4px 8px;">ITEM</td>
        <td style="width: 32%; text-align: right; padding: 0 0 4px 0;">${currency}</td>
      </tr>
    </table>

    <div style="border-top: 1px solid #111827; margin: 2px 0 6px 0;"></div>

    <!-- Items List -->
    <table style="width: 100%; border-collapse: collapse;">
      ${itemsHtml}
    </table>

    <!-- Divider -->
    <div style="border-top: 1px solid #111827; margin: 12px 0;"></div>

    <!-- Subtotals Breakdown -->
    <div style="font-size: 12px; color: #111827; line-height: 1.6;">
      <div style="display: flex; justify-content: space-between;">
        <span>Subtotal</span>
        <span style="font-variant-numeric: tabular-nums;">${formatCurrency(bill.subtotal)}</span>
      </div>

      ${
        bill.serviceCharge > 0
          ? `
        <div style="display: flex; justify-content: space-between;">
          <span>Service Charge (${serviceChargePercent}%)</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(bill.serviceCharge)}</span>
        </div>
      `
          : ""
      }

      ${
        bill.discount && bill.discount > 0
          ? `
        <div style="display: flex; justify-content: space-between; color: #047857;">
          <span>Discount</span>
          <span style="font-variant-numeric: tabular-nums;">-${formatCurrency(bill.discount)}</span>
        </div>
      `
          : ""
      }
    </div>

    <!-- Heavy Double Divider -->
    <div style="border-top: 2px solid #111827; margin: 10px 0;"></div>

    <!-- TOTAL / LKR Banner -->
    <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0;">
      <span style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #111827;">
        TOTAL / ${currency}
      </span>
      <span style="font-size: 24px; font-weight: 900; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: #111827;">
        ${formatCurrency(bill.total)}
      </span>
    </div>

    <!-- Heavy Double Divider -->
    <div style="border-top: 2px solid #111827; margin: 10px 0;"></div>

    <!-- Split bill section (if applicable) -->
    ${splitHtml}

    <!-- Payment section -->
    <div style="font-size: 12px; color: #111827; line-height: 1.6;">
      ${paymentLinesHtml}
    </div>

    <!-- Solid Divider -->
    <div style="border-top: 1px solid #111827; margin: 14px 0 10px 0;"></div>

    <!-- Footer -->
    <div style="text-align: center; font-size: 12px; color: #111827; line-height: 1.5;">
      <div style="font-weight: 500;">Good coffee. Good day.</div>
      <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.35em; text-transform: uppercase; margin-top: 4px;">
        T H A N K &nbsp; Y O U
      </div>
    </div>

    <!-- PDF Attachment Badge -->
    <div style="margin-top: 18px; padding-top: 12px; border-top: 1px dashed #d1d5db; text-align: center; font-size: 10px; color: #6b7280;">
      &#128206; A printable 80mm thermal receipt PDF is attached to this email.
    </div>

  </div>
</body>
</html>
  `.trim()
}

/**
 * Generates an 80mm thermal receipt PDF matching the PosReceipt slip format.
 * Sized dynamically to fit items and split shares without awkward page splitting.
 */
export function generateBillPdfBuffer(bill: EmailBillPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // 80mm standard thermal roll width = ~226.77 pt
    const width = 226.77
    const mLeft = 14
    const mRight = width - 14
    const cWidth = mRight - mLeft

    // Calculate required dynamic height based on content
    const baseHeight = 280
    const itemsCount = Array.isArray(bill.items) ? bill.items.length : 0
    let choicesCount = 0
    bill.items.forEach((it) => {
      if (Array.isArray(it.selected_choices)) choicesCount += it.selected_choices.length
      if (Array.isArray(it.modifiers)) choicesCount += it.modifiers.length
    })
    const itemsHeight = itemsCount * 18 + choicesCount * 10
    const sharesCount =
      bill.splitConfig && Array.isArray(bill.splitConfig.calculated_shares)
        ? bill.splitConfig.calculated_shares.length
        : 0
    const splitHeight = sharesCount > 0 ? 30 + sharesCount * 36 : 0
    const dynamicHeight = Math.max(500, Math.ceil(baseHeight + itemsHeight + splitHeight + 60))

    const doc = new PDFDocument({
      size: [width, dynamicHeight],
      margins: { top: 14, bottom: 14, left: mLeft, right: mLeft },
    })

    const buffers: Buffer[] = []
    doc.on("data", (chunk) => buffers.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(buffers)))
    doc.on("error", (err) => reject(err))

    // 1. Embedded Brand Logo
    try {
      const base64Data = LAZY_SUNDAY_LOGO_BLACK_DATA_URL.replace(/^data:image\/\w+;base64,/, "")
      const logoBuffer = Buffer.from(base64Data, "base64")
      doc.image(logoBuffer, (width - 44) / 2, doc.y, { width: 44 })
      doc.y += 48
    } catch {
      // If logo fails to decode, proceed with text branding
    }

    // 2. Header
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#000000")
      .text("LAZY SUNDAY", { align: "center", width: cWidth })
    doc.font("Helvetica-Bold").fontSize(7.5).text("CAFE", { align: "center", width: cWidth })
    doc.font("Helvetica").fontSize(7).text("Tel: +94 76 912 9153", { align: "center", width: cWidth })
    doc.moveDown(0.3)

    // Divider
    doc.strokeColor("#000000").lineWidth(0.5).moveTo(mLeft, doc.y).lineTo(mRight, doc.y).stroke()
    doc.moveDown(0.3)

    // 3. Metadata
    const orderNumClean = (bill.orderNumber || bill.billNumber || "").replace(/^LS-/, "")
    const isTakeaway =
      (bill.orderType || "").toLowerCase().includes("takeaway") ||
      (bill.tableName || "").toLowerCase() === "takeaway"
    const tableNumOnly = bill.tableName
      ? bill.tableName.replace(/^(Table|Tab)\s*/i, "").trim()
      : "01"
    const tableDisplay = isTakeaway
      ? "TAKEAWAY"
      : `DINE IN / TABLE ${tableNumOnly.length < 2 ? `0${tableNumOnly}` : tableNumOnly}`

    const now = new Date()
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    const day = now.getDate().toString().padStart(2, "0")
    const month = monthNames[now.getMonth()]
    const year = now.getFullYear()
    const hours = now.getHours().toString().padStart(2, "0")
    const minutes = now.getMinutes().toString().padStart(2, "0")
    const displayDate = bill.dateStr || `${day} ${month} ${year}`
    const displayTime = bill.timeStr || `${hours}:${minutes}`

    doc.font("Helvetica-Bold").fontSize(8.5).text(`ORDER ${orderNumClean}`, mLeft, doc.y)
    doc.font("Helvetica-Bold").fontSize(7).text(tableDisplay)
    doc.font("Helvetica").fontSize(7).text(`${displayDate} · ${displayTime}`)
    doc.text(`Cashier: ${bill.cashierName || "Barista"}`)
    if (bill.customerName) {
      doc.text(`Customer: ${bill.customerName}`)
    }
    doc.moveDown(0.3)

    // Divider
    doc.strokeColor("#000000").lineWidth(0.5).moveTo(mLeft, doc.y).lineTo(mRight, doc.y).stroke()
    doc.moveDown(0.3)

    // 4. Columns Header
    const colY = doc.y
    doc.font("Helvetica-Bold").fontSize(7)
    doc.text("QTY", mLeft, colY, { width: 22 })
    doc.text("ITEM", mLeft + 24, colY, { width: 106 })
    doc.text("LKR", mLeft + 130, colY, { width: 68, align: "right" })
    doc.moveDown(0.2)

    doc.strokeColor("#000000").lineWidth(0.5).moveTo(mLeft, doc.y).lineTo(mRight, doc.y).stroke()
    doc.moveDown(0.3)

    // 5. Items
    bill.items.forEach((item) => {
      const lineTotal = item.price * item.quantity
      const curY = doc.y
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000000")
      doc.text(String(item.quantity), mLeft, curY, { width: 22 })
      doc.font("Helvetica").text(item.name, mLeft + 24, curY, { width: 106 })
      doc.text(formatCurrency(lineTotal), mLeft + 130, curY, { width: 68, align: "right" })

      // Structured choices
      if (Array.isArray(item.selected_choices) && item.selected_choices.length > 0) {
        item.selected_choices.forEach((sc) => {
          const pricePart = Number(sc.price) > 0 ? ` (+${formatCurrency(Number(sc.price))})` : ""
          doc
            .font("Helvetica")
            .fontSize(6.5)
            .fillColor("#4b5563")
            .text(
              `+ ${sc.group_name ? `${sc.group_name}: ` : ""}${sc.option_name}${pricePart}`,
              mLeft + 24,
              doc.y,
              { width: 106 }
            )
        })
        doc.fillColor("#000000")
      } else if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
        doc
          .font("Helvetica")
          .fontSize(6.5)
          .fillColor("#4b5563")
          .text(`+ ${item.modifiers.join(", ")}`, mLeft + 24, doc.y, { width: 106 })
        doc.fillColor("#000000")
      }
      doc.moveDown(0.2)
    })

    doc.moveDown(0.3)
    doc.strokeColor("#000000").lineWidth(0.5).dash(2, { space: 2 }).moveTo(mLeft, doc.y).lineTo(mRight, doc.y).stroke()
    doc.undash().moveDown(0.3)

    // 6. Subtotals
    doc.font("Helvetica").fontSize(7.5)
    let curY = doc.y
    doc.text("Subtotal", mLeft, curY)
    doc.text(formatCurrency(bill.subtotal), mLeft + 90, curY, { width: 108, align: "right" })

    if (bill.serviceCharge > 0) {
      curY = doc.y
      const sPercent = Math.round((bill.serviceChargeRate ?? 0.1) * 100)
      doc.text(`Service Charge (${sPercent}%)`, mLeft, curY)
      doc.text(formatCurrency(bill.serviceCharge), mLeft + 90, curY, { width: 108, align: "right" })
    }

    if (bill.discount && bill.discount > 0) {
      curY = doc.y
      doc.text("Discount", mLeft, curY)
      doc.text(`-${formatCurrency(bill.discount)}`, mLeft + 90, curY, { width: 108, align: "right" })
    }

    doc.moveDown(0.3)
    doc.strokeColor("#000000").lineWidth(1).moveTo(mLeft, doc.y).lineTo(mRight, doc.y).stroke()
    doc.moveDown(0.2)

    // 7. TOTAL / LKR
    curY = doc.y
    doc.font("Helvetica-Bold").fontSize(8.5).text("TOTAL / LKR", mLeft, curY + 2)
    doc.font("Helvetica-Bold").fontSize(12).text(formatCurrency(bill.total), mLeft + 80, curY, {
      width: 118,
      align: "right",
    })

    doc.moveDown(0.3)
    doc.strokeColor("#000000").lineWidth(1).moveTo(mLeft, doc.y).lineTo(mRight, doc.y).stroke()
    doc.moveDown(0.3)

    // 8. Diner Split breakdown (if present)
    if (
      bill.splitConfig &&
      Array.isArray(bill.splitConfig.calculated_shares) &&
      bill.splitConfig.calculated_shares.length > 0
    ) {
      const splitMethodLabel =
        bill.splitConfig.method === "by_items"
          ? "BY PRODUCTS"
          : bill.splitConfig.method === "by_percentage"
          ? "BY PERCENTAGE"
          : "BY AMOUNT"
      doc.font("Helvetica-Bold").fontSize(6.5).text(`SPLIT BILL (${splitMethodLabel})`, mLeft, doc.y)
      doc.moveDown(0.2)

      bill.splitConfig.calculated_shares.forEach((share) => {
        curY = doc.y
        doc.font("Helvetica-Bold").fontSize(7)
        doc.text(
          `${share.diner_name}${
            bill.splitConfig?.method === "by_percentage" && share.percentage != null
              ? ` (${Number(share.percentage).toFixed(1)}%)`
              : ""
          }`,
          mLeft,
          curY,
          { width: 110 }
        )
        doc.text(formatCurrency(share.total_owed), mLeft + 110, curY, { width: 88, align: "right" })

        // Status
        const isPaid = share.status === "paid"
        doc
          .font("Helvetica")
          .fontSize(6)
          .text(
            `Paid: ${formatCurrency(share.amount_paid || 0)}  |  ${
              isPaid ? "PAID ✓" : `DUE: ${formatCurrency(share.remaining_balance ?? share.total_owed)}`
            }`,
            mLeft,
            doc.y
          )
        doc.moveDown(0.2)
      })

      doc.strokeColor("#000000").lineWidth(0.5).dash(2, { space: 2 }).moveTo(mLeft, doc.y).lineTo(mRight, doc.y).stroke()
      doc.undash().moveDown(0.3)
    }

    // 9. Payment Details
    const isSplit =
      (bill.splitPayments && bill.splitPayments.length > 0) ||
      (bill.paymentMethod || "").toLowerCase() === "split"
    const isCash = (bill.paymentMethod || "CASH").toUpperCase() === "CASH"

    if (isSplit && bill.splitPayments && bill.splitPayments.length > 0) {
      doc.font("Helvetica-Bold").fontSize(6.5).text("RECORDED SPLIT PAYMENTS", mLeft, doc.y)
      bill.splitPayments
        .filter((sp) => sp.status !== "refunded" && sp.status !== "voided")
        .forEach((sp) => {
          curY = doc.y
          doc.font("Helvetica").fontSize(7)
          doc.text(
            `${sp.diner_name ? `${sp.diner_name} · ` : ""}${sp.method.toUpperCase()}`,
            mLeft,
            curY,
            { width: 100 }
          )
          doc.text(formatCurrency(sp.amount), mLeft + 100, curY, { width: 98, align: "right" })
        })
      if (bill.splitConfig && Number(bill.splitConfig.remaining_balance) > 0) {
        curY = doc.y
        doc.font("Helvetica-Bold").fontSize(7)
        doc.text("Unpaid Balance Due", mLeft, curY)
        doc.text(formatCurrency(Number(bill.splitConfig.remaining_balance)), mLeft + 100, curY, {
          width: 98,
          align: "right",
        })
      }
    } else if (isCash) {
      curY = doc.y
      doc.font("Helvetica").fontSize(7).text("Cash", mLeft, curY)
      doc.text(formatCurrency(bill.cashReceived ?? bill.total), mLeft + 100, curY, {
        width: 98,
        align: "right",
      })
      curY = doc.y
      doc.text("Change", mLeft, curY)
      doc.text(formatCurrency(bill.changeAmount ?? 0), mLeft + 100, curY, { width: 98, align: "right" })
    } else {
      curY = doc.y
      doc.font("Helvetica").fontSize(7).text((bill.paymentMethod || "CARD").toUpperCase(), mLeft, curY)
      doc.text(formatCurrency(bill.total), mLeft + 100, curY, { width: 98, align: "right" })
      curY = doc.y
      doc.text("Change", mLeft, curY)
      doc.text("0.00", mLeft + 100, curY, { width: 98, align: "right" })
    }

    doc.moveDown(0.4)
    doc.strokeColor("#000000").lineWidth(0.5).dash(2, { space: 2 }).moveTo(mLeft, doc.y).lineTo(mRight, doc.y).stroke()
    doc.undash().moveDown(0.4)

    // 10. Footer
    doc.font("Helvetica").fontSize(7).text("Good coffee. Good day.", { align: "center", width: cWidth })
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .text("T H A N K   Y O U", { align: "center", width: cWidth })

    doc.end()
  })
}
