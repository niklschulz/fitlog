# 0044 – Scheiben-Rechner für die Langhantel

**Status:** Gültig

## Kontext

Beim Erfassen eines Satzes gab es für das Gewicht nur den 1-kg-Stepper und die Direkteingabe. Bei einer Langhantel setzt sich das Gewicht aus Stange und aufgelegten Scheiben zusammen, das Kopfrechnen dafür ist umständlich. Gewünscht war ein grafisches Werkzeug, mit dem man Scheiben auf eine Stange legt und das Ergebnis ins Gewichtsfeld übernimmt.

## Entscheidung

- **Reine Rechenhilfe:** Ein Bottom-Sheet berechnet das Gesamtgewicht (Stange + Scheiben links + Scheiben rechts). ✓ schreibt es ins Gewichtsfeld der Detailseite, gespeichert wird weiterhin über „Speichern“/„Ändern“. ✕, Wegziehen und Tipp auf den Hintergrund verwerfen. Das Sheet liest das Gewichtsfeld nie; Änderungen am Feld von Hand wirken nicht auf die Scheiben zurück. Es gibt keine Rückwärts-Zerlegung eines vorhandenen Gewichts in Scheiben.
- **Nur Langhantel.** Das Stangengewicht ist ein Parameter der Rechenlogik, SZ-Stange, Trap Bar oder Kurzhanteln lassen sich später ergänzen, sind aber nicht Teil dieses Schritts.
- **Einstieg:** Icon-Button (Hantelscheibe, `renderPlateIcon()`) in der Button-Zeile der Übungs-Detailseite, direkt neben dem Notiz-Button. Der Speichern-Button ist dafür schmaler (`flex-[3]` statt `flex-[4]`).
- **Bedienung:** Antippen, kein Drag & Drop. Eine Scheibe in der Auswahl unter der Grafik legt sie auf, ein Tipp auf eine aufgelegte Scheibe an der Stange nimmt sie wieder ab. „Leeren“ nimmt alle Scheiben beider Seiten ab. Es gibt keinen Hinweistext in der Grafik.
- **Beide Seiten:** Standardmäßig sind beide Seiten gleich beladen: Auflegen und Abnehmen wirken auf beide. Der Schalter „Ungleich beladen“ (aus = Standard, unten links in der Grafik-Karte) erlaubt unterschiedliche Beladung. Die aktive Seite wählt man durch Antippen der linken oder rechten Hälfte der Grafik (hervorgehoben, beschriftet „LINKS“/„RECHTS“); die Scheiben-Auswahl wirkt nur auf sie, ein Tipp auf eine aufgelegte Scheibe nimmt sie von ihrer Seite ab und macht diese Seite aktiv. Wieder Ausschalten gleicht beide Seiten an die zuletzt aktive Seite an, die andere Seite wird dabei überschrieben. Das Limit von 8 gilt je Seite.
- **Anordnung im Sheet:** Überschrift, direkt darunter das Gesamtgewicht, dann die Grafik-Karte, darin unten links der Schalter „Ungleich beladen“, darunter eine Zeile im selben 4-Spalten-Raster wie die Scheiben-Auswahl: „Leeren“ so breit wie ein Scheiben-Button in der letzten Spalte, direkt links daneben das Stangenfeld mit der Beschriftung „Stange (kg)“ davor, zuletzt die Scheiben-Auswahl.
- **Grafik:** Inline-SVG der Stange mit beiden Seiten. Scheiben liegen schwerste zuerst innen. Die Karte hat eine feste Größe (feste `viewBox`, die Beschriftung bei ungleicher Beladung hat dauerhaft Platz), sie wächst oder schrumpft nicht mit der Scheibenzahl. Höhe und Dicke wachsen mit dem Gewicht (25 und 20 kg gleich groß wie in echt).
- **Scheiben-Set (fest):** 1,25 / 2,5 / 5 / 10 / 15 / 20 / 25 kg. **Maximal 8 Scheiben pro Seite**: Das ist, was auf die Hülse einer Olympiastange passt und was die Grafik auf dem iPhone fasst. Ist das Limit erreicht, sind die Scheiben in der Auswahl deaktiviert.
- **Farben:** olympisch (25 rot, 20 blau, 15 gelb, 10 grün, 5 weiß), dazu 2,5 und 1,25 kg schwarz (eigene Wahl, der Standard legt dort nichts fest; die beiden unterscheiden sich nur durch Größe und Dicke). Als Tokens `plate-*` in `tailwind.config.js`.
- **Stangengewicht:** kleines Textfeld im Sheet, Start 20 kg, Komma oder Punkt, gültig sind Werte über 0 bis 50 kg (sonst gilt der letzte gültige Wert). Wird es geändert, merkt es sich die App dauerhaft (`plateBarWeight` in den Einstellungen, `localStorage`).
- **Zustand:** Scheiben beider Seiten, Seiten-Schalter und aktive Seite bleiben beim erneuten Öffnen erhalten, solange die Übungsseite offen ist; beim Verlassen der Seite (`unmount()`) startet das Sheet wieder leer. Eine leere Stange ist gültig, ✓ trägt dann das Stangengewicht ein.
- **Umsetzung:** Rechenlogik in `js/plates.js` (reine Funktionen, Tests in `tests/plates.test.js`), Sheet in `js/plateSheet.js` (nutzt `createSheetCloser`, `wireSheetDrag` und die Tastatur-Behandlung wie `noteSheet.js`), Einbindung in `js/views/workout-exercise-detail.js`.
- **Anhängen an `<body>`:** Das Sheet wird an `document.body` gehängt, nicht an `#view-container`. Der Container ist ein eigener Stacking-Context (`isolation: isolate`) unterhalb der Seiten-Ebene `#page-layer` (z-8, an `<body>`); ein Sheet darin läge hinter der Detailseite und wäre nicht sichtbar.

## Konsequenzen

- Das Datenmodell ändert sich nicht: Gespeichert wird weiter nur `sets.weight`. Welche Scheiben benutzt wurden, geht nicht in die Historie ein.
- Wer ein anderes Scheiben-Set hat (z. B. 0,5 kg), muss den Code ändern; ein anpassbares Set wäre eine neue Entscheidung.
- Andere Hantelarten, Zerlegung eines Gewichts in Scheiben oder Anzeige der Scheiben in der Historie wären neue Entscheidungen.
