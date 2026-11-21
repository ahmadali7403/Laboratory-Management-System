import { notFound } from "next/navigation";
import { requireContext } from "@/lib/scope";
import { loadPrintableOrder } from "@/lib/documents";
import PrintBar from "@/components/print-button";
import { StatusBadge } from "@/components/ui";

export const instant = false;

const fmt = (d) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(d);
const rs = (n) => `Rs ${Number(n).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

export default async function InvoicePage({ params }) {
  const { actor } = await requireContext();
  const { id } = await params;
  const o = await loadPrintableOrder(actor, id);
  if (!o || o.status === "CANCELLED") notFound();
  const balance = Number(o.total) - Number(o.paidAmount);
  const b = o.branch;

  return (
    <div>
      <PrintBar backHref="/billing" backLabel="Back to billing" />
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div><h1 className="text-xl font-bold text-slate-900">{b.organization.name}</h1><p className="text-sm text-slate-600">{b.name}{b.city ? `, ${b.city}` : ""}</p><p className="text-xs text-slate-500">{[b.address, b.phone].filter(Boolean).join(" · ")}</p></div>
          <div className="text-right"><p className="text-sm font-bold uppercase tracking-wide text-slate-700">Invoice</p><p className="font-mono text-sm">{o.orderNo}</p><p className="text-xs text-slate-500">{fmt(o.createdAt)}</p></div>
        </header>
        <p className="py-3 text-sm"><span className="text-slate-500">Billed to:</span> <b>{o.patient.name}</b> ({o.patient.mrn}) {o.patient.phone && `· ${o.patient.phone}`}</p>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-300 text-[11px] uppercase text-slate-500"><tr><th className="py-2">Test</th><th className="py-2">Code</th><th className="py-2 text-right">Price</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{o.items.map((i) => <tr key={i.id}><td className="py-2">{i.testName}</td><td className="py-2 text-slate-500">{i.testCode}</td><td className="py-2 text-right">{rs(i.price)}</td></tr>)}</tbody>
        </table>
        <div className="ml-auto mt-4 w-64 space-y-1 text-sm">
          <p className="flex justify-between"><span className="text-slate-500">Subtotal</span>{rs(o.subtotal)}</p>
          <p className="flex justify-between"><span className="text-slate-500">Discount</span>- {rs(o.discount)}</p>
          <p className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>Total</span>{rs(o.total)}</p>
          <p className="flex justify-between"><span className="text-slate-500">Paid</span>{rs(o.paidAmount)}</p>
          <p className="flex justify-between font-bold"><span>Balance due</span>{rs(balance)}</p>
          <p className="pt-1 text-right"><StatusBadge value={o.paymentStatus} /></p>
        </div>
        {o.payments.length > 0 && <div className="mt-6 text-xs text-slate-500"><p className="mb-1 font-semibold uppercase">Payments</p>{o.payments.map((p) => <p key={p.id}>{fmt(p.createdAt)} · {p.method.replace("_", " ")} · {rs(p.amount)}{p.reference ? ` · ${p.reference}` : ""}</p>)}</div>}
        <footer className="mt-10 border-t border-slate-200 pt-3 text-center text-xs text-slate-400">Thank you for choosing {b.organization.name}.</footer>
      </article>
    </div>
  );
}
