"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Footprints, Plus, Printer, RotateCcw, Search, UserRound, X } from "lucide-react";
import { api, formatMoney } from "@/lib/client";
import { Select, Spinner, useDebounced, useToast } from "@/components/ui";
import { NAME_RE, NAME_MESSAGE, PHONE_MESSAGE, cleanPersonName, cleanPhoneInput, normalizePhone } from "@/lib/validators";

const METHODS = [["CASH", "Cash"], ["CARD", "Card"], ["BANK_TRANSFER", "Bank transfer"], ["ONLINE", "Online"]];
const ic = "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100";
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const EMPTY_WALK = { name: "", gender: "MALE", ageYears: "", phone: "" };

const L = ({ label, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);

/**
 * Counter-style (POS) screen for creating a laboratory order.
 * Everything happens on this one page: patient (registered or walk-in), tests, discount,
 * payment and printing. Shortcuts: F2 = search tests, F8 = save, F9 = save & print (direct print).
 */
export default function PosOrder({ scope }) {
  const toast = useToast();
  const needsPick = scope.role !== "BRANCH_ADMIN" && !scope.branchId;
  const [picked, setPicked] = useState("");
  const branchId = scope.branchId || picked;

  // reference data
  const [testsState, setTestsState] = useState({ branchId: "", items: [] });
  const tests = testsState.branchId === branchId ? testsState.items : [];
  const loadingTests = Boolean(branchId) && testsState.branchId !== branchId;

  // patient (Walk-in Customer by default)
  const [walk, setWalk] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("registered") === "1" ? false : true,
  );
  const [wi, setWi] = useState(EMPTY_WALK);
  const [patientQ, setPatientQ] = useState("");
  const dPatientQ = useDebounced(patientQ, 250);
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // order
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState([]);
  const [testQ, setTestQ] = useState("");
  const [hi, setHi] = useState(0);
  const [category, setCategory] = useState("");
  const [discType, setDiscType] = useState("RS");
  const [discValue, setDiscValue] = useState("");
  const [payTouched, setPayTouched] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState(null);

  const [nowTs] = useState(() => Date.now());
  const testBox = useRef(null);
  const testListRef = useRef(null);

  // ---- load tests for the branch (tests are filtered locally = instant search) ----
  useEffect(() => {
    if (!branchId) return;
    let stop = false;
    (async () => {
      try {
        const url = (page) => `/api/tests?branchId=${branchId}&active=1&light=1&pageSize=100&page=${page}`;
        const first = await api(url(1));
        const pages = Math.min(30, Math.ceil(first.total / 100));
        const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => api(url(i + 2))));
        if (!stop) setTestsState({ branchId, items: [...first.items, ...rest.flatMap((d) => d.items)] });
      } catch {
        if (!stop) setTestsState({ branchId, items: [] });
      }
    })();
    return () => { stop = true; };
  }, [branchId]);

  // ---- patient search ----
  useEffect(() => {
    if (!branchId || walk) return;
    let stop = false;
    api(`/api/patients?branchId=${branchId}&pageSize=30&q=${encodeURIComponent(dPatientQ.trim())}`)
      .then((d) => !stop && setPatients(d.items))
      .catch(() => {})
      .finally(() => !stop && setSearchingPatients(false));
    return () => { stop = true; };
  }, [branchId, dPatientQ, walk]);

  const patientOptions = useMemo(() => {
    const list = branchId && !walk ? patients : [];
    return patient && !list.some((p) => p.id === patient.id) ? [patient, ...list] : list;
  }, [patient, patients, branchId, walk]);

  // ---- tests ----
  const categories = useMemo(() => [...new Set(tests.map((t) => t.category).filter(Boolean))].sort(), [tests]);
  const inCart = useMemo(() => new Set(cart.map((t) => t.id)), [cart]);
  const matches = useMemo(() => {
    const q = testQ.trim().toLowerCase();
    const filtered = tests.filter(
      (t) => (!category || t.category === category) && (!q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)),
    );
    if (q) {
      filtered.sort((a, b) => {
        const ac = a.code.toLowerCase(), bc = b.code.toLowerCase();
        const an = a.name.toLowerCase(), bn = b.name.toLowerCase();
        const score = (c, n) => (c === q ? 0 : c.startsWith(q) ? 1 : n.startsWith(q) ? 2 : 3);
        return score(ac, an) - score(bc, bn);
      });
    }
    return filtered.slice(0, 60);
  }, [tests, testQ, category]);

  const safeHi = matches.length ? Math.min(hi, matches.length - 1) : 0;

  useEffect(() => {
    testListRef.current?.querySelector(`[data-test-idx="${safeHi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [safeHi, matches.length]);

  const addTest = useCallback((t) => setCart((c) => (c.some((x) => x.id === t.id) ? c : [...c, t])), []);
  const toggleTest = useCallback((t) => setCart((c) => (c.some((x) => x.id === t.id) ? c.filter((x) => x.id !== t.id) : [...c, t])), []);
  const removeTest = (id) => setCart((c) => c.filter((x) => x.id !== id));

  // ---- money ----
  const subtotal = round2(cart.reduce((s, t) => s + Number(t.price), 0));
  const discRs = Math.min(subtotal, round2(discType === "PCT" ? (subtotal * Math.min(100, Number(discValue) || 0)) / 100 : Number(discValue) || 0));
  const total = round2(subtotal - discRs);
  // until the cashier types an amount, the full total is taken as paid (usual counter flow)
  const paid = payTouched ? round2(payAmount) : total;
  const balance = round2(Math.max(0, total - paid));
  const change = round2(Math.max(0, paid - total));

  // ---- save ----
  function validate() {
    if (needsPick && !picked) return "Please select a branch.";
    if (walk) {
      const name = wi.name.trim();
      if (name && (name.length < 2 || !NAME_RE.test(name))) return NAME_MESSAGE;
      if (wi.phone && normalizePhone(wi.phone) === undefined) return PHONE_MESSAGE;
    } else if (!patient) return "Please select a patient or switch to walk-in.";
    if (!cart.length) return "Please add at least one test.";
    if (paid > total + 0.001 && payTouched) return "Payment cannot exceed the order total.";
    return "";
  }

  async function save(print) {
    if (saving) return;
    const problem = validate();
    if (problem) { setError(problem); toast.error(problem); return; }
    setSaving(true); setError("");
    try {
      const walkName = wi.name.trim() || "Walk-in Customer";
      const body = {
        ...(walk
          ? { walkIn: { name: walkName, gender: wi.gender, ageYears: wi.ageYears === "" ? null : Number(wi.ageYears), phone: wi.phone || null } }
          : { patientId: patient.id }),
        testIds: cart.map((t) => t.id),
        discount: discRs,
        notes,
        ...(needsPick ? { branchId: picked } : {}),
      };
      if (Math.min(paid, total) > 0) body.payment = { amount: Math.min(paid, total), method, reference: reference || undefined };
      const res = await api("/api/orders", { method: "POST", body });
      toast.success(`Order ${res.orderNo} created.`);
      setLast({ id: res.id, orderNo: res.orderNo, total, balance });
      if (print) printInvoice(res.id);
      reset();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  // Prints the invoice straight from a hidden frame - no new tab, no extra click.
  function printInvoice(id) {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    f.src = `/embed/invoice/${id}`;
    f.onload = () => {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch { window.open(`/embed/invoice/${id}`, "_blank"); }
      setTimeout(() => f.remove(), 60_000);
    };
    document.body.appendChild(f);
  }

  function reset() {
    setCart([]); setPatient(null); setPatientQ(""); setPatients([]); setWi(EMPTY_WALK);
    setWalk(true);
    setNotes(""); setDiscValue(""); setPayTouched(false); setPayAmount(""); setReference("");
    setTestQ(""); setHi(0); setError("");
    setTimeout(() => testBox.current?.focus(), 50);
  }

  // keep the latest handlers reachable from the keyboard listener
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    function onKey(e) {
      if (e.key === "F2") { e.preventDefault(); testBox.current?.focus(); testBox.current?.select(); }
      else if (e.key === "F8") { e.preventDefault(); saveRef.current(false); }
      else if (e.key === "F9") { e.preventDefault(); saveRef.current(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ready = Boolean(branchId);

  return (
    <div className="space-y-1.5">
      {last && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
          <Check size={14} /> <b>{last.orderNo}</b> saved · {formatMoney(last.total)}{last.balance > 0 ? ` · due ${formatMoney(last.balance)}` : ""}
          <button type="button" onClick={() => printInvoice(last.id)} className="ml-1 inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"><Printer size={12} /> Print</button>
          <button type="button" onClick={() => setLast(null)} aria-label="Dismiss" className="ml-auto text-emerald-600 hover:text-emerald-900"><X size={14} /></button>
        </div>
      )}

      {needsPick && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <L label="Branch" className="max-w-xs">
            <select className={ic} value={picked} onChange={(e) => { setPicked(e.target.value); setCart([]); setPatient(null); }}>
              <option value="">Select a branch</option>
              {scope.branches.map((b) => <option key={b.id} value={b.id}>{scope.role === "SUPER_ADMIN" && !scope.organizationId ? `${b.organizationName} — ${b.name}` : b.name}</option>)}
            </select>
          </L>
        </div>
      )}

      <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_310px]">
        {/* ---------------- left: patient + tests ---------------- */}
        <div className="min-w-0 space-y-1.5">
          <section className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold">
                <button type="button" onClick={() => { setWalk(true); setPatient(null); }} className={`flex items-center gap-1 rounded px-2.5 py-1 ${walk ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><Footprints size={12} /> Walk-in (Default)</button>
                <button type="button" onClick={() => setWalk(false)} className={`flex items-center gap-1 rounded px-2.5 py-1 ${!walk ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><UserRound size={12} /> Registered</button>
              </div>
              <Link href="/patients?new=1" className="text-[11px] font-semibold text-blue-600 hover:underline">+ Register new patient</Link>
            </div>

            {walk ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                <L label="Patient name (optional)" className="col-span-2 sm:col-span-4"><input className={ic} value={wi.name} maxLength={120} placeholder="Walk-in Customer" disabled={!ready} onChange={(e) => setWi({ ...wi, name: cleanPersonName(e.target.value) })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); testBox.current?.focus(); } }} /></L>
                <L label="Phone" className="col-span-2 sm:col-span-4"><input className={ic} inputMode="numeric" value={wi.phone} maxLength={16} placeholder="03XXXXXXXXX" disabled={!ready} onChange={(e) => setWi({ ...wi, phone: cleanPhoneInput(e.target.value) })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); testBox.current?.focus(); } }} /></L>
                <L label="Age" className="sm:col-span-2"><input className={ic} type="number" min="0" max="120" value={wi.ageYears} disabled={!ready} onChange={(e) => setWi({ ...wi, ageYears: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); testBox.current?.focus(); } }} /></L>
                <L label="Gender" className="sm:col-span-2"><select className={ic} value={wi.gender} disabled={!ready} onChange={(e) => setWi({ ...wi, gender: e.target.value })}><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></L>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Select value={patient?.id || ""} onChange={(e) => { const p = patientOptions.find((x) => x.id === e.target.value) || null; setPatient(p); if (p) setWalk(false); }} onSearch={setPatientQ} className={ic} disabled={!ready}>
                  <option value="">Select patient (type name, MRN or phone)...</option>
                  {patientOptions.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}{p.phone ? ` · ${p.phone}` : ""}</option>)}
                </Select>
                {patient && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] text-slate-700">
                    <p><b className="text-slate-800">{patient.name}</b> · {patient.mrn} · {patient.gender}{patient.dateOfBirth ? ` · ${Math.max(0, Math.floor((nowTs - new Date(patient.dateOfBirth)) / 3.156e10))}y` : ""}{patient.phone ? ` · ${patient.phone}` : ""}</p>
                    <button type="button" onClick={() => { setPatient(null); setWalk(true); }} className="shrink-0 font-semibold text-blue-700 hover:underline">Restore Walk-in</button>
                  </div>
                )}
              </div>
            )}

          </section>

          <div className="grid gap-1.5 md:grid-cols-2">
            <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  ref={testBox}
                  autoFocus
                  className={`${ic} pl-8`}
                  placeholder="Search test / scan code — ↑↓ navigate, Enter adds"
                  value={testQ}
                  disabled={!ready}
                  onChange={(e) => { setTestQ(e.target.value); setHi(0); }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHi((i) => Math.min(Math.max(0, matches.length - 1), i + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHi((i) => Math.max(0, i - 1));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const chosen = matches[safeHi] || matches[0];
                      if (chosen) {
                        addTest(chosen);
                        setTestQ("");
                        setHi(0);
                        testBox.current?.focus();
                      }
                    } else if (e.key === "Escape" && testQ) {
                      e.preventDefault();
                      setTestQ("");
                      setHi(0);
                    }
                  }}
                />
              </div>
              {categories.length > 0 && (
                <div className="mt-1 flex max-h-14 flex-wrap gap-1 overflow-y-auto">
                  <button type="button" onClick={() => { setCategory(""); setHi(0); }} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${!category ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All</button>
                  {categories.map((c) => (
                    <button key={c} type="button" onClick={() => { setCategory(category === c ? "" : c); setHi(0); }} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${category === c ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{c}</button>
                  ))}
                </div>
              )}
              <div ref={testListRef} className="mt-1.5 max-h-[calc(100vh-250px)] min-h-[260px] overflow-y-auto rounded-md border border-slate-200">
                {!ready ? <p className="p-4 text-center text-xs text-slate-400">Select a branch first.</p>
                  : loadingTests ? <div className="p-4"><Spinner /></div>
                  : matches.length === 0 ? <p className="p-4 text-center text-xs text-slate-400">No tests found.</p>
                  : (
                    <table className="w-full text-[13px]">
                      <tbody className="divide-y divide-slate-100">
                        {matches.map((t, idx) => {
                          const added = inCart.has(t.id);
                          const active = idx === safeHi;
                          return (
                            <tr
                              key={t.id}
                              data-test-idx={idx}
                              onMouseEnter={() => setHi(idx)}
                              onClick={() => { toggleTest(t); testBox.current?.focus(); }}
                              title={added ? "Click to unselect" : "Click to select"}
                              className={`cursor-pointer transition-colors ${active ? (added ? "bg-emerald-100 ring-2 ring-inset ring-blue-500" : "bg-blue-100 ring-2 ring-inset ring-blue-500") : added ? "bg-emerald-50 hover:bg-rose-50" : "hover:bg-blue-50"}`}
                            >
                              <td className="w-16 px-2 py-1 font-mono text-[11px] text-slate-500">{t.code}</td>
                              <td className="px-2 py-1 font-medium text-slate-800">{t.name}</td>
                              <td className="w-20 px-2 py-1 text-right font-semibold text-slate-700">{formatMoney(t.price)}</td>
                              <td className="w-7 px-1 text-center">{added ? <Check size={14} className="inline text-emerald-600" /> : <Plus size={14} className="inline text-blue-600" />}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
              </div>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                <span><kbd className="rounded bg-slate-100 px-1 font-mono text-slate-600">↑/↓</kbd> Navigate</span>
                <span><kbd className="rounded bg-slate-100 px-1 font-mono text-slate-600">Enter</kbd> Add</span>
                <span><kbd className="rounded bg-slate-100 px-1 font-mono text-slate-600">F2</kbd> Search</span>
                <span><kbd className="rounded bg-slate-100 px-1 font-mono text-slate-600">F8</kbd> Save</span>
                <span><kbd className="rounded bg-slate-100 px-1 font-mono text-slate-600">F9</kbd> Save &amp; Print</span>
              </p>
            </section>

            <section className="min-w-0 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">Selected tests ({cart.length})</h2>
                {cart.length > 0 && <button type="button" onClick={() => setCart([])} className="text-[11px] font-semibold text-rose-600 hover:underline">Unselect all</button>}
              </div>
              <div className="max-h-[calc(100vh-190px)] min-h-[300px] overflow-y-auto">
                {cart.length === 0 ? <p className="p-4 text-center text-xs text-slate-400">No tests selected.</p> : (
                  <table className="w-full text-[13px]">
                    <tbody className="divide-y divide-slate-100">
                      {cart.map((t, i) => (
                        <tr key={t.id}>
                          <td className="w-7 px-2 py-1 text-[11px] text-slate-400">{i + 1}</td>
                          <td className="px-2 py-1"><span className="font-medium text-slate-800">{t.name}</span> <span className="text-[11px] text-slate-400">{t.code}</span></td>
                          <td className="w-20 px-2 py-1 text-right font-semibold text-slate-700">{formatMoney(t.price)}</td>
                          <td className="w-8 px-1 text-center"><button type="button" onClick={() => removeTest(t.id)} aria-label={`Unselect ${t.name}`} title="Unselect" className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* ---------------- right: bill ---------------- */}
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">Bill</h2>
            <div className="space-y-0.5 text-[13px]">
              <Row l="Subtotal" v={formatMoney(subtotal)} />
              <Row l="Discount" v={`- ${formatMoney(discRs)}`} />
              <div className="mt-1 border-t border-slate-200 pt-1"><Row l="Total" v={formatMoney(total)} big /></div>
            </div>

            <div className="grid grid-cols-[1fr_74px] gap-2">
              <L label="Discount"><input className={ic} type="number" min="0" step="any" value={discValue} onChange={(e) => setDiscValue(e.target.value)} /></L>
              <L label="Type"><select className={ic} value={discType} onChange={(e) => setDiscType(e.target.value)}><option value="RS">Rs</option><option value="PCT">%</option></select></L>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <L label="Received (Rs)"><input className={ic} type="number" min="0" step="any" value={payTouched ? payAmount : String(total || "")} onChange={(e) => { setPayTouched(true); setPayAmount(e.target.value); }} /></L>
              <L label="Method"><select className={ic} value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></L>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => { setPayTouched(false); setPayAmount(""); }} className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Full</button>
              <button type="button" onClick={() => { setPayTouched(true); setPayAmount("0"); }} className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Pay later</button>
            </div>
            {method !== "CASH" && <L label="Reference"><input className={ic} value={reference} maxLength={100} placeholder="Transaction / slip no." onChange={(e) => setReference(e.target.value)} /></L>}

            <div className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[13px]">
              <Row l="Balance due" v={formatMoney(balance)} danger={balance > 0} />
              {change > 0 && <Row l="Change to return" v={formatMoney(change)} />}
            </div>

            <L label="Notes"><textarea className={`${ic} h-12 py-1`} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} /></L>

            {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">{error}</p>}

            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={saving || !ready} onClick={() => save(false)} className="h-9 rounded-md bg-blue-600 text-[13px] font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : "Save (F8)"}</button>
              <button type="button" disabled={saving || !ready} onClick={() => save(true)} className="flex h-9 items-center justify-center gap-1 rounded-md bg-emerald-600 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><Printer size={14} /> Print (F9)</button>
            </div>
            <button type="button" disabled={saving} onClick={reset} className="flex w-full items-center justify-center gap-1 rounded-md border border-slate-300 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RotateCcw size={12} /> Clear form</button>
          </section>
        </aside>
      </div>
    </div>
  );
}

const Row = ({ l, v, big, danger }) => (
  <div className={`flex justify-between py-0.5 ${big ? "text-base font-extrabold text-slate-900" : danger ? "font-bold text-rose-600" : "text-slate-600"}`}>
    <span>{l}</span><span>{v}</span>
  </div>
);
