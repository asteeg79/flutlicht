import { ScraperStatus } from "@fm/core";
import { NextResponse } from "next/server";
import { hasBearer, parseBody, withPublic } from "@/lib/api-route";
import { saveScraperHeartbeat } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Öffentlich (lib/public-api-paths.ts), aber nur mit Bearer SCRAPER_SECRET: der
// Heim-Rechner meldet sich bei jedem Scheduler-Lauf mit seinem Stand (docs/betrieb.md).
export const POST = withPublic(async (request) => {
  if (!hasBearer(request, process.env.SCRAPER_SECRET))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = await parseBody(request, ScraperStatus);
  await saveScraperHeartbeat({ seenAt: new Date().toISOString(), status });
  return NextResponse.json({ ok: true });
});
