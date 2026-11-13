# Design-System

Geltende Referenz für alle visuellen Tokens und Komponenten-Muster in Fitlog. Im Zweifel gilt der Code. Der historische Verlauf (Iterationen, verworfene Varianten, entfernte Features) steht in [archiv/design-system-verlauf.md](archiv/design-system-verlauf.md); Begründungen einzelner Entscheidungen in den [ADRs](decisions/) und im [Changelog](CHANGELOG.md).

Visuelle Prinzipien (Farben, Formen, Abstände, Typografie) sind eigenständig entworfen; von Referenz-Apps wurde nichts an Funktionalität, Texten, Icons oder Branding übernommen.

**Tokens leben in [`tailwind.config.js`](../tailwind.config.js)** (ADR 0030). Änderung dort, danach `npm run build:css` und `CACHE_NAME` hochzählen. Wiederverwendete Klassen-Ketten stehen als Konstanten in `js/utils.js`; Glas-, Sheet- und Animations-Styles in `css/styles.css`.

## Farben

| Klasse | Wert | Verwendung |
|---|---|---|
| `bg-base` | `#121212` | App-Hintergrund, Inputs auf Karten |
| `bg-surface` | `#252525` | Karten, Sheets, Listenzeilen, Segmented-Control-Track |
| `bg-raised` | `#2A2A2A` | Sekundäre Buttons, Stepper-Buttons, Hervorhebungs-Band ausgewählter Sätze |
| `bg-highlight` | `#404040` | Aktives Segment der Segmented Control |
| `bg-popup` | `#363636` | Deckendes Dropdown-Popup über Listen (Muskelgruppen-Filter im Übungs-Sheet); entspricht `rgba(255,255,255,0.08)` über `bg-surface` |
| `bg-accent` / `text-accent` | `#B5EB98` | Primäre Buttons, aktive/ausgewählte Zustände, Textlinks |
| `bg-accent-muted` | `#637456` | Gedimmte, deckende Akzentfarbe: nicht aktuelle Wochen im Balkendiagramm |
| `border-divider` / `divide-divider` | `#1A1A1A` | Trennlinien in Statistik-Karten (bewusst dunkler als die Diagramm-Gitterlinien `border-white/15`) |
| `text-ink` | `#F5F5F5` | Haupttext |
| `text-muted` | `#9B9BA1` | Labels, Meta-Infos |
| `text-base` | `#121212` | Text auf Akzentfläche |
| `text-red-400` | Tailwind-Standard | Destruktive Aktionen; bewusst kein eigenes Token |
| `bg-plate-red` / `-blue` / `-yellow` / `-green` / `-white` / `-black` | `#D23B3B` / `#2F6FD6` / `#E8C62E` / `#2FA24F` / `#F2F2F2` / `#1E1E1E` | Scheiben im Scheiben-Rechner (olympisch: 25/20/15/10/5 kg, dazu 2,5 und 1,25 kg schwarz), s. ADR 0044. In der SVG-Grafik über `var(--color-plate-*)`; auf hellen Scheiben (gelb, weiß) steht dunkler Text (`text-base`), alle Scheiben haben einen Rand `ink/30` bzw. `ink/40` |
| `bg-white/[0.08]` | 8 % Weiß | Aufgehellte Flächen auf Sheets/Karten (Inputs, Chips, Icon-Kreise). Immer in Arbitrary-Schreibweise, nicht `bg-white/8` |

Regeln:
- **Keine Trennlinien als Abgrenzung.** Abgrenzung läuft über Hintergrundkontrast; Inputs sind `bg-base` auf `bg-surface`-Karten. Ausnahmen: `border-divider` in Statistik-Karten und der Kreis `border-2 border-accent` für den heutigen Tag im großen Kalender.
- **Farben stehen nur einmal, in `tailwind.config.js`.** Der Build erzeugt daraus pro Farbe zwei CSS-Variablen (ADR 0041): `--color-<name>` (Hex, für JS und einfache CSS-Werte) und `--rgb-<name>` (`r g b`, für Transparenz in CSS). Beispiel: `background: rgb(var(--rgb-surface) / 0.55)` (halbtransparentes `bg-surface`), `color: var(--color-muted)`. Keine Hex- oder `rgba()`-Kopien in `css/styles.css` oder `js/`. Ausnahme: reines Weiß und Schwarz für neutrale Overlays und Schatten (`rgba(255, 255, 255, 0.12)`, `rgba(0, 0, 0, 0.35)`).
- `text-accent-soft` (`#E5F3DE`): leicht grün getöntes Weiß für Icon/Text auf Glas-Akzent-Buttons; bisher nur als `var(--color-accent-soft)` in `css/styles.css` im Einsatz.

