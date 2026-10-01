// ============================================================================
// TESTMODUS (Entwickler-Feature, NICHT für den späteren Produktiv-Einsatz
// gedacht) - schaltet zwischen der echten Datenbank ("fitlog") und einer
// separaten Datenbank mit synthetischen Testdaten ("fitlog-test") um, damit
// sich die App auch ohne eigene Trainingshistorie sinnvoll testen lässt (z. B.
// auf dem iPhone, s. ADR 0024). Umschalter im Profil-Tab (js/views/profile.js).
//
// Bewusst in dieser einzigen Datei isoliert - die übrigen Ankopplungsstellen
// im Rest der App sind jeweils mit dem Hinweis "TESTMODUS" markiert:
//   - js/db.js: Datenbankname kommt aus getActiveDbName() statt fest 'fitlog'
//   - js/app.js: seedTestData() wird beim Start einmalig aufgerufen, falls
//     Testmodus aktiv und die Test-DB noch leer ist
//   - js/views/profile.js: der Umschalter selbst (Einstellungen-Bereich)
//   - sw.js: diese Datei steht in der APP_SHELL-Liste
//
// Zum Entfernen (sobald die App produktiv genutzt wird, s. ADR 0024
// "Rückbau"): diese Datei löschen, die vier oben genannten Stellen
// zurückbauen, CACHE_NAME in sw.js hochzählen.
// ============================================================================

const STORAGE_KEY = 'fitlog:testModeEnabled';
const PROD_DB_NAME = 'fitlog';
const TEST_DB_NAME = 'fitlog-test';

// try/catch wie in settings.js: `localStorage` existiert nicht in jeder
// Umgebung (Node-Testlauf ohne DOM, Safari im privaten Modus kann den
// Zugriff sogar werfen lassen) - db.js liest getActiveDbName() beim
// Modul-Import, ein ungefangener Fehler hier würde also die komplette App
// (bzw. hier: jeden Testlauf) am Start hindern. Fällt defensiv auf "aus"
// zurück, nie auf die Test-Datenbank.
export function isTestModeEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTestModeEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // s. o. - kein Speicherort verfügbar, Umschalten bleibt dann wirkungslos
  }
}

// Von db.js beim Erzeugen der Dexie-Instanz gelesen (synchron, beim
// Modul-Import - noch bevor irgendeine View rendert).
export function getActiveDbName() {
  return isTestModeEnabled() ? TEST_DB_NAME : PROD_DB_NAME;
}

// Eigenes Flag statt bei jedem App-Start erneut `db.workouts.count()` gegen
// IndexedDB abzufragen (Nutzer-Bugreport: spürbar langsamerer Kaltstart,
// besonders nach einer iOS-Hintergrund-Pause, in der die App komplett neu
// lädt) - ein localStorage-Read ist ein synchroner, praktisch kostenloser
// Vorgleich gegenüber einem zusätzlichen asynchronen IndexedDB-Roundtrip auf
// JEDEM Start, nicht nur dem ersten.
const SEEDED_FLAG_KEY = 'fitlog:testDataSeeded';

