/**
 * Interactive CLI script to create an admin user.
 *
 * Usage: npm run create-admin
 *
 * Prompts for email and password, hashes the password with bcryptjs,
 * and creates a User with role=ADMIN. Blocks duplicates by email.
 */

import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    console.log("\n🔐 Marmelad CRM — Create Admin User\n");

    // ── Email ──────────────────────────────────────────────────────────────
    const rawEmail = await rl.question("Email: ");
    const email = rawEmail.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error("❌ Invalid email address.");
      process.exit(1);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.error(`❌ User with email "${email}" already exists.`);
      process.exit(1);
    }

    // ── Password ───────────────────────────────────────────────────────────
    const password = await rl.question("Password: ");

    if (!password || password.length < 6) {
      console.error("❌ Password must be at least 6 characters.");
      process.exit(1);
    }

    // ── Create ─────────────────────────────────────────────────────────────
    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Admin",
        role: UserRole.ADMIN,
      },
    });

    console.log(`\n✅ Admin user created: ${user.email} (${user.id})\n`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Failed:", err.message);
  process.exit(1);
});
