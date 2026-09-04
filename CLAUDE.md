# Fitlog – Hinweise für Claude Code

Offline-fähige Fitness-Tracker-PWA. Bevor du Änderungen machst: [`docs/architecture.md`](docs/architecture.md), [`docs/features.md`](docs/features.md) und für alles Visuelle [`docs/design-system.md`](docs/design-system.md) lesen — die enthalten den aktuellen Stand, nicht raten oder aus dem Code allein rekonstruieren.

## Wichtigste Regel: Public/Private-Trennung

**Dieses Repo ist öffentlich auf GitHub.** Niemals echte Infrastruktur-Details hinein (Tailscale-Hostnames, IP-Adressen, Ports, SSH-Zugänge, Zugangsdaten jeder Art) — auch nicht in Doku-Kommentaren oder Beispielen. Solche Details gehören ins separate private Repo `fitlog-infra`. Im Zweifel: fragen statt raten.

## Doku bei jeder Änderung mitpflegen

- Architektur- oder Feature-Änderung → passende Datei in `docs/` im selben Zug aktualisieren
- Nennenswerte, nicht-triviale Entscheidung (nicht jede Kleinigkeit) → neues ADR in `docs/decisions/`, fortlaufend nummeriert
- Jede Änderung → kurzer Eintrag in `docs/CHANGELOG.md`

## Feste Konventionen in diesem Projekt

- Kein Build-Schritt, kein `npm install` — Vanilla JS (ES-Module) + Tailwind Play CDN + Dexie, beide per CDN-`<script>`-Tag eingebunden
- **Design-Tokens** (Farben, Radien, Typografie) liegen im inline `tailwind.config`-Objekt in `index.html`, nicht in einer `tailwind.config.js` — es gibt keine solche Datei in diesem Projekt (kein Build-Schritt). Neue/geänderte Tokens dort eintragen und in [design-system.md](docs/design-system.md) nachführen
- **`CACHE_NAME` in `sw.js` bei jeder Änderung an einer gecachten Datei hochzählen** — sonst bekommen Nutzer wegen der Cache-first-Strategie die alte Version weiter ausgeliefert. Beim lokalen Testen nach einer Änderung immer Service Worker + Caches im Browser leeren, bevor man verifiziert (alte Registrierungen sonst irreführend). Beim SW-Install selbst wird jede App-Shell-Datei mit `cache: 'reload'` geholt (nicht einfach `cache.addAll(APP_SHELL)` mit URLs) — sonst kann der normale Browser-HTTP-Cache veraltete Dateien liefern, obwohl der Service-Worker-Cache-Name sich geändert hat. Nicht durch die einfachere URL-Variante ersetzen
- Jede View folgt dem Pattern `render(container)` → `paint()` → `wireEvents()`, s. [architecture.md](docs/architecture.md#view-pattern)
- Löschen/Entfernen von irgendetwas (Übungen, Routinen, Profil): immer Bestätigungsdialog (`confirm()`). **Ausnahme: Sätze** — deren Löschen läuft (Übungs-Detailseite, Abschnitt 12) bewusst ohne Bestätigungsdialog, auf ausdrücklichen Nutzer-Wunsch, s. [ADR 0010](docs/decisions/0010-uebungs-detailseite.md). Kaskaden-Regeln für Trainingsdaten stehen in [ADR 0004](docs/decisions/0004-loesch-kaskaden.md) und [ADR 0007](docs/decisions/0007-workout-tab-tagesbasiertes-modell.md) — nicht ohne Rücksprache ändern. Kein Weg, ein ganzes Tages-Workout zu löschen (bewusst nicht gebaut, s. ADR 0007) — nur einzelne Sätze oder das Entfernen einer Routine
- **`confirm()`/`alert()`/`prompt()` beim Testen in der Browser-Pane**: Diese werden dort automatisiert sofort mit "Abbrechen" beantwortet, ohne dass ein Dialog sichtbar wird (kein Mensch, der klickt) — wirkt wie ein funktionsloser Button, ist aber kein Bug. Vor dem Testen `window.confirm = () => true` (bzw. `false` für den Abbrechen-Fall) setzen, um das reale Verhalten zu simulieren
- Vor jeder UI-Änderung: im Browser (Desktop- und Mobile-Viewport) tatsächlich verifizieren, nicht nur Code lesen

## Deployment

Push auf `main` deployt automatisch über GitHub Pages. Kein separater Freigabeschritt.
