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
| `text-card-title` | 16px / 600 | Karten-/Listenzeilen-Titel (Übungsname, Routinenname, Kalendertag-Datum im Workout-Tab) |
| `text-body` | 14px / 400 | Standard-Fließtext |
| `text-label` | 11.5px / 600 / letter-spacing 0.6px | Kleine Labels — kombiniert mit `uppercase` für Sektions-Überschriften ("ÜBUNGEN", "SÄTZE"), ohne `uppercase` für Formularfeld-Labels und Fußnoten |
| `font-sans` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif` | Global auf `<body>` — auf iOS ohnehin identisch mit dem Systemfont, hier explizit dokumentiert statt implizit |

**Abweichung von der Spezifikation:** `text-label` bündelt Größe/Gewicht/Tracking, aber **nicht** `uppercase` — das bleibt eine separate Utility-Klasse, je nach Einsatzort angewendet oder weggelassen (ein Formularfeld-Label wie "Gewicht (kg)" soll nicht in Großbuchstaben erscheinen, eine Sektions-Überschrift wie "SÄTZE" schon).

## Radien

| Tailwind-Klasse | Wert | Verwendung |
|---|---|---|
| `rounded-card` | 18px | Größere Container: Formulare, Panels, größere Listenzeilen (Übungen, Routinen, aufklappbare Übungs-Roster-Einträge im Workout-Tab) |
| `rounded-btn` | 13px | Buttons, Inputs, kompakte Listenzeilen (Sätze, Routine-Übungen-Zeilen) |
| `rounded-sheet` | 26px | Großer Kalender im Workout-Tab (Bottom-Sheet, s. Iterationen unten) — obere Ecken |
| `rounded-badge` | 11px | Definiert, aktuell **nicht verwendet** (keine Badges im Produkt) |
| `rounded-full` | Tailwind-Standard | Pillenförmige Elemente: Bottom-Nav, Exercise-Chips, "+ Weitere Übung" |

Die Wahl "Karte vs. Button" für Listenzeilen ist keine strikte Regel aus dem Briefing, sondern eine Auslegung: größere, mehrzeilige oder umfangreichere Zeilen (Übungsliste, Routinenliste, Übungs-Roster im Workout-Tab) bekommen `rounded-card`, kompaktere einzeilige Zeilen (Satz-Einträge, Routine-Übungen im Editor, Kalender-Tage) `rounded-btn`.

## Abstände

Kein eigenes Spacing-Token nötig: Tailwinds Standard-Spacing-Skala (0.25rem-Schritte = 4px-Raster) deckt sich bereits exakt mit der geforderten 4px-Grundraster-Vorgabe. Durchgängig verwendet: `gap-2`/`gap-3` (8/12px) zwischen Listenelementen, `p-4`/`px-4 py-3` (16px) als Karten-Innenabstand, `gap-4`/`gap-6` (16/24px) zwischen Sektionen.

## Navigation

Freischwebende Bottom-Nav (`#bottom-nav` in `index.html`): `fixed left-4 right-4 bottom-[calc(8px+env(safe-area-inset-bottom))]`, `rounded-full`. Aktiver Tab bekommt über `.nav-btn.active` (in `css/styles.css`, da Tailwinds Play-CDN keine eigene `:has()`-freie Möglichkeit bietet, JS-gesetzte Klassen mit zwei Eigenschaften gleichzeitig zu verknüpfen) einen eigenen Hintergrund + `color: #A3E635`. Inaktive Tabs: `text-muted`, kein Hintergrund.

**Glass-Effekt (2026-08-30, Ergänzung):** Statt der anfänglich flächigen `bg-surface`-Füllung hat ausschließlich die Bottom-Nav eine an Liquid Glass angelehnte, durchscheinende Gestaltung — als dediziertes CSS in `css/styles.css` (`#bottom-nav`), nicht als Tailwind-Utility, da die Kombination aus mehrschichtigem `box-shadow` und vorangestelltem `-webkit-backdrop-filter` so klarer bleibt:

