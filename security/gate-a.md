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

## Kosten

Je Claude-Review: Tokens und Dollar aus der Anthropic Console, Laufzeit aus dem Job.

| Datum | PR | Laufzeit | Kosten |
| --- | --- | --- | --- |
| 04.11. | #38 | 17 s Review, 45 s Job | [aus der Console] |

## Auswertung am 18.11.

- Anteil Fehlalarme je Quelle
- echte Funde, die keine Quelle gemeldet hat
- Kosten je PR und im Monat
- Entscheidung: weiter mit Phase 4 (Rollout), nachschärfen oder Quelle abschalten
