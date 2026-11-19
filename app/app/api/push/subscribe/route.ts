// Übernommen aus Workgrid app/api/push/subscribe/route.ts, angepasst: Manager-Dokument,
// eine Anmeldung je Gerät, Push-Einstellungen bleiben erhalten; der Push-Teil ist
// server-verwaltet und ändert updatedAt nicht (keine 409 für parallele Aufstellungsänderungen).
import { PushSubscriptionJson } from "@fm/core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, readBody, withUser } from "@/lib/api-route";
import { addPushDevice, removePushDevices } from "@/lib/manager-writes";

export const runtime = "nodejs";

/** Dieses Gerät anmelden (auch erneut: gleiches Gerät wird ersetzt, nicht doppelt geführt). */
export const POST = withUser(async ({ user, request }) => {
  const subscription = await parseBody(
    request,
    PushSubscriptionJson,
    "Ungültige Subscription",
  );
  const next = await addPushDevice(user.id, subscription);
  return NextResponse.json({ ok: true, prefs: next.push!.prefs });
});

const DeviceInput = z.object({ endpoint: z.url() });

/** Dieses Gerät abmelden; ohne endpoint (ältere App-Version) alle Geräte. */
export const DELETE = withUser(async ({ user, request }) => {
  const device = DeviceInput.safeParse(
    await readBody(request).catch(() => null),
  );
  await removePushDevices(
    user.id,
    device.success ? [device.data.endpoint] : undefined,
  );
  return NextResponse.json({ ok: true });
});
