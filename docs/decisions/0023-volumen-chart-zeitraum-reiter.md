# 0023 – Volumen-Chart mit Zeitraum-Reitern (Wochen-/Monats-Aggregation, gleitender Durchschnitt)

> **Teilweise abgelöst durch [ADR 0026](0026-volumen-chart-eine-datenreihe.md):** Die Monats-Aggregation mit 3-Monats-Durchschnitt für 1J/Max gibt es nicht mehr — alle Reiter zeigen denselben wöchentlichen 4-Wochen-Durchschnitt, nur unterschiedlich lange Ausschnitte. Die übrigen Regeln unten gelten weiter.

## Kontext

Das ursprüngliche "Volumen pro Trainingstag"-Diagramm ([Hunderteinundzwanzigste Iteration](../design-system.md)) zeigte rohe Tageswerte der letzten 14 Trainingstage. Der Nutzer hat dafür eine eigene, deutlich ausführlichere Markdown-Spezifikation verfasst (mit Claude erstellt, als Datei geliefert): Kurzfristige Schwankungen und Trainingspausen sollen den langfristigen Trend nicht verzerren, das Diagramm soll nach Wochen/Monaten statt Tagen aggregieren und einen gleitenden Durchschnitt als eigene Linie zeigen, wählbar über drei Zeitraum-Reiter. Dieses ADR ersetzt das Tages-Diagramm vollständig.

## Entscheidung

**Grundbegriffe** (aus der Nutzer-Spezifikation übernommen):
- Volumen eines Satzes = Gewicht × Wiederholungen.
- Wochenvolumen = Summe aller Satz-Volumina einer ISO-8601-Woche (Montag–Sonntag).
- Vollständige Woche = eine Woche, deren Sonntag bereits vorbei ist. Die laufende Woche ist **nie** vollständig und fließt **nirgends** ein — weder als Punkt noch in den gleitenden Durchschnitt noch in die KPI-Zahl.
- Monatswert = **Durchschnitt** (nicht Summe) der trainierten (nicht leeren) vollständigen Wochen dieses Monats. Verhindert, dass eine Urlaubswoche einen Monat künstlich absacken lässt oder Monate mit 4 vs. 5 Wochen unfair verglichen werden. Eine Woche wird über den Monat ihres Donnerstags zugeordnet (dieselbe ISO-Regel wie bei der Kalenderwochen-Nummer im Balkendiagramm), damit jede Woche eindeutig einem Monat gehört. Der laufende Monat bekommt — anders als die laufende Woche — durchaus einen Wert, sobald er mindestens eine vollständige trainierte Woche hat; das ergibt sich automatisch aus derselben Formel, kein Sonderfall.

**Drei Zeitraum-Reiter**, oberhalb des Charts als eigene Segmented Control (3M standardmäßig aktiv):

| Reiter | Zeitraum | Ein Punkt pro |
|---|---|---|
| 3M | letzte 13 vollständige Wochen | Woche |
| 1J | letzte 12 Monate (inkl. laufendem) | Monat |
| Max | vom Monat des ersten Workouts bis heute | Monat |

**Datenaufbereitung in zwei Schritten** (`js/views/statistics.js`):
1. `buildWeeklySeries(rawVolumes, today)` — dichte Wochen-Reihe von der ersten je trainierten Woche bis zur letzten vollständigen Woche, **jede** Kalenderwoche dazwischen bekommt einen Slot (`volume: null` bei einer leeren Woche, auch wenn sie in den Rohdaten komplett fehlt).
2. `buildMonthlySeries(weeklySeries, today)` — daraus abgeleitet, ein Slot pro Kalendermonat von der ersten trainierten Woche bis zum laufenden Monat, Wert = Durchschnitt der trainierten Wochen dieses Monats (leere Wochen zählen nicht mit).

Beide "dicht" (kein Wochen-/Monats-Slot fehlt), damit sowohl der gleitende Durchschnitt als auch die X-Achse leere Perioden korrekt als eigenen Slot ohne Punkt behandeln können, statt sie stillschweigend zu überspringen (was die Kalender-Abstände verzerren würde).

**Gleitender Durchschnitt** (`computeMovingAverage(periods, windowSize)`): 4 Kalenderwochen in der Wochenansicht, 3 Kalendermonate in der Monatsansicht. Bei einer trainierten Periode = Durchschnitt der vorhandenen (nicht-leeren) Werte innerhalb der letzten `windowSize` Kalenderperioden (leere Perioden im Fenster werden übersprungen, nicht als 0 gezählt); bei einer leeren Periode bleibt der Wert unverändert (Linie läuft flach weiter). Wird über die **gesamte** Historie berechnet, nicht nur den sichtbaren Ausschnitt (Regel 4 der Spezifikation) — sonst würde die Linie am linken Rand des sichtbaren Bereichs fälschlich bei 0 neu anlaufen statt bereits eingeschwungen zu beginnen; der sichtbare Ausschnitt wird erst danach per `slice()` zugeschnitten. Exakt gegen das Rechenbeispiel der Spezifikation verifiziert (Node-Skript, s. u.).