## Typografie

| Klasse | Größe / Gewicht / Zeilenhöhe | Verwendung |
|---|---|---|
| `text-kpi` | 21px / 700 / 1.2 | Große Kennzahlen (Statistik) |
| `text-screen-title` | 21px / 700 / 1.2 | Screen-Überschrift (`<h1>`) |
| `text-card-title` | 16px / 600 / 1.3 | Karten-/Listenzeilen-Titel, Sheet-Titel |
| `text-body` | 14px / 400 / 1.2 | Fließtext; zusätzlich `hyphens: auto` (`css/styles.css`, braucht `lang="de"`) |
| `text-label` | 11.5px / 600 / 1.2, Tracking 0.6px | Kleine Labels, Achsen, Bottom-Nav; mit `uppercase` für Sektions-Überschriften, ohne für Fußnoten |
| `text-label-large` | 14px / 700 / 1.3 | Formularfeld-Labels und Karten-Überschriften |
| `font-sans` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif` | Global auf `<body>` |

`uppercase` ist nie Teil von `text-label`, sondern wird je Einsatzort gesetzt. Inputs haben global `font-size: 16px` (sonst zoomt iOS beim Fokus).

## Radien

| Klasse | Wert | Verwendung |
|---|---|---|
| `rounded-card` | 4px | Größere Container: Karten, Formulare, Segmented Control, Roster-Einträge |
| `rounded-btn` | 4px | Buttons, Inputs, kompakte Listenzeilen, Dropdown |
| `rounded-sheet` | 26px | Bottom-Sheets, Action Sheet, Kontextmenüs |
| `rounded-full` | Tailwind | Bottom-Nav, Chips, Icon-Buttons, Satz-Kreise |
| `rounded-lg` | 8px (Tailwind) | Bewusst eckige Elemente: Tageszahl im Wochenstreifen, Stepper-Buttons |

Größere, mehrzeilige Zeilen bekommen `rounded-card`, kompakte einzeilige `rounded-btn`. Das Token `rounded-badge` (11px) ist definiert, aber ungenutzt.

## Abstände

Tailwinds Standardskala (4px-Raster), kein eigenes Token. Üblich: `gap-2`/`gap-3` zwischen Listenelementen, `p-4` als Karten-Innenabstand, `gap-4`/`gap-6` zwischen Sektionen.

## Navigation

**Bottom-Nav** (`#bottom-nav`, `index.html`): freischwebend, `fixed left-4 right-4 bottom-[calc(8px+env(safe-area-inset-bottom))] rounded-full`, `z-20`. Drei Tabs (Workout, Statistik, Profil) mit eigenen Outline-SVGs (`stroke-width="1.75"`, 26×26px, selbst gezeichnet, keine Icon-Bibliothek). Aktiv: `.nav-btn.active` färbt in Akzent; der Hintergrund kommt vom gleitenden `#nav-indicator`. Inaktiv: `text-muted`.

**Glass-Effekt** (`#bottom-nav`, `.icon-btn-glass`, `.popup-glass` in `css/styles.css`):

| Eigenschaft | Wert |
|---|---|
| `background` | `rgba(37, 37, 37, 0.55)` |
| `backdrop-filter` (mit `-webkit-`) | `blur(20px) saturate(160%)` |
| `border` | `1px solid rgba(255, 255, 255, 0.12)` |
| `box-shadow` | `inset 0 1px 0 rgba(255,255,255,0.15)` plus Schwebe-Schatten (`0 8px 24px rgba(0,0,0,0.35)`; Icon-Buttons `0 4px 12px`) |
| `#nav-indicator` | `rgba(42, 42, 42, 0.6)`, gleicher Blur |

