import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { seedCommonMedicines } from "../src/lib/medicine-defaults.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Configure .env before running this script.");
  }

  const orgCode = arg("org");
  const branchCode = arg("branch");

  const branches = await prisma.branch.findMany({
    where: {
      status: "ACTIVE",
      organization: { status: "ACTIVE", ...(orgCode ? { code: orgCode } : {}) },
      ...(branchCode ? { code: branchCode } : {}),
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      organizationId: true,
      organization: { select: { name: true, code: true } },
    },
  });

  if (!branches.length) {
    console.log("No matching active branches found.");
    return;
  }

  for (const branch of branches) {
    const res = await seedCommonMedicines(prisma, {
      organizationId: branch.organizationId,
      branchId: branch.id,
      createdByName: "Seed Script",
    });
    console.log(
      `${branch.organization.name} (${branch.organization.code}) -> ${branch.name} (${branch.code}): ${res.medicinesUpserted} medicines verified/upserted, ${res.batchesCreated} new initial batches created.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
