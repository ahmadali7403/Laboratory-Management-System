const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const env = fs.readFileSync(".env", "utf8");
const match = env.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m);

if (!match) throw new Error("DATABASE_URL not found");

const url = match[1].trim().replace(/^["']|["']$/g, "");

const prisma = new PrismaClient({
  datasources: { db: { url } },
});

async function main() {
  const result = await prisma.$executeRaw`
    DELETE FROM "_prisma_migrations"
    WHERE migration_name = '20261124090000_expense_fields_and_branch_roles'
      AND rolled_back_at IS NOT NULL
      AND finished_at IS NULL
  `;

  console.log("Obsolete rolled-back migration records removed:", result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
