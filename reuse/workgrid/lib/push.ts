import webpush from "web-push";
import type { PushSubscriptionData } from "@/lib/types";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@myworkgrid.app";
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
}

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload,
): Promise<boolean> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
    );
    return true;
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    // 404/410 = Subscription abgelaufen
    if (statusCode === 404 || statusCode === 410) {
      return false;
    }
    console.error("Push fehlgeschlagen:", err);
    return false;
  }
}
