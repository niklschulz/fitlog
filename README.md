# Fitlog

Offline-fähige Fitness-Tracker-PWA für iPhone (Home-Screen-App). Übungen anlegen, Routinen zusammenstellen, Workouts kalendertagesweise tracken — läuft vollständig im Browser, keine Server-Anbindung im MVP.

Live: https://niklschulz.github.io/fitlog/

## Dokumentation

- [`docs/architecture.md`](docs/architecture.md) — Tech-Stack, PWA-Mechanik, Datenmodell, Sync-Strategie
- [`docs/features.md`](docs/features.md) — Funktionsumfang, User Flows, MVP-Scope
- [`docs/design-system.md`](docs/design-system.md) — Farben, Typografie, Radien, Abstände, Komponenten-Muster
- [`docs/decisions/`](docs/decisions) — Architecture Decision Records (Warum X statt Y)
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — Chronologische Änderungshistorie

Infrastruktur-Details (Netzwerk, Tailscale, Raspberry Pi, Zugänge) liegen bewusst **nicht** hier, sondern in einem separaten privaten Repo — dieses Repo ist öffentlich. Siehe `docs/architecture.md` → Abschnitt "Sync & Infrastruktur" für den Verweis.

## Lokal starten

```bash
python3 -m http.server 8420
```

Dann `http://localhost:8420` öffnen. Kein Build-Schritt, kein `npm install` nötig.

## Deployment

Push auf `main` → GitHub Pages deployt automatisch von der Repo-Root. Bei Änderungen an gecachten Dateien (alles außer reinen Inhaltsänderungen in der Datenbank) `CACHE_NAME` in [`sw.js`](sw.js) hochzählen, sonst bekommen Nutzer die alte Version aus dem Service-Worker-Cache weiter ausgeliefert.
