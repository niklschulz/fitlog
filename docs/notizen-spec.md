# Übungs-Notizen — Spezifikation

> Umgesetzt am 2026-11-01, s. [ADR 0035](decisions/0035-notizen-pro-uebung-und-tag.md) und [CHANGELOG](CHANGELOG.md).

## Status

**Umgesetzt**, alle Schritte aus Abschnitt 9 inklusive Tests (`npm test`) und Verifikation im Browser (Mobile-Viewport). Abweichung vom Entwurf: keine.

Vorläufer: In [features.md](features.md) steht "Notizen" bisher nur als vorgemerkte Erweiterung unter "Zusätzliche Satz-Felder". Diese Spec konkretisiert es als **Notiz pro Übung und Workout-Tag**, nicht pro Satz.

## 1. Ziel und Abgrenzung

> **Nicht verwechseln:** Dieses Dokument beschreibt die Notiz pro Übung **und Workout-Tag** (`workoutExercises.note`). Die dauerhafte Notiz zur Übung selbst (`exercises.note`, im Übungs-Detail-Sheet) ist davon unabhängig, s. [ADR 0036](decisions/0036-notiz-zur-uebung.md). Beide nutzen dasselbe Notiz-Sheet.

Zu einer Übung an einem Trainingstag eine kurze Freitext-Notiz festhalten, z. B. "Schulter zwickte", "Griff enger". Die Notiz wird per Button neben den Satz-Buttons in einem Bottom-Sheet geschrieben und ist danach **nur lesbar** an drei Stellen sichtbar: Roster-Karte, Detailseite unter den Sätzen, Verlauf.

- **Pro Übung und Tag.** Keine dauerhafte Notiz pro Übung, keine Notiz pro Satz.
- Reiner Freitext, keine Formatierung.
- Funktioniert auch für Standard-Übungen (`isBuiltin`), da die Notiz am Tages-Eintrag hängt, nicht an der Übung.
- **Nicht** Teil dieser Spec: die Notiz vom letzten Training als Hinweis anzeigen (bewusst verworfen), Notizen in der Statistik-Übungsseite (`js/views/statistics-exercise-detail.js`).

## 2. Datenmodell

Optionales Feld **`note`** (String) am bestehenden `workoutExercises`-Eintrag. Ein Eintrag steht schon für genau "diese Übung an diesem Tag" (`workoutId` + `exerciseId`).

| Feld | Typ | Bedeutung |
|---|---|---|
| `note` | `string \| undefined` | Notiztext. Nicht gesetzt = keine Notiz. |

- **Kein Index, keine Schema-Version.** Das Feld wird nie abgefragt. Bestehende Einträge ohne `note` gelten als "keine Notiz", keine Migration.
- Beim Speichern wird getrimmt. Leer oder nur Whitespace bedeutet "keine Notiz" (`note: undefined`). So reicht überall `if (entry.note)`.
- `updatedAt` des Eintrags wird mitgesetzt.
- Weiches Limit `maxlength="500"` am Textfeld.
- `startedAt` bleibt unberührt. Eine Notiz macht eine Übung **nicht** "begonnen" und verschiebt sie nicht im Roster (Sortierung und Umsortieren bleiben wie bisher, s. ADR 0007).

### Neue Datenfunktion (`js/db.js`)

```js
// Notiz für eine Übung an einem Workout-Tag setzen. Leerer Text entfernt sie.
export async function setWorkoutExerciseNote(entryId, text) {
  const note = (text ?? '').trim();
  await db.workoutExercises.update(entryId, {
    note: note === '' ? undefined : note,
    updatedAt: nowISO(),
  });
}
```

### Schutzregel: Notiz schützt vor Aufräumen

Die Aufräum-Kaskaden löschen bisher "unbegonnene" Einträge (`startedAt === null`). Ein Eintrag **mit Notiz** gilt dafür künftig als geschützt, genau wie einer mit Sätzen. Das ändert die Filter an diesen Stellen in `js/db.js` (Zeilen aus dem Stand dieser Spec, beim Umsetzen per Suche nach `removable` prüfen):

| Funktion | Änderung |
|---|---|
| Übung löschen (`entries.filter((e) => e.startedAt === null)`) | Filter um `&& !e.note` erweitern, Einträge mit Notiz bleiben wie die mit Sätzen zur Wahrung des Verlaufs erhalten |
| Routine löschen (Filter mit `sourceRoutineId === id`) | `&& !e.note` |
| Routine wechseln / nachsynchronisieren (Filter mit `sourceRoutineId !== null`) | `&& !e.note`. Geschützte Einträge bleiben unabhängig davon, ob sie in der neuen Routine vorkommen |
| Routine vom Tag entfernen (zweiter Filter mit `sourceRoutineId !== null`) | `&& !e.note` |

