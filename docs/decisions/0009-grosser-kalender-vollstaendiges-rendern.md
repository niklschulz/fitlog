# 0009 – Großer Kalender: vollständiges Vorab-Rendern statt Lazy-Loading beim Scrollen

## Kontext

[ADR 0008](0008-grosser-kalender-lazy-loading.md) entschied sich für wachsendes Lazy-Loading: Beim Öffnen des großen Kalenders wurden nur wenige Monate um den Zielmonat gerendert, weitere Monate erst beim Erreichen des Scroll-Rands per asynchroner DB-Abfrage nachgeladen. In der Praxis (Nutzer-Feedback nach dem ersten echten Test) führte das zu spürbarem Ruckeln: Die erste Scroll-Geste nach dem Öffnen "hakte" bzw. stoppte vorzeitig, weil die IndexedDB-Abfrage für den nächsten Monat noch nicht abgeschlossen war, während der native Scroll bereits an den (noch unvollständigen) Rand des geladenen Inhalts lief. Erst nach dem ersten erfolgreichen Nachladen (Browser/Dexie-Caches warm) fühlte sich weiteres Scrollen flüssig an.

## Entscheidung

- **Der komplette erlaubte Zeitraum wird beim Öffnen in einem Rutsch gerendert**, kein Nachladen während des Scrollens mehr. Kein `insertAdjacentHTML` mitten in einer Scroll-Geste, keine Scroll-Event-Listener am Monats-Container mehr.
- **Eine einzige Bulk-Abfrage statt einer Abfrage pro Monat**: `getDatesWithSetsInRange(fromDate, toDateExclusive)` holt mit `db.workouts.where('date').between(...)` (Index-Range-Scan, kein `anyOf` über eine lange Datumsliste) alle Workouts im gesamten Zeitraum in einem Rutsch, danach `db.sets.where('workoutId').anyOf(...)` für alle betroffenen Sätze in einem zweiten Rutsch – genau zwei DB-Zugriffe unabhängig von der Anzahl der Monate, statt vorher zwei pro Monat.
- **Begründung, warum das für diesen Anwendungsfall besser ist als "richtige" Virtualisierung mit Element-Recycling**: Der erlaubte Zeitraum ist praktisch begrenzt (fest ab Januar 2026, wächst nur um einen Monat pro echtem Kalendermonat) – selbst nach mehreren Jahren Nutzung sind das eine überschaubare zwei- bis dreistellige Anzahl an Monaten, für eine Einzelnutzer-App auf einem modernen Gerät unproblematisch als statisches DOM. Die ursprüngliche "nicht alles gleichzeitig rendern"-Vorgabe aus dem Briefing zielte auf ein flüssiges UI ab – das eigentliche Ziel wird hier durch einmaliges Rendern **vor** der sichtbaren Öffnen-Animation besser erreicht als durch inkrementelles Nachladen **während** einer aktiven, fingergeführten Scroll-Geste, die auf Verzögerungen sehr viel empfindlicher reagiert als ein einmaliger kurzer Ladezustand beim Öffnen (der ohnehin hinter der 220ms-Slide-up-Animation verschwindet).
- **`renderSheetMonth` ist jetzt synchron** (bekommt die bereits geladenen `datesWithSets` als Parameter statt selbst zu fragen) – nur `renderCalendarSheet` bleibt asynchron für die eine Bulk-Abfrage.

## Konsequenzen

- Deutlich einfacherer Code: kein Wachstums-Zustand (`sheetMonths`, `sheetGrowing`-Flag, Scroll-Schwellenwerte) mehr nötig, das Sheet braucht keinen eigenen "welche Monate sind gerade geladen"-Zustand – der Monatsbereich ergibt sich direkt aus den Datumsgrenzen.
- Bei sehr langer Nutzungsdauer (viele Jahre) wächst die beim Öffnen gerenderte DOM-Größe entsprechend – für eine Einzelnutzer-App als unkritisch eingeschätzt; sollte sich das je als Problem erweisen, wäre eine harte Obergrenze (z. B. nur die letzten N Jahre) der pragmatischere nächste Schritt vor einer echten Virtualisierung.
- Öffnen des Sheets braucht jetzt eine (kurze) Bulk-Abfrage, bevor überhaupt etwas sichtbar wird (`await paint()` vor der Slide-up-Animation) – bei realistischen Datenmengen im Millisekunden-Bereich, nicht wahrnehmbar.
