"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Check, Clock, Footprints, HelpCircle, Moon, Plus, Printer, RotateCcw, Sun, Trash2, UserRound, X, Zap } from "lucide-react";
import { api, formatMoney } from "@/lib/client";
import { Select, Spinner, useDebounced, useToast } from "@/components/ui";
import { NAME_RE, NAME_MESSAGE, PHONE_MESSAGE, cleanPersonName, cleanPhoneInput, normalizePhone } from "@/lib/validators";
import { createScannerDetector } from "@/lib/shortcuts";
import { holdBill, loadHeldBills, removeHeldBill } from "@/lib/pos-hold";
import { usePosKeyboard } from "@/lib/use-pos-keyboard";
import { usePosTheme } from "@/lib/use-pos-theme";
import { fetchTestCatalog, loadPosCatalog, searchTestsLocal } from "@/lib/pos-cache";
import { printLabReceipt } from "@/lib/fast-print";
import VirtualRows from "@/components/virtual-rows";
import { KeyBadge, ShortcutBar } from "@/components/shortcut-bar";
import SearchBar from "@/components/pos/SearchBar";
import CartPanel from "@/components/pos/CartPanel";
import TotalsCard from "@/components/pos/TotalsCard";
import PaymentChips from "@/components/pos/PaymentChips";

const HeldBillsModal = dynamic(() => import("@/components/held-bills-modal"), { ssr: false });
const PinOverrideModal = dynamic(() => import("@/components/pos/PinOverrideModal"), { ssr: false });

const METHODS = [["CASH", "Cash"], ["CARD", "Card"], ["JAZZCASH", "JazzCash"], ["EASYPAISA", "EasyPaisa"], ["BANK_TRANSFER", "Bank"], ["ONLINE", "Online"]];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const EMPTY_WALK = { name: "", gender: "MALE", ageYears: "", phone: "" };

/**
 * Zero-scroll 3-zone Laboratory POS screen matching Pharmacy POS architecture.
 */
