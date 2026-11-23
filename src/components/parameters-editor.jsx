"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, inputClass } from "@/components/ui";

export const emptyParameter = () => ({ name: "", unit: "", refLow: "", refHigh: "", refRangeText: "" });

/** Editable list of test parameters (WBC, RBC, ...) with unit and reference range. */
export default function ParametersEditor({ label, value, onChange }) {
  const rows = value || [];
  const update = (i, k, v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">{label} <span className="font-normal text-slate-400">({rows.length})</span></p>
        <Button size="sm" variant="secondary" onClick={() => onChange([...rows, emptyParameter()])}><Plus size={13} /> Add parameter</Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-500">
          No parameters. Leave empty for a single-value test, or add parameters for a panel such as CBC or LFT.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr><th className="px-2 py-2 text-left">Parameter</th><th className="px-2 py-2 text-left">Unit</th><th className="px-2 py-2 text-left">Low</th><th className="px-2 py-2 text-left">High</th><th className="px-2 py-2 text-left">Text range</th><th className="w-10" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="p-1.5"><input required value={r.name} maxLength={120} onChange={(e) => update(i, "name", e.target.value)} className={`${inputClass} h-9`} aria-label="Parameter name" /></td>
                  <td className="p-1.5"><input value={r.unit ?? ""} maxLength={30} onChange={(e) => update(i, "unit", e.target.value)} className={`${inputClass} h-9 w-24`} aria-label="Unit" /></td>
                  <td className="p-1.5"><input type="number" step="any" value={r.refLow ?? ""} onChange={(e) => update(i, "refLow", e.target.value)} className={`${inputClass} h-9 w-24`} aria-label="Reference low" /></td>
                  <td className="p-1.5"><input type="number" step="any" value={r.refHigh ?? ""} onChange={(e) => update(i, "refHigh", e.target.value)} className={`${inputClass} h-9 w-24`} aria-label="Reference high" /></td>
                  <td className="p-1.5"><input value={r.refRangeText ?? ""} maxLength={150} onChange={(e) => update(i, "refRangeText", e.target.value)} placeholder="e.g. Negative" className={`${inputClass} h-9`} aria-label="Text range" /></td>
                  <td className="p-1.5 text-center"><Button variant="ghost" size="icon" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove parameter" className="text-rose-500"><Trash2 size={14} /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
