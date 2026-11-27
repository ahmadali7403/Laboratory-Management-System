import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireContext } from "@/lib/scope";
import { ORDER_READERS } from "@/lib/permissions";
import { isUuid } from "@/lib/http";
import { VIEW_DEFS } from "@/lib/view-defs";
import PrintBar from "@/components/print-button";
import { StatusBadge } from "@/components/ui";

export const instant = false;

const TZ = "Asia/Karachi";
const fmtD = (d) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: TZ }).format(new Date(d));
const fmtDT = (d) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(new Date(d));
const rs = (n) => `Rs ${Number(n).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

function show(value, kind) {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "d") return fmtD(value);
  if (kind === "dt") return fmtDT(value);
  if (kind === "m") return rs(value);
  if (kind === "b") return value ? "Yes" : "No";
  if (kind === "s") return <StatusBadge value={String(value)} />;
  return String(value);
}
const read = (row, key) => (typeof key === "function" ? key(row) : row[key]);

export default async function ViewPage({ params }) {
  const { module, id } = await params;
  const { actor } = await requireContext(undefined, { module: module === "orders" ? ORDER_READERS : module });
  const def = VIEW_DEFS[module];
  if (!def || !isUuid(id)) notFound();
  // Access-by-id is filtered by the actor's authority in the same query (no cross-tenant reads).
  const row = await prisma[def.model].findFirst({ where: { id, ...def.where(actor) }, include: def.include });
  if (!row) notFound();

  const summary = def.summary ? def.summary(row) : [];
  const links = def.extraLinks ? def.extraLinks(row) : [];
  return (
    <div className="max-w-5xl">
      <PrintBar backHref={def.back} backLabel={`Back to ${def.title.toLowerCase()} list`} />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-bold text-slate-900">{def.title} details</h1>
        <div className="flex gap-2 print:hidden">{links.map(([label, href]) => <Link key={href} href={href} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-slate-50">{label}</Link>)}</div>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {def.fields.map(([label, key, kind = "t", link]) => {
            const v = read(row, key);
            return (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="break-words text-[13px] text-slate-800">{link && v ? <Link href={link(row)} className="text-blue-700 hover:underline">{show(v, kind)}</Link> : show(v, kind)}</dd>
              </div>
            );
          })}
        </dl>
      </section>
      {summary.length > 0 && (
        <section className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {summary.map(([label, v, kind]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase text-slate-400">{label}</p><p className="text-sm font-bold text-slate-800">{show(v, kind)}</p></div>
          ))}
        </section>
      )}
      {(def.tables || []).map((t) => {
        const rows = t.rows(row);
        return (
          <section key={t.title} className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="mb-1.5 text-xs font-semibold uppercase text-slate-500">{t.title} ({rows.length})</h2>
            {rows.length === 0 ? <p className="text-sm text-slate-400">None.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-[10px] uppercase text-slate-400"><tr>{t.cols.map(([l]) => <th key={l} className="py-1 pr-3 font-semibold">{l}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <tr key={r.id || i}>{t.cols.map(([l, key, kind = "t", link]) => { const v = read(r, key); return <td key={l} className="py-1 pr-3 align-top">{link && v ? <Link href={link(r)} className="text-blue-700 hover:underline">{show(v, kind)}</Link> : show(v, kind)}</td>; })}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
