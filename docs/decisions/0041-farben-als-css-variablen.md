# 0041 – Farben als CSS-Variablen aus einer einzigen Liste

**Status:** Gültig

## Kontext

Die Farben standen in `tailwind.config.js`, wurden aber in `css/styles.css` (Glas-Effekte, Verläufe, Nav) und in zwei JS-Dateien als Hex- oder `rgba()`-Kopien wiederholt, jeweils mit einem Kommentar „entspricht Token X“. Eine Farbänderung hätte diese Kopien stillschweigend vergessen. `npm run check` meldete sie als Warnungen.

## Entscheidung

`tailwind.config.js` hält die Farben in einer einzigen Konstante `colors`. Ein kleines Tailwind-Plugin (`colorVariables`) erzeugt daraus beim Build in `css/tailwind.css` unter `:root` pro Farbe `--color-<name>` (Hex) und `--rgb-<name>` (`r g b`). `css/styles.css` und JS verwenden nur diese Variablen (`var(--color-muted)`, `rgb(var(--rgb-surface) / 0.55)`, in `reorder.js` `var(--color-highlight)`). Neu als Token: `accent-soft` (`#E5F3DE`, bisher ein loser Hex-Wert). Reines Weiß und Schwarz bleiben als `rgba(255, 255, 255, …)` bzw. `rgba(0, 0, 0, …)` erlaubt, weil sie keine Markenfarben sind.

`scripts/check-repo.js` (Prüfung 10) meldet nun auch `rgb()`/`rgba()` mit festen Zahlen, ausgenommen reines Weiß/Schwarz.

## Konsequenzen

- Eine Farbänderung geschieht an genau einer Stelle (`colors`), danach `npm run build:css` und `CACHE_NAME` hochzählen.
- Die Variablen werden erst zur Laufzeit aufgelöst, die Ladereihenfolge von `css/styles.css` und `css/tailwind.css` in `index.html` spielt daher keine Rolle. Fehlt `tailwind.css`, fehlen auch die Variablen (die App wäre dann ohnehin ohne Styling).
