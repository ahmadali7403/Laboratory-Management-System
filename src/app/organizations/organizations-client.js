"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Building2,
  Check,
  Clock3,
  Edit3,
  Eye,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
  AlertTriangle,
} from "lucide-react";

const statusStyles = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  SUSPENDED: "bg-amber-50 text-amber-700 ring-amber-600/20",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

function StatCard({ label, value, icon: Icon, tone }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon size={19} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

export default function OrganizationsClient({ adminName }) {
  const [organizations, setOrganizations] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    inactive: 0,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) params.set("search", search.trim());
      if (status !== "ALL") params.set("status", status);

      const response = await fetch(`/api/organizations?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Organizations load nahi ho sakin.");
      }

      setOrganizations(data.organizations || []);
      setStats(
        data.stats || {
          total: 0,
          active: 0,
          suspended: 0,
          inactive: 0,
        },
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = setTimeout(loadOrganizations, 250);
    return () => clearTimeout(timer);
  }, [loadOrganizations]);

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const askStatusChange = (organization) => {
    const nextStatus =
      organization.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    setPendingAction({
      type: "status",
      organization,
      nextStatus,
    });
  };

  const askDelete = (organization) => {
    setPendingAction({
      type: "delete",
      organization,
    });
  };

  const closeDialog = () => {
    if (!actionLoading) setPendingAction(null);
  };

  const confirmAction = async () => {
    if (!pendingAction) return;

    setActionLoading(true);
    setError("");

    const { organization, type, nextStatus } = pendingAction;

    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: type === "delete" ? "DELETE" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        ...(type === "status"
          ? { body: JSON.stringify({ status: nextStatus }) }
          : {}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Action complete nahi ho saka.");
      }

      setPendingAction(null);
      setNotice(data.message || "Action successfully complete ho gaya.");

      await loadOrganizations();
    } catch (err) {
      setPendingAction(null);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={18} />
            </Link>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <ShieldCheck size={21} />
            </div>

            <div>
              <p className="text-base font-bold leading-tight">LabOS</p>
              <p className="text-xs text-slate-500">Platform Administration</p>
            </div>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="text-sm font-semibold text-slate-800">{adminName}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
              <Building2 size={16} />
              PLATFORM / ORGANIZATIONS
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Organizations
            </h1>

            <p className="mt-1.5 text-sm text-slate-500">
              Manage laboratory companies and their platform access.
            </p>
          </div>

          <Link
            href="/organizations/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Add organization
          </Link>
        </div>

        {notice && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <Check size={17} />
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              aria-label="Dismiss"
              className="shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total organizations"
            value={stats.total}
            icon={Building2}
            tone="blue"
          />
          <StatCard
            label="Active"
            value={stats.active}
            icon={Check}
            tone="green"
          />
          <StatCard
            label="Suspended"
            value={stats.suspended}
            icon={Clock3}
            tone="amber"
          />
          <StatCard
            label="Inactive"
            value={stats.inactive}
            icon={Activity}
            tone="slate"
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="font-semibold text-slate-900">
                All organizations
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {organizations.length} records shown
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, code, city..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:w-64"
                />
              </div>

              <div className="relative">
                <SlidersHorizontal
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-700 outline-none focus:border-blue-500 sm:w-40"
                >
                  <option value="ALL">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <button
                onClick={loadOrganizations}
                disabled={loading}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-16 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : organizations.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Building2 size={25} />
              </div>

              <h3 className="mt-4 font-semibold text-slate-900">
                No organizations found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Create your first laboratory organization to get started.
              </p>

              <Link
                href="/organizations/new"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                <Plus size={16} />
                Add organization
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Organization</th>
                    <th className="px-5 py-3.5 font-semibold">Contact</th>
                    <th className="px-5 py-3.5 font-semibold">
                      Branches / Users
                    </th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {organizations.map((org) => (
                    <tr
                      key={org.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                            {org.name?.slice(0, 1)?.toUpperCase()}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-900">
                              {org.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {org.code}
                              <span className="mx-1 text-slate-300">•</span>
                              {org.slug}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="flex items-center gap-1.5 text-sm text-slate-700">
                          {org.email ? (
                            <>
                              <Mail size={13} className="text-slate-400" />
                              {org.email}
                            </>
                          ) : (
                            "—"
                          )}
                        </p>

                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          {org.city ? (
                            <>
                              <MapPin size={12} />
                              {org.city}, {org.country}
                            </>
                          ) : (
                            org.phone || "No location added"
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 size={14} className="text-slate-400" />
                            {org._count?.branches ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Users size={14} className="text-slate-400" />
                            {org._count?.users ?? 0}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                            statusStyles[org.status] || statusStyles.INACTIVE
                          }`}
                        >
                          {org.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/organizations/${org.id}`}
                            title="View organization"
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-white"
                          >
                            <Eye size={14} />
                            View
                          </Link>

                          <Link
                            href={`/organizations/${org.id}/edit`}
                            title="Edit organization"
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-white"
                          >
                            <Edit3 size={14} />
                            Edit
                          </Link>

                          <button
                            onClick={() => askStatusChange(org)}
                            className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-white"
                          >
                            {org.status === "ACTIVE" ? "Suspend" : "Activate"}
                          </button>

                          <button
                            onClick={() => askDelete(org)}
                            title="Delete organization"
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              Organizations with linked records cannot be permanently deleted.
            </span>
            <span>{organizations.length} shown</span>
          </div>
        </section>
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="p-6">
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                  pendingAction.type === "delete"
                    ? "bg-rose-50 text-rose-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {pendingAction.type === "delete" ? (
                  <Trash2 size={23} />
                ) : (
                  <AlertTriangle size={23} />
                )}
              </div>

              <h2
                id="confirmation-title"
                className="text-lg font-bold text-slate-900"
              >
                {pendingAction.type === "delete"
                  ? "Delete organization?"
                  : pendingAction.nextStatus === "SUSPENDED"
                    ? "Suspend organization?"
                    : "Activate organization?"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {pendingAction.type === "delete" ? (
                  <>
                    Kya aap <strong>{pendingAction.organization.name}</strong>{" "}
                    ko permanently delete karna chahte hain? Sirf woh
                    organization delete ho sakti hai jiske saath branches, users
                    ya roles linked na hon.
                  </>
                ) : (
                  <>
                    Kya aap <strong>{pendingAction.organization.name}</strong>{" "}
                    ko{" "}
                    {pendingAction.nextStatus === "SUSPENDED"
                      ? "suspend"
                      : "dobara activate"}{" "}
                    karna chahte hain?
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDialog}
                disabled={actionLoading}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmAction}
                disabled={actionLoading}
                className={`h-10 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60 ${
                  pendingAction.type === "delete"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {actionLoading
                  ? "Please wait..."
                  : pendingAction.type === "delete"
                    ? "Yes, delete"
                    : pendingAction.nextStatus === "SUSPENDED"
                      ? "Yes, suspend"
                      : "Yes, activate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
