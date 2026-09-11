// Dexie-Setup: IndexedDB als alleinige Datenquelle (offline-first).
// Schema entspricht Abschnitt 3 des Konzept-Dokuments, erweitert um
// workoutExercises (Abschnitt 10, s. ADR 0007).

export const db = new Dexie('fitlog');

db.version(1).stores({
  exercises: 'id, name, createdAt, updatedAt',
  routines: 'id, name, createdAt, updatedAt',
  routineExercises: 'id, routineId, exerciseId, order',
  workouts: 'id, routineId, startedAt, finishedAt, createdAt, updatedAt',
  sets: 'id, workoutId, exerciseId, createdAt, updatedAt',
});

// v2: Workout-Tab (Abschnitt 10) - workouts sind jetzt kalendertag-basiert
// (neues `date`-Feld), startedAt/finishedAt werden nicht mehr verwendet
// (kein "Training beenden"-Konzept mehr, s. ADR 0007). Neue Tabelle
// workoutExercises für die Übungs-Roster pro Workout.
db.version(2).stores({
  exercises: 'id, name, createdAt, updatedAt',
  routines: 'id, name, createdAt, updatedAt',
  routineExercises: 'id, routineId, exerciseId, order',
  workouts: 'id, routineId, date, createdAt, updatedAt',
  sets: 'id, workoutId, exerciseId, createdAt, updatedAt',
  workoutExercises: 'id, workoutId, exerciseId, order, sourceRoutineId, startedAt, createdAt, updatedAt',
});

// v3: Muskelgruppen-Zuordnung an Übungen (Abschnitt 13, s. ADR 0013) - eine
// primäre (`primaryMuscleId`, einzelner Wert) und beliebig viele sekundäre
// Muskelgruppen (`secondaryMuscleIds`, Array). Kein eigenes Verknüpfungs-
// Table wie bei routineExercises/workoutExercises, da keine Zusatzdaten pro
// Zuordnung anfallen - `*secondaryMuscleIds` ist ein multiEntry-Index
// (führendes `*`), erlaubt effizientes Filtern nach einer einzelnen
// sekundären Muskelgruppe trotz Array-Feld. Bestehende Übungen bekommen
// keine automatische Migration - beide Felder bleiben bei ihnen `undefined`
// ("kein Muskel zugeordnet"), bis sie im Formular bearbeitet werden.
db.version(3).stores({
  exercises: 'id, name, primaryMuscleId, *secondaryMuscleIds, createdAt, updatedAt',
  routines: 'id, name, createdAt, updatedAt',
  routineExercises: 'id, routineId, exerciseId, order',
  workouts: 'id, routineId, date, createdAt, updatedAt',
  sets: 'id, workoutId, exerciseId, createdAt, updatedAt',
  workoutExercises: 'id, workoutId, exerciseId, order, sourceRoutineId, startedAt, createdAt, updatedAt',
});

export function generateId() {
  return crypto.randomUUID();
}

export function nowISO() {
  return new Date().toISOString();
}

// Kalendertag als 'YYYY-MM-DD', lokale Zeitzone (kein UTC-Shift).
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISODate() {
  return toISODate(new Date());
}

// --- Muskelgruppen ---
//
// Feste, vom Nutzer nicht bearbeitbare Taxonomie für den künftigen
// Muskelgruppen-Filter im Übungs-Sheet (s. Diskussion in der Session) -
// bewusst kein eigenes Dexie-Table wie exercises/routines, s. ADR 0012.
// `id` ist ein stabiler Slug statt einer UUID, da diese Liste nie zur
// Laufzeit verändert wird - Übungen werden künftig per `muscleId` (einer
// dieser acht Werte) darauf verweisen.
export const MUSCLE_GROUPS = [
  { id: 'brust', name: 'Brust' },
  { id: 'schultern', name: 'Schultern' },
  { id: 'ruecken', name: 'Rücken' },
  { id: 'bizeps', name: 'Bizeps' },
  { id: 'trizeps', name: 'Trizeps' },
  { id: 'bauch', name: 'Bauch' },
  { id: 'po', name: 'Po' },
  { id: 'beine', name: 'Beine' },
];

