import { currentMatchday, RULES } from "@fm/core";
import { redirect } from "next/navigation";
import { finals } from "@/lib/game-data";

/** /spieltag führt zum aktuellen Spieltag (kleinster, der noch nicht final ist). */
export default function MatchdayIndex() {
  redirect(`/spieltag/${currentMatchday(finals()) ?? RULES.matchdays}`);
}
