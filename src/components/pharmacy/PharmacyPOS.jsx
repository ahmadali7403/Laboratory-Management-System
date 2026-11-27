"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Check,
  Clock,
  Footprints,
  HelpCircle,
  Moon,
  Printer,
  RotateCcw,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { api, formatMoney } from "@/lib/client";
import { Select, useDebounced, useToast } from "@/components/ui";
import { PHARMACY_PAYMENT_METHODS } from "@/lib/pharmacy";
import { holdBill, loadHeldBills, removeHeldBill } from "@/lib/pos-hold";
import { usePosKeyboard } from "@/lib/use-pos-keyboard";
import { usePosTheme } from "@/lib/use-pos-theme";
import { optimisticDecrementMedicineCache } from "@/lib/pos-cache";
import { printPharmacyReceipt } from "@/lib/fast-print";
import { KeyBadge, ShortcutBar } from "@/components/shortcut-bar";
import TotalsCard from "@/components/pos/TotalsCard";
import PaymentChips from "@/components/pos/PaymentChips";
import MedicineSearch from "@/components/pharmacy/MedicineSearch";
import PharmacyCart from "@/components/pharmacy/PharmacyCart";

const BatchSelector = dynamic(
  () => import("@/components/pharmacy/BatchSelector"),
  { ssr: false },
);
const HeldBillsModal = dynamic(() => import("@/components/held-bills-modal"), {
  ssr: false,
});
const ShiftModal = dynamic(() => import("@/components/pharmacy/ShiftModal"), {
  ssr: false,
});
const PinOverrideModal = dynamic(
  () => import("@/components/pos/PinOverrideModal"),
  { ssr: false },
);

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function PharmacyPOS({ scope }) {
  const toast = useToast();
  const { theme, isDark, toggleTheme } = usePosTheme();
  const limits = scope?.limits || {
    canDiscount: true,
    maxDiscountPct: 100,
    canEditPrice: true,
    allowedMethods: null,
    requireShift: false,
  };
  const allowedPayMethods = useMemo(() => {
    const allowed =
      Array.isArray(limits.allowedMethods) && limits.allowedMethods.length
        ? limits.allowedMethods
        : null;
    return allowed
      ? PHARMACY_PAYMENT_METHODS.filter((m) => allowed.includes(m.value))
      : PHARMACY_PAYMENT_METHODS;
  }, [limits.allowedMethods]);
  const allowedMethodValues = useMemo(
    () => allowedPayMethods.map((m) => m.value),
    [allowedPayMethods],
  );
  const needsPick = scope.role !== "BRANCH_ADMIN" && !scope.branchId;
  const [picked, setPicked] = useState("");
  const branchId = scope.branchId || picked;

  const [customerMode, setCustomerMode] = useState("walkin");
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [custQ, setCustQ] = useState("");
  const dCustQ = useDebounced(custQ, 220);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [cart, setCart] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [focusQtyToken, setFocusQtyToken] = useState(0);
  const [batchModal, setBatchModal] = useState(null);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [pinModal, setPinModal] = useState(null); // { shouldPrint }
  const [heldBills, setHeldBills] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [discType, setDiscType] = useState("RS");
  const [discValue, setDiscValue] = useState("");
  const [payTouched, setPayTouched] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [method, setMethod] = useState(() => (limits.allowedMethods?.length ? limits.allowedMethods[0] : "CASH"));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSale, setLastSale] = useState(null);

  const searchRef = useRef(null);
  const walkNameRef = useRef(null);
  const customerToggleRef = useRef(null);
  const discountRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(
      () => setHeldBills(loadHeldBills("pharmacy", branchId)),
      0,
    );
    return () => clearTimeout(id);
  }, [branchId]);

  useEffect(() => {
    if (!branchId || customerMode !== "registered") return;
    let stop = false;
    api(
      `/api/pharmacy/customers?branchId=${branchId}&q=${encodeURIComponent(dCustQ.trim())}`,
    )
      .then((d) => !stop && setCustomers(d.items || []))
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [branchId, dCustQ, customerMode]);

  const customerOptions = useMemo(() => {
    const list = branchId && customerMode === "registered" ? customers : [];
    return selectedCustomer && !list.some((c) => c.id === selectedCustomer.id)
      ? [selectedCustomer, ...list]
      : list;
  }, [selectedCustomer, customers, branchId, customerMode]);

  const pushUndo = useCallback((snapshotCart) => {
    setUndoStack((u) =>
      [snapshotCart.map((x) => ({ ...x })), ...u].slice(0, 15),
    );
  }, []);

  const addOrIncrement = useCallback(
    (medicine, batch, meta = {}) => {
      if (!batch || Number(batch.quantity) <= 0) {
        toast.error("Selected batch has no available stock.");
        return;
      }
      let nextIdx = -1;
      setCart((prev) => {
        pushUndo(prev);
        const existingIdx = prev.findIndex((x) => x.batch.id === batch.id);
        if (existingIdx >= 0) {
          const cur = prev[existingIdx];
          const max = Number(cur.batch.quantity);
          if (cur.qty + 1 > max) {
            toast.error(
              `Only ${max} ${medicine.unit} available in batch ${batch.batchNumber}.`,
            );
            return prev;
          }
          nextIdx = existingIdx;
          return prev.map((x, i) =>
            i === existingIdx ? { ...x, qty: round2(x.qty + 1) } : x,
          );
        }
        nextIdx = prev.length;
        return [...prev, { medicine, batch, qty: 1, discount: 0 }];
      });
      if (nextIdx >= 0) {
        setSelectedIdx(nextIdx);
        if (!meta.isScan) setFocusQtyToken((t) => t + 1);
      }
      setError("");
    },
    [toast, pushUndo],
  );

  function handleChangeQty(idx, raw) {
    const val = Math.max(0.01, Number(raw) || 0);
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const max = Number(item.batch.quantity);
        if (val > max) {
          toast.error(
            `Maximum available in batch ${item.batch.batchNumber} is ${max}.`,
          );
          return { ...item, qty: max };
        }
        return { ...item, qty: round2(val) };
      }),
    );
  }

  function handleChangeDiscount(idx, raw) {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const maxDisc = round2(item.qty * Number(item.batch.salePrice));
        const val = Math.max(0, Math.min(maxDisc, Number(raw) || 0));
        return { ...item, discount: round2(val) };
      }),
    );
  }

  function handleRemove(idx) {
    setCart((prev) => {
      pushUndo(prev);
      const next = prev.filter((_, i) => i !== idx);
      setSelectedIdx((s) => Math.max(0, Math.min(s, next.length - 1)));
      return next;
    });
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function handleUndo() {
    setUndoStack((u) => {
      if (!u.length) return u;
      const [latest, ...rest] = u;
      setCart(latest);
      setSelectedIdx((s) => Math.max(0, Math.min(s, latest.length - 1)));
      toast.info("Undid last cart change.");
      return rest;
    });
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function handleBatchChosen(medicine, batch) {
    if (batchModal?.cartIdx != null) {
      const idx = batchModal.cartIdx;
      setCart((prev) => {
        const dup = prev.findIndex(
          (x, i) => i !== idx && x.batch.id === batch.id,
        );
        if (dup >= 0) {
          toast.info(`Batch ${batch.batchNumber} is already in the cart.`);
          return prev;
        }
        return prev.map((item, i) => {
          if (i !== idx) return item;
          const max = Number(batch.quantity);
          return { ...item, batch, qty: Math.min(item.qty, max) };
        });
      });
    } else {
      addOrIncrement(medicine, batch, { isScan: true });
    }
    setBatchModal(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  const subtotal = round2(
    cart.reduce(
      (s, item) => s + round2(item.qty * Number(item.batch.salePrice)),
      0,
    ),
  );
  const itemDiscountTotal = round2(
    cart.reduce((s, item) => s + round2(item.discount || 0), 0),
  );
  const afterItemDisc = round2(Math.max(0, subtotal - itemDiscountTotal));
  const discRs = Math.min(
    afterItemDisc,
    round2(
      discType === "PCT"
        ? (afterItemDisc * Math.min(100, Number(discValue) || 0)) / 100
        : Number(discValue) || 0,
    ),
  );
  const total = round2(Math.max(0, afterItemDisc - discRs));
  const paid = payTouched ? round2(Math.max(0, Number(payAmount) || 0)) : total;
  const appliedPaid = round2(Math.min(paid, total));
  const balance = round2(Math.max(0, total - appliedPaid));
  const change = round2(Math.max(0, paid - total));

  function openA4Invoice(id) {
    const f = document.createElement("iframe");
    f.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    f.src = `/embed/pharmacy/invoice/${id}`;
    f.onload = () => {
      try {
        f.contentWindow.focus();
        f.contentWindow.print();
      } catch {
        window.open(`/embed/pharmacy/invoice/${id}`, "_blank");
      }
      setTimeout(() => f.remove(), 60_000);
    };
    document.body.appendChild(f);
  }

  function resetSale() {
    setCart([]);
    setUndoStack([]);
    setSelectedIdx(0);
    setCustomerMode("walkin");
    setWalkName("");
    setWalkPhone("");
    setSelectedCustomer(null);
    setCustQ("");
    setDiscValue("");
    setPayTouched(false);
    setPayAmount("");
    setReference("");
    setNotes("");
    setError("");
    setTimeout(() => searchRef.current?.focus(), 40);
  }

  async function completeSale(shouldPrint, overridePin = undefined) {
    if (saving) return;
    if (needsPick && !picked) {
      setError("Please select a branch.");
      toast.error("Please select a branch.");
      return;
    }
    if (cart.length === 0) {
      setError("Add at least one medicine to complete the sale.");
      toast.error("Cart is empty.");
      searchRef.current?.focus();
      return;
    }
    if (customerMode === "registered" && !selectedCustomer) {
      setError("Select a registered customer or switch to Walk-in Customer.");
      toast.error("Select a customer or switch to Walk-in.");
      return;
    }

    const totalDisc = round2(itemDiscountTotal + discRs);
    const discPct = subtotal > 0 ? round2((totalDisc / subtotal) * 100) : 0;
    if (scope.isStaff && totalDisc > 0 && !overridePin) {
      if (!limits.canDiscount || discPct > Number(limits.maxDiscountPct ?? 100) + 0.01) {
        setPinModal({ shouldPrint });
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const body = {
        ...(needsPick ? { branchId: picked } : {}),
        ...(customerMode === "registered" && selectedCustomer
          ? { patientId: selectedCustomer.id }
          : {
              customerName: walkName.trim() || "Walk-in Customer",
              customerPhone: walkPhone.trim() || null,
            }),
        discount: discRs,
        paidAmount: paid,
        paymentMethod: method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        ...(overridePin ? { overridePin } : {}),
        items: cart.map((item) => ({
          batchId: item.batch.id,
          quantity: item.qty,
          discount: round2(item.discount || 0),
        })),
      };

      const res = await api("/api/pharmacy/sales", { method: "POST", body });
      toast.success(`Sale ${res.saleNo} completed.`);
      const activeBranch = scope.branches?.find((b) => b.id === branchId);
      optimisticDecrementMedicineCache(branchId, cart);
      setLastSale({
        id: res.id,
        saleNo: res.saleNo,
        total: res.total,
        paidAmount: res.paidAmount,
        changeAmount: res.changeAmount,
      });
      setRefreshKey((k) => k + 1);
      if (shouldPrint) {
        printPharmacyReceipt({
          orgName: activeBranch?.organizationName || "Pharmacy",
          branchName: activeBranch?.name || "",
          saleNo: res.saleNo,
          customerName:
            customerMode === "registered" && selectedCustomer
              ? selectedCustomer.name
              : walkName.trim() || "Walk-in Customer",
          customerPhone:
            customerMode === "registered" && selectedCustomer
              ? selectedCustomer.phone
              : walkPhone.trim(),
          items: cart,
          subtotal,
          itemDiscountTotal,
          discount: discRs,
          total: res.total,
          paidAmount: res.paidAmount,
          changeAmount: res.changeAmount,
          paymentMethod: method,
        });
      }
      resetSale();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleHoldCurrent() {
    if (!branchId || !cart.length) return;
    const label =
      customerMode === "registered" && selectedCustomer
        ? selectedCustomer.name
        : walkName.trim() || "Walk-in Customer";
    const next = holdBill("pharmacy", branchId, {
      label,
      itemCount: cart.length,
      total,
      payload: {
        cart,
        customerMode,
        walkName,
        walkPhone,
        selectedCustomer,
        discType,
        discValue,
        method,
        notes,
      },
    });
    setHeldBills(next);
    setHoldModalOpen(false);
    toast.success(`Held bill for ${label}.`);
    resetSale();
  }

  function handleResumeBill(bill) {
    const p = bill.payload || {};
    setCart(Array.isArray(p.cart) ? p.cart : []);
    setCustomerMode(p.customerMode || "walkin");
    setWalkName(p.walkName || "");
    setWalkPhone(p.walkPhone || "");
    setSelectedCustomer(p.selectedCustomer || null);
    setDiscType(p.discType || "RS");
    setDiscValue(p.discValue || "");
    setMethod(p.method || "CASH");
    setNotes(p.notes || "");
    setUndoStack([]);
    setSelectedIdx(0);
    setHeldBills(removeHeldBill("pharmacy", branchId, bill.id));
    setHoldModalOpen(false);
    toast.success("Resumed held bill.");
    setTimeout(() => searchRef.current?.focus(), 30);
  }

  usePosKeyboard({
    onNewSale: resetSale,
    onFocusSearch: () => {
      searchRef.current?.focus();
      searchRef.current?.select?.();
    },
    onFocusCustomer: () => {
      if (customerMode === "walkin" && walkNameRef.current) {
        walkNameRef.current.focus();
        walkNameRef.current.select?.();
      } else {
        customerToggleRef.current?.focus();
      }
    },
    onHoldOrResume: () => {
      if (!branchId) return;
      if (cart.length > 0 && heldBills.length === 0) handleHoldCurrent();
      else setHoldModalOpen(true);
    },
    onFocusDiscount: () => {
      discountRef.current?.focus();
      discountRef.current?.select?.();
    },
    onCycleMethod: () => {
      if (!allowedMethodValues.length) return;
      const idx = allowedMethodValues.indexOf(method);
      setMethod(allowedMethodValues[(idx + 1) % allowedMethodValues.length]);
    },
    onSaveAndPrint: () => completeSale(true),
    onSaveOnly: () => completeSale(false),
    onRemoveSelected: () => {
      if (cart.length > 0 && selectedIdx >= 0 && selectedIdx < cart.length)
        handleRemove(selectedIdx);
    },
    onUndo: handleUndo,
    onEscape: () => {
      if (
        document.activeElement &&
        document.activeElement !== searchRef.current
      ) {
        searchRef.current?.focus();
      }
    },
  });

  const ready = Boolean(branchId);

  return (
    <div
      data-pos-theme={theme}
      className="pos-theme flex h-full min-h-0 w-full flex-col overflow-hidden"
    >
      {/* Top Compact Header & Customer Bar */}
      <header className="pos-surface flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-500">
            Pharmacy POS
          </span>

          {needsPick && (
            <select
              className="pos-input h-7 rounded-md border px-2 text-xs font-semibold"
              value={picked}
              onChange={(e) => {
                setPicked(e.target.value);
                resetSale();
              }}
              aria-label="Branch"
            >
              <option value="">Select branch...</option>
              {scope.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {scope.role === "SUPER_ADMIN" && !scope.organizationId
                    ? `${b.organizationName} — ${b.name}`
                    : b.name}
                </option>
              ))}
            </select>
          )}

          <div className="pos-surface-alt inline-flex rounded-md border p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => {
                setCustomerMode("walkin");
                setSelectedCustomer(null);
              }}
              className={`flex items-center gap-1 rounded px-2 py-0.5 transition ${
                customerMode === "walkin"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <Footprints size={11} /> Walk-in
            </button>
            <button
              ref={customerToggleRef}
              type="button"
              onClick={() => setCustomerMode("registered")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 transition ${
                customerMode === "registered"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <UserRound size={11} /> Registered{" "}
              <KeyBadge dark={isDark}>F4</KeyBadge>
            </button>
          </div>

          {customerMode === "walkin" ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={walkNameRef}
                className="pos-input h-7 w-40 rounded border px-2 text-xs outline-none focus:border-blue-500"
                value={walkName}
                disabled={!ready}
                placeholder="Walk-in Customer"
                onChange={(e) => setWalkName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchRef.current?.focus();
                  }
                }}
              />
              <input
                className="pos-input hidden h-7 w-28 rounded border px-2 text-xs outline-none focus:border-blue-500 sm:block"
                value={walkPhone}
                disabled={!ready}
                placeholder="Phone (opt)"
                onChange={(e) => setWalkPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchRef.current?.focus();
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-56">
                <Select
                  value={selectedCustomer?.id || ""}
                  onChange={(e) =>
                    setSelectedCustomer(
                      customerOptions.find((c) => c.id === e.target.value) ||
                        null,
                    )
                  }
                  onSearch={setCustQ}
                  disabled={!ready}
                  className="!h-7 !text-xs"
                >
                  <option value="">Search registered customer...</option>
                  {customerOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.mrn}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomerMode("walkin");
                  setSelectedCustomer(null);
                }}
                className="text-[11px] font-semibold text-blue-500 hover:underline"
              >
                Walk-in
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          {lastSale && (
            <div className="hidden items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-500 xl:flex">
              <Check size={12} />
              <span className="font-bold">{lastSale.saleNo}</span>
              <span className="tabular-nums">
                {formatMoney(lastSale.total)}
              </span>
              <button
                type="button"
                onClick={() => openA4Invoice(lastSale.id)}
                className="underline hover:opacity-80"
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setLastSale(null)}
                aria-label="Dismiss"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setHoldModalOpen(true)}
            className="pos-surface-alt inline-flex h-7 items-center gap-1 rounded-md border px-2 font-semibold hover:opacity-80"
          >
            <Clock size={12} /> Held ({heldBills.length}){" "}
            <KeyBadge dark={isDark}>F5</KeyBadge>
          </button>
          <button
            type="button"
            onClick={() => setShiftModalOpen(true)}
            className="pos-surface-alt inline-flex h-7 items-center gap-1 rounded-md border px-2 font-semibold hover:opacity-80"
          >
            Shift
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="pos-surface-alt inline-flex h-7 w-7 items-center justify-center rounded-md border hover:opacity-80"
          >
            {isDark ? (
              <Sun size={13} className="text-amber-400" />
            ) : (
              <Moon size={13} />
            )}
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("labos:help"))}
            title="Shortcuts Help (F1)"
            className="pos-surface-alt inline-flex h-7 items-center gap-1 rounded-md border px-2 font-semibold hover:opacity-80"
          >
            <HelpCircle size={12} /> <KeyBadge dark={isDark}>F1</KeyBadge>
          </button>
          <Link
            href="/pharmacy/sales"
            className="hidden font-semibold hover:text-blue-500 md:inline"
            style={{ color: "var(--pos-muted)" }}
          >
            Sales
          </Link>
        </div>
      </header>

      {/* Main 3-Zone Workspace: Left (~62% Search + Catalog Cards/Grid), Right (~38% Cart + Totals/Pay + Actions) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 lg:grid-cols-[minmax(0,1.62fr)_minmax(345px,1fr)]">
        {/* Left Zone */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <MedicineSearch
            branchId={branchId}
            mode="pos"
            inputRef={searchRef}
            refreshKey={refreshKey}
            dark={isDark}
            onSelect={addOrIncrement}
            onPickBatch={(med) =>
              setBatchModal({ medicine: med, cartIdx: null })
            }
          />
        </section>

        {/* Right Zone */}
        <aside className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-hidden">
          <PharmacyCart
            cart={cart}
            selectedIdx={selectedIdx}
            focusQtyToken={focusQtyToken}
            canUndo={undoStack.length > 0}
            dark={isDark}
            onSelectIdx={setSelectedIdx}
            onChangeQty={handleChangeQty}
            onChangeDiscount={handleChangeDiscount}
            onSwitchBatch={(idx) =>
              setBatchModal({ medicine: cart[idx].medicine, cartIdx: idx })
            }
            onRemove={handleRemove}
            onUndo={handleUndo}
            onClear={resetSale}
            onFocusSearch={() => searchRef.current?.focus()}
          />

          <section className="pos-surface flex shrink-0 flex-col gap-2 rounded-lg border p-2.5 shadow-sm">
            <TotalsCard
              subtotal={subtotal}
              itemDiscountTotal={itemDiscountTotal}
              discRs={discRs}
              total={total}
              discType={discType}
              discValue={discValue}
              onDiscTypeChange={setDiscType}
              onDiscValueChange={setDiscValue}
              discountRef={discountRef}
              payTouched={payTouched}
              payAmount={payAmount}
              onPayAmountChange={(v) => {
                setPayTouched(true);
                setPayAmount(v);
              }}
              onPayFull={() => {
                setPayTouched(false);
                setPayAmount("");
              }}
              onPayZero={() => {
                setPayTouched(true);
                setPayAmount("0");
              }}
              balance={balance}
              change={change}
              onEnterComplete={() => completeSale(true)}
              ready={ready}
              dark={isDark}
              canDiscount={limits.canDiscount}
              maxDiscountPct={limits.maxDiscountPct}
            />

            <PaymentChips
              methods={allowedPayMethods}
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
                onClick={() => completeSale(true)}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <Printer size={14} />{" "}
                {saving ? "Saving..." : "Save & Print [F9]"}
              </button>
              <button
                type="button"
                disabled={saving || !ready}
                onClick={() => completeSale(false)}
                className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                Save Only [F10]
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={resetSale}
                title="New Sale (F2)"
                aria-label="New Sale (F2)"
                className="pos-surface-alt flex h-9 w-9 items-center justify-center rounded-lg border transition hover:opacity-80"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </section>
        </aside>
      </div>

      {/* Bottom Sticky Shortcut Hint Bar */}
      <ShortcutBar
        dark={isDark}
        onTrigger={(k) => {
          if (k === "F1") window.dispatchEvent(new Event("labos:help"));
          else if (k === "F2") resetSale();
          else if (k === "F3") {
            searchRef.current?.focus();
            searchRef.current?.select?.();
          } else if (k === "F5") setHoldModalOpen(true);
          else if (k === "F6") discountRef.current?.focus();
          else if (k === "F8") {
            if (allowedMethodValues.length) {
              const idx = allowedMethodValues.indexOf(method);
              setMethod(
                allowedMethodValues[(idx + 1) % allowedMethodValues.length],
              );
            }
          } else if (k === "F9") completeSale(true);
          else if (k === "F10") completeSale(false);
          else if (k === "Ctrl+Z") handleUndo();
        }}
      />

      {batchModal && (
        <BatchSelector
          medicine={batchModal.medicine}
          selectedBatchId={
            batchModal.cartIdx != null
              ? cart[batchModal.cartIdx]?.batch?.id
              : null
          }
          onSelect={handleBatchChosen}
          onClose={() => {
            setBatchModal(null);
            searchRef.current?.focus();
          }}
        />
      )}

      <HeldBillsModal
        open={holdModalOpen}
        bills={heldBills}
        onClose={() => {
          setHoldModalOpen(false);
          searchRef.current?.focus();
        }}
        onHoldCurrent={handleHoldCurrent}
        canHoldCurrent={cart.length > 0}
        onResume={handleResumeBill}
        onDelete={(id) =>
          setHeldBills(removeHeldBill("pharmacy", branchId, id))
        }
      />

      <ShiftModal
        open={shiftModalOpen}
        branchId={branchId}
        onClose={() => {
          setShiftModalOpen(false);
          searchRef.current?.focus();
        }}
      />

      <PinOverrideModal
        open={Boolean(pinModal)}
        message={
          limits.canDiscount
            ? `Discount exceeds your ${limits.maxDiscountPct ?? 100}% role cap. Enter a Manager/Admin PIN to authorize.`
            : "Your role does not allow discounts without Manager/Admin PIN approval."
        }
        onClose={() => {
          setPinModal(null);
          searchRef.current?.focus();
        }}
        onConfirm={(pin) => {
          const printAfter = Boolean(pinModal?.shouldPrint);
          setPinModal(null);
          completeSale(printAfter, pin);
        }}
      />
    </div>
  );
}
