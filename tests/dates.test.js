import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseISODate, formatDate, formatDateDotted, yearMonthOf, addMonths } from '../js/dates.js';

test('parseISODate liefert lokales Datum, YYYY-MM = 1. des Monats', () => {
  const d = parseISODate('2026-11-01');
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 10, 1, 0]);
  assert.equal(parseISODate('2026-11').getDate(), 1);
});

test('formatDate: je Variante ein Beispiel (Sonntag, 1. November 2026)', () => {
  const day = '2026-11-01';
  assert.equal(formatDate(day, 'weekdayShort'), 'So');
  assert.equal(formatDate(day, 'weekdayLong'), 'Sonntag');
  assert.equal(formatDate(day, 'dayMonthLong'), '1. November');
  assert.equal(formatDate(day, 'dayMonth2Long'), '01. November');
  assert.equal(formatDate(day, 'monthShort'), 'Nov');
  assert.equal(formatDate('2026-11', 'monthYearLong'), 'November 2026');
  assert.equal(formatDate(day, 'weekdayDayMonthShort'), 'So., 1. Nov.');
  assert.equal(formatDate(day, 'dayMonthShortYear'), '1. Nov. 2026');
  assert.equal(formatDate(day, 'dayMonthShort'), '1. Nov.');
  assert.equal(formatDate(day, 'weekdayDayMonthShortYear'), 'So., 1. Nov. 2026');
  assert.equal(formatDate(day, 'fullLong'), 'Sonntag, 01. November 2026');
});

test('formatDate: Jahreswechsel und Schaltjahr', () => {
  assert.equal(formatDate('2025-12-31', 'fullLong'), 'Mittwoch, 31. Dezember 2025');
  assert.equal(formatDate('2026-01-01', 'fullLong'), 'Donnerstag, 01. Januar 2026');
  assert.equal(formatDate('2024-02-29', 'fullLong'), 'Donnerstag, 29. Februar 2024');
});

test('formatDate: unbekannte Variante wirft', () => {
  assert.throws(() => formatDate('2026-11-01', 'gibtsNicht'));
});

test('formatDateDotted akzeptiert Datum und ISO-Zeitstempel', () => {
  assert.equal(formatDateDotted('2026-11-06'), '06.11.2026');
  assert.equal(formatDateDotted('2026-11-06T10:00:00.000Z'), '06.11.2026');
});

test('yearMonthOf / addMonths über Jahreswechsel', () => {
  assert.equal(yearMonthOf('2026-11-06'), '2026-11');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-11', 14), '2028-01');
});
