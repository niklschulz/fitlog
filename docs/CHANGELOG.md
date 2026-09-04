# Changelog

Format angelehnt an [Keep a Changelog](https://keepachangelog.com/). Ein Eintrag pro nennenswerter Änderung, neueste zuerst.

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
