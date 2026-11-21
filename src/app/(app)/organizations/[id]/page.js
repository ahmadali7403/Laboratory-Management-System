import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowLeft,
  Building2,
  Pencil,
  Mail,
  Phone,
  MapPin,
  Globe,
  Hash,
  GitBranch,
  Users,
  ShieldCheck,
  CalendarDays,
  Clock,
  Activity,
} from "lucide-react";

import { requireContext } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import AccountCredentials from "@/components/account-credentials";

export const instant = false;

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex gap-3 rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon size={19} />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400">{label}</p>

        <p className="mt-1 break-words text-sm font-semibold text-gray-800">
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${color}`}
      >
        <Icon size={21} />
      </div>

      <p className="text-2xl font-bold text-gray-900">{value}</p>

      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}

function formatDate(date) {
  if (!date) return "Not available";

  return new Intl.DateTimeFormat("en-PK", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export default async function OrganizationDetailsPage({ params }) {
  await requireContext(["SUPER_ADMIN"]);

  const { id } = await params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    notFound();
  }

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          branches: true,
          users: true,
          roles: true,
        },
      },
      users: {
        where: { userRoles: { some: { role: { name: "ORGANIZATION_ADMIN" } } } },
        select: { username: true },
        take: 1,
      },
    },
  });

  if (!organization) {
    notFound();
  }

  const statusStyles = {
    ACTIVE: "bg-green-50 text-green-700 ring-green-600/20",
    SUSPENDED: "bg-red-50 text-red-700 ring-red-600/20",
    INACTIVE: "bg-gray-100 text-gray-600 ring-gray-500/20",
  };

  const statusStyle =
    statusStyles[organization.status] || statusStyles.INACTIVE;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Back */}
        <Link
          href="/organizations"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft size={17} />
          Back to Organizations
        </Link>

        {/* Header */}
        <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Building2 size={27} />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Organization Details
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyle}`}
                >
                  {organization.status}
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                {organization.name}
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Organization Code: {organization.code}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/organizations/${organization.id}/branches`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <GitBranch size={17} />
              Manage Branches
            </Link>

            <Link
              href={`/organizations/${organization.id}/edit`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Pencil size={17} />
              Edit Organization
            </Link>
          </div>
        </div>

        {/* Statistics */}
        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={GitBranch}
            label="Total Branches"
            value={organization._count.branches}
            color="bg-blue-50 text-blue-600"
          />

          <StatCard
            icon={Users}
            label="Total Users"
            value={organization._count.users}
            color="bg-purple-50 text-purple-600"
          />

          <StatCard
            icon={ShieldCheck}
            label="Total Roles"
            value={organization._count.roles}
            color="bg-emerald-50 text-emerald-600"
          />
        </div>

        <div className="mb-6">
          <AccountCredentials
            title="Organization Admin Account"
            username={organization.users[0]?.username || ""}
            endpoint={`/api/organizations/${organization.id}/account`}
          />
        </div>

        {/* Organization Information */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                <Building2 size={20} />
              </div>

              <div>
                <h2 className="font-semibold text-gray-900">
                  Organization Information
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  Basic registration and contact details
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-7">
            <InfoItem
              icon={Building2}
              label="Organization Name"
              value={organization.name}
            />

            <InfoItem
              icon={Hash}
              label="Organization Code"
              value={organization.code}
            />

            <InfoItem
              icon={Globe}
              label="Organization Slug"
              value={organization.slug}
            />

            <InfoItem
              icon={Mail}
              label="Email Address"
              value={organization.email}
            />

            <InfoItem
              icon={Phone}
              label="Phone Number"
              value={organization.phone}
            />

            <InfoItem icon={MapPin} label="City" value={organization.city} />

            <InfoItem
              icon={Globe}
              label="Country"
              value={organization.country}
            />

            <InfoItem
              icon={MapPin}
              label="Complete Address"
              value={organization.address}
            />
          </div>
        </div>

        {/* Branch Management Shortcut */}
        <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white p-3 text-blue-600 shadow-sm">
                <GitBranch size={22} />
              </div>

              <div>
                <h2 className="font-semibold text-gray-900">
                  Organization Branches
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  Manage all physical laboratory locations belonging to this
                  organization.
                </p>

                <p className="mt-2 text-xs font-medium text-blue-700">
                  {organization._count.branches} registered branch(es)
                </p>
              </div>
            </div>

            <Link
              href={`/organizations/${organization.id}/branches`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <GitBranch size={17} />
              Open Branches
            </Link>
          </div>
        </div>

        {/* System Information */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600">
                <Activity size={20} />
              </div>

              <div>
                <h2 className="font-semibold text-gray-900">
                  System Information
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  Organization registration history
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-7">
            <InfoItem
              icon={CalendarDays}
              label="Created On"
              value={formatDate(organization.createdAt)}
            />

            <InfoItem
              icon={Clock}
              label="Last Updated"
              value={formatDate(organization.updatedAt)}
            />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          LabOS Organization Management System
        </p>
      </div>
    </div>
  );
}
