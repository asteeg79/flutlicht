import { NextResponse } from "next/server";
import { saveManualMatch } from "@/lib/admin";
import { NotFound, withAdmin } from "@/lib/api-route";
import { gameData } from "@/lib/game-data";
import { github } from "@/lib/github";
import { loadManager } from "@/lib/storage";

/** Spieldaten von Hand nachtragen → raw/manual/matches/{eventId}.json (KONZEPT 11). */
export const PUT = withAdmin(async ({ user, request }) => {
  const admin = await loadManager(user.id);
  if (!admin) throw new NotFound();
  const path = await saveManualMatch(
    github(),
    await request.json().catch(() => null),
    admin,
    new Date(),
    gameData.fixtures,
  );
  return NextResponse.json({ ok: true, path });
});
