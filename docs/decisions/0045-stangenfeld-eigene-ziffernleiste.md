# 0045 – Stangenfeld des Scheiben-Rechners mit eigener Ziffernleiste

**Status:** Gültig

## Kontext

Das Stangenfeld des Scheiben-Rechners ([ADR 0044](0044-scheiben-rechner.md)) war ein `<input inputmode="decimal">`. Beim Fokussieren öffnet iOS die Systemtastatur, und das Sheet sprang dabei, obwohl es bereits zwei Korrekturen gab (Cache v279: Innenabstand folgt der Tastaturhöhe; v280: nur Visual-Viewport-Ereignisse, verzögertes Scrollen).

Eine Bild-für-Bild-Auswertung einer weiteren iPhone-Aufnahme (20 fps) zeigt die Ursache beider Richtungen:

- **Öffnen:** iOS verschiebt beim Fokus die ganze Seite um rund 180 px nach unten (oben ist der leere Hintergrund sichtbar) und wieder zurück; das Sheet bewegt sich mit.
- **Schließen:** Das Sheet fällt innerhalb von etwa 0,1 s auf seine Normalposition zurück, während die Tastatur noch sichtbar ausfährt und kurz die Schaltflächen überdeckt.

iOS meldet die endgültige Tastaturhöhe (`visualViewport`) sofort, die Tastatur selbst fährt aber animiert ein und aus, und das Verschieben der Seite beim Fokus ist ein Systemverhalten, das sich nicht abschalten lässt. Jedes Layout, das an die Tastaturhöhe gekoppelt ist, springt deshalb gegenüber der sichtbaren Tastatur. Die beiden früheren Korrekturen haben das nur verschoben.

## Entscheidung

- **Keine Systemtastatur für das Stangenfeld.** Das Feld ist ein Button. Ein Tipp darauf ersetzt die Scheiben-Auswahl durch eine **Ziffernleiste** im Sheet: zwei Reihen à sechs Tasten (1-5, Löschen / 6-9, 0, Komma), gleiche Höhe wie die Scheiben-Auswahl, das Sheet ändert seine Größe nicht.
- **Eingabe:** Die erste Taste ersetzt den alten Wert (Löschen leert ihn), danach wird angehängt. Regeln in `typeBarKey()` (`js/plates.js`, getestet): ein Komma, höchstens zwei Nachkommastellen, höchstens 50 kg; eine Taste, die das verletzen würde, tut nichts. Das Gesamtgewicht rechnet live mit; ist das Feld leer, gilt der letzte gültige Wert weiter. 0 ist gültig.
- **Beenden:** erneuter Tipp auf das Feld oder ein Tipp irgendwo außerhalb von Feld und Leiste (`pointerdown` am Sheet; die Aktion des getippten Elements läuft danach normal), ✓, ✕ und Wegziehen. Dabei wird der Wert dauerhaft gemerkt (`plateBarWeight`). Beim Beenden werden nur Feld, Leiste und Gesamtgewicht neu gezeichnet, nicht Grafik und Schalter, damit ein Tipp darauf nicht verschluckt wird.
- Der gesamte Visual-Viewport-, Timer- und Scroll-Code für die Tastatur entfällt.

## Konsequenzen

- Kein Springen mehr, weil keine Systemtastatur und damit keine Layout-Kopplung existiert.
- Das Feld sieht aus und verhält sich anders als ein Textfeld (kein Cursor-Setzen, kein Einfügen, keine Autokorrektur-Leiste). Für eine Zahl bis 50 kg ist das unkritisch.
- Wird anderswo in der App ein Eingabefeld direkt über der Tastatur nötig, gilt dort weiter die Tastatur-Behandlung der jeweiligen Sheets; diese Entscheidung betrifft nur den Scheiben-Rechner.
