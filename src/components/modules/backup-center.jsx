"use client";

import { DatabaseBackup, Download, Upload } from "lucide-react";
import { Button, PageHeader, useToast } from "@/components/ui";
import { downloadBackup, useRestorePicker } from "@/components/data-tools";

const SECTIONS = [
  ["tests", "Test catalog", "Tests and all their parameters"],
  ["suppliers", "Suppliers", "Supplier directory"],
  ["patients", "Patients", "Registered and walk-in patients"],
  ["inventory", "Inventory", "Stock items and levels"],
  ["orders", "Orders & reports", "Orders, samples, results, payments"],
  ["expenses", "Expenses", "All recorded expenses"],
  ["purchases", "Purchases", "Purchases and received stock"],
];

export default function BackupCenter({ scope, scopeLabel }) {
  const toast = useToast();
  const restore = useRestorePicker();
  const noOrg = !scope.organizationId;
  const isSuper = scope.role === "SUPER_ADMIN";
  const get = (module) => (noOrg && !isSuper ? toast.error("No organization selected.") : noOrg ? toast.error("Select an organization in the top bar, or use “All organizations”.") : downloadBackup(module));

  return (
    <div>
      <PageHeader title="Backup & Restore" description={`Scope: ${scopeLabel}`} />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><DatabaseBackup size={22} /></span>
          <h2 className="font-semibold text-slate-900">Complete backup</h2>
          <p className="mt-1 text-sm text-slate-500">Downloads every section below in one JSON file.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => get("all")}><Download size={15} /> Download complete backup</Button>
            {isSuper && noOrg && <Button variant="secondary" onClick={() => downloadBackup("all", true)}><Download size={15} /> All organizations</Button>}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Upload size={22} /></span>
          <h2 className="font-semibold text-slate-900">Restore</h2>
          <p className="mt-1 text-sm text-slate-500">Choose a LabOS backup file. You can add only missing records or overwrite existing ones.</p>
          <div className="mt-4"><Button variant="secondary" onClick={restore.pick}><Upload size={15} /> Choose backup file</Button></div>
        </section>
      </div>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Backup a single section</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map(([key, title, hint]) => (
          <button key={key} onClick={() => get(key)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300">
            <p className="flex items-center justify-between text-sm font-semibold text-slate-800">{title}<Download size={14} className="text-slate-400" /></p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </button>
        ))}
      </div>
      {restore.picker}
      {restore.dialog}
    </div>
  );
}
