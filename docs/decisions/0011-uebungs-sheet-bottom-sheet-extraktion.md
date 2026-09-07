# 0011 – Übungs-Sheet: Mehrfachauswahl, gestapeltes Detail-Sheet, generische Bottom-Sheet-Basis

## Kontext

Der "+ Übung hinzufügen"-Button im Workout-Tab war seit [ADR 0007](0007-workout-tab-tagesbasiertes-modell.md) bewusst ein reiner Platzhalter ohne Funktion ("die Auswahl-/Anlage-Logik folgt in einem separaten, späteren Markdown"). Dieses ADR ist dieser separate Schritt: ein neues Bottom-Sheet ("Übungen"), über das Übungen angesehen, ausgewählt, neu angelegt und zum Tages-Workout hinzugefügt werden können - im selben visuellen Muster wie der bereits bestehende große Kalender (Bottom-Sheet, [ADR 0008](0008-grosser-kalender-lazy-loading.md)/[0009](0009-grosser-kalender-vollstaendiges-rendern.md)).

Mit einem zweiten Bottom-Sheet-Anwendungsfall lohnte sich erstmals die Extraktion der bis dahin rein kalender-spezifischen Sheet-Mechanik (Höhe/Animation/Drag-to-Dismiss/Body-Scroll-Sperre/Nav-z-index) in eine geteilte Basis - das CSS trug bereits seit der Dreiundfünfzigsten Iteration (s. design-system.md) einen Kommentar, der genau das für "sobald ein zweites großes Sheet dazukommt" ankündigte.

## Entscheidung

### Mehrfachauswahl statt Sofort-Hinzufügen

Anders als der bestehende Übungs-Picker im Routine-Editor (`routines.js`, ein Tap fügt sofort hinzu und schließt) sammelt das neue Übungs-Sheet eine Auswahl (`state.exerciseSheetSelectedIds`, ein Set von Übungs-IDs) über antippbare Auswahl-Kreise links jeder Zeile. Eine eigene, nur bei ≥1 Auswahl sichtbare Leiste unten im Sheet ("Hinzufügen (n)") committet die gesamte Auswahl gesammelt per neuer `addExercisesToWorkout(workoutId, exerciseIds)`-Funktion (`db.js`, eine Transaktion statt N Einzel-Adds) und schließt danach das Sheet. Nutzer-Vorgabe, um mehrere Übungen in einem Zug hinzufügen zu können, ohne das Sheet zwischendurch zu schließen und erneut zu öffnen.

### Tap auf den Namen ≠ Tap auf die Auswahl

Die Übungszeile hat zwei getrennte Tap-Ziele: der Auswahl-Kreis links (toggelt Mitgliedschaft in der Auswahl) und der Name selbst (öffnet ein zweites, gestapeltes Sheet mit den Übungs-Details). Explizite Nutzer-Vorgabe, damit "ansehen" und "auswählen" unabhängig voneinander funktionieren, ohne dass ein normaler Auswahl-Tap versehentlich navigiert oder umgekehrt.

### Übungen, die heute schon im Roster stehen

Bleiben in der Liste sichtbar (nicht ausgeblendet wie beim Routine-Picker), da das Sheet auch zum reinen Ansehen dienen soll - statt des Auswahl-Kreises zeigen sie ein deaktiviertes, grau gefülltes Häkchen-Badge. Der Name bleibt trotzdem antippbar (Detail-Sheet), nur das erneute Hinzufügen ist gesperrt.

### Löschen bewusst nicht Teil dieses Sheets

Auf ausdrücklichen Nutzer-Wunsch fällt eine Lösch-Funktion in diesem Schritt komplett weg - weder im Übungs-Sheet noch in einer provisorischen Form anderswo. Das bestehende Löschen im Übungen-Tab (`exercises.js`, mit Bestätigungsdialog + Kaskade, s. [ADR 0004](0004-loesch-kaskaden.md)) bleibt unverändert der einzige Weg. Eine künftige Lösch-Aktion ist für das noch zu spezifizierende Übungs-Detail-Sheet vorgesehen (s. u.), nicht für die Liste selbst.

