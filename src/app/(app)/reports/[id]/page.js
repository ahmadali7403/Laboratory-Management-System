import { notFound } from "next/navigation";
import { requireContext } from "@/lib/scope";
import { loadPreviousResults, loadPrintableOrder } from "@/lib/documents";
import PrintBar from "@/components/print-button";

export const instant = false;

const dt = (d) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }).format(d);
const tm = (d) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }).format(d);
const n = (v) => (v == null ? null : Number(v));

function rangeText(r) {
  if (r.refRangeText) return r.refRangeText;
  const lo = n(r.refLow), hi = n(r.refHigh);
  if (lo != null && hi != null) return `${lo} - ${hi}`;
  if (lo != null) return `≥ ${lo}`;
  if (hi != null) return `≤ ${hi}`;
  return "";
}

function ResultCell({ value, flag }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const abnormal = flag && flag !== "NORMAL";
  const arrow = flag === "LOW" ? "↓" : flag === "HIGH" ? "↑" : abnormal ? "*" : "";
  return abnormal
    ? <span className="font-bold text-blue-700"><span className="mr-1.5 font-normal">{arrow}</span>{value}</span>
    : <span>{value}</span>;
}

export default async function ReportPage({ params }) {
  const { actor } = await requireContext(undefined, { module: "reports" });
  const { id } = await params;
  const order = await loadPrintableOrder(actor, id);
  if (!order || order.status === "CANCELLED") notFound();
  const previous = await loadPreviousResults(order);

  const ready = order.status === "COMPLETED";
  const b = order.branch;
  const org = b.organization;
  const p = order.patient;
  const ref = order.completedAt || new Date();
  const ageYears = p.dateOfBirth ? Math.floor((order.createdAt - p.dateOfBirth) / 3.156e10) : null;
  const consultants = (org.reportConsultants || "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((c) => c[0]);
  const note = org.reportFooterNote || "Electronically Verified Report, No Signature(s) required. This report is not valid for any court.";

  return (
    <div>
      <style>{`@media print { @page { size: A4; margin: 8mm; } thead { display: table-header-group; } tfoot { display: table-footer-group; } }`}</style>
      <PrintBar backHref="/reports" backLabel="Back to reports" />
      {!ready && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">This report is not final yet: some results are not verified.</p>}

      <article className="mx-auto max-w-[210mm] bg-white text-[13px] text-slate-900 shadow-sm print:max-w-none print:shadow-none">
        <table className="w-full border-collapse">
          <thead>
            <tr><td>
              <div className="flex items-center justify-between px-2 pb-2 pt-3">
                <div>
                  <h1 className="font-serif text-3xl font-bold uppercase tracking-wide text-blue-900">{org.name}</h1>
                  <p className="text-xs tracking-wide text-slate-600">{b.name}{b.city ? ` · ${b.city}` : ""}</p>
                </div>
                <p className="text-right text-xs font-semibold uppercase text-slate-500">Laboratory Report</p>
              </div>
              <div className="grid grid-cols-[1.1fr_1fr_1.1fr] border-y border-slate-700 text-[12px]">
                <div className="space-y-0.5 px-2 py-2">
                  <p className="text-lg font-bold uppercase leading-tight">{p.name}</p>
                  {p.fatherName && <p><b className="inline-block w-20 font-semibold">F/H Name:</b> {p.fatherName}</p>}
                  <p><b className="inline-block w-20 font-semibold">Age/Gender:</b> {ageYears != null ? `${ageYears} years` : "—"} /{p.gender === "MALE" ? "Male" : p.gender === "FEMALE" ? "Female" : "Other"}</p>
                  <p><b className="inline-block w-20 font-semibold">Phone:</b> {p.phone || "—"}</p>
                  <p><b className="inline-block w-20 font-semibold">CNIC#:</b> {p.cnic || ""}</p>
                </div>
                <div className="space-y-0.5 border-x border-slate-700 px-2 py-2">
                  <p className="text-center text-[10px] text-slate-500">Patient Number</p>
                  <p className="text-center font-mono text-sm font-bold">{p.mrn}</p>
                  <p><b>Registered On:</b> {dt(order.createdAt)} {tm(order.createdAt)}</p>
                  <p><b>Reported On:</b> {order.completedAt ? `${dt(order.completedAt)} ${tm(order.completedAt)}` : "Pending"}</p>
                </div>
                <div className="space-y-0.5 px-2 py-2">
                  <p className="text-center text-[10px] text-slate-500">Lab Number</p>
                  <p className="text-center font-mono text-sm font-bold">{order.orderNo}</p>
                  <p><b>Ref. By:</b> {order.referredBy || ""}</p>
                  <p><b>Registered At:</b> {b.name}</p>
                </div>
              </div>
            </td></tr>
          </thead>

          <tbody>
            {order.items.map((item) => {
              const rows = item.results.length
                ? item.results.map((r) => ({ key: r.id, name: r.name, range: rangeText(r), unit: r.unit, value: r.value, flag: r.flag, pk: `${item.testCode}|${r.name}` }))
                : [{ key: item.id, name: item.testName, range: item.refRange || "", unit: item.unit, value: item.resultValue, flag: item.flag, pk: `${item.testCode}|` }];
              return (
                <tr key={item.id} className="break-inside-avoid"><td className="pt-4">
                  <div className="flex items-end justify-between px-2">
                    <h2 className="flex-1 text-center text-sm font-bold uppercase tracking-wide">{item.testName}</h2>
                    <p className="text-[10px] font-semibold">Sample: {item.test?.sampleType || "Blood"}</p>
                  </div>
                  <table className="mt-1 w-full border-collapse text-left">
                    <thead>
                      <tr className="border-y border-slate-700 text-[11px] font-bold uppercase">
                        <th className="px-2 py-1.5">Test</th><th className="px-2 py-1.5">Reference Range</th><th className="px-2 py-1.5">Unit</th>
                        <th className="px-2 py-1.5 text-center">Result<span className="block text-[9px] font-normal normal-case italic">{ref ? `${dt(ref)} ${tm(ref)}` : ""}</span></th>
                        {previous.map((pv) => <th key={pv.orderNo} className="px-2 py-1.5 text-center">Result<span className="block text-[9px] font-semibold normal-case">{pv.orderNo}/{dt(pv.date)}</span></th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.key} className={`${i % 2 === 0 ? "bg-slate-100" : ""} break-inside-avoid`}>
                          <td className="px-2 py-1.5 text-[13px]">{r.name}</td>
                          <td className="px-2 py-1.5 text-slate-700">{r.range}</td>
                          <td className="px-2 py-1.5 text-slate-700">{r.unit}</td>
                          <td className="px-2 py-1.5 text-center"><ResultCell value={r.value} flag={r.flag} /></td>
                          {previous.map((pv) => { const prev = pv.map.get(r.pk); return <td key={pv.orderNo} className="px-2 py-1.5 text-center text-slate-700">{prev?.value || "—"}</td>; })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {item.comments && <p className="px-2 pt-1 text-[11px] text-slate-600"><b>Comments:</b> {item.comments}</p>}
                </td></tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr><td className="pt-6">
              <p className="text-center text-[12px] font-bold">All results should be interpreted and correlated by physician</p>
              <p className="bg-slate-200 py-0.5 text-center text-[10px] font-bold">{note}</p>
              {consultants.length > 0 && (
                <div className="grid gap-2 px-1 py-2 text-[9px] leading-tight" style={{ gridTemplateColumns: `repeat(${Math.min(consultants.length, 5)}, minmax(0, 1fr))` }}>
                  {consultants.slice(0, 5).map((c, i) => <div key={i}><p className="font-serif text-[10px] font-bold">{c[0]}</p>{c[1] && <p>{c[1]}</p>}{c[2] && <p>{c[2]}</p>}</div>)}
                </div>
              )}
              <p className="border-t border-slate-700 px-1 py-1 text-[10px]">{b.name.toUpperCase()}</p>
              <p className="bg-blue-900 px-2 py-1.5 text-center text-[10px] font-semibold text-white print:[print-color-adjust:exact]">{[b.address, b.email, b.phone].filter(Boolean).join("  ·  ") || org.name}</p>
            </td></tr>
          </tfoot>
        </table>
      </article>
    </div>
  );
}
