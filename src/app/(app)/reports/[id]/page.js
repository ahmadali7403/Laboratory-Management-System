import { notFound } from "next/navigation";
import { requireContext } from "@/lib/scope";
import { loadPrintableOrder } from "@/lib/documents";
import PrintBar from "@/components/print-button";
import { StatusBadge } from "@/components/ui";

export const instant = false;

const fmt = (d) => (d ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(d) : "—");

export default async function ReportPage({ params }) {
  const { actor } = await requireContext();
  const { id } = await params;
  const order = await loadPrintableOrder(actor, id);
  if (!order || order.status === "CANCELLED") notFound();
  const ready = order.status === "COMPLETED";
  const b = order.branch;
  const p = order.patient;
  const age = p.dateOfBirth ? `${Math.floor((order.createdAt - p.dateOfBirth) / 3.156e10)} years` : "—";

  return (
    <div>
      <PrintBar backHref="/reports" backLabel="Back to reports" />
      {!ready && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">This report is not final yet: some results are not verified.</p>}
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div><h1 className="text-xl font-bold text-slate-900">{b.organization.name}</h1><p className="text-sm text-slate-600">{b.name}{b.city ? `, ${b.city}` : ""}</p><p className="text-xs text-slate-500">{[b.address, b.phone, b.email].filter(Boolean).join(" · ")}</p></div>
          <div className="text-right"><p className="text-sm font-bold uppercase tracking-wide text-slate-700">Laboratory Report</p><p className="font-mono text-sm">{order.orderNo}</p></div>
        </header>
        <section className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-slate-200 py-4 text-sm">
          <p><span className="text-slate-500">Patient:</span> <b>{p.name}</b></p><p><span className="text-slate-500">MRN:</span> {p.mrn}</p>
          <p><span className="text-slate-500">Age / Gender:</span> {age} / {p.gender}</p><p><span className="text-slate-500">Phone:</span> {p.phone || "—"}</p>
          <p><span className="text-slate-500">Referred by:</span> {order.doctor?.name || "Self"}</p><p><span className="text-slate-500">Reported:</span> {fmt(order.completedAt)}</p>
        </section>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-slate-300 text-[11px] uppercase text-slate-500"><tr><th className="py-2">Test</th><th className="py-2">Result</th><th className="py-2">Unit</th><th className="py-2">Reference</th><th className="py-2">Flag</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((i) => (
              <tr key={i.id} className="break-inside-avoid">
                <td className="py-2 font-medium">{i.testName}{i.comments && <p className="text-xs font-normal text-slate-500">{i.comments}</p>}</td>
                <td className={`py-2 ${i.flag !== "NORMAL" && i.resultValue ? "font-bold" : ""}`}>{i.resultValue || "—"}</td><td className="py-2 text-slate-600">{i.unit || ""}</td>
                <td className="py-2 text-slate-600">{i.refRange || ""}</td><td className="py-2">{i.resultValue && i.flag !== "NORMAL" ? <StatusBadge value={i.flag} /> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="mt-10 flex justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p>Verified by: {[...new Set(order.items.map((i) => i.verifiedByName).filter(Boolean))].join(", ") || "—"}</p>
          <p>Printed {fmt(new Date())}</p>
        </footer>
      </article>
    </div>
  );
}
