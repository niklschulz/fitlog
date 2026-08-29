import { db } from './db.js';
import * as home from './views/home.js';
import * as training from './views/training.js';
import * as exercises from './views/exercises.js';
import * as routines from './views/routines.js';
import * as history from './views/history.js';

const views = { home, training, exercises, routines, history };

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
  .then(() => showView('home'))
  .catch((err) => {
    console.error('Fitlog: IndexedDB konnte nicht geöffnet werden', err);
    viewContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center gap-2 py-16">
        <p class="text-red-400 font-semibold">Datenbank konnte nicht geöffnet werden.</p>
        <p class="text-white/60 text-sm">${err.message ?? err}</p>
      </div>
    `;
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.error('Fitlog: Service Worker Registrierung fehlgeschlagen', err);
    });
  });
}
