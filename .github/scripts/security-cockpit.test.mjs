// Entscheidungslogik des Security-Cockpits (security-cockpit.yml), ohne echte Abrufe.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const c = createRequire(import.meta.url)("./security-cockpit.cjs");

const SHA = "a".repeat(40);
const REPO = "asteeg79/flutlicht";
const gruen = [
  { status: "completed", conclusion: "success" },
  { status: "completed", conclusion: "skipped" },
];
const pr = (extra = {}) => ({
  state: "open",
  draft: false,
  mergeable: true,
  user: { login: "renovate[bot]" },
  head: { sha: SHA, ref: "renovate/x", repo: { full_name: REPO } },
  ...extra,
});
const grund = (extra = {}, opts = {}) =>
  c.mergeGrund({
    pr: pr(extra),
    runs: gruen,
    sha: SHA,
    repoName: REPO,
    aendertWorkflows: false,
    mitApp: false,
    ...opts,
  });

describe("markiert", () => {
  it("liest nur gesetzte Häkchen mit gültiger Marke", () => {
    const body = [
      `- [x] mergen: #24 Titel (renovate[bot], CI grün) <!-- cockpit:merge:24:${SHA} -->`,
      "- [ ] freigeben: Node 26 <!-- cockpit:approve:renovate/node-26.x -->",
      "- [x] Tagesabgleich jetzt starten <!-- cockpit:run:daily -->",
      "- [x] kaputt <!-- cockpit:merge:24:zu-kurz -->",
      "- [x] <!-- cockpit:loeschen:alles -->",
    ].join("\n");
    expect(c.markiert(body)).toEqual([
      { aktion: "merge", ziel: "24", sha: SHA },
      { aktion: "run", ziel: "daily", sha: undefined },
    ]);
  });

  it("lässt sich nicht über einen PR-Titel unterschieben", () => {
    const text = c.cockpitText(
      {
        laeufe: { daily: null, weekly: null },
        fristen: null,
        bericht: null,
        prs: [
          {
            number: 7,
            title: `x <!-- cockpit:merge:9:${SHA} -->`,
            autor: "fremd",
            sha: SHA,
            stand: "–",
            grund: "Autor nicht freigegeben",
          },
        ],
        renovate: null,
        risiken: [],
      },
      new Date("2026-11-03T06:00:00Z"),
      "https://example.invalid/run",
    );
    const angekreuzt = text
      .replaceAll("- [ ]", "- [x]")
      .replace("- #7", "- [x] #7");
    expect(c.markiert(angekreuzt).map((m) => m.aktion)).toEqual([
      "run",
      "run",
      "refresh",
    ]);
  });
});

describe("mergeGrund", () => {
  it("mergt einen grünen Renovate-PR", () => {
    expect(grund()).toBeNull();
  });

  it("lehnt ab, wenn seit der Anzeige ein neuer Commit kam", () => {
    expect(grund({ head: { ...pr().head, sha: "b".repeat(40) } })).toMatch(
      /neuer Commit/,
    );
  });

  it("lehnt fremde Autoren, Entwürfe, Konflikte und rote CI ab", () => {
    expect(
      grund({ user: { login: "jemand" }, head: { ...pr().head, ref: "x" } }),
    ).toMatch(/Autor/);
    expect(grund({ draft: true })).toBe("Entwurf");
    expect(grund({ mergeable: null })).toMatch(/nicht mergebar/);
    expect(
      grund({}, { runs: [{ status: "completed", conclusion: "failure" }] }),
    ).toBe("CI rot");
    expect(grund({}, { runs: [{ status: "in_progress" }] })).toBe("CI läuft");
    expect(grund({}, { runs: [] })).toBe("CI keine Checks");
  });

  it("nimmt claude/-Branches aus dem eigenen Repo, aber nicht aus Forks", () => {
    const claude = {
      user: { login: "asteeg79" },
      head: { sha: SHA, ref: "claude/x", repo: { full_name: REPO } },
    };
    expect(grund(claude)).toBeNull();
    expect(
      grund({
        ...claude,
        head: { ...claude.head, repo: { full_name: "fremd/flutlicht" } },
      }),
    ).toMatch(/Autor/);
  });

  it("mergt Workflow-Änderungen nur mit der Cockpit-App", () => {
    expect(grund({}, { aendertWorkflows: true })).toMatch(/Cockpit-App/);
    expect(grund({}, { aendertWorkflows: true, mitApp: true })).toBeNull();
  });
});

