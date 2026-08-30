# 0001 – Vanilla JavaScript ohne Framework

## Kontext

Die App ist im Umfang überschaubar (vier Kern-Flows, Einzelnutzer, keine komplexe UI-Zustandsverwaltung). Der Code soll auch ohne tiefere Programmierkenntnisse grob nachvollziehbar bleiben.

## Entscheidung

Kein React/Vue/Svelte. Reines JavaScript mit ES-Modulen, ein manuelles View-Pattern (`render(container)` pro Tab, s. [architecture.md](../architecture.md#view-pattern)). Kein Bundler, kein `npm install`, kein Build-Schritt.

## Konsequenzen

- Kein virtuelles DOM, kein Diffing — bei dieser Datenmenge unproblematisch, bei deutlich komplexerer UI würde das mühsamer werden
- Jede View re-rendert bei jeder Änderung komplett per `innerHTML` und bindet Event-Listener neu — einfach, aber ohne Framework-Komfort wie Reaktivität oder Komponenten-Wiederverwendung
- Ein späterer Framework-Wechsel würde primär die UI-Schicht betreffen; Datenmodell und PWA-Grundlagen (`db.js`, `sw.js`, `manifest.json`) bleiben unabhängig davon
