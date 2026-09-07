// Muss vor jedem Import von js/db.js laufen: db.js referenziert `Dexie` als
// globale Variable (so wie im Browser über den CDN-<script>-Tag geladen,
// s. index.html/sw.js), nicht per import. In Node gibt es weder ein
// `Dexie`-Global noch echtes IndexedDB - beides hier einmalig bereitstellen,
// bevor db.js sein `new Dexie('fitlog')` beim Modul-Import ausführt.
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

globalThis.Dexie = Dexie;
