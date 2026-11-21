import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireContext } from "@/lib/scope";
import { PageHeader, StatusBadge } from "@/components/ui";

export const instant = false;

export default async function AllBranchesPage() {
  const { actor, scope } = await requireContext(["SUPER_ADMIN", "ORGANIZATION_ADMIN"]);
  if (actor.role === "ORGANIZATION_ADMIN") redirect(`/organizations/${actor.organizationId}/branches`);

  const branches = await prisma.branch.findMany({
    where: scope.organizationId ? { organizationId: scope.organizationId } : {},
    orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
    take: 500,
    select: { id: true, name: true, code: true, city: true, status: true, isHeadOffice: true, organizationId: true, organization: { select: { name: true } }, _count: { select: { patients: true, orders: true } } },
  });

  return (
    <>
      <PageHeader title="All Branches" description={scope.organizationId ? "Branches of the selected organization." : "Branches across every organization."} />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {branches.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">No branches found.</p> : (
          <>
            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:hidden">
              {branches.map((b) => <article key={b.id} className="min-w-0 rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words font-semibold text-slate-900">{b.name}{b.isHeadOffice && <span className="ml-2 text-[10px] font-bold uppercase text-blue-600">Head Office</span>}</p><p className="text-xs text-slate-400">{b.code}</p></div><StatusBadge value={b.status} /></div>
                <p className="mt-2 break-words text-sm text-slate-600">{b.organization.name}</p><p className="text-xs text-slate-400">{b.city || "City not set"}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600"><span>{b._count.patients} patients</span><span>{b._count.orders} orders</span></div>
                <Link href={`/organizations/${b.organizationId}/branches`} className="mt-3 inline-flex text-xs font-semibold text-blue-600">Manage branch</Link>
              </article>)}
            </div>
            <div className="hidden xl:block"><table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Organization</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Patients</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"> </th></tr></thead>
              <tbody className="divide-y divide-slate-100">{branches.map((b) => <tr key={b.id} className="hover:bg-slate-50/60"><td className="break-words px-4 py-3"><p className="font-semibold text-slate-800">{b.name}{b.isHeadOffice && <span className="ml-2 text-[10px] font-bold uppercase text-blue-600">HQ</span>}</p><p className="text-xs text-slate-400">{b.code}</p></td><td className="break-words px-4 py-3 text-slate-600">{b.organization.name}</td><td className="px-4 py-3 text-slate-600">{b.city || "—"}</td><td className="px-4 py-3">{b._count.patients}</td><td className="px-4 py-3">{b._count.orders}</td><td className="px-4 py-3"><StatusBadge value={b.status} /></td><td className="px-4 py-3 text-right"><Link href={`/organizations/${b.organizationId}/branches`} className="text-xs font-semibold text-blue-600">Manage</Link></td></tr>)}</tbody>
            </table></div>
          </>
        )}
      </div>
    </>
  );
}
