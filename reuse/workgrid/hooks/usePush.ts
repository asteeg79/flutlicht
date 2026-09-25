"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.codePointAt(i) ?? 0;
  }
  return output;
}

export type PushState = "unsupported" | "default" | "granted" | "denied";

export function usePush() {
  const [state, setState] = useState<PushState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as PushState);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    setLoading(true);
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        toast.error("VAPID Public Key fehlt (NEXT_PUBLIC_VAPID_PUBLIC_KEY)");
        return;
      }
      const permission = await Notification.requestPermission();
      setState(permission as PushState);
      if (permission !== "granted") {
        toast.error("Benachrichtigungen wurden nicht erlaubt");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error("Subscribe fehlgeschlagen");

      setSubscribed(true);
      toast.success("Push-Benachrichtigungen aktiviert");
    } catch (err) {
      console.error(err);
      toast.error("Aktivierung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await fetch("/api/push/subscribe", { method: "DELETE" });
      setSubscribed(false);
      toast.success("Push-Benachrichtigungen deaktiviert");
    } catch (err) {
      console.error(err);
      toast.error("Deaktivierung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, []);

  return { state, subscribed, loading, subscribe, unsubscribe };
}
