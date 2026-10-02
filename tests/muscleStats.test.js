// Tests für getStatsRange()/computeMuscleStats() (js/muscleStats.js, s.
// ADR 0027) - Beispiel aus der Feature-Spezifikation plus Randfälle. Reine
// Funktionen, keine DB nötig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getStatsRange, computeMuscleStats } from '../js/muscleStats.js';

const MUSCLES = [{ id: 'brust' }, { id: 'trizeps' }, { id: 'vordere-schulter' }, { id: 'bizeps' }];
const EXERCISE_MUSCLES = new Map([
  ['bankdruecken', ['brust', 'trizeps', 'vordere-schulter']],
  ['butterfly', ['brust']],
  ['curls', ['bizeps']],
]);

let setId = 0;
function sets(date, exerciseId, count, { weight = 50, reps = 10 } = {}) {
  return Array.from({ length: count }, () => ({ id: `s${setId++}`, workoutId: `w-${date}`, date, exerciseId, weight, reps }));
}

const byMuscle = (result) => Object.fromEntries(result.map((r) => [r.muscleId, r]));

// --- getStatsRange ---

test('getStatsRange: letzte 8 abgeschlossene Wochen, laufende Woche ausgeschlossen', () => {
  // Fr 2026-10-02 -> laufende Woche beginnt Mo 2026-09-28, letzte abgeschlossene endet So 2026-09-27
  assert.deepEqual(getStatsRange('2026-10-02', '2025-01-15'), { start: '2026-08-03', end: '2026-09-27', weeks: 8 });
});

test('getStatsRange: kurze Historie mittelt nur ab der Woche des ersten Trainings', () => {
  // Erstes Training Mi 2026-09-09 -> Woche ab Mo 2026-09-07, 3 abgeschlossene Wochen
  assert.deepEqual(getStatsRange('2026-10-02', '2026-09-09'), { start: '2026-09-07', end: '2026-09-27', weeks: 3 });
});

test('getStatsRange: Wochenwechsel - Sonntag gehört noch zur laufenden Woche, Montag beginnt eine neue', () => {
  // So 2026-10-04: laufende Woche ist noch 28.09.-04.10.
  assert.equal(getStatsRange('2026-10-04', '2025-01-01').end, '2026-09-27');
  // Mo 2026-10-05: die Woche 28.09.-04.10. ist jetzt abgeschlossen
  assert.deepEqual(getStatsRange('2026-10-05', '2025-01-01'), { start: '2026-08-10', end: '2026-10-04', weeks: 8 });
});

test('getStatsRange: null ohne abgeschlossene Woche oder ohne Training', () => {
  assert.equal(getStatsRange('2026-10-02', '2026-09-29'), null); // erstes Training in der laufenden Woche
  assert.equal(getStatsRange('2026-10-02', null), null);
});

test('getStatsRange: erste abgeschlossene Woche ergibt weeks = 1', () => {
  assert.deepEqual(getStatsRange('2026-10-05', '2026-10-01'), { start: '2026-09-28', end: '2026-10-04', weeks: 1 });
});

// --- computeMuscleStats ---

test('Beispiel der Spezifikation: 1,75x (1,8x) und 5,625 (5,6) Sätze für Brust', () => {
  const range = { start: '2026-08-03', end: '2026-09-27', weeks: 8 };
  const all = [
    // Woche 1: Mo Bankdrücken 3 + Butterfly 3, Do Bankdrücken 3
    ...sets('2026-08-03', 'bankdruecken', 3),
    ...sets('2026-08-03', 'butterfly', 3),
    ...sets('2026-08-06', 'bankdruecken', 3),
  ];
  // Wochen 2-7: je 2 Tage mit insgesamt 6 Sätzen
  for (let w = 1; w <= 6; w++) {
    const monday = new Date(2026, 7, 3 + w * 7);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const thursday = new Date(monday);
    thursday.setDate(monday.getDate() + 3);
    all.push(...sets(iso(monday), 'bankdruecken', 3), ...sets(iso(thursday), 'butterfly', 3));
  }
  // Woche 8: Urlaub, kein Training

  const brust = byMuscle(computeMuscleStats(all, EXERCISE_MUSCLES, MUSCLES, range)).brust;
  assert.equal(brust.freqPerWeek, 1.75);
  assert.equal(brust.avgSetsPerWeek, 5.625);
  const fmt = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  assert.equal(fmt.format(brust.freqPerWeek), '1,8');
  assert.equal(fmt.format(brust.avgSetsPerWeek), '5,6');
});

