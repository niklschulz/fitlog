# Spezifikation: Verlaufs-Diagramm auf der Statistik-Übungsseite (Start: „Maximales Gewicht“)

**Status:** Entwurf, noch nicht umgesetzt. Bei der Umsetzung entstehen ein ADR (Abschnitt 9), ein Changelog-Eintrag und die Anpassung von `features.md` und `design-system.md`.

## 1. Ziel

Auf der Statistik-Übungsseite (`js/views/statistics-exercise-detail.js`, Reiter **Statistik**) kommt ein Liniendiagramm hinzu: **X-Achse = Zeit, Y-Achse = eine wählbare Größe** der Übung. Unter dem Diagramm sitzt eine horizontal scrollbare Leiste mit Buttons (Chips) für die Größe. Die erste Größe ist **Maximales Gewicht**; weitere Größen (z. B. 1RM, Volumen, Reps) sollen später ohne Umbau der Struktur ergänzbar sein.

Referenz ist ein Screenshot einer anderen Fitness-App: Großzahl mit Einheit und Datum oben links in der Karte, gepunktete Gitterlinien, Linie mit Einzelpunkten, Größen-Leiste unter dem Diagramm. Nicht übernommen werden das „Demo Chart“-Label und der Premium-Hinweis darunter.

Nicht Teil dieser Spezifikation: neue Datenfelder, neue Zeitraum-Optionen (6M, YTD), PR-Badges im Diagramm, Export.

## 2. Platzierung und Zeitraum

Reihenfolge im Reiter **Statistik**:

1. Zeitraum-Reiter 3M / 1J / Max (besteht bereits, `state.range`)
2. **Diagramm-Karte** (neu, enthält Kopfzeile, Diagramm und Größen-Leiste)
3. Tabelle „Persönliche Bestwerte“ (besteht bereits)

Das Diagramm nutzt den bestehenden Zeitraum-Reiter der Seite und hat keinen eigenen. Die Auswahl gilt weiter für die ganze Seite und startet bei jedem Öffnen auf 3M. Der Zeitraumbeginn kommt aus `getRangeStart(range, today)` (`js/exerciseStats.js`). Bei **Max** beginnt die Achse am ersten Trainingstag mit gültigem Satz.

## 3. Daten

### 3.1 Quelle

`getExerciseSetHistory(exerciseId)` (`js/db.js`) liefert bereits `[{ date, sets }]`, neueste Tage zuerst. Die Seite lädt diese Historie heute schon für die Bestwerte. Es gibt **keine zusätzliche Datenbank-Abfrage**, die Historie wird einmal geladen und an beide Berechnungen gegeben.

### 3.2 Neue reine Funktion in `js/exerciseStats.js`

```js
computeMaxWeightSeries(history, range, today)
// -> [{ date, value, reps }]   aufsteigend nach Datum
```

- **Ein Punkt pro Trainingstag** im Zeitraum (`date >= getRangeStart(...)`, `date <= today`, wie in `computePersonalBests`).
- `value` = **höchstes Gewicht > 0** unter den gültigen Sätzen dieses Tages (`isValidSet`: Gewicht ≥ 0, Reps ≥ 1). Bei Gleichstand gewinnt der Satz mit mehr Wiederholungen (dieselbe Regel wie „Gewicht“ in den Bestwerten, nur pro Tag statt pro Zeitraum).
- `reps` = Wiederholungen dieses Satzes, für die Anzeige „(x5)“.
- **Tage ohne gültigen Satz mit Gewicht > 0** liefern keinen Punkt. Das betrifft auch reine Körpergewichts-Übungen, die Serie bleibt dann leer.
- Keine Glättung, kein gleitender Durchschnitt.
- Muss mit dem Bestwert „Gewicht“ konsistent sein: der höchste `value` der Serie ist identisch mit `computePersonalBests(...).weight.weight` desselben Zeitraums. Das wird im Test geprüft.

Die Funktion ist rein, ohne DOM oder Dexie, und wird in `tests/exerciseStats.test.js` getestet (Abschnitt 8).

