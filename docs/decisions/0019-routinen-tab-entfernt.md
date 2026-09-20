# 0019 – Eigenständiger Routinen-Tab entfernt, Routinen nur noch über das Routinen-Sheet

## Kontext

Neben dem eigenständigen Routinen-Tab (`js/views/routines.js`, dritte Position in der Bottom-Nav: Liste → Namensformular → Editor → Übungs-Picker als Voll-Seiten-Flow mit sofortigem Live-Speichern und ▲/▼-Umsortieren) ist im Workout-Tab ein **Routinen-Sheet** entstanden: Liste aller Routinen, Neuanlage und Bearbeiten als zweiter Inhalts-Modus desselben Sheets (Entwurf im State, gesammeltes Speichern), Übungen hinzufügen über das bestehende Übungs-Sheet (inkl. spontaner Neuanlage), Umsortieren per Gedrückthalten und Verschieben ([js/reorder.js](../../js/reorder.js)), Entfernen über ein Kontextmenü, Löschen mit Bestätigung. Mit dem Umsortieren war der letzte Punkt erledigt, den nur der Tab konnte.

Zwei parallele Wege, Routinen zu bearbeiten, hatten zudem unterschiedliches Verhalten — der Tab-Editor synchronisierte z. B. das Workout des gewählten Tages nach einer Änderung nicht nach, das Sheet schon.

Nutzer-Entscheidung: Der Routinen-Tab entfällt, Routinen werden nur noch über das Sheet verwaltet.

## Entscheidung

**`js/views/routines.js` vollständig gelöscht** (nach Prüfung, dass nur `js/app.js` sie importiert; der frühere Import in `workout.js` entfiel bereits mit dem Bearbeiten-Modus des Sheets). Damit einhergehend:

- **`index.html`**: Nav-Button `data-view="routines"` entfernt — die Bottom-Nav hat jetzt drei Tabs (Workout, Statistik, Profil). Der Nav-Indikator misst seine Position per `getBoundingClientRect()` (s. `moveNavIndicator()` in `app.js`), es war keine Anpassung an der Tab-Anzahl nötig.
- **`js/app.js`**: Import und View-Registrierung entfernt.
- **`sw.js`**: Eintrag aus `APP_SHELL` entfernt, `CACHE_NAME` erhöht.
- **`reorderRoutineExercise()` in `js/db.js` gelöscht** — einziger Aufrufer war der Tab-Editor (▲/▼); das Sheet sortiert im Entwurf um und schreibt beim Speichern die neue Reihenfolge über `appendExerciseToRoutine()`. Anders als bei `updateExercise()` in [ADR 0018](0018-uebungen-tab-entfernt.md) gibt es hier kein konkretes Wiedereinsatz-Vorhaben, das Behalten rechtfertigen würde.
- **Code-Kommentare** in `workout.js`, `utils.js`, `workout-exercise-detail.js`, `statistics.js`, `css/styles.css` bereinigt, die den Tab als Beispiel oder Gegenstück nannten.

## Konsequenzen

- Routinen sind nur noch im Workout-Tab erreichbar: Routine-Auswahl → "Alle Routinen anzeigen" → Routinen-Sheet. Ohne den Umweg über den Workout-Tab gibt es keinen direkten Einstieg mehr (bewusste Abwägung des Nutzers).
- Bestehende Routinen bleiben unverändert erhalten (Datenmodell/IndexedDB nicht berührt); `getRoutineExercises`, `createRoutine`, `updateRoutine`, `deleteRoutine`, `appendExerciseToRoutine` und `removeExerciseFromRoutine` werden weiter vom Sheet genutzt.
- Ein früherer Nutzer, der die App im Routinen-Tab verlassen hat, landet beim Start ohnehin im Workout-Tab (`showView('workout')`) — kein Migrationsbedarf.
