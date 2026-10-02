// Dexie-Setup: IndexedDB als alleinige Datenquelle (offline-first).
// Schema entspricht Abschnitt 3 des Konzept-Dokuments, erweitert um
// workoutExercises (Abschnitt 10, s. ADR 0007).

// TESTMODUS (temporär, s. ADR 0024/js/testmode.js): Datenbankname kommt aus
// getActiveDbName() statt fest 'fitlog' - dieselben `.version(N).stores()`-
// Migrationen unten legen dadurch bei Bedarf eine komplett separate,
// schema-identische zweite Datenbank ("fitlog-test") an, ganz ohne eigene
// Schema-Definition. Zum Entfernen: diese Import-Zeile löschen, die nächste
// Zeile zurück auf `new Dexie('fitlog')`.
import { getActiveDbName } from './testmode.js';
import { computePRs } from './pr.js';

export const db = new Dexie(getActiveDbName());

db.version(1).stores({
  exercises: 'id, name, createdAt, updatedAt',
  routines: 'id, name, createdAt, updatedAt',
  routineExercises: 'id, routineId, exerciseId, order',
  workouts: 'id, routineId, startedAt, finishedAt, createdAt, updatedAt',
  sets: 'id, workoutId, exerciseId, createdAt, updatedAt',
});

// v2: Workout-Tab (Abschnitt 10) - workouts sind jetzt kalendertag-basiert
// (neues `date`-Feld), startedAt/finishedAt werden nicht mehr verwendet
// (kein "Training beenden"-Konzept mehr, s. ADR 0007). Neue Tabelle
// workoutExercises für die Übungs-Roster pro Workout.
db.version(2).stores({
  exercises: 'id, name, createdAt, updatedAt',
  routines: 'id, name, createdAt, updatedAt',
  routineExercises: 'id, routineId, exerciseId, order',
  workouts: 'id, routineId, date, createdAt, updatedAt',
  sets: 'id, workoutId, exerciseId, createdAt, updatedAt',
  workoutExercises: 'id, workoutId, exerciseId, order, sourceRoutineId, startedAt, createdAt, updatedAt',
});

// v3: Muskel-Zuordnung an Übungen (Abschnitt 13, s. ADR 0013/0020) - eine
// primäre (`primaryMuscleId`, einzelner Wert) und beliebig viele sekundäre
// Muskeln (`secondaryMuscleIds`, Array; ursprünglich Muskelgruppen, seit
// ADR 0020 einzelne Muskeln aus MUSCLES - Feldnamen/Indizes unverändert,
// nur die Bedeutung der gespeicherten IDs hat sich geändert). Kein eigenes
// Verknüpfungs-Table wie bei routineExercises/workoutExercises, da keine
// Zusatzdaten pro Zuordnung anfallen - `*secondaryMuscleIds` ist ein
// multiEntry-Index (führendes `*`), erlaubt effizientes Filtern nach einem
// einzelnen sekundären Muskel trotz Array-Feld. Bestehende Übungen bekommen
// keine automatische Migration - beide Felder bleiben bei ihnen `undefined`
// ("kein Muskel zugeordnet"), bis sie im Formular bearbeitet werden.
db.version(3).stores({
  exercises: 'id, name, primaryMuscleId, *secondaryMuscleIds, createdAt, updatedAt',
  routines: 'id, name, createdAt, updatedAt',
  routineExercises: 'id, routineId, exerciseId, order',
  workouts: 'id, routineId, date, createdAt, updatedAt',
  sets: 'id, workoutId, exerciseId, createdAt, updatedAt',
  workoutExercises: 'id, workoutId, exerciseId, order, sourceRoutineId, startedAt, createdAt, updatedAt',
});

// v4: Standard-Übungen (s. ADR 0021) - `isBuiltin` markiert vom Nutzer nicht
// veränderbare, mit der App ausgelieferte Übungen (s. BUILTIN_EXERCISES/
// seedBuiltinExercises() weiter unten). Indexiert, falls künftig gezielt
// nach Standard- vs. Nutzer-Übungen gefiltert werden soll. Bestehende
// Übungen bekommen keine Migration - `isBuiltin` bleibt bei ihnen
// `undefined` (= keine Standard-Übung), genau die gewünschte Bedeutung.
db.version(4).stores({
  exercises: 'id, name, primaryMuscleId, *secondaryMuscleIds, isBuiltin, createdAt, updatedAt',
  routines: 'id, name, createdAt, updatedAt',
  routineExercises: 'id, routineId, exerciseId, order',
  workouts: 'id, routineId, date, createdAt, updatedAt',
  sets: 'id, workoutId, exerciseId, createdAt, updatedAt',
  workoutExercises: 'id, workoutId, exerciseId, order, sourceRoutineId, startedAt, createdAt, updatedAt',
});

