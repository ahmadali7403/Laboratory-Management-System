const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const env = fs.readFileSync(".env", "utf8");
const match = env.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m);

if (!match) {
  throw new Error("DATABASE_URL not found in .env");
}

const url = match[1].trim().replace(/^["']|["']$/g, "");

const prisma = new PrismaClient({
  datasources: {
    db: { url },
  },
});

async function main() {
  const migrations = await prisma.$queryRaw`
    SELECT
      migration_name,
      started_at,
      finished_at,
      rolled_back_at,
      logs
    FROM "_prisma_migrations"
    ORDER BY started_at
  `;

  console.log(JSON.stringify(migrations, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
