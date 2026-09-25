import { NextResponse } from "next/server";
import { applyManualChange } from "@/lib/admin";
import { NotFound, withAdmin } from "@/lib/api-route";
import { finals, gameData } from "@/lib/game-data";
import { github } from "@/lib/github";
import { loadManager } from "@/lib/storage";

/** Zuordnung, Marktwert, Position, Saisonstart → Commit nach raw/manual/ (KONZEPT 11). */
export const PUT = withAdmin(async ({ user, request }) => {
  const admin = await loadManager(user.id);
  if (!admin) throw new NotFound();
  await applyManualChange(
    github(),
    await request.json().catch(() => null),
    admin,
    {
      now: new Date(),
      fixtures: gameData.fixtures,
      finals: finals(),
      firstScoredMatchday: gameData.season.firstScoredMatchday,
    },
  );
  return NextResponse.json({ ok: true });
});
