import { redirect } from "next/navigation";
import { requireContext } from "@/lib/scope";
import { buildNav, flattenNav } from "@/lib/nav";

export const instant = false;

// Landing page of staff members: sends them to the first screen their role allows
// (the order counter first), or explains that no module has been assigned yet.
export default async function HomePage() {
  const ctx = await requireContext(["STAFF"]);
  const links = flattenNav(buildNav(ctx))
    .map((i) => i.href.split("?")[0])
    .filter((h) => h !== "/home" && h !== "/notifications");
  const target = links.includes("/orders/new")
    ? "/orders/new"
    : links.includes("/pharmacy/pos")
      ? "/pharmacy/pos"
      : links[0];
  if (target) redirect(target);
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
      <h1 className="text-base font-bold text-slate-800">Welcome, {ctx.actor.name}</h1>
      <p className="mt-2 text-sm text-slate-500">No module has been assigned to your role yet. Please ask your administrator to update your role permissions.</p>
    </div>
  );
}
