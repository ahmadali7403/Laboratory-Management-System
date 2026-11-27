import { notFound } from "next/navigation";
import { requireContext } from "@/lib/scope";
import { loadPrintableOrder } from "@/lib/documents";
import PrintBar from "@/components/print-button";

export const instant = false;

const fmt = (d) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.day} ${p.month} ${p.year}`, time: `${p.hour}:${p.minute} ${String(p.dayPeriod || "").toUpperCase()}` };
};
const num = (n) => Number(n).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const age = (dob) => (dob ? `${Math.max(0, Math.floor((Date.now() - new Date(dob)) / 3.156e10))} Y` : null);

const Info = ({ l, v }) => (v ? <p className="flex gap-2"><span className="w-24 shrink-0 text-slate-500">{l}</span><span className="font-semibold text-slate-900">{v}</span></p> : null);
const Tot = ({ l, v, bold, red, band }) => (
  <div className={`flex justify-between px-3 py-1.5 ${band ? "bg-[#0b5394] text-white" : ""} ${bold ? "font-bold" : ""} ${red ? "font-bold text-red-600" : ""}`}><span>{l}</span><span>{v}</span></div>
);

// A4 hospital / laboratory invoice. Opens in the View modal, as a page, or is printed directly from the order screen.
export default async function InvoicePage({ params }) {
  const { actor } = await requireContext(undefined, { module: ["billing", "orders"] });
  const { id } = await params;
  const o = await loadPrintableOrder(actor, id);
  if (!o || o.status === "CANCELLED") notFound();
  const total = Number(o.total);
  const paid = Number(o.paidAmount);
  const balance = Math.max(0, total - paid);
  const b = o.branch;
  const org = b.organization;
  const p = o.patient;
  const when = fmt(o.createdAt);
  const methods = [...new Set(o.payments.map((x) => x.method.replace("_", " ")))].join(", ");
  const status = o.paymentStatus === "PAID" ? "PAID" : o.paymentStatus === "PARTIAL" ? "PARTIAL" : "UNPAID";
  const statusCls = status === "PAID" ? "border-emerald-600 text-emerald-700" : status === "PARTIAL" ? "border-amber-600 text-amber-700" : "border-red-600 text-red-600";
  const gender = p.gender === "MALE" ? "Male" : p.gender === "FEMALE" ? "Female" : p.gender === "OTHER" ? "Other" : null;
  const phone = b.phone || org.phone;

  return (
    <div>
      <style>{"@media print { @page { size: A4; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>
      <PrintBar backHref="/billing" backLabel="Back to billing" />
      <article className="mx-auto flex min-h-[1040px] w-[794px] max-w-full flex-col bg-white p-8 text-[13px] leading-snug text-slate-800 shadow-sm ring-1 ring-slate-200 print:min-h-0 print:w-full print:p-0 print:shadow-none print:ring-0">
        {/* header */}
        <header className="flex items-start justify-between gap-4 border-b-4 border-[#0b5394] pb-3">
          <div>
            <h1 className="text-[26px] font-extrabold uppercase leading-tight tracking-wide text-[#0b5394]">{org.name}</h1>
            <p className="text-[12px] font-semibold text-slate-600">{b.name}{b.city ? `, ${b.city}` : ""}</p>
            {b.address && <p className="text-[12px] text-slate-500">{b.address}</p>}
            <p className="text-[12px] text-slate-500">{[phone && `Tel: ${phone}`, b.email && `Email: ${b.email}`].filter(Boolean).join("  |  ")}</p>
          </div>
          <div className="text-right">
            <p className="text-[30px] font-extrabold uppercase leading-none tracking-widest text-slate-800">Invoice</p>
            <p className="mt-1 text-[13px] font-bold text-[#0b5394]">#{o.orderNo}</p>
            <span className={`mt-1.5 inline-block rounded border-2 px-2.5 py-0.5 text-[12px] font-extrabold tracking-widest ${statusCls}`}>{status}</span>
          </div>
        </header>

        {/* patient / invoice details */}
        <section className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-md border border-slate-300">
            <p className="rounded-t-md bg-slate-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">Patient details</p>
            <div className="space-y-0.5 p-3">
              <Info l="Name" v={p.name} />
              <Info l="MRN" v={p.mrn} />
              <Info l="Age / Gender" v={[age(p.dateOfBirth), gender].filter(Boolean).join(" / ")} />
              <Info l="Phone" v={p.phone} />
            </div>
          </div>
          <div className="rounded-md border border-slate-300">
            <p className="rounded-t-md bg-slate-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">Invoice details</p>
            <div className="space-y-0.5 p-3">
              <Info l="Invoice no." v={o.orderNo} />
              <Info l="Date" v={when.date} />
              <Info l="Time" v={when.time} />
              <Info l="Payment" v={methods || "—"} />
              <Info l="Served by" v={o.createdByName} />
            </div>
          </div>
        </section>

        {/* tests */}
        <table className="mt-5 w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#0b5394] text-left text-white">
              <th className="w-12 px-3 py-2 font-bold">S.No</th>
              <th className="w-24 px-3 py-2 font-bold">Code</th>
              <th className="px-3 py-2 font-bold">Test / Service</th>
              <th className="w-24 px-3 py-2 font-bold">Sample</th>
              <th className="w-28 px-3 py-2 text-right font-bold">Amount (Rs)</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((i, n) => (
              <tr key={i.id} className={`border-b border-slate-200 ${n % 2 ? "bg-slate-50" : ""}`}>
                <td className="px-3 py-1.5">{n + 1}</td>
                <td className="px-3 py-1.5 font-mono text-[12px] text-slate-500">{i.testCode}</td>
                <td className="px-3 py-1.5 font-semibold text-slate-900">{i.testName}</td>
                <td className="px-3 py-1.5 text-slate-500">{i.test?.sampleType || ""}</td>
                <td className="px-3 py-1.5 text-right font-semibold">{num(i.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <section className="mt-4 flex items-start justify-between gap-6">
          <div className="max-w-[55%] flex-1">
            {o.notes && (
              <div className="rounded-md border border-dashed border-slate-400 p-2.5 text-[12px]">
                <p className="font-extrabold uppercase tracking-wide text-slate-600">Notes</p>
                <p>{o.notes}</p>
              </div>
            )}
          </div>
          <div className="w-[280px] overflow-hidden rounded-md border border-slate-300 text-[13px]">
            <Tot l="Subtotal" v={num(o.subtotal)} />
            {Number(o.discount) > 0 && <Tot l="Discount" v={`- ${num(o.discount)}`} />}
            <Tot l="Grand total" v={`Rs ${num(total)}`} band />
            <Tot l={`Paid${methods ? ` (${methods})` : ""}`} v={num(paid)} />
            <div className="border-t border-slate-300"><Tot l="Balance due" v={`Rs ${num(balance)}`} bold red={balance > 0} /></div>
          </div>
        </section>

        <div className="flex-1" />

        {/* signatures + footer */}
        <section className="mt-12 grid grid-cols-2 gap-16 text-center text-[12px] text-slate-600">
          <div className="border-t border-slate-500 pt-1">Patient / Guardian signature</div>
          <div className="border-t border-slate-500 pt-1">Authorized signature &amp; stamp</div>
        </section>
        <footer className="mt-5 border-t-2 border-[#0b5394] pt-2 text-center text-[11px] text-slate-500">
          <p className="font-semibold">{org.reportFooterNote || "Please bring this invoice to collect your reports. Thank you for choosing us."}</p>
          <p className="mt-0.5 text-[10px]">This is a computer generated invoice. · Powered by LabOS</p>
        </footer>
      </article>
    </div>
  );
}
