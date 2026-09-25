import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { withPublic } from "@/lib/api-route";
import { runTick } from "@/lib/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Öffentlich (lib/public-api-paths.ts), aber nur mit Bearer CRON_SECRET: der
// Cloudflare-Worker ruft alle 10 Minuten (KONZEPT 9).
export const POST = withPublic(async (request) => {
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runTick(new Date()));
});
