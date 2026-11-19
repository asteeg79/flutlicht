import { matchdayCalendar, RULES } from "@fm/core";
import { redirect } from "next/navigation";
import { finals, gameData } from "@/lib/game-data";

/** /spieltag führt zum aktuellen Spieltag (kleinster, der noch nicht final ist). */
export default function MatchdayIndex() {
  const { current } = matchdayCalendar(gameData.fixtures, finals());
  redirect(`/spieltag/${current ?? RULES.matchdays}`);
}
