"use client";

import { useSyncExternalStore } from "react";
import { installMode, type InstallMode } from "@/lib/install";

/** Das Installations-Angebot von Chrome & Co. (nicht in den DOM-Typen enthalten). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Der Browser feuert beforeinstallprompt einmal, oft vor dem ersten Rendern. Deshalb
// fängt InstallPromptCatcher (Root-Layout) es app-weit ab und hebt es hier auf.
let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function catchInstallPrompt(): () => void {
  const onPrompt = (e: Event) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  };
  const onInstalled = () => {
    installed = true;
    deferred = null;
    emit();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

function currentMode(): InstallMode {
  return installMode({
    userAgent: navigator.userAgent,
    standalone:
      installed ||
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    hasPrompt: deferred !== null,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
}

/** Welcher Installationsweg passt; `install` öffnet das Angebot des Browsers. */
export function useInstall(): {
  mode: InstallMode;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
} {
  // Auf dem Server und beim ersten Rendern „none“: nichts anzeigen, keine Abweichung.
  const mode = useSyncExternalStore<InstallMode>(
    subscribe,
    currentMode,
    () => "none",
  );
  async function install() {
    const event = deferred;
    if (!event) return "unavailable" as const;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Das Angebot gilt nur einmal.
    deferred = null;
    emit();
    return outcome;
  }
  return { mode, install };
}
