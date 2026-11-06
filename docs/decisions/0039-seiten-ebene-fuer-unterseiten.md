# 0039 – Unterseiten in eigener Seiten-Ebene statt im Container der Übersicht

**Status:** Gültig

> Überholt den Aufbau aus [ADR 0038](0038-ios-seitenuebergaenge.md) ("Kein Umbau der Views auf Schichten"). Optik, Federn und Schwellen von 0037/0038 bleiben unverändert.

## Kontext

Nach dem Zurückwischen von einer Übungs-Detailseite ließ sich die Workout-Liste auf dem iPhone nicht mehr scrollen: der Wisch dehnte nur das Gummiband, dahinter war schwarz. Die Screenshots zeigten einen genau bildschirmhohen, glatt abgeschnittenen Inhaltsblock, der mit dem Finger verschoben wurde - das Verhalten eines Scrollers, den iOS für nicht scrollbar hält.

Ursache (aus Screenshots und Code geschlossen, ohne iOS-Gerät/Simulator nicht direkt messbar): Detailseite und Übersicht teilten sich den Scroll-Container `#view-container`. Dessen Inhalt wechselte zwischen kurz (Detailseite, nicht scrollbar) und lang (Liste, scrollbar), während er per `visibility: hidden` unsichtbar war, per `transform` verschoben wurde und seine Scrollposition per `scrollTop` gesetzt bekam. iOS legt dabei offenbar keinen funktionierenden nativen Scroller mehr an. Die Versuche v247 bis v251 (Scrollposition abgleichen, `will-change` entfernen, `display`-Toggle, Parallax per Abbild) ließen den Container weiter ausblenden und neu befüllen und konnten daran nichts ändern.

## Entscheidung

- Eine Unterseite (Workout-Übungsseite, Statistik-Übungsseite) wird in eine **eigene, frisch erzeugte Seiten-Ebene** `#page-layer` gezeichnet (`position: fixed`, z-index 8, gleiche Klassen/Padding wie der Container, eigener Scroller).
- `#view-container` bleibt die ganze Zeit sichtbar, wird nie verschoben, ausgeblendet oder für die Unterseite neu befüllt. Seine Scrollposition bleibt von selbst erhalten; `listScrollTop` samt Wiederherstellen entfällt.
- Öffnen/Zurück bewegen nur die Ebene (`openPage()`, `wireSwipeBack()` in `js/swipeBack.js`). Die Übersicht erscheint dabei als Abbild (Klon) mit Parallax unter einer abdunkelnden Ebene; der echte Container ist nur verdeckt.
- Beim Zurückgehen zeichnen die Aufrufer die Übersicht über `refreshUnder()` in place neu (geänderte Sätze), das Abbild wird danach erneuert. `onBack({ animated })` räumt die Seite auf und entfernt die Ebene.
- Abgebrochene Geste: die Ebene gleitet zurück, nichts wird neu aufgebaut (`onRestore`/`restore` entfallen).
- Sheets liegen weiter im Container der Übersicht (eigener Stapelkontext der fixierten Ebene würde sie sonst unter Nav/Scrims einsperren); das Notiz-Sheet der Detailseite bekommt deshalb `#view-container` als Container. `lockBodyScroll()` sperrt zusätzlich `#page-layer`.
- Tab-Wechsel (`unmount()`/`render()` von Workout und Statistik) entfernt die Ebene über `removePageLayer()`.

## Konsequenzen

- Der Aufbau ist näher an UIKit (Navigationsstapel: untere Seite bleibt bestehen) und vermeidet die Ursachenklasse "Scroller wechselt zwischen scrollbar/nicht scrollbar und wird versteckt".
- `workout.js`/`statistics.js` zeichnen die Übersicht weiter in `currentContainer`, auch während eine Unterseite offen ist; Code, der Sheets in `currentContainer` einfügt, funktioniert unverändert.
- Beim Zurückgehen wird die Übersicht einmal in place neu gezeichnet (Kalenderstreifen scrollt dabei neu zur Woche).
- Nur im Browser (Chromium) getestet; ob der iOS-Scroll-Fehler damit behoben ist, ist am iPhone zu prüfen. Rollback: Tag `pre-page-layer-v252`.
