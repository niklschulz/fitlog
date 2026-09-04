# 0010 – Übungs-Detailseite: eigenständiges Sub-View-Modul statt Inline-Akkordeon

## Kontext

Abschnitt 12 der Konzept-Erweiterungen ersetzt die bisherige Inline-Akkordeon-Erweiterung einer Übungszeile im Workout-Tab (Tap öffnet ein Panel direkt in der Liste, s. ursprüngliche Umsetzung von Abschnitt 10) durch eine vollständige, eigenständige Seite: Zurück-Pfeil zur Tagesübersicht, Segmented Control mit drei Reitern (Tages-Erfassung/Verlauf/Statistik-Platzhalter), Gewicht/Wiederholungen-Stepper, Satz-Auswahl mit Speichern/Update/Delete.

Das bestehende App-weite View-System (`app.js`, vier Tabs über die Bottom-Nav) kennt keine Navigation *innerhalb* eines Tabs — nur den Wechsel zwischen den vier Haupt-Views.

## Entscheidung

- **Neues Modul `js/views/workout-exercise-detail.js`**, nicht in `app.js`s View-Registrierung eingetragen, sondern direkt von `workout.js` aufgerufen, sobald `state.detailEntryId` gesetzt ist. Folgt trotzdem demselben `render()`/`paint()`/`wireEvents()`-Muster wie die echten Views — verwaltet sich nach dem initialen `render(container, { entryId, onBack })`-Aufruf vollständig selbst (eigene Tab-/Auswahl-Zustände), `workout.js` mischt sich nicht weiter ein. `onBack` ist der einzige Kontaktpunkt zurück: setzt nur `state.detailEntryId = null` und ruft `workout.js`s eigenes `paint()` erneut auf.
- **Ersetzt die bisherige Inline-Akkordeon-Erweiterung vollständig** (`renderExercisePanel`, `.set-entry-form`, `.delete-set-btn`, `state.expandedExerciseId` entfernt) — Tap auf eine Übungszeile öffnet jetzt immer die neue Seite statt inline zu expandieren.
- **Bottom-Nav bleibt unverändert sichtbar/bedienbar**, da die Detailseite den `#view-container`-Inhalt normal ersetzt (wie jeder andere View-Wechsel auch) statt als Overlay über allem zu liegen — anders als das Kalender-Sheet (s. [ADR 0009](0009-grosser-kalender-vollstaendiges-rendern.md)) braucht es deshalb keine z-index-Anhebung oder Body-Scroll-Sperre.
- **`updateSet(id, weight, reps)` in `db.js` wieder eingeführt.** War mit [ADR 0007](0007-workout-tab-tagesbasiertes-modell.md) explizit als Konsequenz des Verlauf-Wegfalls entfernt worden ("Bearbeiten eines bereits erfassten Satz-Werts... aktuell nicht mehr möglich"). Abschnitt 12 verlangt genau das über den "Update"-Button bei ausgewähltem bestehendem Satz — die damalige Einschränkung gilt damit nicht mehr.
- **Neue Abfrage `getExerciseSetHistory(exerciseId, excludeWorkoutId)`** für den Verlauf-Reiter: eine Bulk-Abfrage aller Sätze dieser Übung, gruppiert nach Workout-Datum, der aktuell betrachtete Tag ausgeschlossen, neueste zuerst — bewusst zwei Abfragen (Sets, dann die zugehörigen Workouts per `bulkGet`) statt einer Abfrage pro Tag.
- **`DEFAULT_SET_COUNT = 3`** als benannte Konstante in `workout-exercise-detail.js`, bestimmt nur die Anzahl leerer Platzhalter-Zeilen zusätzlich zu bereits vorhandenen Sätzen (nie eine Obergrenze — mehr geloggte Sätze werden immer alle angezeigt). Laut Briefing Grundlage für eine spätere Profil-Tab-Einstellung; für diesen Schritt reicht die feste Konstante, keine Persistenz.
- **Auswahl-Zustand `selectedSetId`**: `null` = "neuer Satz" (Formular zeigt Vorbelegung aus dem letzten erfassten Wert, Button "Speichern", Delete deaktiviert); gesetzt = bestehender Satz zur Bearbeitung ausgewählt (Formular zeigt dessen Werte, Button "Update", Delete aktiv). Tap auf eine leere Platzhalter-Zeile setzt `selectedSetId` zurück auf `null` (keine feste Zuordnung "Zeile 2 = zweiter Satz" — leere Zeilen sind reine visuelle Platzhalter, keine Datensätze). Nach erfolgreichem Update oder Delete wird die Auswahl automatisch aufgehoben.
- **Löschen eines Satzes verlangt jetzt `confirm()`**, passend zur CLAUDE.md-Konvention ("Löschen/Entfernen von irgendetwas... immer Bestätigungsdialog") — die alte Inline-Lösch-Funktion hatte das nie gehabt, war also schon vorher eine kleine Lücke gegenüber der eigentlich immer schon geltenden Konvention.
- **Segmented Control als neue Komponente** (`bg-surface rounded-full p-1`-Track, aktiver Reiter `bg-raised text-ink`, inaktive `text-muted`) — löst den bisherigen "Bewusst nicht umgesetzt"-Eintrag in [design-system.md](../design-system.md) auf, analog zum Bottom-Sheet in [ADR 0009](0009-grosser-kalender-vollstaendiges-rendern.md).

## Konsequenzen

- `workout.js` verliert `expandedExerciseId` sowie die Importe `addSet`/`deleteSet`/`getLastSetForExercise`/`markWorkoutExerciseStarted` (jetzt ausschließlich in `workout-exercise-detail.js` verwendet) — reduziert die Verantwortlichkeit der Haupt-View spürbar.
- Erstes Beispiel eines "Sub-View"-Musters (View, die nicht in `app.js` registriert ist, sondern von einer anderen View direkt aufgerufen wird) — falls künftig weitere Detailseiten/Drill-downs innerhalb eines Tabs gebraucht werden, ist das der zu wiederholende Ansatz statt eines neuen, generischeren Routers.
- Statistik-Reiter bleibt bewusst ein reiner Platzhalter ohne jede Datenanbindung, wie im Briefing spezifiziert.