// v5: Eine Übung kann jetzt mehreren primären Muskeln zugeordnet werden (s.
// ADR 0022) - `primaryMuscleId` (einzelner Wert, seit Version 3) wird zu
// `primaryMuscleIds` (Array, multiEntry-Index wie schon `secondaryMuscleIds`
// seit Version 3). Bestehende, vor Version 5 angelegte Übungen behalten ihr
// altes `primaryMuscleId`-Feld unangetastet in der DB (wird von keinem Code
// mehr gelesen) und bekommen kein automatisches `primaryMuscleIds` - keine
// Migration, da die App noch nicht produktiv ist (kein Datenverlust-Risiko).
db.version(5).stores({
  exercises: 'id, name, *primaryMuscleIds, *secondaryMuscleIds, isBuiltin, createdAt, updatedAt',
  routines: 'id, name, createdAt, updatedAt',
  routineExercises: 'id, routineId, exerciseId, order',
  workouts: 'id, routineId, date, createdAt, updatedAt',
  sets: 'id, workoutId, exerciseId, createdAt, updatedAt',
  workoutExercises: 'id, workoutId, exerciseId, order, sourceRoutineId, startedAt, createdAt, updatedAt',
});

export function generateId() {
  return crypto.randomUUID();
}

export function nowISO() {
  return new Date().toISOString();
}

// Kalendertag als 'YYYY-MM-DD', lokale Zeitzone (kein UTC-Shift).
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISODate() {
  return toISODate(new Date());
}

// 'YYYY-MM-DD' + n Tage (lokale Zeitzone, kein UTC-Shift) - aus workout.js
// hierher verschoben, da der Statistik-Tab (Workouts-pro-Woche) dieselbe
// Rechnung für die Wochen-Buckets braucht (s. features.md).
export function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return toISODate(date);
}

// Ganzzahlige Tagesdifferenz zwischen zwei 'YYYY-MM-DD'-Daten (gleicher
// Grund wie addDays).
export function daysBetween(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

// Montag der ISO-Woche, die dateStr enthält - ebenfalls aus workout.js
// hierher verschoben (gleicher Grund wie daysBetween).
export function mondayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=So..6=Sa
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + diff);
  return toISODate(date);
}

// --- Muskeln & Muskelgruppen ---
//
// Zwei feste, vom Nutzer nicht bearbeitbare Taxonomien, kein eigenes
// Dexie-Table wie exercises/routines (s. ADR 0012, erweitert um ADR 0020):
// MUSCLE_GROUPS bündelt nur zur Anzeige/zum Filtern (Übungs-Sheet), Übungen
// verweisen NICHT mehr direkt auf eine Gruppe, sondern per `muscleId` auf
// einen einzelnen Eintrag aus MUSCLES - dessen `groupId` bestimmt die
// (primäre/sekundäre) Gruppenzugehörigkeit der Übung, s. muscleGroupIdOf().
// `id` ist bei beiden ein stabiler Slug statt einer UUID, da keine der
// beiden Listen zur Laufzeit verändert wird.
export const MUSCLE_GROUPS = [
  { id: 'brust', name: 'Brust' },
  { id: 'schultern', name: 'Schultern' },
  { id: 'ruecken', name: 'Rücken' },
  { id: 'arme', name: 'Arme' },
  { id: 'bauch', name: 'Bauch' },
  { id: 'po', name: 'Po' },
  { id: 'beine', name: 'Beine' },
];

export const MUSCLES = [
  { id: 'brust', name: 'Brust', groupId: 'brust' },
  { id: 'vordere-schulter', name: 'Vordere Schulter', groupId: 'schultern' },
  { id: 'seitliche-schulter', name: 'Seitliche Schulter', groupId: 'schultern' },
  { id: 'hintere-schulter', name: 'Hintere Schulter', groupId: 'schultern' },
  { id: 'lat', name: 'Lat', groupId: 'ruecken' },
  { id: 'oberer-ruecken', name: 'Oberer Rücken', groupId: 'ruecken' },
  { id: 'unterer-ruecken', name: 'Unterer Rücken', groupId: 'ruecken' },
  { id: 'bizeps', name: 'Bizeps', groupId: 'arme' },
  { id: 'trizeps', name: 'Trizeps', groupId: 'arme' },
  { id: 'unterarme', name: 'Unterarme', groupId: 'arme' },
  { id: 'gerade-bauchmuskeln', name: 'Gerade Bauchmuskeln', groupId: 'bauch' },
  { id: 'schraege-bauchmuskeln', name: 'Schräge Bauchmuskeln', groupId: 'bauch' },
  { id: 'po', name: 'Po', groupId: 'po' },
  { id: 'quadrizeps', name: 'Quadrizeps', groupId: 'beine' },
  { id: 'beinbeuger', name: 'Beinbeuger', groupId: 'beine' },
  { id: 'waden', name: 'Waden', groupId: 'beine' },
  { id: 'adduktoren', name: 'Adduktoren', groupId: 'beine' },
  { id: 'abduktoren', name: 'Abduktoren', groupId: 'beine' },
];