### Gestapeltes Übungs-Detail-Sheet als Platzhalter-Shell

Tap auf einen Übungsnamen öffnet ein zweites Bottom-Sheet *über* dem Übungs-Sheet (nicht anstelle davon) - Kopfzeile mit ✕ links und dem Übungsnamen als Titel mittig, rechte Spalte vorerst ein leerer Platzhalter. Der Inhalt selbst ("Weitere Details folgen.") ist bewusst noch nicht spezifiziert - dieses ADR baut nur das Gerüst (Öffnen/Schließen/Drag/Stapel-Verhalten funktionsfähig), Inhalt und Lösch-Aktion folgen in einem eigenen, späteren Schritt.

### Generische Bottom-Sheet-Basis (`js/sheet.js`)

Mit zwei gleichzeitig offenen Sheets (Übungen + Übungs-Detail) reicht die bisherige, rein kalender-spezifische An/Aus-Logik für Body-Scroll-Sperre und Bottom-Nav-z-index nicht mehr aus: Schließt man das obere Sheet, während das untere noch offen ist, darf keine der beiden Sperren aufgehoben werden. Neues Modul `js/sheet.js` exportiert:

- `lockBodyScroll()`/`unlockBodyScroll()` und `raiseNavAboveSheet()`/`resetNavZIndex()` - jetzt **gezählt** statt reiner Flags, damit verschachtelte Sheets korrekt funktionieren (erst der letzte unbeantwortete Lock-Aufruf hebt die Sperre tatsächlich auf)
- `wireSheetDrag({ handle, sheetEl, backdropEl, isClosing, onDismiss })` - die reine Pointer-Event-Mechanik des Drag-to-Dismiss-Gestus, parametrisiert statt kalender-spezifisch. Der Aufrufer bleibt für seinen eigenen Abschluss-Timeout (State-Reset, `paint()`) selbst verantwortlich, damit `unmount()`-Aufräumarbeiten (renderEpoch-Invalidierung) beim jeweiligen View-Modul bleiben, s. [architecture.md](../architecture.md#view-pattern)
- `SHEET_CLOSE_ANIMATION_MS`/`SHEET_DRAG_CLOSE_THRESHOLD_PX` als geteilte Konstanten

State (Open/Closing-Flags, Auswahl, Ziel-Monat/-Übung) und Render-Inhalt bleiben bewusst bei den jeweiligen View-Modulen (alle drei Sheets werden weiterhin aus `workout.js` heraus gerendert, da sie fachlich vom Workout-Tab-State abhängen) - `js/sheet.js` kennt weder Kalender- noch Übungs-Inhalte, nur die geteilte Mechanik. Die CSS-Klassen `.calendar-sheet`/`.calendar-sheet-backdrop` wurden entsprechend zu `.bottom-sheet`/`.bottom-sheet-backdrop` umbenannt (kalender-spezifische ID-Selektoren wie `#calendar-sheet-months` bleiben unverändert).

## Konsequenzen

- Ein drittes Sheet (oder eine tiefere Verschachtelung) kann dieselbe Basis übernehmen, ohne Body-Scroll-/Nav-Logik zu duplizieren.
- Zwei Sheet-Ebenen brauchen eine z-Index-Staffelung: Kalender und Übungs-Sheet teilen sich weiterhin `z-50`/`z-[51]` (nie gleichzeitig offen), das gestapelte Übungs-Detail-Sheet liegt eine Ebene höher (`z-[52]`/`z-[53]`).
- Das Übungs-Detail-Sheet ist aktuell nur eine funktionsfähige, aber inhaltsleere Hülle - ein Folge-Schritt muss den eigentlichen Inhalt (und die Lösch-Aktion) definieren.
- `js/sheet.js` ist neu in der App-Shell-Cache-Liste (`sw.js`) einzutragen.
