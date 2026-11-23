// Adds the common test catalog (CBC, LFT, ...) to EVERY existing organization. Safe to re-run.
import { PrismaClient } from "@prisma/client";
import { DEFAULT_TESTS } from "../src/lib/test-defaults-data.mjs";

try { process.loadEnvFile?.(".env"); } catch {}
const prisma = new PrismaClient();

const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
for (const org of orgs) {
  const have = new Set((await prisma.test.findMany({ where: { organizationId: org.id }, select: { code: true } })).map((t) => t.code));
  let created = 0;
  for (const t of DEFAULT_TESTS) {
    if (have.has(t.code)) continue;
    const { parameters, ...rest } = t;
    await prisma.test.create({ data: { ...rest, organizationId: org.id, branchId: null, parameters: { create: parameters.map((p, i) => ({ ...p, sortOrder: i })) } } });
    created++;
  }
  console.log(`${org.name}: ${created} test(s) added`);
}
await prisma.$disconnect();
