// Export/Import aller Fitlog-Daten als einzelne JSON-Datei (s. ADR 0034):
// alle Dexie-Tabellen der AKTIVEN Datenbank (im Testmodus also die
// Test-DB, s. js/testmode.js) plus Profil (js/profile.js) und Einstellungen
// (js/settings.js) aus localStorage. Import ersetzt den kompletten
// Datenbestand - kein Zusammenführen.
//
// Die reinen Datenfunktionen bekommen die Dexie-Instanz als Parameter statt
// js/db.js zu importieren, damit sie sich wie die übrigen Datenfunktionen in
// Node testen lassen (tests/backup.test.js). Profil/Einstellungen werden
// vom Aufrufer (views/profile.js) hereingereicht bzw. zurückgegeben, da
// localStorage in Node fehlt.

export const BACKUP_APP = 'fitlog';
export const BACKUP_FORMAT_VERSION = 1;

export class BackupError extends Error {}

// `profile`/`settings`: aktueller Stand aus getProfile()/getSettings().
export async function buildBackup(db, { profile, settings }) {
  const data = {};
  await db.transaction('r', db.tables, async () => {
    for (const table of db.tables) {
      data[table.name] = await table.toArray();
    }
  });
  return {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    profile,
    settings,
  };
}

// Liest und prüft eine Backup-Datei (Rohtext), wirft BackupError mit einer
// für den Nutzer lesbaren Meldung. Prüft Struktur, nicht Inhalt der
// einzelnen Datensätze - bis auf `id`, ohne die ein Datensatz in Dexie nicht
// speicherbar wäre.
export function parseBackup(text, db) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new BackupError('Die Datei ist kein gültiges Fitlog-Backup (kein JSON).');
  }
  if (!backup || backup.app !== BACKUP_APP || typeof backup.data !== 'object' || backup.data === null) {
    throw new BackupError('Die Datei ist kein Fitlog-Backup.');
  }
  if (!Number.isInteger(backup.formatVersion) || backup.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError('Das Backup stammt aus einer neueren Fitlog-Version und kann nicht importiert werden.');
  }
  for (const table of db.tables) {
    const rows = backup.data[table.name];
    if (!Array.isArray(rows)) {
      throw new BackupError(`Im Backup fehlt die Tabelle „${table.name}“.`);
    }
    if (rows.some((row) => !row || typeof row !== 'object' || typeof row.id !== 'string')) {
      throw new BackupError(`Die Tabelle „${table.name}“ im Backup enthält ungültige Einträge.`);
    }
  }
  return backup;
}

// Kennzahlen für die Vorschau vor dem Import.
export function summarizeBackup(backup) {
  const { workouts, sets, exercises, routines } = backup.data;
  const dates = workouts.map((w) => w.date).filter((d) => typeof d === 'string').sort();
  return {
    exportedAt: backup.exportedAt,
    workoutCount: workouts.length,
    setCount: sets.length,
    exerciseCount: exercises.length,
    routineCount: routines.length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

// Ersetzt alle Tabellen in EINER Transaktion: schlägt irgendein Schritt fehl,
// bleibt der bisherige Datenbestand unverändert.
export async function replaceAllData(db, backup) {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
      await table.bulkAdd(backup.data[table.name]);
    }
  });
}
