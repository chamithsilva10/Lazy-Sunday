"use client"

export interface ThermalReceiptItem {
  name: string
  price: number
  quantity: number
  notes?: string
  category?: string
  modifiers?: string[]
}

export interface ThermalReceiptOrder {
  id?: string
  brand_name?: string
  brand_subtitle?: string
  brand_address?: string
  currency?: string
  order_number: string
  receipt_number?: string
  table_name?: string
  cashier_name?: string
  items: ThermalReceiptItem[]
  subtotal: number
  service_charge: number
  service_charge_rate?: number
  discount?: number
  total: number
  payment_method?: string
  cash_received?: number
  change_amount?: number
  order_type?: string
  created_at?: string
}

export interface ThermalTicketItem {
  name: string
  quantity: number
  notes?: string
  category?: string
  modifiers?: string[]
}

export interface ThermalTicketOrder {
  brand_name?: string
  brand_subtitle?: string
  brand_address?: string
  order_number: string
  table_name?: string
  cashier_name?: string
  created_at?: string
  items: ThermalTicketItem[]
}

/**
 * Print modern 80mm Guest Bill, Tax Invoice, or Customer Receipt matching minimalist ABC Coffee design
 */
export function printThermalReceiptDoc(orderData: ThermalReceiptOrder, isGuestBill = false) {
  if (!orderData) return

  const popup = window.open("", "thermal-receipt-print", "width=480,height=800")
  if (!popup) {
    alert("Please allow pop-ups to open the thermal receipt printer window.")
    return
  }

  const brandName = orderData.brand_name || "ABC COFFEE"
  const brandSubtitle = orderData.brand_subtitle || "SPECIALTY COFFEE"
  const brandAddress = orderData.brand_address || "123, Main Street"
  const currency = orderData.currency || "LKR"

  const d = new Date(orderData.created_at || Date.now())
  const day = d.getDate().toString().padStart(2, "0")
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const month = monthNames[d.getMonth()]
  const year = d.getFullYear()
  const hours = d.getHours().toString().padStart(2, "0")
  const minutes = d.getMinutes().toString().padStart(2, "0")
  const dateFormatted = `${day} ${month} ${year} · ${hours}:${minutes}`

  const orderNumClean = (orderData.order_number || "").replace(/^LS-/, "")
  const receiptNum = orderData.receipt_number || orderData.order_number
  const isTakeaway = (orderData.order_type || "").toLowerCase().includes("takeaway") || (orderData.table_name || "").toLowerCase() === "takeaway"
  const tableNumOnly = orderData.table_name ? orderData.table_name.replace(/^(Table|Tab)\s*/i, "").trim() : "01"
  const tableDisplay = isTakeaway
    ? "TAKEAWAY"
    : `DINE IN / TABLE ${tableNumOnly.length < 2 ? `0${tableNumOnly}` : tableNumOnly}`

  const itemsHtml = orderData.items
    .map(
      (it) => `
    <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; padding: 3.5px 0; color: #000;">
      <span style="width: 14%; font-weight: 500;">${it.quantity}</span>
      <div style="flex: 1; padding: 0 4px;">
        <div style="font-weight: 500; line-height: 1.25;">${it.name}</div>
        ${it.modifiers && it.modifiers.length > 0 ? `<div style="font-size: 10px; color: #333; margin-top: 1px;">${it.modifiers.map((m) => `+ ${m}`).join(", ")}</div>` : ""}
        ${it.notes ? `<div style="font-size: 9.5px; color: #000; font-weight: 600; margin-top: 1px;">Note: ${it.notes}</div>` : ""}
      </div>
      <span style="width: 32%; text-align: right; font-variant-numeric: tabular-nums; font-weight: 500;">
        ${(it.price * it.quantity).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  `
    )
    .join("")

  const isCash = (orderData.payment_method || "cash").toLowerCase() === "cash"
  const isSplit = (orderData.payment_method || "").toLowerCase() === "split" && Array.isArray((orderData as any).split_payments) && (orderData as any).split_payments.length > 0

  let paymentSectionHtml = ""
  if (isGuestBill) {
    paymentSectionHtml = `
      <div style="text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 0;">
        PLEASE PAY AT CASHIER COUNTER
      </div>
    `
  } else if (isSplit) {
    paymentSectionHtml = `
      ${((orderData as any).split_payments || []).map((sp: any) => `
        <div style="display: flex; justify-content: space-between;">
          <span>${String(sp.method || "Payment").charAt(0).toUpperCase() + String(sp.method || "Payment").slice(1)}${sp.reference ? ` (${sp.reference})` : ""}</span>
          <span style="font-variant-numeric: tabular-nums;">${Number(sp.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      `).join("")}
      ${(orderData.change_amount || 0) > 0 ? `
        <div style="display: flex; justify-content: space-between; font-weight: 600;">
          <span>Change</span>
          <span style="font-variant-numeric: tabular-nums;">${Number(orderData.change_amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      ` : ""}
    `
  } else if (isCash) {
    const cashTendered = orderData.cash_received || orderData.total
    const changeDue = orderData.change_amount ?? Math.max(0, cashTendered - orderData.total)
    paymentSectionHtml = `
      <div style="display: flex; justify-content: space-between;">
        <span>Cash</span>
        <span style="font-variant-numeric: tabular-nums;">${cashTendered.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Change</span>
        <span style="font-variant-numeric: tabular-nums;">${changeDue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    `
  } else {
    const methodRaw = orderData.payment_method || "Card"
    const methodLabel = methodRaw === "qr" || methodRaw === "transfer" ? "Lanka QR / Digital" : methodRaw.charAt(0).toUpperCase() + methodRaw.slice(1).toLowerCase()
    paymentSectionHtml = `
      <div style="display: flex; justify-content: space-between;">
        <span>${methodLabel}</span>
        <span style="font-variant-numeric: tabular-nums;">${orderData.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Change</span>
        <span style="font-variant-numeric: tabular-nums;">0.00</span>
      </div>
    `
  }

  popup.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${isGuestBill ? "Bill" : "Receipt"} - ${receiptNum}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            html, body {
              width: 72mm !important;
              max-width: 72mm !important;
              margin: 0 auto !important;
              padding: 4mm 2mm 12mm 2mm !important;
            }
            .no-print {
              display: none !important;
            }
          }
          body {
            width: 72mm;
            max-width: 72mm;
            margin: 0 auto;
            padding: 6mm 3mm 14mm 3mm;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 11.5px;
            color: #000;
            background: #fff;
            line-height: 1.35;
            word-break: break-word;
            overflow-wrap: break-word;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .line {
            border-top: 1px solid #000;
            margin: 8px 0;
          }
          .line-thick {
            border-top: 1.5px solid #000;
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 10px;">
          <!-- Sleek Tilted Coffee Bean Icon -->
          <svg width="26" height="30" viewBox="0 0 100 100" fill="#000" style="display: block; margin: 0 auto 6px auto; transform: rotate(-22deg);">
            <path d="M48,8 C28,10 14,28 14,50 C14,64 22,78 34,88 C38,82 40,72 40,62 C40,46 32,36 38,22 C41,15 45,10 48,8 Z" />
            <path d="M54,8 C56,12 58,18 56,26 C52,40 60,50 60,66 C60,76 56,86 52,92 C72,88 86,72 86,50 C86,30 72,12 54,8 Z" />
          </svg>
          <div style="font-size: 19px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #000; margin-top: 2px;">
            ${brandName}
          </div>
          <div style="font-size: 10px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: #000; margin-top: 4px;">
            ${brandSubtitle}
          </div>
          <div style="font-size: 10px; color: #333; margin-top: 4px; letter-spacing: 0.05em;">
            ${brandAddress}
          </div>
        </div>

        <div class="line"></div>

        <div style="font-size: 13px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #000; margin-bottom: 3px;">
          ORDER ${orderNumClean}
        </div>
        <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #000; margin-bottom: 2px;">
          ${tableDisplay}
        </div>
        <div style="font-size: 11px; color: #000; margin-bottom: 2px;">
          ${dateFormatted}
        </div>
        <div style="font-size: 11px; color: #000;">
          Cashier: ${orderData.cashier_name || "Admin"}
        </div>

        <div class="line"></div>

        <div style="display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #000; padding: 2px 0;">
          <span style="width: 14%;">QTY</span>
          <span style="flex: 1; padding: 0 4px;">ITEM</span>
          <span style="width: 32%; text-align: right;">${currency}</span>
        </div>

        <div class="line"></div>

        ${itemsHtml}

        <div class="line"></div>

        <div style="font-size: 11.5px; color: #000; line-height: 1.6; margin: 3px 0;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal</span>
            <span style="font-variant-numeric: tabular-nums;">${orderData.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ${(orderData.service_charge || 0) > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Service Charge (${Math.round((orderData.service_charge_rate || 0.1) * 100)}%)</span>
            <span style="font-variant-numeric: tabular-nums;">${orderData.service_charge.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ` : ""}
          ${(orderData.discount || 0) > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Discount</span>
            <span style="font-variant-numeric: tabular-nums;">-${(orderData.discount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ` : ""}
        </div>

        <div class="line-thick"></div>

        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0;">
          <span style="font-size: 14px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #000;">
            TOTAL / ${currency}
          </span>
          <span style="font-size: 24px; font-weight: 900; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: #000;">
            ${orderData.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div class="line-thick"></div>

        <div style="font-size: 11.5px; color: #000; line-height: 1.6; margin: 3px 0;">
          ${paymentSectionHtml}
        </div>

        <div class="line"></div>

        <div style="text-align: center; margin-top: 16px; margin-bottom: 8px;">
          <div style="font-size: 12px; font-weight: 500; color: #000; margin-bottom: 6px;">
            Good coffee. Good day.
          </div>
          <div style="font-size: 10px; font-weight: 600; letter-spacing: 0.35em; text-transform: uppercase; color: #000;">
            T H A N K &nbsp; Y O U
          </div>
        </div>

        <div class="no-print" style="margin-top: 16px; text-align: center;">
          <button onclick="window.print()" style="background: #000; color: white; border: none; padding: 8px 22px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px;">Print Again</button>
        </div>

        <script>
          window.onload = () => {
            window.focus();
            window.print();
            window.onafterprint = () => window.close();
          };
        </script>
      </body>
    </html>
  `)
  popup.document.close()
}

/**
 * Print modern 80mm Kitchen (KOT) or Bar (BOT) Order Ticket matching minimalist ABC Coffee design
 */
export function printTicketSlipDoc(
  order: ThermalTicketOrder,
  station: "kitchen" | "bar"
) {
  if (!order || !order.items || !order.items.length) {
    alert(`No ${station} items found in this ticket.`)
    return
  }

  const popup = window.open("", `${station}-ticket-print`, "width=480,height=800")
  if (!popup) {
    alert("Please allow pop-ups to print the ticket slip.")
    return
  }

  const brandName = order.brand_name || "ABC COFFEE"
  const stationTitle = station === "bar" ? "BAR ORDER TICKET" : "KITCHEN ORDER TICKET"
  const brandAddress = order.brand_address || "123, Main Street"

  const d = new Date(order.created_at || Date.now())
  const day = d.getDate().toString().padStart(2, "0")
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const month = monthNames[d.getMonth()]
  const year = d.getFullYear()
  const hours = d.getHours().toString().padStart(2, "0")
  const minutes = d.getMinutes().toString().padStart(2, "0")
  const seconds = d.getSeconds().toString().padStart(2, "0")
  const dateTimeFormatted = `${day} ${month} ${year} · ${hours}:${minutes}:${seconds}`

  const orderNumClean = (order.order_number || "").replace(/^LS-/, "")
  const isTakeaway = (order.table_name || "").toLowerCase() === "takeaway"
  const tableNumOnly = order.table_name ? order.table_name.replace(/^(Table|Tab)\s*/i, "").trim() : "01"
  const tableDisplay = isTakeaway
    ? "TAKEAWAY"
    : `DINE IN / TABLE ${tableNumOnly.length < 2 ? `0${tableNumOnly}` : tableNumOnly}`

  const itemsHtml = order.items
    .map(
      (it) => `
    <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; padding: 4px 0; color: #000;">
      <span style="width: 14%; font-weight: 800; font-size: 16px;">${it.quantity}</span>
      <div style="flex: 1; padding: 0 4px;">
        <div style="font-weight: 700; line-height: 1.25; font-size: 13px;">${it.name}</div>
        ${it.modifiers && it.modifiers.length > 0 ? `<div style="font-size: 10.5px; color: #333; margin-top: 1px;">${it.modifiers.map((m) => `+ ${m}`).join(", ")}</div>` : ""}
        ${it.notes ? `<div style="border: 1px solid #000; padding: 2px 5px; margin-top: 3px; font-size: 10px; font-weight: 700; text-transform: uppercase;">* NOTE: ${it.notes} *</div>` : ""}
      </div>
    </div>
  `
    )
    .join("")

  const totalItems = order.items.reduce((s, i) => s + (i.quantity || 1), 0)

  const iconSvg = station === "bar"
    ? `
      <!-- Sleek Tilted Coffee Bean Icon -->
      <svg width="26" height="30" viewBox="0 0 100 100" fill="#000" style="display: block; margin: 0 auto 6px auto; transform: rotate(-22deg);">
        <path d="M48,8 C28,10 14,28 14,50 C14,64 22,78 34,88 C38,82 40,72 40,62 C40,46 32,36 38,22 C41,15 45,10 48,8 Z" />
        <path d="M54,8 C56,12 58,18 56,26 C52,40 60,50 60,66 C60,76 56,86 52,92 C72,88 86,72 86,50 C86,30 72,12 54,8 Z" />
      </svg>
    `
    : `
      <!-- Sleek Restaurant Cutlery Icon -->
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#000" style="display: block; margin: 0 auto 6px auto;">
        <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
      </svg>
    `

  popup.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${station.toUpperCase()} Ticket - ${order.order_number}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            html, body {
              width: 72mm !important;
              max-width: 72mm !important;
              margin: 0 auto !important;
              padding: 4mm 2mm 12mm 2mm !important;
            }
            .no-print {
              display: none !important;
            }
          }
          body {
            width: 72mm;
            max-width: 72mm;
            margin: 0 auto;
            padding: 6mm 3mm 14mm 3mm;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 11.5px;
            color: #000;
            background: #fff;
            line-height: 1.35;
            word-break: break-word;
            overflow-wrap: break-word;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .line {
            border-top: 1px solid #000;
            margin: 8px 0;
          }
          .line-thick {
            border-top: 1.5px solid #000;
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 10px;">
          ${iconSvg}
          <div style="font-size: 19px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #000; margin-top: 2px;">
            ${brandName}
          </div>
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #000; margin-top: 3px;">
            ${stationTitle}
          </div>
          <div style="font-size: 10px; color: #333; margin-top: 2px;">
            ${brandAddress}
          </div>
        </div>

        <div class="line"></div>

        <div style="font-size: 13px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #000; margin-bottom: 3px;">
          ORDER ${orderNumClean}
        </div>
        <div style="font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #000; margin-bottom: 2px;">
          ${tableDisplay}
        </div>
        <div style="font-size: 11px; color: #000; margin-bottom: 2px;">
          ${dateTimeFormatted}
        </div>
        <div style="font-size: 11px; color: #000;">
          Server: ${order.cashier_name || "Admin"} · Station: <strong>${station.toUpperCase()}</strong>
        </div>

        <div class="line"></div>

        <div style="display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #000; padding: 2px 0;">
          <span style="width: 14%;">QTY</span>
          <span style="flex: 1; padding: 0 4px;">ITEM</span>
          <span style="width: 32%; text-align: right;">NOTES</span>
        </div>

        <div class="line"></div>

        ${itemsHtml}

        <div class="line"></div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 0;">
          <span>TOTAL ITEMS</span>
          <span style="font-size: 14px; font-weight: 900;">${totalItems}</span>
        </div>

        <div class="line"></div>

        <div style="text-align: center; margin-top: 14px; margin-bottom: 6px;">
          <div style="font-size: 12px; font-weight: 500; color: #000; margin-bottom: 6px;">
            ${station === "bar" ? "Good coffee. Good day." : "Good food. Good day."}
          </div>
          <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.35em; text-transform: uppercase; color: #000;">
            O R D E R &nbsp; D I S P A T C H
          </div>
        </div>

        <div class="no-print" style="margin-top: 16px; text-align: center;">
          <button onclick="window.print()" style="background: #000; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px;">Print Again</button>
        </div>

        <script>
          window.onload = function() {
            window.focus();
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>
  `)
  popup.document.close()
}