// Gruppe eines Muskels (für den primär-Gruppe-Filter im Übungs-Sheet) -
// `null` bei unbekannter/fehlender muscleId, statt zu werfen: wird auch für
// Anzeige-Zwecke an möglicherweise fehlenden Werten (ältere Übungen ohne
// Zuordnung) aufgerufen.
export function muscleGroupIdOf(muscleId) {
  return MUSCLES.find((m) => m.id === muscleId)?.groupId ?? null;
}

// --- Exercises ---

// Prüft eine Muskel-Zuordnung gegen die feste MUSCLES-Taxonomie (s. ADR
// 0020/0022): IDs müssen bekannte MUSKELN sein (nicht Gruppen), kein Muskel
// darf gleichzeitig primär UND sekundär auftauchen (eine Übung zeigt nicht
// gleichzeitig primär und sekundär auf denselben Muskel - wohl aber auf
// zwei verschiedene Muskeln derselben Gruppe, z. B. primär Bizeps und
// sekundär Trizeps, beide "Arme"), keine Duplikate innerhalb der primären
// bzw. innerhalb der sekundären Liste. Seit ADR 0022 kann eine Übung
// mehrere primäre Muskeln haben (`primaryMuscleIds`, vorher ein einzelner
// `primaryMuscleId`) - dieselben Regeln wie bisher, nur auf beiden Seiten
// jetzt ein Array. Wirft bei Verstoß statt still zu korrigieren - diese
// Funktion wird nur von vertrauenswürdigem Aufrufer-Code (Neue-Übung-/
// Bearbeiten-Sheet) mit bereits von einer festen Werteliste stammenden IDs
// aufgerufen, kein Nutzer-Freitext.
function validateMuscleAssignment(primaryMuscleIds, secondaryMuscleIds) {
  const validIds = new Set(MUSCLES.map((m) => m.id));
  for (const id of primaryMuscleIds) {
    if (!validIds.has(id)) {
      throw new Error(`Unbekannter primärer Muskel: ${id}`);
    }
  }
  for (const id of secondaryMuscleIds) {
    if (!validIds.has(id)) {
      throw new Error(`Unbekannter sekundärer Muskel: ${id}`);
    }
  }
  if (new Set(primaryMuscleIds).size !== primaryMuscleIds.length) {
    throw new Error('Primäre Muskeln enthalten Duplikate.');
  }
  if (new Set(secondaryMuscleIds).size !== secondaryMuscleIds.length) {
    throw new Error('Sekundäre Muskeln enthalten Duplikate.');
  }
  if (primaryMuscleIds.some((id) => secondaryMuscleIds.includes(id))) {
    throw new Error('Ein Muskel darf nicht gleichzeitig primär und sekundär angegeben werden.');
  }
}

// `muscleAssignment` optional ({ primaryMuscleIds, secondaryMuscleIds }) -
// ohne Angabe legt eine neue Übung ohne Muskel-Zuordnung an (Standardfall,
// solange das Zuordnungs-Formular noch nicht existiert).
export async function createExercise(name, muscleAssignment = {}) {
  const { primaryMuscleIds = [], secondaryMuscleIds = [] } = muscleAssignment;
  validateMuscleAssignment(primaryMuscleIds, secondaryMuscleIds);
  const ts = nowISO();
  const exercise = { id: generateId(), name, primaryMuscleIds, secondaryMuscleIds, createdAt: ts, updatedAt: ts };
  await db.exercises.add(exercise);
  return exercise;
}

// `muscleAssignment` bewusst optional und standardmäßig nicht gesetzt
// (statt mit leeren Default-Werten): Nur wenn explizit ein
// `{ primaryMuscleIds, secondaryMuscleIds }`-Objekt übergeben wird, wird die
// Muskel-Zuordnung ersetzt - ein reines Umbenennen darf eine bereits
// bestehende Zuordnung nicht versehentlich auf "kein Muskel" zurücksetzen.
// Aufrufer: das Neue-Übung-Sheet im Bearbeiten-Modus (Workout-Tab, geöffnet
// über das "⋮"-Menü des Übungs-Detail-Sheets). Lehnt Standard-Übungen ab
// (s. ADR 0021) - das UI blendet das Menü für sie zwar bereits komplett aus,
// diese Prüfung ist die eigentliche Absicherung (defense in depth).
export async function updateExercise(id, name, muscleAssignment) {
  const existing = await db.exercises.get(id);
  if (existing?.isBuiltin) {
    throw new Error('Standard-Übungen können nicht bearbeitet werden.');
  }
  const changes = { name, updatedAt: nowISO() };
  if (muscleAssignment) {
    const { primaryMuscleIds = [], secondaryMuscleIds = [] } = muscleAssignment;
    validateMuscleAssignment(primaryMuscleIds, secondaryMuscleIds);
    changes.primaryMuscleIds = primaryMuscleIds;
    changes.secondaryMuscleIds = secondaryMuscleIds;
  }
  await db.exercises.update(id, changes);
}

