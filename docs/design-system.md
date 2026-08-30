# Design-System

Lebende Referenz für alle visuellen Tokens und Komponenten-Muster in Fitlog. Entstanden aus einer Design-Überarbeitung (2026-08-30) auf Basis einer Screenshot-Analyse einer anderen Gym-Tracker-App — übernommen wurden ausschließlich optische Prinzipien (Farben, Formen, Abstände, Typografie), keine Funktionalität, Texte, Icons oder Branding der Referenz.

**Wo die Tokens tatsächlich leben:** Nicht in einer `tailwind.config.js`-Datei, wie in einem klassischen Tailwind-Projekt üblich. Fitlog nutzt bewusst keinen Build-Schritt (s. [ADR 0002](decisions/0002-tailwind-play-cdn.md)) — Tailwind läuft über die Play-CDN. Alle Tokens sind im inline `tailwind.config`-Objekt in [`index.html`](../index.html) hinterlegt. Das ist der einzige Ort, an dem sie geändert werden müssen.

## Farben

| Tailwind-Klasse | Wert | Verwendung |
|---|---|---|
| `bg-base` | `#121212` | App-Hintergrund |
| `bg-surface` | `#1E1E1E` | Karten, Formulare, Listenzeilen |
| `bg-raised` | `#2A2A2A` | Aktiver Tab-Hintergrund, sekundäre Buttons |
| `bg-accent` / `text-accent` | `#A3E635` | Primäre Buttons, aktive Zustände, ausgewählte Chips |
| `text-ink` | `#F5F5F5` | Haupttext |
| `text-muted` | `#9B9BA1` | Labels, Meta-Infos, sekundärer Text |
| `text-base` | `#121212` (= `bg-base`) | Text auf Accent-Hintergrund (dunkel auf hell) |

**Keine Trennlinien.** Abgrenzung läuft ausschließlich über Hintergrundkontrast, nicht über Border-Linien: Inputs nutzen `bg-base` innerhalb einer `bg-surface`-Karte, keine `border`-Utilities. Destruktive Aktionen (Löschen) bleiben bei `text-red-400` / `bg-red-600` — das ist absichtlich **nicht** Teil dieses Token-Systems, da im Briefing nicht spezifiziert; unverändert aus dem bisherigen Stand übernommen.

## Typografie

| Tailwind-Klasse | Größe/Gewicht | Verwendung |
|---|---|---|
| `text-kpi` | 34px / 700 / line-height 1.1 | Große Kennzahlen (aktuell nirgends im Produkt verwendet, s. "Nicht umgesetzt" unten) |
| `text-screen-title` | 21px / 700 | Screen-Überschriften (`<h1>` auf jedem Tab) |
| `text-card-title` | 16px / 600 | Karten-/Listenzeilen-Titel (Übungsname, Routinenname, Datum im Verlauf) |
| `text-body` | 14px / 400 | Standard-Fließtext |
| `text-label` | 11.5px / 600 / letter-spacing 0.6px | Kleine Labels — kombiniert mit `uppercase` für Sektions-Überschriften ("ÜBUNGEN", "SÄTZE"), ohne `uppercase` für Formularfeld-Labels und Fußnoten |
| `font-sans` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif` | Global auf `<body>` — auf iOS ohnehin identisch mit dem Systemfont, hier explizit dokumentiert statt implizit |

**Abweichung von der Spezifikation:** `text-label` bündelt Größe/Gewicht/Tracking, aber **nicht** `uppercase` — das bleibt eine separate Utility-Klasse, je nach Einsatzort angewendet oder weggelassen (ein Formularfeld-Label wie "Gewicht (kg)" soll nicht in Großbuchstaben erscheinen, eine Sektions-Überschrift wie "SÄTZE" schon).

## Radien

| Tailwind-Klasse | Wert | Verwendung |
|---|---|---|
| `rounded-card` | 18px | Größere Container: Formulare, Panels, größere Listenzeilen (Übungen, Routinen, Trainings im Verlauf) |
| `rounded-btn` | 13px | Buttons, Inputs, kompakte Listenzeilen (Sätze, Routine-Übungen-Zeilen) |
| `rounded-sheet` | 26px | Definiert, aktuell **nicht verwendet** (kein Bottom-Sheet im Produkt, s. unten) |
| `rounded-badge` | 11px | Definiert, aktuell **nicht verwendet** (keine Badges im Produkt) |
| `rounded-full` | Tailwind-Standard | Pillenförmige Elemente: Bottom-Nav, Exercise-Chips, "+ Weitere Übung" |

Die Wahl "Karte vs. Button" für Listenzeilen ist keine strikte Regel aus dem Briefing, sondern eine Auslegung: größere, mehrzeilige oder umfangreichere Zeilen (Übungsliste, Routinenliste, Trainingsverlauf-Liste) bekommen `rounded-card`, kompaktere einzeilige Zeilen (Satz-Einträge, Routine-Übungen im Editor) `rounded-btn`.

## Abstände

Kein eigenes Spacing-Token nötig: Tailwinds Standard-Spacing-Skala (0.25rem-Schritte = 4px-Raster) deckt sich bereits exakt mit der geforderten 4px-Grundraster-Vorgabe. Durchgängig verwendet: `gap-2`/`gap-3` (8/12px) zwischen Listenelementen, `p-4`/`px-4 py-3` (16px) als Karten-Innenabstand, `gap-4`/`gap-6` (16/24px) zwischen Sektionen.

## Navigation

Freischwebende Bottom-Nav (`#bottom-nav` in `index.html`): `fixed left-4 right-4 bottom-[calc(8px+env(safe-area-inset-bottom))]`, `bg-surface`, `rounded-full`. Aktiver Tab bekommt über `.nav-btn.active` (in `css/styles.css`, da Tailwinds Play-CDN keine eigene `:has()`-freie Möglichkeit bietet, JS-gesetzte Klassen mit zwei Eigenschaften gleichzeitig zu verknüpfen) `background-color: #2A2A2A` + `color: #A3E635`. Inaktive Tabs: `text-muted`, kein Hintergrund.

