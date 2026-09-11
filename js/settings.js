// Geräte-lokale App-Einstellungen (Standardanzahl Sätze, Wochenziel) -
// bewusst in localStorage statt Dexie, dieselbe Begründung wie js/profile.js:
// reine Geräte-Konfiguration, keine Trainingsdaten. Ersetzt die bisherigen
// hart codierten Konstanten DEFAULT_SET_COUNT (workout-exercise-detail.js)
// und WEEKLY_GOAL (statistics.js), die genau für diesen Zweck vorbereitet
// waren.
const STORAGE_KEY = 'fitlog:settings';

const DEFAULTS = {
  defaultSetCount: 3,
  weeklyGoal: 5,
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
