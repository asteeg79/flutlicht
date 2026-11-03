# Security-Agent: Plan

Stand 03.11.2026. Der Pilot läuft in Flutlicht. Dieser Plan zieht in Phase 4 in das
Repo `security-agent` um. Einzelentscheidungen stehen in `docs/entscheidungen.md`.

Repos: flutlicht, scvh-app, rechnungs-agent, physionews (öffentlich), myworkgrid,
nachspielzeit, portfolio-analyser, vinted-relist (öffentlich), wm-tipp-agent.

## Phasen

| Phase | Inhalt | Stand |
| --- | --- | --- |
| 0 | PHP2Shell-Check, `security/inventory.yml` je Repo | erledigt (alle neun) |
| 1 | Renovate für Actions, Images und Laufzeiten; Dependabot-Security-Updates für Pakete; kritische und hohe Lücken schließen | erledigt. Node und Python werden nur nach Freigabe im Dashboard zum PR |
| 2 | Pilot Flutlicht: PR-Prüfung (gitleaks, Semgrep, Claude-Review), Wochenscan (Semgrep, gitleaks, ZAP) | läuft. Für Gate A fehlt `ANTHROPIC_API_KEY` |
| 3 | Pilot Flutlicht: Tagesabgleich (OSV, CISA KEV, endoflife.date), Fristen 24 h / 7 / 30 / 90 Tage, Alarm per Erwähnung | läuft seit 03.11. |
| 3b | Security-Cockpit (siehe unten) | als Nächstes, Pilot in Flutlicht |
| 4 | Rollout auf alle Repos über `security-agent` | nach Gate A |

## Gate A (zwei Wochen ab `ANTHROPIC_API_KEY`)

- Jeden Fund aus PR-Prüfung, Wochenscan und Tagesabgleich als treffend oder als Fehlalarm einordnen.
- Fehlalarme kommen als bekannte Ausnahmen in `security/review-instructions.md`.
- Kosten messen: Actions-Minuten und Claude-Token je PR.
- Weiter, wenn es wenige Fehlalarme gibt, kein echter Fund durchrutscht und die Kosten im Rahmen bleiben.

## Security-Cockpit

Eine Stelle, an der der Stand aller Scans steht und an der Updates und Fixes per Klick
entschieden werden. Entscheidung vom 03.11.2026: zuerst die GitHub-Lösung. Eine Seite auf
dem Pi kommt nur dazu, wenn er von unterwegs erreichbar ist. Bisher ist er das nicht.

**Aufbau**

- **Ansicht:** ein Issue „Security-Cockpit“ (Label `security-cockpit`). Ein Workflow schreibt es jeden Morgen nach dem Tagesabgleich neu, außerdem auf Abruf. Es zeigt je Repo:
  - die offenen Fristen
  - den letzten Wochenscan
  - offene Update-PRs von Renovate und Dependabot mit CI-Stand
  - Renovate-Updates, die auf Freigabe warten
  - akzeptierte Risiken, deren Prüfdatum in den nächsten 30 Tagen abläuft
- **Buttons:** Ankreuzfelder im Cockpit, wie im Dependency Dashboard von Renovate. Auf dem Handy über die GitHub-App.
  - „mergen“ für einen grünen Update-PR
  - „freigeben“ für ein Renovate-Update, das auf Freigabe wartet
  - „Risiko verlängern“ (90 Tage): öffnet einen PR auf `security/accepted-risks.json`
  - „neu prüfen“: startet den Tagesabgleich oder den Wochenscan
- **Ausführung:** ein zweiter Workflow reagiert auf `issues: edited`. Er führt nur Häkchen aus, die der Besitzer gesetzt hat, und prüft jede Aktion vorher gegen den aktuellen Stand bei GitHub, nicht gegen den Issue-Text:
  - PR offen, CI grün, mergebar
  - Autor Renovate, Dependabot oder ein `claude/*`-Branch
  - Head-SHA wie angezeigt, sonst Abbruch
  Danach entfernt er das Häkchen und schreibt das Ergebnis als Kommentar (Protokoll).
- **Grenzen:** Das Cockpit schreibt nie direkt auf `main`, außer beim Mergen eines geprüften PRs. Es löscht nichts und ändert keine Einstellungen. Texte aus PRs und Advisories gelten als Daten. Sie werden maskiert und nie ausgeführt.

**Schritte**

