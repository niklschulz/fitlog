// Tests für js/plates.js (Scheiben-Rechner). Reine Funktionen, keine DB nötig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLATE_WEIGHTS,
  MAX_PLATES_PER_SIDE,
  MAX_BAR_WEIGHT,
  totalWeight,
  canAddPlate,
  addPlate,
  removePlate,
  parseBarWeight,
  typeBarKey,
  formatKg,
} from '../js/plates.js';

test('totalWeight: leere Stange = Stangengewicht', () => {
  assert.equal(totalWeight(20, []), 20);
});

test('totalWeight: Stange + 2 × Scheiben einer Seite', () => {
  assert.equal(totalWeight(20, [25, 20, 5]), 120);
  assert.equal(totalWeight(20, [1.25]), 22.5);
  assert.equal(totalWeight(15, [10, 2.5]), 40);
});

test('totalWeight: unterschiedliche Beladung links und rechts', () => {
  assert.equal(totalWeight(20, [25, 5], [10]), 60);
  assert.equal(totalWeight(20, [], [2.5]), 22.5);
  assert.equal(totalWeight(20, [25], []), 45);
});

test('totalWeight: keine Gleitkomma-Artefakte bei krummem Stangengewicht', () => {
  assert.equal(totalWeight(7.3, [2.5]), 12.3);
  assert.equal(totalWeight(20.1, [1.25, 1.25, 1.25]), 27.6);
});

test('addPlate: sortiert schwerste zuerst und verändert das Original nicht', () => {
  const start = [10];
  const next = addPlate(start, 25);
  assert.deepEqual(next, [25, 10]);
  assert.deepEqual(start, [10]);
  assert.deepEqual(addPlate(next, 10), [25, 10, 10]);
});

test('addPlate: unbekannte Scheibe wird ignoriert', () => {
  const start = [5];
  assert.equal(addPlate(start, 7), start);
});

test('addPlate/canAddPlate: Limit pro Seite', () => {
  let plates = [];
  for (let i = 0; i < MAX_PLATES_PER_SIDE; i++) {
    assert.equal(canAddPlate(plates), true);
    plates = addPlate(plates, 25);
  }
  assert.equal(plates.length, MAX_PLATES_PER_SIDE);
  assert.equal(canAddPlate(plates), false);
  assert.equal(addPlate(plates, 5), plates);
  // Bei vollem Limit: 8 × 25 kg pro Seite + 20 kg Stange
  assert.equal(totalWeight(20, plates), 420);
});

test('removePlate: nimmt genau eine Scheibe dieses Gewichts ab', () => {
  assert.deepEqual(removePlate([25, 10, 10, 5], 10), [25, 10, 5]);
  assert.deepEqual(removePlate([25], 25), []);
});

test('removePlate: nicht vorhandene Scheibe lässt die Liste unverändert', () => {
  const plates = [25, 10];
  assert.equal(removePlate(plates, 5), plates);
});

test('parseBarWeight: Komma und Punkt, Leerzeichen', () => {
  assert.equal(parseBarWeight('20'), 20);
  assert.equal(parseBarWeight('15,5'), 15.5);
  assert.equal(parseBarWeight(' 12.25 '), 12.25);
});

test('parseBarWeight: ungültige Eingaben → null', () => {
  for (const bad of ['', '  ', 'abc', '-5', String(MAX_BAR_WEIGHT + 1), 'NaN', 'Infinity']) {
    assert.equal(parseBarWeight(bad), null, `"${bad}"`);
  }
  assert.equal(parseBarWeight(String(MAX_BAR_WEIGHT)), MAX_BAR_WEIGHT);
});

test('parseBarWeight: 0 kg ist gültig (keine Stange)', () => {
  assert.equal(parseBarWeight('0'), 0);
  assert.equal(parseBarWeight('0,0'), 0);
  assert.equal(parseBarWeight(0), 0);
});

test('formatKg: deutsche Schreibweise ohne überflüssige Nullen', () => {
  assert.equal(formatKg(20), '20');
  assert.equal(formatKg(42.5), '42,5');
  assert.equal(formatKg(1.25), '1,25');
  assert.equal(formatKg(22.5), '22,5');
});

test('Scheiben-Set: festes Set aus ADR 0044', () => {
  assert.deepEqual(PLATE_WEIGHTS, [1.25, 2.5, 5, 10, 15, 20, 25]);
});

test('typeBarKey: Ziffern anhängen, führende Null ersetzen', () => {
  assert.equal(typeBarKey('', '2'), '2');
  assert.equal(typeBarKey('2', '0'), '20');
  assert.equal(typeBarKey('0', '5'), '5');
  assert.equal(typeBarKey('0', '0'), '0');
  assert.equal(typeBarKey('', '0'), '0');
});

test('typeBarKey: Komma nur einmal, am Anfang mit führender Null', () => {
  assert.equal(typeBarKey('', ','), '0,');
  assert.equal(typeBarKey('15', ','), '15,');
  assert.equal(typeBarKey('15,', ','), '15,');
  assert.equal(typeBarKey('15,5', ','), '15,5');
});

test('typeBarKey: höchstens zwei Nachkommastellen und höchstens MAX_BAR_WEIGHT', () => {
  assert.equal(typeBarKey('1,25', '5'), '1,25');
  assert.equal(typeBarKey('1,2', '5'), '1,25');
  assert.equal(typeBarKey('50', '1'), '50');
  assert.equal(typeBarKey('5', '1'), '5');
  assert.equal(typeBarKey('5', '0'), '50');
  assert.equal(typeBarKey('50', ','), '50,');
  assert.equal(typeBarKey('50,', '1'), '50,');
});

test('typeBarKey: Löschen und unbekannte Tasten', () => {
  assert.equal(typeBarKey('20', 'back'), '2');
  assert.equal(typeBarKey('2', 'back'), '');
  assert.equal(typeBarKey('', 'back'), '');
  assert.equal(typeBarKey('20', 'x'), '20');
});
