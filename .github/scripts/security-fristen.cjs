// Security-Agent, Phase 3: Fristen für offene Lücken. security-daily.yml ruft das
// Skript über actions/github-script auf. Es liest osv.json (OSV-Scanner), kev.json
// (CISA KEV) und eol-*.json (endoflife.date) und hält ein Issue mit den Fristen aktuell.
const fs = require("node:fs");
const path = require("node:path");

const FRISTEN_TAGE = { kritisch: 1, hoch: 7, mittel: 30, niedrig: 90 };
const REIHENFOLGE = ["kritisch", "hoch", "mittel", "niedrig"];
const LABEL = "security-deadlines";
const TITEL = "Sicherheitslücken: offene Fristen";
const STAND = /<!-- stand: (\{.*?\}) -->/s;
const TAG_MS = 24 * 60 * 60 * 1000;
// Laufzeiten aus security/inventory.yml → Produkt bei endoflife.date
const PRODUKTE = { node: "nodejs", python: "python" };

function schwere(vuln, gruppe) {
  const ghsa = String(vuln?.database_specific?.severity ?? "").toUpperCase();
  if (ghsa === "CRITICAL") return "kritisch";
  if (ghsa === "HIGH") return "hoch";
  if (ghsa === "MODERATE" || ghsa === "MEDIUM") return "mittel";
  if (ghsa === "LOW") return "niedrig";
  const score = Number(gruppe?.max_severity);
  if (score >= 9) return "kritisch";
  if (score >= 7) return "hoch";
  if (score >= 4) return "mittel";
  return "niedrig";
}

/** Funde aus der OSV-Ausgabe, je Lücke und Paket einer. */
function funde(osv, kevCves, basis) {
  const out = new Map();
  for (const result of osv.results ?? []) {
    const datei = path.relative(basis, result.source?.path ?? "");
    for (const pkg of result.packages ?? []) {
      const name = `${pkg.package?.name}@${pkg.package?.version}`;
      const gruppen = pkg.groups?.length
        ? pkg.groups
        : (pkg.vulnerabilities ?? []).map((v) => ({
            ids: [v.id],
            aliases: v.aliases ?? [],
          }));
      for (const gruppe of gruppen) {
        const ids = [
          ...new Set([...(gruppe.ids ?? []), ...(gruppe.aliases ?? [])]),
        ];
        const id = ids.find((i) => i.startsWith("GHSA-")) ?? ids[0];
        const vuln = (pkg.vulnerabilities ?? []).find((v) =>
          ids.includes(v.id),
        );
        const cves = ids.filter((i) => i.startsWith("CVE-"));
        const kev = cves.some((c) => kevCves.has(c));
        const key = `${id}|${pkg.package?.name}`;
        const alt = out.get(key);
        out.set(key, {
          key,
          id,
          ids,
          paket: name,
          dateien: [...new Set([...(alt?.dateien ?? []), datei])],
          titel: vuln?.summary ?? "",
          kev,
          schwere: kev ? "kritisch" : schwere(vuln, gruppe),
        });
      }
    }
  }
  return [...out.values()];
}

