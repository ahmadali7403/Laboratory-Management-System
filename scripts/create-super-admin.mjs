import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "node:readline";
import { stdin, stdout } from "node:process";

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Hidden password input requires a terminal."));
      return;
    }

    stdout.write(question);

    let password = "";

    stdin.setRawMode(true);
    stdin.resume();

    function cleanup() {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    }

    function onData(chunk) {
      const input = chunk.toString("utf8");

      for (const char of input) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Operation cancelled."));
          return;
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(password);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          password = password.slice(0, -1);
          continue;
        }

        if (char >= " " && char !== "\u007f") {
          password += char;
        }
      }
    }

    stdin.on("data", onData);
  });
}

async function main() {
  console.log("\n================================");
  console.log("       LabOS Super Admin");
  console.log("================================\n");

  const name = (await ask("Full Name: ")).trim();
  const email = (await ask("Email Address: ")).trim().toLowerCase();

  rl.close();

  if (!name || !email) {
    throw new Error("Name and email are required.");
  }

  const existing = await prisma.platformAdmin.findUnique({
    where: { email },
  });

  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const password = await askHidden("Password: ");
  const confirmPassword = await askHidden("Confirm Password: ");

  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const admin = await prisma.platformAdmin.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "SUPER_ADMIN",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  console.log("\nSuper Admin successfully created!");
  console.log("--------------------------------");
  console.log("Name:", admin.name);
  console.log("Email:", admin.email);
  console.log("Role:", admin.role);
  console.log("--------------------------------\n");
}

main()
  .catch((error) => {
    console.error("\nError:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