### 3.3 Größen als Konfiguration

Damit weitere Größen später nur Daten sind, wird jede Größe als Eintrag in einer Konfiguration beschrieben:

```js
const CHART_METRICS = [
  { key: 'maxWeight', label: 'Maximales Gewicht', unit: 'kg', series: computeMaxWeightSeries },
  // später: 'oneRm', 'volume', 'reps'
];
```

Eine Größe liefert immer `[{ date, value, ...zusatz }]`. Das Diagramm kennt nur `value`; `unit` und `label` gehören der Konfiguration. Der gewählte Chip (`state.metric`, Start: `'maxWeight'`) liegt neben `state.range` im Seiten-State und bleibt beim Reiter-Wechsel erhalten.

## 4. Darstellung

### 4.1 Karte

`CARD` aus `js/utils.js`, wie die übrigen Statistik-Karten. Aufbau von oben nach unten:

1. **Kopfzeile** (Abschnitt 4.2)
2. **Diagramm** (Abschnitt 4.3)
3. **Größen-Leiste** (Abschnitt 4.5)

### 4.2 Kopfzeile

- Links oben die **Großzahl** (`text-kpi`) mit Einheit, z. B. „91 kg“, darunter das **Datum** (`text-label text-muted`, Format `dayMonthShortYear` aus `js/dates.js`, Jahr immer dabei wie in den Bestwerten).
- Standard ist der **letzte Punkt** der Serie. Wird ein Punkt ausgewählt (4.4), zeigen Zahl und Datum diesen Punkt.
- Wiederholungen des Satzes als gedämpfter Zusatz „(x5)“ hinter dem Gewicht, im selben Muster wie in der Bestwerte-Tabelle.
- Zahlenformat wie dort: `toLocaleString('de-DE', { maximumFractionDigits: 2 })`.
- Keine Prozent-Veränderung.

### 4.3 Diagramm

Reines HTML/SVG, keine Chart-Library, Farben nur über Tokens (ADR 0041).

- **Y-Achse:** auf den Wertebereich der Serie gezoomt (nicht bei 0 beginnend), 15 % Polster oben und unten, ca. 4 Gitterlinien mit „schönen“ Tick-Werten (`niceTickStep`), Beschriftung links in einer Spalte von `w-8`. Gepunktete Gitterlinien `border-white/15` plus feste Grundlinie unten. Ticks ohne „k“-Kurzform (Gewichte liegen unter 1000 kg), ganze Zahlen; bei sehr kleinem Wertebereich sind Dezimaltick-Schritte (z. B. 0,5) zulässig, wenn der Schritt unter 1 fällt.
- **X-Achse:** **zeitlich proportional** zwischen Zeitraumbeginn und heute (bzw. erstem und letztem Punkt, siehe Randfälle). Pausen zwischen Trainings sind als Lücken sichtbar. Das ist ein bewusster Unterschied zum Volumen-Chart, dessen Wochen-Perioden gleichmäßig verteilt sind.
- **Linie:** SVG-`<polyline>`, `preserveAspectRatio="none"`, `stroke="currentColor"` mit `text-accent`, `vector-effect="non-scaling-stroke"`, Strichstärke 1,5 wie beim Volumen-Chart.
- **Punkte:** pro Trainingstag ein Punkt. Da das SVG gestreckt wird (`preserveAspectRatio="none"`), werden Punkte **nicht als SVG-`<circle>`** gezeichnet (würden zu Ellipsen verzerrt), sondern als absolut positionierte runde HTML-Elemente über dem SVG (`left`/`top` in Prozent, `rounded-full`, ca. 8 px). Normal gedämpft (`bg-accent-muted`), der ausgewählte Punkt in `bg-accent`, größer.
- **Beschriftung X-Achse:** höchstens 4 Labels, gleiche Randmarge und gleiche Entdoppelung wie im Volumen-Chart. Formatvorschlag je Zeitraum, orientiert an ADR 0023/0026: **3M** Tag und Monatskürzel („15. Aug“), **1J** Monatskürzel mit zweistelligem Jahr („Sep 26“), **Max** nur Jahreszahl („2026“). Die Labels stehen an ihrer zeitlichen Position, mit derselben Randmarge wie im Volumen-Chart.

