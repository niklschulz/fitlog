# 0012 – Muskelgruppen: feste Taxonomie als Konstante statt Dexie-Table

## Kontext

Für den geplanten Muskelgruppen-Filter im Übungs-Sheet (s. Referenz-Screenshot und Diskussion in der Session, Anschluss an [ADR 0011](0011-uebungs-sheet-bottom-sheet-extraktion.md)) braucht jede Übung künftig eine Muskelgruppen-Zuordnung. Nutzer-Vorgabe für die Muskelgruppen selbst:

1. Neuer "Entitätstyp" Muskel
2. Seine Werte sind fest — vom Nutzer nicht bearbeitbar
3. Die acht Werte: Brust, Schultern, Rücken, Bizeps, Trizeps, Bauch, Po, Beine

Alle bisherigen Entitätstypen der App (`exercises`, `routines`, `workouts`, `sets`, `routineExercises`, `workoutExercises`) sind Dexie-Tabellen mit UUID-`id`, vom Nutzer erstellt/bearbeitet/gelöscht (s. [ADR 0003](0003-dexie-uuid-datenmodell.md)). Muskelgruppen unterscheiden sich davon grundlegend: eine von Anfang an feste, im Entwickler-Code definierte Liste, die zur Laufzeit nie verändert wird — kein Erstellen, kein Bearbeiten, kein Löschen.

## Entscheidung

**Keine eigene Dexie-Tabelle.** Stattdessen eine exportierte Konstante `MUSCLE_GROUPS` in `js/db.js`:

```js
export const MUSCLE_GROUPS = [
  { id: 'brust', name: 'Brust' },
  { id: 'schultern', name: 'Schultern' },
  { id: 'ruecken', name: 'Rücken' },
  { id: 'bizeps', name: 'Bizeps' },
  { id: 'trizeps', name: 'Trizeps' },
  { id: 'bauch', name: 'Bauch' },
  { id: 'po', name: 'Po' },
  { id: 'beine', name: 'Beine' },
];
```

Begründung:

- **"Nicht bearbeitbar" strukturell statt nur durch UI-Konvention erzwungen.** Eine Dexie-Tabelle wäre technisch jederzeit beschreibbar — "nicht bearbeitbar" müsste dann durch bewusstes Weglassen jeder Schreib-UI sichergestellt werden (verletzbar durch eine zukünftige Änderung). Eine reine Code-Konstante kann von der App zur Laufzeit gar nicht verändert werden, unabhängig von der UI.
- **Kein Migrations-/Seeding-Aufwand.** Eine Dexie-Tabelle bräuchte eine Schema-Version plus Logik, die acht festen Zeilen beim ersten Start anzulegen (und dauerhaft korrekt zu halten, falls sich die Liste je ändert). Eine Konstante existiert einfach.
- **`id` als stabiler Slug statt UUID.** UUIDs signalisieren in dieser Codebase bisher immer "vom Nutzer zur Laufzeit erzeugt" (`generateId()` bei jedem `createX()`). Ein sprechender, fest im Code stehender Slug (`'brust'` statt einer zufälligen UUID) passt besser zu einem Entwickler-definierten Enum und bleibt über Code-Version hinweg stabil lesbar (z. B. beim Debuggen gespeicherter Übungen).
- **Konsistent mit bestehenden Konventionen der App** für feste, niemals nutzerseitig veränderte Wertelisten, z. B. `CALENDAR_SHEET_MIN_MONTH`, die Wochentags-Kürzel in `renderCalendarStrip()`/`renderSheetMonth()`, oder `DEFAULT_SET_COUNT` auf der Übungs-Detailseite ([ADR 0010](0010-uebungs-detailseite.md)) — durchweg Code-Konstanten, keine DB-Zeilen.

**Verknüpfung zu Übungen ist bewusst noch nicht Teil dieser Entscheidung.** Dieser Schritt legt nur den Muskel-"Entitätstyp" selbst fest (Nutzer-Vorgabe, s. oben) — ob/wie `exercises` ein `muscleId`-Feld bekommt (neue Schema-Version, Formular-Erweiterung, Migration bestehender Übungen ohne Zuordnung), folgt als eigener, separater Schritt.

## Konsequenzen

- `MUSCLE_GROUPS` ist ab sofort importierbar, hat aber noch keine Verwendungsstelle (kein Feld an `exercises`, keine UI) — folgt in einem Folge-Schritt.
- Reihenfolge der Konstante entspricht der vom Nutzer vorgegebenen Reihenfolge, nicht alphabetisch — falls das Sheet die Muskelgruppen später alphabetisch anzeigen soll, wäre das eine bewusste Sortierung an der jeweiligen Render-Stelle, nicht an der Konstante selbst.
- Sollte sich die Anforderung später doch zu einer nutzerseitig erweiterbaren Liste ändern (aktuell explizit nicht gewünscht), wäre das ein bewusster Bruch mit dieser Entscheidung und würde eine Migration auf eine echte Dexie-Tabelle erfordern.
