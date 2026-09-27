# Entwürfe (nicht Teil der ausgelieferten App)

Dieser Ordner enthält UI-Entwürfe, die bewusst **nicht** in `index.html`/`app.js`/`sw.js` eingebunden sind — sie laufen nie in der echten App mit, ändern also nichts am ausgelieferten Verhalten. Zweck: Layout-Entscheidungen vorab sichtbar machen, ohne echte Daten/Assets zu brauchen.

## exercise-media.html

Zwei Mockups für Übungs-Medien (Bild in der Übungs-Sheet-Zeile, Video im Übungs-Detail-Sheet mit Glass-Play-Button), direkt im Browser öffenbar (`open drafts/exercise-media.html` oder per lokalem Server). Nutzt dieselbe Tailwind-Config wie `index.html` und `../css/styles.css`, damit es optisch zur echten App passt.

**Grund, warum das (noch) nicht live ist:** Es gibt weder ein Bild-/Video-Feld an `exercises` in `js/db.js` noch echte Medien für die einzelnen Übungen. Bis dahin bleibt es hier abgelegt.

**Wenn es losgeht:** Vermutlich ein neues `imageUrl`/`videoUrl`-Feld an `exercises` (neue Dexie-Schema-Version), eine Entscheidung, wo die Dateien liegen (eigener Server? eingebettet als Data-URI? s. `docs/architecture.md`, "Sync & Infrastruktur (geplant)"), und erst dann die Übernahme dieses Layouts in `js/views/workout.js`.

## media/

Platzhalter-Bild/-Video für die Mockups oben — `exercise-placeholder.jpg` (ein aus einem Beispiel-Video extrahiertes, quadratisch zugeschnittenes Frame) und `exercise-placeholder.mp4` (dasselbe Beispiel-Video). Stammen aus einem lizenzierten Stock-Footage-Paket, nicht zur Weiterverbreitung bestimmt — deshalb per `.gitignore` (`drafts/media/`) von Git ausgeschlossen. Beim Klonen des Repos fehlt dieser Ordner entsprechend; die Mockup-Seite zeigt dann nur fehlende Medien, was für ein reines Layout-Vorlage unkritisch ist.
