"use client";

import { useCallback, useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { api, formatDateTime, formatMoney } from "@/lib/client";
import { Button, Field, FormError, Modal, Spinner, inputClass, useToast } from "@/components/ui";

function printShiftSlip(shift, summary) {
  if (typeof document === "undefined" || !shift) return;
  const s = summary || shift;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Shift Summary</title>
  <style>@page{margin:4mm}*{font-family:ui-sans-serif,system-ui,sans-serif;box-sizing:border-box}body{margin:0;font-size:11px;color:#0f172a}.w{max-width:78mm;margin:0 auto}.c{text-align:center}.b{font-weight:700}.hr{border-top:1px dashed #64748b;margin:5px 0}.r{display:flex;justify-content:space-between;margin:2px 0}</style>
  </head><body><div class="w">
    <div class="c b" style="font-size:13px">CASHIER SHIFT REPORT (${shift.status})</div>
    <div class="c">${shift.cashierName}</div>
    <div class="hr"></div>
    <div class="r"><span>Opened</span><span>${formatDateTime(shift.openedAt)}</span></div>
    ${shift.closedAt ? `<div class="r"><span>Closed</span><span>${formatDateTime(shift.closedAt)}</span></div>` : ""}
    <div class="r"><span>Bills Count</span><span>${s.salesCount ?? shift.salesCount ?? 0}</span></div>
    <div class="hr"></div>
    <div class="r"><span>Opening Cash</span><span>${formatMoney(shift.openingCash)}</span></div>
    <div class="r"><span>Cash Sales</span><span>${formatMoney(s.cashSales ?? shift.cashSales)}</span></div>
    <div class="r"><span>Card Sales</span><span>${formatMoney(s.cardSales ?? shift.cardSales)}</span></div>
    <div class="r"><span>JazzCash / EasyPaisa</span><span>${formatMoney(s.mobileSales ?? shift.mobileSales)}</span></div>
    <div class="r"><span>Bank / Online</span><span>${formatMoney(s.bankSales ?? shift.bankSales)}</span></div>
    <div class="hr"></div>
    <div class="r b"><span>Total Sales</span><span>${formatMoney(s.totalSales ?? shift.totalSales)}</span></div>
    <div class="r b"><span>Expected Drawer Cash</span><span>${formatMoney(s.expectedCash ?? shift.expectedCash)}</span></div>
    ${shift.closingCash != null ? `<div class="r b"><span>Counted Cash</span><span>${formatMoney(shift.closingCash)}</span></div>` : ""}
    ${shift.notes ? `<div class="hr"></div><div>Notes: ${shift.notes}</div>` : ""}
  </div></body></html>`;
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(f);
  const d = f.contentDocument || f.contentWindow?.document;
  d.open(); d.write(html); d.close();
  setTimeout(() => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch {} setTimeout(() => f.remove(), 60_000); }, 20);
}

export default function ShiftModal({ open, branchId, onClose, onChanged }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ openShift: null, liveSummary: null, recentShifts: [] });
  const [cash, setCash] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!branchId) return;
    setLoading(true);
    api(`/api/pharmacy/shifts?branchId=${branchId}`)
      .then((d) => {
        setData(d);
        setError("");
        if (d.liveSummary) setCash(String(d.liveSummary.expectedCash ?? ""));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [open, load]);

  async function submitOpen(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api("/api/pharmacy/shifts", {
        method: "POST",
        body: { branchId, openingCash: Number(cash || 0), notes },
      });
      toast.success("Shift opened.");
      setNotes("");
      onChanged?.();
      load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function submitClose(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const res = await api("/api/pharmacy/shifts", {
        method: "PATCH",
        body: { closingCash: Number(cash || 0), notes },
      });
      toast.success("Shift closed.");
      printShiftSlip(res.shift, res.shift);
      setCash("");
      setNotes("");
      onChanged?.();
      load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const openShift = data.openShift;
  const live = data.liveSummary;

  return (
    <Modal open={open} onClose={onClose} size="md" title="Cashier Shift & Drawer Report" subtitle="Open or close your pharmacy POS drawer shift and print X/Z report.">
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <FormError message={error} />
          {openShift ? (
            <form onSubmit={submitClose} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-emerald-700">Open Shift Active</p>
                  <p className="text-xs text-slate-600">{openShift.cashierName} · Since {formatDateTime(openShift.openedAt)}</p>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={() => printShiftSlip(openShift, live)}>
                  <Printer size={13} /> Print X-Report
                </Button>
              </div>
              {live && (
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs">
                  <div><span className="block text-[10px] text-slate-400">Opening</span><b>{formatMoney(openShift.openingCash)}</b></div>
                  <div><span className="block text-[10px] text-slate-400">Cash Sales ({live.salesCount})</span><b>{formatMoney(live.cashSales)}</b></div>
                  <div><span className="block text-[10px] text-slate-400">Expected Cash</span><b className="text-emerald-700">{formatMoney(live.expectedCash)}</b></div>
                  <div><span className="block text-[10px] text-slate-400">Card</span><b>{formatMoney(live.cardSales)}</b></div>
                  <div><span className="block text-[10px] text-slate-400">JazzCash/EasyPaisa</span><b>{formatMoney(live.mobileSales)}</b></div>
                  <div><span className="block text-[10px] text-slate-400">Total Sales</span><b>{formatMoney(live.totalSales)}</b></div>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Counted Drawer Cash (Rs)" required>
                  <input autoFocus type="number" min="0" step="any" required value={cash} onChange={(e) => setCash(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Closing Notes">
                  <input value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Optional remarks" className={inputClass} />
                </Field>
              </div>
              <Button type="submit" variant="danger" loading={busy}>Close Shift &amp; Print Z-Report</Button>
            </form>
          ) : (
            <form onSubmit={submitOpen} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase text-slate-600">No Active Shift Open</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Opening Drawer Cash (Rs)" required>
                  <input autoFocus type="number" min="0" step="any" required value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0" className={inputClass} />
                </Field>
                <Field label="Notes">
                  <input value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Morning / Evening shift" className={inputClass} />
                </Field>
              </div>
              <Button type="submit" loading={busy}>Open Shift</Button>
            </form>
          )}

          {data.recentShifts?.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-bold uppercase text-slate-500">Recent Shifts</h3>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr><th className="px-2 py-1.5">Cashier</th><th className="px-2 py-1.5">Opened</th><th className="px-2 py-1.5 text-right">Sales</th><th className="px-2 py-1.5 text-right">Status</th><th className="w-8" /></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentShifts.map((s) => (
                      <tr key={s.id}>
                        <td className="px-2 py-1.5 font-medium">{s.cashierName}</td>
                        <td className="px-2 py-1.5 text-slate-500">{formatDateTime(s.openedAt)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{formatMoney(s.totalSales)} ({s.salesCount})</td>
                        <td className="px-2 py-1.5 text-right">{s.status}</td>
                        <td className="px-1 py-1 text-center">
                          <button type="button" onClick={() => printShiftSlip(s, s)} title="Print shift summary" className="rounded p-1 text-slate-500 hover:bg-slate-100"><Printer size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