**Einzel-Aktion "⋮ → Übung entfernen"** (`removeExerciseFromWorkout`, Roster): Der "⋮"-Button erscheint nur noch, wenn der Eintrag weder Sätze **noch** eine Notiz hat. Wer eine Übung mit Notiz entfernen will, leert zuerst die Notiz. `removeExerciseFromWorkout()` selbst bleibt unverändert, die UI schützt (wie bisher bei Sätzen).

**Übungs-Sheet, Haken zurücknehmen:** Hat die Übung für den Tag Sätze **oder** eine Notiz, erscheint das Action Sheet (`showActionSheet()`, [ADR 0029](decisions/0029-action-sheet-saetze-und-uebung-entfernen.md)). Der Text nennt, was verloren geht ("Sätze und Notiz und Übung entfernen" bzw. passend zum Inhalt: nur Notiz, nur Sätze, beides). `removeExerciseWithSetsFromWorkout()` löscht den Eintrag samt Notiz bereits mit, dort ist nichts zu ändern.

**Satz löschen:** Notiz bleibt (der Eintrag bleibt).

Alle Änderungen bekommen Tests in `tests/` (Abschnitt 8).

## 3. UI — Notiz-Button auf der Detailseite

Ort: Reiter **"aktueller Tag"** in `js/views/workout-exercise-detail.js`, in der Button-Zeile direkt unter den Satz-Feldern (dort, wo "Speichern"/"Ändern" und "Löschen" stehen).

Heute teilen sich "Speichern/Ändern" und "Löschen" die Zeile zu gleichen Teilen (beide `flex-1`). Neu:

| Button | Breite | Hinweis |
|---|---|---|
| Speichern / Ändern | 50 % (unverändert) | |
| Löschen | 37,5 % (**25 % schmaler** als vorher) | |
| Notiz | 12,5 % (das frei gewordene Viertel der alten Löschen-Breite) | nur Icon, keine Beschriftung |

- Umsetzung per Flex-Verhältnis `4 : 3 : 1` (z. B. `flex-[4]`, `flex-[3]`, `flex-[1]`) bei bestehender Lücke zwischen den Buttons. Der Notiz-Button bekommt `min-w-[44px]`, damit die Trefferfläche mindestens 44 px breit bleibt (bei typischer iPhone-Breite entspricht 12,5 % ohnehin ca. 44 px). Wenn dafür die Verhältnisse minimal abweichen, hat die Mindestbreite Vorrang.
- Stil wie die anderen Buttons der Zeile (`BTN_SECONDARY`, `py-3 min-h-[44px]`), mittiges Notiz-Icon (inline SVG, gleiche Strichstärke wie die übrigen Icons, `aria-label="Notiz"`).
- **Immer aktiv**, auch bei Übungen ohne Sätze und auch bei Standard-Übungen. Das Icon sieht mit und ohne Notiz gleich aus.
- Tap öffnet das Notiz-Sheet (Abschnitt 4).

### Notiz unter den Satz-Zeilen

Hat der Eintrag eine Notiz, steht sie auf der Detailseite im Reiter "aktueller Tag" **vollständig** (nicht gekürzt) **unter den Satz-Zeilen**, mit kleinem Notiz-Icon davor, nur lesbar, `text-muted`, `whitespace-pre-line`. Gibt es keine Notiz, erscheint dort nichts. Bearbeitet wird nur über den Notiz-Button.

Reihenfolge der Seite also: Satz-Felder und Button-Zeile, Satz-Liste, Notiz, ggf. "ROUTINE: …".

> Hinweis zur Position: Die Satz-Liste steht in der bestehenden View unter oder neben der Button-Zeile. Beim Umsetzen die Reihenfolge im Code prüfen und die Notiz direkt hinter die Satz-Zeilen setzen, vor die Routine-Zeile.

## 4. UI — Notiz-Sheet

Bottom-Sheet im Look des Screenshots (dunkle Fläche, große Überschrift, Glas-Buttons oben). Aufbau und Verhalten nach dem bestehenden Sheet-Muster (`js/sheet.js`: `lockBodyScroll`, Ziehen zum Schließen mit `wireSheetDrag`, `SHEET_CLOSE_ANIMATION_MS`), siehe auch Kalender-Sheet und Routinen-Sheet.

```
┌────────────────────────────────────┐
│ (✕)                            (✓) │   Glass-Kreis-Buttons, 44 px
│                                    │
│ Notiz hinzufügen                   │   große Überschrift (text-screen-title)
│ Romanian Deadlift: Barbell         │   Übungsname, fett
│ HEUTE, 1. NOVEMBER                 │   Datum, text-label, Großbuchstaben, muted
│ ────────────────────────────────── │   feine Trennung (Hintergrundkontrast, keine Linie wenn möglich)
│ Notiz zu dieser Übung…             │   Textfeld, ohne Rahmen, Platzhalter muted
│                                    │
│                                    │
├────────────────────────────────────┤
│            Tastatur                │
└────────────────────────────────────┘
```

