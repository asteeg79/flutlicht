import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-route";
import { buildInitialSquad, liveContext } from "@/lib/squad";

/** Erstkader: 15 Spieler, Positionen, Vereinslimit, Budget (KONZEPT 8.2). */
export const POST = withUser(async ({ user, request }) => {
  const body = await request.json().catch(() => null);
  return NextResponse.json(
    await buildInitialSquad(user.id, body, liveContext()),
  );
});
