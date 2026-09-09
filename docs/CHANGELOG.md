# Changelog

Format angelehnt an [Keep a Changelog](https://keepachangelog.com/). Ein Eintrag pro nennenswerter Änderung, neueste zuerst.

## 2026-09-09 (Übungs-Sheet: mehr Abstand zwischen Kopfzeile und Suchfeld)

### Changed
- Kopfzeilen-`pb-3` auf `pb-5` erhöht, damit das Suchfeld nicht so dicht unter den Icon-Buttons klebt

## 2026-09-09 (Suchfeld-Hintergrund im Übungs-Sheet aufgehellt)

### Changed
- Suchfeld im Übungs-Sheet nutzt jetzt `bg-white/[0.08]` statt `bg-base` — sitzt direkt auf der `bg-surface`-Sheet-Fläche (kein Kartenkontext), `bg-base` war dort dunkler statt heller als der Hintergrund. Als neue Input-Variante in design-system.md dokumentiert
- Nebenbei behoben: Tailwinds Play-CDN-JIT löst den Bare-Opacity-Modifier `bg-white/8` nicht korrekt auf (wird zu deckendem Weiß statt 8 % Deckkraft) — Arbitrary-Value-Schreibweise `bg-white/[0.08]` verwenden, sobald ein Opacity-Wert außerhalb der Tailwind-Standardskala gebraucht wird

## 2026-09-09 (Übungs-Sheet: Live-Textsuche)

### Added
- Suchfeld im Übungs-Sheet (nur im 'list'-Zustand) - filtert die Übungsliste live beim Tippen (Substring-Match, Groß-/Kleinschreibung ignoriert). Auswahl bleibt beim Suchen erhalten (arbeitet über IDs, nicht Listenpositionen), auch für gerade ausgeblendete Treffer. Eigener Leer-Zustand "Keine Übungen gefunden." getrennt vom "Noch keine Übungen angelegt"-Text
- Filter (Muskelgruppe/Equipment) sind bewusst noch nicht Teil dieses Schritts - die Datenfelder dafür existieren noch nicht, s. Diskussion in dieser Session

### Changed
- Übungsliste + heutiger Roster-Stand werden beim Öffnen des Sheets einmalig geladen und zwischengespeichert (`exerciseSheetCache`), statt bei jeder Interaktion neu aus der DB zu fragen - Suche ist ein reiner In-Memory-Filter. `renderExerciseSheet()` ist dadurch synchron geworden
- Suchfeld-Eingaben laufen über einen gezielten Teil-Repaint (`repaintExerciseSheetInPlace()`, ersetzt nur `#exercise-sheet-root`) statt über das volle `paint()` des gesamten Tabs - vermeidet sowohl unnötige Neu-Renderings des restlichen Workout-Tabs bei jedem Tastendruck als auch einen möglichen Async-Race (mehrere überlappende `paint()`-Aufrufe könnten sonst in falscher Reihenfolge fertig werden). Fokus/Cursor-Position werden danach synchron wiederhergestellt

## 2026-09-07 ("+ Übung hinzufügen" im Workout-Tab: Übungs-Sheet mit Mehrfachauswahl)

### Added
- Neues Übungs-Sheet (großes Bottom-Sheet, gleiches Muster wie der Kalender): Übungen ansehen, per Mehrfachauswahl gesammelt zum Tages-Workout hinzufügen, direkt im Sheet eine neue Übung anlegen. Erste funktionsfähige Umsetzung von "+ Übung hinzufügen" (bisher reiner Platzhalter seit ADR 0007). Details/Entscheidungen: [ADR 0011](decisions/0011-uebungs-sheet-bottom-sheet-extraktion.md)
- Tap auf eine Übung im Sheet öffnet ein zweites, darüber gestapeltes Übungs-Detail-Sheet (Kopfzeile fertig, Inhalt noch Platzhalter — Konzept dafür folgt separat)
- `addExercisesToWorkout()` in `js/db.js` — fügt mehrere Übungen gesammelt in einer Transaktion zu einem Workout hinzu (`sourceRoutineId: null`, bleiben von Routine-Wechsel/-Entfernen unberührt)
- Neues Modul `js/sheet.js`: geteilte Bottom-Sheet-Mechanik (Body-Scroll-Sperre, Bottom-Nav-z-index, Drag-to-Dismiss), jetzt gezählt statt reiner An/Aus-Flags, damit mehrere Sheets gleichzeitig offen sein können. Der bisher kalender-spezifische Code in `workout.js` nutzt dieselbe Basis, CSS-Klassen von `.calendar-sheet`/`.calendar-sheet-backdrop` auf generisch `.bottom-sheet`/`.bottom-sheet-backdrop` umbenannt

## 2026-09-07 (Kalender-Sheet: "Heute"-Icon, größerer Kopfzeilen-Abstand, Scroll-Fix)

### Changed
- "Heute"-Button-Icon von einem Fadenkreuz auf das bestehende Kalender-Icon (wie "Kalender öffnen" im Workout-Header) mit zusätzlichem gefülltem Punkt für den heutigen Tag umgestellt
- Abstand zwischen der Kopfzeile (Schließen-/Heute-Button) und dem Kalender-Inhalt vergrößert (`pb-6` auf der Kopfzeile statt keinem Abstand)

### Fixed
- Der automatische Scroll-Sprung zum aktuellen Monat beim Öffnen landete nach der größeren Sheet-Höhe (vorheriger Eintrag) nicht mehr bündig oben — es fehlte nach dem aktuellen Monat genug Folge-Inhalt, damit `scrollIntoView` bis ganz nach oben scrollen konnte, sichtbar als abgeschnittener Rest des Vormonats über der Monatsüberschrift. Betraf praktisch jedes Öffnen. Behoben durch eine Mindesthöhe (100 % der Sheet-Höhe) auf dem jeweils letzten gerenderten Monat

## 2026-09-07 (Kalender-Sheet reicht jetzt bis knapp unter die Dynamic Island)

### Changed
- Feste `height: 88vh/88dvh` des großen Kalender-Sheets durch `top: calc(env(safe-area-inset-top) + 8px)` in der `.calendar-sheet`-CSS-Klasse ersetzt — zusammen mit dem bestehenden `bottom-0` ergibt sich die Höhe automatisch aus dem tatsächlich sicher verfügbaren Platz, statt aus einem empirisch geschätzten Prozentwert. Wiederverwendbar für künftige weitere große Sheets, ohne die Berechnung zu duplizieren

## 2026-09-07 (Kalender-Sheet: Kopfzeile mit Titel und zwei Glass-Buttons statt Ziehgriff-Balken + Text-Button)

### Changed
- Grauer Ziehgriff-Balken oben im großen Kalender-Sheet entfernt, stattdessen steht dort "Kalender" als Titel — die Fläche funktioniert weiterhin als Drag-to-Dismiss-Griff, jetzt eben mit sichtbarem Text statt eines reinen Balkens
- Links davon neuer `.icon-btn-glass`-Button (✕) zum expliziten Schließen des Sheets (bisher nur per Backdrop-Klick oder Ziehgeste möglich)
- "Heute"-Textbutton rechts durch `.icon-btn-glass`-Button mit Fadenkreuz-/Ziel-Icon ersetzt — Funktion unverändert (scrollt nur zum aktuellen Monat, wählt keinen Tag, schließt das Sheet nicht)

## 2026-09-07 (h1-Position: Hauptseiten an Workout angeglichen, Unterseiten bewusst zentriert belassen)

### Fixed
- Auf den vier über die Bottom-Nav erreichbaren Hauptseiten (`exercises.js`, `routines.js`-Liste) sowie Workout und Profil soll die `<h1>` (`text-screen-title`) immer an derselben Position sitzen. Ursache der bisherigen Abweichung: `items-center` zentrierte die einzeilige Überschrift in `exercises.js`/`routines.js`-Liste vertikal gegen den höheren 44px-Button daneben, wodurch sie dort sichtbar tiefer saß als im Workout-Tab, wo der Block aus Titel + Datums-Unterzeile bereits höher als der Kalender-Button ist und deshalb bündig am oberen Rand sitzt. Diese beiden Header-Zeilen laufen jetzt auf `items-start`, wodurch der obere Rand von Überschrift und Button überall gleich sitzt wie im Workout-Tab

### Entschieden
- Auf Unterseiten (Routine-Detail, „Übung hinzufügen", Übungs-Detailseite — alle mit Zurück-Pfeil statt Bottom-Nav erreichbar) bleibt bzw. kehrt die ursprüngliche `items-center`-Zentrierung zurück: Der Zurück-Pfeil/Glass-Button soll dort optisch zentriert neben der einzeiligen Überschrift stehen, auch wenn die `<h1>` dadurch nicht exakt an derselben Y-Position wie auf den Hauptseiten sitzt. Bewusster Nutzer-Entscheid nach Vergleich beider Varianten im Browser — eine global identische h1-Position UND eine zentrierte Button-Optik sind bei einer einzeiligen Überschrift neben einem 44px-Button nicht gleichzeitig erreichbar, ohne die Blockhöhe künstlich anzugleichen (z. B. per unsichtbarer Platzhalter-Zeile) oder den Button zu verkleinern — beides wurde als nicht gewünscht verworfen

## 2026-09-07 (Automatisierte Tests für Löschkaskaden, Routine-Wechsel und Tages-Workout-Eindeutigkeit)

### Added
- Neues `tests/`-Verzeichnis mit automatisierten Tests für die heiklen Datenfunktionen in `js/db.js` (Löschkaskaden bei Übung/Routine, Routine-Wechsel inkl. manuell hinzugefügter Übungen, Eindeutigkeit von `getOrCreateWorkoutForDate`, Sortierung begonnener/unbegonnener Übungen) — bisher gab es kein automatisiertes Qualitätsnetz, jede Änderung musste manuell im Browser nachgeprüft werden
- Eigenes, rein Dev-seitiges `package.json` nur für dieses Test-Tooling (`node --test` + `fake-indexeddb`, da `db.js` sonst echtes IndexedDB im Browser braucht) — betrifft ausschließlich lokales Testen, die App selbst bleibt weiterhin ohne Build-Schritt/npm (s. ADR 0002, CLAUDE.md)
- `npm test` ausführen, bevor Änderungen an diesen Funktionen committet werden

## 2026-09-07 (Service Worker: Cache-first auf die bekannte App-Shell eingeschränkt)

### Fixed
- `sw.js` fing bisher ausnahmslos jeden GET-Request ab und cachte jede Antwort, egal woher sie kam — für die aktuelle App (nur eigene, feste Dateien + zwei CDN-Skripte) unproblematisch, aber ein Sicherheits-/Datenschutzrisiko sobald der geplante Sync zum eigenen Server (s. "Sync & Infrastruktur" in `architecture.md`) kommt: Server-Antworten mit echten Trainingsdaten wären unkontrolliert im Browser-Cache gelandet
- Cache-first läuft jetzt ausschließlich für Requests, deren URL in `APP_SHELL`/`CDN_SHELL` steht (`APP_SHELL_URLS`-Set, zur Laufzeit aus den relativen Pfaden aufgelöst) — alle anderen Requests werden vom `fetch`-Handler gar nicht mehr abgefangen und laufen unverändert direkt ans Netzwerk. Offline-Zugriff auf Trainingsdaten ist davon nicht betroffen (die liegen in IndexedDB, nicht hinter einem GET-Request)
- Zusätzlich: Bei eigenen App-Shell-Dateien werden nur noch tatsächlich erfolgreiche Antworten (`response.ok`) gecacht, keine Fehlerantworten mehr. CDN-Antworten bleiben unverändert immer opaque (wegen `mode: 'no-cors'`) und werden wie bisher trotzdem gecacht

## 2026-09-07 (Workout-Tab: veraltete paint()-Aufrufe können Tab-Wechsel nicht mehr überschreiben)

### Fixed
- Schloss man das Kalender-Sheet oder den Routine-Picker und wechselte sofort (noch während der Schließ-Animation) den Tab, überschrieb der zu diesem Zeitpunkt bereits laufende `paint()`-Aufruf von `workout.js` nach Abschluss seiner asynchronen DB-Abfragen den inzwischen von der neuen View belegten Container — im Kalender-Fall blieb dabei zusätzlich ein unsichtbarer, aber weiterhin klickfangender Backdrop (`z-index: 50`) über der gesamten App inkl. Bottom-Nav zurück, die App wirkte bis zum Neuladen eingefroren
- Neuer `renderEpoch`-Zähler in `workout.js`: `render()` und `unmount()` erhöhen ihn, `paint()` merkt sich seinen Stand beim Start und bricht vor dem `innerHTML`-Schreiben ab, falls sich der Zähler zwischenzeitlich geändert hat
- Zusätzlich: Der Schließen-Timeout des Routine-Pickers wurde bisher gar nicht gespeichert und konnte deshalb in `unmount()` nicht abgebrochen werden (anders als beim strukturell identischen Kalender-Sheet-Timeout) — jetzt analog dazu in `pendingRoutinePickerCloseTimeout` nachgehalten
- Derselbe Fehler bestand isoliert auch in der Übungs-Detailseite (`workout-exercise-detail.js`, Abschnitt 12): ein durch einen Reiter-Wechsel (Heute/Verlauf/Statistik) ausgelöster, noch laufender `paint()`-Aufruf konnte nach einem Zurück-Tap oder einem Bottom-Nav-Tab-Wechsel verspätet fertig werden und den dann bereits von der Tagesübersicht oder einer anderen View belegten Container überschreiben — analoger `renderEpoch`-Schutz plus neuer `unmount()`-Export ergänzt, den `workout.js` sowohl beim eigenen `unmount()` als auch im `onBack`-Callback aufruft

## 2026-09-07 (Kalender-Sheet: Schließen-Timeout an CSS-Animationsdauer angeglichen)

### Fixed
- `CALENDAR_SHEET_CLOSE_ANIMATION_MS` in `workout.js` stand auf 200ms, während die zugehörigen CSS-Keyframes (`calendar-sheet-slide-down`/`calendar-sheet-backdrop-fade-out`) 220ms liefen — der Sheet-DOM-Knoten wurde dadurch 20ms vor Ende der CSS-Animation entfernt, sichtbar als minimal abrupter Sprung am Ende des Schließens. Auf 220ms korrigiert, passend zum bereits vorhandenen Kommentar in `css/styles.css`, der beide Werte synchron halten soll

## 2026-09-06 (Verlauf-Datum in die Karte verschoben, Karten-Abstand unten korrigiert)

### Fixed
- Verlauf-Reiter: Datum stand als Überschrift über der Karte statt wie der Übungsname im Workout-Tab innerhalb der Karte — behoben, `CARD` sitzt jetzt auf dem gemeinsamen Wrapper aus Datum und Satz-Liste
- Sowohl Workout-Roster-Karte als auch Verlauf-Tages-Karte hatten unten deutlich mehr Leerraum als oben: `renderSetTimelineRow()` reservierte per `pb-4` immer Platz für die Verbindungslinie zum nächsten Kreis, auch bei der letzten Zeile, für die es keine gibt. Bei der letzten Zeile entfällt `pb-4` jetzt; das Hervorhebungs-Band nutzt dort `-bottom-2` statt `bottom-2`, um trotzdem exakt auf den Kreis zentriert zu bleiben
- Per `getBoundingClientRect()` verifiziert: Abstand oben/unten jetzt symmetrisch (12px/12px Workout-Roster, 16px/16px Verlauf-Karte), Kreis/Band-Zentrierung bei einer ausgewählten letzten Zeile weiterhin exakt (0px Abweichung)
- Details: [design-system.md](design-system.md#navigation) (Fünfzigste Iteration)

## 2026-09-06 (Verlauf-Reiter: Jahreszahl und Tages-Karten)

### Added
- Jahreszahl im Verlauf-Datum ergänzt ("Freitag, 04. September 2026" statt "Freitag, 04. September")
- Sätze pro Tag im Verlauf-Reiter mit einer grauen Karte (`bg-surface rounded-card`) hinterlegt, damit die Zugehörigkeit zu einem Workout-Tag optisch erkennbar ist — der Tages-Reiter bleibt bewusst kastenlos
- Details: [design-system.md](design-system.md#navigation) (Neunundvierzigste Iteration)

## 2026-09-06 (tracking-wide-Konflikt an drei text-label-Stellen behoben)

### Fixed
- `text-label` bringt eine feste Laufweite von 0.6px mit — an drei Stellen (Stepper-Beschriftung "GEWICHT (KG)"/"REPS", "ROUTINE: `<Name>`" in `workout-exercise-detail.js`, Übungsanzahl im Routine-Picker in `workout.js`) stand zusätzlich `tracking-wide` daneben und gewann durch denselben Kaskaden-Zufall wie beim Segmented-Tab-Schriftgewicht — Laufweite dadurch unbeabsichtigt auf 0.2875px verkleinert. `tracking-wide` entfernt
- Vermuteten Größenunterschied zwischen Segmented-Tab und Bottom-Nav/Eingabefeld-Beschriftung per Pixel-Messung geprüft: kein Code-Fehler, alle drei identisch groß (13.5px Zeilenhöhe)
- Details: [design-system.md](design-system.md#navigation) (Achtundvierzigste Iteration)

## 2026-09-06 (Segmented-Control-Schriftgewicht korrigiert)

### Fixed
- Segmented-Control-Tabs (Übungs-Detailseite) hatten Schriftgewicht 500 statt 600 wie die Bottom-Nav — verursacht durch eine überflüssige `font-medium`-Klasse neben `text-label` (das bereits 600 mitbringt), die per Kaskaden-Zufall gewann. Entfernt, Größe/Zeilenhöhe/Laufweite waren bereits identisch
- Details: [design-system.md](design-system.md#navigation) (Siebenundvierzigste Iteration)

## 2026-09-06 (Routinen-Optionen im Picker: Hintergrund und Übungsanzahl)

### Changed
- Hintergrund der Routinen-Zeilen im Auswahl-Popup (Workout-Tab) von `bg-base` auf `bg-surface` geändert — vorab live im Browser getestet, `#252525` gewählt (kaum Kontrast zum Popup-Hintergrund, bewusst)

### Added
- Übungsanzahl ("1 Übung"/"N Übungen") als zweite Zeile unter dem Routinen-Namen in jeder Options-Zeile, Schriftstil identisch zur "ROUTINE: `<Name>`"-Beschriftung auf der Übungs-Detailseite
- Details: [design-system.md](design-system.md#navigation) (Sechsundvierzigste Iteration)

## 2026-09-06 ("Delete"-Button in "Löschen" umbenannt)

### Changed
- Button-Label auf der Übungs-Detailseite: "Delete" heißt jetzt "Löschen" — reine Textänderung
- Details: [design-system.md](design-system.md#navigation) (Fünfundvierzigste Iteration)

## 2026-09-06 ("Update"-Button in "Ändern" umbenannt)

### Changed
- Button-Label auf der Übungs-Detailseite: "Update" (bei ausgewähltem Satz) heißt jetzt "Ändern" — reine Textänderung, "Speichern" (neuer Satz) unverändert
- Details: [design-system.md](design-system.md#navigation) (Vierundvierzigste Iteration)

## 2026-09-06 (Routine-Auswahl auf rounded-btn, rounded-btn-Radius auf 4px verkleinert)

### Changed
- Routine-Auswahl-Button im Workout-Tab von `rounded-full` auf `rounded-btn` umgestellt
- `rounded-btn`-Token (`index.html`, `tailwind.config`) von 13px auf 4px verkleinert — wirkt automatisch überall (Buttons, Inputs, kompakte Listenzeilen, Stepper-Eingabefeld)
- Details: [design-system.md](design-system.md#navigation) (Dreiundvierzigste Iteration)

## 2026-09-06 (bg-surface aufgehellt)

### Changed
- `bg-surface` von `#1E1E1E` auf `#252525` geändert (`index.html`, `tailwind.config`) — wirkt automatisch überall (Karten, Formulare, Listenzeilen)
- Die beiden `rgba(30,30,30,0.55)`-Stellen in `css/styles.css` (`#bottom-nav`, `.icon-btn-glass`), die als "halbtransparente Variante von bg-surface" außerhalb des Tokens dupliziert waren, auf `rgba(37,37,37,0.55)` nachgezogen, damit der Glass-Effekt weiterhin zur neuen Oberflächenfarbe passt
- Details: [design-system.md](design-system.md#navigation) (Zweiundvierzigste Iteration)

## 2026-09-06 (Zurück-Übergang auf reinen Fade reduziert)

### Changed
- `view-back-out` (View Transition beim Zurück-Navigieren, z. B. Zurück-Pfeil auf der Übungs-Detailseite) hatte zusätzlich zum Fade ein `translateY(0→16px)`-Slide nach unten — eine zweite, gezielt zum Zurück-Pfeil ausgewertete Bildschirmaufnahme (12 native Frames) zeigte, dass der reale Übergang ein reiner Fade ohne jede Bewegung ist. Slide entfernt
- Details: [design-system.md](design-system.md#navigation) (Einundvierzigste Iteration)

## 2026-09-06 (Doppel-Grün-Zeitraum beim Nav-Wechsel halbiert)

### Changed
- Nutzer-Feedback: gleichzeitiges volles Grün beider Tabs wirkte störend. Zweite, frame-genaue Auswertung derselben Bildschirmaufnahme (11 native Frames statt Kontaktbogen) bestätigte: Real gibt es keinen Moment mit zwei vollständig grünen Tabs, nur einen kurzen (~33ms), an die Glasform gekoppelten Wisch
- Umschaltpunkt für die Icon-Farbe von "Animationsende" auf "Hälfte der Laufzeit" vorgezogen — halbiert den wahrgenommenen Doppel-Grün-Zeitraum auf ca. 85ms
- Details: [design-system.md](design-system.md#navigation) (Vierzigste Iteration)

## 2026-09-06 (Nav-Indikator anhand einer echten Bildschirmaufnahme verfeinert)

### Changed
- Übergangsdauer des Nav-Indikators von 420ms auf 170ms reduziert — anhand einer per `ffmpeg` frame-genau ausgewerteten Bildschirmaufnahme einer Referenz-App gemessen (reale Animation dauert dort nur ca. 100-130ms)
- Icon-Farbe des alten Tabs bleibt jetzt bis zum Ende der Indikator-Animation erhalten (`animation.finished`-Callback), statt sofort beim Klick zu wechseln — während des gesamten Übergangs sind beide Tabs grün, wie in der Aufnahme zu sehen
- Details: [design-system.md](design-system.md#navigation) (Neununddreißigste Iteration)

## 2026-09-06 (Liquid-Glass-Animationen: Nav-Indikator, View-Transitions, Press-Feedback)

### Added
- Gleitender, morphender Indikator hinter dem aktiven Bottom-Nav-Tab (`#nav-indicator`) statt statischer Hintergrundfarbe auf dem Button selbst — Position/Breite per `getBoundingClientRect()` gemessen, Übergang als dreistufige `Element.animate()`-Sequenz (kurz strecken, dann auf Zielbreite zurückschnappen)
- View Transitions (`document.startViewTransition()`, Safari 18.2+) beim Öffnen/Schließen einer Navigationsebene: Übungs-Detailseite, Formulare in `exercises.js`/`routines.js`/`profile.js` — Skalierung+Fade beim Reingehen, Slide-nach-unten+Fade beim Zurückgehen
- Glas-Press-Feedback: `.icon-btn-glass` und der Nav-Indikator reduzieren beim Antippen kurz ihre Blur-Intensität
- `@media (prefers-reduced-motion: reduce)` deaktiviert alle neuen Animationen, zusätzlich in JS geprüft, bevor eine Animation überhaupt startet

### Changed
- Vor der Umsetzung geprüft, ob ein extern vorgeschlagener Ansatz (reiner `translateX`-Indikator) tatsächlich am besten geeignet ist — Mechanismus bestätigt, Choreografie auf ein "Morphen" statt reiner Bewegung verfeinert (s. Web-Recherche zu Apples Liquid-Glass-HIG)
- Details: [design-system.md](design-system.md#bewegung-liquid-glass-animationen) (Achtunddreißigste Iteration)

## 2026-09-06 (Kartenradius verkleinert: eckigeres Design)

### Changed
- `rounded-card` von 18px auf 4px verkleinert (`index.html`, `tailwind.config`) — Karten wirken jetzt als Rechtecke mit leicht abgerundeten Ecken statt stark gerundet. Vorab im Browser getestet (temporäres CSS-Override, ohne Datei-Änderung), erst nach Bestätigung übernommen
- Da `rounded-card` ein zentrales Token ist, wirkt die Änderung automatisch überall (Formulare, Übungs-Roster-Karten) — keine View musste einzeln angepasst werden
- `rounded-btn`/`rounded-full` unverändert
- Details: [design-system.md](design-system.md#navigation) (Siebenunddreißigste Iteration)

## 2026-09-06 (Alle übrigen Komponenten-Muster zentralisiert)

### Changed (Fälle #3–#8 aus der Design-System-Zentralisierung)
- Neue Klassen-Konstanten in `js/utils.js`: `BTN_SECONDARY`, `DESTRUCTIVE_LINK`, `CARD`, `LIST_ROW`, `TEXTLINK_ACTION` — ersetzen von Hand kopierte Klassen-Ketten in `exercises.js`, `profile.js`, `routines.js`, `workout.js`, `workout-exercise-detail.js`
- `.icon-btn-glass` (CSS) enthält jetzt Größe/Form (`44×44px`, `border-radius: 9999px`, zentriertes Flex-Layout) direkt, statt sie an beiden Verwendungsstellen als Tailwind-Utilities zu duplizieren
- Reine Refaktorierung ohne sichtbare Änderung, an allen betroffenen Bildschirmen per Screenshot verifiziert
- Details: [design-system.md](design-system.md#navigation) (Sechsunddreißigste Iteration)

## 2026-09-06 (Input als zentrale Klassen-Konstante)

### Changed (Fall #2 aus der Design-System-Zentralisierung)
- Input-Styling (`rounded-btn px-3 py-3 text-ink min-h-[44px]`) war an 5 Stellen in `exercises.js`, `profile.js`, `routines.js` von Hand kopiert — jetzt als `INPUT`-Konstante in `js/utils.js`. Hintergrundfarbe (`bg-base`/`bg-surface`) bleibt bewusst pro Stelle gesetzt, da kontextabhängig
- Reine Refaktorierung ohne sichtbare Änderung, per DOM-Vergleich verifiziert
- Details: [design-system.md](design-system.md#navigation) (Fünfunddreißigste Iteration)

## 2026-09-06 (Primärer Button als zentrale Klassen-Konstante)

### Changed (Fall #1 aus der Design-System-Zentralisierung)
- Primärer Button (`bg-accent text-base font-semibold rounded-btn`) war an 8 Stellen in `exercises.js`, `profile.js`, `routines.js` von Hand kopiert — jetzt als `BTN_PRIMARY`-Konstante in `js/utils.js`, von allen drei Views importiert und interpoliert
- Reine Refaktorierung ohne sichtbare Änderung, per DOM-Vergleich verifiziert
- Details: [design-system.md](design-system.md#navigation) (Vierunddreißigste Iteration)

## 2026-09-06 (Design-System-Audit: drei doku-interne Widersprüche behoben)

### Fixed (reine Doku-Korrektur, kein Code geändert)
- "Keine Trennlinien"-Passage behauptete fälschlich, `bg-red-600` sei noch aktuell im Einsatz für destruktive Aktionen — ist seit der Siebenundzwanzigsten Iteration nicht mehr der Fall, korrigiert
- "Accent-Grün ausschließlich für Auswahl-/Selektions-Zustände" (Achtzehnte Iteration) stand im Widerspruch zum neuen "Textlink (Aktion)"-Muster (Achtundzwanzigste Iteration) — historische Aussage entsprechend markiert, Farbtabelle ergänzt
- `bg-raised` als "Aktiver Tab-Hintergrund" war seit dem Glass-Effekt für die Bottom-Nav nicht mehr korrekt (transparente Variante dort) — auf den weiterhin zutreffenden Kontext (Segmented Control) präzisiert
- Details: [design-system.md](design-system.md#navigation) (Dreiunddreißigste Iteration)

## 2026-09-06 (Design-System-Audit: Glass-Look als Navigations-Standard dokumentiert)

### Fixed (reine Doku-Korrektur, kein Code geändert)
- "Bewusst nur die Bottom-Nav, sonst nichts" widersprach der später eingeführten "Icon-Button (Glass)"-Komponente (Zurück-Pfeil, Kalender-Icon nutzen denselben Blur-Effekt) — beide Aussagen standen unverändert nebeneinander im Dokument
- Umformuliert: Glass-Look ist der Standard-Stil für Navigations-Buttons (Bottom-Nav + Navigations-Icon-Buttons), nicht auf die Bottom-Nav beschränkt
- Details: [design-system.md](design-system.md#navigation) (Zweiunddreißigste Iteration)

## 2026-09-06 (Satz-Anzahl aus der Workout-Tab-Roster-Zeile entfernt)

### Removed
- Übungs-Karten im Workout-Tab zeigen nicht mehr die Satz-Anzahl (z. B. "2 Sätze") rechts neben dem Titel — die Anzahl ist an der Satz-Timeline darunter ohnehin ablesbar
- Dabei behoben: fehlerhafte Pluralbildung ("Satze" statt "Sätze" bei mehr als einem Satz)
- Details: [design-system.md](design-system.md#navigation) (Einunddreißigste Iteration)

## 2026-09-06 (Design-System-Audit: veraltetes "SÄTZE"-Beispiel entfernt)

### Fixed (Fall D aus dem Design-System-Audit — reine Doku-Korrektur, kein Code geändert)
- "SÄTZE" stand an zwei Stellen als Beispiel für eine großgeschriebene `text-label`-Sektionsüberschrift, kam laut Git-Historie aber nie in einer JS-Datei vor — anders als "ÜBUNGEN", das tatsächlich existiert (Routine-Editor). Beide Stellen korrigiert

## 2026-09-06 (Fälle C3 und C4 aus dem Design-System-Audit zurückgestellt)

### Notiz (keine Änderung)
- Der "✕"-Entfernen-Button in der Routine-Übungen-Zeile passt zu keinem dokumentierten Button-Muster — Entscheidung bewusst zurückgestellt, da der Routine-Editor als Workflow noch nicht fertiggestellt ist
- Das Umbenennen-Formular im Routine-Editor nutzt keinen Karten-Rahmen, obwohl das Anlegen einer neuen Routine denselben Vorgang als volles Karten-Formular zeigt — ebenfalls zurückgestellt, da sowohl der Routine-Editor- als auch der Übungen-Workflow noch nicht fertiggestellt sind
- Beide als offene Punkte festgehalten: [design-system.md](design-system.md#offene-punkte-aus-dem-design-system-audit)

## 2026-09-06 ("+"-Zeichen aus Textlink-Aktionen entfernt)

### Changed
- "Übung hinzufügen" (Workout-Tab und Routine-Editor) zeigt kein "+" mehr vor dem Label — die Akzentfarbe des Textlink (Aktion)-Musters macht die Klickbarkeit bereits deutlich
- Details: [design-system.md](design-system.md#navigation) (Dreißigste Iteration)

## 2026-09-06 ("Übung hinzufügen" im Workout-Tab: Platzhalter-Stil abgeschafft)

### Changed (Anschlussentscheidung zu Fall C2)
- "Übung hinzufügen" im Workout-Tab war grau/gedimmt/`disabled`, weil die Funktion dahinter noch nicht existiert — auf Nutzer-Entscheidung vereinheitlicht mit dem neuen Textlink (Aktion)-Muster (`text-accent text-body font-medium`), da eine Aktion keinen eigenen Stil bekommen soll, nur weil sie noch nicht gebaut ist
- Eigener Kreis-Outline-"+"-Indikator entfernt zugunsten eines einfachen "+" als Text, `disabled`-Attribut entfernt — der Button hat weiterhin keinen Klick-Handler (Funktion folgt separat), sieht jetzt aber wie eine aktive Aktion aus
- "Dezenter Icon-Link (Platzhalter)"-Muster in design-system.md als nicht mehr verwendet markiert
- Details: [design-system.md](design-system.md#navigation) (Neunundzwanzigste Iteration)

## 2026-09-06 (Design-System-Audit: Textlink-Aktionen vereinheitlicht)

### Changed (Fall C2 aus dem Design-System-Audit)
- "+ Übung hinzufügen" (Routine-Editor), "Heute" (großer Kalender) und "Alle Routinen anzeigen" (Routine-Picker) nutzten denselben Grundgedanken (akzentfarbener Textlink für eine echte Aktion), aber jeweils leicht andere Klassen — auf `text-accent text-body font-medium` vereinheitlicht
- Neues Muster "Textlink (Aktion)" in design-system.md dokumentiert
- Details: [design-system.md](design-system.md#navigation) (Achtundzwanzigste Iteration)

## 2026-09-06 (Design-System-Audit: Ausnahme von der "Keine Trennlinien"-Regel ergänzt)

### Fixed (Fall C1 aus dem Design-System-Audit — reine Doku-Korrektur, kein Code geändert)
- Die generelle Regel "Keine Trennlinien" (design-system.md:19) galt seit der Achten Iteration nicht mehr uneingeschränkt: Der "Heute"-Tag im großen Kalender nutzt bewusst einen umrandeten statt gefüllten Kreis (`border-2 border-accent`) — bereits dort begründet, aber in der allgemeinen Regel nicht als Ausnahme erwähnt
- Regel um einen Verweis auf diese eine bewusste Ausnahme ergänzt

## 2026-09-06 (Design-System-Audit: "Chip"-Muster als nicht mehr verwendet markiert)

### Fixed (Fall B aus dem Design-System-Audit — reine Doku-Korrektur, kein Code geändert)
- "Chip (Auswahl)" war in der Doku an vier Stellen als aktives Muster beschrieben (Farbtabelle, Radien-Tabelle, Komponenten-Muster, eine Iteration), existiert im Code aber nirgends mehr
- Ursache geklärt: Die "Exercise-Chips" gehörten zur Übungsauswahl im alten, session-basierten Trainings-Flow und wurden mit Commit `6031f58` (Umbau auf das heutige Tages-Modell, [ADR 0007](decisions/0007-workout-tab-tagesbasiertes-modell.md)) ersatzlos entfernt — die Doku wurde dabei nicht nachgezogen
- Alle vier Stellen jetzt korrigiert bzw. als "aktuell nicht verwendet" markiert (analog zu `rounded-badge`/`text-kpi`), Musterdefinition bleibt für eine mögliche spätere Wiederverwendung erhalten

## 2026-09-06 (Design-System-Audit: Radien-Tabelle vervollständigt)

### Fixed (Fall A2 aus dem Design-System-Audit — reine Doku-Korrektur, kein Code geändert)
- `rounded-lg` (Tageszahl im kleinen Wochenstreifen) fehlte in der Radien-Tabelle der Doku und wirkte dadurch wie ein nicht dokumentierter Streuwert. Tatsächlich bewusste, bereits in der Achten Iteration begründete Entscheidung: Wochenstreifen zeigt den hervorgehobenen Tag eckig, der große Kalender kreisförmig — beide Ansichten sollen sich hier bewusst unterscheiden
- Radien-Tabelle um `rounded-lg` ergänzt, mit Verweis auf die Achte Iteration

## 2026-09-06 (Design-System-Bereinigung: Primärer Button vereinheitlicht)

### Changed (Fall A1 aus dem Design-System-Audit)
- Primärer Button (`bg-accent`) war je nach View unterschiedlich fett (`font-bold` in profile.js, `font-semibold` in exercises.js/routines.js) — auf `font-semibold` (600) vereinheitlicht, passend zum bereits an anderer Stelle dominanten Gewicht (`text-card-title`). h1-Überschriften (`text-screen-title`) bleiben bewusst bei `font-bold`
- Destruktiver "Profil entfernen"-Button (`bg-red-600`) auf den Primären Button umgestellt — greift den seit der Siebzehnten Iteration vorgemerkten, aber nie entschiedenen Gesprächspunkt zur Buttons-Neugestaltung auf. Löschen bleibt weiterhin über `confirm()` abgesichert, nur ohne zusätzliche rote Warnfarbe
- Details: [design-system.md](design-system.md#navigation) (Siebenundzwanzigste Iteration)

## 2026-09-06 (Gewicht-/Reps-Boxen verbreitert)

### Fixed (dreistellige Reps überfüllten ihre feste Box, Abstand zur Einheit dadurch uneinheitlich)
- Nutzer-Beobachtung: Abstand zwischen Zahl und Einheit wirkte in manchen Zeilen ungleichmäßig
- Ursache: Die feste Reps-Box (`w-6` = 24px) war zu schmal für dreistellige Werte wie "999" (natürliche Breite ca. 26.3px) — die Zahl überfüllte die Box, wodurch der feste 4px-Abstand auf ca. 1.7px zusammenschrumpfte
- Behoben, indem beide Boxen komfortabel breiter gemacht wurden, als realistische Extremwerte je brauchen (`w-12`→`w-16` für Gewicht, `w-6`→`w-8` für Reps), statt die genaue Overflow-Mechanik von `text-align: right` bei überfüllten Boxen abschließend zu klären
- Mit `getBoundingClientRect()` erneut verifiziert: Abstand exakt 4px in jeder Zeile (Gewicht und Reps, Werte "5"/"3" bis "999.5"/"999"), in Roster-Zeile, Tages-Reiter und Verlauf-Reiter gleichermaßen
- Details: [design-system.md](design-system.md#navigation) (Sechsundzwanzigste Iteration)

## 2026-09-05 (Reps-Spalte bündig, verfeinert)

### Fixed (Gewicht/Reps-Spalten nicht mehr verschoben bei unterschiedlicher Ziffernzahl)
- Reps-Spalte verschob sich je nach Länge des Gewichtswerts (z. B. "5 kg" vs. "999.5 kg") — Ursache: Der Gewichts-Span hatte keine feste Breite, nur der Abstand danach war konstant
- Erster Fix: gemeinsame Funktion `renderSetValues()` (`js/utils.js`) gab dem gesamten Gewichts-Textblock eine feste Breite

### Changed (Zahlen rechtsbündig, Einheiten grau)
- Auf Nutzer-Wunsch verfeinert: Zahl steckt jetzt in einer eigenen rechtsbündigen, fest breiten Box, die Einheit (`kg`/`Reps`) folgt direkt danach in `text-muted` — Zahl dadurch optisch leichter erfassbar, Einheiten landen automatisch an derselben Kante über alle Zeilen hinweg
- Mit stark unterschiedlichen Testwerten (5 / 62.5 / 999.5 kg, 3 / 12 / 999 Reps) verifiziert: sowohl Zahlen als auch Einheiten exakt bündig, in Roster-Zeile und Übungs-Detailseite gleichermaßen
- Details: [design-system.md](design-system.md#navigation) (Vierundzwanzigste/Fünfundzwanzigste Iteration)

## 2026-09-05 (Auswahl-Hervorhebung final, Teil 4)

### Fixed (Band wieder dicker, ohne die Zentrierung zu verlieren)
- Die letzte Korrektur hatte die Zentrierung repariert, dabei aber unbeabsichtigt auch die Dicke des Hervorhebungs-Bands wieder auf die reine 24px-Kreishöhe reduziert
- Band ist jetzt wieder deutlich dicker (40px statt 24px, 8px symmetrisch oben und unten) — da Kreis und Inhalts-Box jetzt strukturell denselben Mittelpunkt haben, bleibt die Zentrierung dabei erhalten (0px Abweichung verifiziert)
- Details: [design-system.md](design-system.md#navigation) (Dreiundzwanzigste Iteration)

## 2026-09-04 (Auswahl-Hervorhebung final, Teil 3)

### Fixed (Kreis, Band und Text exakt zueinander zentriert)
- Kreis (24px), Hervorhebungs-Band und Text waren weiterhin leicht (unter 2px) zueinander versetzt — Ursache: Kreis und Textzeile hatten unterschiedliche Höhen, beide aber oben bündig ausgerichtet
- Inhalts-Bereich steckt jetzt strukturell in einer ebenfalls exakt 24px hohen Box (statt einem beliebigen Höhen-Zuschlag zu folgen) — Kreis, Band und Text liegen dadurch exakt (0px Abweichung, mit `getBoundingClientRect()` verifiziert) auf derselben Mittelachse
- Details: [design-system.md](design-system.md#navigation) (Zweiundzwanzigste Iteration)

## 2026-09-04 (Auswahl-Hervorhebung final, Teil 2)

### Fixed (Band dicker, kein zusätzlicher grauer Kreis mehr)
- Hervorhebungs-Band saß zu knapp am Text, jetzt mit 8px zusätzlichem Raum oben und unten
- Nummern-Kreis bleibt bei Auswahl unverändert (kein zusätzlicher `bg-raised`-Fond mehr) — Auswahl wird ausschließlich über das Band angezeigt
- Details: [design-system.md](design-system.md#navigation) (Einundzwanzigste Iteration)

## 2026-09-04 (Auswahl-Hervorhebung final)

### Fixed (Zeilen-Sprung beim Auswählen behoben, Hervorhebung bildschirmbreit)
- Satz-Zeilen "sprangen" beim Auswählen — der Auswahl-Pill hatte eigenes Padding, das nur im ausgewählten Zustand existierte und dadurch die Zeilenhöhe veränderte
- Auswahl-Hervorhebung ist jetzt ein randloses, bildschirmbreites, eckiges Band hinter Kreis und Text (wie in der Referenz-App) statt eines schmalen Pills um den Text — umgesetzt als eigenes `position: absolute`-Element (`highlighted`-Parameter in `renderSetTimelineRow()`), dadurch komplett ohne Einfluss auf die Zeilenhöhe
- Details: [design-system.md](design-system.md#navigation) (Zwanzigste Iteration)

## 2026-09-04 (noch mehr Feinschliff)

### Fixed (Tap-Animation entfernt, Auswahl-Hervorhebung zentriert)
- Satz-Zeilen (Tages-Reiter der Übungs-Detailseite) haben keine Tap-Animation mehr — wirkte beim Auswählen zusammen mit der grauen Hervorhebung störend
- Graue Auswahl-Hervorhebung saß nicht mittig zur Schrift, da sie die ganze Zeile inkl. des unteren Platzes für die Verbindungslinie mit eingefärbt hat. Sitzt jetzt auf einem eng um den Text gelegten Pill statt auf der ganzen Zeile — 0px Abweichung zur Kreis-Mitte verifiziert
- Details: [design-system.md](design-system.md#navigation) (Neunzehnte Iteration)

## 2026-09-04 (Referenz-App-Abgleich, Feinschliff)

### Changed (Bestätigungsdialog entfernt, graue Auswahl, keine Kästen mehr)
- Satz-Löschen läuft jetzt ohne Bestätigungsdialog (auf Nutzer-Wunsch, Ausnahme von der sonstigen Löschen-Konvention, s. CLAUDE.md)
- Ausgewählte Satz-Zeile auf der Übungs-Detailseite jetzt grau (`bg-raised`) statt grün (`ring-accent`) hinterlegt
- Satz-Liste und Eingabebereich (Stepper/Buttons/Routine-Label) sitzen jetzt direkt auf dem Seiten-Hintergrund statt in einer `bg-surface`-Box — näher an der Referenz-App. Gilt für Tages- und Verlauf-Reiter; die Roster-Karten im Workout-Tab bleiben unverändert eigene Karten
- Details: [design-system.md](design-system.md#navigation) (Achtzehnte Iteration), [ADR 0010](decisions/0010-uebungs-detailseite.md)

## 2026-09-04 (Referenz-App-Abgleich)

### Changed (Design-System-Anpassungen nach Referenz-Screenshots)
- Update/Delete-Buttons auf der Übungs-Detailseite auf neutralen Sekundär-Button-Stil (`bg-raised text-ink`) umgestellt statt Accent-Grün/Rot — erster echter Anwendungsfall für das bisher ungenutzte Sekundär-Button-Muster. Eine mögliche spätere Neugestaltung der übrigen App-Buttons wurde nur vorgemerkt, nicht entschieden
- Neuer kreisförmiger "Glass"-Icon-Button-Stil (Liquid-Glass wie die Bottom-Nav) für Zurück-Pfeil und Kalender-Icon
- Gewicht-/Reps-Stepper: Label jetzt über statt neben der Eingabezeile, beide Stepper nebeneinander
- Neue gemeinsame Komponente `renderSetTimelineRow()` (`js/utils.js`): nummerierte Satz-Kreise mit Verbindungslinie, jetzt einheitlich in Roster-Zeile, Tages- und Verlauf-Reiter der Übungs-Detailseite verwendet — löst dabei auch die erst kurz zuvor eingeführte kompakte " · "-Zusammenfassung in der Roster-Zeile wieder ab (volle Liste stattdessen)
- Satz-Notation vereinheitlicht: "35 kg" / "10 Reps" (getrennt) statt "35 kg × 10"
- Bewusst nicht übernommen (neue Funktionen, außerhalb des Scopes dieser reinen Design-Anpassung): Kamera-Icon, RPE, Einheiten-Umschalter, Stift-/Timer-Icon, Routine-Ziel-Anzeige, PR-Badge, zusätzlicher Routinen-Link, neuer Kopfbereich
- Details: [design-system.md](design-system.md#navigation) (Siebzehnte Iteration)

## 2026-09-04 (spät, nach Abschnitt 12)

### Changed ("Reps" statt "Wdh.", Satz-Daten in der Roster-Zeile)
- Stepper-Label auf der Übungs-Detailseite von "Wdh." auf "Reps" geändert
- Roster-Zeile im Workout-Tab zeigt jetzt die tatsächlichen Satz-Werte (z. B. "50 kg × 10") unter dem Titel, nicht mehr nur die Anzahl
- Details: [design-system.md](design-system.md#navigation) (Sechzehnte Iteration)

## 2026-09-04 (Nacht, Abschnitt 12)

### Added (Übungs-Detailseite)
- Tap auf eine Übung im Workout-Tab öffnet jetzt eine eigene Unterseite (`js/views/workout-exercise-detail.js`) statt wie zuvor inline zu expandieren — Zurück-Pfeil, Übungstitel, Segmented Control mit drei Reitern (aktueller Tag/Verlauf/Statistik)
- Reiter "aktueller Tag": Gewicht/Wiederholungen per Minus-/Plus-Stepper (1-kg- bzw. 1er-Schritte) oder direkter Eingabe, Vorbelegung mit dem zuletzt erfassten Wert dieser Übung. Tap auf einen bestehenden Satz lädt ihn zur Bearbeitung ("Update"-Button, "Delete" aktiv); ohne Auswahl "Speichern", "Delete" deaktiviert. Anzahl leerer Platzhalter-Zeilen kommt aus einer eigenen Konstante (`DEFAULT_SET_COUNT = 3`) statt fest verankert zu sein. Routinen-Herkunft wird als "ROUTINE: `<Name>`" angezeigt
- Reiter "Verlauf": frühere Workout-Tage dieser Übung, gruppiert nach Datum, neueste zuerst, rein informativ
- Reiter "Statistik": Platzhalter ohne Funktion
- `updateSet()` in `db.js` wieder eingeführt (war mit ADR 0007 als Konsequenz des Verlauf-Wegfalls entfernt worden) — jetzt über den "Update"-Button möglich
- Neue Abfrage `getExerciseSetHistory()` in `db.js` für den Verlauf-Reiter
- Satz-Löschen verlangt jetzt einen Bestätigungsdialog (vorher nicht, kleine Lücke gegenüber der sonst schon geltenden Projekt-Konvention)
- Details und Architektur-Entscheidung: [ADR 0010](decisions/0010-uebungs-detailseite.md), [design-system.md](design-system.md#navigation) (Fünfzehnte Iteration)

## 2026-09-04 (kurz danach)

### Fixed (Routine-Picker: Leerstand-Text ausgerichtet)
- "Noch keine Routinen vorhanden." hatte kein horizontales Padding, "Alle Routinen anzeigen" darunter dagegen `px-3` — Text begann 12px weiter links. Beide beginnen jetzt auf derselben Linie
- Details: [design-system.md](design-system.md#navigation) (Vierzehnte Iteration)

## 2026-09-04 (noch später)

### Changed (Heutiger Tag im großen Kalender immer nur umrandet)
- Der heutige Tag zeigt jetzt in jedem Fall nur den ungefüllten Kreis (Rand) — auch wenn er zugleich ausgewählt ist oder bereits Sätze dokumentiert sind. Vorher hatten Auswahl/Dokumentation Vorrang, jetzt "heute" unbedingten Vorrang vor beidem
- Betrifft nur den großen Kalender, die kleine Kalenderzeile bleibt unverändert
- Details: [design-system.md](design-system.md#navigation) (Dreizehnte Iteration)

## 2026-09-04 (nach Mitternacht)

### Changed ("Heute"-Button, Bottom-Nav bei offenem Kalender-Sheet)
- "Heute"-Button im Kalender-Sheet scrollt jetzt nur noch zum aktuellen Monat, statt zusätzlich den Tag auszuwählen und das Sheet zu schließen (mit sanfter Scroll-Animation statt hartem Sprung)
- Bottom-Nav bleibt sichtbar und bedienbar, während das Sheet offen ist, statt komplett vom Backdrop verdeckt zu werden (gezielter, nur während des Sheet-Lebenszyklus gesetzter z-index) — Kalender bekommt dafür zusätzlichen unteren Freiraum (denselben Wert, den die Nav app-weit schon reserviert)
- Neuer optionaler `unmount()`-View-Hook (`workout.js`, aufgerufen von `app.js`s `showView()`): notwendig, weil jetzt auch bei offenem Kalender-Sheet der Tab gewechselt werden kann — ohne den Hook blieben Body-Scroll-Sperre und Nav-z-index sonst hängen, und ein ausstehender Schließen-Timeout hätte nachträglich eine andere View überschrieben
- Details: [design-system.md](design-system.md#navigation) (Zwölfte Iteration), [architecture.md](architecture.md#view-pattern)

## 2026-09-04 (spät Nacht)

### Fixed (Kalender-Sheet: doppeltes Safe-Area-Padding zurückgenommen)
- Der Body-Lock-Fix hat den unteren grauen Balken korrekt behoben, aber ein neues Problem sichtbar gemacht: großer Leerraum zwischen oberer Sheet-Kante und Kopfzeile
- Ursache: `padding-top: max(8px, env(safe-area-inset-top))` zählte die Dynamic-Island-Aussparung doppelt — das Sheet startete ja bereits unterhalb der Insel, das zusätzliche Padding schob die Kopfzeile um eine weitere Insel-Höhe nach unten
- Zurückgesetzt auf festes `pt-3` (12px) statt der `env()`-Berechnung
- Details: [design-system.md](design-system.md#navigation) (Elfte Iteration)

## 2026-09-04 (Nacht)

### Fixed (Kalender-Sheet: eigentliche Ursache des Safe-Area-Bugs gefunden)
- Der vorherige Fix (dvh + Safe-Area-Padding) hat das Problem auf dem echten Gerät nicht behoben — zusätzlich wurde jetzt auch ein Scroll-Versatz beim Öffnen sichtbar (August lugte über September hervor), der sich erstmals auch in der Test-Umgebung reproduzieren ließ
- Eigentliche Ursache: `lockBodyScroll()` setzte `document.body` auf `position: fixed` — das beeinflusste auf WebKit nachweislich die Positionierung/Größe des ebenfalls `position: fixed`-Sheets (zu weit unten, Bottom-Kante nicht exakt an `bottom: 0`, dadurch auch die Scroll-zu-Zielmonat-Berechnung beim Öffnen daneben)
- body-Lock umgestellt auf `overflow: hidden` + gezielten `touchmove`-Blocker (lässt `#calendar-sheet-months` explizit durch) — body verlässt dadurch nie den normalen Fluss, kein `scrollY`-Merken/Wiederherstellen mehr nötig
- In der Test-Umgebung verifiziert: Sheet sitzt exakt an `bottom: 0`, Scroll-Ausrichtung zum Zielmonat 0px daneben (vorher nicht reproduzierbar, jetzt tatsächlich gemessen und bestätigt)
- Details: [design-system.md](design-system.md#navigation) (Zehnte Iteration)

## 2026-09-04 (Abend)

### Fixed (Kalender-Sheet: Safe-Area auf echtem Gerät)
- Sheet-Header lag teilweise hinter der Dynamic Island, am unteren Rand blitzte die Bottom-Nav durch — auf echtem iPhone gemeldet, in der (Chromium-basierten) Test-Umgebung mangels Notch-Simulation nicht reproduzierbar
- `height: 88vh` um `height: 88dvh` ergänzt (vh bleibt Fallback) — `dvh` ist für genau diese Art von iOS-Safari-Viewport-Unschärfe gedacht, möglicherweise verstärkt durch den `position: fixed`-Body-Lock aus der vorherigen Änderung
- Sheet-Header bekommt explizites `padding-top: max(8px, env(safe-area-inset-top))`, statt sich auf die 88%-Höhen-Berechnung zur Notch-Freihaltung zu verlassen
- Details: [design-system.md](design-system.md#navigation) (Neunte Iteration)

## 2026-09-04 (Nachmittag)

### Fixed / Changed (Kalender-Sheet-Feinschliff nach echtem Test)
- Grüner Kreis statt kleinem Punkt für Tage mit dokumentierten Sätzen im großen Kalender — der Punkt war optisch nicht auffällig genug. "Heute" bekommt einen ungefüllten Kreis (nur Rand), Auswahl/dokumentierte Tage haben bei Überlapp Vorrang vor der Heute-Markierung
- Ruckeln beim ersten Hochscrollen behoben: Lazy-Nachladen weiterer Monate beim Scrollen (ADR 0008) durch vollständiges Vorab-Rendern des gesamten Zeitraums ersetzt (ADR 0009) — Ursache war eine asynchrone DB-Abfrage pro nachgeladenem Monat mitten in der Scroll-Geste
- Hintergrund-Scrollen des Workout-Tabs während offenem Sheet gesperrt (iOS-sicherer `position: fixed`-Lock) — behebt auch das gemeldete Problem, dass sich nach einmaligem Workout-Tab-Scroll nur noch der Tab statt des Kalenders scrollen ließ (gleiche Ursache: Touch-Bleed-Through durch den weiterhin scrollbaren Body hinter dem Fixed-Overlay)
- Drag-to-Dismiss am Ziehgriff ergänzt (nach unten wegziehen schließt das Sheet, mit Rückspring unterhalb eines Schwellenwerts)
- "Heute"-Button oben rechts im Sheet-Header ergänzt — springt direkt zum aktuellen Tag
- Backdrop fadet jetzt weich ein/aus (220ms, synchron zur Sheet-Animation) statt hart zu erscheinen/verschwinden
- Details: [design-system.md](design-system.md#navigation), [ADR 0009](decisions/0009-grosser-kalender-vollstaendiges-rendern.md)

## 2026-09-04

### Added (Großer Kalender im Workout-Tab, Abschnitt 11)
- Kalender-Icon-Button im Workout-Tab öffnet jetzt ein großes Bottom-Sheet (88vh, `rounded-sheet`) mit einem vertikal scrollenden, monatsweisen Kalender — ersetzt den bisherigen nativen `<input type="date">`-Zwischenstand vollständig
- Erlaubter Zeitraum: fest ab Januar 2026, bis einen Monat über den aktuellen Kalendermonat hinaus (dynamisch berechnet). Navigation ausschließlich per Scrollen, keine Pfeil-Buttons
- Monate werden nicht alle auf einmal gerendert: beim Öffnen nur Zielmonat ±1, weitere Monate werden erst beim Erreichen des Scroll-Rands nachgeladen (direkte DOM-Manipulation statt vollem Re-Paint, um die Scroll-Position zu erhalten). Details und Abwägung: [ADR 0008](decisions/0008-grosser-kalender-lazy-loading.md)
- Tap auf einen Tag schließt das Sheet, springt zu diesem Tag und zentriert die kleine Kalenderzeile neu
- Erste echte Bottom-Sheet-Komponente der App (Slide-up-Animation, abdunkelnder Backdrop) — etabliert das Muster für zukünftige Sheets, `rounded-sheet`-Token dadurch erstmals im Einsatz
- Details: [design-system.md](design-system.md#navigation), [features.md](features.md#workout-jsviewsworkoutjs--kernfunktion)

## 2026-08-30

### Changed (Routine entfernen per Toggle)
- Separaten "Keine Routine (entfernen)"-Button im Routine-Picker entfernt — erneuter Klick auf die bereits ausgewählte Routine (✓) entfernt sie jetzt stattdessen. Mit bereits begonnener Übung getestet: bleibt beim Entfernen korrekt erhalten. Details: [design-system.md](design-system.md#navigation)

### Fixed (Kalender-Layout korrigiert, X-Icon vergrößert)
- Vorheriger Ausrichtungs-Fix (items-start/items-end auf gleich breiten Grid-Spalten) war funktional 0px daneben, aber optisch falsch — brach die Zentrierung von Wochentag-Text und Tageszahl zueinander. Richtig gelöst mit `flex justify-between`: alle 7 Tage bleiben einheitlich in sich zentriert, werden als Ganzes gleichmäßig über die Breite verteilt (Montag/Sonntag landen dadurch automatisch an den Rändern). Verifiziert: 0px Randabweichung **und** exakt gleicher Abstand zwischen allen Tagen
- X-Balken des Dropdown-Icons vergrößert (7px→10px), Zentrierung von festem `margin-left` auf `translateX(-50%)` umgestellt, damit sie der jetzt mitanimierten Balkenbreite folgt
- Details: [design-system.md](design-system.md#navigation)

### Fixed / Added (Kalender-Inhaltsausrichtung, Icon-Animation)
- Montag-/Sonntag-**Inhalt** (Wochentag-Text, Tageszahl) war innerhalb seiner Spalte zentriert und wirkte dadurch eingerückt, obwohl die Spalte selbst schon pixelgenau lag — erste Spalte jetzt linksbündig, letzte rechtsbündig
- Chevron-zu-X-Morph-Animation für das Dropdown-Icon der Routine-Auswahl (zwei Balken schieben sich beim Öffnen zusammen, beim Schließen wieder auseinander, synchron mit der Popup-Animation)
- Details: [design-system.md](design-system.md#navigation)

### Fixed (Kalender-Randausrichtung)
- Montag/Sonntag lagen nur in der zuletzt sichtbaren Woche pixelgenau an "Workout"-Überschrift bzw. Kalender-Icon an — in den übrigen Wochen 16px zu weit links, weil `scrollIntoView`/`scroll-snap` das eigene Container-Padding ignorierten. Behoben mit `scroll-padding` (`scroll-px-4`) statt einer JS-Heuristik; `gap` zwischen Wochenblöcken durch einen expliziten Abstandshalter-Div ersetzt (Safari/WebKit spielt `gap` + `scroll-snap` nicht immer zuverlässig zusammen). Für alle drei Wochen einzeln auf 0px Abweichung verifiziert. Details: [design-system.md](design-system.md#navigation)

### Changed (Workout-Tab Feinschliff Runde 3)
- Kalenderzeile zeigt nur noch ±1 Woche (Vorwoche/Folgewoche) statt ±2 Wochen
- Kalenderzeile von Flex-Prozent-Basis auf Wochenblöcke (CSS Grid) umgestellt — behebt einen angeschnitten sichtbaren nächsten Montag am rechten Rand (Rundungsfehler der vorherigen Prozent-Basis-Berechnung)
- Größerer Abstand (`gap-6`) zwischen den Wochenblöcken zur besseren Orientierung beim Wechsel zwischen Sonntag und Montag
- Routine-Popup poppt jetzt beim Öffnen aus der Dropdown-Pille heraus und beim Schließen wieder hinein (CSS-Keyframe-Animation, zweistufiges Schließen in `workout.js` für eine echte Exit-Animation trotz Full-Rerender-Modell)
- Details: [design-system.md](design-system.md#navigation)

### Changed (Workout-Tab Feinschliff Runde 2)
- Heute-Markierung im Kalender: Tageszahl wird grün, wenn heute nicht ausgewählt ist; bei Auswahl bleibt es beim Accent-Badge mit dunkler Zahl
- Kalenderzeile rastet jetzt pro voller Mo-So-Woche ein (`scroll-snap-align` nur auf Montags-Buttons) statt frei zu scrollen
- "Routinen"-Link neben der Routine-Auswahl entfernt
- Routine-Picker ist jetzt ein echtes Overlay (verdrängt den restigen Inhalt nicht mehr nach unten), schließt per Backdrop-Klick oder per X-Icon (ersetzt den Chevron bei geöffnetem Picker) statt über einen "Abbrechen"-Button; "Alle Routinen anzeigen" als neuer Eintrag innerhalb des Popups
- Details: [design-system.md](design-system.md#navigation)

### Changed (Workout-Tab UI-Feinschliff nach Referenz-Screenshots)
- Kalenderzeile ohne Einzel-Pill-Hintergrund pro Tag: nur die ausgewählte Tageszahl bekommt ein Accent-Badge, Wochentag als reiner Text. `scroll-snap` sorgt für ein Wochen-Swipe-Gefühl bei weiterhin durchgehendem ±2-Wochen-Scroll
- Relative Datumsbezeichnung ("Heute"/"Gestern"/"Morgen, {Datum}") statt durchgängig vollem Wochentag
- Routine-Auswahl als Dropdown-Pill + separater "Routinen"-Link (navigiert zum Routinen-Tab) statt "Wechseln"/"Entfernen"-Buttons; "Routine entfernen" jetzt als Option im Popup
- Nummerierte Sätze in der aufgeklappten Übungs-Karte
- "+ Übung hinzufügen" als dezenter, zentrierter Icon-Link statt voller Button — bleibt weiterhin reiner Platzhalter ohne Funktion
- Bewusst ignoriert: Statistics-/Premium-Tab, KI-Routine-Generierung/Wochenplanung, Zitat des Tages, Schloss-/Weight-Badge, Ziel-Satz-Zeile — keine dieser Funktionen existiert in Fitlog, letztere beide sind laut Konzept-Erweiterung Abschnitt 10 explizit ausgeschlossen. Details: [design-system.md](design-system.md#komponenten-muster)

### Added / Changed (Workout-Tab, Abschnitt 10)
- Training-Tab durch neuen **Workout-Tab** ersetzt: Kalenderzeile (±2 Wochen um den ausgewählten Tag, automatisch zentriert, grüner Punkt an dokumentierten Tagen), natives Datums-Picker für Tage außerhalb des Fensters, Routine wählen/wechseln/entfernen als Popup-Liste, aufklappbares Übungs-Roster mit dynamischer Sortierung (begonnene Übungen zuerst nach Bearbeitungszeitpunkt, s. [ADR 0007](decisions/0007-workout-tab-tagesbasiertes-modell.md))
- Datenmodell: `workouts` bekommt ein `date`-Feld (Kalendertag statt Session-Start), neue Tabelle `workoutExercises` als Übungs-Roster pro Workout (Dexie-Schema auf Version 2)
- Lösch-Kaskaden erweitert: `deleteExercise`/`deleteRoutine` räumen jetzt auch unbegonnene `workoutExercises`-Einträge auf

### Removed (Workout-Tab, Abschnitt 10)
- **Verlauf-Tab entfernt** — der Kalender im Workout-Tab übernimmt diese Aufgabe (Entscheidung des Nutzers, ging über das Briefing hinaus)
- **Kein "Training beenden" mehr** — jeder Tag bleibt dauerhaft offen/bearbeitbar, `startedAt`/`finishedAt` auf `workouts` werden nicht mehr verwendet (Entscheidung des Nutzers)
- `startWorkout`, `finishWorkout`, `updateSet` aus `db.js` entfernt (Grundannahmen entfallen bzw. keine Aufrufstelle mehr). Als Konsequenz: nachträgliches Bearbeiten eines bereits erfassten Satz-Werts ist aktuell nicht mehr möglich (nur Hinzufügen/Löschen)

### Added (Zoom deaktiviert)
- Pinch- und Doppeltipp-Zoom unterbunden für ein native-app-ähnlicheres Bediengefühl: `touch-action: manipulation` auf `html`/`body` (Scrollen bleibt erlaubt), Viewport-Meta-Tag um `maximum-scale=1, user-scalable=no` ergänzt als Absicherung für andere Browser. Separat: globale `input { font-size: 16px }`-Regel gegen das automatische iOS-Zoom-in beim Fokussieren kleiner Eingabefelder. Bewusster Accessibility-Trade-off für privaten, kleinen Nutzerkreis, s. [architecture.md](architecture.md#pwa-mechanik)

### Added (Scrim hinter Glass-Nav)
- Abdunkelnder Verlaufs-Layer (`.nav-scrim`) zwischen Scroll-Inhalt und Bottom-Nav ergänzt, damit die durchscheinende Bar auch vor hellem/unruhigem Inhalt lesbar bleibt — eigenständig vom `backdrop-filter` der Bar, `pointer-events: none`, explizites Z-Index-Layering (Inhalt < Scrim < Nav). Details: [design-system.md](design-system.md#navigation)

### Changed (Glass-Effekt Bottom-Nav)
- Bottom-Navigation von deckendem `bg-surface` auf halbtransparenten Liquid-Glass-Look umgestellt (`backdrop-filter: blur(20px) saturate(160%)`, transparenter Hintergrund, Glaskanten-Rand, Specular-Highlight per `box-shadow`). Ausschließlich die Nav betroffen, alle anderen Komponenten bleiben deckend. Details: [design-system.md](design-system.md#navigation)

### Changed (Design-Überarbeitung)
- Komplettes visuelles Redesign nach Briefing (Farben, Typografie, Radien, Abstände, Navigation) — reine Optik, keine Funktions-/Datenmodell-Änderung. Neue Palette (`#121212`/`#1E1E1E`/`#2A2A2A`/`#A3E635`/`#F5F5F5`/`#9B9BA1`), Bottom-Nav jetzt freischwebende Pillenform mit eigenen Icons statt vollflächigem Balken mit Text-only-Tabs, keine sichtbaren Trennlinien mehr (Abgrenzung nur über Hintergrundkontrast). Tokens zentral im inline `tailwind.config` in `index.html` (kein `tailwind.config.js`, s. ADR 0002). Details, Token-Tabellen und bewusst nicht umgesetzte Komponenten (Bottom-Sheet, Segmented Control, Charts — keine Entsprechung im aktuellen Funktionsumfang): [design-system.md](design-system.md)
- `manifest.json` Theme-/Background-Farbe an die neue Palette angeglichen (`#121212`)

### Fixed
- Service-Worker-Install nutzte `cache.addAll()` mit reinen URLs statt `cache: 'reload'`-Requests, wodurch der normale Browser-HTTP-Cache stellenweise veraltete Dateien lieferte, obwohl die Service-Worker-Cache-Version bereits hochgezählt war — fiel während der Design-Überarbeitung auf, betrifft aber grundsätzlich jedes Update, nicht nur diese Änderung

### Fixed (neu)
- Home-Bildschirm-App (standalone) hat neue Versionen nie von selbst übernommen, obwohl ein normaler Safari-Tab sie sofort zeigte. Ursache: iOS prüft bei standalone-PWAs deutlich seltener auf Service-Worker-Updates. Behoben durch expliziten `registration.update()`-Aufruf bei App-Start/`visibilitychange` plus automatischem Reload bei `controllerchange`. Lokal mit simuliertem Update verifiziert. **Hinweis**: Diese Änderung muss selbst erst einmal manuell (über Safari) auf die Geräte kommen, bevor sie für künftige Updates automatisch greift.

### Added
- Dokumentationsstruktur (`docs/`, ADRs, dieses Changelog, `README.md`, `CLAUDE.md`)
- Privates Repo `fitlog-infra` für Netzwerk-/Infrastruktur-Doku angelegt (getrennt vom öffentlichen `fitlog`-Repo)
- Nicht-funktionale Anforderungen (Browser-Scope, HTTPS, Performance, Robustheit) in `architecture.md` nachgetragen, waren bei der ersten Migration übersehen worden
- "Profil"-Tab (Username + Token, lokal via `localStorage`) als Vorbereitung für den geplanten Sync — Token-basierte Nutzertrennung ohne vollwertiges Login-System, s. [ADR 0006](decisions/0006-token-basierte-nutzertrennung.md). Sync selbst noch nicht aktiv, da kein Backend existiert.
- Profil-Tab: dedizierte Anzeige-Ansicht (aktuelles Profil + "Profil entfernen") und Leer-Zustand (Hinweis + "Profil hinzufügen") statt nur einem Formular

### Fixed
- Profil-Formular ließ sich komplett leer speichern (fehlende `required`-Attribute)
- Sichtbarkeits-Toggle fürs Token-Feld baute den Screen bei jedem Klick aus dem `localStorage` statt aus den aktuell getippten Werten neu auf, wodurch ungespeicherte Eingaben verloren gingen — Toggle komplett entfernt, Token ist jetzt unmaskiert
- Styling von "Profil entfernen" an "Profil hinzufügen" angeglichen (voller Button statt Textlink, rot statt grün)

### Korrigierte Fehldiagnose
- "Profil entfernen" wirkte beim Testen funktionslos — kurzzeitig wurde deswegen der Bestätigungsdialog entfernt. Ursache war aber kein Bug: `confirm()` wird in der automatisierten Browser-Testumgebung sofort mit "Abbrechen" beantwortet, ohne dass ein Dialog sichtbar wird. In einem echten, von einem Menschen bedienten Browser (z. B. Safari auf dem iPhone) funktioniert `confirm()` normal. Bestätigungsdialog wieder eingebaut, jetzt korrekt mit simuliertem "OK" verifiziert.

### Removed
- Home-Tab mit tageszeitabhängigem Spruch (deterministisch ausgewählt, Playfair-Display-Font lokal eingebunden) — vollständig implementiert, dann auf ausdrücklichen Wunsch per `git revert` wieder entfernt. Kein funktionaler Nutzen für den aktuellen Scope.

### Fixed
- App-Icon zeigte auf dem Home-Bildschirm nur eine schwarze Fläche statt der Hantel-Grafik. Ursache: fehlendes Runden auf Pixelkoordinaten beim Herunterskalieren des generierten Icons auf 192px/180px — Fill-Routine schrieb dadurch auf nicht-indexierte Array-Properties statt echter Pixel. Nur die 512px-Variante war zufällig unbetroffen.
- Überschriften/Buttons oben wurden von der iOS-Statusleiste (Uhrzeit, Akku, Empfang) verdeckt. Ursache: `safe-top`-CSS-Klasse existierte, wurde aber nirgends angewendet.

## 2026-08-29

### Added
- Initiales PWA-Grundgerüst: Manifest, Service Worker (App-Shell-Caching), Dexie-Schema, Bottom-Tab-Navigation, generierte App-Icons
- Vier Kern-Flows implementiert: Übungen, Routinen, Training (inkl. Progressive-Overload-Vorbefüllung, Persistenz über App-Neustart), Trainingsverlauf
- Deployment auf GitHub Pages (öffentliches Repo, HTTPS für Service-Worker-Test auf echtem iPhone)

### Fixed
- Service-Worker-Installation scheiterte komplett, weil `cache.addAll()` im `cors`-Modus an fehlenden CORS-Headern von `cdn.tailwindcss.com` scheiterte — CDN-Skripte werden seither einzeln im `no-cors`-Modus gecacht
- Gewicht/Wiederholungen-Eingabefelder liefen auf schmalen Bildschirmen über den Rand hinaus (Inputs erben Breite nicht automatisch von verschachtelten, nicht-flex Eltern-Containern) — behoben mit expliziter `w-full`-Klasse

## 2026-08-28

### Added
- Ursprüngliches Konzept-Dokument (Scope, Tech-Stack, Datenmodell, User Flows, UI/UX-Anforderungen, Nicht-funktionale Anforderungen, spätere Erweiterungen)