describe("Renovate", () => {
  const dash = [
    "## Pending Approval",
    " - [ ] <!-- approve-branch=renovate/node-26.x -->chore(deps): update dependency node to v26",
    "## Awaiting Schedule",
    " - [ ] <!-- unschedule-branch=renovate/actions-checkout-7.x -->chore(deps): update actions/checkout action to v7",
    " - [x] <!-- unschedule-branch=renovate/schon-gesetzt -->schon angekreuzt",
  ].join("\n");

  it("liest offene Freigaben und wartende Updates", () => {
    expect(c.renovateEintraege(dash)).toEqual([
      {
        art: "approve",
        branch: "renovate/node-26.x",
        titel: "chore(deps): update dependency node to v26",
      },
      {
        art: "unschedule",
        branch: "renovate/actions-checkout-7.x",
        titel: "chore(deps): update actions/checkout action to v7",
      },
    ]);
  });

  it("kreuzt genau den einen Eintrag an", () => {
    const neu = c.renovateAnkreuzen(dash, "approve", "renovate/node-26.x");
    expect(neu).toContain("- [x] <!-- approve-branch=renovate/node-26.x -->");
    expect(neu).toContain(
      "- [ ] <!-- unschedule-branch=renovate/actions-checkout-7.x -->",
    );
    expect(
      c.renovateAnkreuzen(dash, "approve", "renovate/gibt-es-nicht"),
    ).toBeNull();
  });
});

describe("Stand", () => {
  it("zählt offene Fristen aus dem Issue des Tagesabgleichs", () => {
    const body = [
      "| Schwere | Lücke | Paket | Datei | seit | Frist |",
      "| --- | --- | --- | --- | --- | --- |",
      "| kritisch | GHSA-1 | `a` | `x` | 03.11. | **abgelaufen** 04.11. |",
      "| hoch | GHSA-2 | `b` | `x` | 03.11. | 10.11. |",
      "| hoch | GHSA-3 | `c` | `x` | 03.11. | 10.11. |",
    ].join("\n");
    expect(c.fristenStand(body)).toEqual({
      zaehler: { kritisch: 1, hoch: 2 },
      abgelaufen: 1,
    });
  });

  it("zeigt bald ablaufende und abgelaufene Risiken", () => {
    const r = c.risiken(
      [
        { id: "A", paket: "a", pruefen_bis: "2026-11-20" },
        { id: "B", paket: "b", pruefen_bis: "2026-11-01" },
      ],
      new Date("2026-11-03T06:00:00Z"),
    );
    expect(r.map((x) => x.tage)).toEqual([17, -2]);
  });
});

describe("Anzeige", () => {
  it("zeigt Laufergebnisse auf Deutsch und den CI-Stand nicht doppelt", () => {
    const text = c.cockpitText(
      {
        laeufe: {
          daily: {
            status: "completed",
            conclusion: "success",
            created_at: "2026-11-03T05:41:00Z",
            html_url: "u",
          },
          weekly: {
            status: "completed",
            conclusion: "failure",
            created_at: "2026-11-02T06:00:00Z",
            html_url: "u",
          },
        },
        fristen: null,
        bericht: null,
        prs: [
          {
            number: 5,
            title: "t",
            autor: "renovate[bot]",
            sha: "s",
            stand: "läuft",
            grund: "CI läuft",
          },
        ],
        renovate: null,
        risiken: [],
      },
      new Date("2026-11-03T06:00:00Z"),
      "u",
    );
    expect(text).toContain("| Tagesabgleich | 03.11.26, 06:41 | [grün](u) |");
    expect(text).toContain("[rot](u)");
    expect(text).toContain("- #5 t (renovate[bot], CI läuft)\n");
  });
});