Der Glass-Look ist Standard für **Navigation** (Bottom-Nav, Icon-Buttons mit Navigations-Aktion) sowie für Kontextmenüs und Action Sheet. Karten, normale Buttons und Bottom-Sheets bleiben deckend. Kein SVG-Verzerrungsfilter (Safari unterstützt nur `blur()`).

**Scrims:** `.nav-scrim` (Verlauf `#121212` hinter der Nav, 140px, `z-index: 10`) und `.top-scrim` (dunkler Verlauf unter der transparenten Statusleiste, ragt 120px über den Rand). Beide `position: fixed`, `pointer-events: none`, unter Nav und Sheets (`z-index: 10`). Gescrollt wird in `#view-container`, nicht im Dokument; der Container hat `padding-bottom: calc(88px + env(safe-area-inset-bottom))`.

## Komponenten-Muster

Konstanten aus `js/utils.js` werden in Templates interpoliert (`${BTN_PRIMARY}`); Views ergänzen nur Layout-Klassen.

- **Primärer Button:** `BTN_PRIMARY` = `bg-accent text-base font-semibold rounded-btn`
- **Sekundärer Button:** `BTN_SECONDARY` = `bg-raised text-ink font-semibold rounded-btn` (Ändern/Löschen auf der Übungs-Detailseite, Notiz-Button)
- **Textlink (Aktion):** `TEXTLINK_ACTION` = `text-accent text-body font-medium`, kein Hintergrund, kein "+" vor dem Label
- **Destruktiver Link:** `DESTRUCTIVE_LINK` = `text-red-400 text-body`
- **Karte:** `CARD` = `bg-surface rounded-card p-4`
- **Listenzeile:** `LIST_ROW` = `bg-surface rounded-btn px-4 py-3` (kompakt); große Zeilen `bg-surface rounded-card` (Roster-Karte)
- **Input:** `INPUT` = `rounded-btn px-3 py-3 text-ink min-h-[44px]`, Hintergrund separat: `bg-base` auf einer Karte, `bg-white/[0.08]` direkt auf einer Sheet-Fläche (auch für Karten auf Sheets)
- **Formularfeld-Label:** `text-label-large` über dem Feld, Label und Feld in eigenem `flex flex-col gap-2`-Wrapper
- **Karten-Überschrift:** `text-label-large text-muted` über einer Karte ohne Eingabefeld (Statistik, Profil)
- **Chip:** `rounded-full px-3 py-1 text-body`; ausgewählt `bg-accent text-base`, sonst `bg-white/[0.08] text-ink`; deaktiviert `opacity-40 pointer-events-none` plus `disabled` (Muskel-Auswahl im Neue-Übung-Sheet)
- **Icon-Button (Glass):** `.icon-btn-glass` (44×44px, Kreis, Glass-Hintergrund; daneben `tap-feedback text-ink`). Variante `.icon-btn-glass-accent` zusätzlich am Element für die eine Bestätigungs-Aktion (Haken im Neue-Übung-/Notiz-Sheet); `:disabled` fällt auf neutrales Glas zurück. Beides bewusst als CSS-Klassen, nicht als Tailwind-Utilities
- **Bottom-Sheet:** `.bottom-sheet` mit `fixed left-0 right-0 bottom-0 rounded-sheet`, Hintergrund `bg-surface` (Notiz-Sheet `bg-base`), oben 8px unter der Safe-Area. Backdrop `.bottom-sheet-backdrop` (`fixed inset-0 bg-black/50`). Kopfzeile `grid grid-cols-[44px_1fr_44px]` (oder `grid-cols-3` bei kurzen Titeln): links `.icon-btn-glass` zum Schließen, Mitte Titel (`text-card-title`, zugleich Ziehgriff fürs Drag-to-Dismiss), rechts optionale Aktion oder leerer Platzhalter. Ausnahme Muskelgruppen-Sheet: Schließen rechts (ADR 0028). Mechanik (Scroll-Sperre, Nav-z-index, Drag, `SHEET_CLOSE_ANIMATION_MS = 220`) in `js/sheet.js`; Sheets können gestapelt werden (höhere z-Ebene für das obere)
- **Action Sheet:** `showActionSheet({ message, actionLabel, cancelLabel })` in `js/actionSheet.js`, gibt ein Promise zurück. Zwei abgesetzte `.popup-glass rounded-sheet`-Karten am unteren Rand: Nachricht plus rote Aktion (`text-red-400 font-semibold`, 56px), darunter "Abbrechen". Standard für alle Bestätigungen, nie natives `confirm()` (ADR 0029)
- **Segmented Control:** `renderSegmentedControl(tabs, activeKey)` in `js/utils.js`: `bg-surface rounded-card` als Track ohne Padding, gleich breite Segmente (`text-label`, aktiv `text-ink`, sonst `text-muted`), aktives Segment als gleitendes `.segmented-control-indicator` (`bg-highlight`). Indikator-Animation über `measureSegmentedIndicatorRect()` (vor `paint()`) und `positionSegmentedIndicator()` (danach). Beide finden nur die erste `.segmented-control` im übergebenen Container, bei mehreren auf einer Seite je Control ein Wrapper mit eigener `id`. Zeitraum-Variante: `renderRangeControl(id, activeKey)` mit `RANGE_TABS` (3M/1J/Max), `w-36`
- **Stepper:** zwei `.stepper-btn` (`w-8 h-8 rounded-lg bg-raised`, Trefferfläche per `::after` auf 44px erweitert) links und rechts eines frei editierbaren `bg-base rounded-btn`-Felds (Gewicht/Reps auf der Übungs-Detailseite)
- **Dropdown-Pill:** `bg-surface rounded-btn pl-4 pr-3 py-3 min-h-[44px]`, Label links, `renderDropdownIcon()` rechts (Chevron, morpht zu X bei geöffnetem Popup). Popup als absolutes Overlay direkt darunter (`.routine-picker-popup` mit Pop-In/Pop-Out, unsichtbarer Backdrop schließt). Einsatz: Routine-Auswahl im Workout-Tab, Muskelgruppen-Filter im Übungs-Sheet
- **Kontextmenü:** gleiche Popup-Mechanik, ausgelöst vom "⋮"-Icon-Button (`min-w-[44px] min-h-[44px] text-muted`). Popup `.popup-glass rounded-sheet p-1 min-w-[190px]`, `absolute right-0 top-0` (überlagert die Karte), Einträge `min-h-[44px]`. Popup ist Geschwister der Karte, nicht Kind (sonst schneiden deren Ecken es ab). Einsatz: `renderExerciseRosterMenu()`, `renderRoutinesSheetMenu()` in `js/views/workout.js`
- **Satz-Liste (Timeline):** `renderSetTimelineRow()` in `js/utils.js`: Nummern-Kreis (`w-6 h-6 rounded-full bg-base text-muted`) plus Verbindungslinie (`w-0.5 bg-white/10`), Inhalt in gleich hoher `h-6`-Box. Auf der Detailseite sitzen die Zeilen direkt auf dem Seitenhintergrund; die Auswahl zeigt ein bildschirmbreites `bg-raised`-Band dahinter. Zeilen selbst haben kein `tap-feedback`
- **Gewicht/Reps-Paar:** `renderSetValues()`: feste, rechtsbündige Zahlen-Boxen (`w-16` / `w-8`), Einheit (`kg` / `Reps`, `text-muted`) direkt dahinter, so dass Zeilen an einer Kante stehen. Notation immer getrennt beschriftet ("35 kg", "10 Reps")
- **PR-Badge:** `renderPRBadge(type)` / `renderPRIcon()` in `js/utils.js`: Kreis `w-6 h-6 rounded-full bg-white/[0.08]` mit Inline-SVG in `text-accent`, Label `text-label text-muted uppercase` (unter 360px Breite ausgeblendet), `role="img"` plus `aria-label`. Fachliche Regeln: ADR 0025
- **Notiz:** `renderNote()` / `renderNoteIcon()` in `js/utils.js`; Eingabe im Notiz-Sheet (`js/noteSheet.js`)
- **Button-Zeile der Übungs-Detailseite:** Speichern (`flex-[3]`), Löschen (`flex-[3]`), Scheiben-Rechner und Notiz als Icon-Buttons (`flex-1 min-w-[44px]`, `BTN_SECONDARY`, `renderPlateIcon()` bzw. `renderNoteIcon()`)
- **Scheiben-Rechner-Sheet:** `js/plateSheet.js`, Hülle wie das Notiz-Sheet (✕ links, Ziehgriff, ✓ `icon-btn-glass-accent` rechts), aber inhaltshoch statt volle Höhe (`top: auto`), `z-52/53`, im `#view-container` wie das Notiz-Sheet. Grafik: Inline-SVG mit fester `viewBox` in `bg-surface rounded-card` (Größe unabhängig von der Scheibenzahl, der Schalter "Ungleich beladen" steht unten links in der Karte: Track `w-10 h-6 rounded-full`, an (ungleich) `bg-accent`, aus `bg-highlight`), bei ungleicher Beladung aktive Seite mit `accent`-Fläche/-Rand und Beschriftung, Scheiben-Auswahl als `grid-cols-4`-Raster aus `min-h-[56px]`-Buttons in den Scheibenfarben
- **Bestwerte-Tabelle / Frequenz-Tabelle:** `CARD` mit Zeilen (`min-h-[56px]`, `divide-divider`), Icon-Kreis `w-10 h-10 bg-white/[0.08]`, Name `text-card-title`, Wert `text-body`, Datum `text-label uppercase text-muted`, fehlender Wert "–". Code: `js/views/statistics.js`, `js/views/statistics-exercise-detail.js`
- **Balkendiagramm** (Workouts pro Woche): reines HTML/CSS, kein Chart-Framework. Aktuelle Woche `bg-accent`, übrige `bg-accent-muted`; gepunktete Gitterlinien `border-white/15`; X-Achse zweizeilig "KW" / ISO-Wochennummer
- **Liniendiagramm** (Volumen, Verlauf einer Größe): gemeinsame Bausteine in `js/lineChart.js` ([ADR 0043](decisions/0043-verlaufs-diagramm-und-gemeinsame-linien-komponente.md)): SVG-`<polyline>` mit `preserveAspectRatio="none"` und `vector-effect="non-scaling-stroke"`, Y-Achse auf den Wertebereich gezoomt (`w-8`-Spalte, gleiche Breite wie das Balkendiagramm, bündige Plot-Flächen), gepunktete Gitterlinien und feste Grundlinie, höchstens 4 X-Beschriftungen. Volumen: nur die geglättete Linie. Verlauf: ebenfalls nur die Linie (keine Einzelpunkte), dazu senkrechte Hilfslinie `.chart-guide` am ausgewählten Trainingstag, Plot-Fläche `.chart-plot-interactive` (`touch-action: pan-y`)
- **Konvention Y-Achse (alle Diagramme):** Die kleinste Beschriftung sitzt mittig genau auf der Grundlinie (X-Achse), die größte mittig am oberen Plot-Rand direkt unter der Trennlinie der Karte. Kein Polster darüber/darunter: Liniendiagramme erweitern die Domäne auf ganze Tick-Schritte (`buildYAxis()`), das Balkendiagramm beginnt bei 0 und endet am größten Tick. Neue Diagramme setzen das genauso um.
- **Größen-Chips** (unter dem Verlaufs-Diagramm): horizontal scrollbare Reihe mit `py-2` (zusätzlicher Abstand zum Diagramm und zum Kartenrand), Chip in der Form der Muskel-Chips (`rounded-full px-3 py-1 text-body`, aktiv `bg-accent text-base`, sonst `bg-white/[0.08] text-ink`)

