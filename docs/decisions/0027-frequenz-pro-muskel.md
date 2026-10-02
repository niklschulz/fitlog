# 0027 – Frequenz & Sätze pro Muskel (Statistik-Tab)

## Kontext

Nutzer-Spezifikation (Markdown mit Referenz-Screenshot einer Fremd-App): Im Statistik-Tab soll eine Tabelle zeigen, wie oft und mit wie vielen Sätzen jeder Muskel im Schnitt pro Woche trainiert wurde, damit vernachlässigte oder übertrainierte Muskeln auffallen.

Vorab geprüft (Schritte 1–3 der Spezifikation):
- **Muskelzuordnung:** Übungen haben mehrere primäre (`primaryMuscleIds`, ADR 0022) und sekundäre Muskeln (`secondaryMuscleIds`) — die Rückfrage-Bedingung "nur ein Hauptmuskel" trifft nicht zu, kein Schema-Änderungsbedarf.
- **Bestehende Wochen-Mittelung:** Der Volumen-Chart (ADR 0023/0026) überspringt Wochen ohne Training. Die Spezifikation verlangt dagegen, dass solche Wochen mitzählen und den Schnitt senken — daher nicht wiederverwendet, sondern eigene Funktionen. Wiederverwendet wird nur das Prinzip "laufende Woche zählt nie".
- **Aufwärmsätze** kennt das Datenmodell nicht (kein `isWarmup`).

## Entscheidung

**Ebene:** die 7 Muskelgruppen aus `MUSCLE_GROUPS`, alphabetisch sortiert. Übungen sind einzelnen Muskeln zugeordnet; die Ansicht bildet jede Zuordnung vorab auf die Gruppe des Muskels ab (`muscleGroupIdOf()`), bevor `computeMuscleStats()` rechnet. Ein Satz zählt pro Gruppe höchstens einmal, auch wenn er mehrere Muskeln derselben Gruppe trifft (Curls: Bizeps + Unterarme → "Arme" einmal). Ursprünglich auf Rückfrage als 18 Einzelmuskeln mit Gruppen-Zwischenüberschriften gebaut, nach Ansicht im Browser auf Nutzer-Wunsch direkt auf Gruppen umgestellt (ohne Zwischenüberschriften).

**Zeitraum** (`getStatsRange(today, firstTrainedDate)`): letzte 8 abgeschlossene Kalenderwochen (Mo–So, lokale Zeit), laufende Woche ausgeschlossen. Kürzere Historie: Beginn mit der Woche des ersten Tags mit mindestens einem Satz (dieselbe "dokumentiert"-Definition wie `getTrainedDates()` — ein Workout ohne Satz zählt nicht). Noch keine abgeschlossene Woche → `null`, die Ansicht zeigt "Statistik ab der ersten abgeschlossenen Woche verfügbar."

**Berechnung** (`computeMuscleStats(sets, exerciseMuscles, muscles, range)`, `js/muscleStats.js`, reine Funktion):
- Eine Übung zählt für alle primären und sekundären Muskeln voll.
- Freq/Wo = Anzahl verschiedener Trainingstage pro Muskel ÷ Wochen (mehrere Übungen am selben Tag = 1).
- Ø Sätze/Wo = Anzahl Arbeitssätze ÷ Wochen. Arbeitssatz = Gewicht und Wiederholungen vorhanden, Wiederholungen > 0; 0 kg zählt normal.
- Wochen ohne Training gehen mit 0 in den Durchschnitt ein (Nenner = alle Wochen des Zeitraums).

**Daten** lädt `getMuscleStatsData()` (`js/db.js`): alle Sätze mit Workout-Datum, Muskelzuordnung je Übung, erster Trainingstag. Bei jedem Öffnen neu berechnet, kein Cache.

**Darstellung:** Karte "Frequenz pro Muskelgruppe" unter dem Volumen-Chart. Spalten "Muskelgruppe", "Sätze/Wo", "Freq/Wo". Der Zeitraum steht als Fußzeile in der Karte, mit Info-Icon davor ("Durchschnitt der vergangenen 8 Wochen" bzw. kürzer, Singular bei einer Woche) — ursprünglich rechts neben der Überschrift, dort reichte der Platz nach der Umbenennung bei 375px Breite nicht mehr. Zahlen mit einer Nachkommastelle über `Intl.NumberFormat('de-DE')`, Frequenz mit "x". Genau zwei Zeilenformate, die sich nur im Hintergrund unterscheiden (abwechselnd `bg-raised` / transparent); Schriftfarben in allen Zeilen gleich.

**Abweichung von der Spezifikation:** Untrainierte Gruppen werden **nicht** gedämpft dargestellt — die anfängliche Dämpfung (`opacity-40`) erzeugte zusätzliche Zeilenformate mit anderer Schriftfarbe, was der Nutzer ausdrücklich nicht wollte. Lücken sind weiterhin an "0,0" erkennbar.

**Detailansicht vorbereitet:** Jede Zeile ist ein `<button>` mit `aria-label`. Ursprünglich mit leerem Platzhalter-Handler, seit [ADR 0028](0028-muskelgruppen-sheet.md) öffnet sie ein Bottom-Sheet mit der Statistik pro Muskel der Gruppe.

## Konsequenzen

- Übungen ohne Muskelzuordnung und Alt-Übungen mit nur dem früheren Feld `primaryMuscleId` (ADR 0022) fließen nicht ein.
- `js/muscleStats.js` enthält eigene kleine Datums-Helfer statt `addDays()`/`mondayOf()` aus `db.js` zu importieren: `db.js` setzt beim Import ein globales `Dexie` voraus, die Datei soll aber wie `pr.js` ohne Datenbank testbar sein.
- Tests in `tests/muscleStats.test.js` (Node-Test-Runner, keine weitere Abhängigkeit): Beispiel der Spezifikation (1,75 → "1,8x", 5,625 → "5,6"), Hilfsmuskeln, gleicher Tag, Gruppen-Ebene (zwei Muskeln derselben Gruppe), laufende Woche, Wochen ohne Training, kurze Historie, Wochenwechsel Sonntag/Montag, Sätze ohne Gewicht bzw. mit 0 Wiederholungen.
- Offen für später: eventuell wählbarer Zeitraum (4/8/12 Wochen). Die Detailansicht pro Muskelgruppe ist mit ADR 0028 umgesetzt.
