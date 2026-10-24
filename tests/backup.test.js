// Tests für Export/Import (js/backup.js, ADR 0034): Round-Trip, Validierung
// und dass ein fehlgeschlagener Import den Bestand nicht anrührt.
import './setup.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, getOrCreateWorkoutForDate, addSet, createExercise } from '../js/db.js';
import { buildBackup, parseBackup, summarizeBackup, replaceAllData, BackupError } from '../js/backup.js';

await db.open();

const META = { profile: { username: 'a', token: 'b' }, settings: { defaultSetCount: 4, weeklyGoal: 3 } };

async function clearAll() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

beforeEach(clearAll);

async function seed() {
  const exercise = await createExercise('Kniebeuge');
  const workout = await getOrCreateWorkoutForDate('2026-03-01');
  await addSet(workout.id, exercise.id, 80, 5);
  await addSet(workout.id, exercise.id, 82.5, 5);
  return { exercise, workout };
}

test('Round-Trip: Export, Leeren, Import stellt alle Tabellen wieder her', async () => {
  await seed();
  const backup = await buildBackup(db, META);
  const json = JSON.stringify(backup);

  await clearAll();
  assert.equal(await db.sets.count(), 0);

  await replaceAllData(db, parseBackup(json, db));
  assert.equal(await db.sets.count(), 2);
  assert.equal(await db.workouts.count(), 1);
  assert.equal(await db.exercises.count(), 1);
});

test('Import ersetzt vorhandene Daten statt sie zusammenzuführen', async () => {
  await seed();
  const backup = await buildBackup(db, META);
  await addSet((await db.workouts.toArray())[0].id, (await db.exercises.toArray())[0].id, 100, 1);
  assert.equal(await db.sets.count(), 3);

  await replaceAllData(db, backup);
  assert.equal(await db.sets.count(), 2);
});

test('summarizeBackup liefert Anzahlen und Zeitraum', async () => {
  await seed();
  const summary = summarizeBackup(await buildBackup(db, META));
  assert.equal(summary.workoutCount, 1);
  assert.equal(summary.setCount, 2);
  assert.equal(summary.firstDate, '2026-03-01');
  assert.equal(summary.lastDate, '2026-03-01');
});

test('parseBackup lehnt ungültige Dateien ab', async () => {
  const good = await buildBackup(db, META);
  const bad = [
    'kein json',
    JSON.stringify({ foo: 1 }),
    JSON.stringify({ ...good, formatVersion: 99 }),
    JSON.stringify({ ...good, data: { ...good.data, sets: undefined } }),
    JSON.stringify({ ...good, data: { ...good.data, sets: [{ weight: 1 }] } }),
  ];
  for (const text of bad) {
    assert.throws(() => parseBackup(text, db), BackupError);
  }
});

test('fehlgeschlagener Import lässt den Bestand unverändert', async () => {
  await seed();
  const backup = await buildBackup(db, META);
  // Doppelte id -> bulkAdd schlägt mitten in der Transaktion fehl
  backup.data.sets = [backup.data.sets[0], backup.data.sets[0]];
  await assert.rejects(replaceAllData(db, backup));
  assert.equal(await db.sets.count(), 2);
  assert.equal(await db.workouts.count(), 1);
});
