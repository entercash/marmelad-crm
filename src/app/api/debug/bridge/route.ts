import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const accounts = await prisma.account.findMany({
    select: { id: true, name: true, externalId: true },
  });

  const adAccounts = await prisma.adAccount.findMany({
    select: { id: true, name: true, externalId: true, accountId: true },
  });

  const settings = await prisma.integrationSetting.findMany({
    where: { key: { contains: "taboolaAccountId" } },
    select: { key: true, value: true },
  });

  const csdCount = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) as cnt FROM "campaign_stats_daily"`
  );

  return NextResponse.json({
    accounts,
    adAccounts,
    taboolaSettings: settings,
    campaignStatsDailyCount: Number(csdCount[0]?.cnt ?? 0),
  });
}
