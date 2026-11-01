# 0035 – Notizen pro Übung und Tag, Schutz vor Aufräum-Kaskaden

## Kontext

Der Nutzer will zu einer Übung an einem Trainingstag eine kurze Freitext-Notiz festhalten (z. B. "Schulter zwickte"). Spezifikation: [notizen-spec.md](../notizen-spec.md).

## Entscheidung

- **Feld `note` am `workoutExercises`-Eintrag** statt neuer Tabelle: Ein Eintrag steht schon für genau "diese Übung an diesem Tag". Nicht indiziert, deshalb keine neue Schema-Version und keine Migration. Leerer/Whitespace-Text wird zu "nicht gesetzt" (`setWorkoutExerciseNote()`, `js/db.js`).
- **Eine Notiz macht eine Übung nicht "begonnen"** (`startedAt` bleibt unberührt, Roster-Sortierung unverändert).
- **Eine Notiz schützt den Eintrag vor den Aufräum-Kaskaden**, wie ein erfasster Satz: Übung löschen, Routine löschen, Routine wechseln/entfernen filtern unbegonnene Einträge jetzt mit `&& !e.note`. Ergänzt/ändert die Regeln aus [ADR 0004](0004-loesch-kaskaden.md) und [ADR 0007](0007-workout-tab-tagesbasiertes-modell.md) (jeweils mit Nachtrag).
- **Einzel-Aktionen:** Der "⋮"-Button (Übung entfernen) entfällt bei Einträgen mit Notiz. Der Haken im Übungs-Sheet fragt bei Notiz (auch ohne Sätze) per Action Sheet nach ([ADR 0029](0029-action-sheet-saetze-und-uebung-entfernen.md)). `removeExerciseWithSetsFromWorkout()` löscht den Eintrag samt Notiz.
- **Erfassen** über einen Icon-Button in der Button-Zeile der Detailseite (Löschen 25 % schmaler, Verhältnis Speichern : Löschen : Notiz = 4 : 3 : 1) und ein Bottom-Sheet (`js/noteSheet.js`): ✓ speichert, ✕/Wegziehen verwirft ohne Rückfrage. Kein Auto-Speichern.
- **Anzeige nur lesbar:** Roster-Karte und Verlauf (auf 3 Zeilen gekürzt), Detailseite (vollständig, unter den Satz-Zeilen). Nicht in der Statistik-Übungsseite.

## Konsequenzen

- Backup/Import ([ADR 0034](0034-export-import-json-backup.md)) nimmt `note` automatisch mit (iteriert über `db.tables`).
- Einträge mit Notiz, aber ohne Sätze, erscheinen nicht im Verlauf-Reiter (der gruppiert nach Tagen mit Sätzen), nur im Roster des jeweiligen Tages.
- Eine Übung mit Notiz lässt sich nur entfernen, nachdem die Notiz geleert wurde oder über das Action Sheet im Übungs-Sheet.
