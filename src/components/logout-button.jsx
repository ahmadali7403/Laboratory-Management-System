"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton({ variant = "light" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }
  const cls = variant === "dark"
    ? "w-full justify-center border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50";
  return (
    <button onClick={logout} disabled={busy} className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${cls}`}>
      <LogOut size={15} /> {busy ? "Signing out..." : "Logout"}
    </button>
  );
}
