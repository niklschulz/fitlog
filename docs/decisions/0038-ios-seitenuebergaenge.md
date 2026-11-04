# 0038 – iOS-Seitenübergänge: echte Übersicht darunter, Federn mit Fingergeschwindigkeit

## Kontext

Die Wisch-Zurück-Geste ([ADR 0037](0037-wisch-zurueck-geste.md)) fühlte sich nicht nativ an: Beim Ziehen war unter der Seite nur leerer Hintergrund, nach dem Loslassen lief eine feste Animation, und Zurück-Pfeil sowie Öffnen nutzten andere Bewegungen. Der Nutzer wollte alles iOS-gleich.

## Entscheidung

- **Echte Übersicht darunter.** Sobald der Finger wandert, wird die Detailseite als Abbild (Klon) über den Container gelegt und `onBack()` zeichnet die echte Übersicht darunter. Sie läuft mit Versatz (-1/3 der Breite) nach, eine abdunkelnde Ebene (max. 20 %) dazwischen blendet mit dem Weg aus. Kein Umbau der Views auf Schichten: Die Views zeichnen weiter in einen einzigen Container, nur der Zeitpunkt von `onBack()` ändert sich.
- **Abbruch.** Bleibt die Seite stehen, ruft die Geste `onRestore()` auf. Die Views bauen die Detailseite mit `restore: true` neu auf (Reiter, Satz-Auswahl, Zeitraum bleiben, Scroll-Position stellt die Geste her). Erst danach verschwindet das Abbild. `render()` der Detailseiten nimmt dafür `restore`/`onRestore` entgegen, `workout.js` (`showDetailPage()`) und `statistics.js` (`showExerciseDetail()`) liefern den Wiederaufbau.
- **Entscheidung beim Loslassen wie iOS:** Fling nach rechts ≥ 1 Bildschirmbreite/s = zurück, Fling nach links ≥ 0,5 = bleiben, sonst > 50 % Weg. Werte von Flutters iOS-Nachbau übernommen (`CupertinoBackGestureController`), Apple dokumentiert sie nicht.
- **Ausgleiten als gedämpfte Feder ohne Nachschwingen** (kritisch gedämpft, ω = 12, ca. 0,35 s), die mit der Fingergeschwindigkeit startet - kein Knick zwischen Finger und Animation. Per `requestAnimationFrame` gesteuert, nicht per CSS/WAAPI, damit Geschwindigkeit und Abbruch exakt zusammenpassen.
- **Ein Mechanismus für alles:** `triggerBack()` (Zurück-Pfeil) und `pushPage()` (Öffnen, die alte Seite rückt als Abbild mit Versatz nach links) laufen über dieselbe Feder und dieselben Ebenen. `withViewTransition()` bleibt für `'none'`/Fallbacks bestehen, 'forward'/'back' werden für diese Seiten nicht mehr benutzt.
- **Layer** unterhalb der Scrims (z-10), Nav (z-20) und Sheets: Abdunklung 6, Abbild 7; beim Öffnen Abbild der alten Seite 6, Abdunklung 7, Container 8.
- Der Container ist während der Animation nicht antippbar (`pointer-events: none`), damit die Übersicht darunter nichts auslöst. Beim Öffnen bleibt der Container unsichtbar, bis die Seite gezeichnet ist (MutationObserver, Fallback 600 ms), dann starten die Animationen - der schwere Seitenaufbau blockiert so nicht deren erste Bilder (Messung bei 4-fach gedrosselter CPU: keine Bildabstände über 17 ms).

## Konsequenzen

- Während der Geste wird die Übersicht gezeichnet, auch wenn sie danach per Abbruch wieder verworfen wird (zweimal Zeichnen statt einmal).
- Die Abbilder sind statisch: Eingabewerte und Scroll-Positionen werden elementweise kopiert, Animationen/Zustände im Klon laufen nicht weiter.
- Neue Unterseiten mit Zurück-Pfeil sollten `wireSwipeBack()` (mit `onRestore`), `triggerBack()` und `pushPage()` nutzen.
- Nur mit Touch-Events in Chromium getestet; das Gefühl und die Feder-Konstanten sind am iPhone abzugleichen.
