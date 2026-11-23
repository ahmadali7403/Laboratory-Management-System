import { DEFAULT_TESTS } from "@/lib/test-defaults-data.mjs";

export { DEFAULT_TESTS };

/** Adds the starter panels to an organization (skips codes that already exist). */
export async function seedDefaultTests(db, organizationId) {
  const existing = await db.test.findMany({ where: { organizationId, code: { in: DEFAULT_TESTS.map((t) => t.code) } }, select: { code: true } });
  const have = new Set(existing.map((t) => t.code));
  let created = 0;
  for (const t of DEFAULT_TESTS) {
    if (have.has(t.code)) continue;
    const { parameters, ...rest } = t;
    await db.test.create({
      data: {
        ...rest, organizationId, branchId: null,
        parameters: { create: parameters.map((p, i) => ({ ...p, sortOrder: i })) },
      },
    });
    created++;
  }
  return created;
}

export function parametersCreate(list = []) {
  return list.map((p, i) => ({
    name: p.name, unit: p.unit ?? null, refLow: p.refLow ?? null, refHigh: p.refHigh ?? null, refRangeText: p.refRangeText ?? null, sortOrder: i,
  }));
}
