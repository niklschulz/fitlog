# 0021 – Standard-Übungen: fest mit der App ausgeliefert, für Nutzer nicht veränderbar

## Kontext

Bisher legt jeder Nutzer alle Übungen selbst an (`createExercise()`), es gibt keine mit der App mitgelieferte Grundausstattung. Nutzer-Vorgabe: Ein fester Satz an Standard-Übungen soll künftig bei jeder Installation automatisch vorhanden sein — Name und Muskel-Zuordnung dieser Übungen sind komplett fix, der Nutzer kann sie weder umbenennen noch löschen noch ihre Muskel-Zuordnung ändern. Eigene, zusätzliche Übungen bleiben weiterhin möglich; beide Arten erscheinen gemischt, alphabetisch sortiert, im Übungs-Sheet (unverändert `db.exercises.orderBy('name')`, s. `js/views/workout.js`).

Offene Fragen wurden vorab geklärt:
- Standard-Übungen dürfen bei einem künftigen App-Update in Name/Muskel-Zuordnung aktualisiert werden (kein einmal "eingefrorener" Stand).
- Kein Lösch-Fall vorgesehen: Ist eine Übung einmal in der Standard-Liste, bleibt sie darin — es werden nur bestehende Einträge geändert oder neue ergänzt, nie welche entfernt.
- Die eigentliche Übungsliste (Namen + Muskel-Zuordnung) liefert der Nutzer separat nach; dieses ADR beschreibt nur den technischen Mechanismus, `BUILTIN_EXERCISES` in `js/db.js` startet leer.
- Medien (Bild/Video, s. `drafts/exercise-media.html`) werden hier bewusst NICHT vorbereitet — separates, noch offenes Thema.

## Entscheidung

**Neues Feld `exercises.isBuiltin` (Schema-Version 4)** markiert eine Übung als vom Nutzer nicht veränderbar:

```js
db.version(4).stores({
  exercises: 'id, name, primaryMuscleId, *secondaryMuscleIds, isBuiltin, createdAt, updatedAt',
  // … übrige Tabellen unverändert
});
```

Bestehende, vor Version 4 angelegte Übungen bekommen keine Migration — `isBuiltin` bleibt bei ihnen `undefined` (= keine Standard-Übung), genau die gewünschte Bedeutung.

**Feste Liste + idempotenter Seed-Mechanismus in `js/db.js`:**

```js
export const BUILTIN_EXERCISES = [
  // { id: 'bankdruecken', name: 'Bankdrücken', primaryMuscleId: 'brust', secondaryMuscleIds: ['trizeps', 'vordere-schulter'] },
];

export async function seedBuiltinExercises(defs = BUILTIN_EXERCISES) { /* … */ }
```

- **Stabile Slug-IDs statt `generateId()`** (analog zu `MUSCLES`/`MUSCLE_GROUPS`) — nötig, damit der Seed beim nächsten Start erkennen kann, welche Einträge schon existieren.
- `seedBuiltinExercises()` läuft bei **jedem App-Start** (`app.js`, direkt nach `db.open()`, vor dem ersten `showView()`): fehlende Einträge werden angelegt, vorhandene auf Name/`primaryMuscleId`/`secondaryMuscleIds` gegen die aktuelle Liste abgeglichen und bei Abweichung aktualisiert (inkl. `updatedAt`). Ein unveränderter Eintrag wird nicht neu geschrieben (kein Update ohne echte Änderung).
- Kein Lösch-Zweig: Verschwindet eine ID aus `BUILTIN_EXERCISES`, bleibt der bereits angelegte Datensatz unangetastet in der DB (bewusste Nutzer-Entscheidung, s. Kontext).
- `defs`-Parameter mit Default `BUILTIN_EXERCISES` macht die Funktion ohne Rückgriff auf die echte Liste testbar (s. `tests/db.test.js`).

**Sperre gegen Bearbeiten/Löschen, zweifach:**
- UI: Das "⋮"-Kontextmenü im Übungs-Detail-Sheet (`js/views/workout.js`, `renderExerciseDetailSheet()`) wird bei `exercise.isBuiltin` komplett weggelassen (nicht nur deaktiviert) — die dritte Kopfzeilen-Spalte bleibt leer, der Titel damit weiterhin zentriert.
- Datenschicht (defense in depth): `updateExercise()`/`deleteExercise()` in `js/db.js` lesen zuerst die bestehende Übung und werfen einen Error, wenn `isBuiltin` gesetzt ist — unabhängig davon, ob der Aufruf über die UI oder anderweitig erfolgt.

## Konsequenzen

- Neue Standard-Übungen kommen künftig ausschließlich durch Ergänzen von `BUILTIN_EXERCISES` in `js/db.js` hinzu, nie durch eine Migration oder ein separates Skript — ein normaler Codeänderung + App-Update reicht, der Seed erledigt den Rest beim nächsten Start.
- Da nie gelöscht wird, wächst `BUILTIN_EXERCISES` über die Zeit nur; eine spätere Bereinigung (falls doch einmal gewünscht) wäre ein bewusster, separater Schritt außerhalb dieses Mechanismus.
- `isBuiltin` ist indexiert, wird aktuell aber nirgends für eine Query genutzt (die Übungsliste ist klein genug für einen vollständigen Scan) — vorbereitet für einen möglichen künftigen Filter "nur eigene Übungen zeigen".
- Die eigentliche Liste der Standard-Übungen ist zum Zeitpunkt dieses ADRs noch nicht befüllt (`BUILTIN_EXERCISES = []`, `seedBuiltinExercises()` ist dadurch aktuell ein No-Op) — folgt als reine Datenergänzung, ohne weitere Code-/Schema-Änderung.
