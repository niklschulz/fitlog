import { db } from './db.js';
import * as workout from './views/workout.js';
import * as exercises from './views/exercises.js';
import * as routines from './views/routines.js';
import * as profile from './views/profile.js';

const views = { workout, exercises, routines, profile };

const viewContainer = document.getElementById('view-container');
const navButtons = document.querySelectorAll('.nav-btn');
const bottomNav = document.getElementById('bottom-nav');
const navIndicator = document.getElementById('nav-indicator');

let currentViewName = null;

// Gleitender Glas-Indikator hinter dem aktiven Tab (s. css/styles.css,
// #nav-indicator, und design-system.md "Liquid Glass"-Iteration). Position
// wird immer per getBoundingClientRect() der Ziel-Schaltfläche gemessen
// statt aus Index * Breite berechnet - robust gegenüber dem tatsächlichen
// Gap/Padding der Nav, statt eine gleichmäßige Aufteilung anzunehmen.
function indicatorTargetFor(btn) {
  const navRect = bottomNav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  return { left: btnRect.left - navRect.left, width: btnRect.width };
}

// Dauer/Kurve anhand einer echten Liquid-Glass-Bildschirmaufnahme (Referenz-
// App) frame-genau vermessen: Der komplette Übergang (erste sichtbare
// Bewegung bis vollständiges Einrasten) dauert dort nur ca. 100-130ms -
// spürbar knackiger als ursprünglich angenommen.
const NAV_INDICATOR_DURATION_MS = 170;

function moveNavIndicator(btn, { animate, onSettled }) {
  const target = indicatorTargetFor(btn);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!animate || reduceMotion) {
    navIndicator.style.left = `${target.left}px`;
    navIndicator.style.width = `${target.width}px`;
    onSettled?.();
    return;
  }

  const current = {
    left: parseFloat(navIndicator.style.left) || target.left,
    width: parseFloat(navIndicator.style.width) || target.width,
  };
  // Ziel-Position sofort als "echten" Stil setzen - die folgende
  // Web-Animations-API-Animation läuft standardmäßig mit `fill: 'none'`,
  // das Element fällt nach Animationsende also automatisch auf genau
  // diesen bereits gesetzten Zielwert zurück, ohne ihn separat fixieren
  // zu müssen.
  navIndicator.style.left = `${target.left}px`;
  navIndicator.style.width = `${target.width}px`;

  // "Morphen" statt reinem Verschieben (s. Recherche zu Apples Liquid
  // Glass: Material expandiert/schrumpft beim Übergang, statt sich nur zu
  // bewegen): Der Indikator zieht sich kurz breiter, bis er beide
  // Positionen überspannt, und schnappt dann auf die Zielbreite zurück -
  // ein einfacher, reiner CSS/WAAPI-Effekt ohne Animationsbibliothek.
  const stretchLeft = Math.min(current.left, target.left);
  const stretchWidth = Math.abs(target.left - current.left) + Math.max(current.width, target.width);

  navIndicator.animate(
    [
      { left: `${current.left}px`, width: `${current.width}px` },
      { left: `${stretchLeft}px`, width: `${stretchWidth}px`, offset: 0.55 },
      { left: `${target.left}px`, width: `${target.width}px` },
    ],
    { duration: NAV_INDICATOR_DURATION_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  );

  // Farbwechsel bewusst NICHT erst am Animationsende, sondern schon zur
  // Hälfte der Laufzeit (deckt sich mit dem Stretch-Höhepunkt bei 55%, s.
  // oben): Eine frame-genaue Auswertung derselben Bildschirmaufnahme zeigt,
  // dass in Echt kein Zustand existiert, in dem beide Tabs vollständig grün
  // sind - der Farbwechsel dort ist ein kurzer, anteiliger, an die Glasform
  // geklebter Wisch (< 1/5 der Animationsdauer). Ein per Clip-Maske exakt
  // nachgebauter Wisch wäre für diese sehr kurze Sichtbarkeit unverhältnismäßig
  // aufwendig - stattdessen ein früherer, harter Umschaltpunkt, der den in der
  // ersten Umsetzung als störend empfundenen ausgedehnten Doppel-Grün-Zustand
  // vermeidet, ohne die volle Maskierung nachzubauen.
  setTimeout(() => onSettled?.(), NAV_INDICATOR_DURATION_MS * 0.5);
}

function showView(name) {
  // Optionaler Aufräum-Hook: Views ohne eigenen globalen Zustand (Locks,
  // Timeouts, Listener außerhalb ihres eigenen Containers) brauchen kein
  // unmount() zu exportieren - nur workout.js tut das aktuell (Kalender-
  // Sheet-Body-Lock).
  if (currentViewName && currentViewName !== name) {
    views[currentViewName].unmount?.();
  }
  const isInitialRender = currentViewName === null;
  const previousActiveBtn = document.querySelector('.nav-btn.active');
  currentViewName = name;

  views[name].render(viewContainer);
  const activeBtn = Array.from(navButtons).find((btn) => btn.dataset.view === name);

  if (activeBtn) {
    // Neuer Tab wird sofort grün eingefärbt, der alte verliert seine Farbe
    // erst zur Hälfte der Indikator-Animation (onSettled-Callback unten),
    // nicht schon synchron beim Klick - vermeidet den harten Sprung, wirkt
    // aber bewusst NICHT den vollen Doppel-Grün-Zeitraum, der sich als
    // störend herausgestellt hat (s. moveNavIndicator() für die Begründung
    // des früheren Umschaltpunkts).
    activeBtn.classList.add('active');
    moveNavIndicator(activeBtn, {
      animate: !isInitialRender,
      onSettled: () => {
        if (previousActiveBtn && previousActiveBtn !== activeBtn) {
          previousActiveBtn.classList.remove('active');
        }
      },
    });
  }
  viewContainer.scrollTop = 0;
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// Fenstergröße kann sich ändern (z. B. Bildschirmdrehung) - Indikator ohne
// Animation neu ausrichten, kein "Nachziehen" bei einer reinen
// Layout-Anpassung.
window.addEventListener('resize', () => {
  const activeBtn = document.querySelector('.nav-btn.active');
  if (activeBtn) moveNavIndicator(activeBtn, { animate: false });
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
