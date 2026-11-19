import { NextResponse } from "next/server";
import { applyManualChange } from "@/lib/admin";
import { readBody, withAdmin } from "@/lib/api-route";
import { finals, gameData } from "@/lib/game-data";
import { github } from "@/lib/github";

/** Zuordnung, Marktwert, Position, Saisonstart → Commit nach raw/manual/ (KONZEPT 11). */
export const PUT = withAdmin(async ({ admin, request }) => {
  await applyManualChange(github(), await readBody(request), admin, {
    now: new Date(),
    fixtures: gameData.fixtures,
    finals: finals(),
    firstScoredMatchday: gameData.season.firstScoredMatchday,
  });
  return NextResponse.json({ ok: true });
});