// Löschen einer Übung entfernt sie aus allen Routinen und aus allen
// Workout-Rostern, in denen noch keine Sätze für sie erfasst wurden.
// Bereits erfasste Sätze (und die zugehörigen workoutExercises-Einträge
// mit gesetztem startedAt) bleiben zur Wahrung des Verlaufs erhalten.
// Lehnt Standard-Übungen ab (s. ADR 0021) - gleicher Grund/dieselbe
// defense-in-depth-Überlegung wie bei updateExercise().
export async function deleteExercise(id) {
  const existing = await db.exercises.get(id);
  if (existing?.isBuiltin) {
    throw new Error('Standard-Übungen können nicht gelöscht werden.');
  }
  await db.transaction('rw', db.exercises, db.routineExercises, db.workoutExercises, async () => {
    await db.routineExercises.where('exerciseId').equals(id).delete();
    const entries = await db.workoutExercises.where('exerciseId').equals(id).toArray();
    const removable = entries.filter((e) => e.startedAt === null);
    await db.workoutExercises.bulkDelete(removable.map((e) => e.id));
    await db.exercises.delete(id);
  });
}

// --- Standard-Übungen (Seed) ---
//
// Feste Liste von Übungen, die mit jeder Installation der App automatisch
// angelegt werden (s. ADR 0021) - eigene Slug-IDs statt generateId(), damit
// seedBuiltinExercises() beim nächsten App-Start erkennen kann, welche
// Einträge schon existieren (analog zu MUSCLES/MUSCLE_GROUPS oben).
// `isBuiltin: true` sperrt sie in updateExercise()/deleteExercise() gegen
// jede Änderung durch den Nutzer, zusätzlich zur UI-Sperre im
// Übungs-Detail-Sheet (workout.js blendet dessen "⋮"-Menü für sie komplett
// aus statt es nur zu deaktivieren).
//
// Einmal hier aufgenommene Einträge werden nie mehr entfernt (kein
// Lösch-Fall vorgesehen) - nur Name/Muskel-Zuordnung eines bestehenden
// Eintrags ändern oder neue Einträge ergänzen. seedBuiltinExercises()
// gleicht bei jedem App-Start ALLE Felder eines vorhandenen Eintrags gegen
// diese Liste ab und schreibt Änderungen zurück, damit ein späteres
// App-Update auch bereits installierte Standard-Übungen aktualisiert.
export const BUILTIN_EXERCISES = [
  // Pull Day (vom Nutzer geliefert, 2026-09-27) - weitere Tage/Übungen folgen.
  {
    id: 'romanian-dead-lift',
    name: 'Romanian Dead Lift',
    primaryMuscleIds: ['po', 'beinbeuger'],
    secondaryMuscleIds: ['unterer-ruecken'],
  },
  { id: 'sitzendes-wadenheben', name: 'Sitzendes Wadenheben', primaryMuscleIds: ['waden'], secondaryMuscleIds: [] },
  {
    id: 'brustgestuetztes-rudern',
    name: 'Brustgestütztes Rudern',
    primaryMuscleIds: ['lat', 'oberer-ruecken'],
    secondaryMuscleIds: ['bizeps', 'unterarme'],
  },
  {
    id: 'reverse-butterfly',
    name: 'Reverse Butterfly',
    primaryMuscleIds: ['hintere-schulter'],
    secondaryMuscleIds: ['seitliche-schulter', 'oberer-ruecken'],
  },
  {
    id: 'latzug',
    name: 'Latzug',
    primaryMuscleIds: ['lat', 'bizeps'],
    secondaryMuscleIds: ['unterarme', 'unterer-ruecken'],
  },
  { id: 'bizeps-curls', name: 'Bizeps Curls', primaryMuscleIds: ['bizeps'], secondaryMuscleIds: ['unterarme'] },
];

// Legt fehlende BUILTIN_EXERCISES-Einträge an und gleicht bereits
// vorhandene auf den aktuellen Stand der Liste ab (Name/Muskel-Zuordnung/
// isBuiltin) - idempotent, wird bei jedem App-Start aufgerufen (s. app.js).
// Schreibt ein bestehendes Dokument nur, wenn sich tatsächlich etwas
// geändert hat, um bei jedem Start unnötige updatedAt-Änderungen zu
// vermeiden. `defs` ist per Default BUILTIN_EXERCISES, aber austauschbar
// für Tests (s. tests/db.test.js), ohne die echte Liste anfassen zu müssen.
export async function seedBuiltinExercises(defs = BUILTIN_EXERCISES) {
  if (defs.length === 0) return;

  const ids = defs.map((def) => def.id);
  const existing = await db.exercises.where('id').anyOf(ids).toArray();
  const existingById = new Map(existing.map((e) => [e.id, e]));

  await db.transaction('rw', db.exercises, async () => {
    for (const def of defs) {
      const primaryMuscleIds = def.primaryMuscleIds ?? [];
      const secondaryMuscleIds = def.secondaryMuscleIds ?? [];
      validateMuscleAssignment(primaryMuscleIds, secondaryMuscleIds);
      const current = existingById.get(def.id);

      if (!current) {
        const ts = nowISO();
        await db.exercises.add({
          id: def.id,
          name: def.name,
          primaryMuscleIds,
          secondaryMuscleIds,
          isBuiltin: true,
          createdAt: ts,
          updatedAt: ts,
        });
        continue;
      }

      const primaryChanged = JSON.stringify(current.primaryMuscleIds ?? []) !== JSON.stringify(primaryMuscleIds);
      const secondaryChanged = JSON.stringify(current.secondaryMuscleIds ?? []) !== JSON.stringify(secondaryMuscleIds);
      const changed = current.name !== def.name || primaryChanged || secondaryChanged || !current.isBuiltin;

      if (changed) {
        await db.exercises.update(def.id, {
          name: def.name,
          primaryMuscleIds,
          secondaryMuscleIds,
          isBuiltin: true,
          updatedAt: nowISO(),
        });
      }
    }
  });
}

