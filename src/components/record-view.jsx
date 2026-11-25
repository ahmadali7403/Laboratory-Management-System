"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { api, formatDate, formatDateTime, formatMoney } from "@/lib/client";
import { ErrorState, Modal, Spinner, StatusBadge } from "@/components/ui";

// One place that opens every record "View" (and the invoice / lab report documents) as a compact
// modal, so no screen has to navigate away from its list. Data comes from /api/view/<module>/<id>.
const RecordViewContext = createContext({ openView: () => {}, openDoc: () => {} });
export const useRecordView = () => useContext(RecordViewContext);

const DOCS = {
  invoice: { title: "Invoice", src: (id) => `/embed/invoice/${id}`, size: "lg" },
  report: { title: "Laboratory report", src: (id) => `/embed/reports/${id}`, size: "doc" },
};

// Detail links stored in view definitions are page URLs; map them onto modals.
function resolveHref(href) {
  let m = /^\/view\/([a-z]+)\/([0-9a-f-]{36})$/i.exec(href || "");
  if (m) return { type: "view", module: m[1], id: m[2] };
  m = /^\/billing\/([0-9a-f-]{36})$/i.exec(href || "");
  if (m) return { type: "doc", kind: "invoice", id: m[1] };
  m = /^\/reports\/([0-9a-f-]{36})$/i.exec(href || "");
  if (m) return { type: "doc", kind: "report", id: m[1] };
  return null;
}

function show(value, kind) {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "d") return formatDate(value);
  if (kind === "dt") return formatDateTime(value);
  if (kind === "m") return formatMoney(value);
  if (kind === "b") return value ? "Yes" : "No";
  if (kind === "s") return <StatusBadge value={String(value)} />;
  return String(value);
}

export function RecordViewProvider({ children }) {
  const [stack, setStack] = useState([]); // newest entry is the one on screen
  const openView = useCallback((module, id) => setStack([{ type: "view", module, id }]), []);
  const openDoc = useCallback((kind, id) => setStack([{ type: "doc", kind, id }]), []);
  const push = useCallback((entry) => setStack((s) => [...s, entry]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);
  const value = useMemo(() => ({ openView, openDoc }), [openView, openDoc]);
  const top = stack[stack.length - 1];

  return (
    <RecordViewContext.Provider value={value}>
      {children}
      {top?.type === "view" && (
        <ViewModal key={`${top.module}:${top.id}`} entry={top} canGoBack={stack.length > 1} onBack={back} onClose={close} onNavigate={push} />
      )}
      {top?.type === "doc" && <DocModal key={`${top.kind}:${top.id}`} entry={top} canGoBack={stack.length > 1} onBack={back} onClose={close} />}
    </RecordViewContext.Provider>
  );
}

function BackButton({ onBack }) {
  return (
    <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
      <ArrowLeft size={13} /> Back
    </button>
  );
}

function ViewModal({ entry, canGoBack, onBack, onClose, onNavigate }) {
  const [state, setState] = useState({ data: null, error: "" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    api(`/api/view/${entry.module}/${entry.id}`, { signal: ctrl.signal })
      .then((data) => setState({ data, error: "" }))
      .catch((e) => e.name !== "AbortError" && setState({ data: null, error: e.message }));
    return () => ctrl.abort();
  }, [entry.module, entry.id, tick]);

  const { data, error } = state;
  const go = (href) => { const next = resolveHref(href); if (next) onNavigate(next); };
  const Link = ({ href, children }) =>
    resolveHref(href) ? (
      <button type="button" onClick={() => go(href)} className="text-left text-blue-700 hover:underline">{children}</button>
    ) : (
      <>{children}</>
    );

  return (
    <Modal open size={data?.tables?.some((t) => t.cols.length > 4) ? "lg" : "md"} title={data ? `${data.title} details` : "Details"} onClose={onClose}>
      {canGoBack && <BackButton onBack={onBack} />}
      {error ? (
        <ErrorState message={error} onRetry={() => { setState({ data: null, error: "" }); setTick((t) => t + 1); }} />
      ) : !data ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {data.links.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.links.map((l) => (
                <button key={l.href} type="button" onClick={() => go(l.href)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-slate-50">
                  <ExternalLink size={12} /> {l.label}
                </button>
              ))}
            </div>
          )}
          <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {data.fields.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</dt>
                <dd className="break-words text-[13px] text-slate-800">{f.href ? <Link href={f.href}>{show(f.value, f.kind)}</Link> : show(f.value, f.kind)}</dd>
              </div>
            ))}
          </dl>
          {data.summary.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {data.summary.map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">{s.label}</p>
                  <p className="text-sm font-bold text-slate-800">{show(s.value, s.kind)}</p>
                </div>
              ))}
            </div>
          )}
          {data.tables.map((t) => (
            <section key={t.title}>
              <h3 className="mb-1 text-[11px] font-semibold uppercase text-slate-500">{t.title} ({t.rows.length})</h3>
              {t.rows.length === 0 ? (
                <p className="text-xs text-slate-400">None.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 text-left text-[10px] uppercase text-slate-400">
                      <tr>{t.cols.map((c) => <th key={c.label} className="px-2 py-1 font-semibold">{c.label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {t.rows.map((r, i) => (
                        <tr key={i}>
                          {r.map((cell, j) => (
                            <td key={j} className="px-2 py-1 align-top">
                              {cell.href ? <Link href={cell.href}>{show(cell.value, t.cols[j].kind)}</Link> : show(cell.value, t.cols[j].kind)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}

// Invoice / lab report: the existing printable page is shown inside the modal (same markup, same
// print output). The embed route has no sidebar; its Print button prints just the document.
function DocModal({ entry, canGoBack, onBack, onClose }) {
  const doc = DOCS[entry.kind];
  const [loaded, setLoaded] = useState(false);
  return (
    <Modal open size={doc.size} title={doc.title} onClose={onClose}>
      {canGoBack && <BackButton onBack={onBack} />}
      <div className="relative">
        {!loaded && <div className="absolute inset-0 z-10 bg-white"><Spinner /></div>}
        <iframe title={doc.title} src={doc.src(entry.id)} onLoad={() => setLoaded(true)} className="h-[68vh] w-full rounded-lg border border-slate-200 bg-white" />
      </div>
    </Modal>
  );
}
