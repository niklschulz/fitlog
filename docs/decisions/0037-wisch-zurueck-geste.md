# 0037 – Wisch-Zurück-Geste wie in iOS

## Kontext

Bottom-Sheets lassen sich per Wischen nach unten schließen. Der Nutzer wollte dasselbe für Seiten mit Zurück-Pfeil: Wisch von links nach rechts geht zur vorherigen Seite, Start und Animation wie in iOS. Betroffen sind die Übungs-Detailseite im Workout-Tab und die Statistik-Übungsseite.

## Entscheidung

- **Eigenes Modul `js/swipeBack.js`** (`wireSwipeBack()`/`unwireSwipeBack()`), von beiden Detail-Seiten in `render()`/`unmount()` eingebunden. Pointer Events, kein Framework (ADR 0001/0002).
- **Start nur am linken Rand** (22 px breiter, fixer Streifen außerhalb des Seiteninhalts, `touch-action: none` - mit `pan-y` scrollte/gummibandete iOS bei schrägen Wischbewegungen parallel und die Seite ruckelte). So stören Reiter, Zahlenfelder und Umsortieren nicht, und der Streifen überlebt jedes Repaint. Offene Sheets (höherer z-index) blockieren die Geste von selbst.
- **Verhalten wie iOS:** Die Seite folgt dem Finger mit Schatten. Zurück bei Weg > 40 % der Breite oder schnellem Wisch, sonst Federn zurück.
- **Zurück-Animation mit Abbild:** `onBack()` füllt den Container sofort neu. Deshalb schiebt die Geste einen Klon der Seite nach rechts hinaus, darunter läuft die neue Übersicht mit Parallax (-30 % → 0) ein. Der echte Container bleibt bis zum Neuzeichnen unsichtbar (MutationObserver, Fallback 600 ms); erst dann starten beide Animationen, damit der Aufbau der Übersicht nicht deren erste Bilder blockiert. `unwireSwipeBack()` (von `onBack()` über `unmount()` ausgelöst) räumt eine laufende Zurück-Animation nicht ab, sie beendet sich selbst.
- `onBack({ swipe: true })`: der Aufrufer lässt seine eigene Zurück-Animation weg (`withViewTransition(..., 'none')`).
- Bei "Bewegung reduzieren" geht die Geste ohne Animation zurück.

## Konsequenzen

- Während des Ziehens ist unter der Seite nur der leere Hintergrund zu sehen, nicht die echte Übersicht (sie wird erst beim Zurückgehen gezeichnet).
- Neue Sub-Seiten mit Zurück-Pfeil sollten `wireSwipeBack()` ebenfalls aufrufen.
- Nur im Browser mit Maus-Pointer-Events getestet. Das Verhalten mit echtem Touch (inkl. iOS-Systemgesten am Rand) ist am Gerät zu prüfen.
