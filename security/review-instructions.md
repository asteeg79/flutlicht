**Flutlicht: Vertrauensgrenzen (ASVS V4 Zugriffskontrolle)**

- API-Routen ohne Session sind nur die Präfixe in `app/lib/public-api-paths.ts`: `/api/health`, `/api/auth`, `/api/cron/tick` (Bearer `CRON_SECRET`) und `/api/scraper/heartbeat` (Bearer `SCRAPER_SECRET`). Jede andere Route ohne `withUser`/`withAdmin` aus `app/lib/api-route.ts` ist ein Fund.
- `/api/admin/*` nur mit `withAdmin` (Rolle aus `ADMIN_EMAILS`). Ein Manager darf nie Kader, Aufstellung oder Konto eines anderen Managers ändern.
- Spielregeln werden serverseitig in `core/` geprüft (Budget, Sperren, Transferfenster, Kaderregeln). Eine Route, die Client-Werte ohne diese Prüfung übernimmt, ist ein Fund (Geschäftslogik, ASVS V11).
- Fremde Aufstellungen sind erst ab der Sperre sichtbar (`/api/matchday/[n]`). Daten anderer Manager vor der Sperre auszuliefern ist ein Fund.

**Flutlicht: Authentifizierung und Geheimnisse (ASVS V2, V3, V6)**

- Bearer-Secrets nur über `hasBearer` (zeitkonstant, ohne gesetztes Secret nie gültig). Direkte `===`-Vergleiche mit Secrets sind ein Fund.
- Passwörter nur über `app/lib/password.ts` (scrypt, `timingSafeEqual`). Passwörter, Reset- oder Einladungscodes nie loggen oder in Antworten zurückgeben.
- Die Rate-Limits für Login, Registrierung und Reset (`app/lib/rate-limit.ts`, Middleware) dürfen nicht umgehbar werden.
- Redis-Dokumente sind mit AES-256-GCM verschlüsselt (`app/lib/crypto.ts`). Neue Dokumente mit Nutzerdaten ohne diese Verschlüsselung, feste IVs oder schwächere Verfahren sind ein Fund.
- `GITHUB_PAT` bleibt serverseitig in `app/lib/github.ts` und schreibt nur nach `raw/manual/`. Andere Schreibpfade oder ein Weg, den Pfad aus Nutzereingaben zu bilden, sind ein Fund.
- Secrets nur aus Umgebungsvariablen (KONZEPT 15.2), nie im Repo, in `data/` oder in an den Client gelieferten Bundles (`NEXT_PUBLIC_*` nur für öffentliche Werte).

**Flutlicht: Eingaben aus fremden Quellen (ASVS V5)**

- `raw/` enthält ungeprüfte Daten von Sofascore, OpenLigaDB und Transfermarkt. Die Pipeline muss sie mit zod validieren, bevor sie in `data/` landen. Werte aus `raw/` dürfen nie als HTML (`dangerouslySetInnerHTML`), Pfad, URL oder Befehl verwendet werden.
- Admin-Nachträge (`raw/manual/matches/*.json`) laufen durch dieselbe Validierung.

**Flutlicht: CI und Lieferkette (OWASP A03, A08)**

- Keine `${{ github.event.* }}`- oder `${{ github.head_ref }}`-Ausdrücke direkt in `run:`; über `env:` übergeben.
- Kein `pull_request_target`. `contents: write` nur in den Daten-Workflows `compute.yml` und `fixtures.yml`.
- Neue Actions auf Commit-SHA gepinnt.

**Flutlicht: Scraper (`scraper/`)**

- Der Scraper läuft auf einem geteilten Raspberry Pi mit Deploy-Key (Schreibrecht). Codepfade, die fremde Inhalte ausführen, Shell-Befehle aus Abrufdaten bilden oder Dateien außerhalb von `raw/` schreiben, sind ein Fund.
- Zusätzliche Endpunkte, höhere Frequenz oder Parallelität beim Abruf verstoßen gegen KONZEPT 5.6. Als eigenen Hinweis melden, nicht als Sicherheitslücke.

**Flutlicht: bekannte Ausnahmen (kein Fund)**

- `data/` und `app/public/` sind öffentlich und enthalten nur Spiel- und Spielerdaten, keine Nutzerdaten.
- `/api/health` ist absichtlich öffentlich und liefert nur `ok`, Storage-Art und Datenversion.
- Die Abrufe bei Sofascore, OpenLigaDB und Transfermarkt laufen ohne Anmeldung; das ist so gewollt.
