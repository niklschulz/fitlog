# 0025 – PR-Markierungen an Sätzen (Gewichts- und Wiederholungs-Rekorde)

## Kontext

Beim Blick auf ein vergangenes Workout soll sofort sichtbar sein, an welchem Satz ein persönlicher Rekord (PR) aufgestellt wurde. Die Badges sollen dauerhaft am Satz bleiben, auch wenn der Rekord später übertroffen wird. Grundlage war eine Feature-Spezifikation des Nutzers, die an einigen Stellen bewusst an das tatsächliche Datenmodell angepasst wurde (s. "Abweichungen" unten).

## Entscheidung

**Zwei PR-Typen, pro Übung (Übungs-ID) ermittelt, höchstens ein Badge pro Satz:**

- **Gewichts-PR:** Gewicht > 0 und strikt größer als das aller vorherigen Sätze dieser Übung, auch früherer Sätze im selben Workout. Jede Steigerung innerhalb eines Workouts wird markiert, keine Mindest-Wiederholungszahl. Der erste gültige Satz einer Übung ist automatisch ein Gewichts-PR (außer bei 0 kg).
- **Wiederholungs-PR:** nur bei exakt gleichem Gewicht (auf 2 Nachkommastellen gerundet), das bei dieser Übung bereits in einem **früheren** Workout genutzt wurde. Dann ein PR, wenn die Reps strikt größer sind als bei allen vorherigen Sätzen mit diesem Gewicht, auch früheren im selben Workout. Ein erstmals genutztes Gewicht ergibt in diesem Workout keine Reps-Badges. Übungen ohne Zusatzgewicht (0 kg) bekommen nach denselben Regeln nur Reps-Badges.
- Gleichstand ergibt nie ein Badge. Sätze mit 0 Wiederholungen oder ungültigen Werten werden weder markiert noch als Vergleichsbasis verwendet.

**Berechnet, nicht gespeichert:** `computePRs(sets)` in der neuen Datei `js/pr.js` ist eine reine Funktion ohne DOM- oder Dexie-Zugriff (ein Durchlauf, mitgeführt werden Höchstgewicht, beste Reps je Gewicht und die Gewichte abgeschlossener früherer Workouts). `getPRsForExercises(exerciseIds)` in `js/db.js` lädt die komplette Satz-Historie der angefragten Übungen über den vorhandenen `exerciseId`-Index, sortiert chronologisch und ruft `computePRs()` je Übung auf. Bearbeiten oder Löschen eines früheren Satzes wirkt sich dadurch automatisch auf alle späteren Badges aus.

**Anzeige** in allen drei Satz-Listen: Roster-Zeile im Workout-Tab, Tages- und Verlauf-Reiter der Übungs-Detailseite (`renderPRBadge()` in `js/utils.js`, Gestaltung s. design-system.md "PR-Badge").

## Abweichungen von der Spezifikation

- **Keine Schema-Änderung:** Der `exerciseId`-Index auf `sets` existiert seit Version 1, ein neuer Index war nicht nötig.
- **Satz-Reihenfolge über `createdAt`:** Sätze haben kein eigenes `order`-Feld. Innerhalb eines Workouts gilt dieselbe Reihenfolge wie überall in der Anzeige (`createdAt`), zwischen Workouts das Workout-Datum (pro Tag gibt es genau ein Workout, ADR 0007).
- **Keine Aufwärmsätze:** Das Datenmodell kennt keine Kennzeichnung dafür, daher keine eigene Ausnahme.
- **Kein Cache:** Statt eines Caches pro Übung mit Invalidierung bei jeder Satz-Änderung wird bei jedem Rendern neu berechnet. Gemessen mit dem 3-Jahres-Testdatensatz (ADR 0024, ca. 2200 Sätze): rund 50 ms für **alle** Übungen auf einmal, ein einzelner Tag oder eine einzelne Übung liegt deutlich darunter, also klar unter dem 100-ms-Ziel. Ein Cache hätte nur Invalidierungs-Risiken ohne spürbaren Nutzen gebracht.
- **Icon-Größe:** 24-px-Kreis mit 14-px-Icon statt 20-px-Icon, da die Satz-Zeile exakt 24 px hoch ist (s. design-system.md "Verbundene Satz-Liste").
- **Reps-Icon:** zwei kreisförmige Pfeile wie im Referenzbild (loop.png) statt "Kreis mit Pfeil nach oben/rechts" aus dem Spezifikationstext.

## Konsequenzen

- Automatisierte Tests für `computePRs()` in `tests/pr.test.js` (alle sieben Beispiele der Spezifikation plus Randfälle), laufen mit `npm test` im bestehenden Node-Test-Runner, kein neues Test-Framework.
- Jedes Öffnen eines Workout-Tages bzw. der Übungs-Detailseite lädt zusätzlich die komplette Satz-Historie der betroffenen Übungen. Sollte das bei sehr vielen Jahren Daten spürbar werden, wäre ein Cache in `getPRsForExercises()` die naheliegende Erweiterung, ohne dass sich an `computePRs()` oder den Views etwas ändern müsste.
