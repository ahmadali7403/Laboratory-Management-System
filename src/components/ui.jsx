"use client";

import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Search,
  Info,
  Loader2,
  Inbox,
  X,
  XCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Toasts + confirm dialog (replaces alert()/confirm())
// ---------------------------------------------------------------------------
const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const autoTimers = useRef(new Set());
  const push = useCallback((type, message, auto = false) => {
    if (auto) {
      // wait a moment: if the screen shows its own message, this automatic one is skipped
      const t = setTimeout(() => { autoTimers.current.delete(t); push(type, message); }, 300);
      autoTimers.current.add(t);
      return;
    }
    autoTimers.current.forEach(clearTimeout);
    autoTimers.current.clear();
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, type, message }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      type === "error" ? 6000 : 1200,
    );
  }, []);

  const toast = useMemo(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  // One-time message handed over from another page (e.g. "Signed in successfully." after login).
  useEffect(() => {
    try {
      const flash = sessionStorage.getItem("labos:flash");
      if (flash) {
        sessionStorage.removeItem("labos:flash");
        push("success", flash);
      }
    } catch { /* storage blocked */ }
  }, [push]);

  useEffect(() => {
    const onAuto = (e) => push(e.detail.type, e.detail.message, true);
    window.addEventListener("labos:toast", onAuto);
    return () => window.removeEventListener("labos:toast", onAuto);
  }, [push]);

  const confirm = useCallback(
    (options) => new Promise((resolve) => setDialog({ ...options, resolve })),
    [],
  );

  function close(result) {
    dialog?.resolve(result);
    setDialog(null);
  }

  const icons = { success: CheckCircle2, error: XCircle, info: Info };
  const tones = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}
      <div
        className="pointer-events-none fixed right-3 top-3 z-[70] flex w-[calc(100vw-1.5rem)] max-w-xs flex-col gap-1.5 print:hidden"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div
              key={t.id}
              role="status"
              className={`labos-toast pointer-events-auto flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] shadow-lg ${tones[t.type]}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="flex-1">{t.message}</p>
              <button
                onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}
                aria-label="Dismiss"
                className="opacity-60 hover:opacity-100"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
      {dialog && (
        <Modal
          open
          title={dialog.title || "Please confirm"}
          size="sm"
          onClose={() => close(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => close(false)}>
                {dialog.cancelLabel || "Cancel"}
              </Button>
              <Button
                variant={dialog.danger ? "danger" : "primary"}
                onClick={() => close(true)}
              >
                {dialog.confirmLabel || "Confirm"}
              </Button>
            </>
          }
        >
          <div className="flex gap-3">
            {dialog.danger && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle size={18} />
              </span>
            )}
            <p className="text-sm leading-6 text-slate-600">{dialog.message}</p>
          </div>
        </Modal>
      )}
    </UIContext.Provider>
  );
}

export const useToast = () => useContext(UIContext).toast;
export const useConfirm = () => useContext(UIContext).confirm;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  ...props
}) {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  };
  const sizes = {
    sm: "h-7 px-2.5 text-xs",
    md: "h-8 px-3 text-[13px]",
    icon: "h-7 w-7 text-xs",
  };
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

export const inputClass =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.18)] disabled:bg-slate-50 disabled:text-slate-500";

export function Field({ label, hint, required, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-0.5 block text-[11px] font-semibold text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-0.5 block text-[10px] text-slate-400">{hint}</span>
      )}
    </label>
  );
}

const BADGE = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/20",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
};
const STATUS_TONE = {
  ACTIVE: "green",
  PAID: "green",
  COMPLETED: "green",
  VERIFIED: "green",
  RECEIVED: "green",
  NORMAL: "green",
  PENDING: "amber",
  UNPAID: "amber",
  REGISTERED: "amber",
  ORDERED: "amber",
  ENTERED: "violet",
  PARTIAL: "blue",
  IN_PROGRESS: "blue",
  SAMPLE_COLLECTED: "blue",
  COLLECTED: "blue",
  LOW: "amber",
  HIGH: "amber",
  ABNORMAL: "amber",
  CANCELLED: "red",
  REJECTED: "red",
  CRITICAL: "red",
  SUSPENDED: "red",
  INACTIVE: "gray",
};
export function Badge({ tone = "gray", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-px text-[10px] font-semibold ring-1 ring-inset ${BADGE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
export function StatusBadge({ value }) {
  if (!value) return <span className="text-slate-400">—</span>;
  return (
    <Badge tone={STATUS_TONE[value] || "gray"}>
      {String(value).replace(/_/g, " ")}
    </Badge>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-base font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="text-[11px] text-slate-500">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", message, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Inbox size={22} />
      </span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {message && (
        <p className="mt-1 max-w-sm text-xs text-slate-500">{message}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
        <AlertTriangle size={22} />
      </span>
      <p className="text-sm font-semibold text-slate-800">
        Something went wrong
      </p>
      <p className="mt-1 max-w-sm text-xs text-slate-500">{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-8 text-sm text-slate-500">
      <Loader2 size={18} className="animate-spin" /> {label}
    </div>
  );
}

export const PAGE_SIZES = [10, 20, 50, 100];

/** "Show [10 v] entries" selector. */
export function PageSizeSelect({ value, onChange, className = "" }) {
  return (
    <label className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-slate-500 ${className}`}>
      Show
      <Select
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Entries per page"
        className="!w-16"
        searchable={false}
      >
        {PAGE_SIZES.map((n) => (
          <option key={n} value={String(n)}>{n}</option>
        ))}
      </Select>
      entries
    </label>
  );
}

