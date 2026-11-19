"use client";
// Übernommen aus Workgrid hooks/usePush.ts, angepasst: deutsche Meldungen, Rückgabe der
// Zustand ohne setState direkt im Effekt.

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/arena/toast";

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

  // Zustand erst nach dem asynchronen Nachsehen setzen (kein setState direkt im Effekt).
  // getRegistration statt ready: ready bliebe ohne registrierten Service Worker hängen.
  useEffect(() => {
    let active = true;
    void (async () => {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      const reg = supported
        ? await navigator.serviceWorker.getRegistration()
        : undefined;
      const sub = reg
        ? await reg.pushManager.getSubscription().catch(() => null)
        : null;
      if (!active) return;
      setState(
        supported ? (Notification.permission as PushState) : "unsupported",
      );
      setSubscribed(!!sub);
      // Dieses Gerät beim Server (neu) anmelden: Es kann fehlen, etwa weil es vor der
      // Umstellung auf mehrere Geräte von einem anderen verdrängt wurde. Doppelt geht nicht.
      if (sub && Notification.permission === "granted")
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub),
        }).catch(() => undefined);
    })();
    return () => {
      active = false;
    };
  }, []);

  const subscribe = useCallback(async () => {
    setLoading(true);
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        toast.error("Push ist auf diesem Server nicht eingerichtet.");
        return;
      }
      const permission = await Notification.requestPermission();
      setState(permission as PushState);
      if (permission !== "granted") {
        toast.error("Benachrichtigungen wurden nicht erlaubt.");
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
      toast.success("Push-Benachrichtigungen sind an.");
    } catch (err) {
      console.error(err);
      toast.error("Einschalten hat nicht geklappt. Bitte versuche es erneut.");
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
      // Nur dieses Gerät abmelden, die anderen bekommen weiter Benachrichtigungen.
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub?.endpoint }),
      });
      setSubscribed(false);
      toast.success("Push-Benachrichtigungen sind aus.");
    } catch (err) {
      console.error(err);
      toast.error("Ausschalten hat nicht geklappt. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { state, subscribed, loading, subscribe, unsubscribe };
}
