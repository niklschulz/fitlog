import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterExercises } from '../js/exerciseFilter.js';

const groupOf = (id) => ({ chest: 'brust', lats: 'ruecken', biceps: 'arme', triceps: 'arme' })[id] ?? null;
const exercises = [
  { id: 'a', name: 'Bankdrücken', primaryMuscleIds: ['chest'] },
  { id: 'b', name: 'Klimmzug', primaryMuscleIds: ['lats', 'biceps'] },
  { id: 'c', name: 'Dips', primaryMuscleIds: ['chest', 'triceps'] },
  { id: 'd', name: 'Mystery' },
];
const ids = (list) => list.map((e) => e.id);

test('ohne Filter: alle Übungen, gleiche Liste', () => {
  assert.equal(filterExercises(exercises, {}, groupOf), exercises);
});

test('Suche: Groß/Klein egal, Leerzeichen am Rand ignoriert', () => {
  assert.deepEqual(ids(filterExercises(exercises, { query: '  BANK ' }, groupOf)), ['a']);
  assert.deepEqual(ids(filterExercises(exercises, { query: 'zzz' }, groupOf)), []);
});

test('Muskelgruppe: ein beliebiger primärer Muskel genügt', () => {
  assert.deepEqual(ids(filterExercises(exercises, { muscleGroupId: 'brust' }, groupOf)), ['a', 'c']);
  assert.deepEqual(ids(filterExercises(exercises, { muscleGroupId: 'arme' }, groupOf)), ['b', 'c']);
});

test('Übung ohne primäre Muskeln fällt bei aktivem Filter raus', () => {
  assert.ok(!ids(filterExercises(exercises, { muscleGroupId: 'brust' }, groupOf)).includes('d'));
});

test('Suche und Muskelgruppe kombiniert', () => {
  assert.deepEqual(ids(filterExercises(exercises, { query: 'dips', muscleGroupId: 'brust' }, groupOf)), ['c']);
  assert.deepEqual(ids(filterExercises(exercises, { query: 'dips', muscleGroupId: 'ruecken' }, groupOf)), []);
});
