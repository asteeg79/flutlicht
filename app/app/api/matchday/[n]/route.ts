import { RULES } from "@fm/core";
import { NextResponse } from "next/server";
import { BadRequest, withUser } from "@/lib/api-route";
import { matchdayView } from "@/lib/standings";
import { listAllManagers } from "@/lib/storage";

/** Punkte pro Manager und Spieler; fremde Aufstellungen je Spieler erst ab dessen Sperre (KONZEPT 8.2). */
export const GET = withUser(async ({ user, request }) => {
  const n = Number(new URL(request.url).pathname.split("/").at(-1));
  if (!Number.isInteger(n) || n < 1 || n > RULES.matchdays)
    throw new BadRequest("Unbekannter Spieltag");
  return NextResponse.json(
    matchdayView(n, await listAllManagers(), user.id, new Date()),
  );
});
