import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Hash,
  Mail,
  Phone,
  MapPin,
  Star,
  CalendarDays,
  Activity,
  Pencil,
} from "lucide-react";

import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const instant = false;

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex gap-3 rounded-xl border border-gray-100 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-gray-800">{value || "Not provided"}</p>
      </div>
    </div>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-PK", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default async function BranchDetailsPage({ params }) {
  const admin = await getAdminSession();
  if (!admin) redirect("/login");

  const { id, branchId } = await params;
  if (!uuidRegex.test(id) || !uuidRegex.test(branchId)) notFound();

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId: id },
    include: {
      organization: {
        select: { id: true, name: true, code: true },
      },
      _count: { select: { memberships: true } },
    },
  });

  if (!branch) notFound();

  const backUrl = `/organizations/${id}/branches`;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href={backUrl} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900">
          <ArrowLeft size={17} /> Back to Branches
        </Link>

        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Building2 size={27} />
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
                {branch.organization.name}
                {branch.isHeadOffice && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700"><Star size={12} className="mr-1 inline" />Head Office</span>}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{branch.name}</h1>
              <p className="mt-1 text-sm text-gray-500">Branch Code: {branch.code}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${branch.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
              {branch.status}
            </span>
            <Link
              href={`${backUrl}/${branch.id}/edit`}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Pencil size={16} /> Edit Branch
            </Link>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{branch._count.memberships}</p>
            <p className="mt-1 text-sm text-gray-500">Assigned Users</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{branch.isHeadOffice ? "Yes" : "No"}</p>
            <p className="mt-1 text-sm text-gray-500">Head Office</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{branch.organization.code}</p>
            <p className="mt-1 text-sm text-gray-500">Organization Code</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-5 sm:px-7">
            <h2 className="font-semibold text-gray-900">Branch Information</h2>
            <p className="mt-1 text-xs text-gray-500">Branch registration and contact details.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-7">
            <Detail icon={Building2} label="Branch Name" value={branch.name} />
            <Detail icon={Hash} label="Branch Code" value={branch.code} />
            <Detail icon={Mail} label="Email Address" value={branch.email} />
            <Detail icon={Phone} label="Phone Number" value={branch.phone} />
            <Detail icon={MapPin} label="City" value={branch.city} />
            <Detail icon={MapPin} label="Complete Address" value={branch.address} />
            <Detail icon={Activity} label="Status" value={branch.status} />
            <Detail icon={CalendarDays} label="Created On" value={formatDate(branch.createdAt)} />
          </div>
        </section>
      </div>
    </main>
  );
}
