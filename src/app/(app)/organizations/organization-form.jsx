"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Hash,
} from "lucide-react";
import { Select } from "@/components/ui";

const initialForm = {
  name: "",
  code: "",
  slug: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "Pakistan",
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
  icon: Icon,
  required = false,
  type = "text",
  textarea = false,
}) {
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
            className={`absolute left-3.5 text-gray-400 ${
              textarea ? "top-3.5" : "top-1/2 -translate-y-1/2"
            }`}
          />
        )}

        {textarea ? (
          <textarea
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-800 outline-none transition focus:border-slate-400 focus:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.18)]"
          />
        ) : (
          <input
            id={name}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-slate-400 focus:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.18)]"
          />
        )}
      </div>
    </div>
  );
}

export default function OrganizationForm({
  mode = "create",
  initialData = null,
}) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    ...initialForm,
    ...(initialData || {}),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => {
      const updated = { ...prev, [name]: value };

      if (name === "name" && !isEdit) {
        updated.slug = value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }

      return updated;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Organization name is required.");
      return;
    }

    if (!form.code.trim()) {
      setError("Organization code is required.");
      return;
    }

    setLoading(true);

    try {
      const url = isEdit
        ? `/api/organizations/${initialData.id}`
        : "/api/organizations";

      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          slug: form.slug.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          country: form.country.trim(),
          ...(!isEdit ? { username: form.username.trim(), password: form.password } : {}),
          ...(isEdit ? { status: form.status } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || `Request failed (${response.status})`,
        );
      }

      const organizationId =
        data.organization?.id || data.data?.id || data.id || initialData?.id;

      if (organizationId) {
        router.push(`/organizations/${organizationId}`);
      } else {
        router.push("/organizations");
      }

      router.refresh();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-7">
          <Link
            href={
              isEdit && initialData?.id
                ? `/organizations/${initialData.id}`
                : "/organizations"
            }
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={17} />
            Back
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <Building2 size={21} />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Organization Management
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                {isEdit ? "Edit Organization" : "Add Organization"}
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                {isEdit
                  ? "Update organization information and settings."
                  : "Register a new laboratory organization on the platform."}
              </p>
            </div>

            {isEdit && (
              <span
                className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                  form.status === "ACTIVE"
                    ? "bg-green-50 text-green-700"
                    : form.status === "SUSPENDED"
                      ? "bg-red-50 text-red-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {form.status}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Organization Information */}
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-5 sm:px-7">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      Basic Information
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Organization identity and registration details
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 px-5 py-6 sm:grid-cols-2 sm:px-7">
                <Field
                  label="Organization Name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. City Medical Laboratory"
                  icon={Building2}
                  required
                />

                <Field
                  label="Organization Code"
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  placeholder="e.g. CML001"
                  icon={Hash}
                  required
                />

                <Field
                  label="Organization Slug"
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  placeholder="city-medical-laboratory"
                  icon={Globe}
                />

                <Field
                  label="Email Address"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="info@example.com"
                  icon={Mail}
                  type="email"
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

                <div className="sm:col-span-2">
                  <Field
                    label="Complete Address"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Enter organization complete address"
                    icon={MapPin}
                    textarea
                  />
                </div>

                <Field
                  label="Country"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  placeholder="Pakistan"
                  icon={Globe}
                />

                {isEdit && (
                  <div className="space-y-2">
                    <label
                      htmlFor="status"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Organization Status
                    </label>

                    <Select
                      id="status"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspended</option>
                      <option value="INACTIVE">Inactive</option>
                    </Select>
                  </div>
                )}
              </div>
            </section>

            {!isEdit && (
              <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
                <div className="border-b border-blue-50 px-5 py-5 sm:px-7">
                  <h2 className="font-semibold text-gray-900">Organization Admin Login</h2>
                  <p className="mt-1 text-xs text-gray-500">Ye credentials organization ke Admin ko diye jayenge. Password database mein secure hash ki form mein save hoga.</p>
                </div>
                <div className="grid grid-cols-1 gap-5 px-5 py-6 sm:grid-cols-2 sm:px-7">
                  <Field label="Admin Username" name="username" value={form.username} onChange={handleChange} placeholder="e.g. citylab_admin" icon={Mail} required />
                  <Field label="Initial Password" name="password" value={form.password} onChange={handleChange} placeholder="Minimum 8 characters" icon={Hash} type="password" required />
                </div>
              </section>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle size={19} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                href={
                  isEdit && initialData?.id
                    ? `/organizations/${initialData.id}`
                    : "/organizations"
                }
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {isEdit ? "Save Changes" : "Create Organization"}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Footer Note */}
        <div className="mt-6 flex items-start gap-2 text-xs text-gray-400">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <p>
            Organization data is securely stored in the platform database.
            Required fields are marked with an asterisk.
          </p>
        </div>
      </div>
    </div>
  );
}