| Eigenschaft | Wert |
|---|---|
| `background` | `rgba(30, 30, 30, 0.55)` (halbtransparente `bg-surface`) |
| `backdrop-filter` / `-webkit-backdrop-filter` | `blur(20px) saturate(160%)` |
| `border` | `1px solid rgba(255, 255, 255, 0.12)` |
| `box-shadow` | `inset 0 1px 0 rgba(255,255,255,0.15)` (Glaskante oben) + `0 8px 24px rgba(0,0,0,0.35)` (Schwebe-Schatten) |
| Aktiver Tab | `background-color: rgba(42, 42, 42, 0.6)` statt deckendem `bg-raised` |

**Scrim-Layer hinter der Nav (2026-08-30, weitere Ergänzung):** Zusätzlich zum Blur der Bar selbst sitzt ein eigenständiges, nicht-interaktives `<div class="nav-scrim">` zwischen Scroll-Inhalt und Nav-Bar im Stapel — ein abdunkelnder `linear-gradient` (Basis `#121212`/`bg-base`, transparent → 85% deckend über 140px Höhe), damit die durchscheinende Bar auch vor hellem/unruhigem Scroll-Inhalt lesbar bleibt. `position: fixed`, `pointer-events: none` (sonst blockiert es Taps/Scroll), `z-index: 10` — Nav-Bar selbst bekam dafür explizit `z-index: 20` (Tailwind-Klasse `z-20`), Scroll-Inhalt bleibt beim Default-Stacking. In `css/styles.css` unter `.nav-scrim`, Markup direkt vor `<nav>` in `index.html`.

**Bewusst nur die Bottom-Nav, sonst nichts:** Karten, Buttons und Modals bleiben deckend (`bg-surface`/`bg-base`, kein Blur). Kein SVG-Filter-basierter Verzerrungseffekt (echtes Liquid Glass aus SwiftUI/UIKit) — Safari/iOS unterstützt nur `backdrop-filter: blur()`, keine SVG-Refraktion; das native Aussehen wird über Blur + Transparenz + Specular-Highlight angenähert, nicht pixelgenau nachgebaut.

**Icons:** Vier eigene, minimale Outline-SVGs in der Nav (Hantel/Workout, Liste/Übungen, Kalender/Routinen, Person/Profil) direkt inline in `index.html`, `stroke-width="1.75"`, `22×22px`. Der Kalender-Umriss wird ein zweites Mal (kleiner) für den Button im Workout-Tab wiederverwendet, der den großen Kalender öffnet (`js/views/workout.js`). Das ursprünglich fünfte Icon (Uhr/Verlauf) ist mit dem Verlauf-Tab entfallen, s. [ADR 0007](decisions/0007-workout-tab-tagesbasiertes-modell.md). Bewusst **nicht** aus einer Bibliothek wie Lucide kopiert (Briefing verlangt explizit offene/eigene Icons, keine Assets der Referenz-App) — stattdessen selbst im gleichen minimalistischen Outline-Stil konstruiert, um jede Lizenz-/Fidelity-Frage zu vermeiden.

Content-Bereich (`#view-container`) hat `padding-bottom: calc(88px + env(safe-area-inset-bottom))`, damit Inhalte nicht hinter der freischwebenden Nav verschwinden.

## Komponenten-Muster