// --- Exercises ---

// Prüft eine Muskel-Zuordnung gegen die feste MUSCLE_GROUPS-Taxonomie (s.
// ADR 0012): IDs müssen bekannt sein, die primäre Muskelgruppe darf nicht
// zusätzlich unter den sekundären auftauchen (eine Übung zeigt nicht
// gleichzeitig primär und sekundär auf denselben Muskel), keine Duplikate
// unter den sekundären. Wirft bei Verstoß statt still zu korrigieren -
// diese Funktion wird nur von vertrauenswürdigem Aufrufer-Code (künftiges
// Zuordnungs-Formular) mit bereits von einer festen Werteliste stammenden
// IDs aufgerufen, kein Nutzer-Freitext.
function validateMuscleAssignment(primaryMuscleId, secondaryMuscleIds) {
  const validIds = new Set(MUSCLE_GROUPS.map((m) => m.id));
  if (primaryMuscleId !== null && !validIds.has(primaryMuscleId)) {
    throw new Error(`Unbekannte primäre Muskelgruppe: ${primaryMuscleId}`);
  }
  for (const id of secondaryMuscleIds) {
    if (!validIds.has(id)) {
      throw new Error(`Unbekannte sekundäre Muskelgruppe: ${id}`);
    }
  }
  if (primaryMuscleId !== null && secondaryMuscleIds.includes(primaryMuscleId)) {
    throw new Error('Die primäre Muskelgruppe darf nicht zusätzlich als sekundär angegeben werden.');
  }
  if (new Set(secondaryMuscleIds).size !== secondaryMuscleIds.length) {
    throw new Error('Sekundäre Muskelgruppen enthalten Duplikate.');
  }
}

// `muscleAssignment` optional ({ primaryMuscleId, secondaryMuscleIds }) -
// ohne Angabe legt eine neue Übung ohne Muskel-Zuordnung an (Standardfall,
// solange das Zuordnungs-Formular noch nicht existiert).
export async function createExercise(name, muscleAssignment = {}) {
  const { primaryMuscleId = null, secondaryMuscleIds = [] } = muscleAssignment;
  validateMuscleAssignment(primaryMuscleId, secondaryMuscleIds);
  const ts = nowISO();
  const exercise = { id: generateId(), name, primaryMuscleId, secondaryMuscleIds, createdAt: ts, updatedAt: ts };
  await db.exercises.add(exercise);
  return exercise;
}

// `muscleAssignment` bewusst optional und standardmäßig nicht gesetzt
// (statt mit leeren Default-Werten): Nur wenn explizit ein
// `{ primaryMuscleId, secondaryMuscleIds }`-Objekt übergeben wird, wird die
// Muskel-Zuordnung ersetzt - ein reines Umbenennen (bisher einziger
// Aufrufer, s. exercises.js) darf eine bereits bestehende Zuordnung nicht
// versehentlich auf "kein Muskel" zurücksetzen.
export async function updateExercise(id, name, muscleAssignment) {
  const changes = { name, updatedAt: nowISO() };
  if (muscleAssignment) {
    const { primaryMuscleId = null, secondaryMuscleIds = [] } = muscleAssignment;
    validateMuscleAssignment(primaryMuscleId, secondaryMuscleIds);
    changes.primaryMuscleId = primaryMuscleId;
    changes.secondaryMuscleIds = secondaryMuscleIds;
  }
  await db.exercises.update(id, changes);
}

// Löschen einer Übung entfernt sie aus allen Routinen und aus allen
// Workout-Rostern, in denen noch keine Sätze für sie erfasst wurden.
// Bereits erfasste Sätze (und die zugehörigen workoutExercises-Einträge
// mit gesetztem startedAt) bleiben zur Wahrung des Verlaufs erhalten.
export async function deleteExercise(id) {
  await db.transaction('rw', db.exercises, db.routineExercises, db.workoutExercises, async () => {
    await db.routineExercises.where('exerciseId').equals(id).delete();
    const entries = await db.workoutExercises.where('exerciseId').equals(id).toArray();
    const removable = entries.filter((e) => e.startedAt === null);
    await db.workoutExercises.bulkDelete(removable.map((e) => e.id));
    await db.exercises.delete(id);
  });
}