// --- Routines ---

export async function createRoutine(name) {
  const ts = nowISO();
  const routine = { id: generateId(), name, createdAt: ts, updatedAt: ts };
  await db.routines.add(routine);
  return routine;
}

export async function updateRoutine(id, name) {
  await db.routines.update(id, { name, updatedAt: nowISO() });
}

// Löschen einer Routine entfernt ihre Übungs-Verknüpfungen sowie - in jedem
// Workout, das diese Routine gewählt hatte - alle noch nicht begonnenen
// workoutExercises-Einträge aus ihr (gleiche Regel wie beim manuellen
// Entfernen/Wechseln einer Routine im Workout-Tab, s. ADR 0007). Workouts
// selbst bleiben erhalten, verlieren nur den Routine-Bezug.
export async function deleteRoutine(id) {
  await db.transaction(
    'rw',
    db.routines,
    db.routineExercises,
    db.workouts,
    db.workoutExercises,
    async () => {
      await db.routineExercises.where('routineId').equals(id).delete();

      const affectedWorkouts = await db.workouts.where('routineId').equals(id).toArray();
      for (const workout of affectedWorkouts) {
        const entries = await db.workoutExercises.where('workoutId').equals(workout.id).toArray();
        const removable = entries.filter((e) => e.sourceRoutineId === id && e.startedAt === null);
        await db.workoutExercises.bulkDelete(removable.map((e) => e.id));
      }

      await db.workouts.where('routineId').equals(id).modify({ routineId: null });
      await db.routines.delete(id);
    }
  );
}

export async function addExerciseToRoutine(routineId, exerciseId, order) {
  const entry = { id: generateId(), routineId, exerciseId, order };
  await db.routineExercises.add(entry);
  return entry;
}

export async function getRoutineExercises(routineId) {
  const entries = await db.routineExercises.where('routineId').equals(routineId).sortBy('order');
  return entries;
}

export async function appendExerciseToRoutine(routineId, exerciseId) {
  const entries = await getRoutineExercises(routineId);
  return addExerciseToRoutine(routineId, exerciseId, entries.length);
}

export async function removeExerciseFromRoutine(id) {
  await db.routineExercises.delete(id);
}

// --- Workouts (Tages-Workout, s. Abschnitt 10 / ADR 0007) ---

export async function getWorkoutByDate(date) {
  const workout = await db.workouts.where('date').equals(date).first();
  return workout ?? null;
}

export async function getOrCreateWorkoutForDate(date) {
  const existing = await getWorkoutByDate(date);
  if (existing) return existing;

  const ts = nowISO();
  const workout = { id: generateId(), routineId: null, date, createdAt: ts, updatedAt: ts };
  await db.workouts.add(workout);
  return workout;
}

// Sortierregel: erst alle Übungen mit gesetztem startedAt (aufsteigend
// danach), dann alle ohne startedAt (aufsteigend nach order).
export async function getWorkoutExercises(workoutId) {
  const entries = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
  entries.sort((a, b) => {
    const aStarted = a.startedAt !== null;
    const bStarted = b.startedAt !== null;
    if (aStarted && bStarted) return a.startedAt < b.startedAt ? -1 : 1;
    if (aStarted !== bStarted) return aStarted ? -1 : 1;
    return a.order - b.order;
  });
  return entries;
}

