// Security-Cockpit, Pilot (security/plan.md): ein Issue mit dem Stand der Scans und
// Ankreuzfeldern für Entscheidungen. security-cockpit.yml ruft das Skript über
// actions/github-script auf. Jeder Lauf führt zuerst die gesetzten Häkchen aus, jedes
// geprüft gegen den aktuellen Stand bei GitHub, und schreibt das Cockpit danach neu.
const fs = require("node:fs");
const path = require("node:path");
const { zeit, zelle } = require("./security-fristen.cjs");

const LABEL = "security-cockpit";
const TITEL = "Security-Cockpit";
const AUTOREN = new Set(["renovate[bot]", "dependabot[bot]"]);
const OK_CHECKS = new Set(["success", "neutral", "skipped"]);
const WORKFLOWS = {
  daily: { datei: "security-daily.yml", name: "Tagesabgleich" },
  weekly: { datei: "security-weekly-scan.yml", name: "Wochenscan" },
};
const TAG_MS = 24 * 60 * 60 * 1000;
// Ein Häkchen zählt nur in genau der Form, in der das Cockpit die Zeile schreibt.
// Fremde Texte (PR-Titel) sind maskiert und können keine Marke enthalten.
const MARKE =
  /^- \[[xX]\] .*<!-- cockpit:(merge|approve|unschedule|run|refresh):([\w./@-]+)(?::([0-9a-f]{40}))? -->$/;
const RENOVATE =
  /^ ?- \[ \] <!-- (approve|unschedule)-branch=([\w./@-]+) -->(.+)$/;

/** Gesetzte Häkchen im Cockpit, nur gültige Marken. */
function markiert(body) {
  const out = [];
  for (const zeile of String(body ?? "").split("\n")) {
    const m = zeile.trim().match(MARKE);
    if (m) out.push({ aktion: m[1], ziel: m[2], sha: m[3] });
  }
  return out;
}

function pruefStand(runs) {
  if (!runs.length) return "keine Checks";
  if (runs.some((r) => r.status !== "completed")) return "läuft";
  return runs.every((r) => OK_CHECKS.has(r.conclusion)) ? "grün" : "rot";
}

function autorErlaubt(pr, repoName) {
  if (AUTOREN.has(pr.user?.login)) return true;
  return (
    pr.head?.ref?.startsWith("claude/") && pr.head?.repo?.full_name === repoName
  );
}

/** Grund, warum ein PR nicht gemergt wird, oder null. */
function mergeGrund({ pr, runs, sha, repoName, aendertWorkflows, mitApp }) {
  if (pr.state !== "open") return "nicht mehr offen";
  if (pr.head.sha !== sha) return "neuer Commit seit der Anzeige";
  if (!autorErlaubt(pr, repoName)) return "Autor nicht freigegeben";
  if (pr.draft) return "Entwurf";
  if (pr.mergeable !== true) return "nicht mergebar (Konflikt oder noch offen)";
  if (pruefStand(runs) !== "grün") return `CI ${pruefStand(runs)}`;
  if (aendertWorkflows && !mitApp)
    return "ändert Workflows, braucht die Cockpit-App";
  return null;
}

/** Offene Renovate-Einträge im Dependency Dashboard. */
function renovateEintraege(body) {
  const out = [];
  for (const zeile of String(body ?? "").split("\n")) {
    const m = zeile.match(RENOVATE);
    if (m) out.push({ art: m[1], branch: m[2], titel: m[3].trim() });
  }
  return out;
}

/** Häkchen im Dependency Dashboard setzen; null, wenn der Eintrag fehlt. */
function renovateAnkreuzen(body, art, branch) {
  const alt = `- [ ] <!-- ${art}-branch=${branch} -->`;
  if (String(body).split(alt).length !== 2) return null;
  return body.replace(alt, `- [x] <!-- ${art}-branch=${branch} -->`);
}

