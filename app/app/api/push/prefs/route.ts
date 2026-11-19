import { PushPrefs } from "@fm/core";
import { NextResponse } from "next/server";
import { BadRequest, parseBody, withUser } from "@/lib/api-route";
import { updateManager } from "@/lib/manager-writes";

/** Push-Typen an/aus (KONZEPT 8.2); wie die Subscription server-verwaltet, ohne updatedAt. */
export const PUT = withUser(async ({ user, request }) => {
  const prefs = await parseBody(request, PushPrefs);
  await updateManager(user.id, (doc) => {
    if (!doc.push)
      throw new BadRequest("Schalte zuerst Push-Benachrichtigungen ein.");
    return { ...doc, push: { ...doc.push, prefs } };
  });
  return NextResponse.json({ ok: true, prefs });
});
