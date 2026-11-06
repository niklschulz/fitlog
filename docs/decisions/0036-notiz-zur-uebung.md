# 0036 – Dauerhafte Notiz zur Übung

**Status:** Gültig

## Kontext

Der Nutzer will zu einer Übung selbst (nicht zu einem Trainingstag) eine bleibende Notiz festhalten, z. B. Geräte-Einstellungen. Neben der Notiz pro Übung und Tag ([ADR 0035](0035-notizen-pro-uebung-und-tag.md)) ist das ein eigenes Konzept.

## Entscheidung

- **Feld `note` am `exercises`-Eintrag**, pro Übung genau eine. Nicht indiziert, deshalb keine neue Schema-Version und keine Migration. Leerer/Whitespace-Text wird zu "nicht gesetzt" (`setExerciseNote()`, `js/db.js`).
- **Auch für Standard-Übungen** ([ADR 0021](0021-standard-uebungen.md)): Die Sperre in `updateExercise()`/`deleteExercise()` bleibt, die Notiz ist aber eine reine Nutzer-Anmerkung. `seedBuiltinExercises()` überschreibt nur Name/Muskeln/`isBuiltin`, die Notiz bleibt erhalten (Test). Folge: Das "⋮"-Menü des Übungs-Detail-Sheets erscheint jetzt auch bei Standard-Übungen, mit dem Notiz-Eintrag als einzigem Eintrag.
- **Erfassen** über das "⋮"-Menü im bestehenden Notiz-Sheet (`js/noteSheet.js`, erweitert um `saveNote`, `z` und `dateISO: null`). Das Sheet liegt eine Ebene über dem Detail-Sheet.
- **Anzeige** ganz unten in `renderExerciseInfo()` (`js/exerciseInfo.js`) und damit automatisch auch im Info-Reiter der Statistik-Übungsseite (nur lesbar).
- Die Notiz verschwindet mit der Übung (`deleteExercise()`), keine Schutzregel wie bei der Tages-Notiz.

## Konsequenzen

- Backup/Import ([ADR 0034](0034-export-import-json-backup.md)) nimmt `note` automatisch mit.
- Zwei unabhängige Notiz-Konzepte teilen sich ein Sheet; im Code und in der Doku immer als "Notiz zur Übung" (`exercises.note`) bzw. "Notiz pro Übung und Tag" (`workoutExercises.note`) unterscheiden.