### 4.4 Interaktion

- **Tippen oder Wischen** über das Diagramm wählt den **nächstgelegenen Punkt** (horizontale Distanz). Kopfzeile und Punkt-Hervorhebung aktualisieren sich sofort, **ohne** das Diagramm neu zu rendern (nur Kopfzeile und Punktklassen werden geändert, gleiche Idee wie bei `positionSegmentedIndicator`).
- Optional (Entscheidung bei der Umsetzung): eine dünne vertikale Hilfslinie am gewählten Punkt in `border-white/15`.
- Beim Loslassen bleibt die Auswahl bestehen. Ein Tipp auf einen leeren Bereich ändert nichts.
- **Konflikt mit der Wisch-zurück-Geste** (`js/swipeBack.js`, ADR 0037): Die Geste startet am linken Rand. Das Diagramm braucht deshalb `touch-action: pan-y`, damit vertikales Scrollen der Seite funktioniert, und die Auswahl-Geste darf im äußeren Randbereich (siehe `swipeBack.js` für die genaue Breite) nicht greifen. Das wird im Browser auf Mobile-Viewport verifiziert.
- Die Auswahl wird beim Wechsel von Zeitraum oder Größe zurückgesetzt (wieder letzter Punkt).
- Bedienbar auch per Tastatur ist nicht Ziel (Touch-App). Das Diagramm erhält `role="img"` mit `aria-label` (z. B. „Maximales Gewicht, 12 Trainingstage, zuletzt 91 kg am 31. Okt 2026“).

### 4.5 Größen-Leiste

- Horizontal scrollbare Reihe von Chips (`overflow-x-auto`, Scrollbalken sind app-weit ausgeblendet, siehe `css/styles.css`), jeder Chip ein `<button type="button">`.
- Chip-Optik nach der Referenz: aktiver Chip mit abgesetztem Pillen-Hintergrund und heller Schrift, inaktive Chips gedämpft ohne Hintergrund. Konkrete Klassen und Tokens werden aus `design-system.md` genommen. Falls dort noch kein passender Stil existiert, wird er mit eigenem Eintrag im Design-System ergänzt, nicht als Einmal-Styling.
- **Start: genau ein Chip, „Maximales Gewicht“, aktiv.** Die Leiste ist von Anfang an sichtbar (Nutzer-Entscheidung), damit sie beim Hinzufügen weiterer Größen nur wächst.
- Chip antippen = `state.metric` setzen, Karte neu zeichnen (Kopfzeile, Diagramm). Wiederantippen des aktiven Chips tut nichts. Wie bei den anderen Reitern wird ein Repaint ohne Layout-Sprung angestrebt (Karte behält ihre Höhe).
- Ein sichtbar angeschnittener letzter Chip (wie in der Referenz) zeigt, dass weitere existieren. Bei einem Chip entfällt das naturgemäß.

### 4.6 Rand- und Leerzustände

| Fall | Verhalten |
|---|---|
| Keine gültigen Daten im Zeitraum | Karte mit Hinweis „Keine Daten im Zeitraum.“ (`text-body text-muted`), Größen-Leiste bleibt sichtbar, Kopfzeile ohne Zahl |
| Genau ein Punkt | Nur der Punkt, keine Linie. Y-Achse um den Wert zentriert (Bereich Wert ± 10 %, mindestens ± 1 kg), X-Position mittig. Kopfzeile zeigt diesen Punkt |
| Alle Werte gleich | Flache Linie in der Mitte, gleiche Y-Zentrierung wie beim einzelnen Punkt |
| Übung ohne jeden Satz | wie „Keine Daten“ |
| Körpergewichts-Übung (nur Gewicht 0) | wie „Keine Daten“, Hinweis bei Bedarf „Kein Gewicht erfasst.“ |
| Max-Zeitraum über viele Jahre | Labels nur Jahreszahlen, Entdoppelung wie im Volumen-Chart |

