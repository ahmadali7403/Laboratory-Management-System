"use client";

import { Search } from "lucide-react";
import { KeyBadge } from "@/components/shortcut-bar";

export default function SearchBar({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onClear,
  placeholder,
  disabled = false,
  syncing = false,
  dark = false,
  countText = "",
  ariaLabel = "Search",
}) {
  return (
    <div className="relative shrink-0">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--pos-muted)" }}
      />
      <input
        ref={inputRef}
        autoFocus
        data-pos-search="true"
        data-search-input="true"
        value={value}
        disabled={disabled}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pos-input h-9 w-full rounded-lg border pl-9 pr-28 text-[13px] font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {syncing && (
          <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9.5px] font-bold text-blue-500">
            Sync
          </span>
        )}
        {countText && (
          <span className="hidden text-[10px] font-semibold sm:inline" style={{ color: "var(--pos-muted)" }}>
            {countText}
          </span>
        )}
        {value ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={onClear}
            className="rounded border px-1.5 py-0.5 text-[10px] font-semibold hover:opacity-80"
            style={{ borderColor: "var(--pos-border)", color: "var(--pos-muted)" }}
          >
            Esc
          </button>
        ) : (
          <KeyBadge dark={dark}>F3</KeyBadge>
        )}
      </div>
    </div>
  );
}
