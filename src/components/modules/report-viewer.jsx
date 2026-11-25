"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Printer, Search, X } from "lucide-react";
import { api, formatDate, formatDateTime, formatMoney } from "@/lib/client";
import { Button, EmptyState, ErrorState, PageHeader, Spinner, StatusBadge, inputClass } from "@/components/ui";

const iso = (d) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10); // Karachi calendar day
const PRESETS = [
  ["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"],
  ["month", "This month"], ["lastmonth", "Last month"], ["year", "This year"], ["all", "All time"], ["custom", "Custom"],
];
function presetRange(p) {
  const now = new Date();
  const today = iso(now);
  const back = (n) => iso(new Date(now.getTime() - n * 86_400_000));
  const [y, m] = today.split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const lastDay = (yy, mm) => new Date(yy, mm, 0).getDate();
  switch (p) {
    case "today": return [today, today];
    case "yesterday": return [back(1), back(1)];
    case "7d": return [back(6), today];
    case "30d": return [back(29), today];
    case "month": return [`${y}-${pad(m)}-01`, today];
    case "lastmonth": { const ly = m === 1 ? y - 1 : y, lm = m === 1 ? 12 : m - 1; return [`${ly}-${pad(lm)}-01`, `${ly}-${pad(lm)}-${lastDay(ly, lm)}`]; }
    case "year": return [`${y}-01-01`, today];
    default: return ["", ""];
  }
}

function Cell({ kind, value }) {
  if (value === null || value === undefined || value === "") return <span className="text-slate-300">—</span>;
  switch (kind) {
    case "m": return <>{formatMoney(value)}</>;
    case "d": return <>{formatDate(value)}</>;
    case "dt": return <>{formatDateTime(value)}</>;
    case "n": return <>{Number(value).toLocaleString("en-PK", { maximumFractionDigits: 2 })}</>;
    case "s": return <StatusBadge value={value} />;
    default: return <>{String(value)}</>;
  }
}
const plain = (kind, v) => (v == null ? "" : kind === "d" ? formatDate(v) : kind === "dt" ? formatDateTime(v) : String(v));

function toCsv(report) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [esc(report.title), esc(report.period), ""];
  for (const s of report.summary) lines.push([esc(s.label), esc(plain(s.kind, s.value))].join(","));
  for (const t of report.tables) {
    lines.push("", esc(t.title), t.cols.map((c) => esc(c.label)).join(","));
    for (const r of t.rows) lines.push(t.cols.map((c) => esc(plain(c.kind, r[c.key]))).join(","));
  }
  return "\uFEFF" + lines.join("\r\n");
}

