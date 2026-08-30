import { db } from './db.js';
import * as workout from './views/workout.js';
import * as exercises from './views/exercises.js';
import * as routines from './views/routines.js';
import * as profile from './views/profile.js';

const views = { workout, exercises, routines, profile };

const viewContainer = document.getElementById('view-container');
const navButtons = document.querySelectorAll('.nav-btn');

function showView(name) {
  views[name].render(viewContainer);
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
  viewContainer.scrollTop = 0;
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

db.open()
  .then(() => showView('workout'))
  .catch((err) => {
    console.error('Fitlog: IndexedDB konnte nicht geöffnet werden', err);
    viewContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center gap-2 py-16">
        <p class="text-red-400 font-semibold">Datenbank konnte nicht geöffnet werden.</p>
        <p class="text-muted text-body">${err.message ?? err}</p>
      </div>
    `;
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        // iOS-Standalone-PWAs prüfen von sich aus viel seltener auf Updates
        // als ein normaler Safari-Tab – bei jedem Start explizit erzwingen.
        registration.update();
      })
      .catch((err) => {
        console.error('Fitlog: Service Worker Registrierung fehlgeschlagen', err);
      });
  });

  // Wird der Tab/die App wieder sichtbar (z. B. aus dem Hintergrund geholt),
  // ebenfalls auf ein Update prüfen.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then((registration) => registration?.update());
    }
  });

  // Sobald ein neuer Service Worker aktiv wird (dank skipWaiting +
  // clients.claim in sw.js passiert das automatisch), einmalig neu laden,
  // damit die neue Version sofort sichtbar ist statt erst beim übernächsten
  // App-Start.
  let refreshingAfterUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingAfterUpdate) return;
    refreshingAfterUpdate = true;
    window.location.reload();
  });
}
