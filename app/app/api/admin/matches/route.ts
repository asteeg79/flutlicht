import { NextResponse } from "next/server";
import { saveManualMatch } from "@/lib/admin";
import { readBody, withAdmin } from "@/lib/api-route";
import { gameData } from "@/lib/game-data";
import { github } from "@/lib/github";

/** Spieldaten von Hand nachtragen → raw/manual/matches/{eventId}.json (KONZEPT 11). */
export const PUT = withAdmin(async ({ admin, request }) => {
  const path = await saveManualMatch(
    github(),
    await readBody(request),
    admin,
    new Date(),
    gameData.fixtures,
  );
  return NextResponse.json({ ok: true, path });
});