1. Pilot in Flutlicht (`security-cockpit.yml`). Ohne App nimmt er das `GITHUB_TOKEN`. Das darf keine PRs mergen, die `.github/workflows/` ändern, also fast keinen Renovate-PR, und sein Merge startet keine Workflows auf `main`. Mit der Cockpit-App aus Schritt 2, zunächst nur in Flutlicht installiert, fallen beide Grenzen weg.
2. In Phase 4 zieht es nach `security-agent` und deckt alle neun Repos ab. Den Zugriff bekommt es über eine eigene GitHub-App mit den kleinsten nötigen Rechten:
   - Contents und Pull requests schreiben (Mergen)
   - Issues schreiben
   - Checks lesen
   - Actions schreiben (Scans anstoßen)
   - Workflows schreiben (PRs mergen, die Workflows ändern)
   - Dependabot alerts lesen

   Der Schlüssel liegt nur als Secret in `security-agent`, nicht auf einem Gerät.
3. Optional ein Fix-Button: Zu einer offenen Frist startet er eine Claude-Code-Sitzung, die einen Fix-PR vorbereitet. Der PR durchläuft dieselbe Prüfung wie jeder andere.
4. Optional eine Seite auf dem Pi, erst wenn er über Tailscale erreichbar ist (VPN, kein offener Port). Sie liest den Status und stößt Aktionen nur über den Ausführungs-Workflow an. Ihr Token darf nur diesen Workflow starten und Status lesen, aber nicht mergen. Installation über Paket und Befehle, ausgeführt vom Besitzer.

## Phase 4: Rollout

1. **Repo `security-agent`** mit Reusable Workflows (`workflow_call`):
   - `pr-review.yml`, `weekly-scan.yml`, `daily.yml`, dazu das Cockpit
   - das Fristenskript und die Prüfanleitung

   Die Repos rufen die Workflows auf einen SHA gepinnt auf, Renovate hebt den Pin. Private Reusable Workflows brauchen in `security-agent` die Freigabe für die eigenen Repos.

2. **Parameter je Repo:**
   - Lockfiles
   - Live-URL (ZAP nur, wenn es eine gibt)
   - Auth-Header
   - Pfad zum Inventar

3. **Wellen:**

   | Welle | Repos | Hinweise |
   | --- | --- | --- |
   | 1 | physionews, myworkgrid, scvh-app | Node/Vercel wie Flutlicht |
   | 2 | nachspielzeit, rechnungs-agent, portfolio-analyser, wm-tipp-agent, vinted-relist | Python und Docker. Vorher Lockfiles sicherstellen, sonst sieht OSV nichts. Kein ZAP ohne öffentliche URL |

   Je Repo prüfen:
   - Inventar
   - `security/accepted-risks.json`
   - Probelauf im PR

4. **Übersicht:** Das Cockpit in `security-agent` fasst alle Repos zusammen.

## Betrieb

| Rhythmus | Was |
| --- | --- |
| je PR | Secret-Scan, Semgrep, Claude-Review |
| täglich | Tagesabgleich mit Fristen und Alarm, danach Cockpit neu |
| montags | Wochenscan und Bericht, Renovate-PRs |
| bei Ablauf des Prüfdatums | akzeptiertes Risiko zählt wieder als offen |
| vierteljährlich | Werkzeugversionen heben (OSV-Scanner, gitleaks, Semgrep) |
| nach dem Rollout (Gate B) | Zeit bis zum Fix je Schwere, eingehaltene Fristen |

**Actions-Kontingent:** Es war schon einmal aufgebraucht. Für die sieben privaten Repos überschlagen:

- Tagesabgleich etwa 210 Minuten im Monat
- Wochenscan etwa 140 Minuten im Monat
- Cockpit etwa 60 Minuten im Monat
- dazu die PR-Prüfungen

Das ist neben der bestehenden CI ein Teil der 2.000 Freiminuten; öffentliche Repos zählen nicht. Die Cron-Zeiten werden gestaffelt, es gibt kein ZAP ohne Live-URL und die PR-Prüfung nur bei Codeänderungen.

## Offene Entscheidungen

- Auto-Merge für Patch-Updates. Vorschlag: nein. Das Cockpit macht das Mergen zu einem Klick.
- Alarmkanal. Vorschlag: die Erwähnung bei GitHub, also Mail und Push nach den GitHub-Einstellungen.
- CSP mit Nonces in Flutlicht. Sie kostet die statische Startseite.
