# 0020 – Einzelne Muskeln statt Muskelgruppen an der Übung, Gruppen bleiben nur zur Anzeige/zum Filtern

## Kontext

Bisher ([ADR 0012](0012-muskelgruppen-feste-taxonomie.md)/[ADR 0013](0013-uebung-muskel-verknuepfung.md)) verwies eine Übung direkt auf eine `MUSCLE_GROUPS`-Gruppe (acht grobe Gruppen: Brust, Schultern, Rücken, Bizeps, Trizeps, Bauch, Po, Beine). Nutzer-Vorgabe: Das ist zu grob — künftig soll einer Übung ein **einzelner Muskel** zugeordnet werden (z. B. "Seitliche Schulter" statt nur "Schultern"). Einige Gruppen bestehen dabei aus nur einem, gleichnamigen Muskel (z. B. "Bauch" wird zu den zwei Muskeln "Gerade Bauchmuskeln"/"Schräge Bauchmuskeln" — kein Gegenbeispiel mehr in der finalen Liste, s. u., aber "Po" bleibt ein Ein-Muskel-Fall). Die Gruppenliste selbst ändert sich ebenfalls: "Bizeps"/"Trizeps" waren bisher eigene Gruppen, werden jetzt zu Muskeln unter einer neuen Gruppe "Arme" (zusammen mit "Unterarme").

Da die App noch nicht produktiv ist (keine echten Nutzerdaten), hat der Nutzer angewiesen, vorhandene Test-Übungen (Testserver und Test-Installation auf dem iPhone) vor der Umsetzung selbst zu löschen — **keine Migration bestehender Zuordnungen**.

## Entscheidung

**Zwei getrennte feste Konstanten in `js/db.js` statt einer:**

```js
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

export function muscleGroupIdOf(muscleId) {
  return MUSCLES.find((m) => m.id === muscleId)?.groupId ?? null;
}
```

18 Muskeln in 7 Gruppen, Reihenfolge exakt wie vom Nutzer vorgegeben (auch innerhalb jeder Gruppe). Ein-Muskel-Gruppen ("Brust", "Po") bekommen einen Muskel mit **identischer `id` und identischem `name`** wie die Gruppe — die beiden Konstanten sind aber getrennte Arrays mit getrennter Bedeutung, ein Slug wird nie über beide Listen hinweg gemeinsam nachgeschlagen (kein Code liest "erst MUSCLES, dann bei Nichttreffer MUSCLE_GROUPS" oder umgekehrt), die zufällige Slug-Gleichheit ist deshalb harmlos.

**`exercises.primaryMuscleId`/`secondaryMuscleIds` verweisen jetzt auf `MUSCLES` statt auf `MUSCLE_GROUPS`** — Feldnamen und Dexie-Indizes (`primaryMuscleId, *secondaryMuscleIds`) bleiben unverändert (s. ADR 0013), nur die Bedeutung der gespeicherten Werte ändert sich von "Gruppe" zu "einzelner Muskel". **Keine neue Dexie-Schema-Version**: Da sich weder Feldnamen noch Indizes ändern und keine Migration nötig ist (Nutzer-Vorgabe, s. Kontext), bleibt Version 3 unverändert — die App interpretiert die gespeicherten Slugs künftig einfach anders.

`validateMuscleAssignment()` prüft jetzt gegen `MUSCLES` statt `MUSCLE_GROUPS`, sonst unveränderte Regeln (primär optional, primär darf nicht zugleich sekundär sein, keine Duplikate unter den sekundären) — **explizit weiterhin erlaubt**: primärer und ein sekundärer Muskel aus derselben Gruppe (z. B. primär Bizeps, sekundär Trizeps, beide "Arme"), da die Gruppenzugehörigkeit für die Validierung keine Rolle spielt, nur die konkrete Muskel-`id`.

**Muskelgruppen-Filter im Übungs-Sheet matcht nur noch die Gruppe des PRIMÄREN Muskels** (`muscleGroupIdOf(ex.primaryMuscleId) === filterId`), nicht mehr zusätzlich sekundär wie zuvor (ADR 0013 hatte das bewusst offengelassen). Seit der Aufteilung in einzelne Muskeln pro Gruppe wäre "sekundär trifft auch" zu weit gefasst — ein "Arme"-Filter würde sonst z. B. auch reine Rücken-Übungen zeigen, bei denen ein Muskel aus "Arme" nur sekundär beteiligt ist, was der Nutzer beim gröberen Acht-Gruppen-Modell so nicht beobachtet/gewünscht hatte.

**Anzeige wechselt von Gruppe auf Muskel:** Untertitel der Übungs-Sheet-Zeile und die Chips im Übungs-Detail-Sheet zeigen jetzt den Muskelnamen (`MUSCLES`), nicht mehr die Gruppe. Die Chip-Auswahl im Neue-Übung-/Bearbeiten-Sheet iteriert über `MUSCLES` (18 statt 7 Chips) statt über `MUSCLE_GROUPS` — weiterhin als **flache Liste ohne Gruppen-Überschriften** (Nutzer-Vorgabe: bei Ein-Muskel-Gruppen wäre eine Überschrift mit einem einzigen, gleichnamigen Chip redundant gewesen).

## Konsequenzen

- Wer die App bereits mit Test-Übungen genutzt hat, muss diese vor dem Update selbst löschen — ihre `primaryMuscleId`/`secondaryMuscleIds` würden sonst stillschweigend als (meist unbekannte) Muskel-IDs interpretiert. `validateMuscleAssignment()` greift nur beim nächsten Erstellen/Bearbeiten, nicht rückwirkend auf bereits gespeicherte Werte.
- Der Muskelgruppen-Filter zeigt jetzt nur noch Übungen, deren primärer Muskel zur gewählten Gruppe gehört — eine Übung mit sekundärer Beteiligung einer Muskelgruppe, aber anderem primären Muskel, taucht unter dieser Gruppe nicht mehr auf (Verhaltensänderung ggü. ADR 0013).
- `MUSCLE_GROUPS` hat jetzt zwei Konsumenten mit unterschiedlichem Zweck: Anzeige-Label für den Filter (`renderExerciseSheetMuscleFilter()`) und Herleitung der Gruppe eines Muskels (`muscleGroupIdOf()`, genutzt vom Filter-Prädikat) — keine Übung referenziert `MUSCLE_GROUPS`-IDs mehr direkt.
- Käme später der Wunsch nach einem Muskel-genauen (statt Gruppen-)Filter oder einem zweistufigen Filter (erst Gruppe, dann Muskel), wäre `muscleGroupIdOf()` bereits die richtige Stelle, um das umzubauen.
