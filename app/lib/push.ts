// Übernommen aus Workgrid lib/push.ts, angepasst: Ergebnis unterscheidet „abgelaufen“
// (404/410 → Subscription entfernen) von anderen Fehlern; Payload mit tag.
import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@flutlicht.invalid";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID-Keys sind nicht gesetzt");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type PushResult = "sent" | "expired" | "failed";

export async function sendPush(
  subscription: PushTarget,
  payload: PushPayload,
): Promise<PushResult> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      JSON.stringify(payload),
    );
    return "sent";
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    // 404/410 = Subscription abgelaufen
    if (statusCode === 404 || statusCode === 410) return "expired";
    console.error("Push fehlgeschlagen:", err);
    return "failed";
  }
}

export interface DeliveryReport {
  sent: number;
  failed: number;
  /** Abgelaufene Geräte (endpoint); die gehören abgemeldet. */
  expired: string[];
}

/** An jedes Gerät eines Managers senden, gleichzeitig. */
export async function sendToAll(
  subscriptions: readonly PushTarget[],
  payload: PushPayload,
  send: (
    target: PushTarget,
    payload: PushPayload,
  ) => Promise<PushResult> = sendPush,
): Promise<DeliveryReport> {
  const outcomes = await Promise.all(
    subscriptions.map((target) => send(target, payload)),
  );
  const report: DeliveryReport = { sent: 0, failed: 0, expired: [] };
  for (const [i, outcome] of outcomes.entries()) {
    if (outcome === "sent") report.sent++;
    else if (outcome === "failed") report.failed++;
    else report.expired.push(subscriptions[i]!.endpoint);
  }
  return report;
}