**Darstellung:** Zwei getrennte Datenreihen im selben Chart — **Punkte** zeigen die Rohwerte (Wochen-/Monatswert), nur an trainierten Perioden (leere Perioden bekommen keinen Punkt); die **Linie** zeigt den gleitenden Durchschnitt, durchgängig über alle Perioden inklusive leerer (dort flach). Technisch: Linie als native SVG-`<polyline>`, Punkte als separate, fixgroße HTML-Kreise (kein SVG-`<circle>`, das im nicht seitenverhältnistreuen `viewBox` zu Ellipsen verzerrt würde) — dieselbe Grundtechnik wie beim vorherigen Tages-Diagramm.

**KPI-Zahl:** Hauptzahl = gleitender Durchschnitt am letzten sichtbaren Punkt der Linie, Label immer "Ø Wochenvolumen" (unabhängig vom Reiter, auch in der Monatsansicht — ein Monatswert ist selbst bereits ein Durchschnitt pro trainierter Woche, ein 3-Monats-Durchschnitt davon bleibt also weiterhin sinnvoll "Wochenvolumen"). Veränderung daneben = prozentuale Veränderung des gleitenden Durchschnitts vom ersten zum letzten sichtbaren Punkt, grün/rot eingefärbt (`text-accent`/`text-red-400`, eigene Design-Entscheidung, nicht Teil der Spezifikation).

**Nutzer-Nachtrag (2026-09-30):** Die Hauptzahl ist jetzt **immer** wochenbasiert (`weeklyMA[letzter Index]`) statt reiter-abhängig — sie bleibt beim Wechseln zwischen 3M/1J/Max unverändert. Grund: In 1J/Max war die Zahl bisher der monatliche gleitende Durchschnitt (Ø über 3 Monate), was beim Reiter-Wechsel einen anderen Wert unter demselben Label "Ø Wochenvolumen" zeigte — für den Nutzer widersprüchlich. Die Vergleichsbasis für die Prozentanzeige (Start des jeweils sichtbaren Fensters) bleibt weiterhin reiter-spezifisch (wöchentlich für 3M, monatlich für 1J/Max), damit die Prozentzahl weiterhin zum sichtbaren Zeitraum des aktiven Reiters passt. Chart-Linie und -Punkte selbst (wochenweise bei 3M, monatsweise bei 1J/Max) sind von dieser Änderung nicht betroffen.

**Sonderfall "nur ein Datenpunkt":** Keine Prozent-Anzeige. Ausgelegt als: Gibt es in der **gesamten** Wochen-Historie (nicht nur im sichtbaren Ausschnitt) höchstens eine trainierte Woche, ist die Linie zwangsläufig überall identisch (nichts zum Vergleichen) — die Veränderung wäre immer exakt 0 % und damit nichtssagend statt informativ.

**Zwei unabhängige Segmented Controls auf derselben Seite:** Der bestehende Seiten-Reiter (Übersicht/Übungen) und der neue Zeitraum-Reiter (3M/1J/Max) nutzen beide `renderSegmentedControl()`/den gleitenden Indikator (`js/utils.js`), müssen aber getrennt positioniert/animiert werden — `positionSegmentedIndicator()`/`measureSegmentedIndicatorRect()` finden sonst immer nur die *erste* `.segmented-control` im übergebenen Container. Gelöst durch zwei eigene, per `id` eingegrenzte Wrapper (`#page-tabs`/`#volume-range-control`), die als jeweiliger `container`-Parameter übergeben werden — keine Änderung an `utils.js` nötig.

## Konsequenzen

- `getDailyTrainingVolumes()` (`js/db.js`) entfällt ersatzlos, ersetzt durch `getWeeklyTrainingVolumes()` (gleiches Muster, nach ISO-Woche statt Kalendertag gruppiert).
- "Falls Sätze als Aufwärmsatz markiert werden können, zählen diese nicht mit" (Spezifikation) ist aktuell **nicht umsetzbar** — die App kennt kein `isWarmup`-Feld an `sets`. Alle Sätze zählen vorerst. Sobald ein solches Feld existiert, muss `getWeeklyTrainingVolumes()` entsprechend gefiltert werden.
- ~~Die X-Achsen-Beschriftung im Monats-Modus zeigt nur das Monatskürzel ohne Jahr~~ — **behoben, direkter Nutzer-Nachtrag nach Live-Test mit einem 3-Jahres-Testdatensatz** (die Mehrdeutigkeit trat dort tatsächlich auf: "Okt Okt Sep Sep"): 1J zeigt jetzt Monat + zweistelliges Jahr ("Sep 26"), Max zeigt statt des Monats nur noch die vierstellige Jahreszahl ("2026") — bei einem "Max"-Zeitraum über mehrere Jahre bleiben so alle X-Achsen-Beschriftungen eindeutig unterscheidbar.
- Reine Anzeige-/Aggregationsfunktion (kein Zustand, keine Kaskaden) — kein neuer automatisierter Test in `tests/`, stattdessen das Rechenbeispiel der Spezifikation per einmaligem Node-Skript gegen `computeMovingAverage()` verifiziert (exakte Übereinstimmung: 5000/5200/5200/5200/5400) sowie mehrere Szenarien live im Browser (mehrwöchige Historie mit übersprungenen Wochen, alle drei Reiter, Sonderfall einzelner Datenpunkt, leerer Zustand).
