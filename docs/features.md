# Features & Scope

## MVP-Scope

- Übungen anlegen/bearbeiten/löschen
- Routinen anlegen/bearbeiten/löschen (Sammlung von Übungen als Trainingsvorlage, mit Reihenfolge)
- Workout pro Kalendertag verwalten (Routine wählen/wechseln/entfernen, Sätze eintragen) — Vergangenheit, Gegenwart und Zukunft gleichermaßen
- Alle Einträge jederzeit und dauerhaft bearbeit- und löschbar
- Vollständig offline nutzbar (Erstinstallation ausgenommen)

## Explizit nicht im MVP

- Sync zu einem Backend (geplant, s. [architecture.md](architecture.md#sync--infrastruktur-geplant-noch-nicht-gebaut))
- Multi-Device-Sync mit Konfliktauflösung
- Push-Benachrichtigungen
- HealthKit-/Apple-Watch-Integration
- Nutzerverwaltung (Single-User-System)
- Ein separater Trainingsverlauf-Tab (entfernt, s. "Verworfene Experimente" — der Kalender im Workout-Tab übernimmt diese Aufgabe)
- Ein explizites "Training beenden" (entfernt — jeder Tag bleibt dauerhaft offen/bearbeitbar, s. [ADR 0007](decisions/0007-workout-tab-tagesbasiertes-modell.md))

## Die vier Kern-Flows

### Workout (`js/views/workout.js`) — Kernfunktion
Kleine Kalenderzeile (Vorwoche, aktuelle Woche, Folgewoche — ±1 Woche um den ausgewählten Tag, horizontal scrollbar mit Wochen-Snapping, automatisch zur aktuellen Woche zentriert), grüner Punkt an Tagen mit mindestens einem dokumentierten Satz. Kalender-Icon oben rechts öffnet ein großes Bottom-Sheet (reicht bis knapp unter die Dynamic Island/Notch, geräteunabhängig über `env(safe-area-inset-top)` statt einer festen Prozent-Höhe) mit einem monatsweise scrollenden Kalender für Tage außerhalb des ±1-Wochen-Fensters: fest ab Januar 2026, bis einen Monat über den aktuellen Kalendermonat hinaus reichend (dynamisch berechnet), vollständig vorab gerendert (Details: [ADR 0009](decisions/0009-grosser-kalender-vollstaendiges-rendern.md)). Dokumentierte Tage bekommen einen gefüllten grünen Kreis, der heutige Tag (falls nicht gleichzeitig dokumentiert/ausgewählt) einen ungefüllten. Kopfzeile: Schließen-Button (✕, links), "Kalender" als Titel und zugleich Ziehgriff-Fläche zum Wegziehen nach unten (Mitte), Icon-Button mit Kalender+Punkt-Symbol springt zum aktuellen Monat (rechts) — während das Sheet offen ist, bleibt der Workout-Tab dahinter fixiert (kein Scroll-Bleed-Through). Tap auf einen Tag schließt das Sheet, springt dorthin und zentriert die kleine Kalenderzeile neu.

Pro Tag: **Routine wählen** (Popup-Liste aller Routinen) legt deren Übungen als Roster für diesen Tag an. **Wechseln**/**Entfernen** einer Routine räumt noch nicht begonnene, routinen-stammende Übungen auf, behält aber bereits begonnene (mit erfassten Sätzen) unabhängig davon, ob sie in einer neuen Routine enthalten sind — Details und Beispiel: [ADR 0007](decisions/0007-workout-tab-tagesbasiertes-modell.md). **"+ Übung hinzufügen"** öffnet das **Übungs-Sheet** (gleiches Bottom-Sheet-Muster wie der Kalender, gestapelt/wiederverwendbar gemacht, s. [ADR 0011](decisions/0011-uebungs-sheet-bottom-sheet-extraktion.md)): Suchfeld (Live-Filter beim Tippen) und darunter ein Muskelgruppen-Filter (Dropdown-Pill wie die Routine-Auswahl, matcht primäre *oder* sekundäre Muskelgruppe einer Übung, s. [ADR 0013](decisions/0013-uebung-muskel-verknuepfung.md)), darunter die Liste aller angelegten Übungen. Jede Zeile zeigt Name plus primären Muskel als Untertitel, ein eckiges Auswahl-Kästchen rechts sammelt eine Mehrfachauswahl (heute schon vorhandene Übungen bleiben sichtbar, aber mit deaktiviertem Häkchen-Badge markiert), eine Leiste unten ("Hinzufügen") committet die gesamte Auswahl gesammelt. "+"-Button oben rechts öffnet das **Neue-Übung-Sheet** — ein weiteres, über dem Übungs-Sheet gestapeltes Sheet (Schließen führt nur zum Übungs-Sheet zurück, nicht zum Workout-Tab, s. [ADR 0014](decisions/0014-neue-uebung-sheet-gestapelt.md)): Namensfeld plus Chip-Auswahl für primären (Einzelauswahl) und sekundäre (Mehrfachauswahl) Muskeln aus derselben festen Acht-Muskelgruppen-Liste. Neu erstellte Übung landet automatisch in der Mehrfachauswahl des Übungs-Sheets. Tap auf den Übungsnamen selbst öffnet statt der Auswahl ein weiteres, ebenfalls gestapeltes **Übungs-Detail-Sheet** — Kopfzeile (✕, Übungsname, roter Löschen-Button mit Bestätigungsdialog) ist fertig, der eigentliche Inhalt ist noch ein Platzhalter ("Weitere Details folgen."). Löschen verhält sich wie im Übungen-Tab-Formular (`deleteExercise()`, s. dort) und aktualisiert das Übungs-Sheet dahinter sofort. Diese manuell hinzugefügten Übungen bleiben von Routine-Wechsel/-Entfernen unberührt (`sourceRoutineId: null`).

Jede Roster-Zeile zeigt unter dem Übungstitel bereits die vollständige, nummerierte Satz-Liste (verbunden durch eine dünne vertikale Linie zwischen den Nummern-Kreisen, je Zeile "35 kg" / "10 Reps" getrennt), rechts oben zusätzlich die Satz-Anzahl — ohne die Detailseite öffnen zu müssen. Tap auf eine Übung im Roster öffnet die **Übungs-Detailseite** (`js/views/workout-exercise-detail.js`, Abschnitt 12) — eigene Unterseite mit Zurück-Pfeil (kreisförmiger Glass-Button) zur Tagesübersicht und drei Reitern (Segmented Control): aktueller Tag, Verlauf, Statistik (Platzhalter). Sobald der erste Satz für eine Übung erfasst wird, rückt sie im Roster automatisch nach vorne (dynamische Sortierung nach Bearbeitungszeitpunkt statt Routinen-Reihenfolge).

#### Übungs-Detailseite — Reiter "aktueller Tag"
Gewicht (kg, 1-kg-Stepper, direkte Dezimaleingabe im Feld möglich) und Wiederholungen (Feld-Label "Reps", 1er-Stepper, nur ganze Zahlen) über Minus-/Plus-Buttons oder direkte Eingabe. Vorbelegung beim Öffnen mit dem zuletzt erfassten Wert dieser Übung, egal aus welchem Workout-Tag (**Progressive-Overload-Hilfe**). Tap auf einen bereits ausgefüllten Satz lädt dessen Werte zur Bearbeitung ("Ändern"-Button, "Löschen" wird aktiv); ohne Auswahl bzw. bei Tap auf eine noch leere Platzhalter-Zeile zeigt das Formular die Vorbelegung, Button heißt "Speichern", "Löschen" bleibt deaktiviert. Anzahl der standardmäßig gezeigten leeren Platzhalter-Zeilen kommt aus einer eigenen Konstante (`DEFAULT_SET_COUNT`, Startwert 3) statt fest im Rendering verankert zu sein — Grundlage für eine spätere Profil-Einstellung. Stammt die Übung aus einer Routine, erscheint darunter "ROUTINE: `<Name>`".

#### Übungs-Detailseite — Reiter "Verlauf"
Frühere Workout-Tage (der aktuell betrachtete Tag ausgenommen), an denen diese Übung erfasst wurde, gruppiert nach Datum, neueste zuerst. Rein informativ, keine Aktionen.

#### Übungs-Detailseite — Reiter "Statistik"
Reiner Platzhalter ohne Inhalt/Funktion.

### Übungen (`js/views/exercises.js`)
Liste aller Übungen (alphabetisch), "+ Neue Übung" öffnet ein Formular, Tap auf bestehende Übung öffnet dasselbe Formular vorbefüllt zum Bearbeiten. Löschen mit Bestätigungsdialog — entfernt die Übung aus allen Routinen und aus allen Workout-Rostern ohne bereits erfasste Sätze; wo schon Sätze existieren, bleibt sie mit "Gelöschte Übung" als Fallback erhalten.

### Routinen (`js/views/routines.js`)
Liste aller Routinen mit Übungs-Anzahl. "+ Neue Routine" fragt zuerst nur den Namen ab, führt danach direkt in den Editor. Im Editor: Name jederzeit änderbar, Übungen per Picker hinzufügen (inkl. spontaner Neuanlage), per ▲/▼-Buttons umsortieren (kein Drag&Drop), per ✕ entfernen. Löschen mit Bestätigung — räumt auch in jedem Workout, das diese Routine gewählt hatte, die noch unbegonnenen Übungen auf (gleiche Regel wie beim Routine-Wechsel im Workout-Tab).

### Profil (`js/views/profile.js`) — Vorbereitung für späteren Sync
Vierter Tab, ganz rechts. Drei Zustände: **kein Profil** (Hinweistext + "Profil hinzufügen"-Button), **Formular** (Username + Token als Pflichtfelder, unmaskierter Text, Speichern/Abbrechen), **Profil vorhanden** (zeigt Username und Token an, darunter "Profil entfernen" mit Bestätigungsdialog, wie überall sonst in der App). Kein Bearbeiten-Modus — ein Token-Wechsel läuft über Entfernen + erneutes Hinzufügen. Beide Werte werden lokal über `localStorage` gespeichert (`js/profile.js`), nicht in der Dexie-Datenbank — sind reine Geräte-Konfiguration, keine Trainingsdaten. **Der eigentliche Sync findet noch nicht statt** (kein Backend vorhanden), das Tracking funktioniert unabhängig vom Profil-Status vollständig offline weiter. Hintergrund: [ADR 0006](decisions/0006-token-basierte-nutzertrennung.md).

## Lösch-Verhalten (Kurzfassung)

Siehe [ADR 0004](decisions/0004-loesch-kaskaden.md) (Grundregeln) und [ADR 0007](decisions/0007-workout-tab-tagesbasiertes-modell.md) (Erweiterung um Workout-Roster) für die vollständige Begründung.

| Aktion | Konsequenz |
|---|---|
| Übung löschen | Aus allen Routinen entfernt; aus Workout-Rostern entfernt, sofern dort noch keine Sätze erfasst wurden — sonst Fallback-Anzeige |
| Routine löschen | Verknüpfungen gelöscht; in betroffenen Workouts werden unbegonnene Roster-Einträge entfernt, Workouts selbst bleiben (`routineId` → `null`) |
| Satz löschen | Nur der Satz selbst (jetzt mit Bestätigungsdialog, s. [ADR 0010](decisions/0010-uebungs-detailseite.md)) |

## UI/UX-Leitplanken

- Mobile-first, Touch-Targets mind. 44×44px
- Dunkles Theme, Akzentfarbe Limette-Grün — fest, kein Light/Dark-Toggle im MVP. Vollständige Farbpalette, Typografie- und Radius-Tokens: [design-system.md](design-system.md)
- Bestätigungsdialog vor jedem Löschen (`window.confirm`, ausreichend für den MVP-Umfang)
- Freischwebende, pillenförmige Bottom-Tab-Navigation mit Icons: Workout, Übungen, Routinen, Profil
- Zoom (Pinch/Doppeltipp) deaktiviert für ein native-app-ähnlicheres Bediengefühl, s. [architecture.md](architecture.md#pwa-mechanik)

## Vorgemerkte, noch nicht spezifizierte Erweiterungen

- Zusätzliche Satz-Felder: RPE/Anstrengungsgrad pro Satz auf der Übungs-Detailseite, Notizen, Pausenzeiten
- Übungs-Demo-Video (Kamera-Icon im Kopfbereich der Übungs-Detailseite)
- Auswertungen auf Basis der Routine-Verknüpfung (z. B. Trainingshäufigkeit pro Routine); Statistik-Reiter auf der Übungs-Detailseite ist dafür bereits als Platzhalter vorhanden
- Inhalt des Übungs-Detail-Sheets (geöffnet per Tap auf eine Übung im Übungs-Sheet, [ADR 0011](decisions/0011-uebungs-sheet-bottom-sheet-extraktion.md)) — aktuell nur Kopfzeile (inkl. Löschen-Button) + Platzhalter-Text
- Zusammenführung von Übungen/Routinen in den Workout-Tab (perspektivisch angekündigt, noch nicht spezifiziert)
- Konfigurierbare `DEFAULT_SET_COUNT` (Übungs-Detailseite) im Profil-Tab

## Explizit dauerhaft nicht vorgesehen (keine spätere Erweiterung geplant)

- Kein Einheiten-Umschalter kg/lbs auf der Übungs-Detailseite — Gewicht bleibt fest in kg
- Kein Rest-Timer zwischen Sätzen
- Kein Stift-/Editieren-Icon (Satz-Bearbeitung läuft über Auswahl + "Ändern", s. o.)
- Keine Aktionen/Menüs im Verlauf-Reiter der Übungs-Detailseite
- Keine Bestleistungs-/PR-Kennzeichnung im Verlauf

## Verworfene Experimente

- **Home-Tab mit tageszeitabhängigem Spruch**: wurde vollständig implementiert (deterministische Sprüche pro Tageszeit, lokal eingebundene Serifenschrift) und auf ausdrücklichen Wunsch wieder entfernt. Details im [CHANGELOG](CHANGELOG.md).
- **Verlauf-Tab**: zeigte vergangene Trainings als eigene Liste mit Detailansicht und Inline-Satz-Bearbeitung. Mit Einführung des Workout-Tabs (Abschnitt 10) entfernt — der Kalender dort übernimmt die Aufgabe, historische Tage einzusehen. Das nachträgliche Ändern eines bereits erfassten Satz-Werts ging damit vorübergehend verloren, ist aber mit der Übungs-Detailseite (Abschnitt 12, [ADR 0010](decisions/0010-uebungs-detailseite.md)) über "Ändern" bei ausgewähltem Satz wieder möglich (Button hieß zunächst "Update", s. design-system.md).
- **Inline-Akkordeon-Erweiterung der Roster-Zeile**: Tap auf eine Übung im Workout-Tab expandierte früher direkt in der Liste (Sätze + einfaches Formular). Mit der Übungs-Detailseite (Abschnitt 12) durch eine vollständige Unterseite ersetzt — mehr Platz für Stepper, Satz-Auswahl mit Ändern/Löschen, Verlauf- und Statistik-Reiter.
