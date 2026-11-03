// Fristenlogik des Security-Tagesabgleichs (security-daily.yml), ohne echte Abrufe.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { auswerten, funde, laufzeiten } = createRequire(import.meta.url)(
  "./security-fristen.cjs",
);

const STAND = /<!-- stand: (\{.*?\}) -->/s;
const TAG = 24 * 60 * 60 * 1000;
const start = new Date("2026-11-03T05:41:00Z");
const tag = (n) => new Date(start.getTime() + n * TAG);

const osv = {
  results: [
    {
      source: { path: "/w/pnpm-lock.yaml" },
      packages: [
        {
          package: { name: "next", version: "16.4.4" },
          groups: [
            { ids: ["GHSA-aaaa-bbbb-cccc"], aliases: ["CVE-2026-1"] },
            { ids: ["GHSA-dddd-eeee-ffff"], aliases: [], max_severity: "5.3" },
          ],
          vulnerabilities: [
            {
              id: "GHSA-aaaa-bbbb-cccc",
              summary: "Lücke <!-- stand: {} --> von @jemand",
              database_specific: { severity: "LOW" },
            },
            { id: "GHSA-dddd-eeee-ffff", summary: "mittel" },
          ],
        },
        {
          package: { name: "minimatch", version: "10.0.0" },
          groups: [{ ids: ["GHSA-g3hv-75wg-m249"], aliases: [] }],
          vulnerabilities: [
            {
              id: "GHSA-g3hv-75wg-m249",
              database_specific: { severity: "HIGH" },
            },
          ],
        },
      ],
    },
  ],
};
const akzeptiert = [
  {
    id: "GHSA-g3hv-75wg-m249",
    grund: "nur Entwicklung",
    pruefen_bis: "2027-02-01",
  },
];
const lauf = "https://example.invalid/run";

describe("funde", () => {
  it("nimmt die GHSA-Kennung, die Schwere aus GHSA oder CVSS und KEV als kritisch", () => {
    const f = funde(osv, new Set(["CVE-2026-1"]), "/w");
    expect(f.map((x) => [x.id, x.schwere, x.dateien])).toEqual([
      ["GHSA-aaaa-bbbb-cccc", "kritisch", ["pnpm-lock.yaml"]],
      ["GHSA-dddd-eeee-ffff", "mittel", ["pnpm-lock.yaml"]],
      ["GHSA-g3hv-75wg-m249", "hoch", ["pnpm-lock.yaml"]],
    ]);
  });
});

describe("laufzeiten", () => {
  const inventar =
    "runtime: { sprache: node, version: 24.x }\nruntime: { sprache: node, version: 24.x }\nruntime: { sprache: python, version: 3.13 }\n";
  const eol = {
    nodejs: [{ cycle: "24", eol: "2028-04-30" }],
    python: [{ cycle: "3.13", eol: "2026-12-01" }],
    nextjs: [{ cycle: "16", eol: false }],
  };
  it("liest Zyklen aus Inventar und app/package.json, ohne Doppelte", () => {
    expect(
      laufzeiten(inventar, { dependencies: { next: "^16.4.4" } }, eol, start),
    ).toEqual([
      { produkt: "nodejs", zyklus: "24", status: "ok", ende: "2028-04-30" },
      { produkt: "python", zyklus: "3.13", status: "bald", ende: "2026-12-01" },
      { produkt: "nextjs", zyklus: "16", status: "ok", ende: "" },
    ]);
  });
});

describe("auswerten", () => {
  const alle = funde(osv, new Set(["CVE-2026-1"]), "/w");
  const lz = [{ produkt: "nodejs", zyklus: "24", status: "ok", ende: "" }];
  const lauf1 = auswerten({
    funde: alle,
    akzeptiert,
    laufzeiten: lz,
    stand: {},
    heute: start,
    lauf,
  });

  it("meldet neue kritische Funde sofort und führt Akzeptiertes getrennt", () => {
    expect(lauf1.alarme).toHaveLength(1);
    expect(lauf1.alarme[0]).toMatch(
      /^neu, kritisch \(aktiv ausgenutzt\): GHSA-aaaa-bbbb-cccc in next@16.4.4/,
    );
    expect(Object.keys(lauf1.neu.seit)).toEqual([
      "GHSA-aaaa-bbbb-cccc|next",
      "GHSA-dddd-eeee-ffff|next",
    ]);
    expect(lauf1.text).toContain("**Akzeptiert**");
    expect(lauf1.leer).toBe(false);
  });

  it("lässt fremde Texte den Stand nicht überschreiben und keine Erwähnung auslösen", () => {
    expect(JSON.parse(lauf1.text.match(STAND)[1])).toEqual(lauf1.neu);
    expect(lauf1.text).not.toMatch(/@jemand/);
  });

  it("meldet eine abgelaufene Frist genau einmal", () => {
    const lauf2 = auswerten({
      funde: alle,
      akzeptiert,
      laufzeiten: lz,
      stand: lauf1.neu,
      heute: tag(1),
      lauf,
    });
    expect(lauf2.alarme).toEqual([
      expect.stringMatching(/^Frist abgelaufen: GHSA-aaaa-bbbb-cccc/),
    ]);
    const lauf3 = auswerten({
      funde: alle,
      akzeptiert,
      laufzeiten: lz,
      stand: lauf2.neu,
      heute: tag(2),
      lauf,
    });
    expect(lauf3.alarme).toEqual([]);
    expect(lauf3.neu.seit).toEqual(lauf1.neu.seit);
  });

  it("zählt eine abgelaufene Akzeptanz wieder als offen", () => {
    const spaeter = auswerten({
      funde: alle,
      akzeptiert: [{ ...akzeptiert[0], pruefen_bis: "2026-11-01" }],
      laufzeiten: lz,
      stand: lauf1.neu,
      heute: tag(1),
      lauf,
    });
    expect(spaeter.alarme).toContainEqual(
      expect.stringMatching(/^neu, hoch: GHSA-g3hv-75wg-m249/),
    );
    expect(spaeter.text).toContain("Akzeptanz abgelaufen");
  });

  it("meldet ein Supportende einmal und ist sonst ohne Funde leer", () => {
    const eolLz = [
      { produkt: "python", zyklus: "3.13", status: "abgelaufen", ende: "" },
    ];
    const a = auswerten({
      funde: [],
      akzeptiert,
      laufzeiten: eolLz,
      stand: {},
      heute: start,
      lauf,
    });
    expect(a.alarme).toEqual(["Supportende erreicht: python 3.13"]);
    const b = auswerten({
      funde: [],
      akzeptiert,
      laufzeiten: eolLz,
      stand: a.neu,
      heute: tag(1),
      lauf,
    });
    expect(b.alarme).toEqual([]);
    expect(
      auswerten({
        funde: [],
        akzeptiert,
        laufzeiten: lz,
        stand: {},
        heute: start,
        lauf,
      }).leer,
    ).toBe(true);
  });
});
