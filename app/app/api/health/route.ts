import { Meta } from "@fm/core";
import { NextResponse } from "next/server";
import meta from "@/generated/data/meta.json";
import { storageBackend } from "@/lib/storage";

// Öffentlicher Uptime-Check (lib/public-api-paths.ts). Liest nur meta.json, nicht die
// ganze Fußballwelt aus game-data.
export function GET() {
  return NextResponse.json({
    ok: true,
    storage: storageBackend(),
    dataVersion: Meta.parse(meta).dataVersion,
  });
}
