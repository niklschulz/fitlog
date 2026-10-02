# 0028 – Muskelgruppen-Sheet mit "Frequenz pro Muskel"

## Kontext

Die Zeilen der Tabelle "Frequenz pro Muskelgruppe" ([ADR 0027](0027-frequenz-pro-muskel.md)) waren bereits als Buttons mit leerem Platzhalter-Handler angelegt. Nutzer-Vorgabe: Ein Tipp öffnet ein Bottom-Sheet für die Gruppe, das dieselbe Statistik für die einzelnen Muskeln der Gruppe zeigt.

## Entscheidung

- **Bottom-Sheet** nach dem Top-Level-Muster von "Profil verknüpfen" (`profile.js`): Teil des normalen `paint()`-Strings, Zustand `muscleGroupSheetId`/`muscleGroupSheetClosing` in `statistics.js`, geteilte Mechanik aus `js/sheet.js` (Body-Scroll-Sperre, Nav-z-index, Drag-to-Dismiss am Titel). Schließen über Glass-Button, Backdrop oder Herunterziehen.
- **Titel** = Name der Muskelgruppe.
- **Schließen-Button rechts oben** (`.icon-btn-glass`, ✕) — auf Nutzer-Wunsch abweichend vom bisherigen Sheet-Standard (Schließen links, s. design-system.md "Bottom-Sheet"). Links ein leerer 44px-Platzhalter, damit der Titel zentriert bleibt.
- **Inhalt:** Überschrift "Frequenz pro Muskel", darunter dieselbe Tabelle wie in der Übersicht, aber mit den einzelnen Muskeln der Gruppe (alphabetisch) und Spaltenkopf "Muskel". Gleicher Zeitraum und dieselbe Berechnung (`computeMuscleStats()`), nur ohne Abbildung auf Gruppen. Die Tabelle sitzt in einer eigenen optischen Karte (Nutzer-Wunsch nach erster Version ohne Karte): Da das Sheet selbst `bg-surface` ist, hellt die Karte die Fläche per `bg-white/[0.06]` auf (gleiche Sheet-Konvention wie Suchfeld/Chips mit `bg-white/[0.08]`), jede zweite Zeile darauf noch einmal per `bg-white/[0.06]`. Muskel-Zeilen sind nicht antippbar (kein Chevron, keine Chevron-Spalte).
- **Gruppen mit nur einem Muskel** (aktuell Brust, Po): Sheet ohne Inhalt — die Tabelle würde nur die Gruppen-Zeile wiederholen (Nutzer-Vorgabe). Ebenso ohne Inhalt, solange es noch keine abgeschlossene Woche gibt (dann sind die Gruppen-Zeilen ohnehin nicht sichtbar).
- **Code-Teilung:** Gruppen-Tabelle und Muskel-Tabelle kommen aus derselben Funktion `renderFrequencyTable()` (Parameter `interactive` für Button+Chevron vs. reine Anzeige).
- **`unmount()`** in `statistics.js`: Die Bottom-Nav liegt über dem Sheet, ein Tab-Wechsel bei offenem Sheet ist also möglich — `unmount()` gleicht dann Scroll-Sperre und Nav-z-index aus (wie in `profile.js`).

## Konsequenzen

- Der Platzhalter `openMuscleGroupDetail()` aus ADR 0027 entfällt, ersetzt durch `openMuscleGroupSheet()`.
- Erstes Sheet mit Schließen-Button rechts — bei weiteren Sheets bewusst entscheiden, welcher Standard gelten soll.
- Verifiziert im Browser (375px): Öffnen, Inhalt und Werte (identisch zur früheren Einzelmuskel-Ansicht), leeres Sheet bei Brust, Schließen über Button/Backdrop/Herunterziehen, Tab-Wechsel bei offenem Sheet (Scroll-Sperre und Nav-z-index danach zurückgesetzt).