export default function PosOrder({ scope }) {
  const toast = useToast();
  const { theme, isDark, toggleTheme } = usePosTheme();
  const limits = scope.roleLimits || { maxDiscountPct: 100, allowedMethods: [], canDiscount: true };
  const allowedMethods = useMemo(
    () => (limits.allowedMethods?.length ? METHODS.filter(([v]) => limits.allowedMethods.includes(v)) : METHODS),
    [limits.allowedMethods],
  );
  const allowedMethodValues = useMemo(() => allowedMethods.map(([v]) => v), [allowedMethods]);
  const needsPick = scope.role !== "BRANCH_ADMIN" && !scope.branchId;
  const [picked, setPicked] = useState("");
  const branchId = scope.branchId || picked;

  const [testsState, setTestsState] = useState({ branchId: "", items: [], syncing: false });
  const tests = useMemo(() => (testsState.branchId === branchId ? testsState.items : []), [testsState, branchId]);
  const loadingTests = Boolean(branchId) && testsState.branchId !== branchId;

  const [walk, setWalk] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("registered") === "1" ? false : true,
  );
  const [wi, setWi] = useState(EMPTY_WALK);
  const [patientQ, setPatientQ] = useState("");
  const dPatientQ = useDebounced(patientQ, 220);
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);

  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [cartIdx, setCartIdx] = useState(0);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [heldBills, setHeldBills] = useState([]);
  const [testQ, setTestQ] = useState("");
  const deferredTestQ = useDeferredValue(testQ);
  const [hi, setHi] = useState(0);
  const [category, setCategory] = useState("");
  const [discType, setDiscType] = useState("RS");
  const [discValue, setDiscValue] = useState("");
  const [payTouched, setPayTouched] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [method, setMethod] = useState(() => (limits.allowedMethods?.length ? limits.allowedMethods[0] : "CASH"));
  const [pinModal, setPinModal] = useState(null);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState(null);

  const testBox = useRef(null);
  const walkNameRef = useRef(null);
  const patientToggleRef = useRef(null);
  const discountRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => setHeldBills(loadHeldBills("lab", branchId)), 0);
    return () => clearTimeout(id);
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    const ctrl = new AbortController();
    loadPosCatalog("tests", branchId, fetchTestCatalog, {
      signal: ctrl.signal,
      onUpdate: (items, meta) => {
        if (!ctrl.signal.aborted) {
          setTestsState({ branchId, items, syncing: Boolean(meta?.syncing) });
        }
      },
    });
    return () => ctrl.abort();
  }, [branchId]);

  useEffect(() => {
    if (!branchId || walk) return;
    let stop = false;
    api(`/api/patients?branchId=${branchId}&pageSize=30&q=${encodeURIComponent(dPatientQ.trim())}`)
      .then((d) => !stop && setPatients(d.items || []))
      .catch(() => {});
    return () => { stop = true; };
  }, [branchId, dPatientQ, walk]);

  const patientOptions = useMemo(() => {
    const list = branchId && !walk ? patients : [];
    return patient && !list.some((p) => p.id === patient.id) ? [patient, ...list] : list;
  }, [patient, patients, branchId, walk]);

  const categories = useMemo(() => [...new Set(tests.map((t) => t.category).filter(Boolean))].sort(), [tests]);
  const quickTests = useMemo(() => tests.slice(0, 6), [tests]);
  const inCart = useMemo(() => new Set(cart.map((t) => t.id)), [cart]);
  const matches = useMemo(
    () => searchTestsLocal(tests, deferredTestQ, category, 200),
    [tests, deferredTestQ, category],
  );
  const safeHi = matches.length ? Math.min(hi, matches.length - 1) : 0;

  const pushUndo = useCallback((snapshot) => {
    setUndoStack((u) => [snapshot, ...u].slice(0, 15));
  }, []);

  const addTest = useCallback((t) => {
    setCart((c) => {
      if (c.some((x) => x.id === t.id)) return c;
      pushUndo(c);
      setCartIdx(c.length);
      return [...c, t];
    });
  }, [pushUndo]);

  const toggleTest = useCallback((t) => {
    setCart((c) => {
      pushUndo(c);
      if (c.some((x) => x.id === t.id)) return c.filter((x) => x.id !== t.id);
      setCartIdx(c.length);
      return [...c, t];
    });
  }, [pushUndo]);

  const removeTest = (id) => setCart((c) => {
    pushUndo(c);
    const next = c.filter((x) => x.id !== id);
    setCartIdx((i) => Math.max(0, Math.min(i, next.length - 1)));
    return next;
  });

  function handleUndo() {
    setUndoStack((u) => {
      if (!u.length) return u;
      const [latest, ...rest] = u;
      setCart(latest);
      setCartIdx((i) => Math.max(0, Math.min(i, latest.length - 1)));
      toast.info("Undid last test change.");
      return rest;
    });
    setTimeout(() => testBox.current?.focus(), 0);
  }

  const subtotal = round2(cart.reduce((s, t) => s + Number(t.price), 0));
  const discRs = Math.min(subtotal, round2(discType === "PCT" ? (subtotal * Math.min(100, Number(discValue) || 0)) / 100 : Number(discValue) || 0));
  const total = round2(subtotal - discRs);
  const paid = payTouched ? round2(payAmount) : total;
  const balance = round2(Math.max(0, total - paid));
  const change = round2(Math.max(0, paid - total));

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

  function printA4Invoice(id) {
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
    setCart([]);
    setUndoStack([]);
    setPatient(null);
    setPatientQ("");
    setPatients([]);
    setWi(EMPTY_WALK);
    setWalk(true);
    setNotes("");
    setDiscValue("");
    setPayTouched(false);
    setPayAmount("");
    setReference("");
    setTestQ("");
    setHi(0);
    setError("");
    setTimeout(() => testBox.current?.focus(), 40);
  }

  async function save(print, overridePin = undefined) {
    if (saving) return;
    const problem = validate();
    if (problem) { setError(problem); toast.error(problem); return; }
    const discPct = subtotal > 0 ? round2((discRs / subtotal) * 100) : 0;
    if (scope.isStaff && discRs > 0 && !overridePin) {
      if (!limits.canDiscount || discPct > Number(limits.maxDiscountPct ?? 100) + 0.01) {
        setPinModal({ print });
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const walkName = wi.name.trim() || "Walk-in Customer";
      const body = {
        ...(walk
          ? { walkIn: { name: walkName, gender: wi.gender, ageYears: wi.ageYears === "" ? null : Number(wi.ageYears), phone: wi.phone || null } }
          : { patientId: patient.id }),
        testIds: cart.map((t) => t.id),
        discount: discRs,
        notes,
        ...(overridePin ? { overridePin } : {}),
        ...(needsPick ? { branchId: picked } : {}),
      };
      if (Math.min(paid, total) > 0) body.payment = { amount: Math.min(paid, total), method, reference: reference || undefined };
      const res = await api("/api/orders", { method: "POST", body });
      toast.success(`Order ${res.orderNo} created.`);
      const activeBranch = scope.branches?.find((b) => b.id === branchId);
      setLast({ id: res.id, orderNo: res.orderNo, total, balance });
      if (print) {
        printLabReceipt({
          orgName: activeBranch?.organizationName || "Diagnostic Laboratory",
          branchName: activeBranch?.name || "",
          orderNo: res.orderNo,
          patientName: walk ? walkName : patient?.name || "Registered Patient",
          phone: walk ? wi.phone : patient?.phone || "",
          items: cart,
          subtotal,
          discount: discRs,
          total,
          paidAmount: Math.min(paid, total),
          balance,
          paymentMethod: method,
        });
      }
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleHoldCurrent() {
    if (!branchId || !cart.length) return;
    const label = !walk && patient ? patient.name : wi.name.trim() || "Walk-in Customer";
    const next = holdBill("lab", branchId, {
      label,
      itemCount: cart.length,
      total,
      payload: { cart, walk, wi, patient, discType, discValue, method, notes },
    });
    setHeldBills(next);
    setHoldModalOpen(false);
    toast.success(`Held order for ${label}.`);
    reset();
  }

  function handleResumeBill(bill) {
    const p = bill.payload || {};
    setCart(Array.isArray(p.cart) ? p.cart : []);
    setWalk(p.walk ?? true);
    setWi(p.wi || EMPTY_WALK);
    setPatient(p.patient || null);
    setDiscType(p.discType || "RS");
    setDiscValue(p.discValue || "");
    setMethod(p.method || "CASH");
    setNotes(p.notes || "");
    setUndoStack([]);
    setCartIdx(0);
    setHeldBills(removeHeldBill("lab", branchId, bill.id));
    setHoldModalOpen(false);
    toast.success("Resumed held lab bill.");
    setTimeout(() => testBox.current?.focus(), 30);
  }

  usePosKeyboard({
    onNewSale: reset,
    onFocusSearch: () => { testBox.current?.focus(); testBox.current?.select?.(); },
    onFocusCustomer: () => {
      if (walk && walkNameRef.current) {
        walkNameRef.current.focus();
        walkNameRef.current.select?.();
      } else {
        patientToggleRef.current?.focus();
      }
    },
    onHoldOrResume: () => {
      if (!branchId) return;
      if (cart.length > 0 && heldBills.length === 0) handleHoldCurrent();
      else setHoldModalOpen(true);
    },
    onFocusDiscount: () => { discountRef.current?.focus(); discountRef.current?.select?.(); },
    onCycleMethod: () => {
      const idx = allowedMethodValues.indexOf(method);
      setMethod(allowedMethodValues[(idx + 1) % allowedMethodValues.length]);
    },
    onSaveAndPrint: () => save(true),
    onSaveOnly: () => save(false),
    onRemoveSelected: () => {
      if (cart.length > 0 && cart[cartIdx]) removeTest(cart[cartIdx].id);
    },
    onUndo: handleUndo,
    onEscape: () => {
      if (testQ) { setTestQ(""); setHi(0); }
      else testBox.current?.focus();
    },
  });

  const ready = Boolean(branchId);

  return (
    <div
      data-pos-theme={theme}
      className="pos-theme flex h-full min-h-0 w-full flex-col overflow-hidden"
    >
      {/* Top Compact Patient & Controls Bar */}
      <header className="pos-surface flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-blue-500">
            Lab POS
          </span>

          {needsPick && (
            <select
              className="pos-input h-7 rounded-md border px-2 text-xs font-semibold"
              value={picked}
              onChange={(e) => { setPicked(e.target.value); setCart([]); setPatient(null); }}
              aria-label="Branch"
            >
              <option value="">Select branch...</option>
              {scope.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {scope.role === "SUPER_ADMIN" && !scope.organizationId ? `${b.organizationName} — ${b.name}` : b.name}
                </option>
              ))}
            </select>
          )}

          <div className="pos-surface-alt inline-flex rounded-md border p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => { setWalk(true); setPatient(null); }}
              className={`flex items-center gap-1 rounded px-2 py-0.5 transition ${walk ? "bg-blue-600 text-white shadow-sm" : "opacity-70 hover:opacity-100"}`}
            >
              <Footprints size={11} /> Walk-in
            </button>
            <button
              ref={patientToggleRef}
              type="button"
              onClick={() => setWalk(false)}
              className={`flex items-center gap-1 rounded px-2 py-0.5 transition ${!walk ? "bg-blue-600 text-white shadow-sm" : "opacity-70 hover:opacity-100"}`}
            >
              <UserRound size={11} /> Registered <KeyBadge dark={isDark}>F4</KeyBadge>
            </button>
          </div>

          {walk ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                ref={walkNameRef}
                className="pos-input h-7 w-36 rounded border px-2 text-xs outline-none focus:border-blue-500"
                value={wi.name}
                maxLength={120}
                placeholder="Walk-in Customer"
                disabled={!ready}
                onChange={(e) => setWi({ ...wi, name: cleanPersonName(e.target.value) })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); testBox.current?.focus(); } }}
              />
              <input
                className="pos-input hidden h-7 w-28 rounded border px-2 text-xs outline-none focus:border-blue-500 sm:block"
                inputMode="numeric"
                value={wi.phone}
                maxLength={16}
                placeholder="03XXXXXXXXX"
                disabled={!ready}
                onChange={(e) => setWi({ ...wi, phone: cleanPhoneInput(e.target.value) })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); testBox.current?.focus(); } }}
              />
              <input
                className="pos-input hidden h-7 w-14 rounded border px-1.5 text-center text-xs outline-none focus:border-blue-500 md:block"
                type="number"
                min="0"
                max="120"
                placeholder="Age"
                value={wi.ageYears}
                disabled={!ready}
                onChange={(e) => setWi({ ...wi, ageYears: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); testBox.current?.focus(); } }}
              />
              <select
                className="pos-input hidden h-7 rounded border px-1.5 text-xs outline-none focus:border-blue-500 md:block"
                value={wi.gender}
                disabled={!ready}
                aria-label="Gender"
                onChange={(e) => setWi({ ...wi, gender: e.target.value })}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-56">
                <Select
                  value={patient?.id || ""}
                  onChange={(e) => { const p = patientOptions.find((x) => x.id === e.target.value) || null; setPatient(p); if (p) setWalk(false); }}
                  onSearch={setPatientQ}
                  className="!h-7 !text-xs"
                  disabled={!ready}
                >
                  <option value="">Search patient (name, MRN, phone)...</option>
                  {patientOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.mrn}{p.phone ? ` · ${p.phone}` : ""}</option>
                  ))}
                </Select>
              </div>
              <button
                type="button"
                onClick={() => { setPatient(null); setWalk(true); }}
                className="text-[11px] font-semibold text-blue-500 hover:underline"
              >
                Walk-in
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          {last && (
            <div className="hidden items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-500 xl:flex">
              <Check size={12} />
              <span className="font-bold">{last.orderNo}</span>
              <span className="tabular-nums">{formatMoney(last.total)}</span>
              <button type="button" onClick={() => printA4Invoice(last.id)} className="underline hover:opacity-80">A4</button>
              <button type="button" onClick={() => setLast(null)} aria-label="Dismiss"><X size={12} /></button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setHoldModalOpen(true)}
            className="pos-surface-alt inline-flex h-7 items-center gap-1 rounded-md border px-2 font-semibold hover:opacity-80"
          >
            <Clock size={12} /> Held ({heldBills.length}) <KeyBadge dark={isDark}>F5</KeyBadge>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="pos-surface-alt inline-flex h-7 w-7 items-center justify-center rounded-md border hover:opacity-80"
          >
            {isDark ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} />}
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("labos:help"))}
            title="Shortcuts Help (F1)"
            className="pos-surface-alt inline-flex h-7 items-center gap-1 rounded-md border px-2 font-semibold hover:opacity-80"
          >
            <HelpCircle size={12} /> <KeyBadge dark={isDark}>F1</KeyBadge>
          </button>
          <Link href="/orders" className="hidden font-semibold hover:text-blue-500 md:inline" style={{ color: "var(--pos-muted)" }}>
            Orders
          </Link>
        </div>
      </header>

      {/* Main 3-Zone Workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 lg:grid-cols-[minmax(0,1.62fr)_minmax(345px,1fr)]">
        {/* Left Zone: Search + Quick Categories/Cards + Virtualized Tests Grid */}
        <section className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-hidden">
          <SearchBar
            inputRef={testBox}
            value={testQ}
            disabled={!ready}
            syncing={testsState.syncing}
            dark={isDark}
            countText={matches.length > 0 ? `${matches.length} tests` : ""}
            ariaLabel="Search lab test"
            onChange={(e) => { setTestQ(e.target.value); setHi(0); }}
            onKeyDown={(e) => {
              if (!scannerRef.current) scannerRef.current = createScannerDetector();
              scannerRef.current.recordKey(e.key);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((i) => Math.min(Math.max(0, matches.length - 1), i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                scannerRef.current.consumeScanEnter();
                const chosen = matches[safeHi] || matches[0];
                if (chosen) {
                  addTest(chosen);
                  setTestQ("");
                  setHi(0);
                  testBox.current?.focus();
                }
              } else if (e.key === "Escape" && testQ) {
                e.preventDefault();
                scannerRef.current.reset();
                setTestQ("");
                setHi(0);
              }
            }}
            onClear={() => { setTestQ(""); setHi(0); testBox.current?.focus(); }}
            placeholder="Search test name or code — ↑↓ navigate, Enter adds"
          />

          {categories.length > 0 && (
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => { setCategory(""); setHi(0); testBox.current?.focus(); }}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                  !category ? "bg-blue-600 text-white" : isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({tests.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  tabIndex={-1}
                  onClick={() => { setCategory(category === c ? "" : c); setHi(0); testBox.current?.focus(); }}
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                    category === c ? "bg-blue-600 text-white" : isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {!testQ.trim() && !category && quickTests.length > 0 && (
            <div className="hidden shrink-0 grid-cols-3 gap-1.5 xl:grid">
              {quickTests.map((t) => {
                const added = inCart.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => { toggleTest(t); testBox.current?.focus(); }}
                    style={{ backgroundColor: added ? "var(--pos-row-added)" : undefined }}
                    className={`pos-surface-alt flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-left transition ${
                      added ? "border-emerald-500" : "hover:border-blue-500"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate text-[11.5px] font-semibold">
                        <Zap size={10} className="shrink-0 text-blue-500" />
                        <span className="truncate">{t.name}</span>
                      </p>
                      <p className="truncate font-mono text-[10px]" style={{ color: "var(--pos-muted)" }}>
                        {t.code} · {t.sampleType}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-emerald-500">
                      {formatMoney(t.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="pos-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
            {!ready ? (
              <p className="p-4 text-center text-xs" style={{ color: "var(--pos-muted)" }}>Select a branch first.</p>
            ) : loadingTests && tests.length === 0 ? (
              <div className="p-4"><Spinner /></div>
            ) : matches.length === 0 ? (
              <p className="p-4 text-center text-xs" style={{ color: "var(--pos-muted)" }}>No tests found.</p>
            ) : (
              <>
                <div
                  className="pos-surface-alt grid shrink-0 grid-cols-[5rem_1fr_6rem_5.25rem_2.25rem] border-b px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--pos-muted)" }}
                >
                  <span>Code</span>
                  <span>Test / Panel</span>
                  <span>Sample</span>
                  <span className="text-right">Fee</span>
                  <span className="text-right">Add</span>
                </div>
                <VirtualRows
                  items={matches}
                  rowHeight={40}
                  scrollToIndex={safeHi}
                  renderRow={(t, idx) => {
                    const added = inCart.has(t.id);
                    const active = idx === safeHi;
                    return (
                      <div
                        role="button"
                        tabIndex={-1}
                        data-test-idx={idx}
                        onMouseEnter={() => setHi(idx)}
                        onClick={() => { toggleTest(t); testBox.current?.focus(); }}
                        title={added ? "Click to unselect" : "Click to select"}
                        style={{
                          borderColor: "var(--pos-border)",
                          backgroundColor: active ? "var(--pos-row-active)" : added ? "var(--pos-row-added)" : undefined,
                        }}
                        className={`grid h-10 grid-cols-[5rem_1fr_6rem_5.25rem_2.25rem] cursor-pointer items-center border-b px-2.5 text-[12.5px] transition-colors ${
                          active ? "ring-2 ring-inset ring-blue-500" : "hover:bg-blue-500/5"
                        }`}
                      >
                        <span className="truncate font-mono text-[11px]" style={{ color: "var(--pos-muted)" }}>{t.code}</span>
                        <span className="truncate pr-2 font-semibold">{t.name}</span>
                        <span className="truncate text-[11px]" style={{ color: "var(--pos-muted)" }}>{t.sampleType || "Blood"}</span>
                        <span className="text-right font-bold tabular-nums">{formatMoney(t.price)}</span>
                        <span className="text-right">
                          {added ? <Check size={14} className="inline text-emerald-500" /> : <Plus size={14} className="inline text-blue-500" />}
                        </span>
                      </div>
                    );
                  }}
                />
              </>
            )}
          </div>
        </section>

        {/* Right Zone: Cart + Totals + Payment Chips + Actions */}
        <aside className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-hidden">
          <CartPanel
            title="Selected Tests"
            count={cart.length}
            canUndo={undoStack.length > 0}
            onUndo={handleUndo}
            onClear={reset}
            dark={isDark}
          >
            {cart.length === 0 ? (
              <div className="flex h-full min-h-[120px] flex-col items-center justify-center p-4 text-center text-xs" style={{ color: "var(--pos-muted)" }}>
                <p className="font-semibold" style={{ color: "var(--pos-text)" }}>No tests selected</p>
                <p className="mt-1">Search tests on the left and press <kbd className="rounded border px-1 font-mono text-[10px]">Enter</kbd></p>
              </div>
            ) : (
              <table className="w-full text-left text-[12px]">
                <thead
                  className="pos-surface-alt sticky top-0 z-10 border-b text-[10px] font-bold uppercase"
                  style={{ color: "var(--pos-muted)" }}
                >
                  <tr>
                    <th className="w-6 px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Test</th>
                    <th className="w-20 px-2 py-1.5 text-right">Fee</th>
                    <th className="w-7 px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--pos-border)" }}>
                  {cart.map((t, i) => (
                    <tr
                      key={t.id}
                      onClick={() => setCartIdx(i)}
                      style={{
                        borderColor: "var(--pos-border)",
                        backgroundColor: i === cartIdx ? "var(--pos-row-active)" : undefined,
                      }}
                    >
                      <td className="px-2 py-1.5 text-[10.5px]" style={{ color: "var(--pos-muted)" }}>{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <p className="font-semibold leading-tight">{t.name}</p>
                        <p className="font-mono text-[10px]" style={{ color: "var(--pos-muted)" }}>{t.code} · {t.sampleType}</p>
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums">{formatMoney(t.price)}</td>
                      <td className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => removeTest(t.id)}
                          aria-label={`Remove ${t.name}`}
                          className="rounded p-1 text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CartPanel>

          <section className="pos-surface flex shrink-0 flex-col gap-2 rounded-lg border p-2.5 shadow-sm">
            <TotalsCard
              subtotal={subtotal}
              discRs={discRs}
              total={total}
              discType={discType}
              discValue={discValue}
              onDiscTypeChange={setDiscType}
              onDiscValueChange={setDiscValue}
              discountRef={discountRef}
              payTouched={payTouched}
              payAmount={payAmount}
              onPayAmountChange={(v) => { setPayTouched(true); setPayAmount(v); }}
              onPayFull={() => { setPayTouched(false); setPayAmount(""); }}
              onPayZero={() => { setPayTouched(true); setPayAmount("0"); }}
              balance={balance}
              change={change}
              onEnterComplete={() => save(true)}
              ready={ready}
              dark={isDark}
              canDiscount={limits.canDiscount}
              maxDiscountPct={limits.maxDiscountPct}
            />

            <PaymentChips
              methods={allowedMethods}
              value={method}
              onChange={setMethod}
              disabled={!ready}
              dark={isDark}
            />

            {method !== "CASH" && (
              <input
                className="pos-input h-7 w-full rounded border px-2 text-xs outline-none focus:border-blue-500"
                value={reference}
                maxLength={100}
                disabled={!ready}
                placeholder="Transaction / Slip Reference #"
                onChange={(e) => setReference(e.target.value)}
              />
            )}

            {error && (
              <p className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-500">
                {error}
              </p>
            )}

            <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
              <button
                type="button"
                disabled={saving || !ready}
                onClick={() => save(true)}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <Printer size={14} /> {saving ? "Saving..." : "Save & Print [F9]"}
              </button>
              <button
                type="button"
                disabled={saving || !ready}
                onClick={() => save(false)}
                className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                Save Only [F10]
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={reset}
                title="New Order (F2)"
                aria-label="New Order (F2)"
                className="pos-surface-alt flex h-9 w-9 items-center justify-center rounded-lg border transition hover:opacity-80"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </section>
        </aside>
      </div>

      <ShortcutBar
        dark={isDark}
        onTrigger={(k) => {
          if (k === "F1") window.dispatchEvent(new Event("labos:help"));
          else if (k === "F2") reset();
          else if (k === "F3") { testBox.current?.focus(); testBox.current?.select?.(); }
          else if (k === "F5") setHoldModalOpen(true);
          else if (k === "F6") discountRef.current?.focus();
          else if (k === "F8") {
            const idx = allowedMethodValues.indexOf(method);
            setMethod(allowedMethodValues[(idx + 1) % allowedMethodValues.length]);
          } else if (k === "F9") save(true);
          else if (k === "F10") save(false);
          else if (k === "Ctrl+Z") handleUndo();
        }}
      />

      <HeldBillsModal
        open={holdModalOpen}
        bills={heldBills}
        onClose={() => { setHoldModalOpen(false); testBox.current?.focus(); }}
        onHoldCurrent={handleHoldCurrent}
        canHoldCurrent={cart.length > 0}
        onResume={handleResumeBill}
        onDelete={(id) => setHeldBills(removeHeldBill("lab", branchId, id))}
      />

      {pinModal && (
        <PinOverrideModal
          open={Boolean(pinModal)}
          message={`Discount exceeds your role limit (${limits.maxDiscountPct}%). Enter Manager / Admin PIN to approve.`}
          onClose={() => { setPinModal(null); testBox.current?.focus(); }}
          onConfirm={(pin) => {
            const p = pinModal.print;
            setPinModal(null);
            save(p, pin);
          }}
        />
      )}
    </div>
  );
}