- **Primärer Button:** `bg-accent text-base font-bold rounded-btn` (z. B. "Speichern", "Profil hinzufügen")
- **Sekundärer Button** (`bg-raised text-ink font-semibold rounded-btn`): Muster definiert (`raised`-Token auch für den aktiven Nav-Tab-Hintergrund genutzt), aktuell aber **kein Button im Produkt, der es verwendet** — der bisherige Anwendungsfall ("Training beenden") ist mit [ADR 0007](decisions/0007-workout-tab-tagesbasiertes-modell.md) entfallen
- **Destruktiver Button:** `bg-red-600 text-white font-bold rounded-btn` (z. B. "Profil entfernen") — unverändert, nicht Teil der Token-Spezifikation
- **Destruktiver Link (inline):** `text-red-400 text-body`, kein Hintergrund (z. B. "Übung löschen", "✕" zum Satz-Löschen)
- **Karte/Formular:** `bg-surface rounded-card p-4`
- **Input:** `bg-base rounded-btn px-3 py-3 text-ink`, kein Border
- **Chip (Auswahl):** `rounded-full px-4 py-2`, ausgewählt `bg-accent text-base`, unausgewählt `bg-surface text-ink`
- **Listenzeile:** `bg-surface rounded-card` (bzw. `rounded-btn` bei kompakten Zeilen) `px-4 py-3`
- **Nummerierter Satz-Eintrag:** kleiner Kreis `w-6 h-6 rounded-full bg-base text-label text-muted` mit der Satz-Nummer, davor Gewicht × Wiederholungen, dahinter Löschen (`✕`)
- **Dropdown-Pill (Auswahl mit Popup):** `bg-surface rounded-full`, Label links, Icon rechts (Chevron-Down geschlossen, X bei geöffnetem Picker — z. B. Routine-Auswahl im Workout-Tab) — öffnet ein Popup im `Karte/Formular`-Stil als absolut positioniertes Overlay direkt darunter (nicht im normalen Fluss, verdrängt nichts), mit unsichtbarem Backdrop zum Schließen bei Klick außerhalb
- **Bottom-Sheet:** `bg-surface rounded-sheet` (nur obere Ecken relevant, sitzt am unteren Bildschirmrand), zentrierter Ziehgriff (`w-9 h-1 rounded-full bg-white/25`) oben, `fixed inset-0 bg-black/50`-Backdrop zum Abdunkeln + Schließen bei Klick außerhalb. Schiebt sich per `translateY`-Keyframe von unten herein/heraus. Bisher einziger Anwendungsfall: großer Kalender im Workout-Tab, s. Iterationen unten und [ADR 0008](decisions/0008-grosser-kalender-lazy-loading.md)
- **Dezenter Icon-Link (Platzhalter):** `opacity-60`, zentriert, kleiner Kreis-Outline mit "+" davor (z. B. "Übung hinzufügen") — für Aktionen ohne (noch) echte Funktion, bewusst kein volles Button-Styling, um nicht wie eine funktionierende primäre Aktion zu wirken

**Workout-Tab-Feinschliff nach Referenz-Screenshots (2026-08-30):** Auf Wunsch wurden Teile des Workout-Tab-UI an Screenshots einer Referenz-App angeglichen — ausschließlich Layout/Optik, keine der dort zusätzlich sichtbaren Funktionen (Statistics-/Premium-Tab, KI-Routine-Generierung, Wochenplanung, Zitat des Tages, Schloss-/Weight-Badge, Ziel-Satz-Zeile "3 Sätze × 8 Wiederholungen") wurden übernommen — letztere beide sind ohnehin explizit in Abschnitt 10 der Konzept-Erweiterung ausgeschlossen ("Dauerhaft nicht vorgesehen"). Übernommen:
- **Kalenderzeile ohne Einzel-Pill:** kein `bg-surface` mehr pro Tag — Wochentag als reiner Text (`text-label uppercase`, `text-ink` wenn ausgewählt sonst `text-muted`), nur die Tageszahl des ausgewählten Tages bekommt ein kleines quadratisches Accent-Badge (`w-8 h-8 rounded-lg bg-accent`)
- **Relative Datumsbezeichnung:** "Heute"/"Gestern"/"Morgen, {Datum}" für nahe Tage, sonst voller Wochentag — statt durchgängig vollem Wochentag
- **Nummerierte Sätze** in der aufgeklappten Übungs-Karte

