"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Pencil, Save, ShieldCheck } from "lucide-react";

export default function AccountCredentials({ title, username, endpoint }) {
  const [currentUsername, setCurrentUsername] = useState(
    username || "Not configured",
  );
  const [editing, setEditing] = useState(false);
  const [newUsername, setNewUsername] = useState(username || "");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [revealedPassword, setRevealedPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function toggleExistingPassword() {
    setError("");
    setMessage("");

    if (passwordVisible) {
      setPasswordVisible(false);
      setRevealedPassword("");
      return;
    }

    setRevealLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Password load nahi ho saka.");
      }

      if (!data.password) {
        throw new Error(
          data.message ||
            "Password available nahi. Pehle password reset karein.",
        );
      }

      setRevealedPassword(data.password);
      setPasswordVisible(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setRevealLoading(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = {};

      if (newUsername.trim() && newUsername.trim() !== currentUsername) {
        payload.username = newUsername.trim();
      }

      if (newPassword) {
        payload.password = newPassword;
      }

      if (!Object.keys(payload).length) {
        throw new Error("Username ya naya password enter karein.");
      }

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Account update nahi ho saka.");
      }

      if (data.account?.username) {
        setCurrentUsername(data.account.username);
        setNewUsername(data.account.username);
      }

      setNewPassword("");
      setEditing(false);
      setShowPassword(false);
      setPasswordVisible(false);
      setRevealedPassword("");
      setMessage("Account successfully update ho gaya.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
            <ShieldCheck size={20} />
          </span>

          <div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Username visible hai; password secure hash mein stored hai.
            </p>
          </div>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setError("");
              setMessage("");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Pencil size={15} />
            Manage Credentials
          </button>
        )}
      </div>

      <div className="p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500">Login Username</p>
            <p className="mt-2 break-all text-sm font-semibold text-gray-900">
              {currentUsername}
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500">Password</p>

            <div className="mt-2 flex min-h-6 items-center justify-between gap-3">
              <p className="break-all text-sm font-semibold text-gray-700">
                {passwordVisible ? revealedPassword : "••••••••••••"}
              </p>

              <button
                type="button"
                onClick={toggleExistingPassword}
                disabled={revealLoading}
                title={passwordVisible ? "Hide password" : "View password"}
                aria-label={passwordVisible ? "Hide password" : "View password"}
                className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50"
              >
                {revealLoading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : passwordVisible ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </div>

            <p className="mt-1 text-[11px] text-gray-400">
              Eye icon se existing password dekhein.
            </p>
          </div>
        </div>

        {editing && (
          <form
            onSubmit={save}
            className="mt-5 space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-gray-700">
                  New Username
                </span>

                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  minLength={3}
                  maxLength={40}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.18)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-gray-700">
                  New Password (optional)
                </span>

                <span className="relative block">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    maxLength={100}
                    placeholder="At least 8 characters"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm text-gray-900 outline-none focus:border-slate-400 focus:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.18)]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>
            </div>

            <p className="text-xs text-gray-500">
              Password blank chhorne par current password change nahi hoga.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Save Credentials
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setNewUsername(currentUsername);
                  setNewPassword("");
                  setShowPassword(false);
                  setError("");
                }}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      </div>
    </section>
  );
}
