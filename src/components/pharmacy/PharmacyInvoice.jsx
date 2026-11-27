import PrintBar from "@/components/print-button";

const fmt = (d) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Karachi",
    })
      .formatToParts(new Date(d))
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.day} ${p.month} ${p.year}`, time: `${p.hour}:${p.minute} ${String(p.dayPeriod || "").toUpperCase()}` };
};
const fmtDate = (d) =>
  d ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date(d)) : "—";
const num = (n) => Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PharmacyInvoice({ sale }) {
  const total = Number(sale.total);
  const paid = Number(sale.paidAmount);
  const refunded = Number(sale.refundedAmount || 0);
  const balance = Math.max(0, total - paid);
  const b = sale.branch;
  const org = b.organization;
  const when = fmt(sale.createdAt);
  const methods = [...new Set((sale.payments || []).filter((p) => Number(p.amount) > 0).map((x) => x.method.replace("_", " ")))].join(", ");
  const statusCls =
    sale.status === "CANCELLED"
      ? "border-rose-600 text-rose-700"
      : sale.paymentStatus === "PAID"
        ? "border-emerald-600 text-emerald-700"
        : sale.paymentStatus === "PARTIAL"
          ? "border-amber-600 text-amber-700"
          : "border-red-600 text-red-600";
  const statusLabel = sale.status === "CANCELLED" ? "CANCELLED" : sale.paymentStatus;
  const phone = b.phone || org.phone;

  return (
    <div>
      <style>{"@media print { @page { size: A4; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>
      <PrintBar backHref="/pharmacy/sales" backLabel="Back to pharmacy sales" />
      <article className="mx-auto flex min-h-[960px] w-[794px] max-w-full flex-col bg-white p-8 text-[13px] leading-snug text-slate-800 shadow-sm ring-1 ring-slate-200 print:min-h-0 print:w-full print:p-0 print:shadow-none print:ring-0">
        <header className="flex items-start justify-between gap-4 border-b-4 border-emerald-700 pb-3">
          <div>
            <h1 className="text-[24px] font-extrabold uppercase leading-tight tracking-wide text-emerald-800">{org.name} — Pharmacy</h1>
            <p className="text-[12px] font-semibold text-slate-600">{b.name}{b.city ? `, ${b.city}` : ""}</p>
            {b.address && <p className="text-[12px] text-slate-500">{b.address}</p>}
            <p className="text-[12px] text-slate-500">{[phone && `Tel: ${phone}`, b.email && `Email: ${b.email}`].filter(Boolean).join("  |  ")}</p>
          </div>
          <div className="text-right">
            <p className="text-[26px] font-extrabold uppercase leading-none tracking-widest text-slate-800">Pharmacy Bill</p>
            <p className="mt-1 font-mono text-[13px] font-bold text-emerald-700">#{sale.saleNo}</p>
            <span className={`mt-1.5 inline-block rounded border-2 px-2.5 py-0.5 text-[11px] font-extrabold tracking-widest ${statusCls}`}>{statusLabel}</span>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-md border border-slate-300 p-3 text-[12px]">
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Customer details</p>
            <p><span className="inline-block w-20 text-slate-500">Customer:</span> <b>{sale.patient?.name || sale.customerName || "Walk-in Customer"}</b></p>
            {sale.patient?.mrn && <p><span className="inline-block w-20 text-slate-500">MRN:</span> <span className="font-mono">{sale.patient.mrn}</span></p>}
            {(sale.customerPhone || sale.patient?.phone) && <p><span className="inline-block w-20 text-slate-500">Phone:</span> {sale.customerPhone || sale.patient.phone}</p>}
            <p><span className="inline-block w-20 text-slate-500">Type:</span> {sale.isWalkIn ? "Walk-in" : "Registered"}</p>
          </div>
          <div className="rounded-md border border-slate-300 p-3 text-[12px]">
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Invoice details</p>
            <p><span className="inline-block w-20 text-slate-500">Date:</span> <b>{when.date}</b> · {when.time}</p>
            <p><span className="inline-block w-20 text-slate-500">Payment:</span> {methods || "—"}</p>
            <p><span className="inline-block w-20 text-slate-500">Cashier:</span> {sale.soldByName}</p>
          </div>
        </section>

        <table className="mt-5 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-emerald-700 text-left text-white">
              <th className="w-10 px-2.5 py-2 font-bold">#</th>
              <th className="px-2.5 py-2 font-bold">Medicine</th>
              <th className="w-24 px-2.5 py-2 font-bold">Batch</th>
              <th className="w-24 px-2.5 py-2 font-bold">Expiry</th>
              <th className="w-14 px-2.5 py-2 text-right font-bold">Qty</th>
              <th className="w-20 px-2.5 py-2 text-right font-bold">Rate</th>
              <th className="w-20 px-2.5 py-2 text-right font-bold">Disc</th>
              <th className="w-24 px-2.5 py-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((i, idx) => (
              <tr key={i.id} className={`border-b border-slate-200 ${idx % 2 ? "bg-slate-50" : ""}`}>
                <td className="px-2.5 py-1.5">{idx + 1}</td>
                <td className="px-2.5 py-1.5">
                  <span className="font-semibold text-slate-900">{i.medicineName}</span>
                  {i.strength && <span className="ml-1 text-xs text-slate-500">{i.strength}</span>}
                  {i.genericName && <span className="block text-[11px] text-slate-400">{i.genericName}</span>}
                </td>
                <td className="px-2.5 py-1.5 font-mono text-[11px]">{i.batchNumber}</td>
                <td className="px-2.5 py-1.5 text-[11px]">{fmtDate(i.expiryDate)}</td>
                <td className="px-2.5 py-1.5 text-right">{Number(i.quantity)}</td>
                <td className="px-2.5 py-1.5 text-right">{num(i.unitPrice)}</td>
                <td className="px-2.5 py-1.5 text-right">{Number(i.discount) > 0 ? num(i.discount) : "—"}</td>
                <td className="px-2.5 py-1.5 text-right font-semibold">{num(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex items-start justify-between gap-6">
          <div className="max-w-[55%] flex-1 text-[12px]">
            {sale.notes && (
              <div className="rounded-md border border-dashed border-slate-300 p-2.5">
                <p className="font-bold uppercase text-slate-500">Notes</p>
                <p>{sale.notes}</p>
              </div>
            )}
          </div>
          <div className="w-[270px] overflow-hidden rounded-md border border-slate-300 text-[12.5px]">
            <div className="flex justify-between px-3 py-1"><span>Subtotal</span><span>{num(sale.subtotal)}</span></div>
            {Number(sale.itemDiscountTotal) > 0 && <div className="flex justify-between px-3 py-1"><span>Item discounts</span><span>- {num(sale.itemDiscountTotal)}</span></div>}
            {Number(sale.discount) > 0 && <div className="flex justify-between px-3 py-1"><span>Bill discount</span><span>- {num(sale.discount)}</span></div>}
            <div className="flex justify-between bg-emerald-700 px-3 py-1.5 font-bold text-white"><span>Grand Total</span><span>Rs {num(total)}</span></div>
            <div className="flex justify-between px-3 py-1"><span>Paid</span><span>{num(paid)}</span></div>
            {refunded > 0 && <div className="flex justify-between px-3 py-1 text-rose-600"><span>Refunded</span><span>{num(refunded)}</span></div>}
            <div className="flex justify-between border-t border-slate-200 px-3 py-1 font-bold">
              <span>Balance Due</span>
              <span className={balance > 0 ? "text-rose-600" : ""}>Rs {num(balance)}</span>
            </div>
          </div>
        </section>

        <div className="flex-1" />
        <footer className="mt-8 border-t-2 border-emerald-700 pt-2 text-center text-[11px] text-slate-500">
          <p className="font-semibold">Medicines once sold can be returned/exchanged with original receipt per pharmacy policy.</p>
          <p className="mt-0.5 text-[10px]">Computer generated pharmacy invoice · Powered by LabOS</p>
        </footer>
      </article>
    </div>
  );
}

export function PharmacyPurchaseInvoice({ purchase }) {
  const b = purchase.branch;
  const org = b.organization;
  const netTotal = Math.max(0, Number(purchase.total) - Number(purchase.returnedAmount || 0));
  const due = Math.max(0, netTotal - Number(purchase.paidAmount));
  return (
    <div>
      <style>{"@media print { @page { size: A4; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>
      <PrintBar backHref="/pharmacy/purchases" backLabel="Back to purchases" />
      <article className="mx-auto flex min-h-[960px] w-[794px] max-w-full flex-col bg-white p-8 text-[13px] leading-snug text-slate-800 shadow-sm ring-1 ring-slate-200 print:min-h-0 print:w-full print:p-0 print:shadow-none print:ring-0">
        <header className="flex items-start justify-between gap-4 border-b-4 border-slate-800 pb-3">
          <div>
            <h1 className="text-[24px] font-extrabold uppercase tracking-wide text-slate-900">{org.name} — Pharmacy</h1>
            <p className="text-[12px] font-semibold text-slate-600">{b.name}{b.city ? `, ${b.city}` : ""}</p>
            {b.address && <p className="text-[12px] text-slate-500">{b.address}</p>}
          </div>
          <div className="text-right">
            <p className="text-[24px] font-extrabold uppercase tracking-widest text-slate-800">Purchase Invoice</p>
            <p className="mt-1 font-mono text-[13px] font-bold text-blue-700">#{purchase.purchaseNo}</p>
            <p className="text-xs font-semibold text-slate-500">Status: {purchase.status} · {purchase.paymentStatus}</p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-4 text-[12px]">
          <div className="rounded-md border border-slate-300 p-3">
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Supplier</p>
            <p className="font-bold text-slate-900">{purchase.supplier.name}</p>
            {purchase.supplier.contactPerson && <p>Contact: {purchase.supplier.contactPerson}</p>}
            {purchase.supplier.phone && <p>Phone: {purchase.supplier.phone}</p>}
            {purchase.supplier.address && <p>{purchase.supplier.address}</p>}
          </div>
          <div className="rounded-md border border-slate-300 p-3">
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Purchase Info</p>
            <p>Purchase Date: <b>{fmtDate(purchase.purchaseDate)}</b></p>
            {purchase.invoiceNo && <p>Supplier Invoice: <b>{purchase.invoiceNo}</b></p>}
            <p>Created By: {purchase.createdByName}</p>
            {purchase.finalizedAt && <p>Finalized: {fmtDate(purchase.finalizedAt)}</p>}
          </div>
        </section>

        <table className="mt-5 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-slate-800 text-left text-white">
              <th className="w-10 px-2.5 py-2">#</th>
              <th className="px-2.5 py-2">Medicine</th>
              <th className="w-24 px-2.5 py-2">Batch</th>
              <th className="w-24 px-2.5 py-2">Expiry</th>
              <th className="w-16 px-2.5 py-2 text-right">Qty</th>
              <th className="w-24 px-2.5 py-2 text-right">Cost</th>
              <th className="w-24 px-2.5 py-2 text-right">Sale Price</th>
              <th className="w-24 px-2.5 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((i, idx) => (
              <tr key={i.id} className={`border-b border-slate-200 ${idx % 2 ? "bg-slate-50" : ""}`}>
                <td className="px-2.5 py-1.5">{idx + 1}</td>
                <td className="px-2.5 py-1.5 font-semibold">{i.medicine.name} {i.medicine.strength || ""}</td>
                <td className="px-2.5 py-1.5 font-mono text-[11px]">{i.batchNumber}</td>
                <td className="px-2.5 py-1.5 text-[11px]">{fmtDate(i.expiryDate)}</td>
                <td className="px-2.5 py-1.5 text-right">{Number(i.quantity)}</td>
                <td className="px-2.5 py-1.5 text-right">{num(i.purchasePrice)}</td>
                <td className="px-2.5 py-1.5 text-right">{num(i.salePrice)}</td>
                <td className="px-2.5 py-1.5 text-right font-semibold">{num(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex justify-end">
          <div className="w-[270px] overflow-hidden rounded-md border border-slate-300 text-[12.5px]">
            <div className="flex justify-between px-3 py-1"><span>Subtotal</span><span>{num(purchase.subtotal)}</span></div>
            {Number(purchase.discount) > 0 && <div className="flex justify-between px-3 py-1"><span>Discount</span><span>- {num(purchase.discount)}</span></div>}
            {Number(purchase.additionalCharges) > 0 && <div className="flex justify-between px-3 py-1"><span>Additional Charges</span><span>+ {num(purchase.additionalCharges)}</span></div>}
            <div className="flex justify-between bg-slate-800 px-3 py-1.5 font-bold text-white"><span>Total</span><span>Rs {num(purchase.total)}</span></div>
            {Number(purchase.returnedAmount) > 0 && <div className="flex justify-between px-3 py-1 text-amber-700"><span>Returned</span><span>- {num(purchase.returnedAmount)}</span></div>}
            <div className="flex justify-between px-3 py-1"><span>Paid</span><span>{num(purchase.paidAmount)}</span></div>
            <div className="flex justify-between border-t border-slate-200 px-3 py-1 font-bold"><span>Payable Balance</span><span className={due > 0 ? "text-rose-600" : ""}>Rs {num(due)}</span></div>
          </div>
        </section>

        <div className="flex-1" />
        <footer className="mt-8 border-t border-slate-300 pt-2 text-center text-[11px] text-slate-500">
          Computer generated pharmacy purchase voucher · Powered by LabOS
        </footer>
      </article>
    </div>
  );
}
