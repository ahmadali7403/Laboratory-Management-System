"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Hash,
  Mail,
  Phone,
  MapPin,
  Star,
  Eye,
  EyeOff,
} from "lucide-react";

const initialValues = {
  name: "",
  code: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  isHeadOffice: false,
  status: "ACTIVE",
  username: "",
  password: "",
};

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  icon: Icon,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="space-y-2">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <div className="relative">
        {Icon && (
          <Icon
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
        )}

        <input
          id={name}
          name={name}
          type={isPassword && showPassword ? "text" : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={`w-full rounded-xl border border-gray-200 bg-white py-3 ${
            isPassword ? "pr-11" : "pr-4"
          } pl-10 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-blue-600"
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
    </div>
  );
}

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      `API response JSON nahi hai (HTTP ${response.status}). API route check karein.`,
    );
  }

  return response.json();
}

export default function BranchForm({
  organization,
  initialData = null,
  mode = "create",
}) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [form, setForm] = useState(() =>
    initialData
      ? {
          name: initialData.name || "",
          code: initialData.code || "",
          email: initialData.email || "",
          phone: initialData.phone || "",
          address: initialData.address || "",
          city: initialData.city || "",
          isHeadOffice: Boolean(initialData.isHeadOffice),
          status: initialData.status || "ACTIVE",
        }
      : { ...initialValues },
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.name.trim().length < 2) {
      setError("Branch name kam az kam 2 characters ka hona chahiye.");
      return;
    }

    if (form.code.trim().length < 2) {
      setError("Branch code kam az kam 2 characters ka hona chahiye.");
      return;
    }

    if (!isEdit && form.password.length < 8) {
      setError("Password kam az kam 8 characters ka hona chahiye.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit
        ? `/api/organizations/${organization.id}/branches/${initialData.id}`
        : `/api/organizations/${organization.id}/branches`;

      const response = await fetch(endpoint, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          ...(!isEdit
            ? {
                username: form.username.trim(),
                password: form.password,
              }
            : {}),
          ...(isEdit ? { status: form.status } : {}),
        }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status}).`);
      }

      setForm({ ...initialValues });

      router.push(`/organizations/${organization.id}/branches`);
      router.refresh();
    } catch (err) {
      setError(err.message || "Branch create nahi ho saki.");
    } finally {
      setLoading(false);
    }
  }

  const backUrl = `/organizations/${organization.id}/branches`;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href={backUrl}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={17} />
          Back to Branches
        </Link>

        <div className="mb-7">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <Building2 size={15} />
            {organization.name}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {isEdit ? "Edit Branch" : "Add New Branch"}
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            {isEdit
              ? "Update this branch's details and operational status."
              : "Register another laboratory location under this organization."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-5 sm:px-7">
              <h2 className="font-semibold text-gray-900">
                Branch Information
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Enter branch identity, contact and location details.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 px-5 py-6 sm:grid-cols-2 sm:px-7">
              <Field
                label="Branch Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Gulberg Branch"
                icon={Building2}
                required
              />

              <Field
                label="Branch Code"
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="e.g. GLB001"
                icon={Hash}
                required
              />

              <Field
                label="Email Address"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="branch@example.com"
                type="email"
                icon={Mail}
              />

              <Field
                label="Phone Number"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+92 300 1234567"
                icon={Phone}
              />

              <Field
                label="City"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="e.g. Lahore"
                icon={MapPin}
              />

              {isEdit && (
                <div className="space-y-2">
                  <label
                    htmlFor="status"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Branch Status
                  </label>

                  <select
                    id="status"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <label
                  htmlFor="address"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Complete Address
                </label>

                <textarea
                  id="address"
                  name="address"
                  rows={3}
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Enter complete branch address"
                  className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:col-span-2">
                <input
                  type="checkbox"
                  name="isHeadOffice"
                  checked={form.isHeadOffice}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />

                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Star size={15} className="text-amber-600" />
                    Mark as Head Office
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-gray-600">
                    Organization mein ek waqt mein sirf ek branch Head Office ho
                    sakti hai. Nayi Head Office select karne par purani
                    designation remove ho jayegi.
                  </span>
                </span>
              </label>
            </div>
          </section>

          {!isEdit && (
            <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <div className="border-b border-blue-50 px-5 py-5 sm:px-7">
                <h2 className="font-semibold text-gray-900">
                  Branch Admin Login
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Branch Admin ko sirf isi branch ka access milega. Password
                  secure hash ki form mein save hoga.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 px-5 py-6 sm:grid-cols-2 sm:px-7">
                <Field
                  label="Branch Admin Username"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="e.g. gulberg_admin"
                  icon={Mail}
                  required
                />

                <Field
                  label="Initial Password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 characters"
                  icon={Hash}
                  type="password"
                  required
                />
              </div>
            </section>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href={backUrl}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  {isEdit ? "Save Changes" : "Create Branch"}
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 flex items-start gap-2 text-xs text-gray-400">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          Branch record organization ke saath database mein save hogi. Branch
          code isi organization ke andar unique hona chahiye.
        </div>
      </div>
    </main>
  );
}
