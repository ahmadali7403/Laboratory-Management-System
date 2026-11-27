import { prisma } from "@/lib/prisma";
import { getPageContext, scopeWhere } from "@/lib/scope";
import { buildNav, buildQuick } from "@/lib/nav";
import ProfileMenu from "@/components/profile-menu";
import QuickAdd from "@/components/quick-add";
import Sidebar from "@/components/sidebar";
import NotificationBell from "@/components/notification-bell";
import SessionKeepAlive from "@/components/session-keepalive";
import SessionLock from "@/components/session-lock";
import ScopeSelector from "@/components/scope-selector";
import AppMain from "@/components/app-main";
import { UIProvider } from "@/components/ui";
import { RecordViewProvider } from "@/components/record-view";
import KeyboardNav from "@/components/keyboard-nav";
import { flattenNavLinks } from "@/lib/shortcuts";
import { memo } from "@/lib/memo";

const ROLE_LABEL = {
  SUPER_ADMIN: "Platform Administration",
  ORGANIZATION_ADMIN: "Organization Workspace",
  BRANCH_ADMIN: "Branch Workspace",
  STAFF: "Staff Workspace",
};

export default async function AppShell({ children }) {
  const ctx = await getPageContext();

  if (!ctx) return <UIProvider>{children}</UIProvider>;

  const { actor, scope } = ctx;

  const [unread, org, branch] = await Promise.all([
    prisma.notification.count({
      where: {
        AND: [scopeWhere(scope, { shared: true }), { isRead: false }],
      },
    }),

    scope.organizationId
      ? memo(`orgname:${scope.organizationId}`, 60_000, () =>
          prisma.organization.findUnique({
            where: { id: scope.organizationId },
            select: { name: true },
          }),
        )
      : null,

    scope.branchId
      ? memo(`branchname:${scope.branchId}`, 60_000, () =>
          prisma.branch.findUnique({
            where: { id: scope.branchId },
            select: { name: true },
          }),
        )
      : null,
  ]);

  const nav = buildNav(ctx);
  const hotkeyLinks = flattenNavLinks(nav);

  const viewing =
    scope.level === "PLATFORM"
      ? "Viewing: whole platform"
      : scope.level === "ORGANIZATION"
        ? `Viewing: ${org?.name} · all branches`
        : `Viewing: ${org?.name} · ${branch?.name}`;

  return (
    <UIProvider>
      <RecordViewProvider>
      <SessionKeepAlive />
      <SessionLock userName={actor.name} mustChangePassword={Boolean(actor.mustChangePassword)} />
      <KeyboardNav navLinks={hotkeyLinks} />

      <div className="flex h-[100dvh] min-w-0 max-w-full overflow-hidden bg-slate-100 print:block print:h-auto print:overflow-visible">
        <Sidebar
          items={nav}
          unread={unread}
          roleLabel={ROLE_LABEL[actor.role]}
        />

        <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-clip print:block">
          <header className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white py-1 pl-11 pr-2 lg:pr-3 print:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <QuickAdd actions={buildQuick(nav)} />

              <p className="truncate text-xs font-semibold text-slate-500">
                {viewing}
              </p>
            </div>

            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
              {actor.role !== "BRANCH_ADMIN" && actor.role !== "STAFF" && (
                <ScopeSelector
                  role={actor.role}
                  organizationId={scope.organizationId}
                  branchId={scope.branchId}
                  locked={false}
                />
              )}

              {(actor.role === "BRANCH_ADMIN" || actor.role === "STAFF") && (
                <ScopeSelector locked branchName={branch?.name} />
              )}

              <NotificationBell unread={unread} />

              <ProfileMenu
                name={actor.name}
                roleLabel={
                  actor.role === "SUPER_ADMIN"
                    ? "Super Admin"
                    : actor.role === "ORGANIZATION_ADMIN"
                      ? "Organization Admin"
                      : actor.role === "STAFF"
                        ? "Staff"
                        : "Branch Admin"
                }
                organization={org?.name}
                branch={branch?.name}
                settingsHref={actor.role === "SUPER_ADMIN" || actor.role === "STAFF" ? null : "/settings"}
                profileHref={
                  [
                    "SUPER_ADMIN",
                    "ORGANIZATION_ADMIN",
                    "BRANCH_ADMIN",
                  ].includes(actor.role)
                    ? "/profile"
                    : null
                }
              />
            </div>
          </header>

          <AppMain>{children}</AppMain>
        </div>
      </div>
      </RecordViewProvider>
    </UIProvider>
  );
}
