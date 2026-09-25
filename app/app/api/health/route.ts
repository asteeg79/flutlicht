import { NextResponse } from "next/server";
import { gameData } from "@/lib/game-data";
import { storageBackend } from "@/lib/storage";

// Öffentlicher Uptime-Check (lib/public-api-paths.ts).
export function GET() {
  return NextResponse.json({
    ok: true,
    storage: storageBackend(),
    dataVersion: gameData.meta.dataVersion,
  });
}
