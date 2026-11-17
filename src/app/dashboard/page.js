import { redirect } from "next/navigation";
import { getAdminSession, destroyAdminSession } from "@/lib/auth";
import Link from "next/link";
import { ShieldCheck, Building2, Users, Activity, LogOut, ArrowUpRight } from "lucide-react";

// Allow this route to use uncached, request-time data.
export const instant = false;

export default async function DashboardPage() {
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/login");
  }

  async function logout() {
    "use server";

    await destroyAdminSession();
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <ShieldCheck size={23} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-900">LabOS</h1>
              <p className="text-xs text-slate-500">Platform Administration</p>
            </div>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut size={17} />
              Logout
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600">SUPER ADMIN PANEL</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            Welcome, {admin.name}
          </h2>
          <p className="mt-2 text-slate-500">
            Manage your laboratory organizations and platform.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Organizations",
              description: "Manage laboratory organizations.",
              icon: Building2,
            },
            {
              title: "Branches",
              description: "Manage branches across organizations.",
              icon: Activity,
            },
            {
              title: "Platform Users",
              description: "Manage platform administration users.",
              icon: Users,
            },
          ].map((item) => {
            const Icon = item.icon;

            const cardContent = (
              <>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
                  {item.title === "Organizations" ? <>Manage organizations <ArrowUpRight size={15} /></> : "Coming soon"}
                </span>
              </>
            );

            return item.title === "Organizations" ? (
              <Link
                key={item.title}
                href="/organizations"
                className="group block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                {cardContent}
              </Link>
            ) : (
              <div key={item.title} className="cursor-not-allowed rounded-2xl border border-slate-200 bg-white p-6 opacity-80 shadow-sm">
                {cardContent}
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900">Account Information</h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="mt-1 font-medium text-slate-800">{admin.name}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="mt-1 font-medium text-slate-800">{admin.email}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Role</p>
              <p className="mt-1 font-medium text-blue-600">{admin.role}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
