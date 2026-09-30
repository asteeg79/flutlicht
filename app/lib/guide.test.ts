import { describe, expect, it } from "vitest";
import {
  chapterFromParam,
  GUIDE_CHAPTERS,
  guideUrl,
  nextChapter,
  strikerExample,
} from "@/lib/guide";

describe("chapterFromParam", () => {
  it("ohne Parameter bleibt die Anleitung zu", () => {
    expect(chapterFromParam(null)).toBeNull();
  });

  it("leer oder unbekannt öffnet das erste Kapitel", () => {
    expect(chapterFromParam("")).toBe("idee");
    expect(chapterFromParam("gibtsnicht")).toBe("idee");
  });

  it("findet ein Kapitel", () => {
    expect(chapterFromParam("transfers")).toBe("transfers");
  });
});

describe("guideUrl", () => {
  it("setzt und entfernt den Parameter, andere bleiben", () => {
    expect(guideUrl("/markt", "?pos=FWD", "transfers")).toBe(
      "/markt?pos=FWD&anleitung=transfers",
    );
    expect(guideUrl("/markt", "?pos=FWD&anleitung=transfers", null)).toBe(
      "/markt?pos=FWD",
    );
    expect(guideUrl("/login", "?anleitung=", null)).toBe("/login");
  });
});

describe("nextChapter", () => {
  it("führt der Reihe nach durch und endet mit null", () => {
    expect(nextChapter("idee")?.id).toBe("start");
    expect(nextChapter(GUIDE_CHAPTERS.at(-1)!.id)).toBeNull();
  });
});

describe("strikerExample", () => {
  it("entspricht dem Rechenbeispiel A aus KONZEPT 3.5", () => {
    expect(strikerExample()).toEqual({
      rating: 13,
      goal: 5,
      assist: 4,
      yellow: -1,
      startBonus: 2,
      total: 23,
      captain: 46,
    });
  });
});
