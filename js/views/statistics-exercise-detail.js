// Übungs-Seite im Statistik-Tab (Tipp auf eine Übung im Reiter "Übungen").
// Eigenständiges Sub-View-Modul wie workout-exercise-detail.js (gleiches
// render()/paint()/wireEvents()-Muster, Kopfzeile mit Zurück-Pfeil, Reiter als
// Segmented Control), aber übungsbezogen statt auf einen Tages-Eintrag
// bezogen: Reiter "Statistik", "Verlauf" und "Info". Verlauf nutzt dieselbe
// Darstellung wie die Workout-Übungsseite (renderExerciseHistory), Info
// denselben Inhalt wie das Übungs-Detail-Sheet (renderExerciseInfo).
// statistics.js übergibt nur die Übungs-ID und einen onBack-Callback.
import { db, getExerciseSetHistory, getPRsForExercises, todayISODate } from '../db.js';
import { escapeHtml, renderSegmentedControl, renderRangeControl, positionSegmentedIndicator, measureSegmentedIndicatorRect, renderPRIcon, CARD } from '../utils.js';
import { computePersonalBests } from '../exerciseStats.js';
import { renderExerciseHistory } from './workout-exercise-detail.js';
import { renderExerciseInfo } from '../exerciseInfo.js';

let currentContainer = null;
let onBack = null;
const state = {
  exerciseId: null,
  activeTab: 'stats', // 'stats' | 'history' | 'info'
  // Zeitraum für ALLE Statistiken dieser Übung ('3m' | '1j' | 'max'), bleibt
  // beim Reiter-Wechsel erhalten, startet bei jedem Öffnen neu auf 3M
  range: '3m',
};

// Wie renderEpoch in workout-exercise-detail.js: verhindert, dass ein noch
// laufender paint() nach Zurück-Tap oder Tab-Wechsel einen fremden Container
// überschreibt.
let renderEpoch = 0;

export async function render(container, { exerciseId, onBack: onBackCallback }) {
  renderEpoch++;
  currentContainer = container;
  onBack = onBackCallback;
  state.exerciseId = exerciseId;
  state.activeTab = 'stats';
  state.range = '3m';
  await paint();
}

export function unmount() {
  renderEpoch++;
}

// Zwei Segmented Controls auf der Seite (Reiter + Zeitraum), jede in einem
// eigenen Wrapper (`#stat-detail-tabs`/`#stat-range-control`), s. statistics.js.
async function paint({ tabsFromRect = null, rangeFromRect = null } = {}) {
  const myEpoch = renderEpoch;
  const exercise = await db.exercises.get(state.exerciseId);
  if (myEpoch !== renderEpoch) return;
  if (!exercise) {
    // Übung wurde zwischenzeitlich gelöscht - zurück zur Liste
    onBack();
    return;
  }

  let tabHtml = '';
  if (state.activeTab === 'history') {
    const [history, prs] = await Promise.all([getExerciseSetHistory(exercise.id), getPRsForExercises([exercise.id])]);
    tabHtml = renderExerciseHistory(history, prs);
  } else if (state.activeTab === 'info') {
    tabHtml = renderExerciseInfo(exercise);
  } else {
    const history = await getExerciseSetHistory(exercise.id);
    const bests = computePersonalBests(history, state.range, todayISODate());
    tabHtml = `
      <div class="flex justify-end">${renderRangeControl('stat-range-control', state.range)}</div>
      ${renderPersonalBests(bests)}
    `;
  }
  if (myEpoch !== renderEpoch) return;

  currentContainer.innerHTML = `
    <div class="py-4 flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <button id="stat-detail-back-btn" type="button" class="icon-btn-glass tap-feedback text-ink" aria-label="Zurück">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 class="text-screen-title truncate">${escapeHtml(exercise.name)}</h1>
      </div>
      <div id="stat-detail-tabs">
        ${renderSegmentedControl(
          [
            { key: 'stats', label: 'Statistik' },
            { key: 'history', label: 'Verlauf' },
            { key: 'info', label: 'Info' },
          ],
          state.activeTab
        )}
      </div>
      ${tabHtml}
    </div>
  `;
  positionSegmentedIndicator(currentContainer.querySelector('#stat-detail-tabs'), { fromRect: tabsFromRect });
  positionSegmentedIndicator(currentContainer.querySelector('#stat-range-control'), { fromRect: rangeFromRect });
  wireEvents();
}