export default function ReportViewer({ module, title, entity, modules }) {
  const [mode, setMode] = useState("combined");
  const [preset, setPreset] = useState("30d");
  const [[from, to], setDates] = useState(() => presetRange("30d"));
  const [picked, setPicked] = useState(null); // { id, label }
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reqId = useRef(0);
  const router = useRouter();

  const run = useCallback(() => {
    if (mode === "individual" && !picked) { setReport(null); setLoading(false); setError(""); return; }
    const my = ++reqId.current;
    setLoading(true);
    const qs = new URLSearchParams({ mode });
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (mode === "individual") qs.set("id", picked.id);
    api(`/api/reports/${module}?${qs}`)
      .then((d) => { if (my === reqId.current) { setReport(d); setError(""); } })
      .catch((e) => { if (my === reqId.current) { setReport(null); setError(e.message); } })
      .finally(() => { if (my === reqId.current) setLoading(false); });
  }, [module, mode, from, to, picked]);
  useEffect(run, [run]);

  function choosePreset(p) {
    setPreset(p);
    if (p !== "custom") setDates(presetRange(p));
  }
  function download() {
    const blob = new Blob([toCsv(report)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${module}-${mode}-report.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader title={`${title} reports`} description="Combined report for everything, or an individual report for one record."
        actions={<Link href="/analytics" className="inline-flex items-center gap-1 text-sm text-blue-600 print:hidden"><ArrowLeft size={14} /> All reports</Link>} />

      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-sm font-medium">
          {[["combined", "Combined report"], ["individual", `Individual ${entity.toLowerCase()}`]].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={`rounded-md px-3 py-1.5 ${mode === k ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>{l}</button>
          ))}
        </div>
        <select aria-label="Report module" value={module} onChange={(e) => router.push(`/analytics/${e.target.value}`)} className={`${inputClass} w-auto`}>
          {modules.map((m) => <option key={m.key} value={m.key}>{m.title}</option>)}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 print:hidden">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map(([k, l]) => <button key={k} onClick={() => choosePreset(k)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${preset === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{l}</button>)}
        </div>
        <label className="text-xs text-slate-500">From <input type="date" value={from} max={to || undefined} onChange={(e) => { setPreset("custom"); setDates([e.target.value, to]); }} className={`${inputClass} ml-1 w-36`} /></label>
        <label className="text-xs text-slate-500">To <input type="date" value={to} min={from || undefined} onChange={(e) => { setPreset("custom"); setDates([from, e.target.value]); }} className={`${inputClass} ml-1 w-36`} /></label>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={download} disabled={!report}><Download size={15} /> CSV</Button>
          <Button onClick={() => window.print()} disabled={!report}><Printer size={15} /> Print / PDF</Button>
        </div>
      </div>

      {mode === "individual" && <EntityPicker module={module} entity={entity} picked={picked} onPick={setPicked} />}

      {error ? <ErrorState message={error} onRetry={run} /> : mode === "individual" && !picked ? (
        <div className="rounded-2xl border border-slate-200 bg-white"><EmptyState title={`Choose a ${entity.toLowerCase()}`} message="Search above and select one to see its report." /></div>
      ) : loading && !report ? <Spinner /> : report && (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <div className="mb-3">
            <h2 className="text-lg font-bold text-slate-900">{report.title}</h2>
            <p className="text-xs text-slate-500">{report.subtitle} · Generated {formatDateTime(new Date())}</p>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {report.summary.map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
                <p className="mt-1 break-words text-lg font-bold text-slate-900"><Cell kind={s.kind} value={s.value} /></p>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {report.tables.map((t) => (
              <section key={t.title} className="break-inside-avoid-page rounded-xl border border-slate-200 bg-white">
                <h3 className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{t.title} <span className="font-normal text-slate-400">({t.rows.length})</span></h3>
                {t.rows.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-400">No data for this period.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 uppercase text-slate-500"><tr>{t.cols.map((c) => <th key={c.key} className={`px-3 py-2 font-semibold ${["m", "n"].includes(c.kind) ? "text-right" : ""}`}>{c.label}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {t.rows.map((r, i) => <tr key={i}>{t.cols.map((c) => <td key={c.key} className={`px-3 py-1.5 text-slate-700 ${["m", "n"].includes(c.kind) ? "text-right tabular-nums" : ""}`}><Cell kind={c.kind} value={r[c.key]} /></td>)}</tr>)}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EntityPicker({ module, entity, picked, onPick }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      api(`/api/reports/${module}?entities=1&q=${encodeURIComponent(q)}`).then((d) => setItems(d.items || [])).catch(() => setItems([]));
    }, 250);
    return () => clearTimeout(t);
  }, [module, q]);
  return (
    <div className="relative mb-4 max-w-xl print:hidden">
      {picked ? (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
          {picked.label}
          <button aria-label="Clear selection" onClick={() => { onPick(null); setQ(""); }}><X size={15} /></button>
        </div>
      ) : (
        <>
          <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
          <input value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} placeholder={`Search ${entity.toLowerCase()}…`} className={`${inputClass} pl-9`} />
          {open && (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
              {items.length === 0 ? <li className="px-3 py-2 text-slate-400">No match.</li> : items.map((it) => (
                <li key={it.id}><button className="flex w-full justify-between gap-3 px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => { onPick(it); setOpen(false); }}><span>{it.label}</span>{it.hint && <span className="text-xs text-slate-400">{it.hint}</span>}</button></li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
