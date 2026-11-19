import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-route";
import { BadRequest, NotFound } from "@/lib/errors";
import { sendToAll } from "@/lib/push";
import { removePushDevices } from "@/lib/manager-writes";
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
  // An alle angemeldeten Geräte, nicht nur an das, auf dem getestet wird.
  const report = await sendToAll(doc.push.subscriptions, {
    title: "Flutlicht",
    body: "🔔 Test: Push-Benachrichtigungen kommen an.",
    url: "/einstellungen",
    tag: "test",
  });
  if (report.expired.length > 0)
    await removePushDevices(user.id, report.expired);
  if (report.sent > 0)
    return NextResponse.json({ ok: true, sent: report.sent });
  if (report.failed === 0)
    throw new BadRequest(
      "Die Push-Anmeldung ist abgelaufen. Bitte schalte Push neu ein.",
    );
  throw new BadRequest("Der Test-Push konnte nicht gesendet werden.");
});
