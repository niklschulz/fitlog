# 0033 – Dependabot für Abhängigkeiten

## Kontext

Bisher gab es keinen Prozess, um Sicherheitslücken in Abhängigkeiten zu bemerken. Die App hat keinen Backend-Code und lädt zur Laufzeit nur das lokal eingecheckte Dexie ([ADR 0031](0031-dexie-lokal.md)); Tailwind ist vorkompiliert ([ADR 0030](0030-tailwind-vorkompiliert.md)). `npm audit` meldet aktuell drei Befunde mittlerer Schwere in der Tailwind-Build-Kette (`postcss-selector-parser`), die nur den Build auf dem Entwicklerrechner betreffen.

## Entscheidung

`.github/dependabot.yml` aktiviert wöchentliche Prüfungen des npm-Ökosystems (`package.json`). Dependabot öffnet Pull Requests für Updates und Security-Advisories. Major-Updates von `tailwindcss` sind ausgenommen (Tailwind 4 erfordert eine neue Konfiguration), bis sie bewusst angegangen werden.

## Konsequenzen

- Ein Dependabot-PR aktualisiert nur `package.json`/`package-lock.json`. Die ausgelieferte Datei `js/vendor/dexie.min.js` wird dadurch **nicht** aktualisiert: nach dem Merge eines Dexie-Updates die Datei aus `node_modules/dexie/dist/dexie.min.js` von Hand ersetzen und `CACHE_NAME` hochzählen
- Nach einem Tailwind-Update `npm run build:css` ausführen, `css/tailwind.css` einchecken und `CACHE_NAME` hochzählen
- `npm test` vor dem Merge laufen lassen (keine CI vorhanden)
- Bei einem Server-Backend (Raspberry Pi) braucht es zusätzlich Update-Prozesse für Basis-Image, Betriebssystem und Backend-Pakete; Dependabot deckt davon nur die Paket- und `FROM`-Ebene ab. Das wird in der Backend-Entscheidung festgelegt
