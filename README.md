# Fitlog

Offline-fähige Fitness-Tracker-PWA für iPhone (Home-Screen-App). Übungen anlegen, Routinen zusammenstellen, Workouts kalendertagesweise tracken — läuft vollständig im Browser, keine Server-Anbindung im MVP.

Live: https://niklschulz.github.io/fitlog/

## Dokumentation

- [`docs/architecture.md`](docs/architecture.md) — Tech-Stack, PWA-Mechanik, Datenmodell, Sync-Strategie
- [`docs/features.md`](docs/features.md) — Funktionsumfang, User Flows, MVP-Scope
- [`docs/design-system.md`](docs/design-system.md) — Farben, Typografie, Radien, Abstände, Komponenten-Muster
- [`docs/archiv/design-system-verlauf.md`](docs/archiv/design-system-verlauf.md) — historischer Verlauf des Design-Systems (Iterationen, entfernte Features)
- [`docs/decisions/`](docs/decisions) — Architecture Decision Records (Warum X statt Y), jeweils mit Statuszeile
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — Chronologische Änderungshistorie

Infrastruktur-Details (Netzwerk, Tailscale, Raspberry Pi, Zugänge) liegen bewusst **nicht** hier, sondern in einem separaten privaten Repo — dieses Repo ist öffentlich. Siehe `docs/architecture.md` → Abschnitt "Sync & Infrastruktur" für den Verweis.

## Lokal starten

```bash
python3 -m http.server 8420
```

Dann `http://localhost:8420` öffnen. Kein Build-Schritt, kein `npm install` nötig.

## Tests

Automatisierte Tests für die Datenlogik in `js/db.js` (Löschkaskaden, Routine-Wechsel, Tages-Workout-Eindeutigkeit) — betrifft nur lokales Testen, nicht die App selbst (die bleibt build-frei, s. oben).

```bash
npm install
npm test
```

Zusätzlich prüft ein Repo-Check, was kein Datentest bemerkt: vergessenes `CACHE_NAME`-Hochzählen, veraltetes `css/tailwind.css` oder `js/vendor/dexie.min.js`, Infrastruktur-Details und lokale Pfade im öffentlichen Repo, tote Doku-Links, ADR-Nummerierung, native Dialoge und hartkodierte Farben. Vor jedem Commit/PR ausführen:

```bash
npm run check
```

Mit `-- --schnell` ohne den Tailwind-Build, mit `-- --mit-tests` zusätzlich `npm test`, mit `-- --basis=<git-ref>` gegen einen anderen Vergleichsstand als `origin/main`. Das Skript (`scripts/check-repo.js`) ist reines Dev-Werkzeug und nicht Teil der ausgelieferten App, s. [ADR 0040](docs/decisions/0040-repo-pruefskript.md).

## Deployment

Push auf `main` → GitHub Pages deployt automatisch von der Repo-Root. Bei Änderungen an gecachten Dateien (alles außer reinen Inhaltsänderungen in der Datenbank) `CACHE_NAME` in [`sw.js`](sw.js) hochzählen, sonst bekommen Nutzer die alte Version aus dem Service-Worker-Cache weiter ausgeliefert.