// --- Routines ---

export async function createRoutine(name) {
  const ts = nowISO();
  const routine = { id: generateId(), name, createdAt: ts, updatedAt: ts };
  await db.routines.add(routine);
  return routine;
}

export async function updateRoutine(id, name) {
  await db.routines.update(id, { name, updatedAt: nowISO() });
}

// Löschen einer Routine entfernt ihre Übungs-Verknüpfungen sowie - in jedem
// Workout, das diese Routine gewählt hatte - alle noch nicht begonnenen
// workoutExercises-Einträge aus ihr (gleiche Regel wie beim manuellen
// Entfernen/Wechseln einer Routine im Workout-Tab, s. ADR 0007). Workouts
// selbst bleiben erhalten, verlieren nur den Routine-Bezug.
export async function deleteRoutine(id) {
  await db.transaction(
    'rw',
    db.routines,
    db.routineExercises,
    db.workouts,
    db.workoutExercises,
    async () => {
      await db.routineExercises.where('routineId').equals(id).delete();

      const affectedWorkouts = await db.workouts.where('routineId').equals(id).toArray();
      for (const workout of affectedWorkouts) {
        const entries = await db.workoutExercises.where('workoutId').equals(workout.id).toArray();
        const removable = entries.filter((e) => e.sourceRoutineId === id && e.startedAt === null);
        await db.workoutExercises.bulkDelete(removable.map((e) => e.id));
      }

      await db.workouts.where('routineId').equals(id).modify({ routineId: null });
      await db.routines.delete(id);
    }
  );
}

export async function addExerciseToRoutine(routineId, exerciseId, order) {
  const entry = { id: generateId(), routineId, exerciseId, order };
  await db.routineExercises.add(entry);
  return entry;
}

export async function getRoutineExercises(routineId) {
  const entries = await db.routineExercises.where('routineId').equals(routineId).sortBy('order');
  return entries;
}

export async function appendExerciseToRoutine(routineId, exerciseId) {
  const entries = await getRoutineExercises(routineId);
  return addExerciseToRoutine(routineId, exerciseId, entries.length);
}

export async function removeExerciseFromRoutine(id) {
  await db.routineExercises.delete(id);
}

export async function reorderRoutineExercise(routineId, entryId, direction) {
  const entries = await getRoutineExercises(routineId);
  const idx = entries.findIndex((e) => e.id === entryId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= entries.length) return;

  const a = entries[idx];
  const b = entries[swapIdx];
  await db.transaction('rw', db.routineExercises, async () => {
    await db.routineExercises.update(a.id, { order: b.order });
    await db.routineExercises.update(b.id, { order: a.order });
  });
}

// --- Workouts (Tages-Workout, s. Abschnitt 10 / ADR 0007) ---

export async function getWorkoutByDate(date) {
  const workout = await db.workouts.where('date').equals(date).first();
  return workout ?? null;
}

export async function getOrCreateWorkoutForDate(date) {
  const existing = await getWorkoutByDate(date);
  if (existing) return existing;

  const ts = nowISO();
  const workout = { id: generateId(), routineId: null, date, createdAt: ts, updatedAt: ts };
  await db.workouts.add(workout);
  return workout;
}

// Sortierregel: erst alle Übungen mit gesetztem startedAt (aufsteigend
// danach), dann alle ohne startedAt (aufsteigend nach order).
export async function getWorkoutExercises(workoutId) {
  const entries = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
  entries.sort((a, b) => {
    const aStarted = a.startedAt !== null;
    const bStarted = b.startedAt !== null;
    if (aStarted && bStarted) return a.startedAt < b.startedAt ? -1 : 1;
    if (aStarted !== bStarted) return aStarted ? -1 : 1;
    return a.order - b.order;
  });
  return entries;
}

