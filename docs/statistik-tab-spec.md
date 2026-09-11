# Statistik-Tab — Spezifikation (Entwurf)

> Arbeitsdokument, wird schrittweise ergänzt. Noch kein ADR — sobald der volle Funktionsumfang steht, ggf. als ADR in `decisions/` festhalten und hier verlinken.

## Status

**Umgesetzt:**
- h1 "Statistik" + Reiter-Zeile ("Übersicht"/"Übungen"), Segmented Control nach `js/utils.js` extrahiert (s. [CHANGELOG](CHANGELOG.md) und [design-system.md](design-system.md), Sechsundsiebzigste Iteration)
- Erstes Feature im Übersicht-Reiter: "Workouts pro Woche" (Zähler-Zeile + Balkendiagramm), s. [features.md](features.md) und design-system.md, Siebenundsiebzigste Iteration. Details zur Zähl-Definition ("Tage mit ≥1 Satz" statt roher `workouts`-Zeilen), Zeitzone und `WEEKLY_GOAL`-Konstante dort dokumentiert

Übungen-Reiter weiterhin reiner Platzhalter.

## 1. Kopfbereich — Überschrift "Statistik"

Identisch zum bestehenden Muster auf jedem Haupt-Tab (z. B. "Workout" in `js/views/workout.js:370`):

```html
<h1 class="text-screen-title">Statistik</h1>
```

- Nur ein reines `<h1>` mit der einzigen Klasse `text-screen-title` — keine eigene Komponente, kein Wrapper.
- Token `text-screen-title` (`index.html`, inline `tailwind.config`, gespiegelt in [design-system.md](design-system.md)): **21px / font-weight 700 / line-height 1.2**.
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
- Referenz in [design-system.md](design-system.md) (Abschnitt "Segmented Control", Komponenten-Muster).

### Wiederverwendbarkeit — umgesetzt

Entscheidung: Extrahieren statt duplizieren. `renderSegmentedControl(tabs, activeKey)` liegt jetzt in `js/utils.js`, parametrisiert über eine `{key, label}`-Liste plus den aktiven Key. `workout-exercise-detail.js` und `statistics.js` importieren und nutzen dieselbe Funktion; das Wiring (Klick auf `.segmented-tab`, `data-tab` auslesen, `paint()`) bleibt jeweils in der aufrufenden View, da jede eigenen State hat.

## Noch offen / folgt

- Inhalte der beiden Reiter ("Übersicht", "Übungen")
- Datenquelle(n), Interaktionen, Leerzustände
