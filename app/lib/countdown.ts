// Countdown-Anzeige (Arena 3.1): „02:47:18“, ab einem Tag „3 T 02:47:18“.
import { pad2 } from "@fm/core";

/** Restzeit bis `target` im Format HH:MM:SS; nie negativ. */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const days = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const clock = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return days > 0 ? `${days} T ${clock}` : clock;
}

/** Stufe für Farbe und Puls: unter 10 Min. dringend, unter 1 Min. tickt es. */
export function countdownUrgency(msLeft: number): "normal" | "urgent" | "tick" {
  if (msLeft <= 0) return "normal";
  if (msLeft < 60_000) return "tick";
  return msLeft < 10 * 60_000 ? "urgent" : "normal";
}
