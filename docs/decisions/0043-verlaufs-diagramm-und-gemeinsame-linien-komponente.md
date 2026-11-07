# 0043 – Verlaufs-Diagramm der Übungs-Seite und gemeinsame Liniendiagramm-Bausteine

**Status:** Gültig

## Kontext

Die Statistik-Übungs-Seite zeigte nur die Tabelle „Persönliche Bestwerte“. Gewünscht war ein Liniendiagramm mit der Zeit auf der X-Achse und einer wählbaren Größe auf der Y-Achse, erste Größe „Maximales Gewicht“. Das Volumen-Chart im Übersicht-Reiter war bisher eine in `js/views/statistics.js` eingebaute Funktion, `design-system.md` hielt fest, dass Diagramme keine generischen Komponenten sind.

## Entscheidung

- **Gemeinsame Bausteine** in `js/lineChart.js`: `niceTickStep()`, `buildYAxis()` (gezoomte Y-Achse mit Polster und „schönen“ Ticks), Label-Auswahl und -Entdoppelung, `renderLineChart()` (Markup mit Gitterlinien, Grundlinie, Polyline, Label-Zeile). Die X-Position der Punkte, das Tick-Format und die X-Beschriftungen liefert der Aufrufer, die Komponente kennt keine Wochen oder Trainingstage. Das Volumen-Chart ist darauf umgestellt, seine Berechnung (gleitender Durchschnitt, Wochenserie) und Optik bleiben unverändert ([ADR 0023](0023-volumen-chart-zeitraum-reiter.md), [ADR 0026](0026-volumen-chart-eine-datenreihe.md) bleiben gültig). Der Satz „keine generischen Komponenten“ in `design-system.md` entfällt.
- **Ein Punkt pro Trainingstag**, Wert = höchstes Gewicht über 0 an diesem Tag, bei Gleichstand der Satz mit mehr Wiederholungen (dieselbe Regel wie „Gewicht“ in den Bestwerten). Keine Glättung. `computeMaxWeightSeries()` in `js/exerciseStats.js`. Tage ohne Satz mit Gewicht über 0 erscheinen nicht, reine Körpergewichts-Übungen zeigen „Keine Daten im Zeitraum.“
- **Zeitlich proportionale X-Achse** zwischen erstem und letztem Punkt der Serie (6 % Rand), nicht bis heute: Die Linie füllt die Karte, Pausen sind als Lücken sichtbar. Beschriftung: 4 gleichmäßig verteilte Zeitpunkte, Format je Zeitraum wie im Volumen-Chart (3M „7. Okt.“, 1J „Okt 26“, Max „2026“). Ein einzelner Punkt steht mittig, die Y-Achse ist um ihn zentriert (± 10 %, mindestens ± 1).
- **Einzelpunkte sichtbar und auswählbar** (abweichend vom Volumen-Chart, bei dem sie auf Nutzer-Wunsch entfielen): Tippen oder Wischen wählt den nächsten Punkt, Kopfzeile zeigt Wert, Wiederholungen und Datum (Standard: letzter Punkt), dazu eine senkrechte Hilfslinie. Punkte sind runde HTML-Elemente (`.chart-dot`), kein `<circle>`, weil das gestreckte SVG sie verzerren würde. Die Plot-Fläche hat `touch-action: pan-y`; die Wisch-zurück-Leiste am linken Rand (22 px, `swipeBack.js`) liegt außerhalb der Plot-Fläche und kollidiert nicht. Die Auswahl aktualisiert nur Kopfzeile und Hervorhebung, kein neues `paint()`.
- **Größen-Leiste** unter dem Diagramm (horizontal scrollbare Chips), sofort sichtbar mit dem einen Chip „Maximales Gewicht“. Weitere Größen sind ein zusätzlicher Eintrag in `CHART_METRICS` (`js/views/statistics-exercise-detail.js`).
- **Zeitraum:** das Diagramm nutzt den bestehenden Reiter 3M / 1J / Max der Seite, keinen eigenen.

## Konsequenzen

- Neue Diagramme (weitere Größen, andere Seiten) bauen auf `js/lineChart.js` auf, Tests in `tests/lineChart.test.js` und `tests/exerciseStats.test.js`.
- Die Plot-Fläche des Verlaufs-Diagramms fängt horizontale Gesten ab. Ein horizontaler Wisch über dem Diagramm blättert also nicht, vertikales Scrollen der Seite bleibt möglich.
- Bei sehr unregelmäßigem Training liegen Punkte eng beieinander, die Auswahl wählt den nächsten Punkt.