// Übernimmt eine Routine in ein Workout (Erstauswahl oder Wechsel):
// - noch nicht begonnene, routinen-stammende Einträge werden entfernt
// - bereits begonnene Einträge bleiben erhalten; ist ihre Übung auch in der
//   neuen Routine enthalten, übernehmen sie deren order, sonst werden sie
//   hinter die neue Routine einsortiert (wirkt sich laut Sortierregel oben
//   nicht auf die Anzeige aus, da begonnene Übungen ohnehin nach startedAt
//   sortiert werden - dient nur der Datenkonsistenz)
// - manuell hinzugefügte Übungen (sourceRoutineId null) bleiben unberührt
export async function applyRoutineToWorkout(workoutId, routineId) {
  await db.transaction('rw', db.workouts, db.workoutExercises, db.routineExercises, async () => {
    const current = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    const removable = current.filter((e) => e.sourceRoutineId !== null && e.startedAt === null);
    await db.workoutExercises.bulkDelete(removable.map((e) => e.id));

    const remainingByExerciseId = new Map(
      current.filter((e) => !removable.includes(e)).map((e) => [e.exerciseId, e])
    );

    const routineEntries = await getRoutineExercises(routineId);
    const ts = nowISO();

    for (const re of routineEntries) {
      const existing = remainingByExerciseId.get(re.exerciseId);
      if (existing) {
        await db.workoutExercises.update(existing.id, { order: re.order, updatedAt: ts });
        remainingByExerciseId.delete(re.exerciseId);
      } else {
        await db.workoutExercises.add({
          id: generateId(),
          workoutId,
          exerciseId: re.exerciseId,
          order: re.order,
          sourceRoutineId: routineId,
          startedAt: null,
          createdAt: ts,
          updatedAt: ts,
        });
      }
    }

    let tailIndex = routineEntries.length;
    for (const entry of remainingByExerciseId.values()) {
      await db.workoutExercises.update(entry.id, { order: tailIndex, updatedAt: ts });
      tailIndex += 1;
    }

    await db.workouts.update(workoutId, { routineId, updatedAt: ts });
  });
}

// Entfernt die Routine von einem Workout: gleiche Aufräum-Regel wie bei
// applyRoutineToWorkout, nur ohne neue Routine, die eingefügt wird.
export async function removeRoutineFromWorkout(workoutId) {
  await db.transaction('rw', db.workouts, db.workoutExercises, async () => {
    const current = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    const removable = current.filter((e) => e.sourceRoutineId !== null && e.startedAt === null);
    await db.workoutExercises.bulkDelete(removable.map((e) => e.id));
    await db.workouts.update(workoutId, { routineId: null, updatedAt: nowISO() });
  });
}

// Entfernt eine einzelne Übung aus dem Tages-Roster (nicht die Übung selbst
// - die bleibt in der Datenbank und in allen Routinen erhalten). Anders als
// die Kaskaden-Funktionen oben (die mehrere Einträge anhand einer Regel
// entfernen) eine gezielte Einzel-Aktion ohne eigene startedAt-Prüfung - die
// aufrufende UI bietet diese Aktion von vornherein nur für unbegonnene
// Einträge an (s. js/views/workout.js), damit bereits erfasste Sätze nie
// durch diesen Weg verloren gehen (dieselbe Grundregel wie bei jeder
// anderen workoutExercises-Kaskade, s. ADR 0007).
//
// Bewusst OHNE `confirm()`-Dialog (Nutzer-Vorgabe, abweichend von der
// sonstigen App-Konvention "jedes Löschen braucht einen Bestätigungsdialog",
// s. CLAUDE.md) - der Weg dahin (Kontextmenü) betrifft wie oben beschrieben
// ausschließlich Einträge ohne jegliche Trainingsdaten: Verlieren geht dabei
// höchstens die Zuordnung "diese Übung steht heute auf dem Zettel", nie ein
// erfasster Satz - erneutes Hinzufügen kostet nur ein paar Sekunden über
// "Übung hinzufügen". Die Zweistufigkeit des Menüs selbst (erst "⋮"
// antippen, dann den Eintrag) übernimmt zusätzlich die Rolle der
// Bestätigung.
export async function removeExerciseFromWorkout(entryId) {
  await db.workoutExercises.delete(entryId);
}

