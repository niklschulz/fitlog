# Fitlog – Hinweise für Claude Code

Offline-fähige Fitness-Tracker-PWA. Bevor du Änderungen machst: [`docs/architecture.md`](docs/architecture.md), [`docs/features.md`](docs/features.md) und für alles Visuelle [`docs/design-system.md`](docs/design-system.md) lesen — die enthalten den aktuellen Stand, nicht raten oder aus dem Code allein rekonstruieren.

## Wichtigste Regel: Public/Private-Trennung

**Dieses Repo ist öffentlich auf GitHub.** Niemals echte Infrastruktur-Details hinein (Tailscale-Hostnames, IP-Adressen, Ports, SSH-Zugänge, Zugangsdaten jeder Art) — auch nicht in Doku-Kommentaren oder Beispielen. Solche Details gehören ins separate private Repo `fitlog-infra`. Im Zweifel: fragen statt raten.

## Doku bei jeder Änderung mitpflegen

- Architektur- oder Feature-Änderung → passende Datei in `docs/` im selben Zug aktualisieren
- Nennenswerte, nicht-triviale Entscheidung (nicht jede Kleinigkeit) → neues ADR in `docs/decisions/`, fortlaufend nummeriert
- Jede Änderung → kurzer Eintrag in `docs/CHANGELOG.md`

## Feste Konventionen in diesem Projekt

- Kein laufender Build-Prozess, kein `npm install` für die App selbst — Vanilla JS (ES-Module) + Dexie (lokal unter `js/vendor/`, s. [ADR 0031](docs/decisions/0031-dexie-lokal.md)) + vorkompiliertes Tailwind-CSS (`css/tailwind.css`, eingecheckt, s. [ADR 0030](docs/decisions/0030-tailwind-vorkompiliert.md)). Das `package.json` ist rein Dev-seitig (Datenlogik-Tests in `tests/`, einmaliger CSS-Build) — betrifft nicht die Auslieferung der App
- **Design-Tokens** (Farben, Radien, Typografie) liegen in `tailwind.config.js`. Neue/geänderte Tokens dort eintragen und in [design-system.md](docs/design-system.md) nachführen
- **`npm run build:css` ausführen und `css/tailwind.css` mit einchecken, sobald sich Tailwind-Klassen in `index.html`/`js/**` oder die Tokens in `tailwind.config.js` ändern** — das CSS ist vorkompiliert, neue Klassen existieren sonst nicht (unstyled UI). Danach `CACHE_NAME` hochzählen
- **`CACHE_NAME` in `sw.js` bei jeder Änderung an einer gecachten Datei hochzählen** — sonst bekommen Nutzer wegen der Cache-first-Strategie die alte Version weiter ausgeliefert. Beim lokalen Testen nach einer Änderung immer Service Worker + Caches im Browser leeren, bevor man verifiziert (alte Registrierungen sonst irreführend). Beim SW-Install selbst wird jede App-Shell-Datei mit `cache: 'reload'` geholt (nicht einfach `cache.addAll(APP_SHELL)` mit URLs) — sonst kann der normale Browser-HTTP-Cache veraltete Dateien liefern, obwohl der Service-Worker-Cache-Name sich geändert hat. Nicht durch die einfachere URL-Variante ersetzen
- Jede View folgt dem Pattern `render(container)` → `paint()` → `wireEvents()`, s. [architecture.md](docs/architecture.md#view-pattern)
- Löschen/Entfernen von irgendetwas (Übungen, Routinen, Profil): immer Bestätigung über das Action Sheet (`showActionSheet()`, `js/actionSheet.js`, s. [ADR 0029](docs/decisions/0029-action-sheet-saetze-und-uebung-entfernen.md)) — kein natives `confirm()` mehr. **Ausnahmen:** Sätze — deren Löschen läuft (Übungs-Detailseite, Abschnitt 12) bewusst ohne Bestätigungsdialog, auf ausdrücklichen Nutzer-Wunsch, s. [ADR 0010](docs/decisions/0010-uebungs-detailseite.md). Ebenso das Entfernen einer einzelnen, noch unbegonnenen Übung aus dem Tages-Roster (Workout-Tab, "⋮"-Menü, `removeExerciseFromWorkout`) — betrifft nie Trainingsdaten, s. [ADR 0016](docs/decisions/0016-swipe-to-delete-roster.md)/[ADR 0017](docs/decisions/0017-kontextmenue-redesign-referenzbild.md). Kaskaden-Regeln für Trainingsdaten stehen in [ADR 0004](docs/decisions/0004-loesch-kaskaden.md) und [ADR 0007](docs/decisions/0007-workout-tab-tagesbasiertes-modell.md) — nicht ohne Rücksprache ändern. Kein Weg, ein ganzes Tages-Workout zu löschen (bewusst nicht gebaut, s. ADR 0007) — nur einzelne Sätze, einzelne noch unbegonnene Übungen (`removeExerciseFromWorkout`) oder das Entfernen einer Routine
- **Automatisierte Tests** für die heiklen Datenfunktionen in `js/db.js` (Löschkaskaden, Routine-Wechsel, Tages-Workout-Eindeutigkeit) liegen in `tests/` — `npm test` (Node's eingebauter Test-Runner, `fake-indexeddb` simuliert IndexedDB, kein zusätzliches Test-Framework). Vor Änderungen an diesen Funktionen laufen lassen; bei neuen heiklen Datenfunktionen einen passenden Test ergänzen. Deckt bewusst nur Datenlogik ab, keine UI — dafür weiterhin manuell im Browser verifizieren (s. nächster Punkt)
- **Native Dialoge (`confirm()`/`alert()`/`prompt()`) nicht verwenden**: Sie werden in der Browser-Pane automatisiert sofort mit "Abbrechen" beantwortet und sind nicht gestaltbar. Bestätigungen laufen über `showActionSheet()` (`js/actionSheet.js`), das sich in der Browser-Pane normal bedienen lässt (`.action-sheet-action` / `.action-sheet-cancel`)
- Vor jeder UI-Änderung: im Browser (Desktop- und Mobile-Viewport) tatsächlich verifizieren, nicht nur Code lesen

## Deployment

Push auf `main` deployt automatisch über GitHub Pages. Kein separater Freigabeschritt.
