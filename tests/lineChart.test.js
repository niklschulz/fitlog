// Tests für js/lineChart.js (gemeinsame Bausteine der Liniendiagramme).
// Reine Funktionen, keine DB nötig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  niceTickStep,
  buildYAxis,
  pickLabelIndices,
  layoutAxisLabels,
  leftWithEdgeMargin,
  nearestIndexByX,
  buildTimeAxis,
  formatTimeAxisLabel,
} from '../js/lineChart.js';

test('niceTickStep: 1/2/5 × 10^n und Untergrenze', () => {
  assert.equal(niceTickStep(3), 5);
  assert.equal(niceTickStep(1.3), 2);
  assert.equal(niceTickStep(0.07), 0.1);
  assert.equal(niceTickStep(480), 500);
  assert.equal(niceTickStep(500, 1000), 1000);
  assert.equal(niceTickStep(0), 1);
});

test('buildYAxis: Polster, Ticks im Bereich, topPct oben/unten', () => {
  const a = buildYAxis([80, 90]);
  assert.ok(Math.abs(a.domainMin - 78.5) < 1e-9);
  assert.ok(Math.abs(a.domainMax - 91.5) < 1e-9);
  assert.ok(a.ticks.length >= 2 && a.ticks.every((t) => t >= a.domainMin && t <= a.domainMax));
  assert.ok(Math.abs(a.topPct(a.domainMax)) < 1e-9);
  assert.ok(Math.abs(a.topPct(a.domainMin) - 100) < 1e-9);
});

test('buildYAxis: gleiche Werte werden mit flatHalfSpan zentriert, ohne bleibt die Volumen-Regel', () => {
  const flat = buildYAxis([60, 60], { flatHalfSpan: (v) => Math.max(1, v * 0.1) });
  assert.equal(flat.domainMin, 54);
  assert.equal(flat.domainMax, 66);
  assert.equal(flat.topPct(60), 50);
  const small = buildYAxis([5], { flatHalfSpan: (v) => Math.max(1, v * 0.1) });
  assert.equal(small.domainMin, 4);
  assert.equal(small.domainMax, 6);
  const volume = buildYAxis([4000, 4000]);
  assert.ok(volume.domainMax > 4000 && volume.domainMin < 4000);
});

test('buildYAxis: Dezimal-Ticks ohne Gleitkomma-Drift, minStepFor erzwingt Tausender', () => {
  const a = buildYAxis([20, 22.5]);
  assert.ok(a.ticks.every((t) => Math.abs(t * 10 - Math.round(t * 10)) < 1e-9));
  const big = buildYAxis([4200, 4800], { minStepFor: (m) => (m >= 1000 ? 1000 : 0) });
  assert.ok(big.ticks.every((t) => t % 1000 === 0));
});

test('pickLabelIndices: bis 6 alle, sonst 4 gleichmäßig', () => {
  assert.deepEqual(pickLabelIndices(0), []);
  assert.deepEqual(pickLabelIndices(1), [0]);
  assert.deepEqual(pickLabelIndices(5), [0, 1, 2, 3, 4]);
  assert.deepEqual(pickLabelIndices(13), [0, 4, 8, 12]);
});

test('layoutAxisLabels: Duplikate entfernen, einzelnes Label mittig', () => {
  const out = layoutAxisLabels(
    [
      { pos: 0, text: '2026' },
      { pos: 50, text: '2026' },
      { pos: 100, text: '2027' },
    ],
    (p) => p
  );
  assert.deepEqual(out, [
    { leftPct: 0, text: '2026' },
    { leftPct: 100, text: '2027' },
  ]);
  assert.deepEqual(layoutAxisLabels([{ pos: 0, text: 'a' }, { pos: 9, text: 'a' }], (p) => p), [{ leftPct: 50, text: 'a' }]);
  assert.equal(leftWithEdgeMargin(0), 8);
  assert.equal(leftWithEdgeMargin(100), 92);
});

test('nearestIndexByX: nächster Punkt, Gleichstand = früherer, leer = -1', () => {
  assert.equal(nearestIndexByX([10, 50, 90], 60), 1);
  assert.equal(nearestIndexByX([10, 50, 90], 70), 1);
  assert.equal(nearestIndexByX([10, 50, 90], 99), 2);
  assert.equal(nearestIndexByX([0, 100], 50), 0);
  assert.equal(nearestIndexByX([], 50), -1);
});

test('buildTimeAxis: zeitlich proportional mit Rand, Lücken sichtbar', () => {
  const { xPcts, labels } = buildTimeAxis(['2026-08-01', '2026-08-02', '2026-10-30'], '3m');
  assert.equal(xPcts[0], 6);
  assert.equal(xPcts[2], 94);
  assert.ok(xPcts[1] - xPcts[0] < 2); // 1 Tag von 90 liegt nahe am ersten Punkt
  assert.equal(labels.length, 4);
  assert.equal(labels[0].leftPct, 6);
  assert.equal(labels[3].leftPct, 94);
});

test('buildTimeAxis: ein Punkt mittig, leer, Label-Formate je Zeitraum', () => {
  assert.deepEqual(buildTimeAxis([], 'max'), { xPcts: [], labels: [] });
  const one = buildTimeAxis(['2026-10-03'], '1j');
  assert.deepEqual(one.xPcts, [50]);
  assert.equal(one.labels.length, 1);
  assert.equal(one.labels[0].leftPct, 50);
  assert.equal(formatTimeAxisLabel('2026-09-15', 'max'), '2026');
  assert.match(formatTimeAxisLabel('2026-09-15', '1j'), /26$/);
  assert.match(formatTimeAxisLabel('2026-09-15', '3m'), /^15\./);
  // Max über wenige Monate eines Jahres: reine Jahreszahl wird entdoppelt -> ein mittiges Label
  assert.equal(buildTimeAxis(['2026-01-01', '2026-06-01'], 'max').labels.length, 1);
});
