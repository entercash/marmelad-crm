/**
 * Marmelad CRM — Database Seed
 *
 * Seeds essential reference data that must exist before the app can operate.
 * All upserts are idempotent — safe to run multiple times.
 *
 * Run with: npm run db:seed
 */

import { PrismaClient, TrafficSourceType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // ─────────────────────────────────────────────
  // TRAFFIC SOURCES
  // ─────────────────────────────────────────────
  // These are the two core systems in the MVP.
  // Additional sources (Facebook, Google, TikTok) will be added in Phase 4.

  const taboola = await prisma.trafficSource.upsert({
    where: { slug: "taboola" },
    update: { name: "Taboola", type: TrafficSourceType.SPEND_SOURCE },
    create: {
      slug: "taboola",
      name: "Taboola",
      type: TrafficSourceType.SPEND_SOURCE,
      isActive: true,
    },
  });
  console.log(`  ✓ Traffic source: ${taboola.name} (${taboola.type})`);

  const keitaro = await prisma.trafficSource.upsert({
    where: { slug: "keitaro" },
    update: { name: "Keitaro", type: TrafficSourceType.CONVERSION_SOURCE },
    create: {
      slug: "keitaro",
      name: "Keitaro",
      type: TrafficSourceType.CONVERSION_SOURCE,
      isActive: true,
    },
  });
  console.log(`  ✓ Traffic source: ${keitaro.name} (${keitaro.type})`);

  // ─────────────────────────────────────────────
  // EXPENSE CATEGORIES
  // ─────────────────────────────────────────────
  // System categories (isSystem: true) are protected — the UI should not allow
  // deleting them. Users can add custom categories at runtime.

  const expenseCategories = [
    {
      slug: "accounts",
      name: "Accounts",
      color: "#0ea5e9", // sky
      isSystem: true,
    },
    {
      slug: "ai-services",
      name: "AI Services",
      color: "#a855f7", // purple
      isSystem: true,
    },
    {
      slug: "domains",
      name: "Domains",
      color: "#f97316", // orange
      isSystem: true,
    },
    {
      slug: "traffic",
      name: "Traffic & Media Spend",
      color: "#3b82f6", // blue
      isSystem: true,
    },
    {
      slug: "tools",
      name: "Tools & Software",
      color: "#8b5cf6", // violet
      isSystem: true,
    },
    {
      slug: "staff",
      name: "Staff & Freelancers",
      color: "#f59e0b", // amber
      isSystem: true,
    },
    {
      slug: "infrastructure",
      name: "Infrastructure & Hosting",
      color: "#10b981", // emerald
      isSystem: true,
    },
    {
      slug: "services",
      name: "External Services",
      color: "#ef4444", // red
      isSystem: false,
    },
    {
      slug: "other",
      name: "Other",
      color: "#64748b", // slate
      isSystem: false,
    },
  ];

  for (const cat of expenseCategories) {
    const created = await prisma.expenseCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, color: cat.color },
      create: cat,
    });
    console.log(`  ✓ Expense category: ${created.name} [${created.slug}]`);
  }

  console.log("\n✅ Seed complete.");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