test('Hilfsmuskeln zählen voll für Frequenz und Sätze', () => {
  const range = { start: '2026-09-21', end: '2026-09-27', weeks: 1 };
  const r = byMuscle(computeMuscleStats(sets('2026-09-21', 'bankdruecken', 3), EXERCISE_MUSCLES, MUSCLES, range));
  for (const id of ['brust', 'trizeps', 'vordere-schulter']) {
    assert.equal(r[id].avgSetsPerWeek, 3, id);
    assert.equal(r[id].freqPerWeek, 1, id);
  }
});

test('Zwei Übungen für denselben Muskel am selben Tag ergeben Frequenz 1x', () => {
  const range = { start: '2026-09-21', end: '2026-09-27', weeks: 1 };
  const all = [...sets('2026-09-22', 'bankdruecken', 3), ...sets('2026-09-22', 'butterfly', 3)];
  const brust = byMuscle(computeMuscleStats(all, EXERCISE_MUSCLES, MUSCLES, range)).brust;
  assert.equal(brust.freqPerWeek, 1);
  assert.equal(brust.avgSetsPerWeek, 6);
});

test('Sätze außerhalb des Zeitraums (z. B. laufende Woche) zählen nicht', () => {
  const range = { start: '2026-09-21', end: '2026-09-27', weeks: 1 };
  const all = [...sets('2026-09-20', 'curls', 2), ...sets('2026-09-27', 'curls', 1), ...sets('2026-09-28', 'curls', 5)];
  const bizeps = byMuscle(computeMuscleStats(all, EXERCISE_MUSCLES, MUSCLES, range)).bizeps;
  assert.equal(bizeps.avgSetsPerWeek, 1);
  assert.equal(bizeps.freqPerWeek, 1);
});

test('Wochen ohne Training senken den Durchschnitt', () => {
  const range = { start: '2026-09-07', end: '2026-09-27', weeks: 3 };
  const bizeps = byMuscle(computeMuscleStats(sets('2026-09-08', 'curls', 6), EXERCISE_MUSCLES, MUSCLES, range)).bizeps;
  assert.equal(bizeps.avgSetsPerWeek, 2);
  assert.equal(bizeps.freqPerWeek, 1 / 3);
});

test('Sätze ohne Gewicht zählen, Sätze mit 0 Wiederholungen oder fehlenden Werten nicht', () => {
  const range = { start: '2026-09-21', end: '2026-09-27', weeks: 1 };
  const all = [
    ...sets('2026-09-21', 'curls', 2, { weight: 0 }),
    ...sets('2026-09-21', 'curls', 1, { reps: 0 }),
    ...sets('2026-09-21', 'curls', 1, { reps: null }),
    ...sets('2026-09-21', 'curls', 1, { weight: null }),
  ];
  assert.equal(byMuscle(computeMuscleStats(all, EXERCISE_MUSCLES, MUSCLES, range)).bizeps.avgSetsPerWeek, 2);
});

test('Alle Muskeln erscheinen, auch untrainierte und Übungen ohne Muskelzuordnung stören nicht', () => {
  const range = { start: '2026-09-21', end: '2026-09-27', weeks: 1 };
  const result = computeMuscleStats(sets('2026-09-21', 'unbekannt', 3), EXERCISE_MUSCLES, MUSCLES, range);
  assert.deepEqual(
    result.map((r) => r.muscleId),
    MUSCLES.map((m) => m.id)
  );
  assert.ok(result.every((r) => r.avgSetsPerWeek === 0 && r.freqPerWeek === 0));
});

test('Gruppen-Ebene: Satz mit zwei Muskeln derselben Gruppe zählt für die Gruppe einmal', () => {
  // So ruft die Statistik-Ansicht die Funktion auf: Muskeln vorab auf ihre
  // Gruppe abgebildet (Bizeps + Unterarme -> 'arme', 'arme').
  const range = { start: '2026-09-21', end: '2026-09-27', weeks: 1 };
  const groupMap = new Map([['curls', ['arme', 'arme']]]);
  const [arme] = computeMuscleStats(sets('2026-09-21', 'curls', 4), groupMap, [{ id: 'arme' }], range);
  assert.equal(arme.avgSetsPerWeek, 4);
  assert.equal(arme.freqPerWeek, 1);
});
