"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Plus,
  Search,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  Star,
  GitBranch,
  AlertCircle,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
        <Icon size={21} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  await response.text();
  throw new Error(
    `API ne JSON ke bajaye HTML/text return kiya (HTTP ${response.status}). API route aur URL check karein.`,
  );
}

export default function BranchesClient({ organization }) {
  const organizationId = organization.id;
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchToDelete, setBranchToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/branches`,
        {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status}).`);
      }

      setBranches(Array.isArray(data.branches) ? data.branches : []);
    } catch (err) {
      setError(err.message || "Branches load nahi ho sakin.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const filteredBranches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return branches;

    return branches.filter((branch) =>
      [branch.name, branch.code, branch.city, branch.address, branch.phone, branch.email]
        .some((value) => value?.toLowerCase().includes(term)),
    );
  }, [branches, search]);

  const headOfficeCount = branches.filter((branch) => branch.isHeadOffice).length;

  const handleDeleteBranch = async () => {
    if (!branchToDelete) return;

    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/branches/${branchToDelete.id}`,
        { method: "DELETE", headers: { Accept: "application/json" } },
      );
      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.message || `Delete failed (${response.status}).`);
      }

      setBranchToDelete(null);
      await loadBranches();
    } catch (err) {
      setDeleteError(err.message || "Branch delete nahi ho saki.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href={`/organizations/${organizationId}`}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft size={17} />
          Back to Organization
        </Link>

        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
              <Building2 size={15} />
              {organization.name}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Branch Management
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage all branches registered under this organization.
            </p>
          </div>

          {organization.status === "ACTIVE" ? (
            <Link
              href={`/organizations/${organizationId}/branches/new`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Branch
            </Link>
          ) : (
            <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              Organization is {organization.status.toLowerCase()}
            </span>
          )}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={GitBranch} label="Total Branches" value={branches.length} color="bg-blue-50 text-blue-600" />
          <StatCard icon={Star} label="Head Office" value={headOfficeCount} color="bg-amber-50 text-amber-600" />
          <StatCard icon={Building2} label="Organization Code" value={organization.code} color="bg-purple-50 text-purple-600" />
        </div>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="font-semibold text-gray-900">All Branches</h2>
              <p className="mt-1 text-xs text-gray-500">
                {filteredBranches.length} of {branches.length} branch(es)
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search branches..."
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 sm:w-64"
                />
              </div>

              <button
                type="button"
                onClick={loadBranches}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="m-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Branches load nahi ho sakin</p>
                <p className="mt-1">{error}</p>
                <button type="button" onClick={loadBranches} className="mt-3 font-semibold underline">
                  Try again
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-500">
              <Loader2 size={21} className="animate-spin" />
              Loading branches...
            </div>
          ) : !error && filteredBranches.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <GitBranch size={30} />
              </div>
              <h3 className="font-semibold text-gray-900">
                {search ? "No branches found" : "No branches yet"}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-gray-500">
                {search
                  ? "Try another branch name, code, city, or contact detail."
                  : "This organization has no branches yet. Add its first branch to get started."}
              </p>
              {!search && organization.status === "ACTIVE" && (
                <Link
                  href={`/organizations/${organizationId}/branches/new`}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Plus size={17} />
                  Add First Branch
                </Link>
              )}
            </div>
          ) : !loading && !error ? (
            <div className="divide-y divide-gray-100">
              {filteredBranches.map((branch) => (
                <div key={branch.id} className="flex flex-col gap-4 p-5 transition hover:bg-gray-50/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Building2 size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                        {branch.isHeadOffice && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                            <Star size={12} /> Head Office
                          </span>
                        )}
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${branch.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {branch.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">Branch Code: {branch.code}</p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">
                        {branch.city && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{branch.city}</span>}
                        {branch.phone && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{branch.phone}</span>}
                        {branch.email && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{branch.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      href={`/organizations/${organizationId}/branches/${branch.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Eye size={16} /> View
                    </Link>
                    <Link
                      href={`/organizations/${organizationId}/branches/${branch.id}/edit`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                    >
                      <Pencil size={15} /> Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => { setDeleteError(""); setBranchToDelete(branch); }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <p className="mt-6 text-center text-xs text-gray-400">LabOS Branch Management</p>
      </div>

      {branchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-branch-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Trash2 size={21} />
              </div>
              <button type="button" onClick={() => setBranchToDelete(null)} disabled={deleting} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <h2 id="delete-branch-title" className="text-lg font-semibold text-gray-900">Delete {branchToDelete.name}?</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">This action permanently deletes this branch. A branch with assigned users cannot be deleted until its memberships are removed or reassigned.</p>
            {deleteError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setBranchToDelete(null)} disabled={deleting} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleDeleteBranch} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? "Deleting..." : "Delete Branch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