**Weitere Iteration nach Nutzer-Feedback auf diesen ersten Feinschliff (2026-08-30):**
- **Heute-Markierung:** Ist der heutige Tag nicht gleichzeitig ausgewählt, wird nur seine Tageszahl grün eingefärbt (`text-accent`, kein Hintergrund). Ist er ausgewählt, bleibt es unverändert beim Accent-Badge mit dunkler Zahl — Auswahl-Styling hat also Vorrang vor der Heute-Markierung
- **Wochenweises Einrasten statt freiem Scroll:** Der Datumsbereich wird jetzt auf ganze Mo-So-Wochen ausgerichtet (`mondayOf()`-Helper in `workout.js`), zunächst per `scroll-snap-align: start` nur auf den Montags-Buttons bei weiterhin durchgehendem Einzeltage-Scroll (später durch die Wochenblock-Architektur ersetzt, s. "Weitere Iteration" unten)
- **Separater "Routinen"-Link entfernt.** Die Routine-Auswahl ist jetzt eine reine Dropdown-Pill; ihr Chevron-Icon wird bei geöffnetem Picker zu einem X, ein erneuter Klick auf die Pille schließt ihn (kein separater "Abbrechen"-Button mehr). Der Zugang zur Routinen-Übersicht lebt jetzt als eigener Eintrag **innerhalb** des Popups ("Alle Routinen anzeigen")
- **Popup als echtes Overlay statt Inline-Erweiterung:** `position: absolute` innerhalb eines `position: relative`-Wrappers um die Dropdown-Pill, dazu ein unsichtbares `position: fixed inset-0`-Backdrop (schließt den Picker bei Klick außerhalb). Verdrängt den darunterliegenden Inhalt (Übungs-Roster, "Übung hinzufügen") nicht mehr nach unten, liegt stattdessen sichtbar darüber (`z-40` Popup / `z-30` Backdrop, beide über der Bottom-Nav `z-20`)
- **Checkmark bei der aktiven Routine im Picker** war schon vorher als echtes ✓-Zeichen umgesetzt (nicht nur farbliche Markierung) — die vorherige Formulierung unter "Bewusst nicht umgesetzt" war ungenau und wurde korrigiert

**Dritte Iteration – Wochenblock-Architektur + Overlay-Animation (2026-08-30):**
- **±1 statt ±2 Wochen:** nur noch Vorwoche, aktuelle Woche, Folgewoche (3×7 = 21 Tage) statt der ursprünglichen 5 Wochen
- **Kalenderzeile von Flex-Prozent-Basis auf Wochenblöcke umgestellt.** Grund: `basis-[14.2857%]` auf 29/35 durchgehenden Einzeltagen ließ durch Rundung ein Stück des nächsten Montags sichtbar hereinragen. Jetzt: die Woche ist die scrollende Einheit — ein äußerer `flex`-Container reiht drei `w-full flex-shrink-0`-Wochenblöcke aneinander (`snap-start` sitzt auf dem Block, nicht mehr auf Einzeltagen), jeder Block ist intern ein `grid grid-cols-7`, das die 7 Tage ohne Rundungsfehler exakt über die Blockbreite verteilt (CSS Grids `fr`-Einheiten verteilen Restpixel korrekt, anders als Flex-Prozent-Basis). Ergebnis: die jeweils nicht ausgewählte Nachbarwoche ist im Ruhezustand vollständig unsichtbar, kein angeschnittener Montag mehr — per `getBoundingClientRect()` verifiziert (Wochenblock exakt 343px breit = Content-Breite der übrigen Seite, `left: 0` deckungsgleich mit den anderen Karten)
- **24px-Abstand zwischen den Wochenblöcken** als Orientierungshilfe zwischen Sonntag und Montag — sichtbar, während man zwischen zwei Wochen swipt, im eingerasteten Ruhezustand naturgemäß nicht (dann ist nur eine volle Woche im Bild). Läuft bewusst **nicht** über Tailwinds `gap`-Utility auf dem Flex-Container, sondern über einen expliziten, unsichtbaren Abstandshalter-`div` zwischen den Wochenblöcken — `gap` in Kombination mit `scroll-snap` ist in Safari/WebKit nicht durchgängig zuverlässig (bekannte Cross-Browser-Inkonsistenz) und hätte die exakte Rand-Ausrichtung der Wochenblöcke (s. u.) verwässern können
- **Rand-Ausrichtung Montag/Sonntag mit `scroll-padding` statt `scrollIntoView`-Heuristik.** Beim ersten Test dieser Architektur lag nur die zuletzt sichtbare Woche pixelgenau an ("Workout"-Überschrift links, Kalender-Icon rechts) — die übrigen Wochen lagen 16px zu weit links, weil `scrollIntoView({inline:'start'})` das eigene `px-4`-Padding des Scroll-Containers ignoriert und stattdessen bis exakt an die Bildschirmkante scrollt (nur bei der jeweils letzten Woche verhinderte die natürliche Scroll-Grenze das). Behoben mit der dafür vorgesehenen CSS-Eigenschaft `scroll-padding` (Tailwind: `scroll-px-4`) auf dem Scroll-Container — das ist der Mechanismus, den Browser sowohl für `scroll-snap`-Ruhepositionen als auch für `scrollIntoView` konsistent heranziehen, im Gegensatz zu einer JS-seitigen Krücke. Für alle drei Wochen per `getBoundingClientRect()` auf 0px Abweichung zur Überschrift/zum Icon verifiziert
- **Pop-In/Pop-Out-Animation fürs Routine-Popup:** `@keyframes routine-picker-pop-in` (Skalierung 0.9→1 + Opacity 0→1, `transform-origin: top center`, spielt automatisch beim DOM-Einfügen) fürs Öffnen. Fürs Schließen reicht ein reines CSS-Keyframe nicht, da unser Render-Modell das Element bei Zustandswechsel sofort aus dem DOM entfernt – daher ein zweistufiger Schließvorgang in `workout.js` (`closeRoutinePicker()`): zunächst wird nur eine `closing`-Klasse gesetzt (spielt `routine-picker-pop-out` mit `animation-fill-mode: forwards`), erst nach Ablauf der Animationsdauer (`ROUTINE_PICKER_CLOSE_ANIMATION_MS`, mit der CSS-Dauer synchron zu halten) wird der Picker wirklich aus dem State entfernt. Per `getComputedStyle().opacity` sowohl während der Animation als auch danach verifiziert

