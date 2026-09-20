// Automatisierte Tests für die heiklen Datenfunktionen in js/db.js -
// Löschkaskaden (ADR 0004), Routine-Wechsel und Tages-Workout-Eindeutigkeit
// (ADR 0007). Reine Datenlogik, kein Browser/UI nötig - läuft gegen eine
// In-Memory-IndexedDB-Fälschung (s. setup.js).
import './setup.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  db,
  createExercise,
  deleteExercise,
  createRoutine,
  deleteRoutine,
  appendExerciseToRoutine,
  getRoutineExercises,
  getWorkoutByDate,
  getOrCreateWorkoutForDate,
  getWorkoutExercises,
  applyRoutineToWorkout,
  removeRoutineFromWorkout,
  removeExerciseFromWorkout,
  addExercisesToWorkout,
  reorderWorkoutExercises,
  markWorkoutExerciseStarted,
  addSet,
} from '../js/db.js';

await db.open();

// Isoliert jeden Test - ohne das könnten Daten aus einem vorherigen Test
// (z. B. eine übrig gebliebene Übung) ein nachfolgendes Ergebnis verfälschen.
beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
});

test('deleteExercise entfernt eine unbegonnene Übung aus Routine und Workout-Roster', async () => {
  const exercise = await createExercise('Bankdrücken');
  const routine = await createRoutine('Push Day');
  await appendExerciseToRoutine(routine.id, exercise.id);

  const workout = await getOrCreateWorkoutForDate('2026-01-05');
  await applyRoutineToWorkout(workout.id, routine.id);

  await deleteExercise(exercise.id);

  assert.deepEqual(await getRoutineExercises(routine.id), []);
  assert.deepEqual(await getWorkoutExercises(workout.id), []);
});

test('deleteExercise behält bereits begonnene Workout-Einträge (Sätze bleiben im Verlauf)', async () => {
  const exercise = await createExercise('Kniebeuge');
  const workout = await getOrCreateWorkoutForDate('2026-01-05');
  const routine = await createRoutine('Leg Day');
  await appendExerciseToRoutine(routine.id, exercise.id);
  await applyRoutineToWorkout(workout.id, routine.id);

  await addSet(workout.id, exercise.id, 80, 5);
  const [entry] = await getWorkoutExercises(workout.id);
  await markWorkoutExerciseStarted(workout.id, exercise.id);

  await deleteExercise(exercise.id);

  const remaining = await getWorkoutExercises(workout.id);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, entry.id);
  assert.ok(remaining[0].startedAt, 'begonnener Eintrag muss erhalten bleiben');
});

test('deleteRoutine entfernt unbegonnene, routinen-stammende Einträge und löst den Routine-Bezug des Workouts', async () => {
  const exercise = await createExercise('Schulterdrücken');
  const routine = await createRoutine('Push Day');
  await appendExerciseToRoutine(routine.id, exercise.id);

  const workout = await getOrCreateWorkoutForDate('2026-01-06');
  await applyRoutineToWorkout(workout.id, routine.id);

  await deleteRoutine(routine.id);

  assert.deepEqual(await getWorkoutExercises(workout.id), []);
  const workoutAfter = await getWorkoutByDate('2026-01-06');
  assert.equal(workoutAfter.routineId, null, 'Workout muss erhalten bleiben, nur ohne Routine-Bezug');
});

test('applyRoutineToWorkout lässt manuell hinzugefügte Übungen beim Routine-Wechsel unberührt', async () => {
  const manualExercise = await createExercise('Wadenheben');
  const routineExercise = await createExercise('Kreuzheben');
  const routine = await createRoutine('Pull Day');
  await appendExerciseToRoutine(routine.id, routineExercise.id);

  const workout = await getOrCreateWorkoutForDate('2026-01-07');
  await db.workoutExercises.add({
    id: 'manual-1',
    workoutId: workout.id,
    exerciseId: manualExercise.id,
    order: 0,
    sourceRoutineId: null,
    startedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await applyRoutineToWorkout(workout.id, routine.id);
  await removeRoutineFromWorkout(workout.id);

  const entries = await getWorkoutExercises(workout.id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].exerciseId, manualExercise.id);
});

test('removeExerciseFromWorkout entfernt nur den gewählten Eintrag, Übung und übrige Einträge bleiben unberührt', async () => {
  const exerciseA = await createExercise('Übung A');
  const exerciseB = await createExercise('Übung B');
  const workout = await getOrCreateWorkoutForDate('2026-01-10');
  await addExercisesToWorkout(workout.id, [exerciseA.id, exerciseB.id]);

  const [entryA] = await getWorkoutExercises(workout.id);
  await removeExerciseFromWorkout(entryA.id);

  const remaining = await getWorkoutExercises(workout.id);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].exerciseId, exerciseB.id);
  assert.ok(await db.exercises.get(exerciseA.id), 'die Übung selbst muss erhalten bleiben');
});