/** Offene Fristen aus dem Issue des Tagesabgleichs. */
function fristenStand(body) {
  const zaehler = {};
  let abgelaufen = 0;
  for (const zeile of String(body ?? "").split("\n")) {
    const m = zeile.match(/^\| (kritisch|hoch|mittel|niedrig) \|/);
    if (!m) continue;
    zaehler[m[1]] = (zaehler[m[1]] ?? 0) + 1;
    if (zeile.includes("**abgelaufen**")) abgelaufen++;
  }
  return { zaehler, abgelaufen };
}

function risiken(akzeptiert, heute) {
  return akzeptiert.map((a) => ({
    ...a,
    tage: Math.ceil((Date.parse(a.pruefen_bis) - heute.getTime()) / TAG_MS),
  }));
}

function laufZeile(name, run) {
  if (!run) return `| ${name} | – | noch nie gelaufen |`;
  const ergebnis =
    run.status === "completed" ? (run.conclusion ?? "") : "läuft";
  return `| ${name} | ${zeit(run.created_at)} | [${ergebnis}](${run.html_url}) |`;
}

function fristenZeile(fristen) {
  if (!fristen) return "- Fristen: keine offen.";
  const teile = ["kritisch", "hoch", "mittel", "niedrig"]
    .filter((s) => fristen.zaehler[s])
    .map((s) => `${fristen.zaehler[s]}× ${s}`);
  const ab = fristen.abgelaufen ? `, ${fristen.abgelaufen} abgelaufen` : "";
  return `- Fristen: ${teile.join(", ") || "keine Lücke"}${ab} (#${fristen.nummer})`;
}

function prZeile(p) {
  const text = `#${p.number} ${zelle(p.title)} (${p.autor}, CI ${p.stand})`;
  if (p.grund) return `- ${text}: ${p.grund}`;
  return `- [ ] mergen: ${text} <!-- cockpit:merge:${p.number}:${p.sha} -->`;
}

function renovateZeilen(renovate) {
  if (!renovate) return ["Kein Dependency Dashboard gefunden."];
  const freigabe = renovate.eintraege.filter((e) => e.art === "approve");
  const montag = renovate.eintraege.filter((e) => e.art === "unschedule");
  const zeile = (e, wort) =>
    `- [ ] ${wort}: ${zelle(e.titel)} <!-- cockpit:${e.art}:${e.branch} -->`;
  return [
    `Wartet auf Freigabe (Dashboard #${renovate.nummer}):`,
    ...(freigabe.length
      ? freigabe.map((e) => zeile(e, "freigeben"))
      : ["- keine"]),
    "",
    "Wartet auf Montag:",
    ...(montag.length
      ? montag.map((e) => zeile(e, "jetzt erstellen"))
      : ["- keine"]),
  ];
}

function risikoZeile(r) {
  let hinweis = `noch ${r.tage} Tage`;
  if (r.tage <= 0) hinweis = "**abgelaufen**, zählt wieder als offen";
  else if (r.tage <= 30) hinweis = `**bald prüfen** (${r.tage} Tage)`;
  return `| ${r.id} | \`${r.paket}\` | ${r.pruefen_bis} | ${hinweis} |`;
}

