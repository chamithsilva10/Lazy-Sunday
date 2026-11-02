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
}

export interface ThermalTicketOrder {
  order_number: string
  table_name?: string
  cashier_name?: string
  created_at?: string
  items: ThermalTicketItem[]
}

/**
 * Print 80mm Guest Bill or Tax Invoice Thermal Receipt (matches Image 2 format)
 */
export function printThermalReceiptDoc(orderData: ThermalReceiptOrder, isGuestBill = false) {
  if (!orderData) return

  const popup = window.open("", "thermal-receipt-print", "width=480,height=800")
  if (!popup) {
    alert("Please allow pop-ups to open the thermal receipt printer window.")
    return
  }

  const receiptNum = orderData.receipt_number || orderData.order_number
  const dateFormatted = new Date(orderData.created_at || Date.now()).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const timeFormatted = new Date(orderData.created_at || Date.now()).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })

  const itemsHtml = orderData.items
    .map(
      (it) => `
    <tr>
      <td style="padding: 4px 0; vertical-align: top; width: 12%; font-weight: bold;">${it.quantity}x</td>
      <td style="padding: 4px 0; vertical-align: top; width: 52%;">
        <div style="font-weight: 700; line-height: 1.2;">${it.name}</div>
        <div style="font-size: 10px; color: #555;">@ Rs. ${it.price.toLocaleString("en-US", { minimumFractionDigits: 2 })} ea</div>
        ${it.notes ? `<div style="font-size: 9.5px; color: #b45309; font-weight: 600;">Note: ${it.notes}</div>` : ""}
      </td>
      <td style="padding: 4px 0; text-align: right; vertical-align: top; width: 36%; font-weight: bold; font-family: monospace;">
        Rs. ${(it.price * it.quantity).toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </td>
    </tr>
  `
    )
    .join("")

  const isCash = (orderData.payment_method || "cash").toLowerCase() === "cash"
  const isSplit = (orderData.payment_method || "").toLowerCase() === "split" && Array.isArray((orderData as any).split_payments) && (orderData as any).split_payments.length > 0
  const splitHtml = isSplit && !isGuestBill
    ? `
    <div style="border-top: 1px dashed #444; margin: 4px 0; padding-top: 4px;">
      <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 2px;">Split Settlement:</div>
      ${((orderData as any).split_payments || []).map((sp: any) => `
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0;">
          <span>• ${String(sp.method || "").toUpperCase()}${sp.reference ? ` (${sp.reference})` : ""}:</span>
          <span style="font-family: monospace; font-weight: bold;">Rs. ${Number(sp.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
        </div>
        ${String(sp.method || "").toLowerCase() === "cash" && sp.tendered && sp.tendered > sp.amount ? `
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #555; padding-left: 8px;">
            <span>Tendered: Rs. ${Number(sp.tendered).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            <span>Change: Rs. ${Number(sp.change_due ?? (sp.tendered - sp.amount)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
        ` : ""}
      `).join("")}
      ${(orderData.change_amount || 0) > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-top: 4px; border-top: 1px dashed #aaa; padding-top: 2px;">
          <span>Total Change Returned:</span>
          <span style="font-family: monospace;">Rs. ${Number(orderData.change_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
        </div>
      ` : ""}
    </div>
  `
    : ""

  const cashHtml =
    isSplit
      ? splitHtml
      : isCash && !isGuestBill
      ? `
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 4px 0;">
      <tr>
        <td style="padding: 1.5px 0;">Cash Tendered:</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; padding: 1.5px 0;">
          Rs. ${(orderData.cash_received || orderData.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </td>
      </tr>
      <tr>
        <td style="padding: 1.5px 0; font-weight: bold;">Change Returned:</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; padding: 1.5px 0;">
          Rs. ${(orderData.change_amount ?? Math.max(0, (orderData.cash_received || orderData.total) - orderData.total)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </td>
      </tr>
    </table>
  `
      : ""

  const titleHeader = isGuestBill ? "GUEST BILL / TABLE CHECK" : "TAX INVOICE / RECEIPT"
  const subtitleNotice = isGuestBill
    ? "PLEASE PAY AT CASHIER COUNTER OR TO FLOOR SERVER"
    : "PAYMENT COMPLETED &amp; SETTLED"

  const paymentDisplay =
    isSplit
      ? "SPLIT / MIXED TENDER"
      : orderData.payment_method === "qr" || orderData.payment_method === "transfer"
      ? "LANKA QR / DIGITAL"
      : (orderData.payment_method || "cash").toUpperCase()

  const orderTypeDisplay = (orderData.order_type || (orderData.table_name === "Takeaway" ? "takeaway" : "dine_in")).toUpperCase().replace("-", "_")

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
            body {
              width: 74mm;
              margin: 0 auto;
              padding: 4mm 1mm 10mm 1mm;
            }
            .no-print {
              display: none !important;
            }
          }
          body {
            width: 74mm;
            margin: 0 auto;
            padding: 12px 6px 24px 6px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Courier New", monospace;
            font-size: 11.5px;
            color: #000;
            background: #fff;
            line-height: 1.3;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .font-mono { font-family: 'SF Mono', 'Courier Prime', 'Courier New', monospace; }
          .brand-title {
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 2px;
            margin: 0 0 2px 0;
            text-transform: uppercase;
          }
          .brand-sub {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.5px;
            margin: 0;
            color: #111;
          }
          .brand-tag {
            font-size: 10px;
            color: #555;
            margin: 2px 0;
            font-style: italic;
          }
          .brand-contact {
            font-size: 9.5px;
            color: #444;
            margin: 2px 0 6px 0;
          }
          .badge-banner {
            display: inline-block;
            background: #000;
            color: #fff;
            padding: 2.5px 10px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 1px;
            margin: 4px 0 6px 0;
            border-radius: 4px;
          }
          .divider {
            border-top: 1px dashed #333;
            margin: 6px 0;
          }
          .divider-double {
            border-top: 2px solid #000;
            border-bottom: 1px solid #000;
            height: 3px;
            margin: 8px 0;
          }
          .meta-table {
            width: 100%;
            font-size: 11px;
            border-collapse: collapse;
            margin: 4px 0;
          }
          .meta-table td {
            padding: 1.5px 0;
            vertical-align: top;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin: 4px 0;
          }
          .items-table th {
            text-align: left;
            border-bottom: 1px dashed #333;
            padding: 3px 0;
            font-size: 10px;
            font-weight: 800;
            color: #333;
          }
          .totals-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin: 4px 0;
          }
          .totals-table td {
            padding: 2px 0;
          }
          .grand-total-box {
            background: transparent;
            border: 2px solid #000;
            padding: 6px 8px;
            margin: 6px 0;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-weight: 900;
          }
          .footer-box {
            text-align: center;
            font-size: 9.5px;
            color: #444;
            margin-top: 8px;
            line-height: 1.4;
          }
          .barcode-container {
            margin-top: 10px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <h1 class="brand-title">LAZY SUNDAY</h1>
          <p class="brand-sub">POINT OF SALE TERMINAL</p>
          <p class="brand-tag">Specialty Dining &amp; Fresh Beverages</p>
          <p class="brand-contact">Customer Receipt</p>
          <div class="badge-banner">${titleHeader}</div>
        </div>

        <div class="divider"></div>

        <table class="meta-table">
          <tr>
            <td style="width: 50%;">Receipt #: <strong>${receiptNum}</strong></td>
            <td class="text-right" style="width: 50%;">Order #: <strong>${orderData.order_number}</strong></td>
          </tr>
          <tr>
            <td>Table: <strong>${orderData.table_name || "Takeaway"}</strong></td>
            <td class="text-right">Type: <strong>${orderTypeDisplay}</strong></td>
          </tr>
          <tr>
            <td>Cashier: ${orderData.cashier_name || "System Administrator"}</td>
            <td class="text-right">${dateFormatted} ${timeFormatted}</td>
          </tr>
          <tr>
            <td colspan="2">Payment: <strong>${paymentDisplay}</strong></td>
          </tr>
        </table>

        <div class="divider"></div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 12%;">QTY</th>
              <th style="width: 52%;">ITEM DESCRIPTION</th>
              <th class="text-right" style="width: 36%;">TOTAL (RS.)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <table class="totals-table">
          <tr>
            <td>Subtotal</td>
            <td class="text-right font-mono">Rs. ${orderData.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td>Hospitality Service Charge (${Math.round((orderData.service_charge_rate || 0.1) * 100)}%)</td>
            <td class="text-right font-mono">Rs. ${orderData.service_charge.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          </tr>
          ${(orderData.discount || 0) > 0 ? `
          <tr style="color: #000; font-weight: 600;">
            <td>Discount Applied</td>
            <td class="text-right font-mono">-Rs. ${(orderData.discount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          </tr>
          ` : ""}
        </table>

        <div class="grand-total-box">
          <span style="font-size: 13px; font-weight: 900; letter-spacing: 1px;">TOTAL DUE</span>
          <span style="font-size: 16px; font-weight: 900; font-family: monospace;">
            Rs. ${orderData.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>

        ${cashHtml}

        <div class="divider-double"></div>

        <div class="footer-box">
          <p style="font-weight: 900; font-size: 11px; margin: 2px 0; color: #000;">*** THANK YOU FOR DINING WITH US ***</p>
          <p style="margin: 2px 0; font-weight: 600; text-transform: uppercase;">${subtitleNotice}</p>
          <p style="margin: 2px 0;">Free WiFi: <strong>GuestWiFi</strong> · Pass: <strong>welcome2026</strong></p>
          <p style="margin: 2px 0;">Customer Support: support@posdemo.com</p>
        </div>

        <div class="barcode-container">
          <svg style="width: 190px; height: 36px; margin: 0 auto; display: block;" viewBox="0 0 190 36">
            <rect width="190" height="36" fill="#fff"/>
            ${Array.from({ length: 42 }).map((_, i) => {
              const x = 8 + i * 4.2;
              const w = ((i * 7 + 3) % 3) + 1.2;
              return `<rect x="${x}" y="2" width="${w}" height="32" fill="#000"/>`;
            }).join("")}
          </svg>
          <div style="font-family: monospace; font-size: 10px; letter-spacing: 2.5px; margin-top: 3px; font-weight: bold;">
            *${receiptNum}*
          </div>
        </div>

        <div class="no-print" style="margin-top: 16px; text-align: center;">
          <button onclick="window.print()" style="background: #D67B6B; color: white; border: none; padding: 10px 22px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px;">Print Again</button>
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
 * Print 80mm Kitchen (KOT) or Bar (BOT) Order Ticket (matches Image 1 format)
 */
export function printTicketSlipDoc(
  order: ThermalTicketOrder,
  station: "kitchen" | "bar"
) {
  if (!order || !order.items || !order.items.length) {
    alert(`No ${station} items found in this ticket.`)
    return
  }

  const popup = window.open("", `${station}-ticket-print`, "width=420,height=600")
  if (!popup) {
    alert("Please allow pop-ups to print the ticket slip.")
    return
  }

  const timeFormatted = new Date(order.created_at || Date.now()).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const dateFormatted = new Date(order.created_at || Date.now()).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

  const itemsHtml = order.items
    .map(
      (it) => `
    <div style="padding: 6px 0; border-bottom: 1px dashed #333; display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="flex: 1; padding-right: 12px;">
        <div style="font-size: 16px; font-weight: 900; line-height: 1.2; color: #000;">${it.name}</div>
        ${it.category ? `<div style="font-size: 11.5px; color: #555; margin-top: 2px;">${it.category}</div>` : ""}
        ${it.notes ? `<div style="font-size: 11px; color: #b45309; font-weight: bold; margin-top: 2px;">Note: ${it.notes}</div>` : ""}
      </div>
      <div style="font-size: 20px; font-weight: 900; background: #eee; padding: 3px 12px; border-radius: 6px; font-family: monospace; color: #000;">
        x${it.quantity}
      </div>
    </div>
  `
    )
    .join("")

  popup.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${station.toUpperCase()} Ticket - ${order.order_number}</title>
        <style>
          @page { size: 3.1in auto; margin: 0; }
          @media print {
            .no-print { display: none !important; }
          }
          body {
            width: 2.9in;
            margin: 0 auto;
            padding: 12px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
            font-size: 11.5px;
            color: #000;
            line-height: 1.3;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header { text-align: center; }
          .meta { font-size: 11.5px; margin-bottom: 8px; line-height: 1.4; }
          .meta-row { display: flex; justify-content: space-between; margin: 3px 0; }
          .table-badge { font-size: 16px; font-weight: 900; background: #000; color: #fff; padding: 2px 10px; border-radius: 6px; }
          .items-container { margin: 8px 0; }
          .footer { text-align: center; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px; line-height: 1.25; text-transform: uppercase;">
            *** ${station === "bar" ? "BAR ORDER TICKET<br/>(BOT) ***" : "KITCHEN ORDER TICKET<br/>(KOT) ***"}
          </div>
          <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; margin-top: 4px; color: #111;">
            LAZY SUNDAY POS
          </div>
        </div>
        <div style="border-top: 3px solid #000; margin: 8px 0 10px 0;"></div>
        <div class="meta">
          <div class="meta-row" style="align-items: center; margin-bottom: 4px;">
            <span>Order: <strong>${order.order_number}</strong></span>
            <span class="table-badge">${order.table_name || "Takeaway"}</span>
          </div>
          <div class="meta-row">
            <span>Date: ${dateFormatted}</span>
            <span>Time: <strong>${timeFormatted}</strong></span>
          </div>
          <div class="meta-row">
            <span>Cashier: ${order.cashier_name || "System Administrator"}</span>
            <span>Station: <strong>${station.toUpperCase()}</strong></span>
          </div>
        </div>
        <div class="items-container">
          ${itemsHtml}
        </div>
        <div class="footer">
          <div style="border-top: 1px dashed #000; margin-top: 6px;"></div>
          <div style="border-top: 1px dashed #000; margin-top: 3px; margin-bottom: 8px;"></div>
          <div>Total Station Items: ${order.items.reduce((s, i) => s + (i.quantity || 1), 0)}</div>
          <div style="margin-top: 5px; font-weight: 900; font-size: 12px; letter-spacing: 0.5px;">-- SENT TO ${station.toUpperCase()} --</div>
          <div class="no-print" style="margin-top: 16px; text-align: center;">
            <button onclick="window.print()" style="background: #D67B6B; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px;">Print Again</button>
          </div>
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