// --- Persönliche Bestwerte ---
//
// Tabelle nach Vorbild der Referenz-App: Überschrift links, Zeitraum rechts,
// darunter eine Karte mit je einer Zeile pro Wert (Icon-Kreis, Name, rechts
// Wert + Datum). 1RM bleibt vorerst leer ("–"), bis die Berechnung etabliert
// ist. Berechnung: js/exerciseStats.js (computePersonalBests).
const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"';
const BEST_ICONS = {
  oneRm: `<svg ${ICON_ATTRS}><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4" /></svg>`,
  // Gewicht und Reps: dieselben Formen wie die PR-Markierungen, als Outline
  weight: renderPRIcon('weight', { sizeClass: 'w-5 h-5', outline: true }),
  volume: `<svg ${ICON_ATTRS}><path d="M6 20v-8M12 20V5M18 20v-9" /></svg>`,
  reps: renderPRIcon('reps', { sizeClass: 'w-5 h-5', outline: true }),
};

const formatNumber = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });

// Das Jahr steht immer dabei (Nutzer-Vorgabe) - Zeiträume und Bestwerte
// können über Jahre zurückreichen.
function formatDate(dateStr, { weekday = false } = {}) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  if (weekday) options.weekday = 'short';
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', options);
}

function renderBestRow(icon, label, best, valueText) {
  const value = best
    ? `<span class="text-body text-ink">${valueText}</span>
       <span class="text-label uppercase text-muted">${escapeHtml(formatDate(best.date, { weekday: true }))}</span>`
    : `<span class="text-body text-muted">–</span>`;
  return `
    <div class="flex items-center gap-3 py-3 min-h-[56px]">
      <span class="w-10 h-10 rounded-full bg-white/[0.08] text-ink flex items-center justify-center flex-shrink-0" aria-hidden="true">${icon}</span>
      <span class="text-card-title flex-1 min-w-0 truncate">${label}</span>
      <span class="flex flex-col items-end gap-0.5 text-right">${value}</span>
    </div>
  `;
}

function renderPersonalBests(bests) {
  const periodLabel = bests.rangeStart ? `${formatDate(bests.rangeStart)} – ${formatDate(todayISODate())}` : '';
  const w = bests.weight;
  const v = bests.volume;
  const r = bests.reps;
  return `
    <div class="flex flex-col gap-2">
      <div class="flex items-baseline justify-between gap-3">
        <p class="text-label-large text-muted">Persönliche Bestwerte</p>
        <span class="text-label text-muted">${escapeHtml(periodLabel)}</span>
      </div>
      <div class="${CARD} !py-0 divide-y divide-divider">
        ${renderBestRow(BEST_ICONS.oneRm, '1RM', null, '')}
        ${renderBestRow(BEST_ICONS.weight, 'Gewicht', w, w ? `${formatNumber(w.weight)} kg <span class="text-muted">(x${w.reps})</span>` : '')}
        ${renderBestRow(BEST_ICONS.volume, 'Volumen', v, v ? `${formatNumber(v.volume)} kg` : '')}
        ${renderBestRow(BEST_ICONS.reps, 'Reps', r, r ? `${r.reps} Reps <span class="text-muted">(${formatNumber(r.weight)} kg)</span>` : '')}
      </div>
    </div>
  `;
}

function wireEvents() {
  currentContainer.querySelector('#stat-detail-back-btn')?.addEventListener('click', () => onBack());
  currentContainer.querySelectorAll('#stat-detail-tabs .segmented-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.activeTab === btn.dataset.tab) return;
      const fromRect = measureSegmentedIndicatorRect(currentContainer.querySelector('#stat-detail-tabs'));
      state.activeTab = btn.dataset.tab;
      paint({ tabsFromRect: fromRect });
    });
  });
  currentContainer.querySelectorAll('#stat-range-control .segmented-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.range === btn.dataset.tab) return;
      const fromRect = measureSegmentedIndicatorRect(currentContainer.querySelector('#stat-range-control'));
      state.range = btn.dataset.tab;
      paint({ rangeFromRect: fromRect });
    });
  });
}
