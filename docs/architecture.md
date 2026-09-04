# Architektur

## Tech-Stack

| Bereich | Wahl | Details |
|---|---|---|
| Frontend | Vanilla JavaScript, ES-Module | Kein Framework, kein Bundler. Begründung: [ADR 0001](decisions/0001-vanilla-js-ohne-framework.md) |
| Styling | Tailwind CSS (Play CDN) | Kein Build-Schritt. Begründung: [ADR 0002](decisions/0002-tailwind-play-cdn.md) |
| Datenhaltung | IndexedDB via Dexie.js | Einzige Datenquelle, UUID-basiert. Begründung: [ADR 0003](decisions/0003-dexie-uuid-datenmodell.md) |
| Hosting | GitHub Pages | Öffentliches Repo. Begründung: [ADR 0005](decisions/0005-github-pages-hosting.md) |
| Backend | Keins (Stand: aktuell) | Geplant, s. "Sync & Infrastruktur" unten |

## Projektstruktur

```
fitlog/
├── index.html            Einstiegspunkt, lädt Tailwind/Dexie per CDN, registriert Service Worker
├── manifest.json          PWA-Manifest (Icons, Standalone-Modus, Theme-Farbe)
├── sw.js                  Service Worker: Cache-first App-Shell für Offline-Betrieb
├── css/styles.css         Ergänzungen, die Tailwind nicht abdeckt (Safe-Area, Font-Faces)
├── js/
│   ├── db.js              Dexie-Schema + alle Datenbank-Operationen (CRUD, Kaskaden)
│   ├── profile.js         localStorage-Layer für Username/Token (Profil-Tab)
│   ├── utils.js           Geteilte Helfer (z. B. escapeHtml)
│   ├── app.js              Tab-Router: schaltet zwischen den Views um
│   └── views/              Ein Modul pro Tab (workout.js, exercises.js, routines.js, profile.js),
│                           jedes exportiert render(container)
└── icons/                  App-Icons (generiert, s. unten)
```

## View-Pattern

Jede View in `js/views/*.js` folgt demselben Muster: ein modul-lokaler `state`, eine `render(container)`-Funktion (Einstiegspunkt vom Router), eine interne `paint()`, die den Container neu befüllt, und `wireEvents()`, das nach jedem Paint die Event-Listener neu bindet (da `innerHTML` die alten DOM-Knoten ersetzt). Kein virtuelles DOM, kein Diffing — bei der Datenmenge einer Einzelnutzer-Fitness-App unproblematisch.

Optionaler zweiter Export: `unmount()`. `app.js`'s `showView()` ruft ihn (falls vorhanden) auf der bisherigen View auf, bevor zur neuen gewechselt wird — für Aufräumarbeiten, die über den Container hinausgehen (globale Locks, `document`-weite Listener, ausstehende Timeouts). Aktuell nur von `workout.js` genutzt (Body-Scroll-Sperre/Nav-z-index des Kalender-Sheets, s. [design-system.md](design-system.md#navigation), Zwölfte Iteration) — die meisten Views brauchen das nicht, da bloßes Ersetzen von `innerHTML` beim nächsten `render()` ausreicht.

**Ausnahme**: Der große Kalender im Workout-Tab (Bottom-Sheet, [ADR 0009](decisions/0009-grosser-kalender-vollstaendiges-rendern.md)) rendert seinen gesamten Inhalt beim Öffnen einmalig über den normalen `paint()`-Zyklus, manipuliert das DOM aber während zweier Interaktionen bewusst direkt statt über `paint()`: dem Drag-to-Dismiss-Gesture am Ziehgriff (muss 1:1 dem Finger folgen) und — historisch — dem inzwischen wieder entfernten Lazy-Nachladen weiterer Monate beim Scrollen ([ADR 0008](decisions/0008-grosser-kalender-lazy-loading.md), verursachte spürbares Ruckeln und wurde durch vollständiges Vorab-Rendern ersetzt).

## Datenmodell

Sechs Dexie-Tabellen (Schema-Version 2), alle mit UUID-`id`:

