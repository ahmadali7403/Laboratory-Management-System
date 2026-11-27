"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, LockKeyhole, ShieldAlert } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui";

const IDLE_TIMEOUT_MS = 15 * 60_000; // 15 minutes inactivity auto-lock

export default function SessionLock({ userName, mustChangePassword = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);
  const lastActivityRef = useRef(0);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    const bump = () => {
      if (!locked) lastActivityRef.current = Date.now();
    };
    const onKey = (e) => {
      if (e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setLocked(true);
        setErr("");
        setSecret("");
        return;
      }
      bump();
    };
    const events = ["mousedown", "touchstart", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
    window.addEventListener("keydown", onKey);

    const timer = setInterval(() => {
      if (!locked && Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        setLocked(true);
        setErr("");
        setSecret("");
      }
    }, 30_000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump));
      window.removeEventListener("keydown", onKey);
      clearInterval(timer);
    };
  }, [locked]);

  useEffect(() => {
    if (locked) {
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [locked]);

  async function unlock(e) {
    e.preventDefault();
    if (busy || !secret.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth/unlock", { method: "POST", body: { secret } });
      lastActivityRef.current = Date.now();
      setSecret("");
      setLocked(false);
    } catch (error) {
      setErr(error.message || "Incorrect password or PIN.");
      inputRef.current?.select();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {mustChangePassword && pathname !== "/profile" && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 print:hidden">
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-600" />
            Security notice: Please change your initial temporary password right away.
          </span>
          <Button size="sm" onClick={() => router.push("/profile")}>
            Change Password
          </Button>
        </div>
      )}

      {locked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Session Locked"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md print:hidden"
        >
          <form
            onSubmit={unlock}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold">Screen Locked</h2>
                <p className="text-xs text-slate-400">{userName || "Signed in user"}</p>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-300">
                Enter Password or 4–6 Digit PIN
              </span>
              <div className="relative">
                <LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  type="password"
                  required
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Password or PIN"
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </label>

            {err && (
              <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {err}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">Shortcut: Alt+L to lock anytime</span>
              <Button type="submit" loading={busy}>
                Unlock (Enter)
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