/** 1 2 3 ... 11 12 style page list. */
export function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out = new Set([1, 2, pages - 1, pages, page - 1, page, page + 1]);
  if (page <= 3) [3, 4].forEach((n) => out.add(n));
  if (page >= pages - 2) [pages - 3, pages - 2].forEach((n) => out.add(n));
  const sorted = [...out].filter((n) => n >= 1 && n <= pages).sort((x, y) => x - y);
  const res = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) res.push("…");
    res.push(n);
  });
  return res;
}

export function Pagination({ page, pageSize, total, onChange }) {
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex h-6 min-w-6 items-center justify-center rounded border px-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-1.5 text-xs text-slate-500">
      <span>Showing {from}–{to} of {total} entries</span>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button type="button" className={`${btn} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page" title="Previous">
            <ChevronLeft size={14} />
          </button>
          {pageList(page, pages).map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-1 text-slate-400">…</span>
            ) : (
              <button key={n} type="button" onClick={() => onChange(n)} aria-current={n === page ? "page" : undefined} className={`${btn} ${n === page ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                {n}
              </button>
            ),
          )}
          <button type="button" className={`${btn} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page" title="Next">
            <ChevronRight size={14} />
          </button>
        </nav>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Select: drop-in replacement for <select> with a search box.
// Accepts <option> children and onChange(e) with e.target.value, exactly like
// a native select, so every dropdown in the app can share it.
// ---------------------------------------------------------------------------
function textOf(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf(node.props.children);
  return "";
}
function collectOptions(children, out = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const label = textOf(child.props.children);
      out.push({
        value: child.props.value !== undefined ? String(child.props.value) : label,
        label,
        disabled: Boolean(child.props.disabled),
      });
    } else if (child.props?.children) collectOptions(child.props.children, out);
  });
  return out;
}

export function Select({
  value,
  onChange,
  children,
  className = "",
  disabled,
  required,
  searchable = true,
  onSearch, // optional: server-side search; the list is then supplied by the caller and not filtered here
  size: _size, // native listbox size is ignored
  multiple: _multiple,
  ...rest
}) {
  const options = useMemo(() => collectOptions(children), [children]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const cur = options.find((o) => o.value === String(value ?? ""));
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t && !onSearch ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [options, q, onSearch]);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const h = 260;
    const up = below < h && r.top > below;
    setPos({
      left: Math.max(4, Math.min(r.left, window.innerWidth - Math.max(r.width, 180) - 4)),
      width: Math.max(r.width, 180),
      top: up ? undefined : r.bottom + 2,
      bottom: up ? window.innerHeight - r.top + 2 : undefined,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e) => {
      if (btnRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onMove = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (open) setTimeout(() => (searchRef.current || panelRef.current)?.focus(), 0);
  }, [open]);

  function openMenu() {
    if (disabled) return;
    setQ("");
    const i = options.findIndex((o) => o.value === String(value ?? ""));
    setHi(Math.max(0, i));
    setOpen(true);
  }
  function pick(o) {
    if (!o || o.disabled) return;
    onChange?.({ target: { value: o.value, name: rest.name }, currentTarget: { value: o.value } });
    setOpen(false);
    btnRef.current?.focus();
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); btnRef.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(shown.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(shown[hi]); }
  }
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); openMenu(); }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={rest["aria-label"]}
        title={rest.title}
        className={`${inputClass} flex items-center justify-between gap-1 text-left ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate ${cur && cur.value !== "" ? "" : "text-slate-400"}`}>
          {cur ? cur.label || "—" : "Select..."}
        </span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </button>
      {required && (
        <input tabIndex={-1} aria-hidden="true" required value={String(value ?? "")} onChange={() => {}} className="pointer-events-none absolute h-0 w-0 opacity-0" />
      )}
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            tabIndex={-1}
            onKeyDown={onKey}
            style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
            className="z-[90] overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl outline-none"
          >
            {searchable && (
              <div className="relative border-b border-slate-100 p-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setHi(0); onSearch?.(e.target.value); }}
                  placeholder="Search..."
                  className="h-7 w-full rounded border border-slate-200 pl-7 pr-2 text-xs outline-none focus:border-slate-400 focus:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.18)]"
                />
              </div>
            )}
            <ul role="listbox" className="max-h-52 overflow-y-auto py-0.5">
              {shown.length === 0 && <li className="px-3 py-2 text-center text-xs text-slate-400">No results found</li>}
              {shown.map((o, i) => (
                <li
                  key={`${o.value}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={o.value === String(value ?? "")}
                  aria-disabled={o.disabled}
                  onMouseEnter={() => setHi(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                  className={`cursor-pointer truncate px-2.5 py-1 text-[13px] ${o.disabled ? "cursor-not-allowed text-slate-300" : i === hi ? "bg-blue-50 text-blue-800" : "text-slate-700"} ${o.value === String(value ?? "") ? "font-semibold" : ""}`}
                >
                  {o.label || "—"}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Modal: internal scrolling body, sticky header/footer, Esc to close
// ---------------------------------------------------------------------------
export function Modal({
  open,
  title,
  subtitle,
  size = "md",
  onClose,
  footer,
  children,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  };
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[1px] sm:items-center sm:p-4 print:hidden"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full ${widths[size]} flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700"
    >
      {message}
    </div>
  );
}

export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
