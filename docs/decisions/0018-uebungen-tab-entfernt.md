# 0018 – Eigenständiger Übungen-Tab entfernt, durch Statistik-Tab ersetzt

## Kontext

Seit den Anfängen der App gab es einen eigenständigen "Übungen"-Tab (`js/views/exercises.js`, zweite Position in der Bottom-Nav) mit einer einfachen Liste aller Übungen und einem Anlegen-/Bearbeiten-Formular. Parallel dazu ist im Workout-Tab inzwischen ein vollständiger, eigener Weg entstanden, Übungen anzulegen (Neue-Übung-Sheet, [ADR 0014](0014-neue-uebung-sheet-gestapelt.md)) und zu löschen (Übungs-Detail-Sheet, s. CHANGELOG vom 2026-09-09) — mit Muskel-Zuordnung, die das alte `exercises.js`-Formular nie angeboten hatte ([ADR 0013](0013-uebung-muskel-verknuepfung.md)).

Nutzer-Entscheidung: Der eigenständige Übungen-Tab ist dadurch redundant geworden und soll entfallen. Übungen sollen ab sofort ausschließlich über das Workout-Tab erreichbar sein, perspektivisch ergänzt um eine Übungs-Verwaltung innerhalb der (noch zu bauenden) Routinen-Verwaltung. An seiner Stelle in der Bottom-Nav soll ein neuer "Statistik"-Tab stehen — vorerst nur eine leere Platzhalter-Seite, Inhalt folgt separat.

## Entscheidung

**`js/views/exercises.js` vollständig gelöscht** (nicht nur aus der Navigation entfernt) — nach Prüfung, dass keine andere Datei sie importiert (einziger Importer war `js/app.js`). Damit einhergehend:

- **Neue View `js/views/statistics.js`**: minimaler Platzhalter ohne eigenen State (`export function render(container)`, kein `unmount()` nötig, s. Kommentar zu `showView()` in `app.js`) — reine Kopfzeile + "Statistik folgt."-Text, exakt im Wortlaut des bereits bestehenden Platzhalter-Reiters "Statistik" auf der Übungs-Detailseite (zwei unabhängige Platzhalter, s. features.md).
- **`js/app.js`**: `exercises`-Import/View-Registrierung durch `statistics` ersetzt (gleiche Position im `views`-Objekt).
- **`index.html`**: Nav-Button `data-view="exercises"` → `data-view="statistics"`, Label "Übungen" → "Statistik", neues Balkendiagramm-Icon (drei Linien à `stroke`, konsistent zum Icon-Stil der übrigen Nav-Buttons) statt des bisherigen Listen-Icons. Position in der Nav unverändert (zweiter Button).
- **`sw.js`**: `./js/views/exercises.js` durch `./js/views/statistics.js` in `APP_SHELL` ersetzt, `CACHE_NAME` erhöht.
- **`js/views/routines.js`**: Hinweistext im Übungs-Picker ("Es gibt noch keine Übungen...") verweist jetzt auf das Workout-Tab statt auf den entfernten Tab.
- **`updateExercise()` in `js/db.js` bewusst NICHT gelöscht**, obwohl mit dem Wegfall von `exercises.js` aktuell ohne Aufrufer (einziger bisheriger Aufrufer war das dortige Bearbeiten-Formular) — die Funktion (Umbenennen + optionale Muskel-Neuzuordnung, mit der dokumentierten "kein Reset bei fehlendem Argument"-Garantie) wird für die als nächstes geplante Übungs-Verwaltung innerhalb der Routinen sehr wahrscheinlich unverändert wieder gebraucht. Abweichung vom sonst üblichen "unbenutzten Code löschen"-Grundsatz, da hier ein konkretes, vom Nutzer selbst genanntes Kurzfrist-Ziel (nicht nur eine denkbare Zukunft) den Wiedereinsatz nahelegt.
- **Diverse Code-Kommentare** in `js/db.js`, `js/utils.js`, `js/views/workout.js`, `js/views/workout-exercise-detail.js` aktualisiert, die `exercises.js` als Beispiel/Aufrufer nannten.

## Konsequenzen

- Bottom-Nav bleibt bei vier Tabs (Workout, Statistik, Routinen, Profil) — reine Umbesetzung eines Slots, keine Struktur-Änderung an `app.js`s View-Registrierungsmechanismus nötig (bereits generisch über ein `{ name: modul }`-Objekt)
- Übungen anlegen läuft jetzt ausschließlich über das Neue-Übung-Sheet (Workout-Tab), löschen ausschließlich über das Übungs-Detail-Sheet (ebenfalls Workout-Tab) - kein eigenständiges "Übung bearbeiten" (Umbenennen/Muskel-Zuordnung ändern) mehr erreichbar, bis die Routinen-Verwaltung das übernimmt (s. features.md, "Vorgemerkte Erweiterungen")
- Statistik-Tab ist bewusst ein Wegwerf-Platzhalter, kein Grundgerüst für den späteren Inhalt - wird beim eigentlichen Statistik-Schritt vermutlich komplett neu aufgebaut
- Kleinere Inkonsistenz bewusst in Kauf genommen: Es gibt jetzt zwei unabhängige, gleichnamige "Statistik"-Platzhalter (dieser Tab und der Reiter auf der Übungs-Detailseite) - beide dokumentiert, um Verwechslung in künftigen Sitzungen vorzubeugen
