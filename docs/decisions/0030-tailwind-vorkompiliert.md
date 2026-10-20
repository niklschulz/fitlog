# 0030 – Tailwind vorkompiliert statt Play CDN

## Kontext

Die Play CDN ([ADR 0002](0002-tailwind-play-cdn.md)) führte zu einem Offline-Ausfall: Das CDN-Skript lief als Cross-Origin-Skript durch den Service Worker, dessen `fetch`-Handler die URL `https://cdn.tailwindcss.com` mit dem Rohstring verglich, während `event.request.url` normalisiert `https://cdn.tailwindcss.com/` lautet. Der Handler griff deshalb nie, der Start ohne Netz lud das Skript nicht und die App erschien komplett ungestylt (Serifenschrift, keine Utilities). Dazu kam, dass Precache-Fehler beim Install verschluckt wurden. Grundsätzlich bleibt die Play CDN ein Runtime-Compiler und Laufzeit-Abhängigkeit von Dritten.

## Entscheidung

Tailwind (3.4.17, dieselbe Version, auf die die Play CDN auflöst) wird einmalig mit der CLI zu `css/tailwind.css` kompiliert und eingecheckt. Tokens liegen in `tailwind.config.js`, Quelle `css/tailwind.input.css`. Aufruf: `npm run build:css`. `tailwindcss` ist nur devDependency; die App lädt ausschließlich die fertige Datei, die zur App-Shell des Service Workers gehört. `css/tailwind.css` wird nach `css/styles.css` eingebunden, die Kaskadenreihenfolge entspricht damit der früheren (die Play CDN hängte ihr Stylesheet ebenfalls hinten an).

Zusätzlich im Service Worker: CDN-URLs werden normalisiert, und ein fehlgeschlagener CDN-Precache lässt den Install scheitern, statt einen unvollständigen Cache zu aktivieren.

## Konsequenzen

- Nach Änderung an Tailwind-Klassen oder Tokens muss `npm run build:css` laufen und `css/tailwind.css` mit committet werden, sonst fehlen neue Klassen (steht in `CLAUDE.md`)
- Kein Tailwind-JS, keine Produktionswarnung mehr, kein Layout-Flackern durch asynchrone CSS-Generierung
- Die Erstinstallation braucht nur noch für Dexie (CDN) Internet
