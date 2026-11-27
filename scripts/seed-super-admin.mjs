import nextEnv from "@next/env";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

/**
 * Idempotently seeds ONE default Super Admin ONLY if no PlatformAdmin exists yet.
 * Marks `mustChangePassword: true` so the user must rotate credentials upon first login.
 */
async function main() {
  const count = await prisma.platformAdmin.count();
  if (count > 0) {
    console.log(`Skipped: ${count} platform admin(s) already exist in database.`);
    return;
  }

  const email = (process.env.INITIAL_ADMIN_EMAIL || "admin@labos.local").trim().toLowerCase();
  const username = (process.env.INITIAL_ADMIN_USERNAME || "superadmin").trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(password, 12);

  await prisma.platformAdmin.create({
    data: {
      name: "Super Administrator",
      email,
      username,
      password: hash,
      role: "SUPER_ADMIN",
      isActive: true,
      mustChangePassword: true,
    },
  });

  console.log("Initial Super Admin created (password change enforced on first login):");
  console.log(`  Username : ${username}`);
  console.log(`  Email    : ${email}`);
  if (!process.env.INITIAL_ADMIN_PASSWORD) {
    console.log(`  Temp Pass: ${password}`);
  }
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
