// Reine Filterlogik der Übungslisten in den Übungs-Sheets (Workout- und
// Statistik-Tab). Ohne DOM- und DB-Zugriff; die Zuordnung Muskel -> Gruppe
// (`muscleGroupIdOf` aus js/db.js) kommt als Parameter, damit diese Datei in
// Node ohne Dexie getestet werden kann (tests/exerciseFilter.test.js).
//
// Muskelgruppen-Filter: trifft, wenn EIN BELIEBIGER primärer Muskel der Übung
// zur Gruppe gehört (ADR 0022, mehrere primäre Muskeln). Sekundäre Muskeln
// zählen bewusst nicht (ADR 0020). Übungen ohne Zuordnung fallen bei aktivem
// Filter raus.
export function filterExercises(exercises, { query = '', muscleGroupId = null } = {}, groupIdOf) {
  const q = query.trim().toLowerCase();
  let result = q ? exercises.filter((ex) => ex.name.toLowerCase().includes(q)) : exercises;
  if (muscleGroupId) {
    result = result.filter((ex) => (ex.primaryMuscleIds ?? []).some((id) => groupIdOf(id) === muscleGroupId));
  }
  return result;
}