- **exercises** — `id, name, createdAt, updatedAt`
- **routines** — `id, name, createdAt, updatedAt`
- **routineExercises** — Verknüpfungstabelle Routine↔Übung (Vorlage): `id, routineId, exerciseId, order`
- **workouts** — `id, routineId (nullable), date ('YYYY-MM-DD'), createdAt, updatedAt`. Höchstens ein Workout pro Kalendertag (`date`), unabhängig davon ob Vergangenheit/Gegenwart/Zukunft. Kein `startedAt`/`finishedAt` mehr — kein Konzept von "Training beenden", jeder Tag bleibt dauerhaft bearbeitbar. Begründung: [ADR 0007](decisions/0007-workout-tab-tagesbasiertes-modell.md)
- **workoutExercises** — welche Übungen zu einem konkreten Workout gehören, unabhängig davon ob schon Sätze existieren: `id, workoutId, exerciseId, order, sourceRoutineId (nullable), startedAt (nullable), createdAt, updatedAt`. `startedAt` wird einmalig beim ersten Satz für diese Übung gesetzt — Grundlage der dynamischen Sortierung (begonnene Übungen zuerst nach Startzeitpunkt, dann unbegonnene nach `order`). `sourceRoutineId` unterscheidet routinen-stammende (werden bei Routine-Wechsel/-Entfernen aufgeräumt, solange unbegonnen) von manuell hinzugefügten Übungen (`null`, bleiben davon unberührt)
- **sets** — `id, workoutId, exerciseId, weight, reps, createdAt, updatedAt`

Details zu Beziehungen und Lösch-Kaskaden: [ADR 0004](decisions/0004-loesch-kaskaden.md) (Grundregeln) und [ADR 0007](decisions/0007-workout-tab-tagesbasiertes-modell.md) (Erweiterung um `workoutExercises`).

## PWA-Mechanik

- **Manifest** (`manifest.json`): `display: standalone`, Icons, Theme-Farbe `#121212` (s. [design-system.md](design-system.md) für die vollständige Farbpalette)
- **iOS-Sonderfall**: `apple-mobile-web-app-capable` + `apple-touch-icon` zusätzlich zum Manifest nötig, da iOS das Web-App-Manifest für den Standalone-Modus nicht vollständig respektiert
- **Safe-Area**: `viewport-fit=cover` + `env(safe-area-inset-*)` in CSS, für Notch/Dynamic-Island/Home-Indicator. Muss an jedem Screen-Rand, der Inhalt zeigen könnte, explizit angewendet werden (`.safe-top`, `.safe-bottom`) — wird nicht automatisch vererbt
- **Service Worker** (`sw.js`): Cache-first für alle GET-Requests. Cached sowohl lokale Dateien (`cache.addAll`) als auch die beiden Cross-Origin-CDN-Skripte (Tailwind, Dexie) einzeln im `no-cors`-Modus, da `cache.addAll` im `cors`-Modus an fehlenden CORS-Headern von `cdn.tailwindcss.com` scheitert
- **Cache-Versionierung**: `CACHE_NAME` in `sw.js` muss bei jeder Änderung an einer gecachten Datei hochgezählt werden — sonst bleiben Nutzer auf dem alten Stand hängen (Cache-first bedient aus dem Cache, bevor überhaupt geprüft wird, ob es was Neueres gibt)
- **iOS-Update-Verhalten (Icon)**: Ein bereits zum Home-Bildschirm hinzugefügtes Icon wird von iOS nicht automatisch aktualisiert, wenn sich `apple-touch-icon.png` ändert — erfordert Entfernen + Neu-Hinzufügen
- **iOS-Update-Verhalten (Service Worker)**: Eine als Home-Bildschirm-App (standalone) geöffnete PWA prüft von sich aus deutlich seltener auf Service-Worker-Updates als ein normaler Safari-Tab — ein einfaches Neuöffnen reicht auf iOS oft nicht. Gegenmaßnahme in `app.js`: `registration.update()` explizit bei jedem App-Start und bei `visibilitychange` aufrufen, plus ein `controllerchange`-Listener, der die Seite einmalig neu lädt, sobald ein neuer Service Worker die Kontrolle übernimmt (dank `skipWaiting`/`clients.claim()` in `sw.js` passiert das automatisch, sobald ein Update gefunden wurde) — damit ist die neue Version sofort sichtbar statt erst nach mehrfachem manuellem Neustart. Mit einem simulierten Update lokal verifiziert (Reload löst tatsächlich aus, alte Caches werden korrekt ersetzt).
- **Zoom deaktiviert**: Pinch- und Doppeltipp-Zoom sind bewusst unterbunden, damit sich die Bedienung stärker wie eine native App anfühlt (kein versehentliches Reinzoomen beim Training). `viewport`-Meta-Tag allein reicht dafür nicht mehr — moderne Safari-Versionen ignorieren `user-scalable=no` aus Barrierefreiheits-Gründen bewusst. Zuverlässiger Weg: `touch-action: manipulation` auf `html`/`body` in `css/styles.css` (bewusst nicht `touch-action: none`, das würde auch Scrollen blockieren). Meta-Tag (`maximum-scale=1, user-scalable=no`) bleibt zusätzlich als Absicherung für andere Browser/ältere Safari-Versionen. Separates Problem, eigene Lösung: iOS zoomt zusätzlich automatisch hinein, sobald ein `<input>` mit Schriftgröße < 16px fokussiert wird — global `input { font-size: 16px }` verhindert das, unabhängig von `touch-action`. Bewusster Accessibility-Trade-off für eine private App mit kleinem, bekanntem Nutzerkreis — die systemweite iOS-Vergrößerungsfunktion bleibt davon unberührt.

