# 0017 – Roster-Kontextmenü: Form/Material/Position nach iOS-Referenzbild, Swipe-Geste entfernt

## Kontext

Der Nutzer teilte einen Screenshot eines iOS-Liquid-Glass-Kontextmenüs (Beispiel "Bench Press: Dumbbell" mit den Einträgen "Replace"/"Remove") als Vorbild für das bestehende "⋮"-Kontextmenü der Roster-Karte (s. [ADR 0016](0016-swipe-to-delete-roster.md)). Auftrag in zwei Schritten:

1. Erst nur eine Analyse des Referenzbilds und ein isolierter Entwurf für **Form, Material, Positionierung und Schatten** (bewusst ohne die im Bild ebenfalls sichtbare wiederholte Titel-Kopfzeile und die Icons vor den Einträgen).
2. Nach Freigabe des Entwurfs: Umsetzung, mit der zusätzlichen Vorgabe, dabei möglichst bestehende Design-System-Bausteine wiederzuverwenden statt neuer Werte ("es bestehen ja bereits die Bottom-Nav und die Glass-Buttons"). Gleichzeitig sollte die in ADR 0016 eingeführte Swipe-to-Delete-Geste wieder entfernt werden - sie passe nicht zu diesem Kontextmenü-Muster.

## Entscheidung

**Vier Eigenschaften angepasst, jede davon durch Wiederverwendung eines bereits bestehenden Design-System-Bausteins statt eines neuen Werts:**

- **Form**: `rounded-sheet` (26px, bereits bestehender Radius-Token für die Bottom-Sheets) statt des vorherigen `rounded-card` (4px) - im Referenzbild deutlich raumgreifender als ein normales, kantiges Kontextmenü ("Squircle"-Optik). Keine neue Radius-Größe eingeführt, sondern ein vorhandener Token in einem neuen Kontext wiederverwendet.
- **Material**: unverändert `.popup-glass` (aus ADR 0016, identisch zur Bottom-Nav/`.icon-btn-glass`) - passte bereits vor diesem Schritt zum Referenzbild.
- **Schatten**: **kein** eigener, im vorherigen Entwurf noch als Tailwind-Override hinzugefügter Schatten mehr - stattdessen wieder der Standard-Schatten von `.popup-glass` selbst (identisch zu `#bottom-nav`). Erster Entwurf (nicht committed) hatte hier testweise einen deutlich größeren/dunkleren Schatten spendiert ("frei schwebend" statt "flach aufliegend"); auf Nutzer-Wunsch zugunsten der Wiederverwendung des bereits bestehenden Standard-Schattens verworfen - eine weitere eigene Schattenvariante hätte der Konsistenz-Vorgabe widersprochen.
- **Positionierung**: `top-0` statt des ursprünglichen `top-[calc(100%+4px)]` - das Menü überlagert die auslösende Karte jetzt direkt und wächst sichtbar aus der "⋮"-Antippstelle heraus, statt sauber getrennt darunter zu schweben (matcht das Referenzbild, das dieselbe Überlappung zeigt).

Titel-Kopfzeile und Icons vor den Einträgen bewusst weiterhin nicht übernommen - waren nie Teil des Auftrags für diesen Schritt.

**Swipe-to-Delete vollständig entfernt** (`wireExerciseRosterSwipe()`, `closeSwipeRow()`, alle `SWIPE_*`/`TAP_MOVEMENT_PX`-Konstanten, `openSwipeEntryId`-State, `.exercise-roster-swipe-surface`/`-delete-btn`-Markup in `renderExerciseRow()`, der zugehörige Aufruf in `wireEvents()`). Das "⋮"-Kontextmenü ist damit wieder der einzige Weg, eine Übung aus dem Tages-Roster zu entfernen. Direkte Folge: Der in ADR 0016 dokumentierte `setPointerCapture`/`click`-Workaround (Tap-Erkennung über Pointer Events statt `click`, s. dort) ist mit der Geste selbst entfallen - die Roster-Karte ist wieder ein einfacher `<button>` (Titel) + zweiter `<button>` ("⋮") als Geschwister, plus ein dritter `<button>` für die Satz-Liste (alle mit derselben `.exercise-row-toggle`-Klasse, dadurch automatisch gemeinsam verdrahtet), ganz ohne Pointer-Capture-Mechanik.

`removeExerciseFromWorkout()` bleibt ohne Bestätigungsdialog (s. ADR 0016) - die dortige Begründung ("betrifft nie Trainingsdaten") gilt unverändert; nur der swipe-spezifische Teil der Begründung ("die Zweistufigkeit der Geste übernimmt die Bestätigung") entfällt und wurde durch einen Verweis auf die Zweistufigkeit des Menüs selbst ersetzt (s. Kommentar in `js/db.js`).

## Konsequenzen

- Kontextmenü besteht jetzt ausschließlich aus bereits an anderer Stelle etablierten Bausteinen (`rounded-sheet`, `.popup-glass`, `.routine-picker-popup`-Animation) - kein neuer, nur hier verwendeter visueller Wert mehr im Spiel
- Roster-Karte wieder strukturell einfacher als mit Swipe-Geste - ein `<li>` mit `bg-surface rounded-card`-Fläche, Titel-Zeile (Titel-Button + "⋮"-Button nebeneinander) und optionalem Satz-Listen-Button darunter, kein `position:absolute`-Reveal-Layer, kein `touch-action`-Sonderfall, keine `setPointerCapture`-Mechanik mehr
- ADR 0016 bleibt als historischer Datensatz bestehen (inkl. des dort dokumentierten `setPointerCapture`-Lernpunkts, der für künftige Pointer-Gesten mit interaktiven Kind-Elementen weiterhin relevant ist), trägt aber einen Nachtrag, der auf diesen Schritt verweist
- Zwei kurz aufeinanderfolgende Iterationen desselben UI-Elements (Swipe hinzugefügt, dann wieder entfernt) - kein Fehlschlag, sondern normaler Ablauf eines expliziten Entwurfs-vor-Umsetzung-Vorgehens: Der Swipe wurde auf Nutzer-Wunsch gebaut, dann anhand eines konkreten Referenzbilds als nicht passend erkannt und wieder verworfen
