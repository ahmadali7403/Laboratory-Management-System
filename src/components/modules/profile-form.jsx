"use client";

import { useEffect, useState } from "react";
import {
  UserRound,
  Mail,
  AtSign,
  LockKeyhole,
  Save,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";

export default function ProfileForm() {
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [role, setRole] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/profile");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || data.error || "Profile load nahi ho saka.",
          );
        }

        setForm((prev) => ({
          ...prev,
          name: data.profile?.name || "",
          username: data.profile?.username || "",
          email: data.profile?.email || "",
        }));

        setRole(data.profile?.role || "");
      } catch (error) {
        setMessage({ type: "error", text: error.message });
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!form.currentPassword) {
      setMessage({
        type: "error",
        text: "Changes save karne ke liye current password enter karein.",
      });
      return;
    }

    if (role !== "SUPER_ADMIN" && !form.username.trim()) {
      setMessage({
        type: "error",
        text: "Username required hai. Login ke liye username zaroori hai.",
      });
      return;
    }

    if (form.newPassword && form.newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "New password kam az kam 8 characters ka hona chahiye.",
      });
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setMessage({
        type: "error",
        text: "New password aur confirm password match nahi karte.",
      });
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          email: form.email,
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Profile update nahi ho saka.",
        );
      }

      setForm((prev) => ({
        ...prev,
        name: data.profile?.name || "",
        username: data.profile?.username || "",
        email: data.profile?.email || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));

      setMessage({
        type: "success",
        text: data.message || "Profile successfully update ho gaya.",
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Apni personal information aur login credentials manage karein.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="rounded-lg bg-blue-50 p-2.5">
              <UserRound className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                Personal Information
              </h2>
              <p className="text-xs text-gray-500">
                Your account identity details
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Full Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className={inputClass}
                placeholder="Enter your name"
                minLength={2}
                maxLength={80}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Username</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  className={`${inputClass} pl-9`}
                  placeholder="your.username"
                  minLength={3}
                  maxLength={30}
                  required={role !== "SUPER_ADMIN"}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Letters, numbers, dots, _ and - allowed.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className={`${inputClass} pl-9`}
                  placeholder="admin@example.com"
                  required
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="rounded-lg bg-purple-50 p-2.5">
              <LockKeyhole className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Change Password</h2>
              <p className="text-xs text-gray-500">
                Leave new password empty if you do not want to change it.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Current Password *</label>
              <input
                type="password"
                name="currentPassword"
                value={form.currentPassword}
                onChange={handleChange}
                className={inputClass}
                placeholder="Enter current password"
                required
                autoComplete="current-password"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords ? "text" : "password"}
                    name="newPassword"
                    value={form.newPassword}
                    onChange={handleChange}
                    className={`${inputClass} pr-10`}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => !prev)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-700"
                    aria-label={
                      showPasswords ? "Hide passwords" : "Show passwords"
                    }
                  >
                    {showPasswords ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Confirm New Password</label>
                <input
                  type={showPasswords ? "text" : "password"}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                Account Security
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-600">
                Profile update karne ke liye current password verify hoga.
                Username aur email dono se login kiya ja sakta hai.
              </p>
            </div>
          </div>
        </div>

        {message.text && (
          <div
            role="alert"
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
