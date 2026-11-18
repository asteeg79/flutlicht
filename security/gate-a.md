# Gate A: Protokoll des Pilots

Zeitraum: 04.11.2026 (erstes Claude-Review mit `ANTHROPIC_API_KEY`, #38) bis 18.11.2026.
Plan und Kriterien: `security/plan.md`, Abschnitt Gate A.

Jeder Fund aus PR-Prüfung, Wochenscan und Tagesabgleich bekommt eine Zeile:

- **treffend:** ein echtes Problem, mit Maßnahme
- **Fehlalarm:** mit Grund

Wiederkehrende Fehlalarme des Claude-Reviews kommen am Ende als bekannte Ausnahmen in `security/review-instructions.md`, die von Semgrep oder ZAP als Ausnahme in deren Konfiguration.

## Funde

| Datum | Quelle | Fund | Einordnung | Maßnahme oder Grund |
| --- | --- | --- | --- | --- |
| 03.11. | Wochenscan, Semgrep (MEDIUM, 3×) | `pnpm-workspace.yaml`: kein Mindestalter für neue Versionen, keine Trust-Policy, Unterabhängigkeiten aus Git oder URLs erlaubt | treffend | pnpm 10 mit `minimumReleaseAge`, `trustPolicy`, `blockExoticSubdeps` (#18) |
| 03.11. | Wochenscan, Semgrep (INFO) | `app/lib/storage.ts:197`: Format-String in `console.error` | Fehlalarm | Der eingesetzte Wert ist der eigene Blob-Pfad, vorher per Regex auf `user-…-data.json.enc` geprüft; kein fremder Format-String |
| 03.11. | Wochenscan, Semgrep (WARNING) | `scraper/fm_scraper/client.py:293`: dynamische URL in `urllib` | Fehlalarm | Die URL setzt der Scraper selbst aus `config` für den lokalen transfermarkt-api-Dienst zusammen, keine Eingabe von außen |
| 03.11. | Wochenscan, Semgrep (WARNING) | `scraper/fm_scraper/heartbeat.py:33`: dynamische URL in `urllib` | Fehlalarm | `config.HEARTBEAT_URL` ist eine feste Konstante |
| 03.11. | Wochenscan, ZAP (Low, 2×) | Cross-Origin-Opener-Policy und Cross-Origin-Embedder-Policy fehlen | treffend | Header gesetzt (#23) |
| 03.11. | Wochenscan, ZAP (Medium, 2×) | CSP mit `unsafe-inline` in `script-src` und `style-src` | treffend, zurückgestellt | Nonces machen jede Seite dynamisch und kosten die statische Startseite; eigene Entscheidung offen |
| 03.11. | Wochenscan, ZAP (Medium) | Cross-Domain Misconfiguration (`Access-Control-Allow-Origin: *`) | Fehlalarm | Setzt Vercel für statische Dateien; keine Antworten mit Anmeldedaten betroffen |
| 03.11. | Wochenscan, ZAP (Informational, 6 Arten) | Cache-Header, Modern Web Application, Session Management Response | Fehlalarm | Nur Hinweise, kein Risiko |
| 03.11. | Wochenscan, gitleaks | ganze Historie | kein Fund | |
| 03.11. | Tagesabgleich | minimatch 10 in ESLint (GHSA-g3hv-75wg-m249, mittel) | treffend, akzeptiert | Nur Entwicklung und CI; `security/accepted-risks.json` bis 01.02.2027 |
| 04.11. | Claude-Review, #38 | keine Funde (Cockpit-Text, Review-Workflow) | kein Fund | Erster Lauf mit Prüfanleitung |
| 04.11. | Claude-Review, #40 | keine Funde (Domain-Redirect in `next.config.js`, Middleware) | kein Fund | |
| 04.11. | Claude-Review, #41 | keine Funde (pnpm 11, Trust-Ausnahmen) | kein Fund | Die Ausnahmen für next-auth und undici-types hat das Review nicht beanstandet; begründet in `docs/entscheidungen.md` |
| 04.11. | Claude-Review, #42 | keine Funde (`@types/node` 26) | kein Fund | |
| 04.11. | Claude-Review, #44 | keine Funde (Issue-Cockpit entfernt) | kein Fund | |
| 04.11. | Claude-Review, #46 | keine Funde (Renovate-Konfiguration) | kein Fund | |
| 04.–05.11. | keine Prüfung | 3 Commits direkt auf `main` ohne PR: `d523457` (minimatch-Override), `3071a29` (Admin-Tick), `596e68e` (Scraper) | Lücke in der Abdeckung | Kein Claude-Review und keine PR-Scanner; nur der Wochenscan sieht sie. Branch-Schutz für `main` (PR Pflicht) schließt das |
| 04.11. | Tagesabgleich | minimatch (GHSA-g3hv-75wg-m249) | erledigt | Override auf minimatch 11.0.4 (`d523457`); akzeptiertes Risiko entfernt |
| 06.11. | Claude-Review, #50 | keine Funde (E2E-Transferfenster) | kein Fund | |
| 06.11. | Claude-Review, #51 | keine Funde (E2E im Playwright-Container) | kein Fund | |
| 08.11. | Tagesabgleich | Lauf rot: Download des OSV-Scanners mit HTTP 503 | Betriebsfehler | Kein Fund. Ohne Alarm: `security-daily.yml` ruft `_alert.yml` nicht auf. Am 09.11. wieder grün |
| 09.11. | Wochenscan, Semgrep (MEDIUM) | `pnpm-workspace.yaml:9`: `minimumReleaseAge` | treffend (Härtung) | Die Einstellung ist gesetzt (1 Tag); die Regel meldet jetzt die Stelle selbst, vermutlich ist ihr ein Tag zu kurz. Regeltext hier nicht abrufbar. Vorschlag: 3 Tage |
| 09.11. | Wochenscan, Semgrep (MEDIUM) | `renovate.json:34`: kein `minimumReleaseAge` | treffend (Härtung) | Renovate schlägt Versionen am ersten Tag vor; pnpm blockt sie bei der Installation. Vorschlag: `"minimumReleaseAge": "3 days"` |
| 09.11. | Wochenscan, Semgrep (INFO) | `.github/scripts/security-fristen.cjs:116`: `replaceAll` als Bereinigung | Fehlalarm | Maskiert Markdown-Tabellen und Erwähnungen im Issue, kein HTML für einen Browser |
| 09.11. | Wochenscan, Semgrep (INFO, WARNING) | `storage.ts:197`, `client.py:299`, `heartbeat.py:33` | Fehlalarm (wiederholt) | Wie am 03.11.; tauchen jede Woche wieder auf |
| 09.11. | Wochenscan, ZAP (Medium, 3 Arten; Informational, 5 Arten) | CSP `unsafe-inline` (2×), Cross-Domain Misconfiguration, Cache-Hinweise | wie 03.11. | CSP zurückgestellt, Rest Fehlalarm; COOP/COEP sind seit #23 weg |
| 09.11. | Wochenscan, gitleaks | ganze Historie | kein Fund | |
| 12.11. | Claude-Review, #59 | keine Funde (Actions-Minuten) | kein Fund | |
| 16.11. | Wochenscan (2 Läufe: SecCo 13:04, geplant 13:27) | gleiche 6 Semgrep- und 8 ZAP-Hinweise wie am 09.11., gitleaks 0 | wie 09.11. | Der geplante Lauf kam 8 Std. nach dem Termin |
| 17.11. | Querprüfung `pnpm audit` (18.11.) | picomatch 4.0.7 (GHSA-fc5q-39xc-vjpf, hoch, ReDoS), keine korrigierte Version | treffend, kommt im Tagesabgleich vom 18.11. | Seit 19.10. in der Advisory-Datenbank, aber erst am 17.11. geprüft und damit für OSV und Dependabot sichtbar; der Tagesabgleich vom 17.11. lief davor. Nur Entwicklung (ESLint, Vite, Vitest), kein Pfad in die App. Vorschlag: als Risiko akzeptieren, bis es eine korrigierte Version gibt |

## Kosten

Je Claude-Review: Tokens und Dollar aus der Anthropic Console, Laufzeit aus dem Job.

| Datum | PR | Laufzeit | Kosten |
| --- | --- | --- | --- |
| 04.11. | #38 | 17 s Review, 45 s Job | [aus der Console] |
| 04.11. | #40 | 38 s Job | [aus der Console] |
| 04.11. | #41 | 40 s Job | [aus der Console] |
| 04.11. | #42 | 35 s Lauf | [aus der Console] |
| 04.11. | #44 | 42 s Lauf | [aus der Console] |
| 04.11. | #46 | 44 s Lauf | [aus der Console] |
| 06.11. | #50 | 43 s Lauf | [aus der Console] |
| 06.11. | #51 | 40 s Lauf | [aus der Console] |
| 12.11. | #59 | 15 s Review, 68 s Lauf (Scanner und Review in einem Job) | [aus der Console] |

## Auswertung am 18.11.

Zeitraum 03.11. (erster Wochenscan) bis 18.11. In flutlicht gab es 9 Claude-Reviews, 28 Läufe der PR-Scanner, 3 Wochenscans und 14 geplante Tagesabgleiche.

### Fehlalarme je Quelle

| Quelle | Funde (verschieden) | treffend | Fehlalarm | Anteil Fehlalarme | Bemerkung |
| --- | --- | --- | --- | --- | --- |
| Claude-Review (9 PRs) | 0 | 0 | 0 | – | Kein Fehlalarm, aber auch kein Treffer; Renovate und Dependabot bewusst ohne Review |
| PR-Scanner (gitleaks, Semgrep) | 0 | 0 | 0 | – | |
| Wochenscan Semgrep | 9 | 5 | 4 | 44 % | 3 Fehlalarme kommen jede Woche wieder |
| Wochenscan ZAP (Arten) | 11 | 4 | 7 | 64 % | Ohne die 6 reinen Hinweise (Informational): 4 von 5 treffend |
| Wochenscan gitleaks | 0 | 0 | 0 | – | |
| Tagesabgleich | 2 | 2 | 0 | 0 % | minimatch (behoben), picomatch (ab 18.11.) |

### Echte Funde, die keine Quelle gemeldet hat

- Keiner bekannt. picomatch fiel in der Querprüfung auf, war aber erst seit dem 17.11. prüfbar (siehe oben).
- Lücke in der Abdeckung: Drei Commits gingen direkt auf `main` und hatten weder Claude-Review noch PR-Scanner.

### Betrieb

- Die geplanten Läufe kamen im Mittel 7 Std. zu spät: Tagesabgleich (Termin 05:41 UTC) zwischen 11:53 und 14:50 UTC, Wochenscan 8 Std. SecCo meldet das als „verspätet“ und kann den Lauf per Klick nachholen (am 09. und 16.11. genutzt).
- Ein Lauf war rot (08.11., OSV-Download mit 503), ohne Alarm.
- SecCo-Aktionen: 3 von 3 grün.

### Kosten

- **Claude:** 9 Reviews in 15 Tagen, je etwa 15–20 s Review und unter 70 s Job. Tokens und Dollar stehen in der Anthropic Console und fehlen hier noch.
- **Actions in flutlicht für die Security-Workflows:** etwa 55 Minuten in 15 Tagen, also rund 110 im Monat. PR-Prüfung etwa 28, Tagesabgleich 15, Wochenscans etwa 12.
- **Engpass:** Das Kontingent aller privaten Repos war am 11.11. nach elf Tagen zu 91 % verbraucht (#59), vor allem durch E2E. Der Plan rechnete für den Rollout mit etwa 410 zusätzlichen Minuten im Monat (Tagesabgleich 210, Wochenscan 140, Cockpit 60); das passt so nicht mehr ins Kontingent.

### Empfehlung

**Phase 4 starten, aber nachgeschärft.** Die Quellen liefern, Fehlalarme gibt es nur im Wochenscan, und dort sind es immer dieselben. Abschalten muss man keine Quelle. Vor dem Rollout:

1. **Wiederkehrende Fehlalarme abstellen:** die 4 Semgrep-Fehlalarme mit `nosemgrep` und Begründung an der Stelle; die ZAP-Hinweise Cross-Domain und Informational in eine `.zap/rules.tsv` als IGNORE.
2. **Lieferkette:** `minimumReleaseAge` in Renovate und pnpm auf 3 Tage. Dringende Sicherheitsupdates gehen über `minimumReleaseAgeExclude`.
3. **Branch-Schutz für `main`:** PR Pflicht, sonst laufen Review und Scanner an direkten Commits vorbei.
4. **Rollout mit weniger Actions-Minuten:**
   - Die Funde aller Repos kommen schon heute über Dependabot nach SecCo, ohne Actions-Minuten.
   - Statt sieben Tagesabgleichen läuft ein zentraler in SecCo für KEV, Supportende und die Lockfiles, die Dependabot nicht kennt (Pi, `requirements-*.txt`).
   - Semgrep und gitleaks laufen pro Repo nur wöchentlich, ZAP nur dort, wo es eine Live-URL gibt.
5. **Alarm bei roten Security-Läufen:** `security-daily.yml` und `security-weekly-scan.yml` rufen bei Fehlschlag `_alert.yml` auf.
6. **picomatch:** als Risiko akzeptieren (nur Entwicklung, keine korrigierte Version), Prüfdatum in 30 Tagen.
