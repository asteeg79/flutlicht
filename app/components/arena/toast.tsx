"use client";

import { useSyncExternalStore } from "react";
import { createToastStore } from "@/components/arena/toast-store";

const store = createToastStore();

/** Meldung zeigen, überall aufrufbar (auch außerhalb von Komponenten). */
export const toast = Object.assign(
  (message: string) => store.push("info", message),
  {
    info: (message: string) => store.push("info", message),
    success: (message: string) => store.push("info", message),
    error: (message: string) => store.push("error", message),
  },
);

/**
 * Gelbe Meldung mit schräger Ecke (Fehler rot): mobil unter dem Kopf, auf dem
 * Desktop unten mittig. Die Region ist aria-live, Antippen schließt.
 */
export function Toaster() {
  const current = useSyncExternalStore(
    store.subscribe,
    store.current,
    () => null,
  );
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+84px)] z-50 flex justify-center lg:inset-x-0 lg:top-auto lg:bottom-8"
    >
      {current ? (
        <button
          key={current.id}
          type="button"
          role={current.kind === "error" ? "alert" : "status"}
          onClick={() => store.dismiss(current.id)}
          className={`arena-anim pointer-events-auto w-full max-w-[560px] animate-[arena-rise_.2s_ease-out_both] px-3.5 py-3 pr-5 text-left text-[13px] leading-snug font-bold shadow-[0_10px_30px_rgb(0_0_0/0.35)] slant-r lg:w-auto lg:max-w-[460px] ${
            current.kind === "error"
              ? "bg-karte text-white"
              : "bg-lampe text-nacht"
          }`}
        >
          {current.message}
        </button>
      ) : null}
    </div>
  );
}
