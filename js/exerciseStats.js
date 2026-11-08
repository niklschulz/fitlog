// Statistik-Berechnungen für EINE Übung (Statistik-Tab, Übungs-Seite). Reine
// Funktionen ohne DOM- oder Dexie-Zugriff - das Laden der Sätze übernimmt
// getExerciseSetHistory() in js/db.js, getestet wird diese Datei direkt in
// tests/exerciseStats.test.js. Alle Statistiken einer Übung werden über
// denselben, oben auf der Seite gewählten Zeitraum (3M / 1J / Max) berechnet.

import { parseISODate } from './dates.js';

// Erster Tag des Zeitraums (ISO-Datum, einschließlich) - `null` = gesamte
// Historie (Max). Kalendermonate/-jahre rückwärts ab heute; hat der Zielmonat
// den Tag nicht (z. B. 31. Mai - 3 Monate), gilt dessen letzter Tag.
export function getRangeStart(range, today) {
  const months = { '3m': 3, '1j': 12 }[range];
  if (!months) return null;
  const todayDate = parseISODate(today);
  const d = todayDate.getDate();
  const target = new Date(todayDate.getFullYear(), todayDate.getMonth() - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  const pad = (n) => String(n).padStart(2, '0');
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
}

// Satz zählt nur mit gültigem Gewicht und mindestens einer Wiederholung
// (dieselbe Regel wie bei den PR-Markierungen, js/pr.js).
function isValidSet(set) {
  return Number.isFinite(set.weight) && set.weight >= 0 && Number.isFinite(set.reps) && set.reps > 0;
}

// 1RM-Schätzung nach Brzycki: Gewicht × 36 / (37 − Wiederholungen). Nur Sätze
// mit 1 bis 10 Wiederholungen und Gewicht > 0 zählen - darüber wird die
// Schätzung zu ungenau (ADR 0042). Bei 1 Rep = das Gewicht selbst.
export const ONE_RM_MAX_REPS = 10;
export function estimateOneRepMax(weight, reps) {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1 || reps > ONE_RM_MAX_REPS) return null;
  return (weight * 36) / (37 - reps);
}

/**
 * Persönliche Bestwerte einer Übung im Zeitraum.
 *
 * @param {Array} history  getExerciseSetHistory(): [{ date, sets }], neueste
 *                         Tage zuerst, Sätze je Tag chronologisch
 * @param {string} range   '3m' | '1j' | 'max'
 * @param {string} today   ISO-Datum von heute
 * @returns {{ rangeStart: string|null, oneRm, weight, volume, reps }}
 *   `rangeStart`: erster Tag des Zeitraums (bei Max der erste Trainingstag
 *   mit gültigem Satz, `null` ohne Daten). `oneRm`/`weight`/`volume`/`reps`: je
 *   `{ weight, reps, date, volume }` (`oneRm` zusätzlich mit dem Schätzwert `oneRm`) des besten Satzes oder `null`.
 *
 * Bestwerte:
 * - 1RM: höchster Brzycki-Schätzwert (Sätze mit 1-10 Reps, Gewicht > 0)
 * - Gewicht: höchstes Gewicht (> 0), bei Gleichstand mehr Wiederholungen
 * - Volumen: höchstes Gewicht × Wiederholungen eines einzelnen Satzes
 * - Reps: meiste Wiederholungen, bei Gleichstand höheres Gewicht
 * Bei komplettem Gleichstand zählt der früheste Satz (ein späterer, gleich
 * guter Satz ist kein neuer Bestwert - wie bei den PR-Markierungen).
 */
export function computePersonalBests(history, range, today) {
  const start = getRangeStart(range, today);
  const days = history
    .filter((day) => day.date <= today && (start === null || day.date >= start))
    .slice()
    .reverse(); // chronologisch aufsteigend

  let oneRm = null;
  let weight = null;
  let volume = null;
  let reps = null;
  let firstDate = null;

  for (const day of days) {
    for (const set of day.sets) {
      if (!isValidSet(set)) continue;
      firstDate ??= day.date;
      const entry = { weight: set.weight, reps: set.reps, date: day.date, volume: set.weight * set.reps };

      const estimate = estimateOneRepMax(entry.weight, entry.reps);
      if (estimate !== null && (!oneRm || estimate > oneRm.oneRm)) {
        oneRm = { ...entry, oneRm: estimate };
      }
      if (entry.weight > 0 && (!weight || entry.weight > weight.weight || (entry.weight === weight.weight && entry.reps > weight.reps))) {
        weight = entry;
      }
      if (entry.volume > 0 && (!volume || entry.volume > volume.volume)) {
        volume = entry;
      }
      if (!reps || entry.reps > reps.reps || (entry.reps === reps.reps && entry.weight > reps.weight)) {
        reps = entry;
      }
    }
  }

  return { rangeStart: start ?? firstDate, oneRm, weight, volume, reps };
}

