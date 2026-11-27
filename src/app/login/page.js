"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UIProvider, useToast } from "@/components/ui";
import { Eye, EyeOff, FlaskConical, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <UIProvider>
      <LoginForm />
    </UIProvider>
  );
}

function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState("password"); // "password" | "pin"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const passwordRef = useRef(null);
  const pinRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload =
        mode === "pin"
          ? { mode: "pin", identifier: email, pin }
          : { mode: "password", identifier: email, password };
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Login failed.");
      try {
        sessionStorage.setItem(
          "labos:flash",
          data.mustChangePassword ? "Signed in. Please change your temporary password." : "Signed in successfully.",
        );
      } catch {
        /* ignore */
      }
      router.replace(data.redirectTo || "/dashboard");
    } catch (err) {
      setError(err.message || "Login process mein error aa gaya.");
      toast.error(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="fixed inset-0 flex items-center justify-center overflow-hidden bg-slate-950 p-3 sm:p-6">
      <div className="grid h-full max-h-[660px] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/20 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden h-full flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-950 p-10 text-white lg:flex">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[50px] border-white/5" />
          <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full border-[60px] border-white/5" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><FlaskConical size={25} /></div>
            <div><p className="text-xl font-bold tracking-tight">LabOS</p><p className="text-xs text-blue-100">Laboratory &amp; Pharmacy Operations</p></div>
          </div>
          <div className="relative z-10 max-w-md">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-100"><ShieldCheck size={14} /> PLATFORM CONTROL CENTER</p>
            <h1 className="text-4xl font-bold leading-tight">One platform.<br />Lab &amp; Pharmacy.<br /><span className="text-blue-200">Keyboard-first.</span></h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-blue-100/80">Securely manage laboratory diagnostics, pharmacy counters, stock batches, and staff shifts.</p>
          </div>
          <p className="relative z-10 text-xs text-blue-100/60">© 2026 LabOS. Platform administration.</p>
        </section>

        <section className="no-scrollbar flex h-full overflow-y-auto px-6 py-8 sm:px-12">
          <div className="m-auto w-full max-w-sm">
            <div className="mb-6 lg:hidden">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><FlaskConical size={23} /></div><div><p className="text-xl font-bold text-slate-900">LabOS</p><p className="text-xs text-slate-500">Lab &amp; Pharmacy Platform</p></div></div>
            </div>
            <div className="mb-5">
              <p className="text-sm font-semibold text-blue-600">WELCOME BACK</p>
              <h2 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-950">Sign in to LabOS</h2>
              <p className="mt-1.5 text-sm text-slate-500">Use password or switch to numeric cashier PIN.</p>
            </div>

            <div className="mb-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setMode("password"); setError(""); setTimeout(() => passwordRef.current?.focus(), 0); }}
                className={`rounded-lg py-1.5 transition ${mode === "password" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >
                Password Login
              </button>
              <button
                type="button"
                onClick={() => { setMode("pin"); setError(""); setTimeout(() => (email ? pinRef.current?.focus() : null), 0); }}
                className={`rounded-lg py-1.5 transition ${mode === "pin" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >
                Staff PIN Quick Login
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Username or email</span>
                <span className="relative block">
                  <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (mode === "pin" && !pin) {
                          e.preventDefault();
                          pinRef.current?.focus();
                        } else if (mode === "password" && !password) {
                          e.preventDefault();
                          passwordRef.current?.focus();
                        }
                      }
                    }}
                    placeholder="admin@example.com or lab_username"
                    className="h-11 w-full rounded-xl border border-slate-200 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.18)]"
                  />
                </span>
              </label>

              {mode === "password" ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
                  <span className="relative block">
                    <LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={passwordRef}
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="h-11 w-full rounded-xl border border-slate-200 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.18)]"
                    />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </span>
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Staff Quick PIN (4–6 digits)</span>
                  <span className="relative block">
                    <KeyRound size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={pinRef}
                      type="password"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••"
                      className="h-11 w-full rounded-xl border border-slate-200 pl-11 pr-4 font-mono text-base tracking-[0.35em] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    />
                  </span>
                </label>
              )}

              {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

              <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Signing in..." : "Sign in securely"}</button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-400"><ShieldCheck size={14} /> Press Enter after username, then Enter to sign in</div>
          </div>
        </section>
      </div>
    </main>
  );
}
