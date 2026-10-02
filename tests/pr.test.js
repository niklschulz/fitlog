// Tests für computePRs (js/pr.js, s. ADR 0025) - die sieben Beispiele aus
// der Feature-Spezifikation plus Randfälle. Reine Funktion, keine DB nötig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePRs } from '../js/pr.js';

// Baut eine chronologische Satzliste aus Workouts: [[[weight, reps], ...], ...]
// und liefert pro Satz das Ergebnis ('weight' | 'reps' | null), gruppiert wie
// die Eingabe - erleichtert den Vergleich mit den Tabellen der Spezifikation.
function run(workouts) {
  const sets = [];
  workouts.forEach((workoutSets, wi) => {
    workoutSets.forEach(([weight, reps], si) => {
      sets.push({ id: `w${wi}s${si}`, workoutId: `w${wi}`, weight, reps });
    });
  });
  const prs = computePRs(sets);
  return workouts.map((workoutSets, wi) => workoutSets.map((_, si) => prs.get(`w${wi}s${si}`) ?? null));
}

// Letztes Workout der Liste ist jeweils das in der Spezifikation gezeigte.
const last = (result) => result[result.length - 1];

test('Beispiel 1: Steigerung im Workout', () => {
  const r = run([[[45, 10]], [[50, 10], [52.5, 8], [55, 6]]]);
  assert.deepEqual(last(r), ['weight', 'weight', 'weight']);
});

test('Beispiel 2: gleiches neues Höchstgewicht mehrfach', () => {
  const r = run([[[45, 10]], [[50, 8], [50, 8], [50, 10]]]);
  assert.deepEqual(last(r), ['weight', null, null]);
});

test('Beispiel 3: Reps-Rekord bei bekanntem Gewicht', () => {
  const r = run([[[80, 7], [90, 5]], [[80, 8], [80, 9], [80, 9]]]);
  assert.deepEqual(last(r), ['reps', 'reps', null]);
});

test('Beispiel 4: erstmals genutztes Gewicht unter dem Maximum', () => {
  const r = run([[[90, 5]], [[72.5, 10], [72.5, 11]], [[72.5, 11], [72.5, 12]]]);
  assert.deepEqual(r[1], [null, null]);
  // Im nächsten Workout ist 72,5 × 11 die Basis.
  assert.deepEqual(r[2], [null, 'reps']);
});

test('Beispiel 5: Gleichstand mit Höchstgewicht', () => {
  const r = run([[[90, 6]], [[90, 6], [90, 7]]]);
  assert.deepEqual(last(r), [null, 'reps']);
});

test('Beispiel 6: erstes Workout einer neuen Übung', () => {
  const r = run([[[40, 10], [45, 8], [45, 9]]]);
  assert.deepEqual(last(r), ['weight', 'weight', null]);
});

test('Beispiel 7: Übung ohne Gewicht', () => {
  const r = run([[[0, 8]], [[0, 9], [0, 8]]]);
  assert.deepEqual(r[0], [null]); // erster Satz mit 0 kg: nie ein Gewichts-Badge
  assert.deepEqual(last(r), ['reps', null]);
});

test('Badges bleiben an alten Sätzen, wenn der Rekord später übertroffen wird', () => {
  const r = run([[[50, 5]], [[55, 5]], [[60, 5]]]);
  assert.deepEqual(r, [['weight'], ['weight'], ['weight']]);
});

test('Gewichte werden auf 2 Nachkommastellen verglichen', () => {
  const r = run([[[52.5, 8]], [[52.500000001, 9]]]);
  assert.deepEqual(last(r), ['reps']);
});

test('Sätze mit 0 Wiederholungen oder fehlenden Werten werden ignoriert', () => {
  const r = run([[[100, 0], [null, 5], [50, 8]], [[50, 9]]]);
  assert.deepEqual(r[0], [null, null, 'weight']);
  assert.deepEqual(r[1], ['reps']);
});

test('leere Eingabe', () => {
  assert.equal(computePRs([]).size, 0);
});