Heute zählt der laufende Tag mit (anders als beim Wochen-Volumen, wo die laufende Woche ausgeschlossen ist): Ein heute erfasster Satz erscheint sofort im Diagramm.

## 5. Wiederverwendung und Standardisierung

Entscheidung: **gemeinsame Komponente extrahieren und das Volumen-Chart darauf umstellen** (Optik des Volumen-Charts bleibt pixelgleich).

### 5.1 Neues Modul `js/lineChart.js`

Aus `js/views/statistics.js` werden herausgelöst und dort entfernt:

| Heute in `statistics.js` | Neu in `js/lineChart.js` |
|---|---|
| `niceTickStep()` | `niceTickStep()` (exportiert) |
| Y-Domäne/Polster/`topPct`/`ticks`-Berechnung aus `renderVolumeChart()` | `buildYAxis(values, { padRatio, minStep, ... })` → `{ domainMin, domainMax, topPct, ticks }` |
| Auswahl von höchstens 4 Labels, Entdoppelung, Randmarge (`AXIS_LABEL_EDGE_MARGIN_PCT`) | `pickAxisLabels(points, labelOf, ...)` und `labelPct()` |
| Markup: Y-Spalte, Gitterlinien, Grundlinie, `<polyline>`, Label-Zeile | `renderLineChart({ points, yAxis, tickLabel, axisLabels, showDots, selectedIndex })` |

`points` sind `{ xPct, value }`. **Die X-Position liefert der Aufrufer**: das Volumen-Chart verteilt Wochen gleichmäßig nach Index, das neue Diagramm nach Datum. Die Komponente kennt keine Wochen oder Trainingstage. Ebenso kommt `tickLabel(value)` vom Aufrufer (Volumen: „k“-Kurzform, Gewicht: ganze Zahl).

Nicht extrahiert werden Kopfzeile, Zeitraum-Reiter und Berechnungen (MA-Fenster, Wochenserie): Das bleibt chartspezifisch.

Verbindlich beim Umbau:

- `renderVolumeChart()` ruft `renderLineChart()` mit `showDots: false` auf. Die DOM-Struktur und alle Klassen bleiben gleich, damit sich Optik und Verhalten nicht ändern (kein neues Tailwind-CSS nötig für diesen Teil).
- Keine Änderungen an den Berechnungen des Volumen-Charts (ADR 0023/0026 bleiben gültig).
- `niceTickStep` und die Tick-Schleife erhalten Tests (Abschnitt 8), da sie jetzt zwei Charts bedienen.
- Der Satz „Beide Diagramme sind keine generischen Komponenten“ in `design-system.md` (Abschnitt Liniendiagramm) wird durch die Beschreibung der neuen Komponente ersetzt.

### 5.2 Weitere gemeinsam genutzte Bausteine (unverändert)

- `renderRangeControl()`, `renderSegmentedControl()`, `positionSegmentedIndicator()` (`js/utils.js`)
- `CARD` (`js/utils.js`)
- `getRangeStart()`, `computePersonalBests()` (`js/exerciseStats.js`)
- `formatDate` mit `dayMonthShortYear` (`js/dates.js`)
- Zahlenformatierung `formatNumber` der Übungsseite

## 6. Änderungen je Datei

| Datei | Änderung |
|---|---|
| `js/lineChart.js` | **neu**, gemeinsame Liniendiagramm-Bausteine (5.1) |
| `js/exerciseStats.js` | `computeMaxWeightSeries()` |
| `js/views/statistics.js` | Volumen-Chart auf `lineChart.js` umstellen, `niceTickStep` und Label-Logik entfernen |
| `js/views/statistics-exercise-detail.js` | Diagramm-Karte, Größen-Leiste, `state.metric`, Auswahl-Handler in `wireEvents()` |
| `tests/exerciseStats.test.js`, `tests/lineChart.test.js` | neue Tests (Abschnitt 8) |
| `index.html` / `js/**` | neue Tailwind-Klassen → `npm run build:css`, `css/tailwind.css` einchecken |
| `tailwind.config.js` | nur falls ein neues Token nötig wird, dann auch `design-system.md` |
| `sw.js` | `js/lineChart.js` in `APP_SHELL`, `CACHE_NAME` hochzählen |
| `docs/features.md`, `docs/design-system.md`, `docs/architecture.md` | siehe Abschnitt 9 |