/** Text des Cockpits aus dem gesammelten Stand. */
function cockpitText(stand, heute, lauf) {
  return [
    `Stand vom ${zeit(heute.toISOString())} ([Lauf](${lauf})). Ein Häkchen führt die Aktion aus, meist innerhalb einer Minute; das Ergebnis steht danach als Kommentar. Vorher wird jede Aktion gegen den aktuellen Stand bei GitHub geprüft.`,
    "",
    "### Scans",
    "",
    "| Scan | letzter Lauf | Ergebnis |",
    "| --- | --- | --- |",
    laufZeile(WORKFLOWS.daily.name, stand.laeufe.daily),
    laufZeile(WORKFLOWS.weekly.name, stand.laeufe.weekly),
    "",
    fristenZeile(stand.fristen),
    stand.bericht
      ? `- Wochenbericht: #${stand.bericht.number} vom ${zeit(stand.bericht.created_at)}`
      : "- Wochenbericht: keiner offen",
    "",
    "### Update-PRs",
    "",
    ...(stand.prs.length ? stand.prs.map(prZeile) : ["- keine offen"]),
    "",
    "### Renovate",
    "",
    ...renovateZeilen(stand.renovate),
    "",
    "### Akzeptierte Risiken",
    "",
    "| Lücke | Paket | prüfen bis | Stand |",
    "| --- | --- | --- | --- |",
    ...stand.risiken.map(risikoZeile),
    "",
    "### Aktionen",
    "",
    "- [ ] Tagesabgleich jetzt starten <!-- cockpit:run:daily -->",
    "- [ ] Wochenscan jetzt starten <!-- cockpit:run:weekly -->",
    "- [ ] Cockpit neu laden <!-- cockpit:refresh:cockpit -->",
  ].join("\n");
}

async function letzterLauf(github, repo, datei, branch) {
  const { data } = await github.rest.actions.listWorkflowRuns({
    ...repo,
    workflow_id: datei,
    branch,
    per_page: 1,
  });
  return data.workflow_runs[0] ?? null;
}

async function offenesIssue(github, repo, label) {
  const { data } = await github.rest.issues.listForRepo({
    ...repo,
    state: "open",
    labels: label,
    per_page: 1,
  });
  return data[0] ?? null;
}

async function dashboard(github, repo) {
  const { data } = await github.rest.issues.listForRepo({
    ...repo,
    state: "open",
    creator: "renovate[bot]",
  });
  return data.find((i) => i.title === "Dependency Dashboard") ?? null;
}

async function aendertWorkflows(github, repo, nummer) {
  const dateien = await github.paginate(github.rest.pulls.listFiles, {
    ...repo,
    pull_number: nummer,
    per_page: 100,
  });
  return dateien.some((d) => d.filename.startsWith(".github/workflows/"));
}

async function prPruefen(api, nummer, sha) {
  const { github, repo, repoName, mitApp } = api;
  const { data: pr } = await github.rest.pulls.get({
    ...repo,
    pull_number: nummer,
  });
  const runs = await github.paginate(github.rest.checks.listForRef, {
    ...repo,
    ref: pr.head.sha,
    per_page: 100,
  });
  const workflows = await aendertWorkflows(github, repo, nummer);
  const grund = mergeGrund({
    pr,
    runs,
    sha: sha ?? pr.head.sha,
    repoName,
    aendertWorkflows: workflows,
    mitApp,
  });
  return { pr, runs, grund };
}

async function sammeln(api) {
  const { github, repo, basis, branch, repoName, heute } = api;
  const fristIssue = await offenesIssue(github, repo, "security-deadlines");
  const dash = await dashboard(github, repo);
  const { data: pulls } = await github.rest.pulls.list({
    ...repo,
    state: "open",
    per_page: 30,
  });
  const prs = [];
  for (const p of pulls) {
    const eintrag = {
      number: p.number,
      title: p.title,
      autor: p.user?.login ?? "",
      sha: p.head.sha,
    };
    if (autorErlaubt(p, repoName)) {
      const { runs, grund } = await prPruefen(api, p.number, p.head.sha);
      prs.push({ ...eintrag, stand: pruefStand(runs), grund });
    } else {
      prs.push({ ...eintrag, stand: "–", grund: "Autor nicht freigegeben" });
    }
  }
  const akzeptiert = JSON.parse(
    fs.readFileSync(path.join(basis, "security/accepted-risks.json"), "utf8"),
  );
  return {
    laeufe: {
      daily: await letzterLauf(github, repo, WORKFLOWS.daily.datei, branch),
      weekly: await letzterLauf(github, repo, WORKFLOWS.weekly.datei, branch),
    },
    fristen: fristIssue
      ? { nummer: fristIssue.number, ...fristenStand(fristIssue.body) }
      : null,
    bericht: await offenesIssue(github, repo, "security-report"),
    prs,
    renovate: dash
      ? { nummer: dash.number, eintraege: renovateEintraege(dash.body) }
      : null,
    risiken: risiken(akzeptiert, heute),
  };
}

