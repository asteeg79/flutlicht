import { describe, expect, it } from "vitest";
import { countdownUrgency, formatCountdown } from "@/lib/countdown";

describe("Countdown", () => {
  it("zeigt HH:MM:SS und rundet angebrochene Sekunden auf", () => {
    expect(formatCountdown((2 * 3600 + 47 * 60 + 18) * 1000)).toBe("02:47:18");
    expect(formatCountdown(1)).toBe("00:00:01");
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(-5000)).toBe("00:00:00");
  });

  it("ab einem Tag mit Tagen davor", () => {
    expect(formatCountdown((3 * 86_400 + 5) * 1000)).toBe("3 T 00:00:05");
  });

  it("wird unter 10 Minuten dringend und tickt in der letzten Minute", () => {
    expect(countdownUrgency(11 * 60_000)).toBe("normal");
    expect(countdownUrgency(9 * 60_000)).toBe("urgent");
    expect(countdownUrgency(59_000)).toBe("tick");
    expect(countdownUrgency(0)).toBe("normal");
  });
});
