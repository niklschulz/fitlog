# 0040 – Repo-Prüfskript statt reiner Handarbeit

**Status:** Gültig

## Kontext

Das Audit vom 2026-11-06 hat Dinge von Hand geprüft, die kein Datentest bemerkt: vergessenes Hochzählen von `CACHE_NAME` (Nutzer bekommen wegen Cache-first die alte Version), veraltetes vorkompiliertes `css/tailwind.css`, abweichende Dexie-Vendor-Datei, Infrastruktur-Details im öffentlichen Repo, tote Doku-Links. Ein Push auf `main` deployt sofort (s. [ADR 0005](0005-github-pages-hosting.md)), einen Freigabeschritt gibt es nicht.

## Entscheidung

`scripts/check-repo.js` (`npm run check`) führt diese Prüfungen vor jedem Commit/PR automatisch aus. Fehler ergeben Exit-Code 1, Warnungen nicht. Die Regeln sind kleine, reine Funktionen und in `tests/check-repo.test.js` getestet.

- **Nur Node-Bordmittel, keine neuen Abhängigkeiten.** Die App bleibt build-frei ([ADR 0001](0001-vanilla-js-ohne-framework.md), [ADR 0030](0030-tailwind-vorkompiliert.md)); das Skript ist wie `tests/` reines Dev-Werkzeug, liegt außerhalb der App-Shell und wird nicht ausgeliefert.
- **Kein Netzwerk, keine Schreibzugriffe im Repo.** Der Tailwind-Vergleich baut in ein temporäres Verzeichnis.
- **Allgemeine Muster statt echter Werte.** Das Repo ist öffentlich; das Skript und seine Tests enthalten keine echten Hostnamen, Adressen oder Tokens. Testwerte werden zur Laufzeit zusammengesetzt.
- **Allowlists nur mit Begründung im Code.** Wer eine Prüfung grün bekommt, indem er sie ausnimmt, muss den Grund an den Eintrag schreiben.
- **Der Check läuft lokal, nicht in der Auslieferung.** Ein GitHub-Actions-Workflow ist bewusst nicht Teil dieser Entscheidung (dauerhafte Konfiguration auf einem öffentlichen Repo, Entscheidung des Nutzers).

## Folgen

- `CLAUDE.md` verlangt `npm run check` und `npm test` vor jedem Commit/PR.
- Neue Regeln kommen als Funktion plus Test in dasselbe Skript.
- Die Prüfung der ADR-Statuszeile akzeptiert neben den drei Formen aus `CLAUDE.md` auch „Abgeschlossen“, weil [ADR 0024](0024-testmodus-umschaltbare-datenbank.md) es so verwendet.
