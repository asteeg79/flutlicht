import { describe, expect, it } from "vitest";
import {
  parseThemePref,
  resolveTheme,
  THEME_KEY,
  THEME_SCRIPT,
} from "@/lib/theme";

describe("Theme", () => {
  it("liest nur dark und light, alles andere ist System", () => {
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref(null)).toBe("system");
    expect(parseThemePref("hell")).toBe("system");
  });

  it("System folgt prefers-color-scheme, eine feste Wahl gewinnt", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("das Inline-Script setzt data-theme und color-scheme aus demselben Schlüssel", () => {
    const html = {
      dataset: {} as Record<string, string>,
      style: {} as Record<string, string>,
    };
    const run = (stored: string | null, systemLight: boolean) =>
      new Function("localStorage", "matchMedia", "document", THEME_SCRIPT)(
        { getItem: (k: string) => (k === THEME_KEY ? stored : null) },
        () => ({ matches: systemLight }),
        { documentElement: html },
      );
    run(null, true);
    expect(html.dataset.theme).toBe("light");
    expect(html.style.colorScheme).toBe("light");
    run("dark", true);
    expect(html.dataset.theme).toBe("dark");
  });
});