**Vierte Iteration (2026-08-30, überholt durch die fünfte — nur zur Historie):** Erster Versuch der Randausrichtung über `items-start`/`items-end` auf Montag/Sonntag innerhalb gleich breiter Grid-Spalten. Funktional 0px Abweichung, aber optisch falsch: brach die Zentrierung von Wochentag-Text und Tageszahl zueinander, da beide Elemente unterschiedlich breit sind und `items-start`/`items-end` sie an der Kante statt zueinander ausrichtet. Durch die fünfte Iteration ersetzt.

**Fünfte Iteration – korrekte Randausrichtung + größeres X (2026-08-30):**
- **`grid grid-cols-7` durch `flex justify-between` ersetzt.** Der Denkfehler der vierten Iteration: Randausrichtung wurde als Eigenschaft der *Spalte* behandelt (Inhalt an den Spaltenrand drücken), tatsächlich gefordert war aber, dass die 7 *Tages-Blöcke selbst* (Wochentag+Zahl weiterhin zueinander zentriert, wie bei jedem anderen Tag auch) gleichmäßig verteilt werden, wobei der erste und letzte Block automatisch an den Rändern landen. Jeder Tag ist jetzt ein an seinem Inhalt bemessener Flex-Block (`items-center`, einheitlich für alle 7 — keine Sonderfälle mehr für Montag/Sonntag), `justify-between` auf dem Wochenblock verteilt diese 7 Blöcke mit gleichem Abstand über die volle Breite. Verifiziert: 0px Abweichung an beiden Rändern **und** exakt gleicher Center-zu-Center-Abstand (52px) zwischen allen 7 Tagen
- **X-Balken vergrößert** (7px → 10px Länge, 1.5px → 1.75px Dicke) auf Nutzer-Feedback, dass das X zu klein wirkte. Da Balkenbreite jetzt selbst mitanimiert wird (Chevron- und X-Zustand haben unterschiedliche Balkenlänge), lief die Zentrierung von einem festen `margin-left` auf `transform: translateX(-50%)` um — das folgt der jeweils aktuellen (auch mitten in der Animation wechselnden) Balkenbreite automatisch, ein fester Margin-Wert wäre nur für eine Breite korrekt gewesen und hätte bei der anderen einen sichtbaren Versatz erzeugt

