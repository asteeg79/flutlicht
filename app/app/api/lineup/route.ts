import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-route";
import { updateLineup } from "@/lib/lineup";
import { liveContext } from "@/lib/squad";

/** Formation, Starter, Bank, Kapitän; Sperren laut 2.5, Validierung laut 2.3/2.4. */
export const PUT = withUser(async ({ user, request }) => {
  const body = await request.json().catch(() => null);
  return NextResponse.json(await updateLineup(user.id, body, liveContext()));
});
