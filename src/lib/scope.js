import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession, getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, isUuid } from "@/lib/http";

/**
 * TENANT SCOPE ENGINE
 * -------------------
 * 1. getActor()      -> who is calling, re-validated against the database on
 *                       every request (status, organization, branch).
 * 2. resolveScope()  -> which slice of data the actor is *looking at*. The
 *                       "selected" org/branch only NARROWS the actor's
 *                       authority; every selection is re-verified server-side.
 * 3. scopeWhere()    -> Prisma `where` fragment for list/read queries.
 * 4. authorityWhere()-> Prisma `where` fragment for access-by-id (IDOR guard).
 * 5. resolveWriteTarget() -> organization/branch for newly created rows.
 *
 * Nothing here ever trusts organizationId / branchId / role sent by a browser.
 */

export const SCOPE_COOKIE = "labos_scope";
export const ADMIN_ROLE_NAMES = ["ORGANIZATION_ADMIN", "BRANCH_ADMIN"];

export function homeFor(role) {
  if (role === "SUPER_ADMIN") return "/dashboard";
  if (role === "ORGANIZATION_ADMIN") return "/organization/dashboard";
  if (role === "BRANCH_ADMIN") return "/branch/dashboard";
  return "/login";
}

export async function getActor() {
  const admin = await getAdminSession();
  if (admin) {
    return { role: "SUPER_ADMIN", id: admin.id, name: admin.name, email: admin.email, organizationId: null, branchId: null };
  }
  const user = await getUserSession();
  if (user && user.role === "ORGANIZATION_ADMIN") {
    return { role: user.role, id: user.id, name: user.name, username: user.username, organizationId: user.organizationId, branchId: null };
  }
  if (user && user.role === "BRANCH_ADMIN" && user.branchId) {
    return { role: user.role, id: user.id, name: user.name, username: user.username, organizationId: user.organizationId, branchId: user.branchId };
  }
  return null;
}

async function readSelection() {
  try {
    const raw = (await cookies()).get(SCOPE_COOKIE)?.value;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      organizationId: isUuid(parsed?.o) ? parsed.o : null,
      branchId: isUuid(parsed?.b) ? parsed.b : null,
    };
  } catch {
    return {};
  }
}

/**
 * @param actor      result of getActor()
 * @param narrowTo   optional explicit branch id (e.g. ?branchId= on a request).
 *                   It is verified exactly like the cookie selection, and an
 *                   explicit-but-invalid value yields { error } (never ignored).
 */
export async function resolveScope(actor, narrowTo = null) {
  const sel = await readSelection();
  let organizationId = null;
  let branchId = null;

  if (actor.role === "BRANCH_ADMIN") {
    if (narrowTo && narrowTo !== actor.branchId) return { error: "NOT_FOUND" };
    organizationId = actor.organizationId;
    branchId = actor.branchId;
  } else if (actor.role === "ORGANIZATION_ADMIN") {
    organizationId = actor.organizationId;
    const candidate = narrowTo || sel.branchId;
    if (candidate) {
      const branch = await prisma.branch.findFirst({
        where: { id: candidate, organizationId },
        select: { id: true },
      });
      if (branch) branchId = branch.id;
      else if (narrowTo) return { error: "NOT_FOUND" };
    }
  } else if (actor.role === "SUPER_ADMIN") {
    const candidateBranch = narrowTo || sel.branchId;
    if (candidateBranch) {
      const branch = await prisma.branch.findUnique({
        where: { id: candidateBranch },
        select: { id: true, organizationId: true },
      });
      if (branch && (narrowTo || !sel.organizationId || branch.organizationId === sel.organizationId)) {
        branchId = branch.id;
        organizationId = branch.organizationId;
      } else if (narrowTo) {
        return { error: "NOT_FOUND" };
      }
    }
    if (!organizationId && sel.organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: sel.organizationId }, select: { id: true } });
      if (org) organizationId = org.id;
    }
  } else {
    return { error: "NOT_FOUND" };
  }

  return {
    level: branchId ? "BRANCH" : organizationId ? "ORGANIZATION" : "PLATFORM",
    organizationId,
    branchId,
    locked: actor.role === "BRANCH_ADMIN",
  };
}

// ---- API helper ------------------------------------------------------------
export async function apiContext(request, { roles } = {}) {
  const actor = await getActor();
  if (!actor) return { error: fail("Unauthorized.", 401) };
  if (roles && !roles.includes(actor.role)) return { error: fail("Forbidden.", 403) };

  let narrow = null;
  if (request) {
    narrow = new URL(request.url).searchParams.get("branchId");
    if (narrow && !isUuid(narrow)) return { error: fail("Invalid branch.", 400) };
  }
  const scope = await resolveScope(actor, narrow || null);
  if (scope.error) return { error: fail("Branch not found.", 404) };
  return { ctx: { actor, scope } };
}

// ---- Page helper -----------------------------------------------------------
export const getPageContext = cache(async () => {
  const actor = await getActor();
  if (!actor) return null;
  const scope = await resolveScope(actor);
  if (scope.error) return null;
  return { actor, scope };
});