// Übernimmt eine Routine in ein Workout (Erstauswahl oder Wechsel):
// - noch nicht begonnene, routinen-stammende Einträge werden entfernt
// - bereits begonnene Einträge bleiben erhalten; ist ihre Übung auch in der
//   neuen Routine enthalten, übernehmen sie deren order, sonst werden sie
//   hinter die neue Routine einsortiert (wirkt sich laut Sortierregel oben
//   nicht auf die Anzeige aus, da begonnene Übungen ohnehin nach startedAt
//   sortiert werden - dient nur der Datenkonsistenz)
// - manuell hinzugefügte Übungen (sourceRoutineId null) bleiben unberührt
export async function applyRoutineToWorkout(workoutId, routineId) {
  await db.transaction('rw', db.workouts, db.workoutExercises, db.routineExercises, async () => {
    const current = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    const removable = current.filter((e) => e.sourceRoutineId !== null && e.startedAt === null);
    await db.workoutExercises.bulkDelete(removable.map((e) => e.id));

    const remainingByExerciseId = new Map(
      current.filter((e) => !removable.includes(e)).map((e) => [e.exerciseId, e])
    );

    const routineEntries = await getRoutineExercises(routineId);
    const ts = nowISO();

    for (const re of routineEntries) {
      const existing = remainingByExerciseId.get(re.exerciseId);
      if (existing) {
        await db.workoutExercises.update(existing.id, { order: re.order, updatedAt: ts });
        remainingByExerciseId.delete(re.exerciseId);
      } else {
        await db.workoutExercises.add({
          id: generateId(),
          workoutId,
          exerciseId: re.exerciseId,
          order: re.order,
          sourceRoutineId: routineId,
          startedAt: null,
          createdAt: ts,
          updatedAt: ts,
        });
      }
    }

    let tailIndex = routineEntries.length;
    for (const entry of remainingByExerciseId.values()) {
      await db.workoutExercises.update(entry.id, { order: tailIndex, updatedAt: ts });
      tailIndex += 1;
    }

    await db.workouts.update(workoutId, { routineId, updatedAt: ts });
  });
}

// Entfernt die Routine von einem Workout: gleiche Aufräum-Regel wie bei
// applyRoutineToWorkout, nur ohne neue Routine, die eingefügt wird.
export async function removeRoutineFromWorkout(workoutId) {
  await db.transaction('rw', db.workouts, db.workoutExercises, async () => {
    const current = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    const removable = current.filter((e) => e.sourceRoutineId !== null && e.startedAt === null);
    await db.workoutExercises.bulkDelete(removable.map((e) => e.id));
    await db.workouts.update(workoutId, { routineId: null, updatedAt: nowISO() });
  });
}

// Entfernt eine einzelne Übung aus dem Tages-Roster (nicht die Übung selbst
// - die bleibt in der Datenbank und in allen Routinen erhalten). Anders als
// die Kaskaden-Funktionen oben (die mehrere Einträge anhand einer Regel
// entfernen) eine gezielte Einzel-Aktion ohne eigene startedAt-Prüfung - die
// aufrufende UI bietet diese Aktion von vornherein nur für unbegonnene
// Einträge an (s. js/views/workout.js), damit bereits erfasste Sätze nie
// durch diesen Weg verloren gehen (dieselbe Grundregel wie bei jeder
// anderen workoutExercises-Kaskade, s. ADR 0007).
//
// Bewusst OHNE `confirm()`-Dialog (Nutzer-Vorgabe, abweichend von der
// sonstigen App-Konvention "jedes Löschen braucht einen Bestätigungsdialog",
// s. CLAUDE.md) - der Weg dahin (Kontextmenü) betrifft wie oben beschrieben
// ausschließlich Einträge ohne jegliche Trainingsdaten: Verlieren geht dabei
// höchstens die Zuordnung "diese Übung steht heute auf dem Zettel", nie ein
// erfasster Satz - erneutes Hinzufügen kostet nur ein paar Sekunden über
// "Übung hinzufügen". Die Zweistufigkeit des Menüs selbst (erst "⋮"
// antippen, dann den Eintrag) übernimmt zusätzlich die Rolle der
// Bestätigung.
export async function removeExerciseFromWorkout(entryId) {
  await db.workoutExercises.delete(entryId);
}

// Legt die Reihenfolge der NOCH NICHT BEGONNENEN Übungen eines Workouts neu
// fest (Roster im Workout-Tab, Umsortieren per Gedrückthalten). `orderedEntryIds`
// = workoutExercises-IDs in der gewünschten Reihenfolge. Begonnene Übungen
// (startedAt gesetzt) sind bewusst tabu: Ihre Position folgt allein aus dem
// Zeitpunkt des ersten Satzes (s. Sortierregel bei getWorkoutExercises) und
// wird nie manuell verändert - IDs begonnener oder fremder Einträge werden
// ignoriert. Unbegonnene Einträge, die in der Liste fehlen, rücken in ihrer
// bisherigen Reihenfolge ans Ende, statt mit einer doppelten `order` zu
// kollidieren. Gilt nur für diesen Tag, die Routine bleibt unverändert
// (Tages-Modell, s. ADR 0007).
export async function reorderWorkoutExercises(workoutId, orderedEntryIds) {
  await db.transaction('rw', db.workoutExercises, async () => {
    const entries = await getWorkoutExercises(workoutId);
    const unstarted = entries.filter((e) => e.startedAt === null);
    const byId = new Map(unstarted.map((e) => [e.id, e]));
    const requested = orderedEntryIds.filter((id, i) => byId.has(id) && orderedEntryIds.indexOf(id) === i);
    const rest = unstarted.filter((e) => !requested.includes(e.id)).map((e) => e.id);
    const ts = nowISO();
    let order = 0;
    for (const id of [...requested, ...rest]) {
      await db.workoutExercises.update(id, { order: order++, updatedAt: ts });
    }
  });
}

