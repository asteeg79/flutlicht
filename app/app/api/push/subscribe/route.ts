// Übernommen aus Workgrid app/api/push/subscribe/route.ts, angepasst: Manager-Dokument,
// Push-Einstellungen bleiben erhalten; der Push-Teil ist server-verwaltet und ändert
// updatedAt nicht (keine 409 für parallele Aufstellungsänderungen).
import { DEFAULT_PUSH_PREFS, PushSubscriptionJson } from "@fm/core";
import { NextResponse } from "next/server";
import { NotFound, parseBody, withUser } from "@/lib/api-route";
import { loadManager, saveManager } from "@/lib/storage";

export const runtime = "nodejs";

export const POST = withUser(async ({ user, request }) => {
  const subscription = await parseBody(
    request,
    PushSubscriptionJson,
    "Ungültige Subscription",
  );
  const doc = await loadManager(user.id);
  if (!doc) throw new NotFound();
  await saveManager({
    ...doc,
    push: { subscription, prefs: doc.push?.prefs ?? DEFAULT_PUSH_PREFS },
  });
  return NextResponse.json({
    ok: true,
    prefs: doc.push?.prefs ?? DEFAULT_PUSH_PREFS,
  });
});

export const DELETE = withUser(async ({ user }) => {
  const doc = await loadManager(user.id);
  if (doc?.push) {
    const { push: _removed, ...rest } = doc;
    await saveManager(rest);
  }
  return NextResponse.json({ ok: true });
});
