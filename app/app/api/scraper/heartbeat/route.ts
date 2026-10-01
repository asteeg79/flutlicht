import { NextResponse } from "next/server";
import { hasBearer, withPublic } from "@/lib/api-route";
import { saveScraperSeenAt } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Öffentlich (lib/public-api-paths.ts), aber nur mit Bearer SCRAPER_SECRET: der
// Heim-Rechner meldet sich bei jedem Scheduler-Lauf (docs/betrieb.md).
export const POST = withPublic(async (request) => {
  if (!hasBearer(request, process.env.SCRAPER_SECRET))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await saveScraperSeenAt(new Date().toISOString());
  return NextResponse.json({ ok: true });
});
