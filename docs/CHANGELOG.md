# Changelog

Format angelehnt an [Keep a Changelog](https://keepachangelog.com/). Ein Eintrag pro nennenswerter Änderung, neueste zuerst.

## 2026-08-30

### Fixed (neu)
- Home-Bildschirm-App (standalone) hat neue Versionen nie von selbst übernommen, obwohl ein normaler Safari-Tab sie sofort zeigte. Ursache: iOS prüft bei standalone-PWAs deutlich seltener auf Service-Worker-Updates. Behoben durch expliziten `registration.update()`-Aufruf bei App-Start/`visibilitychange` plus automatischem Reload bei `controllerchange`. Lokal mit simuliertem Update verifiziert. **Hinweis**: Diese Änderung muss selbst erst einmal manuell (über Safari) auf die Geräte kommen, bevor sie für künftige Updates automatisch greift.

### Added
- Dokumentationsstruktur (`docs/`, ADRs, dieses Changelog, `README.md`, `CLAUDE.md`)
- Privates Repo `fitlog-infra` für Netzwerk-/Infrastruktur-Doku angelegt (getrennt vom öffentlichen `fitlog`-Repo)
- Nicht-funktionale Anforderungen (Browser-Scope, HTTPS, Performance, Robustheit) in `architecture.md` nachgetragen, waren bei der ersten Migration übersehen worden
- "Profil"-Tab (Username + Token, lokal via `localStorage`) als Vorbereitung für den geplanten Sync — Token-basierte Nutzertrennung ohne vollwertiges Login-System, s. [ADR 0006](decisions/0006-token-basierte-nutzertrennung.md). Sync selbst noch nicht aktiv, da kein Backend existiert.
- Profil-Tab: dedizierte Anzeige-Ansicht (aktuelles Profil + "Profil entfernen") und Leer-Zustand (Hinweis + "Profil hinzufügen") statt nur einem Formular

### Fixed
- Profil-Formular ließ sich komplett leer speichern (fehlende `required`-Attribute)
- Sichtbarkeits-Toggle fürs Token-Feld baute den Screen bei jedem Klick aus dem `localStorage` statt aus den aktuell getippten Werten neu auf, wodurch ungespeicherte Eingaben verloren gingen — Toggle komplett entfernt, Token ist jetzt unmaskiert
- Styling von "Profil entfernen" an "Profil hinzufügen" angeglichen (voller Button statt Textlink, rot statt grün)

### Korrigierte Fehldiagnose
- "Profil entfernen" wirkte beim Testen funktionslos — kurzzeitig wurde deswegen der Bestätigungsdialog entfernt. Ursache war aber kein Bug: `confirm()` wird in der automatisierten Browser-Testumgebung sofort mit "Abbrechen" beantwortet, ohne dass ein Dialog sichtbar wird. In einem echten, von einem Menschen bedienten Browser (z. B. Safari auf dem iPhone) funktioniert `confirm()` normal. Bestätigungsdialog wieder eingebaut, jetzt korrekt mit simuliertem "OK" verifiziert.

### Removed
- Home-Tab mit tageszeitabhängigem Spruch (deterministisch ausgewählt, Playfair-Display-Font lokal eingebunden) — vollständig implementiert, dann auf ausdrücklichen Wunsch per `git revert` wieder entfernt. Kein funktionaler Nutzen für den aktuellen Scope.

### Fixed
- App-Icon zeigte auf dem Home-Bildschirm nur eine schwarze Fläche statt der Hantel-Grafik. Ursache: fehlendes Runden auf Pixelkoordinaten beim Herunterskalieren des generierten Icons auf 192px/180px — Fill-Routine schrieb dadurch auf nicht-indexierte Array-Properties statt echter Pixel. Nur die 512px-Variante war zufällig unbetroffen.
- Überschriften/Buttons oben wurden von der iOS-Statusleiste (Uhrzeit, Akku, Empfang) verdeckt. Ursache: `safe-top`-CSS-Klasse existierte, wurde aber nirgends angewendet.

## 2026-08-29

### Added
- Initiales PWA-Grundgerüst: Manifest, Service Worker (App-Shell-Caching), Dexie-Schema, Bottom-Tab-Navigation, generierte App-Icons
- Vier Kern-Flows implementiert: Übungen, Routinen, Training (inkl. Progressive-Overload-Vorbefüllung, Persistenz über App-Neustart), Trainingsverlauf
- Deployment auf GitHub Pages (öffentliches Repo, HTTPS für Service-Worker-Test auf echtem iPhone)

### Fixed
- Service-Worker-Installation scheiterte komplett, weil `cache.addAll()` im `cors`-Modus an fehlenden CORS-Headern von `cdn.tailwindcss.com` scheiterte — CDN-Skripte werden seither einzeln im `no-cors`-Modus gecacht
- Gewicht/Wiederholungen-Eingabefelder liefen auf schmalen Bildschirmen über den Rand hinaus (Inputs erben Breite nicht automatisch von verschachtelten, nicht-flex Eltern-Containern) — behoben mit expliziter `w-full`-Klasse

## 2026-08-28

### Added
- Ursprüngliches Konzept-Dokument (Scope, Tech-Stack, Datenmodell, User Flows, UI/UX-Anforderungen, Nicht-funktionale Anforderungen, spätere Erweiterungen)
