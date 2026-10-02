# 0026 – Volumen-Chart: eine Datenreihe für alle Zeitraum-Reiter

## Kontext

Seit [ADR 0023](0023-volumen-chart-zeitraum-reiter.md) rechnete der Volumen-Chart je Reiter etwas anderes: 3M zeigte den 4-Wochen-Durchschnitt der Wochenwerte, 1J/Max einen 3-Monats-Durchschnitt über Monatswerte (selbst schon Durchschnitte der Wochen). Nutzer-Bugreport: Die Linie endet je nach Reiter an einem anderen Punkt — aus Nutzersicht nicht nachvollziehbar. Ursachen im Einzelnen:

- Unterschiedliche Glättung: Der Endpunkt in 1J/Max mittelt über rund 13 Wochen, reagiert also später und flacher als der 4-Wochen-Wert in 3M.
- Unterschiedlicher zeitlicher Endpunkt: 3M endete bei der letzten vollständigen Woche, 1J/Max beim laufenden Monat. Hat dieser noch keine vollständige Woche, lief die Linie mit dem Vormonatswert flach bis zum rechten Rand weiter — sah aus wie echte Daten.
- Die KPI-Zahl war seit dem Nachtrag vom 2026-09-30 immer wochenbasiert, die Linie in 1J/Max aber monatsbasiert — Zahl und Linienende widersprachen sich sichtbar.

Gängige Praxis (Aktien-Apps, Gewichts-Trend in MacroFactor/Happy Scale, Apple Health): Ein Zeitraum-Reiter verändert nur den sichtbaren Ausschnitt, nicht die Berechnung. Der aktuelle Wert ist in jedem Zeitraum derselbe, nur die Veränderung bezieht sich auf den gewählten Zeitraum.

## Entscheidung

- **Eine Datenreihe:** gleitender Durchschnitt über 4 Kalenderwochen (`VOLUME_MA_WINDOW`) auf den vollständigen Wochenwerten, einmal über die gesamte Historie berechnet (Regeln von `computeMovingAverage()` unverändert aus ADR 0023).
- **Reiter = Ausschnitt** (`VOLUME_RANGE_WEEKS`): 3M = letzte 13 Wochen, 1J = letzte 52 Wochen, Max = gesamte Historie. Jeder Datenpunkt ist in allen Reitern eine Woche.
- **Endpunkt** ist in allen Reitern die letzte vollständige Woche; die KPI-Zahl ist per Konstruktion genau dieser Endpunkt (kein Sonderfall mehr).
- **Prozent-Veränderung** bleibt reiter-abhängig (erster vs. letzter sichtbarer Punkt) und zeigt ihren Bezugspunkt jetzt explizit an: "seit KW 27" (3M) bzw. "seit Okt 25" (1J/Max). Eigene Zeile unter der KPI-Zahl, damit das Layout beim Reiter-Wechsel nicht springt.
- **Monate** dienen nur noch der X-Achsen-Beschriftung in 1J ("Sep 26") und Max ("2026"), über `monthOfWeek()` (Monat des Donnerstags der Woche).
- Rohwerte (einzelne Wochen) werden weiterhin nicht gezeigt (Nutzer-Entscheidung).

## Konsequenzen

- Löst die Monats-Aggregation aus ADR 0023 ab (`buildMonthlySeries()` entfällt, ebenso der Monats-Durchschnitt als Datenbasis und das 3-Monats-Fenster). Alle übrigen Regeln aus ADR 0023 (vollständige Wochen, leere Wochen, Glättung über die ganze Historie, Sonderfall "nur ein Datenpunkt") gelten weiter.
- Die Linie ist in 1J/Max unruhiger als vorher (4-Wochen- statt faktisch ~13-Wochen-Glättung) — bewusst in Kauf genommen, ist die ehrlichere Darstellung. Falls Max über mehrere Jahre zu unruhig wirkt, wäre die Lösung ein für **alle** Reiter gemeinsam stärkeres Fenster, nicht wieder eine reiter-spezifische Glättung.
- Bezugspunkt der Prozentangabe in Max ist der erste MA-Wert der gesamten Historie, der dort noch auf nur einer Woche beruht — kann entsprechend zufällig ausfallen.
- Verifiziert im Browser mit dem 3-Jahres-Testdatensatz: KPI in allen drei Reitern identisch, Linie endet überall bei derselben Woche (13 / 52 / 156 Punkte).
