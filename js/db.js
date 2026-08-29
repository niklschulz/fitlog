// Dexie-Setup: IndexedDB als alleinige Datenquelle (offline-first).
// Schema entspricht Abschnitt 3 des Konzept-Dokuments.

export const db = new Dexie('fitlog');

db.version(1).stores({
  exercises: 'id, name, createdAt, updatedAt',
  routines: 'id, name, createdAt, updatedAt',
  routineExercises: 'id, routineId, exerciseId, order',
  workouts: 'id, routineId, startedAt, finishedAt, createdAt, updatedAt',
  sets: 'id, workoutId, exerciseId, createdAt, updatedAt',
});

export function generateId() {
  return crypto.randomUUID();
}

export function nowISO() {
  return new Date().toISOString();
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

// Löschen einer Übung entfernt sie aus allen Routinen, erfasste Sätze
// bleiben zur Wahrung des Trainingsverlaufs erhalten (s. Konzept Abschnitt 3).
export async function deleteExercise(id) {
  await db.transaction('rw', db.exercises, db.routineExercises, async () => {
    await db.routineExercises.where('exerciseId').equals(id).delete();
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

// Löschen einer Routine entfernt ihre Übungs-Verknüpfungen; bereits
// absolvierte Trainings bleiben erhalten, verlieren nur den Routine-Bezug.
export async function deleteRoutine(id) {
  await db.transaction('rw', db.routines, db.routineExercises, db.workouts, async () => {
    await db.routineExercises.where('routineId').equals(id).delete();
    await db.workouts.where('routineId').equals(id).modify({ routineId: null });
    await db.routines.delete(id);
  });
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

// --- Workouts ---

export async function startWorkout(routineId = null) {
  const ts = nowISO();
  const workout = {
    id: generateId(),
    routineId,
    startedAt: ts,
    finishedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.workouts.add(workout);
  return workout;
}

export async function finishWorkout(id) {
  const ts = nowISO();
  await db.workouts.update(id, { finishedAt: ts, updatedAt: ts });
}

// Löschen eines Trainings löscht alle zugehörigen Sätze mit.
export async function deleteWorkout(id) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.sets.where('workoutId').equals(id).delete();
    await db.workouts.delete(id);
  });
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

export async function updateSet(id, { weight, reps }) {
  await db.sets.update(id, { weight, reps, updatedAt: nowISO() });
}

export async function deleteSet(id) {
  await db.sets.delete(id);
}

// Für die Progressive-Overload-Hilfe: letzter erfasster Satz dieser Übung,
// übungsbezogen über alle Trainings hinweg (s. Konzept Flow 3).
export async function getLastSetForExercise(exerciseId) {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).sortBy('createdAt');
  return sets.length ? sets[sets.length - 1] : null;
}
