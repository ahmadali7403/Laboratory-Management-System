"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/client";
import { Button, ErrorState, Field, FormError, PageHeader, Spinner, inputClass, useToast } from "@/components/ui";

/** kind: "organization" | "branch" | "platform" */
export default function SettingsForm({ kind, health }) {
  const toast = useToast();
  const [values, setValues] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const endpoint = `/api/settings/${kind}`;

  useEffect(() => { api(endpoint).then(setValues).catch((e) => setError(e.message)); }, [endpoint]);

  const fields = {
    organization: [["name", "Organization name", true], ["email", "Email"], ["phone", "Phone"], ["city", "City"], ["address", "Address", false, true]],
    branch: [["name", "Branch name", true], ["email", "Email"], ["phone", "Phone"], ["city", "City"], ["address", "Address", false, true]],
    platform: [["platformName", "Platform name", true], ["supportEmail", "Support email"], ["defaultCountry", "Default country", true]],
  }[kind];
  const titles = { organization: "Organization Settings", branch: "Branch Settings", platform: "Platform Settings" };

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setFormError("");
    try {
      const body = Object.fromEntries(fields.map(([k]) => [k, values[k] ?? ""]));
      const res = await api(endpoint, { method: "PATCH", body });
      setValues((v) => ({ ...v, ...res }));
      toast.success(res.message || "Settings saved.");
    } catch (err) { setFormError(err.message); } finally { setSaving(false); }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={titles[kind]} description={kind === "platform" ? "Global configuration for the whole platform." : kind === "branch" ? "Contact details shown on this branch's reports and invoices." : "Organization profile and contact details."} />
      {error ? <ErrorState message={error} /> : !values ? <Spinner /> : (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <FormError message={formError} />
          {(kind === "organization" || kind === "branch") && <p className="mb-5 text-xs text-slate-500">Code: <b>{values.code}</b> · Status: <b>{values.status}</b> (changed by your administrator)</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(([k, label, required, wide]) => (
              <Field key={k} label={label} required={required} className={wide ? "sm:col-span-2" : ""}>
                <input value={values[k] ?? ""} required={required} maxLength={300} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} className={inputClass} type={k.toLowerCase().includes("email") ? "email" : "text"} />
              </Field>
            ))}
          </div>
          <div className="mt-6 flex justify-end"><Button type="submit" loading={saving}>Save settings</Button></div>
        </form>
      )}
      {kind === "platform" && health && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Environment check</h2>
          <ul className="space-y-2 text-sm">
            {health.map((h) => <li key={h.label} className="flex items-center gap-2">{h.ok ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-rose-500" />}<span className="text-slate-700">{h.label}</span><span className="text-xs text-slate-400">{h.ok ? "configured" : h.hint}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