export async function requireContext(roles) {
  const ctx = await getPageContext();
  if (!ctx) redirect("/login");
  if (roles && !roles.includes(ctx.actor.role)) redirect(homeFor(ctx.actor.role));
  return ctx;
}

// ---- Where builders --------------------------------------------------------
/**
 * Visibility filter for lists/dashboards (narrowed by the selected scope).
 * `shared: true` also exposes organization-wide rows (branchId = null) such as
 * the test catalog, doctors and suppliers shared by all branches.
 */
export function scopeWhere(scope, { shared = false } = {}) {
  const where = {};
  if (scope.organizationId) where.organizationId = scope.organizationId;
  if (scope.branchId) {
    if (shared) where.OR = [{ branchId: null }, { branchId: scope.branchId }];
    else where.branchId = scope.branchId;
  }
  return where;
}

/**
 * Authority filter for access-by-id (update/delete/open). Independent of the
 * UI selection: it is purely what the actor is ALLOWED to touch.
 * Branch admin -> own branch only; org admin -> own organization; super -> all.
 */
export function authorityWhere(actor) {
  if (actor.role === "BRANCH_ADMIN") return { organizationId: actor.organizationId, branchId: actor.branchId };
  if (actor.role === "ORGANIZATION_ADMIN") return { organizationId: actor.organizationId };
  return {};
}

/**
 * Decides organizationId/branchId for a NEW row, entirely server-side.
 * `body.branchId` is only a request that is verified against the database.
 * For optional-branch modules (doctors, tests, suppliers) an explicit
 * `branchId: null` means "all branches of the organization".
 */
export async function resolveWriteTarget({ actor, scope }, body = {}, { branchRequired = true } = {}) {
  const hasKey = body.branchId !== undefined;
  const requested = hasKey ? body.branchId : undefined;

  if (actor.role === "BRANCH_ADMIN") {
    if (requested && requested !== actor.branchId) return { error: fail("Branch not found.", 404) };
    return { target: { organizationId: actor.organizationId, branchId: actor.branchId } };
  }

  const wantedBranch = hasKey ? requested : scope.branchId;

  if (wantedBranch) {
    const where = { id: wantedBranch };
    if (actor.role === "ORGANIZATION_ADMIN") where.organizationId = actor.organizationId;
    else if (scope.organizationId) where.organizationId = scope.organizationId;
    const branch = await prisma.branch.findFirst({
      where,
      select: { id: true, organizationId: true, status: true, organization: { select: { status: true } } },
    });
    if (!branch) return { error: fail("Branch not found.", 404) };
    if (branch.status !== "ACTIVE") return { error: fail("This branch is inactive.", 409) };
    if (branch.organization.status !== "ACTIVE") return { error: fail("This organization is not active.", 409) };
    return { target: { organizationId: branch.organizationId, branchId: branch.id } };
  }

  if (branchRequired) return { error: fail("Please select a branch.", 400) };

  const organizationId = actor.role === "ORGANIZATION_ADMIN" ? actor.organizationId : scope.organizationId;
  if (!organizationId) return { error: fail("Please select an organization or a branch first.", 400) };
  if (actor.role === "SUPER_ADMIN") {
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { status: true } });
    if (!org) return { error: fail("Organization not found.", 404) };
    if (org.status !== "ACTIVE") return { error: fail("This organization is not active.", 409) };
  }
  return { target: { organizationId, branchId: null } };
}

/** Org-level target (no branch) used by roles/staff/settings style modules. */
export async function resolveOrganizationTarget(ctx) {
  const res = await resolveWriteTarget(ctx, { branchId: null }, { branchRequired: false });
  return res;
}

// ---- Data for the topbar selector -----------------------------------------
export async function getScopeOptions({ actor, scope }) {
  const orgWhere = actor.role === "SUPER_ADMIN" ? {} : { id: actor.organizationId };
  const organizations =
    actor.role === "SUPER_ADMIN"
      ? await prisma.organization.findMany({
          where: orgWhere,
          select: { id: true, name: true, status: true },
          orderBy: { name: "asc" },
          take: 500,
        })
      : [];

  let branches = [];
  if (actor.role === "BRANCH_ADMIN") {
    branches = await prisma.branch.findMany({
      where: { id: actor.branchId, organizationId: actor.organizationId },
      select: { id: true, name: true, code: true, status: true, organizationId: true, organization: { select: { name: true } } },
    });
  } else {
    const branchWhere = {};
    if (actor.role === "ORGANIZATION_ADMIN") branchWhere.organizationId = actor.organizationId;
    else if (scope.organizationId) branchWhere.organizationId = scope.organizationId;
    branches = await prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true, code: true, status: true, organizationId: true, organization: { select: { name: true } } },
      orderBy: [{ organizationId: "asc" }, { name: "asc" }],
      take: 1000,
    });
  }
  return {
    organizations,
    branches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      status: b.status,
      organizationId: b.organizationId,
      organizationName: b.organization.name,
    })),
  };
}

/** The only scope information that is ever sent to client components. */
export function publicScope({ actor, scope }, options) {
  return {
    role: actor.role,
    level: scope.level,
    organizationId: scope.organizationId,
    branchId: scope.branchId,
    locked: scope.locked,
    branches: (options?.branches || []).filter((b) => b.status === "ACTIVE"),
  };
}
