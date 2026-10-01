import { NextResponse } from "next/server";
import { hasBearer, withPublic } from "@/lib/api-route";
import { runTick } from "@/lib/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Öffentlich (lib/public-api-paths.ts), aber nur mit Bearer CRON_SECRET: der
// Cloudflare-Worker ruft alle 10 Minuten (KONZEPT 9).
export const POST = withPublic(async (request) => {
  if (!hasBearer(request, process.env.CRON_SECRET))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runTick(new Date()));
});