// Fügt mehrere Übungen gesammelt manuell zu einem Workout hinzu (Übungs-Sheet
// im Workout-Tab, Mehrfachauswahl - s. Abschnitt 13). `sourceRoutineId: null`
// ist entscheidend, damit applyRoutineToWorkout/removeRoutineFromWorkout
// diese Einträge nicht mit aufräumen (s. deren Kommentare oben sowie ADR
// 0007, "Manuell hinzugefügte Übungen bleiben unberührt"). Eine Transaktion
// statt N unabhängiger Adds, damit bei einem Fehler nicht nur ein Teil der
// Auswahl im Roster landet.
export async function addExercisesToWorkout(workoutId, exerciseIds) {
  await db.transaction('rw', db.workoutExercises, async () => {
    const entries = await getWorkoutExercises(workoutId);
    let order = entries.length;
    const ts = nowISO();
    for (const exerciseId of exerciseIds) {
      await db.workoutExercises.add({
        id: generateId(),
        workoutId,
        exerciseId,
        order: order++,
        sourceRoutineId: null,
        startedAt: null,
        createdAt: ts,
        updatedAt: ts,
      });
    }
  });
}

// Markiert eine Übung im Workout als begonnen (einmalig, beim ersten
// erfassten Satz) - Grundlage der dynamischen Sortierung, s. Sortierregel.
export async function markWorkoutExerciseStarted(workoutId, exerciseId) {
  const entry = await db.workoutExercises.where({ workoutId, exerciseId }).first();
  if (entry && !entry.startedAt) {
    await db.workoutExercises.update(entry.id, { startedAt: nowISO(), updatedAt: nowISO() });
  }
}

// --- Sets ---

export async function addSet(workoutId, exerciseId, weight, reps) {
  const ts = nowISO();
  const set = {
    id: generateId(),
    workoutId,
    exerciseId,
    weight,
    reps,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.sets.add(set);
  return set;
}

export async function deleteSet(id) {
  await db.sets.delete(id);
}

// Nachträgliches Bearbeiten eines bereits erfassten Satz-Werts - mit ADR
// 0007 (Wegfall des Verlauf-Tabs) als nicht mehr möglich dokumentiert, jetzt
// über die Übungs-Detailseite (Abschnitt 12) wieder eingeführt ("Update"-
// Button bei ausgewähltem bestehendem Satz). Siehe ADR 0010.
export async function updateSet(id, weight, reps) {
  await db.sets.update(id, { weight, reps, updatedAt: nowISO() });
}

// Für die Progressive-Overload-Hilfe: letzter erfasster Satz dieser Übung,
// übungsbezogen über alle Workouts hinweg (s. Konzept Flow 3).
export async function getLastSetForExercise(exerciseId) {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).sortBy('createdAt');
  return sets.length ? sets[sets.length - 1] : null;
}

