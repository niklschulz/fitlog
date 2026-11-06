# Statistik-Tab — Spezifikation (Entwurf)

> Ursprüngliche Spezifikation des Kopfbereichs und der Reiter-Zeile. Der Tab selbst ist inzwischen umgesetzt; den aktuellen Funktionsumfang beschreibt [features.md](../features.md#statistik-jsviewsstatisticsjs), die Entscheidungen dazu [ADR 0023](../decisions/0023-volumen-chart-zeitraum-reiter.md), [0026](../decisions/0026-volumen-chart-eine-datenreihe.md), [0027](../decisions/0027-frequenz-pro-muskel.md) und [0028](../decisions/0028-muskelgruppen-sheet.md).

## Status

**Umgesetzt:**
- h1 "Statistik" + Reiter-Zeile ("Übersicht"/"Übungen"), Segmented Control nach `js/utils.js` extrahiert (s. [CHANGELOG](../CHANGELOG.md) und [design-system.md (Verlauf)](../archiv/design-system-verlauf.md), Sechsundsiebzigste Iteration)
- Erstes Feature im Übersicht-Reiter: "Workouts pro Woche" (Zähler-Zeile + Balkendiagramm), s. [features.md](../features.md) und design-system.md, Siebenundsiebzigste Iteration. Details zur Zähl-Definition ("Tage mit ≥1 Satz" statt roher `workouts`-Zeilen), Zeitzone und `WEEKLY_GOAL`-Konstante dort dokumentiert

- Reiter „Übersicht“: außerdem Volumen-Chart (3M/1J/Max) und Frequenz pro Muskelgruppe samt Muskelgruppen-Sheet, s. features.md
- Reiter „Übungen“: Favoritenliste mit „Alle Übungen“-Sheet und Übungs-Seite (`js/views/statistics-exercise-detail.js`, Reiter Statistik/Verlauf/Info), s. features.md

## 1. Kopfbereich — Überschrift "Statistik"

Identisch zum bestehenden Muster auf jedem Haupt-Tab (z. B. "Workout" in `js/views/workout.js:370`):

```html
<h1 class="text-screen-title">Statistik</h1>
```

- Nur ein reines `<h1>` mit der einzigen Klasse `text-screen-title` — keine eigene Komponente, kein Wrapper.
- Token `text-screen-title` (`tailwind.config.js`, gespiegelt in [design-system.md](../design-system.md)): **21px / font-weight 700 / line-height 1.2**.
- Farbe wird nicht durch die Klasse selbst gesetzt, sondern über `text-ink` (`#F5F5F5`) vom `<body>` vererbt.
- Font-Family global `font-sans` (`-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`).
- Umgesetzt in `js/views/statistics.js`.

## 2. Reiter-Zeile (Segmented Control)

Darunter eine Reiter-Zeile nach dem gleichen visuellen Muster wie auf der Übungsdetailseite, mit eigenen Labels:

- **"Übersicht"**
- **"Übungen"**

(Zwei Reiter statt der drei auf der Übungsdetailseite — dort "aktueller Tag" / "Verlauf" / "Statistik".)

### Markup-/Klassenmuster

```html
<div class="bg-surface rounded-full p-1 flex gap-1">
  <button type="button" class="segmented-tab tap-feedback flex-1 rounded-full py-2 min-h-[36px] text-label bg-raised text-ink">Übersicht</button>
  <button type="button" class="segmented-tab tap-feedback flex-1 rounded-full py-2 min-h-[36px] text-label text-muted">Übungen</button>
</div>
```

| Element | Klassen | Bedeutung |
|---|---|---|
| Track | `bg-surface rounded-full p-1 flex gap-1` | Hintergrundleiste `#252525`, volle Pille, 4px Innenabstand |
| Segment (Basis) | `segmented-tab tap-feedback flex-1 rounded-full py-2 min-h-[36px] text-label` | gleich breite Segmente, 36px Mindesthöhe |
| Aktiv | `bg-raised text-ink` | Hintergrund `#2A2A2A`, Text `#F5F5F5` |
| Inaktiv | `text-muted` | Text `#9B9BA1`, kein eigener Hintergrund |
| — | kein `border` | app-weit bewusst keine Trennlinien, nur Hintergrundkontrast |

- `text-label` = 11.5px / font-weight 600 / letter-spacing 0.6px (identisch zur Bottom-Nav-Beschriftung).
- Referenz in [design-system.md](../design-system.md) (Abschnitt "Segmented Control", Komponenten-Muster).

### Wiederverwendbarkeit — umgesetzt

Entscheidung: Extrahieren statt duplizieren. `renderSegmentedControl(tabs, activeKey)` liegt jetzt in `js/utils.js`, parametrisiert über eine `{key, label}`-Liste plus den aktiven Key. `workout-exercise-detail.js` und `statistics.js` importieren und nutzen dieselbe Funktion; das Wiring (Klick auf `.segmented-tab`, `data-tab` auslesen, `paint()`) bleibt jeweils in der aufrufenden View, da jede eigenen State hat.

## Noch offen / folgt

Die früher hier gelisteten Punkte „Inhalte der beiden Reiter“ und „Datenquelle(n), Interaktionen, Leerzustände“ sind umgesetzt (s. Status oben und `js/views/statistics.js`). Tatsächlich offen ist nur der 1RM in der Tabelle „Persönliche Bestwerte“ der Übungs-Seite: Er bleibt leer, bis die Berechnung festgelegt ist (Kommentar in `js/views/statistics-exercise-detail.js`); vorgemerkt in [features.md](../features.md#vorgemerkte-noch-nicht-spezifizierte-erweiterungen).
