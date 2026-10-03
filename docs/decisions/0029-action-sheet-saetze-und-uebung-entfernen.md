# 0029 – Action Sheet und "Sätze und Übung entfernen"

## Kontext

Im Übungs-Sheet des Workout-Tabs schaltet der Haken eine Übung im Tages-Workout um. Das Zurücknehmen war für Übungen mit erfassten Sätzen zunächst per `alert()` gesperrt (Schutzregel aus [ADR 0007](0007-workout-tab-tagesbasiertes-modell.md)). Nutzer-Vorgabe: stattdessen ein eigenes Action Sheet im Stil des SwiftUI-`confirmationDialog` mit den Optionen "Sätze und Übung entfernen" und "Abbrechen".

## Entscheidung

- **Neue Komponente `js/actionSheet.js`** (`showActionSheet({ message, actionLabel, cancelLabel })` → `Promise<boolean>`): Nachrichten-Karte mit roter Aktion, darunter abgesetzt eine eigene "Abbrechen"-Karte (`.popup-glass`, `rounded-sheet`), Backdrop-Tipp bricht ab. Hängt an `document.body` (z-70/71, über Sheets und angehobener Nav), Animation wie die Bottom-Sheets (`.action-sheet` in `css/styles.css`).
- **Neue Datenfunktion `removeExerciseWithSetsFromWorkout(workoutId, exerciseId)`** in `js/db.js` (mit Test): löscht in einer Transaktion alle Sätze dieser Übung an diesem Tag und den Roster-Eintrag. Sätze anderer Tage, die Übung selbst und das Workout bleiben bestehen.
- **Bewusste Ausweitung der Löschkaskaden:** Bisher gingen erfasste Sätze nie verloren (ADR 0004/0007). Dieser Weg löscht sie, aber nur nach ausdrücklicher Bestätigung im Action Sheet (ersetzt hier den `confirm()`-Dialog der CLAUDE.md-Konvention). Ohne erfasste Sätze entfällt die Rückfrage wie beim "⋮"-Menü. Einen Weg, ein ganzes Tages-Workout zu löschen, gibt es weiterhin nicht.
- Im Routinen-Kontext des Übungs-Sheets ändert sich nichts (nur Entwurf betroffen).