/** Laufzeiten aus dem Inventar und Next.js aus app/package.json, mit Supportende. */
function laufzeiten(inventar, appPackage, eol, heute) {
  const eintraege = [];
  // „24.x“ → Zyklus 24, „3.13“ → Zyklus 3.13
  for (const m of inventar.matchAll(
    /runtime: \{ sprache: (\w+), version: "?(\d+(?:\.\d+)*)/g,
  )) {
    const produkt = PRODUKTE[m[1]];
    if (produkt) eintraege.push({ produkt, zyklus: m[2] });
  }
  const next = appPackage.dependencies?.next?.match(/(\d+)/)?.[1];
  if (next) eintraege.push({ produkt: "nextjs", zyklus: next });
  const gesehen = new Set();
  return eintraege
    .filter(
      (e) =>
        !gesehen.has(`${e.produkt}@${e.zyklus}`) &&
        gesehen.add(`${e.produkt}@${e.zyklus}`),
    )
    .map((e) => ({ ...e, ...supportende(eol[e.produkt], e.zyklus, heute) }));
}

function supportende(zyklen, zyklus, heute) {
  const z = (zyklen ?? []).find((c) => String(c.cycle) === zyklus);
  if (!z) return { status: "unbekannt", ende: "" };
  if (z.eol === true) return { status: "abgelaufen", ende: "" };
  if (z.eol === false) return { status: "ok", ende: "" };
  const ende = String(z.eol);
  const tage = (Date.parse(ende) - heute.getTime()) / TAG_MS;
  let status = "ok";
  if (tage <= 0) status = "abgelaufen";
  else if (tage <= 90) status = "bald";
  return { status, ende };
}

function zeit(iso) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

// Texte aus den Feeds sind fremd: keine Erwähnungen auslösen und kein HTML, das den
// Stand-Kommentar am Ende des Issues vortäuscht.
const zelle = (s) =>
  String(s)
    .replaceAll("|", String.raw`\|`)
    .replaceAll(/[\r\n]+/g, " ")
    .replaceAll("<", "&lt;")
    .replaceAll("@", "@\u200b");

/** Frist und Alarme eines offenen Funds; schreibt den Stand nach `neu`. */
function fundBewerten(f, stand, neu, heute, alarme) {
  const bekannt = stand.seit?.[f.key];
  const seit = bekannt ?? heute.toISOString();
  const frist = new Date(
    Date.parse(seit) + FRISTEN_TAGE[f.schwere] * TAG_MS,
  ).toISOString();
  const faellig = Date.parse(frist) <= heute.getTime();
  neu.seit[f.key] = seit;
  let gemeldet = stand.gemeldet?.[f.key];
  if (!bekannt && (f.schwere === "kritisch" || f.schwere === "hoch")) {
    const kev = f.kev ? " (aktiv ausgenutzt)" : "";
    alarme.push(
      `neu, ${f.schwere}${kev}: ${f.id} in ${f.paket}, Frist ${zeit(frist)}`,
    );
    gemeldet = "neu";
  }
  if (faellig && gemeldet !== "faellig") {
    alarme.push(
      `Frist abgelaufen: ${f.id} in ${f.paket} (${f.schwere}, seit ${zeit(seit)})`,
    );
    gemeldet = "faellig";
  }
  if (gemeldet) neu.gemeldet[f.key] = gemeldet;
  return { ...f, seit, frist, faellig };
}

/** Alarm beim erreichten Supportende, einmal je Laufzeit und Zyklus. */
function laufzeitBewerten(l, stand, neu, alarme) {
  const key = `eol|${l.produkt}@${l.zyklus}`;
  if (l.status === "abgelaufen" && stand.gemeldet?.[key] !== "faellig") {
    alarme.push(`Supportende erreicht: ${l.produkt} ${l.zyklus}`);
    neu.gemeldet[key] = "faellig";
  } else if (stand.gemeldet?.[key]) {
    neu.gemeldet[key] = stand.gemeldet[key];
  }
}

function fundZeile(f) {
  const hinweise = [];
  if (f.kev) hinweise.push("aktiv ausgenutzt");
  if (f.abgelaufenesOk) hinweise.push("Akzeptanz abgelaufen");
  const luecke = hinweise.length ? `${f.id} (${hinweise.join(", ")})` : f.id;
  const frist = f.faellig ? `**abgelaufen** ${zeit(f.frist)}` : zeit(f.frist);
  const dateien = f.dateien.map((d) => "`" + d + "`").join(", ");
  return `| ${f.schwere} | ${luecke}: ${zelle(f.titel)} | \`${f.paket}\` | ${dateien} | ${zeit(f.seit)} | ${frist} |`;
}

function issueText({ offen, angenommen, lz, neu, heute, lauf }) {
  const zeilen = [
    `Tagesabgleich vom ${zeit(heute.toISOString())} ([Lauf](${lauf})). Fristen ab dem ersten Fund: kritisch 24 h, hoch 7 Tage, mittel 30 Tage, niedrig 90 Tage. Aktiv ausgenutzte Lücken (CISA KEV) gelten als kritisch.`,
    "",
  ];
  if (offen.length) {
    zeilen.push(
      "**Offen**",
      "",
      "| Schwere | Lücke | Paket | Datei | seit | Frist |",
      "| --- | --- | --- | --- | --- | --- |",
      ...offen.map(fundZeile),
    );
  } else {
    zeilen.push("**Offen:** keine.");
  }
  if (angenommen.length) {
    zeilen.push(
      "",
      "**Akzeptiert** (`security/accepted-risks.json`)",
      "",
      "| Lücke | Paket | Grund | prüfen bis |",
      "| --- | --- | --- | --- |",
      ...angenommen.map(
        (a) =>
          `| ${a.id} | \`${a.paket}\` | ${zelle(a.grund)} | ${a.pruefen_bis} |`,
      ),
    );
  }
  zeilen.push(
    "",
    "**Laufzeiten** (endoflife.date)",
    "",
    "| Laufzeit | Version | Supportende | Stand |",
    "| --- | --- | --- | --- |",
    ...lz.map(
      (l) => `| ${l.produkt} | ${l.zyklus} | ${l.ende || "–"} | ${l.status} |`,
    ),
    "",
    `<!-- stand: ${JSON.stringify(neu)} -->`,
  );
  return zeilen.join("\n");
}

/** Reine Auswertung: neuer Stand, Issue-Text und Hinweise für die Erwähnung. */
function auswerten({
  funde: alle,
  akzeptiert,
  laufzeiten: lz,
  stand,
  heute,
  lauf,
}) {
  const neu = { seit: {}, gemeldet: {} };
  const offen = [];
  const angenommen = [];
  const alarme = [];
  for (const f of alle) {
    const ok = akzeptiert.find((a) => f.ids.includes(a.id));
    if (ok && Date.parse(ok.pruefen_bis) > heute.getTime()) {
      angenommen.push({ ...f, ...ok });
    } else {
      offen.push({
        ...fundBewerten(f, stand, neu, heute, alarme),
        abgelaufenesOk: ok,
      });
    }
  }
  for (const l of lz) laufzeitBewerten(l, stand, neu, alarme);
  offen.sort(
    (a, b) =>
      REIHENFOLGE.indexOf(a.schwere) - REIHENFOLGE.indexOf(b.schwere) ||
      a.frist.localeCompare(b.frist),
  );
  const warnLz = lz.filter(
    (l) => l.status === "abgelaufen" || l.status === "bald",
  );
  return {
    neu,
    alarme,
    text: issueText({ offen, angenommen, lz, neu, heute, lauf }),
    leer: !offen.length && !warnLz.length,
  };
}

module.exports = async function abgleich({ github, context, core }) {
  const basis = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const lese = (datei) =>
    JSON.parse(fs.readFileSync(path.join(basis, datei), "utf8"));
  const kev = new Set(
    (lese("kev.json").vulnerabilities ?? []).map((v) => v.cveID),
  );
  const eol = Object.fromEntries(
    ["nodejs", "python", "nextjs"].map((p) => [p, lese(`eol-${p}.json`)]),
  );
  const heute = new Date();
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  const { data: offeneIssues } = await github.rest.issues.listForRepo({
    ...repo,
    state: "open",
    labels: LABEL,
  });
  const issue = offeneIssues[0];
  const stand = JSON.parse(issue?.body?.match(STAND)?.[1] ?? "{}");
  const ergebnis = auswerten({
    funde: funde(lese("osv.json"), kev, basis),
    akzeptiert: lese("security/accepted-risks.json"),
    laufzeiten: laufzeiten(
      fs.readFileSync(path.join(basis, "security/inventory.yml"), "utf8"),
      lese("app/package.json"),
      eol,
      heute,
    ),
    stand,
    heute,
    lauf: `${context.serverUrl}/${repo.owner}/${repo.repo}/actions/runs/${context.runId}`,
  });
  if (context.eventName === "pull_request") {
    // Probelauf für Änderungen am Abgleich: nur anzeigen, kein Issue und keine Erwähnung.
    core.info(ergebnis.text);
    core.info(`Alarme: ${ergebnis.alarme.join("; ") || "keine"}`);
    await core.summary
      .addRaw(ergebnis.text)
      .addRaw(`\n\n**Alarme:** ${ergebnis.alarme.join("; ") || "keine"}\n`)
      .write();
    return;
  }
  if (ergebnis.leer) {
    if (issue) {
      await github.rest.issues.createComment({
        ...repo,
        issue_number: issue.number,
        body: "Keine offenen Fristen mehr.",
      });
      await github.rest.issues.update({
        ...repo,
        issue_number: issue.number,
        state: "closed",
        state_reason: "completed",
      });
    }
    core.info("Keine offenen Fristen.");
    return;
  }
  let nummer = issue?.number;
  if (issue) {
    await github.rest.issues.update({
      ...repo,
      issue_number: nummer,
      body: ergebnis.text,
    });
  } else {
    ({
      data: { number: nummer },
    } = await github.rest.issues.create({
      ...repo,
      title: TITEL,
      body: ergebnis.text,
      labels: [LABEL],
    }));
  }
  if (ergebnis.alarme.length) {
    // Die Erwähnung löst bei GitHub Mail und Push nach den Einstellungen des Besitzers aus.
    await github.rest.issues.createComment({
      ...repo,
      issue_number: nummer,
      body: [
        `@${repo.owner}`,
        "",
        ...ergebnis.alarme.map((a) => `- ${a}`),
      ].join("\n"),
    });
  }
};

module.exports.auswerten = auswerten;
module.exports.funde = funde;
module.exports.laufzeiten = laufzeiten;
