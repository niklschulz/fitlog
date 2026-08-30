# 0007 – Workout-Tab: Tagesbasiertes Datenmodell statt aktiver Session

## Kontext

Der bisherige "Training"-Tab kannte genau einen Zustand: entweder kein Training aktiv, oder genau ein laufendes Training (`startedAt` gesetzt, `finishedAt` noch `null`), das über eine Kalenderzeile im neuen "Workout"-Tab (Abschnitt 10 der Konzept-Erweiterungen) durch die Möglichkeit ersetzt werden sollte, **für jeden beliebigen Kalendertag** – Vergangenheit, Gegenwart und Zukunft – Übungen und Sätze zu verwalten. Das bisherige Session-Modell (ein Training "startet" und "endet" in Echtzeit) passt nicht mehr zu "wähle einen Tag, verwalte dessen Workout".

Zwei Fragen waren dabei nicht spezifiziert und wurden vor der Umsetzung geklärt:
1. Bleibt der bisherige Verlauf-Tab (der auf demselben `workouts`/`sets`-Modell mit `startedAt`/`finishedAt` aufbaute) parallel bestehen?
2. Gibt es weiterhin ein explizites "Training beenden"?

Entscheidung des Nutzers zu beidem: **Verlauf-Tab komplett entfernen**, **kein explizites Beenden mehr** – jeder Tag ist grundsätzlich immer offen und bearbeitbar.

## Entscheidung

- **`workouts` bekommt ein neues `date`-Feld** (`'YYYY-MM-DD'`, lokale Zeitzone), das den Kalendertag festlegt, zu dem ein Workout gehört – unabhängig davon, ob/wann tatsächlich ein Satz erfasst wurde. Pro Kalendertag existiert höchstens ein Workout (`getOrCreateWorkoutForDate`).
- **`startedAt`/`finishedAt` auf `workouts` werden nicht mehr verwendet** (aus dem Index entfernt, Feld bleibt in alten Datensätzen bedeutungslos bestehen – kein Migrations-Aufwand für ein Konzept, das ersatzlos entfällt). Kein "Training beenden" mehr; jeder Tag bleibt dauerhaft bearbeitbar, konsistent mit dem Rest der App ("jederzeit bearbeit- und löschbar", Konzept Abschnitt 1).
- **Neue Tabelle `workoutExercises`** (`id, workoutId, exerciseId, order, sourceRoutineId, startedAt, createdAt, updatedAt`) hält explizit fest, welche Übungen zu einem Workout gehören – unabhängig davon, ob dafür schon Sätze existieren. `startedAt` wird einmalig beim ersten erfassten Satz für diese Übung in diesem Workout gesetzt und danach nie wieder verändert.
- **Dynamische Sortierung** ausschließlich über dieses `startedAt`-Feld: begonnene Übungen zuerst (nach Startzeitpunkt), danach unbegonnene (nach `order`) – keine manuelle Neunummerierung nötig. Verifiziert mit dem im Briefing gegebenen Beispiel (C zuerst begonnen → C, A, B; danach A begonnen → Reihenfolge bleibt C, A, B).
- **Routine-Wechsel/-Entfernen**: noch nicht begonnene, routinen-stammende `workoutExercises`-Einträge werden bei jedem Routine-Wechsel/-Entfernen gelöscht (unabhängig davon, von welcher Routine sie stammen – da bei jedem vorherigen Wechsel bereits aufgeräumt wurde, kann zu einem Zeitpunkt ohnehin nur die zuletzt gewählte Routine betroffen sein). Bereits begonnene Übungen bleiben immer erhalten; ist ihre Übung auch in der neu gewählten Routine enthalten, übernehmen sie deren `order`-Wert (wirkt sich laut Sortierregel nicht auf die Anzeige aus, dient nur der Datenkonsistenz), sonst werden sie rechnerisch hinter die neue Routine einsortiert. Manuell hinzugefügte Übungen (`sourceRoutineId: null`) bleiben von jedem Routine-Wechsel unberührt.
- **Verlauf-Tab entfernt** (`js/views/history.js` gelöscht, Nav-Eintrag entfernt) – der neue Kalender im Workout-Tab übernimmt vollständig dessen Aufgabe, historische Trainings einzusehen. Damit entfällt auch die einzige Stelle, die je `updateSet` (nachträgliches Bearbeiten eines Satz-Werts) aufgerufen hat – die Funktion wurde aus `db.js` entfernt, da ungenutzt.
- **Lösch-Kaskaden erweitert** (s. [ADR 0004](0004-loesch-kaskaden.md)): `deleteExercise` und `deleteRoutine` räumen jetzt zusätzlich `workoutExercises`-Einträge auf – nach derselben Regel wie beim Routine-Wechsel (nur unbegonnene Einträge werden entfernt, begonnene bleiben mit Fallback-Anzeige "Gelöschte Übung"/"Gelöschte Routine" erhalten).
- **Erweiterter Datums-Zugriff**: natives `<input type="date">` (per `showPicker()` geöffnet) statt eines selbst gebauten Monats-Kalenders – der Button dafür ist laut Briefing als funktionsfähig, aber mit noch offener Positionierung spezifiziert; die native iOS-Datumsauswahl ist die pragmatischste Umsetzung ohne zusätzliche UI-Komponente.
- **"+ Übung hinzufügen" bleibt bewusst ein reiner Platzhalter** (`disabled`-Button, keine Funktion) – die eigentliche Auswahl-/Anlage-Logik folgt laut Briefing in einem separaten, späteren Markdown.

## Konsequenzen

- Dexie-Schema-Version auf 2 angehoben (additive Änderung: neues Feld, neue Tabelle – keine Datentransformation nötig, alte Datensätze ohne `date` tauchen im neuen Kalender einfach nicht auf)
- `startWorkout`/`finishWorkout` aus `db.js` entfernt (Grundannahme – eine mutierbare "aktive" Session – existiert im neuen Modell nicht mehr)
- Bearbeiten eines bereits erfassten Satz-Werts (Gewicht/Wiederholungen nachträglich ändern) ist mit dem Wegfall von Verlauf aktuell nicht mehr möglich – im Workout-Tab lassen sich Sätze nur hinzufügen oder komplett löschen, kein Inline-Edit. Bewusste Konsequenz der Nutzer-Entscheidung, Verlauf zu entfernen, kein eigenständiger Scope-Verlust
- Kein Weg, ein komplettes Tages-Workout zu löschen (nur einzelne Sätze oder das Entfernen der Routine) – in diesem Umsetzungsschritt nicht vorgesehen, da nicht Teil des Auftrags
