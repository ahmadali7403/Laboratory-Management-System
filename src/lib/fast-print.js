/**
 * Instant thermal-friendly & A5/A4 receipt printing built purely client-side
 * via hidden iframe (zero extra HTTP/DB latency on F9 Save & Print).
 */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n) => `Rs. ${Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const nowStr = () =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Karachi",
  }).format(new Date());

function printHtml(html) {
  if (typeof document === "undefined") return;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      /* ignore print block */
    }
    setTimeout(() => frame.remove(), 60_000);
  }, 20);
}

const BASE_CSS = `
  @page { margin: 4mm; }
  * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
  body { margin: 0; color: #0f172a; font-size: 11px; line-height: 1.35; }
  .wrap { max-width: 80mm; margin: 0 auto; padding: 2mm; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .mono { font-family: ui-monospace, SFMono-Regular, monospace; }
  .hr { border-top: 1px dashed #64748b; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 2px 0; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #334155; text-align: left; }
  .r { text-align: right; }
  .tot-row { display: flex; justify-content: space-between; margin: 2px 0; }
  .grand { font-size: 13px; font-weight: 800; border-top: 1px solid #0f172a; padding-top: 3px; margin-top: 3px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
`;

export function printPharmacyReceipt({
  orgName = "Pharmacy",
  branchName = "",
  saleNo,
  customerName = "Walk-in Customer",
  customerPhone = "",
  items = [],
  subtotal = 0,
  itemDiscountTotal = 0,
  discount = 0,
  total = 0,
  paidAmount = 0,
  changeAmount = 0,
  paymentMethod = "CASH",
}) {
  const rowsHtml = items
    .map((x, idx) => {
      const rate = Number(x.batch?.salePrice || 0);
      const qty = Number(x.qty || 0);
      const lineTotal = Math.max(0, qty * rate - Number(x.discount || 0));
      return `
        <tr>
          <td>${idx + 1}. <b>${esc(x.medicine?.name)}</b>${x.medicine?.strength ? ` ${esc(x.medicine.strength)}` : ""}<br/><span class="mono" style="font-size:9px;color:#475569">${esc(x.batch?.batchNumber || "")}</span></td>
          <td class="r">${qty}</td>
          <td class="r">${rate.toFixed(0)}</td>
          <td class="r bold">${lineTotal.toFixed(2)}</td>
        </tr>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(saleNo)}</title><style>${BASE_CSS}</style></head>
  <body><div class="wrap">
    <div class="center">
      <div class="bold" style="font-size:14px">${esc(orgName)}</div>
      ${branchName ? `<div style="font-size:10px">${esc(branchName)}</div>` : ""}
      <div class="mono bold" style="margin-top:3px">BILL #${esc(saleNo)}</div>
      <div style="font-size:10px;color:#475569">${esc(nowStr())}</div>
    </div>
    <div class="hr"></div>
    <div>Customer: <b>${esc(customerName)}</b>${customerPhone ? ` · ${esc(customerPhone)}` : ""}</div>
    <div class="hr"></div>
    <table>
      <thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amt</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="hr"></div>
    <div class="tot-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    ${itemDiscountTotal > 0 ? `<div class="tot-row"><span>Item Disc</span><span>-${money(itemDiscountTotal)}</span></div>` : ""}
    ${discount > 0 ? `<div class="tot-row"><span>Bill Disc</span><span>-${money(discount)}</span></div>` : ""}
    <div class="tot-row grand"><span>TOTAL</span><span>${money(total)}</span></div>
    <div class="tot-row"><span>Paid (${esc(paymentMethod)})</span><span>${money(paidAmount)}</span></div>
    ${changeAmount > 0 ? `<div class="tot-row bold"><span>Change</span><span>${money(changeAmount)}</span></div>` : ""}
    ${total - paidAmount > 0.01 ? `<div class="tot-row bold"><span>Balance Due</span><span>${money(total - paidAmount)}</span></div>` : ""}
    <div class="hr"></div>
    <div class="center" style="font-size:10px;color:#475569">Thank you for visiting!</div>
  </div></body></html>`;

  printHtml(html);
}

export function printLabReceipt({
  orgName = "Diagnostic Laboratory",
  branchName = "",
  orderNo,
  patientName = "Walk-in Customer",
  phone = "",
  items = [],
  subtotal = 0,
  discount = 0,
  total = 0,
  paidAmount = 0,
  balance = 0,
  paymentMethod = "CASH",
}) {
  const rowsHtml = items
    .map(
      (t, idx) => `
      <tr>
        <td>${idx + 1}. <b>${esc(t.name)}</b> <span class="mono" style="font-size:9px;color:#475569">${esc(t.code)}</span></td>
        <td class="r bold">${Number(t.price || 0).toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(orderNo)}</title><style>${BASE_CSS}</style></head>
  <body><div class="wrap">
    <div class="center">
      <div class="bold" style="font-size:14px">${esc(orgName)}</div>
      ${branchName ? `<div style="font-size:10px">${esc(branchName)}</div>` : ""}
      <div class="mono bold" style="margin-top:3px">ORDER #${esc(orderNo)}</div>
      <div style="font-size:10px;color:#475569">${esc(nowStr())}</div>
    </div>
    <div class="hr"></div>
    <div>Patient: <b>${esc(patientName)}</b>${phone ? ` · ${esc(phone)}` : ""}</div>
    <div class="hr"></div>
    <table>
      <thead><tr><th>Test / Panel</th><th class="r">Amount</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="hr"></div>
    <div class="tot-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    ${discount > 0 ? `<div class="tot-row"><span>Discount</span><span>-${money(discount)}</span></div>` : ""}
    <div class="tot-row grand"><span>TOTAL</span><span>${money(total)}</span></div>
    <div class="tot-row"><span>Paid (${esc(paymentMethod)})</span><span>${money(paidAmount)}</span></div>
    ${balance > 0 ? `<div class="tot-row bold"><span>Balance Due</span><span>${money(balance)}</span></div>` : ""}
    <div class="hr"></div>
    <div class="center" style="font-size:10px;color:#475569">Reports available as scheduled.</div>
  </div></body></html>`;

  printHtml(html);
}