export function isTestDataSeeded() {
  try {
    return localStorage.getItem(SEEDED_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

function markTestDataSeeded() {
  try {
    localStorage.setItem(SEEDED_FLAG_KEY, 'true');
  } catch {
    // s. o. - ohne Speicherort würde seedTestData() dann bei jedem Start
    // erneut laufen; hinnehmbar für dieses Dev-Feature.
  }
}

// --- Synthetischer Testdatensatz -------------------------------------------
//
// Deterministisch (fester Seed, einfacher linearer Kongruenzgenerator) und
// rein additiv über die normalen db.js-Funktionen erzeugt, die als Parameter
// hereingereicht werden (kein eigener Import von db.js in dieser Datei -
// vermeidet einen Ringbezug, da db.js umgekehrt getActiveDbName() von hier
// importiert). Simuliert ca. 3 Jahre Training mit zwei mehrwöchigen Pausen,
// zusätzlichen zufällig ausgelassenen Wochen und einem leichten
// Fortschritts-Trend (mehr Gewicht über die Zeit), damit der Volumen-Chart
// (3M/1J/Max) und "Workouts pro Woche" realistisch aussehen statt einer
// flachen Linie.
const SEED = 42;
// Exportiert, da js/views/workout.js (TESTMODUS-Markierung dort) daraus die
// im großen Kalender erreichbare Vergangenheit ableitet - s. dort.
export const TOTAL_WEEKS = 156; // ca. 3 Jahre
const LONG_BREAKS = [
  { startWeek: 60, weeks: 3 },
  { startWeek: 110, weeks: 4 },
];
const RANDOM_SKIP_CHANCE = 0.12;
const EXERCISE_IDS = [
  'romanian-dead-lift',
  'brustgestuetztes-rudern',
  'reverse-butterfly',
  'latzug',
  'bizeps-curls',
  'sitzendes-wadenheben',
];

function makeRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function isInLongBreak(week) {
  return LONG_BREAKS.some((b) => week >= b.startWeek && week < b.startWeek + b.weeks);
}

// Fisher-Yates mit der deterministischen rng() statt Array.sort(() => ...) -
// letzteres ist browserabhängig nicht stabil gleichverteilt.
function shuffled(array, rng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// `db`: Dexie-Instanz der AKTIVEN Datenbank (aus db.js, zeigt bereits auf
// die Test-DB, wenn diese Funktion aufgerufen wird - s. app.js). `dbFns`:
// { getOrCreateWorkoutForDate, addSet, addDays, mondayOf } aus db.js, vom
// Aufrufer hereingereicht (s. o., Begründung Ringbezug).
export async function seedTestData(db, dbFns) {
  // Sicherheitsnetz: Diese Funktion darf niemals gegen die echte
  // Produktiv-Datenbank laufen, selbst wenn sie versehentlich falsch
  // aufgerufen würde - echte Trainingsdaten sind unersetzlich.
  if (db.name !== TEST_DB_NAME) {
    throw new Error('seedTestData() darf nur gegen die Test-Datenbank laufen');
  }

  const { getOrCreateWorkoutForDate, addSet, addDays, mondayOf } = dbFns;
  const rng = makeRng(SEED);
  const today = new Date().toISOString().slice(0, 10);
  const lastCompleteMonday = addDays(mondayOf(today), -7);
  const firstMonday = addDays(lastCompleteMonday, -7 * (TOTAL_WEEKS - 1));

  // Die gesamte Erzeugung (ca. 300 Workouts, ca. 2000 Sätze) in EINER
  // einzigen Transaktion statt ca. 2500 einzeln awaiteten, je für sich
  // committeten Dexie-Aufrufen - letzteres war auf einem echten iPhone
  // (langsamere CPU, WebKit-IndexedDB-Overhead pro Transaktion) deutlich
  // spürbar langsam (Nutzer-Bugreport: langer schwarzer Bildschirm beim
  // ersten Start mit aktiviertem Testmodus). `getOrCreateWorkoutForDate()`/
  // `addSet()` öffnen selbst keine eigene Transaktion, reihen sich also
  // automatisch in diese äußere ein (Dexie-Verhalten).
  await db.transaction('rw', db.workouts, db.sets, async () => {
    let monday = firstMonday;
    for (let week = 0; week < TOTAL_WEEKS; week++) {
      const skip = isInLongBreak(week) || rng() < RANDOM_SKIP_CHANCE;
      if (!skip) {
        const trainingDayCount = 2 + Math.floor(rng() * 2); // 2-3 Trainingstage
        const dayOffsets = [...new Set(Array.from({ length: trainingDayCount }, () => Math.floor(rng() * 7)))];
        const progress = week / TOTAL_WEEKS; // 0 (vor 3 Jahren) bis knapp 1 (heute)

        for (const offset of dayOffsets) {
          const date = addDays(monday, offset);
          const workout = await getOrCreateWorkoutForDate(date);
          const exerciseCount = 2 + Math.floor(rng() * 2); // 2-3 Übungen pro Tag
          const exercisesToday = shuffled(EXERCISE_IDS, rng).slice(0, exerciseCount);

          for (const exerciseId of exercisesToday) {
            const baseWeight = 20 + rng() * 40; // 20-60 kg Basis, je Übung/Tag leicht unterschiedlich
            for (let s = 0; s < 3; s++) {
              const weight = Math.round((baseWeight * (1 + progress * 0.35) + (rng() - 0.5) * 4) * 2) / 2; // auf 0,5 kg gerundet
              const reps = 6 + Math.floor(rng() * 7); // 6-12
              await addSet(workout.id, exerciseId, Math.max(2, weight), reps);
            }
          }
        }
      }
      monday = addDays(monday, 7);
    }
  });

  markTestDataSeeded();
}
