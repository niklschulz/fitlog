# 0008 – Großer Kalender im Workout-Tab: wachsendes Lazy-Loading statt echter Virtualisierung

## Kontext

Abschnitt 11 der Konzept-Erweiterungen verlangt einen aktivierten Kalender-Button im Workout-Tab, der ein großes (85–90% Höhe) Bottom-Sheet mit einem vertikal scrollenden, monatsweisen Kalender öffnet. Der erlaubte Zeitraum ist fest ab Januar 2026 bis einen Monat nach dem aktuellen echten Kalendermonat (dynamisch berechnet) – je nach Nutzungsdauer der App theoretisch viele Dutzend Monate. Explizite Vorgabe: **Monate dürfen nicht alle gleichzeitig gerendert werden** (Performance), Navigation ausschließlich per Scrollen (keine Pfeil-Buttons).

Das bestehende Render-Modell der App (jede `paint()` ersetzt komplett `innerHTML`) verträgt sich schlecht mit einer wachsenden Scroll-Liste: Ein voller `paint()`-Durchlauf bei jedem zusätzlich geladenen Monat würde die Scroll-Position zurücksetzen.

## Entscheidung

- **Ersetzt den bisherigen nativen `<input type="date">`-Ansatz** aus [ADR 0007](0007-workout-tab-tagesbasiertes-modell.md) vollständig – der war dort explizit als pragmatischer Zwischenstand markiert ("offene Positionierung"), dieses Briefing spezifiziert jetzt die eigentliche UI dafür.
- **Wachsendes statt evictierendes Lazy-Loading**: Beim Öffnen wird nur ein kleines Fenster von Monaten um den Zielmonat gerendert (Zielmonat ±1, innerhalb der Grenzen). Beim Scrollen nahe an den oberen/unteren Rand wird per `insertAdjacentHTML` ein weiterer Monat direkt ins DOM angehängt/vorangestellt – bereits geladene Monate werden **nicht** wieder entfernt, solange das Sheet offen ist. Das ist bewusst einfacher als eine vollständige Fenster-Virtualisierung mit Element-Recycling: Für eine Einzelnutzer-App ist die Zahl der in einer Sitzung tatsächlich durchscrollten Monate praktisch begrenzt, und die eigentliche Performance-Anforderung ("nicht alles auf einmal rendern") ist damit erfüllt, ohne die Zusatzkomplexität einer Recycling-Logik.
- **Wachstum umgeht `paint()` bewusst**: Die Monats-Erweiterung manipuliert das DOM des Sheets direkt statt über einen vollen `paint()`-Durchlauf zu laufen, um die Scroll-Position nicht zurückzusetzen. Beim Voranstellen eines Monats wird die neu hinzugekommene Höhe sofort auf `scrollTop` aufgeschlagen, damit die sichtbare Position stabil bleibt.
- **Ein einziger delegierter Klick-Listener** auf dem Monats-Container statt einzelner Listener pro Tages-Button – erforderlich, weil nachträglich per `insertAdjacentHTML` eingefügte Buttons sonst nicht verdrahtet wären.
- **Öffnen/Schließen läuft weiterhin über den normalen `paint()`-Zyklus** (zweiphasiges Schließen mit Animation, analog zum Routine-Picker aus früheren Iterationen) – nur das Wachsen während des Scrollens umgeht ihn. Beim Öffnen muss auf `paint()` gewartet werden (`await`), bevor der Ziel-Monat per `scrollIntoView` angesteuert wird, da `paint()` selbst asynchron Datenbankabfragen macht.
- **Tap auf einen Tag** setzt nur `state.selectedDate` und schließt das Sheet – die kleine Kalenderzeile und die Workout-Ansicht übernehmen die neue Auswahl automatisch beim nächsten `paint()`, keine separate Logik nötig.
- **Kein Drag-to-Dismiss-Gesture**: Der Griff oben ist rein visuell (Konvention "das ist ein Bottom-Sheet"), Schließen funktioniert über Tap auf Backdrop oder Tages-Auswahl. Eine echte Wisch-Geste wurde nicht verlangt und hätte zusätzliche Touch-Event-Komplexität bedeutet.
- **`rounded-sheet`-Token** (26px, in `index.html`s Tailwind-Config seit dem Design-Briefing für genau diesen Zweck reserviert) kommt hier zum ersten Mal tatsächlich zum Einsatz.

## Konsequenzen

- Erste echte Bottom-Sheet-Komponente der App – etabliert das Muster (Slide-up-Animation, `rounded-sheet`, Backdrop mit Abdunklung) für zukünftige Sheets.
- Innerhalb einer sehr langen Scroll-Sitzung (viele Dutzend Monate in beide Richtungen) wächst die DOM-Größe des Sheets unbegrenzt, da nichts evictiert wird – für die Praxis (Einzelnutzer, realistische Scroll-Distanzen) unkritisch; sollte sich das als Problem erweisen, wäre der nächste Schritt echtes Element-Recycling.
- Der alte native Datums-Picker-Ansatz aus ADR 0007 ist vollständig entfernt (kein Parallelbetrieb, kein Fallback).
