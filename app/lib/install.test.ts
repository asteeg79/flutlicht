import { describe, expect, it } from "vitest";
import { installMode } from "@/lib/install";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const env = (userAgent: string, over = {}) => ({
  userAgent,
  standalone: false,
  hasPrompt: false,
  maxTouchPoints: 0,
  ...over,
});

describe("installMode", () => {
  it("installierte App: nichts mehr anbieten", () => {
    expect(installMode(env(IPHONE, { standalone: true }))).toBe("installed");
    expect(
      installMode(env(ANDROID, { standalone: true, hasPrompt: true })),
    ).toBe("installed");
  });

  it("Android mit Angebot des Browsers: Knopf, ohne: Hinweis aufs Browsermenü", () => {
    expect(installMode(env(ANDROID, { hasPrompt: true }))).toBe("prompt");
    expect(installMode(env(ANDROID))).toBe("android");
  });

  it("iPhone und iPad (auch als Mac getarnt): Anleitung über Teilen", () => {
    expect(installMode(env(IPHONE))).toBe("ios");
    expect(installMode(env(IPAD_AS_MAC, { maxTouchPoints: 5 }))).toBe("ios");
  });

  it("Desktop: Knopf nur mit Angebot, sonst nichts", () => {
    expect(installMode(env(DESKTOP))).toBe("none");
    expect(installMode(env(IPAD_AS_MAC))).toBe("none");
    expect(installMode(env(DESKTOP, { hasPrompt: true }))).toBe("prompt");
  });
});
