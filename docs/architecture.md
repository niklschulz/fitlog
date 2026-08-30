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
│   ├── utils.js           Geteilte Helfer (z. B. escapeHtml)
│   ├── app.js              Tab-Router: schaltet zwischen den Views um
│   └── views/              Ein Modul pro Tab (training.js, exercises.js, routines.js, history.js),
│                           jedes exportiert render(container)
└── icons/                  App-Icons (generiert, s. unten)
```

## View-Pattern

Jede View in `js/views/*.js` folgt demselben Muster: ein modul-lokaler `state`, eine `render(container)`-Funktion (Einstiegspunkt vom Router), eine interne `paint()`, die den Container neu befüllt, und `wireEvents()`, das nach jedem Paint die Event-Listener neu bindet (da `innerHTML` die alten DOM-Knoten ersetzt). Kein virtuelles DOM, kein Diffing — bei der Datenmenge einer Einzelnutzer-Fitness-App unproblematisch.

## Datenmodell

Fünf Dexie-Tabellen, alle mit UUID-`id` und ISO-Timestamps:

- **exercises** — `id, name, createdAt, updatedAt`
- **routines** — `id, name, createdAt, updatedAt`
- **routineExercises** — Verknüpfungstabelle Routine↔Übung: `id, routineId, exerciseId, order`
- **workouts** — `id, routineId (nullable), startedAt, finishedAt (nullable), createdAt, updatedAt`
- **sets** — `id, workoutId, exerciseId, weight, reps, createdAt, updatedAt`

Details zu Beziehungen und Lösch-Kaskaden: [ADR 0004](decisions/0004-loesch-kaskaden.md).

## PWA-Mechanik

- **Manifest** (`manifest.json`): `display: standalone`, Icons, Theme-Farbe `#0f1115`
- **iOS-Sonderfall**: `apple-mobile-web-app-capable` + `apple-touch-icon` zusätzlich zum Manifest nötig, da iOS das Web-App-Manifest für den Standalone-Modus nicht vollständig respektiert
- **Safe-Area**: `viewport-fit=cover` + `env(safe-area-inset-*)` in CSS, für Notch/Dynamic-Island/Home-Indicator. Muss an jedem Screen-Rand, der Inhalt zeigen könnte, explizit angewendet werden (`.safe-top`, `.safe-bottom`) — wird nicht automatisch vererbt
- **Service Worker** (`sw.js`): Cache-first für alle GET-Requests. Cached sowohl lokale Dateien (`cache.addAll`) als auch die beiden Cross-Origin-CDN-Skripte (Tailwind, Dexie) einzeln im `no-cors`-Modus, da `cache.addAll` im `cors`-Modus an fehlenden CORS-Headern von `cdn.tailwindcss.com` scheitert
- **Cache-Versionierung**: `CACHE_NAME` in `sw.js` muss bei jeder Änderung an einer gecachten Datei hochgezählt werden — sonst bleiben Nutzer auf dem alten Stand hängen (Cache-first bedient aus dem Cache, bevor überhaupt geprüft wird, ob es was Neueres gibt)
- **iOS-Update-Verhalten**: Ein bereits zum Home-Bildschirm hinzugefügtes Icon wird von iOS nicht automatisch aktualisiert, wenn sich `apple-touch-icon.png` ändert — erfordert Entfernen + Neu-Hinzufügen

## Icon-Generierung

Icons werden nicht mit einem Grafikprogramm erstellt, sondern durch ein kleines Node-Skript (kein ImageMagick/PIL auf dem Zielsystem verfügbar), das PNG-Bytes direkt über Node's eingebautes `zlib` erzeugt (manueller PNG-Chunk-Writer + CRC32). Das Skript selbst ist nicht Teil des Repos (liegt im Scratchpad der Session, in der es erstellt wurde) — bei Bedarf neu erstellen oder Icons durch ein reguläres Grafikprogramm ersetzen.

## Sync & Infrastruktur (geplant, noch nicht gebaut)

IndexedDB bleibt auch nach Einführung eines Syncs die primäre Datenquelle ("Source of Truth") — ein späteres Backend ist reines Backup-/Persistenz-Ziel, keine Voraussetzung für die App-Nutzung. Geplanter Mechanismus: Sync über `online`/`offline`-Browser-Events, kein manueller Button. Safari unterstützt keine Background Sync API, Sync funktioniert daher nur bei aktiv geöffneter App.

Das Backend soll auf einem Raspberry Pi laufen, erreichbar über Tailscale (privates Mesh-VPN, kein offener Router-Port). **Konkrete Infrastruktur-Details (Tailnet-Name, Geräte-Hostnames, IP-Adressen, Ports, SSH-Zugang) werden bewusst nicht in diesem öffentlichen Repo dokumentiert**, sondern im separaten privaten Repo `fitlog-infra`. Grund: dieses Repo ist public.

## Bekannte Abweichungen vom ursprünglichen Konzept

- **Gewicht-Eingabe**: `inputmode="decimal"` statt `inputmode="numeric"` — Scheiben-Abstufungen wie 82,5 kg brauchen eine Kommastelle, die bei `numeric` auf dem iOS-Tastenfeld fehlt. Wiederholungen bleiben bei `numeric`.
- **Satz-Bearbeitung im Verlauf**: Tap-to-Edit mit sichtbarem Stift-Icon statt Long-Press — zuverlässiger auf Touch, genauso klar erkennbar.
