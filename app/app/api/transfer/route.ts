import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-route";
import { liveContext, makeTransfer } from "@/lib/squad";

/** Tausch { out, in }: Fenster, Position, Vereinslimit, Guthaben, Zählung (KONZEPT 2.6). */
export const POST = withUser(async ({ user, request }) => {
  const body = await request.json().catch(() => null);
  return NextResponse.json(await makeTransfer(user.id, body, liveContext()));
});
