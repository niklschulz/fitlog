// Tests für js/exerciseStats.js (Zeitraum und persönliche Bestwerte einer
// Übung). Reine Funktionen, keine DB nötig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRangeStart, computePersonalBests } from '../js/exerciseStats.js';

const day = (date, ...sets) => ({ date, sets: sets.map(([weight, reps]) => ({ weight, reps })) });
// getExerciseSetHistory liefert die neuesten Tage zuerst
const history = [
  day('2026-10-03', [60, 8], [62.5, 6]),
  day('2026-08-01', [60, 10], [50, 15]),
  day('2025-12-01', [70, 3]),
];

test('getRangeStart: Kalendermonate/-jahre, Max = null, Monatsende wird gekappt', () => {
  assert.equal(getRangeStart('3m', '2026-10-03'), '2026-07-03');
  assert.equal(getRangeStart('1j', '2026-10-03'), '2025-10-03');
  assert.equal(getRangeStart('max', '2026-10-03'), null);
  assert.equal(getRangeStart('3m', '2026-05-31'), '2026-02-28');
});

test('Bestwerte im Zeitraum 3M', () => {
  const b = computePersonalBests(history, '3m', '2026-10-03');
  assert.deepEqual(b.weight, { weight: 62.5, reps: 6, date: '2026-10-03', volume: 375 });
  // 50 × 15 = 750 schlägt 60 × 10 = 600 und 62,5 × 6 = 375
  assert.deepEqual(b.volume, { weight: 50, reps: 15, date: '2026-08-01', volume: 750 });
  assert.deepEqual(b.reps, { weight: 50, reps: 15, date: '2026-08-01', volume: 750 });
  assert.equal(b.rangeStart, '2026-07-03');
});

test('Zeitraum Max bezieht alle Tage ein, rangeStart = erster Trainingstag', () => {
  const b = computePersonalBests(history, 'max', '2026-10-03');
  assert.equal(b.weight.weight, 70);
  assert.equal(b.rangeStart, '2025-12-01');
});

test('1J schließt Sätze vor dem Zeitraum aus', () => {
  const b = computePersonalBests(history, '1j', '2027-11-01');
  assert.equal(b.weight, null);
  assert.equal(b.volume, null);
  assert.equal(b.reps, null);
});

test('Gleichstand: früherer Satz bleibt Bestwert; Gewicht-Gleichstand entscheidet über Reps', () => {
  const h = [day('2026-10-02', [60, 8]), day('2026-10-01', [60, 8], [60, 5])];
  const b = computePersonalBests(h, 'max', '2026-10-03');
  assert.equal(b.weight.date, '2026-10-01');
  const h2 = [day('2026-10-02', [60, 9]), day('2026-10-01', [60, 8])];
  assert.equal(computePersonalBests(h2, 'max', '2026-10-03').weight.reps, 9);
});

test('Ungültige Sätze und Gewicht 0 werden ignoriert, Reps zählen auch ohne Gewicht', () => {
  const h = [day('2026-10-01', [0, 12], [40, 0], [NaN, 5])];
  const b = computePersonalBests(h, 'max', '2026-10-03');
  assert.equal(b.weight, null);
  assert.equal(b.volume, null);
  assert.equal(b.reps.reps, 12);
});

test('Ohne Daten: alles null', () => {
  const b = computePersonalBests([], 'max', '2026-10-03');
  assert.deepEqual(b, { rangeStart: null, weight: null, volume: null, reps: null });
});
