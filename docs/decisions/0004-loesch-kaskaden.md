# 0004 – Lösch-Kaskaden ohne Soft-Delete

## Kontext

Alle Entitäten müssen laut Scope jederzeit und dauerhaft löschbar sein — es gibt keine Sperre für abgeschlossene Trainings oder referenzierte Übungen/Routinen. Gleichzeitig darf der Trainingsverlauf durch das Löschen einer Übung oder Routine nicht verloren gehen.

## Entscheidung

Kein `archived`-Flag, kein Soft-Delete. Stattdessen feste Kaskaden-Regeln pro Entität:

- **Übung löschen** → zugehörige `routineExercises`-Einträge werden mitgelöscht (Übung verschwindet aus allen Routinen). Bereits erfasste `sets` bleiben erhalten; zeigt ein Satz auf eine nicht mehr existierende `exerciseId`, wird "Gelöschte Übung" als Fallback-Name angezeigt.
- **Routine löschen** → zugehörige `routineExercises`-Einträge werden mitgelöscht. Trainings, die auf dieser Routine basierten, bleiben vollständig erhalten; ihr `routineId` wird auf `null` gesetzt (Feld ist ohnehin nullable).
- **Training löschen** → alle zugehörigen `sets` werden mitgelöscht (ein Satz ohne sein Training ist nicht sinnvoll).

Alle Kaskaden sind in `db.js` implementiert (`deleteExercise`, `deleteRoutine`, `deleteWorkout`) und laufen jeweils in einer Dexie-Transaktion.

## Konsequenzen

- Kein zusätzliches Schema-Feld nötig, Datenmodell bleibt schlank
- Views müssen defensiv mit möglichen "verwaisten" Referenzen umgehen (z. B. `exerciseNameById[id] ?? 'Gelöschte Übung'`) — an mehreren Stellen im Code wiederkehrendes Muster
- Löschen ist echt destruktiv (kein Undo, kein Papierkorb) — bewusst in Kauf genommen, dafür gibt es den Bestätigungsdialog vor jedem Löschen
