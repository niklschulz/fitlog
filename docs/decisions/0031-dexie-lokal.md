# 0031 – Dexie lokal ausliefern statt per CDN

## Kontext

Dexie wurde per `<script src="https://cdn.jsdelivr.net/...">` im `<head>` geladen (Folge der "kein Bundler"-Regel, [ADR 0001](0001-vanilla-js-ohne-framework.md)). Das Skript ist parser-blockierend: Fehlt es im Service-Worker-Cache (Erstinstallation, abgebrochener oder verzögerter Install bei schlechtem Netz), wartet der Browser auf den Drittserver, und der Start bleibt lange schwarz. Außerdem brauchte es im Service Worker einen Sonderweg (`no-cors`, opaque Responses), in dem bereits ein Fehler steckte ([ADR 0030](0030-tailwind-vorkompiliert.md)).

## Entscheidung

`dexie.min.js` (zur Entscheidung 4.0.8, seit 2026-10-24 4.4.7, identisch zur devDependency für die Tests) liegt in `js/vendor/dexie.min.js` (ohne Source-Map-Verweis) und wird per `<script src="js/vendor/dexie.min.js">` eingebunden. Sie gehört zur normalen App-Shell des Service Workers. `CDN_SHELL`, `no-cors`-Precache und die zugehörige Sonderlogik im `fetch`-Handler sind entfernt.

## Konsequenzen

- Die App hängt zur Laufzeit und bei der Erstinstallation nur noch vom eigenen Hosting ab
- Eine Dexie-Aktualisierung bedeutet, die Datei in `js/vendor/` von Hand zu ersetzen (aus `node_modules/dexie/dist/dexie.min.js`) und `CACHE_NAME` hochzuzählen
- Das Skript bleibt parser-blockierend, kommt aber aus dem lokalen Cache bzw. vom selben Server
