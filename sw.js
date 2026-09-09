// App-Shell-Caching für vollständige Offline-Nutzung (s. Konzept Abschnitt 6).
// Cache-Name bei Änderungen an der Datei-Liste hochzählen, damit Clients aktualisieren.
const CACHE_NAME = 'fitlog-v99';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/sheet.js',
  './js/utils.js',
  './js/profile.js',
  './js/views/workout.js',
  './js/views/workout-exercise-detail.js',
  './js/views/exercises.js',
  './js/views/routines.js',
  './js/views/profile.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// Zur Laufzeit aufgelöste, vollständige URLs der App-Shell - der fetch-
// Handler unten bekommt echte, bereits aufgelöste Request-URLs von der
// Browser-API, keine relativen Pfade wie in APP_SHELL oben.
const APP_SHELL_URLS = new Set(APP_SHELL.map((path) => new URL(path, self.location.href).href));

// Cross-Origin-CDN-Skripte liefern keine Access-Control-Allow-Origin-Header,
// daher scheitert cache.addAll (cors-Modus) daran. Einzeln im no-cors-Modus
// cachen und als opaque Response ablegen - fürs Ausführen als <script src> reicht das.
const CDN_SHELL = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js',
];
const CDN_SHELL_URLS = new Set(CDN_SHELL);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // cache.addAll() macht normale fetch()-Aufrufe, die dem Browser-eigenen
      // HTTP-Cache unterliegen - ohne cache:'reload' könnte ein Update sonst
      // stellenweise veraltete Dateien aus dem HTTP-Cache übernehmen, statt
      // wirklich alles frisch vom Server zu holen.
      const requests = APP_SHELL.map((url) => new Request(url, { cache: 'reload' }));
      await cache.addAll(requests);
      await Promise.all(
        CDN_SHELL.map((url) =>
          fetch(url, { mode: 'no-cors', cache: 'reload' })
            .then((response) => cache.put(url, response))
            .catch((err) => console.error('Fitlog SW: CDN-Precache fehlgeschlagen', url, err))
        )
      );
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

// Cache-first, aber ausschließlich für die bekannte App-Shell (lokale
// Dateien oben in APP_SHELL sowie die beiden CDN-Skripte) - Offline-Start
// ohne Netzwerk-Abhängigkeit. Alles andere (insbesondere künftige
// Sync-Anfragen an den eigenen Server, s. "Sync & Infrastruktur" in
// architecture.md) läuft bewusst NICHT über diesen Handler und wird daher
// nie hier zwischengespeichert - ohne diese Einschränkung würde jede
// künftige Server-Antwort (potenziell mit echten Trainingsdaten)
// unkontrolliert im Browser-Cache landen, s. CHANGELOG.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isAppShellRequest = APP_SHELL_URLS.has(event.request.url);
  const isCdnShellRequest = CDN_SHELL_URLS.has(event.request.url);
  if (!isAppShellRequest && !isCdnShellRequest) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cross-Origin-CDN-Antworten sind wegen mode:'no-cors' immer opaque
        // (response.ok === false, unabhängig vom tatsächlichen Erfolg) -
        // trotzdem cachen, wie schon beim Install-Precache oben. Bei
        // eigenen App-Shell-Dateien dagegen nur tatsächlich erfolgreiche
        // Antworten übernehmen, keine Fehlerantworten.
        if (isCdnShellRequest || response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