test('getOrCreateWorkoutForDate legt pro Datum nur ein einziges Workout an', async () => {
  const first = await getOrCreateWorkoutForDate('2026-01-08');
  const second = await getOrCreateWorkoutForDate('2026-01-08');

  assert.equal(first.id, second.id);
  const all = await db.workouts.where('date').equals('2026-01-08').toArray();
  assert.equal(all.length, 1);
});

test('getWorkoutExercises sortiert begonnene Übungen vor unbegonnenen', async () => {
  const exA = await createExercise('Übung A');
  const exB = await createExercise('Übung B');
  const routine = await createRoutine('Kombi Day');
  await appendExerciseToRoutine(routine.id, exA.id);
  await appendExerciseToRoutine(routine.id, exB.id);

  const workout = await getOrCreateWorkoutForDate('2026-01-09');
  await applyRoutineToWorkout(workout.id, routine.id);
  await addSet(workout.id, exB.id, 20, 12);
  await markWorkoutExerciseStarted(workout.id, exB.id);

  const entries = await getWorkoutExercises(workout.id);
  assert.equal(entries[0].exerciseId, exB.id, 'begonnene Übung muss zuerst stehen');
  assert.equal(entries[1].exerciseId, exA.id);
});

test('reorderWorkoutExercises ordnet unbegonnene Übungen um, begonnene bleiben unangetastet vorn', async () => {
  const [a, b, c, d] = await Promise.all(['A', 'B', 'C', 'D'].map((n) => createExercise(n)));
  const workout = await getOrCreateWorkoutForDate('2026-09-21');
  await addExercisesToWorkout(workout.id, [a.id, b.id, c.id, d.id]);
  await addSet(workout.id, b.id, 50, 10);
  await markWorkoutExerciseStarted(workout.id, b.id);

  const before = await getWorkoutExercises(workout.id);
  assert.deepEqual(before.map((e) => e.exerciseId), [b.id, a.id, c.id, d.id]);
  const id = (exerciseId) => before.find((e) => e.exerciseId === exerciseId).id;

  // D nach vorn, C nach hinten - nur unbegonnene Einträge (B ist begonnen)
  await reorderWorkoutExercises(workout.id, [id(d.id), id(a.id), id(c.id)]);
  const after = await getWorkoutExercises(workout.id);
  assert.deepEqual(after.map((e) => e.exerciseId), [b.id, d.id, a.id, c.id]);
});

test('reorderWorkoutExercises ignoriert begonnene und fremde IDs und hängt fehlende Einträge hinten an', async () => {
  const [a, b, c] = await Promise.all(['A', 'B', 'C'].map((n) => createExercise(n)));
  const workout = await getOrCreateWorkoutForDate('2026-09-21');
  const other = await getOrCreateWorkoutForDate('2026-09-22');
  await addExercisesToWorkout(workout.id, [a.id, b.id, c.id]);
  await addExercisesToWorkout(other.id, [a.id]);
  await markWorkoutExerciseStarted(workout.id, a.id);

  const entries = await getWorkoutExercises(workout.id);
  const id = (exerciseId) => entries.find((e) => e.exerciseId === exerciseId).id;
  const foreign = (await getWorkoutExercises(other.id))[0].id;

  // Begonnenes A und fremder Eintrag werden ignoriert; B fehlt -> bleibt hinter C
  await reorderWorkoutExercises(workout.id, [id(a.id), foreign, id(c.id)]);
  const after = await getWorkoutExercises(workout.id);
  assert.deepEqual(after.map((e) => e.exerciseId), [a.id, c.id, b.id]);
  const startedA = after.find((e) => e.exerciseId === a.id);
  assert.equal(startedA.order, entries.find((e) => e.exerciseId === a.id).order, 'begonnene Übung: order unverändert');
  assert.deepEqual((await getWorkoutExercises(other.id)).map((e) => e.order), [0], 'anderer Tag unverändert');
});
