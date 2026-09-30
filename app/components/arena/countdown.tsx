"use client";

import { PulseDot } from "@/components/arena/slant-tag";
import { useServerClock } from "@/hooks/useServerClock";
import { countdownUrgency, formatCountdown } from "@/lib/countdown";

/** Nur die Zahl, tickend; unter 10 Min. rot, in der letzten Minute pocht sie je Sekunde. */
export function CountdownText({
  target,
  serverNow,
  className = "",
}: {
  target: string;
  serverNow: string;
  className?: string;
}) {
  const now = useServerClock(serverNow);
  const left = Date.parse(target) - now;
  const urgency = countdownUrgency(left);
  return (
    <span
      key={urgency === "tick" ? Math.ceil(left / 1000) : undefined}
      className={`arena-anim inline-block whitespace-nowrap tabular-nums transition-colors duration-400 ${urgency === "normal" ? "" : "text-urgent"} ${urgency === "tick" ? "animate-[arena-tick_.35s_ease-out_both]" : ""} ${className}`}
    >
      {formatCountdown(left)}
    </span>
  );
}

/** Rechts im Kopf: Puls-Punkt, Label und Countdown („Fixiert in 02:47:18“). */
export function HeroCountdown({
  label,
  target,
  serverNow,
}: {
  label: string;
  target: string;
  serverNow: string;
}) {
  const now = useServerClock(serverNow);
  const fast = countdownUrgency(Date.parse(target) - now) !== "normal";
  return (
    <>
      <PulseDot fast={fast} />
      <span className="whitespace-nowrap">{label}</span>
      <CountdownText
        target={target}
        serverNow={serverNow}
        className="font-display text-lg font-extrabold tracking-[0.04em]"
      />
    </>
  );
}
