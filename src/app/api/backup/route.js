import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiContext } from "@/lib/scope";
import { BACKUP_MODULES, collectBackup } from "@/lib/backup";
import { fail, handleError } from "@/lib/http";

/**
 * GET /api/backup?module=patients|all   (current top-bar scope)
 *     &allOrgs=1                        (super admin, no organization selected)
 */
export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const { actor, scope } = auth.ctx;
    const sp = new URL(request.url).searchParams;
    const mod = sp.get("module") || "all";
    if (mod !== "all" && !BACKUP_MODULES.includes(mod)) return fail("Unknown module.", 400);
    const modules = mod === "all" ? BACKUP_MODULES : [mod];

    let body;
    let name;
    if (!scope.organizationId) {
      if (actor.role !== "SUPER_ADMIN" || sp.get("allOrgs") !== "1") return fail("Select an organization in the top bar first.", 400);
      const orgs = await prisma.organization.findMany({ select: { id: true }, orderBy: { name: "asc" }, take: 200 });
      const backups = [];
      for (const o of orgs) backups.push(await collectBackup({ organizationId: o.id, modules }));
      body = { format: "labos-backup-set", version: 1, createdAt: new Date(), backups };
      name = `labos-all-organizations-${mod}`;
    } else {
      body = await collectBackup({ organizationId: scope.organizationId, branchId: scope.branchId, modules });
      name = `labos-${body.scope.branchName || body.scope.organizationName || "backup"}-${mod}`.replace(/[^A-Za-z0-9_-]+/g, "_");
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error, "Backup");
  }
}
