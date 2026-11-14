# 0045 – Stangenfeld oben, damit die iOS-Tastatur nichts verschiebt

**Status:** Gültig

## Kontext

Beim Tippen ins Stangenfeld des Scheiben-Rechners ([ADR 0044](0044-scheiben-rechner.md)) sprang das Sheet, obwohl es schon zwei Korrekturen gab (Cache v279: Innenabstand folgt der Tastaturhöhe; v280: nur Visual-Viewport-Ereignisse, verzögertes Scrollen).

Eine Bild-für-Bild-Auswertung einer iPhone-Aufnahme (20 fps, 402 × 874 pt) zeigt die Ursache:

- Die Tastatur samt Zubehörleiste (^ v ✓) beginnt bei etwa 508 pt, das Stangenfeld lag im Ruhezustand bei 640 bis 680 pt, also dahinter.
- Deshalb scrollt iOS beim Fokus die ganze Seite (rund 180 px nach unten und zurück, oben der leere Hintergrund), das Sheet bewegt sich mit. Dieses Systemverhalten lässt sich nicht abschalten.
- Beim Schließen fällt das Sheet innerhalb von etwa 0,1 s auf die Normalposition zurück, während die Tastatur noch ausfährt. iOS meldet die Tastaturhöhe (`visualViewport`) sofort, die Tastatur selbst fährt aber animiert.

Die früheren Korrekturen haben dagegen angepasst (Innenabstand, Scroll), jede dieser Anpassungen sprang gegenüber der animierten Tastatur und kämpfte mit dem Scrollen von iOS.

## Entscheidung

- **Das Stangenfeld liegt oben im Sheet, rechts neben dem Gesamtgewicht.** Es ist dadurch auch ohne Verschieben oberhalb der Tastatur (gemessen in Emulation: Feld-Unterkante bei 416 pt auf 874 pt Höhe, 221 pt auf 667 pt, 461 pt auf 932 pt; die Tastatur beginnt bei rund 58 % der Höhe). iOS scrollt nur, wenn ein fokussiertes Feld verdeckt würde, hier bleibt alles an seinem Platz und die Tastatur fährt einfach über den unteren Teil.
- **Die gesamte Tastatur-Behandlung entfällt:** Visual-Viewport-Listener, Innenabstand nach Tastaturhöhe, Schätzwert-Fallback, Timer, Scrollen des Felds. Es gibt nichts mehr, das sich mit der Tastatur bewegen könnte.
- Die Zeile unter der Grafik enthält nur noch „Leeren“ (rechts, wie bisher unter der letzten Scheiben-Spalte).
- Das Feld bleibt ein normales Textfeld (`inputmode="decimal"`, 16 px gegen den Auto-Zoom), also die Systemtastatur. Wertebereich, Live-Rechnen und Merken wie in ADR 0044.

## Konsequenzen

- Verhalten und Optik bleiben die einer normalen Tastatureingabe, aber ohne Sprung.
- Die Anordnung aus ADR 0044 („Anordnung im Sheet“) ändert sich: Das Stangenfeld wandert von der Zeile mit „Leeren“ nach oben.
- Die Entscheidung stützt sich auf Messwerte des Videos und Emulation. Auf iOS-Geräten mit sehr kleinem Bildschirm bleibt das Feld ebenfalls sichtbar (iPhone SE: 221 pt gegenüber Tastaturbeginn bei rund 388 pt).
- Für künftige Sheets mit Eingabefeld: Das Feld in den oberen Teil legen, statt dem Layout die Tastaturhöhe nachzuführen.
