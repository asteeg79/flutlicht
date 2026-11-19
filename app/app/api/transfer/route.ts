import { NextResponse } from "next/server";
import { readBody, withUser } from "@/lib/api-route";
import { liveContext, makeTransfer } from "@/lib/squad";

/** Tausch { out, in }: Fenster, Position, Vereinslimit, Guthaben, Zählung (KONZEPT 2.6). */
export const POST = withUser(async ({ user, request }) => {
  const body = await readBody(request);
  return NextResponse.json(await makeTransfer(user.id, body, liveContext()));
});
