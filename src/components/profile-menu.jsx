"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  ShieldCheck,
  Building2,
  GitBranch,
  Settings,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui";

/** The ONLY place that shows who is signed in. */
export default function ProfileMenu({
  name,
  roleLabel,
  organization,
  branch,
  settingsHref,
  profileHref,
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    if (busy) return;

    setBusy(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Signed out successfully.");
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const initials =
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "U";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white py-0.5 pl-0.5 pr-1.5 hover:bg-slate-50"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white">
          {initials}
        </span>

        <span className="hidden max-w-32 truncate text-xs font-semibold text-slate-700 sm:block">
          {name}
        </span>

        <ChevronDown size={13} className="text-slate-400" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        >
          <div className="border-b border-slate-100 px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-slate-800">
              {name}
            </p>

            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck size={12} />
              {roleLabel}
            </p>

            {organization && (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-slate-500">
                <Building2 size={12} />
                {organization}
              </p>
            )}

            {branch && (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-slate-500">
                <GitBranch size={12} />
                {branch}
              </p>
            )}
          </div>

          {profileHref && (
            <Link
              role="menuitem"
              href={profileHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              <UserRound size={14} />
              My Profile
            </Link>
          )}

          {settingsHref && (
            <Link
              role="menuitem"
              href={settingsHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              <Settings size={14} />
              Settings
            </Link>
          )}

          <button
            role="menuitem"
            type="button"
            onClick={logout}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            <LogOut size={14} />
            {busy ? "Signing out..." : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}
