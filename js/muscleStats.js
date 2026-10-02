// Frequenz & Sätze pro Muskel (Statistik-Tab, s. ADR 0027). Reine Berechnung
// ohne DOM- oder Dexie-Zugriff - das Laden der Sätze/Übungen übernimmt
// getMuscleStatsData() in js/db.js, getestet wird diese Datei direkt in
// tests/muscleStats.test.js. Wird bei jedem Öffnen der Statistik neu
// berechnet, kein Cache (bei der Datenmenge eines Jahres unkritisch).
//
// Eigene kleine Datums-Helfer statt Import aus db.js: db.js setzt beim
// Import ein globales `Dexie` voraus (CDN-Script im Browser) und ließe sich
// in den Tests nur mit fake-indexeddb laden - diese Datei soll wie pr.js
// ohne jede Datenbank testbar bleiben. Gleiche Semantik wie
// addDays()/mondayOf() in db.js (lokale Zeitzone, 'YYYY-MM-DD').

const DEFAULT_RANGE_WEEKS = 8;

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr, delta) {
  const date = parseISODate(dateStr);
  date.setDate(date.getDate() + delta);
  return toISODate(date);
}

function mondayOf(dateStr) {
  const dow = parseISODate(dateStr).getDay(); // 0=So..6=Sa
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow);
}

// Ganze Wochen zwischen zwei Montagen - über Kalendertage gerundet statt
// Millisekunden geteilt, damit eine Zeitumstellung (23-/25-Stunden-Tag)
// das Ergebnis nicht verfälscht.
function weeksBetweenMondays(fromMonday, toMonday) {
  return Math.round((parseISODate(toMonday) - parseISODate(fromMonday)) / (7 * 86400000));
}

// Betrachtungszeitraum: die letzten `maxWeeks` ABGESCHLOSSENEN Kalender-
// wochen (Montag-Sonntag, lokale Zeit) - die laufende Woche nie. Bei kürzerer
// Historie beginnt der Zeitraum erst mit der Woche des ersten Trainings
// (`firstTrainedDate`, erster Tag mit mindestens einem Satz). `null`, solange
// es noch keine abgeschlossene Woche mit bzw. nach dem ersten Training gibt
// (oder noch gar kein Training) - die Ansicht zeigt dann einen Hinweis.
// `end` ist der Sonntag der letzten abgeschlossenen Woche (inklusiv).
export function getStatsRange(today, firstTrainedDate, maxWeeks = DEFAULT_RANGE_WEEKS) {
  if (!firstTrainedDate) return null;
  const lastCompleteMonday = addDays(mondayOf(today), -7);
  const firstMonday = mondayOf(firstTrainedDate);
  if (firstMonday > lastCompleteMonday) return null;

  const earliestMonday = addDays(lastCompleteMonday, -(maxWeeks - 1) * 7);
  const start = firstMonday > earliestMonday ? firstMonday : earliestMonday;
  return { start, end: addDays(lastCompleteMonday, 6), weeks: weeksBetweenMondays(start, lastCompleteMonday) + 1 };
}

// Ein Satz zählt als Arbeitssatz, sobald er mindestens eine Wiederholung hat
// und beide Werte vorhanden sind - 0 kg (Körpergewicht) zählt normal mit.
// Aufwärmsätze kennt das Datenmodell nicht (kein `isWarmup`-Feld).
function isWorkingSet(s) {
  return Number.isFinite(s.weight) && Number.isFinite(s.reps) && s.reps > 0;
}

/**
 * @param {Array}  sets            Sätze mit { workoutId, date, exerciseId, weight, reps } (dürfen auch außerhalb des Zeitraums liegen)
 * @param {Map}    exerciseMuscles exerciseId → [muscleId, ...] (primäre + sekundäre Muskeln)
 * @param {Array}  muscles         Alle Muskeln ({ id, ... }) - jeder bekommt einen Eintrag, auch ohne Training
 * @param {Object} range           { start, end, weeks } aus getStatsRange()
 * @returns {Array<{ muscleId, avgSetsPerWeek, freqPerWeek }>} in der Reihenfolge von `muscles`
 */
export function computeMuscleStats(sets, exerciseMuscles, muscles, range) {
  const setCounts = new Map();
  const trainedDays = new Map(); // muscleId → Set von Datumsstrings

  for (const s of sets) {
    if (!s.date || s.date < range.start || s.date > range.end || !isWorkingSet(s)) continue;
    // Set statt Array: zählt einen Muskel pro Satz höchstens einmal, auch
    // falls er (fehlerhaft) doppelt an der Übung hängt.
    for (const muscleId of new Set(exerciseMuscles.get(s.exerciseId) ?? [])) {
      setCounts.set(muscleId, (setCounts.get(muscleId) ?? 0) + 1);
      if (!trainedDays.has(muscleId)) trainedDays.set(muscleId, new Set());
      trainedDays.get(muscleId).add(s.date);
    }
  }

  return muscles.map((m) => ({
    muscleId: m.id,
    avgSetsPerWeek: (setCounts.get(m.id) ?? 0) / range.weeks,
    freqPerWeek: (trainedDays.get(m.id)?.size ?? 0) / range.weeks,
  }));
}