**Icons:** Fünf eigene, minimale Outline-SVGs (Hantel/Training, Liste/Übungen, Kalender/Routinen, Uhr/Verlauf, Person/Profil) direkt inline in `index.html`, `stroke-width="1.75"`, `22×22px`. Bewusst **nicht** aus einer Bibliothek wie Lucide kopiert (Briefing verlangt explizit offene/eigene Icons, keine Assets der Referenz-App) — stattdessen selbst im gleichen minimalistischen Outline-Stil konstruiert, um jede Lizenz-/Fidelity-Frage zu vermeiden.

Content-Bereich (`#view-container`) hat `padding-bottom: calc(88px + env(safe-area-inset-bottom))`, damit Inhalte nicht hinter der freischwebenden Nav verschwinden.

## Komponenten-Muster

- **Primärer Button:** `bg-accent text-base font-bold rounded-btn` (z. B. "Training starten", "Speichern")
- **Sekundärer Button:** `bg-raised text-ink font-semibold rounded-btn` (z. B. "Training beenden")
- **Destruktiver Button:** `bg-red-600 text-white font-bold rounded-btn` (z. B. "Profil entfernen") — unverändert, nicht Teil der Token-Spezifikation
- **Destruktiver Link (inline):** `text-red-400 text-body`, kein Hintergrund (z. B. "Übung löschen", "✕" zum Satz-Löschen)
- **Karte/Formular:** `bg-surface rounded-card p-4`
- **Input:** `bg-base rounded-btn px-3 py-3 text-ink`, kein Border
- **Chip (Auswahl):** `rounded-full px-4 py-2`, ausgewählt `bg-accent text-base`, unausgewählt `bg-surface text-ink`
- **Listenzeile:** `bg-surface rounded-card` (bzw. `rounded-btn` bei kompakten Zeilen) `px-4 py-3`

## Bewusst nicht umgesetzt

Gemäß Briefing-Vorgabe ("nur bestehende Screens angleichen, keine Vorwegnahme") wurden folgende in der Spezifikation beschriebene Komponenten **nicht** gebaut, weil es im aktuellen Fitlog-Funktionsumfang keine Entsprechung gibt:

- **Segmented Control** — keine Stelle im Produkt, die ein Segment-Toggle braucht
- **Bottom-Sheet** — alle "Panels" in Fitlog sind inline-expandierende Bereiche, keine echten Sheets von unten. `rounded-sheet`-Token ist vorbereitet, falls später eins gebraucht wird
- **Diagramme** (Gitterlinien, Balken/Linien) — Fitlog hat keine Charts
- **Checkmark-Auswahllisten** — kommt der Exercise-Chip-Auswahl in `training.js` am nächsten (farblich markiert statt Checkmark), aber keine eigene Komponente
- **Große Kennzahl (`text-kpi`)** — Token ist definiert, aber aktuell nirgends verwendet (kein Statistik-Screen vorhanden)

Falls diese Screens/Komponenten später tatsächlich gebaut werden, sind die zugehörigen Tokens (`rounded-sheet`, `rounded-badge`, `text-kpi`) bereits vorbereitet.
