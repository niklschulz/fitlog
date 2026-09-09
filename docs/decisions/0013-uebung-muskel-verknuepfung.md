# 0013 – Übungen ↔ Muskelgruppen: Direktfelder statt Verknüpfungstabelle

## Kontext

Direkte Fortsetzung von [ADR 0012](0012-muskelgruppen-feste-taxonomie.md) (feste `MUSCLE_GROUPS`-Taxonomie ohne Verwendungsstelle). Jetzt: Übungen sollen eine Muskel-Zuordnung bekommen, künftig vom Nutzer im Formular editierbar. Nutzer-Vorgabe: **eine primäre** Muskelgruppe und **beliebig viele sekundäre**.

## Entscheidung

**Zwei neue Felder direkt an `exercises`, keine Verknüpfungstabelle:**

```js
exercises: {
  id, name, createdAt, updatedAt,
  primaryMuscleId: string | null,   // genau eine MUSCLE_GROUPS-id, oder (noch) keine Zuordnung
  secondaryMuscleIds: string[],     // 0..n weitere MUSCLE_GROUPS-ids
}
```

Neue Dexie-Schema-Version 3:

```js
exercises: 'id, name, primaryMuscleId, *secondaryMuscleIds, createdAt, updatedAt',
```

`*secondaryMuscleIds` ist ein Dexie-*multiEntry*-Index (führendes `*`) — erlaubt `db.exercises.where('secondaryMuscleIds').equals(id)`, um alle Übungen zu finden, bei denen eine bestimmte Muskelgruppe sekundär beteiligt ist, ohne eine separate Tabelle. Im Browser mit echten Testdaten verifiziert: Query nach `'po'` fand korrekt genau die Übung, die `'po'` unter ihren sekundären Muskeln hatte.

**Warum keine Verknüpfungstabelle** (wie `routineExercises`/`workoutExercises`, die echte many-to-many-Beziehungen mit eigenen Zusatzdaten pro Zeile abbilden — `order`, `sourceRoutineId`, `startedAt`): Bei der Muskel-Zuordnung gibt es keine solchen Zusatzdaten. "Primär vs. sekundär" wird bereits vollständig dadurch ausgedrückt, in welchem der beiden Felder eine ID steht — eine eigene Tabelle bräuchte zusätzlich eigene Zeilen-IDs und eigene Transaktionslogik für Hinzufügen/Entfernen, ohne dass dafür ein Mehrwert entsteht.

**Validierung auf Anwendungsebene** (`validateMuscleAssignment()` in `js/db.js`, analog zur bisherigen "kein Duplikat-Namens-Check, aber trim+required"-Praxis bei Übungen): IDs müssen aus der festen `MUSCLE_GROUPS`-Liste stammen, die primäre Muskelgruppe darf nicht zusätzlich unter den sekundären stehen, keine Duplikate unter den sekundären. Wirft bei Verstoß (`throw`), statt still zu korrigieren — Aufrufer ist ausschließlich zukünftiger, vertrauenswürdiger UI-Code mit Werten aus einer festen Auswahlliste, kein Nutzer-Freitext.

**`createExercise(name, muscleAssignment = {})`** — `muscleAssignment` optional, Default `{ primaryMuscleId: null, secondaryMuscleIds: [] }` (neue Übung ohne Zuordnung, solange kein Formular existiert).

**`updateExercise(id, name, muscleAssignment)`** — `muscleAssignment` bewusst *ohne* Default-Wert (nicht `= {}`): Nur wenn explizit ein `{ primaryMuscleId, secondaryMuscleIds }`-Objekt übergeben wird, wird die Zuordnung ersetzt. Reines Umbenennen (bisher einziger Aufrufer in `exercises.js`) darf eine bestehende Zuordnung nicht versehentlich auf "kein Muskel" zurücksetzen, nur weil der Aufruf keine Muskel-Argumente mitgibt. Im Browser verifiziert: `updateExercise(id, neuerName)` ohne drittes Argument lässt `primaryMuscleId`/`secondaryMuscleIds` unverändert.

**Keine Migration bestehender Übungen.** Beide Felder bleiben bei bereits existierenden Übungen `undefined` ("kein Muskel zugeordnet"), bis sie im (noch zu bauenden) Formular bearbeitet werden — kein `.upgrade()`-Schritt in der Schema-Version nötig, konsistent mit dem Vorgehen beim letzten Schema-Sprung (v1→v2).

## Konsequenzen

- `exercises`-Objekte aus `createExercise()` haben ab sofort immer `primaryMuscleId`/`secondaryMuscleIds` (mindestens `null`/`[]`); über rohes `db.exercises.add()` oder ältere, vor dieser Version angelegte Zeilen können diese Felder weiterhin fehlen (`undefined`) — Lesecode (z. B. der künftige Filter) muss `undefined` und `null` gleich behandeln.
- Noch keine UI: weder das Übungen-Tab-Formular (`exercises.js`) noch das Übungs-Sheet-Anlage-Formular (`workout.js`, [ADR 0011](0011-uebungs-sheet-bottom-sheet-extraktion.md)) bieten aktuell eine Muskel-Auswahl an — beide rufen `createExercise`/`updateExercise` weiterhin ohne drittes Argument auf. Folgt als eigener UI-Schritt.
- Der eigentliche Muskelgruppen-*Filter* im Übungs-Sheet (ursprünglicher Anlass, s. Referenz-Screenshot in der Session) ist ebenfalls noch nicht gebaut — insbesondere die Frage, ob er nach primär, sekundär oder beidem matcht, ist bewusst offen.
