// Übernommen aus Workgrid app/api/push/subscribe/route.ts, angepasst: Manager-Dokument,
// Push-Einstellungen bleiben erhalten; der Push-Teil ist server-verwaltet und ändert
// updatedAt nicht (keine 409 für parallele Aufstellungsänderungen).
import { DEFAULT_PUSH_PREFS, PushSubscriptionJson } from "@fm/core";
import { NextResponse } from "next/server";
import { parseBody, withUser } from "@/lib/api-route";
import { removePush, updateManager } from "@/lib/manager-writes";

export const runtime = "nodejs";

export const POST = withUser(async ({ user, request }) => {
  const subscription = await parseBody(
    request,
    PushSubscriptionJson,
    "Ungültige Subscription",
  );
  const next = await updateManager(user.id, (doc) => ({
    ...doc,
    push: { subscription, prefs: doc.push?.prefs ?? DEFAULT_PUSH_PREFS },
  }));
  return NextResponse.json({ ok: true, prefs: next.push!.prefs });
});

export const DELETE = withUser(async ({ user }) => {
  await removePush(user.id);
  return NextResponse.json({ ok: true });
});