## Icon-Generierung

Icons werden nicht mit einem Grafikprogramm erstellt, sondern durch ein kleines Node-Skript (kein ImageMagick/PIL auf dem Zielsystem verfügbar), das PNG-Bytes direkt über Node's eingebautes `zlib` erzeugt (manueller PNG-Chunk-Writer + CRC32). Das Skript selbst ist nicht Teil des Repos (liegt im Scratchpad der Session, in der es erstellt wurde) — bei Bedarf neu erstellen oder Icons durch ein reguläres Grafikprogramm ersetzen.

## Nicht-funktionale Anforderungen

- **Offline-Fähigkeit (zentrale Anforderung)**: App muss vollständig funktionsfähig sein, ohne dass je eine Internetverbindung bestanden hat (Erstinstallation ausgenommen, s. [ADR 0002](decisions/0002-tailwind-play-cdn.md)). Alle Kernfunktionen laufen ausschließlich gegen IndexedDB, ohne Netzwerk-Abhängigkeit.
- **HTTPS-Voraussetzung**: Service Worker funktionieren nur über HTTPS (oder `localhost` lokal) — GitHub Pages liefert das automatisch.
- **Performance**: App-Start aus dem Cache (offline) soll praktisch verzögerungsfrei sein. Vanilla JS ohne Framework-Overhead erreicht das ohne gesonderte Optimierung.
- **Datenpersistenz/Robustheit**: Kein Datenverlust bei normalem Gebrauch (regelmäßige Nutzung verhindert iOS-Cache-Löschen nach Inaktivität). Kein Verlassen auf Netzwerk für Datenintegrität, da kein Backend existiert.
- **Browser-/Geräte-Scope**: Ausschließlich Safari auf iOS (Home-Screen-Standalone-Modus) — keine Cross-Browser- oder Desktop-Kompatibilität nötig oder getestet.
- **Wartbarkeit**: Code soll auch ohne tiefe Programmierkenntnisse grob nachvollziehbar bleiben (mit ausschlaggebend für [ADR 0001](decisions/0001-vanilla-js-ohne-framework.md)).
- **Bewusst nicht relevant für den MVP**: Skalierung bei großen Datenmengen (Single-User, für IndexedDB unkritisch), Sicherheit/Authentifizierung (keine Netzwerk-Kommunikation, daher keine Angriffsfläche in dem Sinne — ändert sich, sobald der Sync kommt).

## Sync & Infrastruktur (geplant, noch nicht gebaut)

IndexedDB bleibt auch nach Einführung eines Syncs die primäre Datenquelle ("Source of Truth") — ein späteres Backend ist reines Backup-/Persistenz-Ziel, keine Voraussetzung für die App-Nutzung. Geplanter Mechanismus: Sync über `online`/`offline`-Browser-Events, kein manueller Button. Safari unterstützt keine Background Sync API, Sync funktioniert daher nur bei aktiv geöffneter App.

Das Backend soll auf einem Raspberry Pi laufen, erreichbar über Tailscale (privates Mesh-VPN, kein offener Router-Port). **Konkrete Infrastruktur-Details (Tailnet-Name, Geräte-Hostnames, IP-Adressen, Ports, SSH-Zugang) werden bewusst nicht in diesem öffentlichen Repo dokumentiert**, sondern im separaten privaten Repo `fitlog-infra`. Grund: dieses Repo ist public.

**Nutzertrennung**: Die App wird künftig von mehreren Personen genutzt; deren Daten müssen server-seitig getrennt bleiben. Geplanter Mechanismus: Bearer-Token pro Person (vom Pi per CLI-Skript generiert, einmalig im neuen "Profil"-Tab hinterlegt), keine Passwörter/Sessions — die eigentliche Zugriffskontrolle läuft über die Tailscale-Netzwerkgrenze, der Token dient nur der Zuordnung. Details und Begründung: [ADR 0006](decisions/0006-token-basierte-nutzertrennung.md). Der Profil-Tab existiert bereits im Frontend (lokal gespeichert über `localStorage`), auch wenn der Sync selbst mangels Backend noch inaktiv ist.

## Bekannte Abweichungen vom ursprünglichen Konzept

- **Gewicht-Eingabe**: `inputmode="decimal"` statt `inputmode="numeric"` — Scheiben-Abstufungen wie 82,5 kg brauchen eine Kommastelle, die bei `numeric` auf dem iOS-Tastenfeld fehlt. Wiederholungen bleiben bei `numeric`.