## Bewegung

- **Nav-Indikator:** `moveNavIndicator()` in `js/app.js` misst per `getBoundingClientRect()` und animiert per Web Animations API dreistufig (Start-Breite, gestreckt über beide Positionen, Ziel-Breite). Dauer `NAV_INDICATOR_DURATION_MS = 170`, Kurve `cubic-bezier(0.22, 1, 0.36, 1)`. Das Icon des alten Tabs behält seine Farbe bis zur Hälfte der Dauer. Segmented-Control-Indikator nutzt dasselbe Muster (170ms)
- **Seiten-Übergänge** ([ADR 0038](decisions/0038-ios-seitenuebergaenge.md), [ADR 0039](decisions/0039-seiten-ebene-fuer-unterseiten.md), `js/swipeBack.js`): Öffnen einer Unterseite, Zurück-Pfeil und Wisch-Zurück nutzen dieselbe iOS-Schiebe-Bewegung. Die Unterseite liegt als eigene Ebene `#page-layer` über der Übersicht und schiebt sich von rechts (Kantenschatten `-2px 0 10px rgba(0,0,0,0.3)`), die untere Seite rückt um ein Drittel der Breite nach links und dunkelt bis 20 % ab. Gedämpfte Feder ohne Nachschwingen (`SPRING_OMEGA = 12`, ca. 0,35 s), startet mit der Fingergeschwindigkeit. Bottom-Nav und Scrims bleiben stehen
- **View Transitions:** `withViewTransition(renderFn, direction)` in `js/utils.js` (`startViewTransition`, Safari 18.2+). `forward` = Skalierung 0.96→1 plus Fade, `back` = reines Fade, `none` = ohne Übergang (für die Wisch-Geste). Dauer 260ms. Nicht bei Tab-Wechseln der Segmented Control und reinen Datenaktualisierungen
- **Popups und Sheets:** Sheets gleiten per `translateY` herein/heraus (220ms), Popups per Pop-In/Pop-Out mit zweistufigem Schließen (Klasse `closing`, Entfernen erst nach der Animation)
- **Press-Feedback:** `.tap-feedback:active` skaliert auf 0.96 mit Opacity 0.85. Glas-Elemente (`.icon-btn-glass`, Nav-Indikator) reduzieren zusätzlich den Blur auf 12px
- **Reduced Motion:** `@media (prefers-reduced-motion: reduce)` schaltet Transitions und `::view-transition-*`-Animationen ab. `withViewTransition()` und `moveNavIndicator()` prüfen dieselbe Media Query zusätzlich in JS, Navigation funktioniert identisch, nur ohne Bewegung