## 7. Offene Punkte für die Umsetzung

Keine Blocker, aber bei der Umsetzung zu entscheiden und im ADR festzuhalten:

1. Vertikale Hilfslinie am gewählten Punkt: ja oder nein.
2. Exakte Chip-Optik und -Höhe (aus dem Design-System ableiten oder ergänzen).
3. Randbreite, in der die Auswahl-Geste der Wisch-zurück-Geste weicht.
4. Dezimale Y-Ticks bei sehr kleinem Wertebereich (z. B. Gewichte zwischen 20 und 22,5 kg).

## 8. Tests und Verifikation

**`tests/exerciseStats.test.js`** (`computeMaxWeightSeries`):

- ein Punkt pro Trainingstag, aufsteigend sortiert
- höchstes Gewicht gewinnt, bei Gleichstand mehr Reps
- Sätze mit Gewicht 0 oder 0 Reps zählen nicht, ein Tag nur mit solchen Sätzen liefert keinen Punkt
- Zeitraumgrenzen 3M / 1J / Max inkl. Tage in der Zukunft und genau am Grenztag
- leere Historie → leere Serie
- Konsistenz: Maximum der Serie = `computePersonalBests(...).weight.weight`

**`tests/lineChart.test.js`** (reine Funktionen):

- `niceTickStep` (1/2/5 × 10ⁿ, `minStep`)
- `buildYAxis`: Polster, Einzelwert, identische Werte, Tick-Anzahl
- `pickAxisLabels`: ≤ 6 Punkte zeigt alle, sonst 4, Entdoppelung, ein einzelnes Label mittig

**Vorab:** `npm test` und `npm run check` vor und nach dem Refactoring. Das Volumen-Chart darf sich nicht verändern.

**Im Browser** (Desktop- und Mobile-Viewport, Service Worker und Caches vorher leeren):

- 3M / 1J / Max wechseln, Linie, Punkte und Labels passen zum Zeitraum
- Punkt antippen und wischen, Kopfzeile folgt, Seite scrollt vertikal weiter
- Wisch vom linken Rand geht weiterhin zurück
- Übung ohne Daten, mit einem Punkt, mit identischen Werten
- Volumen-Chart im Übersicht-Reiter **unverändert** (Vorher-Nachher-Vergleich per Screenshot)

## 9. Dokumentation bei der Umsetzung

Nach den Konventionen aus `CLAUDE.md`:

- **ADR (neu, fortlaufend, Status „Gültig“):** Entscheidungen: gemeinsame Linien-Komponente statt zweier Eigenbauten, Punkt pro Trainingstag mit zeitproportionaler X-Achse, Auswahl über Tippen/Wischen mit Punkten (abweichend von ADR 0026, das Punkte nur für das Volumen-Chart entfernt hat), Größen-Konfiguration. Verweis auf [ADR 0023](../decisions/0023-volumen-chart-zeitraum-reiter.md) und [ADR 0026](../decisions/0026-volumen-chart-eine-datenreihe.md). Deren Status bleibt „Gültig“, da das Volumen-Chart fachlich unverändert ist.
- **`docs/features.md`:** Beschreibung der Diagramm-Karte im Abschnitt zur Statistik-Übungsseite, die bisher nur Zeitraum-Auswahl und Bestwerte nennt.
- **`docs/design-system.md`:** Abschnitt „Liniendiagramm“ (gemeinsame Komponente, Punkte als HTML-Elemente, Größen-Chips).
- **`docs/architecture.md`:** neues Modul `js/lineChart.js`.
- **`docs/CHANGELOG.md`:** kurzer Eintrag.
- Vor dem Commit `npm run check` und `npm test`.