**Sechste Iteration – Routine per Toggle-Klick entfernen (2026-08-30):** Der separate "Keine Routine (entfernen)"-Button im Popup ist auf Nutzer-Wunsch entfernt. Stattdessen: Klick auf die bereits ausgewählte Routine (erkennbar am ✓) entfernt sie wieder, statt sie erneut anzuwenden — reiner Toggle in `.pick-routine-option-btn`'s Klick-Handler (`workout.js`), keine Änderung an `removeRoutineFromWorkout()`/`applyRoutineToWorkout()` selbst nötig. Mit bereits begonnener Übung (inkl. Satz) durchgetestet: bleibt beim Entfernen korrekt erhalten, identisch zur bisherigen Kaskaden-Regel.

**Siebte Iteration – Großer Kalender als Bottom-Sheet (2026-09-04, Abschnitt 11):** Der Kalender-Button ersetzt den bisherigen nativen `<input type="date">`-Zwischenstand (s. [ADR 0007](decisions/0007-workout-tab-tagesbasiertes-modell.md)) durch ein selbst gebautes Bottom-Sheet — erste echte Sheet-Komponente der App, s. "Bottom-Sheet" oben.
- **Aufbau:** `fixed left-0 right-0 bottom-0`, `height: 88vh`, `rounded-sheet`. Innerer scrollbarer Bereich (`#calendar-sheet-months`) mit Monats-Sektionen: Monatsname (`text-card-title`), eine Wochentags-Kopfzeile (`Mo`–`So`, `text-label uppercase text-muted`), darunter `grid grid-cols-7` mit führenden Leerzellen bis zum korrekten Wochentag des 1. Tages. Tages-Styling identisch zur kleinen Kalenderzeile (Accent-Badge bei Auswahl, grüner Text bei Heute-nicht-ausgewählt, grüner Punkt bei erfassten Sätzen)
- **Öffnen:** direkt zum Monat des aktuell gewählten Tages gescrollt, initial nur Zielmonat ±1 gerendert (innerhalb der erlaubten Grenzen: fest ab Januar 2026, bis einen Monat über den echten aktuellen Kalendermonat hinaus)
- **Lazy-Nachladen beim Scrollen statt vollständiger Virtualisierung** (Erstversion, noch am selben Tag durch die Achte Iteration ersetzt, s. [ADR 0008](decisions/0008-grosser-kalender-lazy-loading.md)/[ADR 0009](decisions/0009-grosser-kalender-vollstaendiges-rendern.md)): weitere Monate wurden erst beim Erreichen des oberen/unteren Rands per direkter DOM-Manipulation angehängt — verursachte in der Praxis spürbares Ruckeln beim ersten Hochscrollen
- **Tap auf einen Tag** schließt das Sheet und setzt `state.selectedDate` — die kleine Kalenderzeile und die Workout-Ansicht übernehmen die neue Auswahl automatisch
- **Keine Pfeil-Buttons für Monatswechsel** — Navigation ausschließlich durch Scrollen, wie im Briefing gefordert

