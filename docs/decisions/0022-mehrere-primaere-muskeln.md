# 0022 – Eine Übung kann mehrere primäre Muskeln haben

## Kontext

Bisher ([ADR 0013](0013-uebung-muskel-verknuepfung.md), erweitert um [ADR 0020](0020-einzelne-muskeln-statt-muskelgruppen.md)) hatte eine Übung genau einen primären Muskel (`primaryMuscleId`, einzelner Wert oder `null`) und beliebig viele sekundäre. Nutzer-Vorgabe: Manche Übungen trainieren mehrere Muskeln gleichermaßen primär (z. B. ein Klimmzug: Lat und Bizeps), das sollte sich auch so abbilden lassen — künftig soll eine Übung mehrere primäre Muskeln haben können.

## Entscheidung

**`exercises.primaryMuscleId` (einzelner Wert) wird zu `exercises.primaryMuscleIds` (Array)** — dieselbe Struktur wie das bereits bestehende `secondaryMuscleIds`. Neue Dexie-Schema-Version, da sich sowohl der Feldname als auch der Index-Typ ändern (Einzelwert-Index → multiEntry-Index):

```js
db.version(5).stores({
  exercises: 'id, name, *primaryMuscleIds, *secondaryMuscleIds, isBuiltin, createdAt, updatedAt',
  // … übrige Tabellen unverändert
});
```

Bestehende, vor Version 5 angelegte Übungen behalten ihr altes `primaryMuscleId`-Feld unangetastet in der DB (wird von keinem Code mehr gelesen) und bekommen kein automatisches `primaryMuscleIds` — keine Migration, da die App noch nicht produktiv ist (kein Datenverlust-Risiko, dieselbe Begründung wie bei ADR 0020).

**`validateMuscleAssignment(primaryMuscleIds, secondaryMuscleIds)`** prüft jetzt symmetrisch auf beiden Seiten: IDs müssen bekannte `MUSCLES`-Einträge sein, keine Duplikate innerhalb der primären bzw. innerhalb der sekundären Liste, keine Überschneidung zwischen primär und sekundär (verallgemeinert die bisherige Regel "primärer Muskel darf nicht zusätzlich sekundär sein" auf beliebig viele primäre Muskeln). `createExercise()`/`updateExercise()` nehmen `muscleAssignment.primaryMuscleIds` (Default `[]`) statt `primaryMuscleId` (Default `null`) entgegen.

**UI (Neue-Übung-/Bearbeiten-Sheet, `js/views/workout.js`):** Die primäre Chip-Auswahl ist jetzt wie die sekundäre eine Mehrfachauswahl (`state.exerciseCreateSheetPrimaryMuscleIds`, ein `Set` statt eines einzelnen nullable Werts) statt einer Einzelauswahl. Die gegenseitige Deaktivierung ist jetzt symmetrisch: Ein Muskel, der bereits primär gewählt ist, ist unter den sekundären deaktiviert und umgekehrt (vorher nur eine Richtung, da primär noch eine Einzelauswahl war). Label "Primärer Muskel" → "Primäre Muskeln".

**Anzeige:** Übungs-Detail-Sheet zeigt "Primäre Muskeln" als Chip-Liste (mehrere Chips statt genau einem), analog zu den sekundären Muskeln. Der Untertitel der Übungs-Sheet-Zeile fügt mehrere primäre Muskelnamen mit ", " zusammen statt nur einen anzuzeigen.

**Muskelgruppen-Filter im Übungs-Sheet** matcht jetzt, wenn EIN BELEIBIGER primärer Muskel der Übung zur gewählten Gruppe gehört (`(ex.primaryMuscleIds ?? []).some((id) => muscleGroupIdOf(id) === filterId)`), statt wie bisher genau einen primären Muskel zu prüfen. Weiterhin nicht zusätzlich sekundär (unverändert seit ADR 0020).

**`BUILTIN_EXERCISES`/`seedBuiltinExercises()`** (s. [ADR 0021](0021-standard-uebungen.md)) verwenden ebenfalls `primaryMuscleIds` (Array) statt `primaryMuscleId` — zum Zeitpunkt dieses ADRs ist die Liste noch leer, betrifft also nur das Format künftiger Einträge.

## Konsequenzen

- Wer die App bereits mit Test-Übungen genutzt hat, muss diese vor dem Update selbst löschen/neu anlegen — ihr altes `primaryMuscleId`-Feld wird nicht mehr gelesen, die Übung erscheint danach ohne primären Muskel, bis sie neu bearbeitet wird.
- Die Chip-Auswahl für primäre Muskeln verhält sich jetzt identisch zur sekundären (Mehrfachauswahl, Toggle, symmetrische Deaktivierung) — kein separater UI-Mechanismus mehr für "primär" vs. "sekundär", nur noch die Bedeutung unterscheidet sich.
- Der Muskelgruppen-Filter kann jetzt Übungen zeigen, deren primäre Muskeln in mehreren Gruppen liegen (z. B. der Klimmzug oben taucht sowohl unter "Rücken" als auch unter "Arme" auf) — bewusst gewünschtes Verhalten, kein Sonderfall wie bei sekundär (s. ADR 0020, dort weiterhin ausdrücklich ausgeschlossen).
