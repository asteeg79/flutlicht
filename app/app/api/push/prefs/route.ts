import { PushPrefs } from "@fm/core";
import { NextResponse } from "next/server";
import { BadRequest, NotFound, parseBody, withUser } from "@/lib/api-route";
import { loadManager, saveManager } from "@/lib/storage";

/** Push-Typen an/aus (KONZEPT 8.2); wie die Subscription server-verwaltet, ohne updatedAt. */
export const PUT = withUser(async ({ user, request }) => {
  const prefs = await parseBody(request, PushPrefs);
  const doc = await loadManager(user.id);
  if (!doc) throw new NotFound();
  if (!doc.push)
    throw new BadRequest("Schalte zuerst Push-Benachrichtigungen ein.");
  await saveManager({ ...doc, push: { ...doc.push, prefs } });
  return NextResponse.json({ ok: true, prefs });
});