// Verlauf einer Übung für die Übungs-Detailseite (Abschnitt 12): ALLE Tage,
// an denen mindestens ein Satz dieser Übung erfasst wurde, gruppiert nach
// Datum, neueste zuerst - eingeschlossen der gerade betrachtete Tag/das
// gerade laufende Workout (s. ADR 0010, Nachtrag 2026-09-29: bis dahin
// wurde genau dieser Tag noch ausgeschlossen, auf ausdrücklichen
// Nutzer-Wunsch jetzt nicht mehr - "Verlauf" zeigt seitdem konsequent den
// vollständigen Satz-Verlauf, unabhängig vom Tages-Tab derselben Seite).
export async function getExerciseSetHistory(exerciseId) {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
  if (sets.length === 0) return [];

  const workoutIds = [...new Set(sets.map((s) => s.workoutId))];
  const workouts = await db.workouts.bulkGet(workoutIds);
  const dateByWorkoutId = Object.fromEntries(workoutIds.map((id, i) => [id, workouts[i]?.date ?? null]));

  const setsByDate = {};
  for (const s of sets) {
    const date = dateByWorkoutId[s.workoutId];
    if (!date) continue; // Workout wurde inzwischen gelöscht (sollte laut Kaskaden-Regeln nicht vorkommen, defensiv trotzdem übersprungen)
    (setsByDate[date] ??= []).push(s);
  }

  return Object.entries(setsByDate)
    .map(([date, daySets]) => ({
      date,
      sets: daySets.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// PR-Markierungen (s. ADR 0025/js/pr.js) für mehrere Übungen auf einmal -
// lädt die komplette Satz-Historie jeder Übung (über den vorhandenen
// `exerciseId`-Index, kein neuer Index nötig), sortiert sie chronologisch
// (Workout-Datum, dann createdAt - ein eigenes Reihenfolge-Feld haben Sätze
// nicht, die Anzeige sortiert überall ebenfalls nach createdAt) und
// berechnet die PRs je Übung getrennt. Ergebnis: eine gemeinsame Map
// setId -> 'weight' | 'reps' über alle Übungen. Bewusst kein Cache: ein
// Aufruf kostet zwei IndexedDB-Abfragen, gemessen deutlich unter dem
// 100-ms-Ziel, und spart dafür jede Invalidierungslogik.
export async function getPRsForExercises(exerciseIds) {
  const ids = [...new Set(exerciseIds)];
  if (ids.length === 0) return new Map();

  const sets = await db.sets.where('exerciseId').anyOf(ids).toArray();
  const workoutIds = [...new Set(sets.map((s) => s.workoutId))];
  const workouts = await db.workouts.bulkGet(workoutIds);
  const dateByWorkoutId = Object.fromEntries(workoutIds.map((id, i) => [id, workouts[i]?.date ?? null]));

  const setsByExercise = {};
  for (const s of sets) {
    const date = dateByWorkoutId[s.workoutId];
    if (!date) continue; // Workout gelöscht (sollte laut Kaskaden-Regeln nicht vorkommen) - defensiv übersprungen
    (setsByExercise[s.exerciseId] ??= []).push({ ...s, date });
  }

  const result = new Map();
  for (const exerciseSets of Object.values(setsByExercise)) {
    exerciseSets.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1));
    for (const [setId, type] of computePRs(exerciseSets)) result.set(setId, type);
  }
  return result;
}

// --- Statistik ---

// Tage (als 'YYYY-MM-DD'-Strings, unsortiert, keine Duplikate), an denen
// mindestens ein Satz erfasst wurde - Grundlage für den Statistik-Tab
// ("Workouts pro Woche"). Bewusst NICHT die rohen `workouts`-Zeilen gezählt:
// die entstehen schon beim bloßen Wählen einer Routine oder manuellen
// Hinzufügen einer Übung (s. getOrCreateWorkoutForDate), auch ganz ohne
// einen einzigen geloggten Satz - dieselbe "dokumentiert"-Definition wie der
// grüne Punkt im kleinen Kalender (Workout-Tab, s. workout.js).
export async function getTrainedDates() {
  const sets = await db.sets.toArray();
  if (sets.length === 0) return [];

  const workoutIds = [...new Set(sets.map((s) => s.workoutId))];
  const workouts = await db.workouts.bulkGet(workoutIds);
  const dateByWorkoutId = Object.fromEntries(workoutIds.map((id, i) => [id, workouts[i]?.date ?? null]));

  const dates = new Set();
  for (const s of sets) {
    const date = dateByWorkoutId[s.workoutId];
    if (date) dates.add(date); // Workout gelöscht (sollte laut Kaskaden-Regeln nicht vorkommen) - defensiv übersprungen
  }
  return [...dates];
}

// Trainingsvolumen pro Kalenderwoche (Gewicht × Wiederholungen, aufsummiert
// über alle Sätze und Übungen einer ISO-8601-Woche, Montag-Sonntag) für den
// Statistik-Tab ("Volumen"-Chart, s. Hundertzweiundzwanzigste Iteration in
// design-system.md - ersetzt die frühere Tages-Aggregation
// getDailyTrainingVolumes()). Nur Wochen mit mindestens einem Satz,
// aufsteigend nach Wochenbeginn sortiert - dieselbe zweistufige Abfrage
// (erst alle Sätze, dann die zugehörigen Workouts per bulkGet) wie
// getTrainedDates()/getExerciseSetHistory(), aus demselben Grund (eine
// Abfrage statt einer pro Woche). Ob eine Woche VOLLSTÄNDIG ist (ihr
// Sonntag bereits vorbei) entscheidet bewusst NICHT diese Funktion,
// sondern der Aufrufer (js/views/statistics.js) - reiner Datenzugriff ohne
// "heute"-Bezug, analog zu den übrigen `get*`-Funktionen hier.
export async function getWeeklyTrainingVolumes() {
  const sets = await db.sets.toArray();
  if (sets.length === 0) return [];

  const workoutIds = [...new Set(sets.map((s) => s.workoutId))];
  const workouts = await db.workouts.bulkGet(workoutIds);
  const dateByWorkoutId = Object.fromEntries(workoutIds.map((id, i) => [id, workouts[i]?.date ?? null]));

  const volumeByWeekStart = {};
  for (const s of sets) {
    const date = dateByWorkoutId[s.workoutId];
    if (!date) continue; // Workout gelöscht (sollte laut Kaskaden-Regeln nicht vorkommen) - defensiv übersprungen
    const weekStart = mondayOf(date);
    volumeByWeekStart[weekStart] = (volumeByWeekStart[weekStart] ?? 0) + s.weight * s.reps;
  }

  return Object.entries(volumeByWeekStart)
    .map(([weekStart, volume]) => ({ weekStart, volume }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}
