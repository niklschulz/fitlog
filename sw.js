// App-Shell-Caching für vollständige Offline-Nutzung (s. Konzept Abschnitt 6).
// Cache-Name bei Änderungen an der Datei-Liste hochzählen, damit Clients aktualisieren.
const CACHE_NAME = 'fitlog-v226';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './css/tailwind.css',
  './js/app.js',
  './js/db.js',
  './js/sheet.js',
  './js/actionSheet.js',
  './js/exerciseCreateSheet.js',
  './js/exerciseInfo.js',
  './js/exerciseStats.js',
  './js/reorder.js',
  './js/utils.js',
  './js/vendor/dexie.min.js',
  './js/profile.js',
  './js/backup.js',
  './js/settings.js',
  './js/pr.js',
  './js/muscleStats.js',
  // TESTMODUS (temporär, s. ADR 0024/js/testmode.js) - beim Entfernen auch
  // diese Zeile löschen.
  './js/testmode.js',
  './js/views/workout.js',
  './js/views/workout-exercise-detail.js',
  './js/views/statistics.js',
  './js/views/statistics-exercise-detail.js',
  './js/views/profile.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// Zur Laufzeit aufgelöste, vollständige URLs der App-Shell - der fetch-
// Handler unten bekommt echte, bereits aufgelöste Request-URLs von der
// Browser-API, keine relativen Pfade wie in APP_SHELL oben.
const APP_SHELL_URLS = new Set(APP_SHELL.map((path) => new URL(path, self.location.href).href));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // cache.addAll() macht normale fetch()-Aufrufe, die dem Browser-eigenen
      // HTTP-Cache unterliegen - ohne cache:'reload' könnte ein Update sonst
      // stellenweise veraltete Dateien aus dem HTTP-Cache übernehmen, statt
      // wirklich alles frisch vom Server zu holen.
      const requests = APP_SHELL.map((url) => new Request(url, { cache: 'reload' }));
      await cache.addAll(requests);
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// Cache-first, aber ausschließlich für die bekannte App-Shell (alle
// Dateien oben in APP_SHELL, auch Dexie unter js/vendor/) - Offline-Start
// ohne Netzwerk-Abhängigkeit. Alles andere (insbesondere künftige
// Sync-Anfragen an den eigenen Server, s. "Sync & Infrastruktur" in
// architecture.md) läuft bewusst NICHT über diesen Handler und wird daher
// nie hier zwischengespeichert - ohne diese Einschränkung würde jede
// künftige Server-Antwort (potenziell mit echten Trainingsdaten)
// unkontrolliert im Browser-Cache landen, s. CHANGELOG.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (!APP_SHELL_URLS.has(event.request.url)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Nur tatsächlich erfolgreiche Antworten übernehmen, keine Fehlerantworten.
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
