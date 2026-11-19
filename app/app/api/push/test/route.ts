import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-route";
import { BadRequest, NotFound } from "@/lib/errors";
import { sendPush } from "@/lib/push";
import { removePush } from "@/lib/manager-writes";
import { loadManager } from "@/lib/storage";

export const runtime = "nodejs";

/** Test-Push an das eigene Gerät (Abnahme M9). */
export const POST = withUser(async ({ user }) => {
  const doc = await loadManager(user.id);
  if (!doc) throw new NotFound();
  if (!doc.push)
    throw new BadRequest(
      "Auf diesem Konto sind keine Push-Benachrichtigungen eingeschaltet.",
    );
  const result = await sendPush(doc.push.subscription, {
    title: "Flutlicht",
    body: "🔔 Test: Push-Benachrichtigungen kommen an.",
    url: "/einstellungen",
    tag: "test",
  });
  if (result === "expired") {
    await removePush(user.id);
    throw new BadRequest(
      "Die Push-Anmeldung ist abgelaufen. Bitte schalte Push neu ein.",
    );
  }
  if (result === "failed")
    throw new BadRequest("Der Test-Push konnte nicht gesendet werden.");
  return NextResponse.json({ ok: true });
});
