# 0034 – Export/Import als JSON-Backup

**Status:** Gültig

## Kontext

Alle Daten liegen ausschließlich lokal (IndexedDB + `localStorage`), ein Sync existiert noch nicht ([ADR 0006](0006-token-basierte-nutzertrennung.md)). Ohne Backup bedeutet ein Gerätewechsel oder gelöschte Website-Daten (iOS räumt PWA-Speicher unter Umständen auf) den Verlust aller Trainingsdaten.

## Entscheidung

- **Umfang:** alle Dexie-Tabellen der aktiven Datenbank, Profil (`js/profile.js`) und Einstellungen (`js/settings.js`) in einer JSON-Datei. Das Profil enthält den Token im Klartext – die Datei ist daher wie ein Passwort zu behandeln. *(Abgelöst durch den Nachtrag vom 2026-11-06: kein Token mehr im Backup.)*
- **Format:** `{ app: 'fitlog', formatVersion: 1, exportedAt, data: { <tabelle>: [...] }, profile, settings }`. Neuere `formatVersion` wird abgelehnt; die Tabellenliste kommt aus `db.tables`, ein Schema-Zuwachs braucht also keine Anpassung des Codes.
- **Import ersetzt** den gesamten Bestand (kein Zusammenführen), in einer einzigen Dexie-Transaktion – schlägt etwas fehl, bleibt alles unverändert. Vorher zeigt das Action Sheet eine Vorschau (Anzahl Workouts, Sätze, Übungen, Routinen, Zeitraum). Danach lädt die App neu.
- **Testmodus:** wirkt auf die gerade aktive Datenbank; die Dateiname enthält dann `-testdaten`, das Action Sheet weist darauf hin.
- **Teilen:** Web Share API (iPhone: Dateien, AirDrop, iCloud), sonst klassischer Download. Import über Dateiauswahl.
- **UI:** Abschnitt „Daten“ im Profil-Tab. Logik in `js/backup.js` (Dexie-Instanz als Parameter, testbar in `tests/backup.test.js`).

## Konsequenzen

- Keine automatische Sicherung vor dem Import und keine Backup-Erinnerung (bewusst weggelassen, ggf. später)
- Bei künftigen Schema-Änderungen mit inkompatiblen Feldern `BACKUP_FORMAT_VERSION` hochzählen und ältere Versionen beim Import migrieren

## Nachtrag 2026-11-06 – Token nicht mehr im Backup

- **Änderung:** Das Backup enthält nur noch den Username, keinen Token (auch kein leeres Feld). Entfernt wird er in `buildBackup` (`stripToken`), damit jeder Aufrufer geschützt ist.
- **Warum:** Der Token ist ein Geheimnis, die Backup-Datei wird aber geteilt (AirDrop, iCloud, Dateien) und liegt unverschlüsselt herum.
- **Import:** Das lokale Profil bleibt unangetastet (weder überschrieben noch gelöscht). Tokens in älteren Dateien werden nicht übernommen (`parseBackup` verwirft sie), damit das Verhalten einheitlich ist.
- **Formatversion bleibt 1:** `profile` war im Import schon optional, ältere und neue Dateien sind gegenseitig lesbar.
- **Folge:** Bei einem Gerätewechsel muss das Profil einmal neu verknüpft werden. Gewollt.