async function ausfuehren(api, e) {
  const { github, repo, branch } = api;
  if (e.aktion === "refresh") return null;
  if (e.aktion === "run") {
    const wf = WORKFLOWS[e.ziel];
    if (!wf) return `Unbekannter Scan: ${e.ziel}`;
    await github.rest.actions.createWorkflowDispatch({
      ...repo,
      workflow_id: wf.datei,
      ref: branch,
    });
    return `${wf.name} gestartet.`;
  }
  if (e.aktion === "merge") {
    if (!/^\d+$/.test(e.ziel) || !e.sha) return `Ungültige Marke: ${e.ziel}`;
    const { grund } = await prPruefen(api, Number(e.ziel), e.sha);
    if (grund) return `#${e.ziel} nicht gemergt: ${grund}.`;
    await github.rest.pulls.merge({
      ...repo,
      pull_number: Number(e.ziel),
      sha: e.sha,
      merge_method: "squash",
    });
    return `#${e.ziel} gemergt.`;
  }
  const dash = await dashboard(github, repo);
  const neu = dash && renovateAnkreuzen(dash.body, e.aktion, e.ziel);
  if (!neu) return `Renovate: ${e.ziel} steht nicht mehr im Dashboard.`;
  await github.rest.issues.update({
    ...repo,
    issue_number: dash.number,
    body: neu,
  });
  return e.aktion === "approve"
    ? `Renovate: ${e.ziel} freigegeben, der PR kommt beim nächsten Renovate-Lauf.`
    : `Renovate: ${e.ziel} wird jetzt erstellt.`;
}

module.exports = async function cockpit({ github, context, core }) {
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  const api = {
    github,
    repo,
    repoName: `${repo.owner}/${repo.repo}`,
    basis: process.env.GITHUB_WORKSPACE ?? process.cwd(),
    branch: context.payload.repository?.default_branch ?? "main",
    mitApp: process.env.COCKPIT_MIT_APP === "true",
    heute: new Date(),
  };
  const probe = context.eventName === "pull_request";
  const issue = await offenesIssue(github, repo, LABEL);
  const ergebnisse = [];
  if (issue && !probe) {
    for (const e of markiert(issue.body)) {
      try {
        const r = await ausfuehren(api, e);
        if (r) ergebnisse.push(r);
      } catch (err) {
        ergebnisse.push(
          `${e.aktion} ${e.ziel}: Fehler ${err.status ?? ""} ${err.message}`,
        );
      }
    }
  }
  const lauf = `${context.serverUrl}/${api.repoName}/actions/runs/${context.runId}`;
  const text = cockpitText(await sammeln(api), api.heute, lauf);
  if (probe) {
    // Probelauf für Änderungen am Cockpit: nur anzeigen, nichts ausführen.
    core.info(text);
    await core.summary.addRaw(text).write();
    return;
  }
  let nummer = issue?.number;
  if (issue) {
    await github.rest.issues.update({
      ...repo,
      issue_number: nummer,
      body: text,
    });
  } else {
    ({
      data: { number: nummer },
    } = await github.rest.issues.create({
      ...repo,
      title: TITEL,
      body: text,
      labels: [LABEL],
    }));
  }
  if (ergebnisse.length) {
    await github.rest.issues.createComment({
      ...repo,
      issue_number: nummer,
      body: ergebnisse.map((r) => `- ${r}`).join("\n"),
    });
  }
};

module.exports.markiert = markiert;
module.exports.mergeGrund = mergeGrund;
module.exports.pruefStand = pruefStand;
module.exports.renovateEintraege = renovateEintraege;
module.exports.renovateAnkreuzen = renovateAnkreuzen;
module.exports.fristenStand = fristenStand;
module.exports.cockpitText = cockpitText;
module.exports.risiken = risiken;
