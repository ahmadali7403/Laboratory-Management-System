import { prisma } from "@/lib/prisma";
import { apiContext, resolveWriteTarget } from "@/lib/scope";
import { handleError, json, optUuid, parseBody } from "@/lib/http";
import { seedCommonMedicines } from "@/lib/medicine-defaults.mjs";
import { invalidateStatsCache } from "@/lib/memo";
import { z } from "zod";

const bodySchema = z.object({ branchId: optUuid }).default({});

/**
 * Idempotently loads 240+ common South Asian/Pakistani pharmacy medicines into the target branch.
 */
export async function POST(request) {
  try {
    const auth = await apiContext(request, {
      roles: ["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"],
    });
    if (auth.error) return auth.error;

    let raw = {};
    try {
      raw = await request.json();
    } catch {
      raw = {};
    }
    const parsed = bodySchema.safeParse(raw || {});
    const resolved = await resolveWriteTarget(
      auth.ctx,
      parsed.success ? parsed.data : {},
      { branchRequired: true },
    );
    if (resolved.error) return resolved.error;
    const { organizationId, branchId } = resolved.target;

    const result = await seedCommonMedicines(prisma, {
      organizationId,
      branchId,
      createdByName: auth.ctx.actor.name,
    });
    invalidateStatsCache();

    return json({
      ...result,
      message: result.batchesCreated
        ? `Loaded ${result.totalCatalog} common medicines (${result.batchesCreated} new stock batches added).`
        : `Verified ${result.totalCatalog} common medicines (existing stock unchanged).`,
    });
  } catch (error) {
    return handleError(error, "Seed common medicines");
  }
}

void parseBody;