/**
 * Maximales Gewicht je Trainingstag im Zeitraum (Verlaufs-Diagramm der
 * Übungs-Seite, ADR 0043).
 *
 * @param {Array} history  getExerciseSetHistory(): [{ date, sets }], neueste Tage zuerst
 * @param {string} range   '3m' | '1j' | 'max'
 * @param {string} today   ISO-Datum von heute
 * @returns {{ date: string, value: number, reps: number }[]}  aufsteigend nach Datum;
 *   `value` = höchstes Gewicht (> 0) des Tages, bei Gleichstand der Satz mit
 *   mehr Wiederholungen (dieselbe Regel wie "Gewicht" in computePersonalBests).
 *   Tage ohne gültigen Satz mit Gewicht > 0 liefern keinen Punkt.
 */
export function computeMaxWeightSeries(history, range, today) {
  const start = getRangeStart(range, today);
  const series = [];
  for (const day of history) {
    if (day.date > today || (start !== null && day.date < start)) continue;
    let best = null;
    for (const set of day.sets) {
      if (!isValidSet(set) || set.weight <= 0) continue;
      if (!best || set.weight > best.value || (set.weight === best.value && set.reps > best.reps)) {
        best = { date: day.date, value: set.weight, reps: set.reps };
      }
    }
    if (best) series.push(best);
  }
  return series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Maximale Wiederholungen je Trainingstag im Zeitraum (zweite Größe im
 * Verlaufs-Diagramm, ADR 0043).
 *
 * @param {Array} history  getExerciseSetHistory(): [{ date, sets }], neueste Tage zuerst
 * @param {string} range   '3m' | '1j' | 'max'
 * @param {string} today   ISO-Datum von heute
 * @returns {{ date: string, value: number, weight: number }[]}  aufsteigend nach Datum;
 *   `value` = Wiederholungen des Einzelsatzes mit den meisten Wiederholungen des
 *   Tages (keine Summe über den Tag), bei Gleichstand der Satz mit dem höheren
 *   Gewicht (dieselbe Regel wie "Reps" in computePersonalBests). Sätze ohne
 *   Zusatzgewicht (Gewicht 0, z. B. Klimmzüge) zählen mit.
 */
export function computeMaxRepsSeries(history, range, today) {
  const start = getRangeStart(range, today);
  const series = [];
  for (const day of history) {
    if (day.date > today || (start !== null && day.date < start)) continue;
    let best = null;
    for (const set of day.sets) {
      if (!isValidSet(set)) continue;
      if (!best || set.reps > best.value || (set.reps === best.value && set.weight > best.weight)) {
        best = { date: day.date, value: set.reps, weight: set.weight };
      }
    }
    if (best) series.push(best);
  }
  return series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Geschätzter 1RM je Trainingstag im Zeitraum (dritte Größe im
 * Verlaufs-Diagramm, ADR 0043/0042).
 *
 * @param {Array} history  getExerciseSetHistory(): [{ date, sets }], neueste Tage zuerst
 * @param {string} range   '3m' | '1j' | 'max'
 * @param {string} today   ISO-Datum von heute
 * @returns {{ date: string, value: number }[]}  aufsteigend nach Datum; `value` =
 *   höchster Brzycki-Schätzwert (estimateOneRepMax) aller Sätze des Tages, also
 *   dieselbe Regel wie "1RM" in computePersonalBests. Tage ohne gültigen Satz
 *   (1-10 Reps, Gewicht > 0) liefern keinen Punkt.
 */
export function computeOneRmSeries(history, range, today) {
  const start = getRangeStart(range, today);
  const series = [];
  for (const day of history) {
    if (day.date > today || (start !== null && day.date < start)) continue;
    let best = null;
    for (const set of day.sets) {
      if (!isValidSet(set)) continue;
      const estimate = estimateOneRepMax(set.weight, set.reps);
      if (estimate !== null && (best === null || estimate > best.value)) best = { date: day.date, value: estimate };
    }
    if (best) series.push(best);
  }
  return series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
