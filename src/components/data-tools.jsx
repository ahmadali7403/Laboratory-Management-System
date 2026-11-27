"use client";

import { useRef, useState } from "react";
import { DatabaseBackup, Download, FileSpreadsheet, Printer, Upload } from "lucide-react";
import { api } from "@/lib/client";
import { BACKUP_MODULE, EXPORT_ROWS } from "@/lib/export-rows";
import { Button, FormError, Modal, useToast } from "@/components/ui";

const MODULE_LABELS = {
  tests: "Test catalog", suppliers: "Suppliers", patients: "Patients", inventory: "Inventory",
  orders: "Orders, samples, results & payments", expenses: "Expenses", purchases: "Purchases",
};

export async function fetchAllRows(endpoint, params = {}) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const sp = new URLSearchParams({ ...params, page: String(page), pageSize: "100" });
    const d = await api(`${endpoint}?${sp}`);
    rows.push(...d.items);
    if (rows.length >= d.total || d.items.length === 0) break;
  }
  return rows;
}

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function downloadText(name, text, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["\ufeff", text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function printTable(title, rows) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;margin:16px;color:#111}h1{font-size:18px;margin:0 0 2px}p{margin:0 0 12px;font-size:11px;color:#555}
    table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}
    th{background:#eee}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4 landscape;margin:10mm}</style></head><body>
    <h1>${esc(title)}</h1><p>Printed ${esc(new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi" }))} · ${rows.length} record(s)</p>
    <table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  frame.contentDocument.open(); frame.contentDocument.write(html); frame.contentDocument.close();
  frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 3000); };
}

export function downloadBackup(module, allOrgs = false) {
  const a = Object.assign(document.createElement("a"), { href: `/api/backup?module=${module}${allOrgs ? "&allOrgs=1" : ""}` });
  document.body.appendChild(a); a.click(); a.remove();
}

// ---------------------------------------------------------------------------
export function RestoreDialog({ file, onClose, onDone }) {
  const toast = useToast();
  const [mode, setMode] = useState("merge");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const backups = file.data.format === "labos-backup-set" ? file.data.backups || [] : [file.data];
  const describe = (b) => Object.entries(b.modules || {}).map(([k, v]) => `${MODULE_LABELS[k] || k}: ${v.length}`).join(" · ") || "No records";

  async function run() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const res = await api(`/api/restore?mode=${mode}`, { method: "POST", body: file.data });
      setResult(res.summary);
      toast.success("Restore completed.");
      onDone?.();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal open size="md" title="Restore from backup" subtitle={file.name} onClose={busy ? undefined : onClose}
      footer={result ? <Button onClick={onClose}>Close</Button> : <><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button variant={mode === "overwrite" ? "danger" : "primary"} onClick={run} loading={busy}>Restore now</Button></>}>
      <FormError message={error} />
      {result ? (
        <ul className="space-y-3 text-sm">
          {result.map((s, i) => (
            <li key={i} className="rounded-lg border border-slate-200 p-3">
              <p className="font-semibold text-slate-800">{s.organization}{s.branchId ? " (branch backup)" : ""}</p>
              <ul className="mt-1 text-xs text-slate-600">{Object.entries(s.counts).map(([k, c]) => <li key={k}>{MODULE_LABELS[k] || k}: {c.added} added · {c.updated} updated · {c.skipped} unchanged</li>)}</ul>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            {backups.map((b, i) => <p key={i} className="text-xs text-slate-600"><b className="text-slate-800">{b.scope?.organizationName || "Organization"}{b.scope?.branchName ? ` · ${b.scope.branchName}` : ""}</b><br />{describe(b)}</p>)}
          </div>
          {[["merge", "Add missing records only", "Existing records are kept as they are."], ["overwrite", "Overwrite existing records", "Records with the same ID are replaced by the backup version."]].map(([v, t, h]) => (
            <label key={v} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${mode === v ? "border-blue-500 bg-blue-50/50" : "border-slate-200"}`}>
              <input type="radio" name="mode" checked={mode === v} onChange={() => setMode(v)} className="mt-1" />
              <span><span className="font-semibold text-slate-800">{t}</span><span className="block text-xs text-slate-500">{h}</span></span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function useRestorePicker(onDone) {
  const toast = useToast();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const picker = (
    <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
      const f = e.target.files?.[0]; e.target.value = "";
      if (!f) return;
      try { setFile({ name: f.name, data: JSON.parse(await f.text()) }); } catch { toast.error("This file is not a valid LabOS backup."); }
    }} />
  );
  const dialog = file && <RestoreDialog file={file} onClose={() => setFile(null)} onDone={onDone} />;
  return { pick: () => input.current?.click(), picker, dialog };
}

// ---------------------------------------------------------------------------
/** Export CSV · Print · Backup · Restore for the page's data. */
export default function DataMenu({ config, scope, params, onRestored }) {
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(false);
  const restore = useRestorePicker(onRestored);
  const row = EXPORT_ROWS[config.endpoint];
  const section = BACKUP_MODULE[config.endpoint];
  const needsOrg = !scope.organizationId;

  async function collect() {
    const items = await fetchAllRows(config.endpoint, params);
    return row ? items.map(row) : items;
  }
  async function run(kind) {
    setOpen(false);
    setBusy(kind);
    try {
      const rows = await collect();
      if (!rows.length) return toast.info("There is no data to export.");
      if (kind === "csv") {
        const cols = Object.keys(rows[0]);
        downloadText(`${config.title.replace(/\W+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`, [cols.map(csvCell).join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\r\n"));
      } else printTable(config.title, rows);
    } catch (e) { toast.error(e.message); } finally { setBusy(""); }
  }
  const item = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50";
  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((o) => !o)} loading={Boolean(busy)}><Download size={15} /> Data</Button>
      {open && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <button className={item} onClick={() => run("csv")}><FileSpreadsheet size={15} /> Export to Excel (CSV)</button>
            <button className={item} onClick={() => run("print")}><Printer size={15} /> Print list</button>
            {section && <>
              <div className="border-t border-slate-100" />
              <button className={item} onClick={() => { setOpen(false); needsOrg ? toast.error("Select an organization in the top bar first.") : downloadBackup(section); }}><DatabaseBackup size={15} /> Download backup</button>
              <button className={item} onClick={() => { setOpen(false); restore.pick(); }}><Upload size={15} /> Restore from backup</button>
            </>}
          </div>
        </>
      )}
      {restore.picker}
      {restore.dialog}
    </div>
  );
}