// Fügt mehrere Übungen gesammelt manuell zu einem Workout hinzu (Übungs-Sheet
// im Workout-Tab, Mehrfachauswahl - s. Abschnitt 13). `sourceRoutineId: null`
// ist entscheidend, damit applyRoutineToWorkout/removeRoutineFromWorkout
// diese Einträge nicht mit aufräumen (s. deren Kommentare oben sowie ADR
// 0007, "Manuell hinzugefügte Übungen bleiben unberührt"). Eine Transaktion
// statt N unabhängiger Adds, damit bei einem Fehler nicht nur ein Teil der
// Auswahl im Roster landet.
export async function addExercisesToWorkout(workoutId, exerciseIds) {
  await db.transaction('rw', db.workoutExercises, async () => {
    const entries = await getWorkoutExercises(workoutId);
    let order = entries.length;
    const ts = nowISO();
    for (const exerciseId of exerciseIds) {
      await db.workoutExercises.add({
        id: generateId(),
        workoutId,
        exerciseId,
        order: order++,
        sourceRoutineId: null,
        startedAt: null,
        createdAt: ts,
        updatedAt: ts,
      });
    }
  });
}

// Markiert eine Übung im Workout als begonnen (einmalig, beim ersten
// erfassten Satz) - Grundlage der dynamischen Sortierung, s. Sortierregel.
export async function markWorkoutExerciseStarted(workoutId, exerciseId) {
  const entry = await db.workoutExercises.where({ workoutId, exerciseId }).first();
  if (entry && !entry.startedAt) {
    await db.workoutExercises.update(entry.id, { startedAt: nowISO(), updatedAt: nowISO() });
  }
}

// --- Sets ---

export async function addSet(workoutId, exerciseId, weight, reps) {
  const ts = nowISO();
  const set = {
    id: generateId(),
    workoutId,
    exerciseId,
    weight,
    reps,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.sets.add(set);
  return set;
}

export async function deleteSet(id) {
  await db.sets.delete(id);
}

// Nachträgliches Bearbeiten eines bereits erfassten Satz-Werts - mit ADR
// 0007 (Wegfall des Verlauf-Tabs) als nicht mehr möglich dokumentiert, jetzt
// über die Übungs-Detailseite (Abschnitt 12) wieder eingeführt ("Update"-
// Button bei ausgewähltem bestehendem Satz). Siehe ADR 0010.
export async function updateSet(id, weight, reps) {
  await db.sets.update(id, { weight, reps, updatedAt: nowISO() });
}

// Für die Progressive-Overload-Hilfe: letzter erfasster Satz dieser Übung,
// übungsbezogen über alle Workouts hinweg (s. Konzept Flow 3).
export async function getLastSetForExercise(exerciseId) {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).sortBy('createdAt');
  return sets.length ? sets[sets.length - 1] : null;
}

// Verlauf einer Übung für die Übungs-Detailseite (Abschnitt 12): alle Tage
// (außer dem übergebenen aktuellen Workout), an denen mindestens ein Satz
// dieser Übung erfasst wurde, gruppiert nach Datum, neueste zuerst.
export async function getExerciseSetHistory(exerciseId, excludeWorkoutId) {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
  const relevant = sets.filter((s) => s.workoutId !== excludeWorkoutId);
  if (relevant.length === 0) return [];

  const workoutIds = [...new Set(relevant.map((s) => s.workoutId))];
  const workouts = await db.workouts.bulkGet(workoutIds);
  const dateByWorkoutId = Object.fromEntries(workoutIds.map((id, i) => [id, workouts[i]?.date ?? null]));

  const setsByDate = {};
  for (const s of relevant) {
    const date = dateByWorkoutId[s.workoutId];
    if (!date) continue; // Workout wurde inzwischen gelöscht (sollte laut Kaskaden-Regeln nicht vorkommen, defensiv trotzdem übersprungen)
    (setsByDate[date] ??= []).push(s);
  }

  return Object.entries(setsByDate)
    .map(([date, daySets]) => ({
      date,
      sets: daySets.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
