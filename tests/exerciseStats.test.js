// Tests für js/exerciseStats.js (Zeitraum und persönliche Bestwerte einer
// Übung). Reine Funktionen, keine DB nötig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRangeStart, computePersonalBests, computeMaxWeightSeries, computeMaxRepsSeries, estimateOneRepMax } from '../js/exerciseStats.js';

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
  assert.deepEqual(b, { rangeStart: null, oneRm: null, weight: null, volume: null, reps: null });
});

test('estimateOneRepMax: Brzycki, 1 Rep = Gewicht, nur 1-10 Reps und Gewicht > 0', () => {
  assert.equal(estimateOneRepMax(100, 1), 100);
  assert.equal(estimateOneRepMax(100, 10), (100 * 36) / 27);
  assert.equal(estimateOneRepMax(90, 8), (90 * 36) / 29);
  assert.equal(estimateOneRepMax(80, 11), null);
  assert.equal(estimateOneRepMax(80, 12), null);
  assert.equal(estimateOneRepMax(0, 5), null);
  assert.equal(estimateOneRepMax(80, 0), null);
  assert.equal(estimateOneRepMax(NaN, 5), null);
});

test('1RM-Bestwert: höchster Schätzwert, Sätze über 10 Reps zählen nicht, Gleichstand = frühester', () => {
  // 60x8 = 77,9; 62,5x6 = 72,6; 60x10 = 80; 50x15 ignoriert; 70x3 = 76,1 (2025)
  const b = computePersonalBests(history, 'max', '2026-10-03');
  assert.equal(b.oneRm.date, '2026-08-01');
  assert.equal(b.oneRm.oneRm, 80);
  const tie = [day('2026-10-02', [80, 5]), day('2026-10-01', [80, 5])];
  assert.equal(computePersonalBests(tie, 'max', '2026-10-03').oneRm.date, '2026-10-01');
  // Zeitraum 3M schließt 2025 aus
  assert.equal(computePersonalBests(history, '3m', '2026-10-03').oneRm.oneRm, 80);
});

test('1RM-Bestwert: nur Sätze über 10 Reps oder Gewicht 0 → null', () => {
  const h = [day('2026-10-01', [50, 12], [0, 5])];
  assert.equal(computePersonalBests(h, 'max', '2026-10-03').oneRm, null);
});

test('computeMaxWeightSeries: ein Punkt pro Tag, aufsteigend, höchstes Gewicht (Gleichstand: mehr Reps)', () => {
  const h = [
    day('2026-10-03', [60, 8], [62.5, 6], [62.5, 8]),
    day('2026-08-01', [60, 10], [50, 15]),
    day('2025-12-01', [70, 3]),
  ];
  assert.deepEqual(computeMaxWeightSeries(h, 'max', '2026-10-03'), [
    { date: '2025-12-01', value: 70, reps: 3 },
    { date: '2026-08-01', value: 60, reps: 10 },
    { date: '2026-10-03', value: 62.5, reps: 8 },
  ]);
});

test('computeMaxWeightSeries: Zeitraumgrenzen, Zukunft, ungültige Sätze, leere Historie', () => {
  const h = [
    day('2026-10-10', [99, 1]), // Zukunft
    day('2026-10-03', [0, 12], [60, 0]), // nur ungültig / Gewicht 0
    day('2026-07-03', [55, 5]), // genau am Grenztag (3M ab 2026-07-03)
    day('2026-07-02', [80, 5]), // einen Tag davor
  ];
  assert.deepEqual(computeMaxWeightSeries(h, '3m', '2026-10-03'), [{ date: '2026-07-03', value: 55, reps: 5 }]);
  assert.deepEqual(computeMaxWeightSeries([], 'max', '2026-10-03'), []);
});

test('computeMaxWeightSeries: Maximum der Serie = Bestwert "Gewicht"', () => {
  for (const range of ['3m', '1j', 'max']) {
    const series = computeMaxWeightSeries(history, range, '2026-10-03');
    const best = computePersonalBests(history, range, '2026-10-03').weight;
    assert.equal(Math.max(...series.map((p) => p.value)), best.weight);
  }
});

test('computeMaxRepsSeries: ein Punkt pro Tag, meiste Reps im Einzelsatz (keine Summe), Gleichstand: höheres Gewicht, Gewicht 0 zählt', () => {
  const h = [
    { date: '2026-10-03', sets: [{ weight: 0, reps: 8 }, { weight: 0, reps: 10 }, { weight: 0, reps: 6 }] },
    { date: '2026-10-01', sets: [{ weight: 50, reps: 10 }, { weight: 60, reps: 10 }, { weight: 40, reps: 9 }, { weight: 70, reps: 0 }] },
  ];
  assert.deepEqual(computeMaxRepsSeries(h, 'max', '2026-10-03'), [
    { date: '2026-10-01', value: 10, weight: 60 },
    { date: '2026-10-03', value: 10, weight: 0 },
  ]);
  // Zukunft und Tage ohne gültigen Satz erscheinen nicht
  assert.deepEqual(computeMaxRepsSeries([{ date: '2026-10-05', sets: [{ weight: 10, reps: 5 }] }, { date: '2026-10-02', sets: [] }], 'max', '2026-10-03'), []);
});
