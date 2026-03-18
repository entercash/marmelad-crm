import { NextResponse } from "next/server";
import { KeitaroClient } from "@/integrations/keitaro/client";
import { getKeitaroSettings } from "@/features/integration-settings/queries";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await getKeitaroSettings();
    if (!settings.apiUrl || !settings.apiKey) {
      return NextResponse.json({ error: "Keitaro not configured" }, { status: 400 });
    }

    const client = new KeitaroClient({
      apiUrl: settings.apiUrl,
      apiKey: settings.apiKey,
    });

    // Get Keitaro stats grouped by sub_id (should be site_id)
    const report = await client.buildReport({
      range: { from: "2025-03-10", to: "2025-03-18", timezone: "Europe/London" },
      grouping: ["campaign_id", "sub_id"],
      metrics: ["conversions", "revenue"],
      limit: 50,
      offset: 0,
    });

    // Also get a few publisher externalIds from DB
    const publishers = await prisma.publisher.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { externalId: true, name: true },
    });

    return NextResponse.json({
      keitaroRows: report.rows.slice(0, 30),
      publisherExternalIds: publishers,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