- **Titel:** "Notiz hinzufügen", wenn noch keine Notiz existiert, sonst "Notiz bearbeiten".
- **Übungsname** und **Datum** des Workout-Tags. Datumsformat deutsch, "Heute"/"Gestern" wie an anderen Stellen der App, falls dort schon ein Formatter existiert (in `js/utils.js` suchen, nicht neu schreiben).
- **Textfeld:** `<textarea>` füllt den Rest bis zur Tastatur, Platzhalter "Notiz zu dieser Übung…", `maxlength="500"`, vorbefüllt mit der bestehenden Notiz. Beim Öffnen sofort fokussiert, Tastatur ist offen, Cursor am Textende. Schriftgröße mindestens 16 px, sonst zoomt iOS Safari beim Fokussieren.
- **✕ (links):** schließt das Sheet **ohne Rückfrage** und verwirft ungespeicherten Text. Ziehen nach unten und Tap auf den Hintergrund wirken genauso.
- **✓ (rechts):** speichert via `setWorkoutExerciseNote()` und schließt das Sheet. Eine geleerte Notiz wird beim Speichern entfernt, ohne Bestätigungsdialog. Der Haken ist immer aktiv, auch bei unverändertem Text. Das Sheet schließt dann einfach.
- Nach dem Speichern wird die Detailseite neu gezeichnet (`paint()`), die Notiz erscheint unter den Sätzen. Das Neuzeichnen passiert erst nach dem Schließen, nicht während des Tippens.
- Kein natives `confirm()`/`alert()`/`prompt()`.
- Aufbauen als eigene kleine Funktion in `js/` (z. B. `noteSheet.js`, analog `exerciseCreateSheet.js`) mit `openNoteSheet({ entryId, exerciseName, dateISO, initialNote, onSaved })`, damit sie ohne Duplikat von der Detailseite verwendet wird. Die Seiten-Scrollposition und der Tab-Zustand der Detailseite bleiben unberührt.

## 5. UI — Roster-Karte (Workout-Tab)

In `renderExerciseRow()` (`js/views/workout.js`): Hat der Eintrag eine Notiz, steht sie am **unteren Ende der Karte**, unter der Satz-Liste (bzw. direkt unter dem Titel, wenn es noch keine Sätze gibt):

- kleines Notiz-Icon links neben dem Text, gleiches Icon wie im Button,
- Text in `text-muted`, **auf 3 Zeilen gekürzt** (`line-clamp-3`), Zeilenumbrüche der Notiz bleiben in diesen drei Zeilen erhalten (`whitespace-pre-line`),
- nur lesbar. Teil des bestehenden Tap-Bereichs, der die Detailseite öffnet (gleiches `data-entry`-Muster wie Titel und Satz-Liste), kein eigenes Bearbeiten,
- ohne Notiz: nichts, kein Platzhalter, keine leere Fläche.

Der "⋮"-Button der Karte wird bei Einträgen mit Notiz ausgeblendet (Schutzregel in Abschnitt 2). Das Umsortieren per Gedrückthalten bleibt für unbegonnene Einträge mit Notiz möglich (sie sind weiterhin `startedAt === null`).

## 6. UI — Verlauf (Detailseite, Reiter "Verlauf")

In der Karte jedes Tages: Hat dieser Tag eine Notiz, steht sie am unteren Ende der Karte unter den Sätzen, gleiche Darstellung wie in der Roster-Karte (Icon, `text-muted`, auf 3 Zeilen gekürzt, nur lesbar). Der gerade betrachtete Tag wird im Verlauf mit angezeigt ([ADR 0010](decisions/0010-uebungs-detailseite.md), Nachtrag), dort steht dieselbe Notiz.

Die Darstellung (Icon plus gekürzter Text) kommt aus einer gemeinsamen kleinen Render-Funktion (z. B. `renderNote(note)` in `js/utils.js`), die Roster-Karte und Verlauf gemeinsam nutzen. Die Detailseite benutzt dieselbe Funktion ohne Kürzung (Parameter).

Datenquelle: Der Verlauf gruppiert schon nach Tag über `workoutExercises`/`sets`. `note` kommt vom `workoutExercises`-Eintrag mit passender `workoutId` + `exerciseId` und muss zusätzlich gelesen werden.

Nicht im Statistik-Tab (Statistik-Übungsseite zeigt keine Notizen).

## 7. Backup / Export

[ADR 0034](decisions/0034-export-import-json-backup.md): Export und Import iterieren über `db.tables`, `note` ist als Feld der `workoutExercises`-Zeilen automatisch dabei. Beim Umsetzen prüfen, dass der Import keine Feld-Whitelist hat.

