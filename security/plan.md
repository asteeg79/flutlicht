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
| 2 | Pilot Flutlicht: PR-Prüfung (gitleaks, Semgrep, Claude-Review), Wochenscan (Semgrep, gitleaks, ZAP) | läuft, Gate A vom 04.11. bis 18.11. (Protokoll: `security/gate-a.md`) |
| 3 | Pilot Flutlicht: Tagesabgleich (OSV, CISA KEV, endoflife.date), Fristen 24 h / 7 / 30 / 90 Tage, Alarm per Erwähnung | läuft seit 03.11. |
| 3b | Security-Cockpit (siehe unten) | Web-App SecCo auf https://security.a-tec.dev: Schritt 1 (Ansicht) und 2 (Aktionen) laufen seit 04.11.; Issue-Cockpit #28 abgeschaltet |
| 4 | Rollout auf alle Repos über `security-agent` | nach Gate A |

## Gate A (04.11. bis 18.11.2026)

- Jeden Fund aus PR-Prüfung, Wochenscan und Tagesabgleich als treffend oder als Fehlalarm einordnen.
- Fehlalarme kommen als bekannte Ausnahmen in `security/review-instructions.md`.
- Kosten messen: Actions-Minuten und Claude-Token je PR.
- Weiter, wenn es wenige Fehlalarme gibt, kein echter Fund durchrutscht und die Kosten im Rahmen bleiben.

## Security-Cockpit

Eine Stelle, an der der Stand aller Scans steht und an der Updates und Fixes entschieden
werden. Seit 04.11.2026 die Web-App **SecCo** (Repo `asteeg79/SecCo`, Next.js auf Vercel,
https://security.a-tec.dev). Das Issue-Cockpit (#28, `security-cockpit.yml`) war Alex zu
wenig sprechend (Entscheidung vom 04.11.) und ist seit Schritt 2 abgeschaltet.

**Schritt 1 (fertig): nur lesen**

- Daten direkt von der GitHub-API über die GitHub-App „SecCo lesen“, nur Leserechte, für alle
  neun Repos installiert. Kein Pi, keine Datenbank, keine Actions-Minuten.
- Übersicht: „Braucht deine Entscheidung“, Zahlen je Schwere, die neun Repos mit Ampel,
  was gerade läuft, geplante Prüfungen mit Verspätung (drei Stunden nach Fälligkeit).
- Funde: Dependabot-Meldungen aller Repos mit Frist (24 h / 7 / 30 / 90 Tage), Status (offen,
  Fix-PR, akzeptiert laut `security/accepted-risks.json`) und Ort (Betrieb oder Entwicklung).
- Updates: PRs von Renovate und Dependabot mit CI und betroffenen Dateien, Freigaben aus dem
  Dependency Dashboard.
- Login per GitHub, nur die feste ID des Besitzers.

**Schritt 2 (fertig): Aktionen**

- Mergen, Renovate-Update freigeben, Risiko um 90 Tage verlängern (PR auf
  `security/accepted-risks.json`), Tagesabgleich oder Wochenscan starten; je mit
  Bestätigung, Fortschritt und Protokoll.
- Die Web-App startet nur `aktion.yml` in SecCo (Token nur dafür). Der Workflow läuft nur für
  den Besitzer, prüft gegen den aktuellen Stand bei GitHub (PR offen, CI grün, mergebar, Autor
  Renovate, Dependabot oder ein `claude/*`-Branch, Head-SHA wie angezeigt) und schreibt mit
  der App „SecCo handeln“, deren Token nur für das Ziel-Repo gilt. Erster Lauf am 04.11. grün.

**Nächste Schritte**

3. Push aufs Handy (neuer kritischer oder hoher Fund, Frist in 24 h, Scan überfällig) und
   optional Erklärungen je Fund per Claude. Webhooks für „Was gerade passiert“ ohne Neuladen.

**Grenzen:** SecCo schreibt nie direkt auf `main`, außer beim Mergen eines geprüften PRs. Es
löscht nichts und ändert keine Einstellungen. Texte aus PRs und Advisories gelten als Daten
und werden nie ausgeführt.

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

4. **Übersicht:** SecCo zeigt alle Repos schon jetzt; mit dem Rollout kommen die Fristen aus dem Tagesabgleich dazu.

## Betrieb

| Rhythmus | Was |
| --- | --- |
| je PR | Secret-Scan, Semgrep, Claude-Review |
| täglich | Tagesabgleich mit Fristen und Alarm |
| montags | Wochenscan und Bericht, Renovate-PRs |
| bei Ablauf des Prüfdatums | akzeptiertes Risiko zählt wieder als offen |
| vierteljährlich | Werkzeugversionen heben (OSV-Scanner, gitleaks, Semgrep) |
| nach dem Rollout (Gate B) | Zeit bis zum Fix je Schwere, eingehaltene Fristen |

**Actions-Kontingent:** Es war schon einmal aufgebraucht. Für die sieben privaten Repos überschlagen:

- Tagesabgleich etwa 210 Minuten im Monat
- Wochenscan etwa 140 Minuten im Monat
- SecCo: nur einzelne Läufe von `aktion.yml` je Aktion (Ansicht ohne Actions-Minuten)
- dazu die PR-Prüfungen

Das ist neben der bestehenden CI ein Teil der 2.000 Freiminuten; öffentliche Repos zählen nicht. Die Cron-Zeiten werden gestaffelt, es gibt kein ZAP ohne Live-URL und die PR-Prüfung nur bei Codeänderungen.

## Offene Entscheidungen

- Beobachten: `middleware.ts` → `proxy.ts` in Flutlicht, sobald Next.js Anweisungen für die Edge-Runtime veröffentlicht oder `middleware.ts` entfernt (Entscheidung vom 04.11.).

- Auto-Merge für Patch-Updates. Vorschlag: nein. Das Cockpit macht das Mergen zu einem Klick.
- Alarmkanal. Vorschlag: die Erwähnung bei GitHub, also Mail und Push nach den GitHub-Einstellungen.
- CSP mit Nonces in Flutlicht. Sie kostet die statische Startseite.