**Achte Iteration – Kalender-Sheet-Feinschliff nach echtem Nutzer-Test (2026-09-04):** Nach dem ersten Test des großen Kalenders kam eine Reihe an Korrekturen zurück:
- **Grüner Kreis statt kleinem Punkt für dokumentierte Tage.** Der kleine Punkt unter der Tageszahl (identisch zur kleinen Kalenderzeile übernommen) war im großen Kalender optisch nicht auffällig genug. Ersetzt durch einen vollflächig gefüllten Kreis (`rounded-full bg-accent`) direkt um die Tageszahl — anders als in der kleinen Kalenderzeile, die weiterhin ein quadratisches Badge (`rounded-lg`) für die Auswahl und einen separaten Punkt für dokumentierte Tage nutzt (dort bewusst nicht geändert, nicht Teil des Auftrags)
- **"Heute" bekommt einen ungefüllten Kreis** (`border-2 border-accent`, kein Hintergrund) — visuell klar von den gefüllten Kreisen (Auswahl/dokumentiert) unterscheidbar. Da beide Zustände jetzt dieselbe Kreisfläche beanspruchen, war eine Priorität für den (seltenen) Überlapp-Fall nötig: Auswahl und "hat Sätze" haben Vorrang vor der Heute-Markierung (ein bereits dokumentierter heutiger Tag zeigt also den gefüllten statt den umrandeten Kreis) — eine bewusste, im Briefing nicht spezifizierte Auslegung für diesen Randfall
- **Ruckeln beim ersten Hochscrollen behoben**, indem das Lazy-Nachladen komplett entfernt und durch vollständiges Vorab-Rendern des gesamten (praktisch begrenzten) Zeitraums ersetzt wurde — Ursache war die asynchrone DB-Abfrage pro nachgeladenem Monat, die mitten in der aktiven Scroll-Geste lief. Volle Begründung: [ADR 0009](decisions/0009-grosser-kalender-vollstaendiges-rendern.md)
- **Hintergrund-Scrollen gesperrt, während das Sheet offen ist** (`lockBodyScroll`/`unlockBodyScroll` in `workout.js`): `document.body` wird auf `position: fixed` gesetzt (iOS-sicherer Ansatz, da reines `overflow: hidden` auf Safari per Touch weiterhin "durchscrollen" lässt) und beim Schließen wieder an die ursprüngliche Scroll-Position zurückgesetzt. Behebt nebenbei auch das gemeldete "Kalender lässt sich nach einmaligem Workout-Tab-Scroll nicht mehr scrollen" — klassisches iOS-Symptom für denselben Grundfehler (Touch-Events über einem Fixed-Overlay griffen auf den dahinterliegenden, weiterhin scrollbaren Body durch)
- **Drag-to-Dismiss am Ziehgriff:** Der Griff lässt sich jetzt per Press-and-Drag nach unten wegziehen (Pointer Events, `touch-action: none` auf dem Griff verhindert, dass Safari die Geste als Scroll interpretiert). Unterhalb eines Schwellenwerts (120px) springt das Sheet zurück, darüber schließt es — beides über eine direkte `transform`-Transition statt der Öffnen/Schließen-Keyframes, da diese von einem festen Start-/Endpunkt ausgehen und keinen beliebigen Drag-Zwischenstand als Startpunkt kennen. Der Backdrop blendet proportional zur Zugweite mit ab
- **"Heute"-Button oben rechts im Sheet-Header** (`text-accent`, neben dem zentrierten Ziehgriff via `grid grid-cols-3`) springt direkt zum heutigen Tag und schließt das Sheet — gleiches Verhalten wie ein Tap auf einen Tag
- **Backdrop fadet jetzt weich ein/aus** (`calendar-sheet-backdrop-fade-in`/`-out`, 220ms, synchron zur Sheet-Slide-Animation) statt hart zu erscheinen/verschwinden — vorher hatte nur das Sheet selbst eine Animation, der Backdrop wechselte instantan

## Bewusst nicht umgesetzt

Gemäß Briefing-Vorgabe ("nur bestehende Screens angleichen, keine Vorwegnahme") wurden folgende in der Spezifikation beschriebene Komponenten **nicht** gebaut, weil es im aktuellen Fitlog-Funktionsumfang keine Entsprechung gibt:

- **Segmented Control** — keine Stelle im Produkt, die ein Segment-Toggle braucht
- **Diagramme** (Gitterlinien, Balken/Linien) — Fitlog hat keine Charts
- **Checkmark-Auswahllisten** — die Routine-Auswahl im Workout-Tab (`workout.js`) nutzt inzwischen einen echten Checkmark (✓) bei der aktiven Routine, aber als Teil des Dropdown-Picker-Musters, keine eigenständige, wiederverwendbare Komponente
- **Große Kennzahl (`text-kpi`)** — Token ist definiert, aber aktuell nirgends verwendet (kein Statistik-Screen vorhanden)

Ein echtes Bottom-Sheet ist inzwischen gebaut (großer Kalender im Workout-Tab, s. "Bottom-Sheet" oben und Siebte Iteration) — `rounded-sheet` ist damit nicht mehr nur vorbereitet, sondern im Einsatz. Falls die übrigen Screens/Komponenten später tatsächlich gebaut werden, sind die zugehörigen Tokens (`rounded-badge`, `text-kpi`) bereits vorbereitet.
