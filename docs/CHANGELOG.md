# Changelog

Format angelehnt an [Keep a Changelog](https://keepachangelog.com/). Ein Eintrag pro nennenswerter Änderung, neueste zuerst.

## 2026-08-30

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
