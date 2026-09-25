import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-route";
import { leagueTable } from "@/lib/standings";
import { listAllManagers } from "@/lib/storage";

/** Tabelle, live aus data/points und allen Manager-Dokumenten berechnet (KONZEPT 8.4). */
export const GET = withUser(async () => {
  return NextResponse.json(leagueTable(await listAllManagers()));
});
