# reuse/: erprobter Code aus Altprojekten

Diese Dateien sind **Kopien** (Stand 25.09.2026) aus zwei eigenen, produktiv
gelaufenen Projekten. Sie dienen als Vorlage. Was wohin gehört und was
anzupassen ist, steht verbindlich in `KONZEPT.md` Abschnitt 12.
Nach Meilenstein M11 wird dieser Ordner gelöscht.

| Ordner | Quelle | Was es ist |
|---|---|---|
| `workgrid/` | `~/Documents/Claude/Projects/Workgrid/myworkgrid` | Next.js 15 + NextAuth v5 PWA auf Vercel; Nutzerdaten als verschlüsseltes JSON-Dokument pro User in Upstash Redis; Web-Push mit VAPID; Rate-Limit; Auth-Guard-Tests |
| `wm-tipp/` | `~/Documents/Claude/Projects/wm_tippagent` | pnpm-Monorepo mit Daten-Pipeline in GitHub Actions, die zod-validierte JSON-Dateien ins Repo committet; Cloudflare-Cron-Worker als genauer Taktgeber; Fehler-Alarm per Issue; Versionserkennung |

## Wichtigste Bausteine

**Workgrid**
- `lib/storage.ts`: Redis/Dateisystem-Backend, `readEncrypted`/`writeEncrypted`, „unlesbar ≠ leer“
- `lib/crypto.ts`: AES-256-GCM mit HMAC-abgeleitetem Schlüssel pro User
- `lib/api-route.ts`: `withUser`, `parseBody` (zod), Fehlerklassen → JSON-Status
- `lib/auth.config.ts`, `lib/auth.ts`, `middleware.ts`, `lib/public-api-paths.ts`, `lib/rate-limit.ts`
- `middleware.guard.test.ts`, `middleware.auth.test.ts`: Allowlist ↔ withUser konsistent halten
- `lib/push.ts`, `app/api/push/*`, `hooks/usePush.ts`, `components/settings/PushToggle.tsx`
- `public/sw.js` (**ohne** Push-Handler, siehe KONZEPT 8.5), `components/pwa/ServiceWorkerRegister.tsx`, `public/manifest.json`
- `next.config.js`: CSP/Security-Header, Build-Infos in Europe/Berlin
- `lib/time-local.ts`, Tooling-Konfigurationen, Login-Seite als UI-Muster

**WM-Tipp**
- `pipeline/src/io/json.ts`: zod-validiertes Lesen/Schreiben (zod v3 → auf v4 anpassen)
- `pipeline/src/sources/http.ts`: fetch mit Backoff, Retry-After, Timeout
- `pipeline/src/util/async.ts`, `pipeline/src/util/text.ts`: `mapLimit`, `sleep`, `alnumKey` (Namensabgleich)
- `shared/src/common.ts`: gemeinsame zod-Basistypen
- `.github/workflows/*`: Commit-/Rebase-Muster, Concurrency, `_alert.yml`
- `infra/cron-worker/*`: Cloudflare-Worker mit Cron-Trigger
- `scripts/gen-version.mjs`, `scripts/stage-data.mjs`, `app/src/lib/useVersion.ts`
- `docs/betrieb.md`, `docs/architecture.md`: Gliederungsvorlagen für die Betriebsdoku
