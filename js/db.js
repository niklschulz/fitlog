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

// --- Exercises ---

export async function createExercise(name) {
  const ts = nowISO();
  const exercise = { id: generateId(), name, createdAt: ts, updatedAt: ts };
  await db.exercises.add(exercise);
  return exercise;
}

export async function updateExercise(id, name) {
  await db.exercises.update(id, { name, updatedAt: nowISO() });
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