## Weitere globale Regeln

- **Kein Markieren:** `user-select: none` und `-webkit-touch-callout: none` auf `html, body, body *`. Ausnahme `input`, `textarea`, `contenteditable` (`user-select: text`, sonst sind Felder unter iOS unbedienbar). Neue Eingabeelemente fallen automatisch darunter
- **Safe Area:** Oberkante über `.safe-top` (`padding-top: env(safe-area-inset-top)`), Unterkante über `env(safe-area-inset-bottom)` an Nav, Container und Action Sheet
- **Touch-Ziele mindestens 44px** (`min-h-[44px]`, Icon-Buttons 44×44px; kleinere sichtbare Elemente wie der Stepper erweitern die Trefferfläche per Pseudoelement)
- **Kein Zoom:** `touch-action: manipulation` auf `html, body`, Inputs mit 16px Schrift
- **Scroll-Leisten ausgeblendet**, Scrollen funktioniert unverändert
- **Keine nativen Dialoge** (`confirm()`/`alert()`/`prompt()`), Bestätigungen über das Action Sheet

## Bewusst nicht verwendet

- `rounded-badge`: Token existiert, aber keine Badges im Produkt.
- Roter Button (`bg-red-600`): destruktive Aktionen sind `DESTRUCTIVE_LINK` oder die rote Aktion im Action Sheet.
- Glass für Karten, reguläre Buttons und Bottom-Sheets: bewusst deckend, Glass nur für Navigation und Menüs.
- Icon-Bibliotheken: Icons sind eigene Inline-SVGs.
- Chart-Bibliotheken: Diagramme sind HTML/CSS bzw. SVG von Hand.
- Eigenes Spacing-Token: Tailwinds Skala genügt.
