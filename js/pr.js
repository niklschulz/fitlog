// PR-Markierungen (persönliche Rekorde) an einzelnen Sätzen, s. ADR 0025.
// Reine Berechnung ohne DOM- oder Dexie-Zugriff - das Laden der Sätze
// übernimmt getPRsForExercises() in js/db.js, getestet wird diese Datei
// direkt in tests/pr.test.js.
//
// PRs werden bei jedem Rendern neu berechnet statt in der DB gespeichert:
// Bearbeiten oder Löschen eines früheren Satzes wirkt sich dadurch sofort
// korrekt auf alle späteren Badges aus, ohne dass gespeicherte Markierungen
// nachgezogen werden müssten.

// Gewichte auf 2 Nachkommastellen normiert, damit Fließkomma-Reste
// (z. B. 52.5 vs. 52.500000001 nach Stepper-Rechnung) als dasselbe Gewicht
// zählen.
function weightKey(weight) {
  return Math.round(weight * 100) / 100;
}

// Satz zählt nur mit gültigem Gewicht und mindestens einer Wiederholung -
// alles andere wird beim Durchlauf komplett übersprungen (weder markiert
// noch als Vergleichsbasis verwendet). Aufwärmsätze kennt das Datenmodell
// nicht, daher keine eigene Ausnahme dafür.
function isValidSet(set) {
  return Number.isFinite(set.weight) && set.weight >= 0 && Number.isFinite(set.reps) && set.reps > 0;
}

/**
 * @param {Array} sets  Alle Sätze EINER Übung, chronologisch sortiert (nach
 *                      Workout-Datum, innerhalb eines Workouts nach
 *                      createdAt), jeweils mit { id, workoutId, weight, reps }
 * @returns {Map<string, 'weight' | 'reps'>}  setId -> PR-Typ, nur für
 *                      markierte Sätze
 */
export function computePRs(sets) {
  const result = new Map();
  let maxWeight = null; // null = noch kein gültiger Satz gesehen
  const bestRepsByWeight = new Map();
  const weightsInPreviousWorkouts = new Set();
  let currentWorkoutId = null;
  let currentWorkoutWeights = new Set();

  for (const set of sets) {
    if (!isValidSet(set)) continue;

    // Workout-Wechsel: Gewichte des gerade abgeschlossenen Workouts gelten
    // ab jetzt als "in einem früheren Workout genutzt".
    if (set.workoutId !== currentWorkoutId) {
      for (const w of currentWorkoutWeights) weightsInPreviousWorkouts.add(w);
      currentWorkoutWeights = new Set();
      currentWorkoutId = set.workoutId;
    }

    const weight = weightKey(set.weight);
    const bestReps = bestRepsByWeight.get(weight);

    if (weight > 0 && (maxWeight === null || weight > maxWeight)) {
      result.set(set.id, 'weight');
    } else if (weightsInPreviousWorkouts.has(weight) && set.reps > bestReps) {
      result.set(set.id, 'reps');
    }

    if (maxWeight === null || weight > maxWeight) maxWeight = weight;
    if (bestReps === undefined || set.reps > bestReps) bestRepsByWeight.set(weight, set.reps);
    currentWorkoutWeights.add(weight);
  }

  return result;
}
