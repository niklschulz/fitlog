# 0024 – Testmodus: umschaltbare zweite Datenbank mit synthetischen Testdaten

## Kontext

Die App wird bislang nicht produktiv genutzt — auf dem iPhone des Nutzers liegen dadurch keine größeren Datenmengen, an denen sich z. B. der Volumen-Chart (ADR 0023) oder das Balkendiagramm "Workouts pro Woche" sinnvoll ausprobieren lassen. Ein zuvor am Entwickler-Rechner einmalig live erzeugter 3-Jahres-Testdatensatz diente bereits zur Verifikation dieser Features, existierte aber nur als einmaliger `javascript_tool`-Aufruf, nicht als wiederverwendbarer Code, und ließ sich nicht aufs Telefon übertragen — es gibt keinen Sync-Mechanismus, der Bytes vom Entwickler-Rechner zum iPhone bringt (s. "Sync & Infrastruktur (geplant)" in architecture.md, noch nicht gebaut).

**Ausdrücklich ein Übergangs-Feature:** Sobald die App produktiv genutzt wird, soll dieser gesamte Mechanismus wieder vollständig entfernt werden (s. "Rückbau" unten) — er ist bewusst NICHT für den Dauerbetrieb gedacht, sondern nur für die aktuelle Entwicklungs-/Testphase.

## Entscheidung

Ein Schieberegler im Profil-Tab ("Testdaten verwenden") schaltet zwischen der echten Datenbank (`fitlog`) und einer zweiten, separaten Dexie-Datenbank mit synthetischen Testdaten (`fitlog-test`) um. Ein Wechsel lädt die Seite neu (`window.location.reload()`) — kein Hot-Swap zur Laufzeit, da sich dabei buchstäblich die gesamte Datengrundlage austauscht und praktisch jede View ohnehin aus der DB neu lädt.

**Technische Umsetzung, bewusst minimal-invasiv:**

- `js/db.js` erzeugt seine einzige Dexie-Instanz nicht mehr mit fest `'fitlog'`, sondern mit `getActiveDbName()` (aus der neuen Datei `js/testmode.js`). Die bestehenden `db.version(N).stores({...})`-Migrationen bleiben unverändert — sie laufen dadurch automatisch gegen welchen Namen auch immer gerade aktiv ist, legen also bei Bedarf eine komplett schema-identische zweite Datenbank an, **ohne eigene Schema-Definition**.
- `js/testmode.js` (neue, in sich geschlossene Datei): `isTestModeEnabled()`/`setTestModeEnabled()` (Flag in `localStorage`, try/catch-abgesichert wie `js/settings.js` — `localStorage` existiert nicht in jeder Umgebung, u. a. nicht im Node-Testlauf ohne DOM), `getActiveDbName()` sowie `seedTestData(db, dbFns)`: ein deterministischer Generator (fester Seed, einfacher linearer Kongruenzgenerator) für ca. 3 Jahre synthetisches Training — zwei mehrwöchige Pausen, ~12 % zusätzlich zufällig ausgelassene Wochen, leichter Progressive-Overload-Trend, alle 6 Standard-Übungen (ADR 0021). `seedTestData()` nimmt die benötigten `db.js`-Funktionen als Parameter entgegen statt sie selbst zu importieren — vermeidet einen Ringbezug zwischen `db.js` (importiert `getActiveDbName` von hier) und dieser Datei. Eingebautes Sicherheitsnetz: Die Funktion verweigert den Dienst, falls die übergebene `db`-Instanz nicht tatsächlich `fitlog-test` heißt — echte Trainingsdaten sind unersetzlich, ein versehentlicher Aufruf gegen die Produktiv-DB darf unter keinen Umständen möglich sein.
- `js/app.js`: Im Start-Ablauf (nach `seedBuiltinExercises()`, vor `showView('workout')`) wird `seedTestData()` genau einmal aufgerufen, falls der Testmodus aktiv UND die Test-Datenbank noch leer ist (`db.workouts.count() === 0`) — das Umschalten selbst erzeugt noch keine Daten, das Seeding passiert lazy beim nächsten Start danach. Wiederholtes Umschalten erzeugt dadurch keine Duplikate.
- `js/views/profile.js`: Neuer Abschnitt "Entwicklung" mit dem Schieberegler (reine Tailwind-Utility-Klassen, keine neue CSS-Datei/-Klasse nötig) unterhalb der bestehenden Einstellungen.
- `sw.js`: `js/testmode.js` in `APP_SHELL` aufgenommen, `CACHE_NAME` hochgezählt.

**Warum keine Proxy-/Indirektionsschicht für einen Live-Wechsel ohne Reload:** Der Umbau der bestehenden `const db = new Dexie(...)`-Singleton-Nutzung (direkt in ~30 Funktionen in `db.js` sowie zwei Views) auf eine zur Laufzeit austauschbare Referenz hätte deutlich mehr Code angefasst, für einen Komfortgewinn (kein Reload), der hier nicht gebraucht wird — ein Reload beim Umschalten ist für ein Entwickler-Feature akzeptabel und hält den Rückbau (s. u.) auf eine einzige Codezeile in `db.js` beschränkt.

## Konsequenzen

- Alle vier Ankopplungsstellen (`db.js`, `app.js`, `profile.js`, `sw.js`) sind im Code mit dem Kommentar-Stichwort "TESTMODUS" markiert, ebenso der gesamte Block in `profile.js`.
- **Rückbau, sobald die App produktiv genutzt wird:**
  1. `js/testmode.js` löschen.
  2. `js/db.js`: die beiden markierten Zeilen entfernen (Import + `new Dexie(getActiveDbName())` zurück auf `new Dexie('fitlog')`).
  3. `js/app.js`: den markierten Import sowie den markierten `.then()`-Block in der `db.open()`-Kette entfernen.
  4. `js/views/profile.js`: den markierten Import, den Aufruf von `renderTestModeToggle()` in `paint()`, die Funktion selbst sowie das markierte Klick-Wiring entfernen.
  5. `sw.js`: die markierte Zeile aus `APP_SHELL` entfernen, `CACHE_NAME` hochzählen.
  6. Dieses ADR bleibt als historisches Dokument stehen (ADRs werden nicht gelöscht), bekommt aber einen Nachtrag mit Datum des Rückbaus.
- Test-Nutzer, die den Testmodus aktiviert hatten, behalten das `localStorage`-Flag über den Rückbau hinaus bestehen — harmlos, da nach dem Rückbau ohnehin nur noch `fitlog` existiert und gelesen wird.
- Kein neuer automatisierter Test nötig: reine Geräte-/Dev-Konfiguration ohne Kaskaden-Logik, analog zu `js/settings.js`/`js/profile.js`. `seedTestData()` selbst wurde stattdessen live im Browser verifiziert (Umschalten, Datensatz-Größe, Diagramme in 3M/1J/Max, Rückschalten ohne Beeinträchtigung der — in diesem Fall leeren — Produktiv-DB).
