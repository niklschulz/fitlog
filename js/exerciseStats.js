// Statistik-Berechnungen für EINE Übung (Statistik-Tab, Übungs-Seite). Reine
// Funktionen ohne DOM- oder Dexie-Zugriff - das Laden der Sätze übernimmt
// getExerciseSetHistory() in js/db.js, getestet wird diese Datei direkt in
// tests/exerciseStats.test.js. Alle Statistiken einer Übung werden über
// denselben, oben auf der Seite gewählten Zeitraum (3M / 1J / Max) berechnet.

// Erster Tag des Zeitraums (ISO-Datum, einschließlich) - `null` = gesamte
// Historie (Max). Kalendermonate/-jahre rückwärts ab heute; hat der Zielmonat
// den Tag nicht (z. B. 31. Mai - 3 Monate), gilt dessen letzter Tag.
export function getRangeStart(range, today) {
  const months = { '3m': 3, '1j': 12 }[range];
  if (!months) return null;
  const [y, m, d] = today.split('-').map(Number);
  const target = new Date(y, m - 1 - months, 1);
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

/**
 * Persönliche Bestwerte einer Übung im Zeitraum.
 *
 * @param {Array} history  getExerciseSetHistory(): [{ date, sets }], neueste
 *                         Tage zuerst, Sätze je Tag chronologisch
 * @param {string} range   '3m' | '1j' | 'max'
 * @param {string} today   ISO-Datum von heute
 * @returns {{ rangeStart: string|null, weight, volume, reps }}
 *   `rangeStart`: erster Tag des Zeitraums (bei Max der erste Trainingstag
 *   mit gültigem Satz, `null` ohne Daten). `weight`/`volume`/`reps`: je
 *   `{ weight, reps, date, volume }` des besten Satzes oder `null`.
 *
 * Bestwerte:
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

  let weight = null;
  let volume = null;
  let reps = null;
  let firstDate = null;

  for (const day of days) {
    for (const set of day.sets) {
      if (!isValidSet(set)) continue;
      firstDate ??= day.date;
      const entry = { weight: set.weight, reps: set.reps, date: day.date, volume: set.weight * set.reps };

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

  return { rangeStart: start ?? firstDate, weight, volume, reps };
}