## 8. Tests (`tests/`, `npm test`)

Für `js/db.js`:

1. `setWorkoutExerciseNote` setzt, überschreibt und trimmt. Leertext und Whitespace entfernen die Notiz. `updatedAt` wird gesetzt. `startedAt` bleibt unverändert.
2. Notiz überlebt das Löschen aller Sätze der Übung an diesem Tag.
3. Schutzregel, je ein Test pro Funktion aus der Tabelle in Abschnitt 2:
   - Übung löschen: Eintrag mit Notiz bleibt, ohne Notiz wird er entfernt.
   - Routine löschen, Routine wechseln, Routine entfernen: unbegonnener Eintrag **mit** Notiz bleibt, **ohne** Notiz wird entfernt, auch wenn die Übung nicht in der neuen Routine steht.
4. `removeExerciseWithSetsFromWorkout` entfernt Eintrag samt Notiz.

UI-Teil nur manuell (Abschnitt 9).

## 9. Umsetzungsschritte

1. `setWorkoutExerciseNote()` und die Schutzregel in `js/db.js`, Tests aus Abschnitt 8, `npm test`.
2. `renderNote()` (Icon plus Text, optional gekürzt) in `js/utils.js`.
3. Detailseite: Button-Zeile auf 4 : 3 : 1 umbauen, Notiz-Button mit Icon, Notiz unter den Satz-Zeilen, Reiter "Verlauf" mit Notiz.
4. Notiz-Sheet (`js/noteSheet.js`) und Verdrahtung auf der Detailseite.
5. Roster: Notiz am Kartenende, "⋮"-Button bei Notiz ausblenden.
6. Übungs-Sheet: Action Sheet auch bei Notiz ohne Sätze, Text anpassen.
7. `npm run build:css` (neue Tailwind-Klassen wie `line-clamp-3`, `flex-[4]` etc.), `css/tailwind.css` mit einchecken. `CACHE_NAME` in `sw.js` hochzählen, neue JS-Datei in die App-Shell-Liste (`APP_SHELL`) der `sw.js` aufnehmen.
8. Im Browser verifizieren, Desktop- und Mobile-Viewport, vorher Service Worker und Caches leeren:
   - Button-Zeile: Breiten 4 : 3 : 1, Trefferflächen, Zustände "Speichern"/"Ändern", Löschen deaktiviert/aktiv.
   - Sheet: Tastatur öffnet sich, ✓ speichert, ✕ und Wegziehen verwerfen, Leeren und ✓ entfernt die Notiz, Titel wechselt zwischen "hinzufügen" und "bearbeiten".
   - Notiz erscheint auf der Detailseite (voll), in der Roster-Karte (gekürzt auf 3 Zeilen) und im Verlauf (gekürzt).
   - Schutz: Routine wechseln mit einer notizbehafteten, unbegonnenen Übung, "⋮"-Button fehlt, Haken im Übungs-Sheet zurücknehmen zeigt das Action Sheet.
   - Backup-Roundtrip (Export, Import) behält die Notiz.
10. Doku: `features.md` (Roster, Detailseite "aktueller Tag", Verlauf, Eintrag aus "Vorgemerkte Erweiterungen" streichen), `design-system.md` (Notiz-Button, Notiz-Sheet, Notiz-Anzeige), neuer ADR "Notizen pro Übung und Tag, Schutz vor Aufräumen" plus Nachtrag in ADR 0007 und 0004, `CHANGELOG.md`. Diese Spec auf "umgesetzt" setzen.

## 10. Edge Cases

| Fall | Verhalten |
|---|---|
| Notiz bei Übung ohne Sätze | erlaubt, Eintrag existiert schon durch das Hinzufügen zum Tag |
| Alle Sätze gelöscht | Eintrag und Notiz bleiben |
| Nur Whitespace gespeichert | wird zu "keine Notiz" |
| Sehr langer Text | `maxlength` 500, Karten und Verlauf kürzen auf 3 Zeilen, Detailseite zeigt alles |
| Zeilenumbrüche | bleiben erhalten (`whitespace-pre-line`) |
| ✕ mit ungespeichertem Text | Sheet schließt, Text ist weg (bewusst, keine Rückfrage) |
| Notiz an Übung mit `sourceRoutineId`, Routine wird gewechselt | Eintrag bleibt, unabhängig von der neuen Routine |
| Notiz an Übung, Übung wird gelöscht (Übungs-Detail-Sheet) | Eintrag bleibt zur Wahrung des Verlaufs, wie bei Einträgen mit Sätzen |
| Testmodus ([ADR 0024](decisions/0024-testmodus-umschaltbare-datenbank.md)) | identisches Schema, Notizen gelten pro Datenbank |
