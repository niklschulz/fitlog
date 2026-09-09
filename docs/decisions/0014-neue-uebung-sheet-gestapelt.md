# 0014 – "Neue Übung" als gestapeltes Sheet statt Inline-Modus, Muskel-Zuordnungs-Formular

## Kontext

[ADR 0013](0013-uebung-muskel-verknuepfung.md) legte `primaryMuscleId`/`secondaryMuscleIds` an `exercises` an, ließ aber bewusst offen: *"Weder das Übungen-Tab-Formular noch das Übungs-Sheet-Anlage-Formular bieten aktuell eine Muskel-Auswahl an ... Folgt als eigener UI-Schritt."* Dieses ADR ist dieser Schritt für das Übungs-Sheet-Anlage-Formular (Referenz-Screenshot einer Fremd-App als Vorbild, mit Abweichungen — Kategorie/Notizen/erweiterte Muskel-Taxonomie bewusst nicht übernommen, feste 8er-`MUSCLE_GROUPS`-Liste aus ADR 0012 bleibt unverändert).

Zusätzliche, strukturelle Nutzer-Vorgabe: "Neue Übung" war bis dahin ein Inline-Zustand *innerhalb* des Übungs-Sheets (`state.exerciseSheetMode`, umschaltete den sichtbaren Inhalt zwischen Liste und Formular ohne eigenes Sheet). Jetzt soll es ein **eigenes, über dem Übungs-Sheet gestapeltes Sheet** sein — Schließen soll nur zum Übungs-Sheet zurückführen, nicht zum Workout-Tab.

## Entscheidung

**Neues Sheet statt Inline-Modus.** Das "Neue-Übung-Sheet" folgt exakt demselben Stapel-Muster wie das bereits bestehende Übungs-Detail-Sheet (gleiche höhere z-Ebene `z-[52]`/`z-[53]`, da beide nur aus dem Übungs-Sheet heraus geöffnet werden und nie gleichzeitig offen sind): eigener State (`exerciseCreateSheetOpen/-Closing/-Name/-PrimaryMuscleId/-SecondaryMuscleIds`), eigene Open/Close-Funktionen nach demselben Timing wie alle übrigen Sheets (`SHEET_CLOSE_ANIMATION_MS`), eigenes Drag-to-Dismiss über `js/sheet.js`. "Schließen führt nur zum Übungs-Sheet zurück" ergibt sich dabei **automatisch** aus dem Stapel-Muster, ohne eigene Sonderlogik: Schließen dieses Sheets ändert nur seinen eigenen State, `state.exerciseSheetOpen` bleibt während der ganzen Zeit unverändert `true`.

Als direkte Folge entfällt der bisherige Inline-Modus vollständig: `state.exerciseSheetMode` (und alle darauf bedingten Verzweigungen — Such-/Filter-Sichtbarkeit, Kopfzeilen-Aktion) sind ersatzlos entfernt. Der "+"-Button in der Übungs-Sheet-Kopfzeile ist dadurch wieder ein stabiles, nie neu gerendertes Element (kein Teil-Repaint-Wrapper mehr nötig, s. Zweiundsechzigste Iteration in design-system.md zur Safari-Falle genau dieses Musters) — reine Vereinfachung, kein neuer Trade-off.

**Formularfelder** (bewusste Teilmenge des Referenz-Screenshots, Nutzer-Vorgabe):
- **Name** — Textfeld, optisch identisch zum Suchfeld (`bg-white/[0.08]`, s. design-system.md "Input")
- **Primärer Muskel** — Chip-Auswahl (Einzelauswahl, erneuter Tap hebt die Auswahl wieder auf), alle acht `MUSCLE_GROUPS`
- **Sekundäre Muskeln** — Chip-Auswahl (Mehrfachauswahl), dieselben acht Einträge; die bereits als primär gewählte Muskelgruppe ist hier deaktiviert (spiegelt `validateMuscleAssignment()` aus ADR 0013, die genau diese Überschneidung serverseitig ablehnt)
- **Kein** Notizen-Feld, **keine** Kategorie-Auswahl — beide explizit vom Nutzer für diesen Schritt ausgeschlossen

**Chip-Komponente aktiviert.** `design-system.md` hatte unter "Komponenten-Muster" bereits ein "Chip (Auswahl)"-Muster dokumentiert, aber als "aktuell nicht verwendet" markiert (`rounded-full`, ausgewählt `bg-accent text-base`, unausgewählt `bg-surface text-ink`) — genau dafür vorgesehen. Hier zum ersten Mal tatsächlich eingesetzt (unausgewählt `bg-white/[0.08]` statt `bg-surface`, um zum übrigen Sheet-Erscheinungsbild zu passen, s. o.).

**Name-Eingabe ohne Teil-Repaint-Mechanismus.** Anders als beim Suchfeld (das bei jedem Zeichen die Liste neu filtern muss) hat das Namensfeld hier keine Auswirkung auf sichtbaren Inhalt außer dem eigenen Wert (den der Browser nativ verwaltet) und dem Aktiviert-Zustand des "Erstellen"-Buttons. Der `input`-Handler spiegelt den Wert lediglich still in `state.exerciseCreateSheetName` (damit ein durch einen Muskel-Chip-Tap ausgelöster Repaint ihn nicht verliert) und schaltet `disabled` direkt per DOM-API um — löst dabei nie selbst einen Repaint aus. Das Feld wird beim Tippen dadurch nie zerstört, das erst kürzlich gelöste Fokus-/Key-Repeat-Problem (s. Dreiundsechzigste Iteration) kann hier gar nicht erst auftreten.

## Konsequenzen

- Drittes Sheet, das die generische Basis aus `js/sheet.js` nutzt (nach Kalender- und Übungs-/Übungs-Detail-Sheet) — bestätigt deren Wiederverwendbarkeit über den ursprünglich für zwei Sheets ausgelegten Fall hinaus.
- Neu erstellte Übung landet automatisch in der Mehrfachauswahl des Übungs-Sheets (wie beim bisherigen Inline-Formular) — Verhalten unverändert übernommen.
- `primaryMuscleId`/`secondaryMuscleIds` werden jetzt erstmals tatsächlich von einem Formular befüllt statt nur von `db.js`-Testcode — der Muskelgruppen-Filter (vorheriger Schritt) hat damit erstmals echte, nutzerseitig erstellte Testdaten statt nur Datenbank-Skripte.
- Das Übungen-Tab-Formular (`exercises.js`) bietet weiterhin keine Muskel-Auswahl an — bewusst nicht Teil dieses Schritts, bliebe als eigener, separater Nachzieh-Schritt offen, falls gewünscht.
