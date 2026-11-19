import { NextResponse } from "next/server";
import { readBody, withUser } from "@/lib/api-route";
import { updateLineup } from "@/lib/lineup";
import { liveContext } from "@/lib/squad";

/** Formation, Starter, Bank, Kapitän; Sperren laut 2.5, Validierung laut 2.3/2.4. */
export const PUT = withUser(async ({ user, request }) => {
  const body = await readBody(request);
  return NextResponse.json(await updateLineup(user.id, body, liveContext()));
});
