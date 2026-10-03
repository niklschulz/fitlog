// Übungs-Seite im Statistik-Tab (Tipp auf eine Übung im Reiter "Übungen").
// Eigenständiges Sub-View-Modul wie workout-exercise-detail.js (gleiches
// render()/paint()/wireEvents()-Muster, Kopfzeile mit Zurück-Pfeil, Reiter als
// Segmented Control), aber übungsbezogen statt auf einen Tages-Eintrag
// bezogen: Reiter "Statistik", "Verlauf" und "Info". Verlauf nutzt dieselbe
// Darstellung wie die Workout-Übungsseite (renderExerciseHistory), Info
// denselben Inhalt wie das Übungs-Detail-Sheet (renderExerciseInfo).
// statistics.js übergibt nur die Übungs-ID und einen onBack-Callback.
import { db, getExerciseSetHistory, getPRsForExercises } from '../db.js';
import { escapeHtml, renderSegmentedControl, positionSegmentedIndicator, measureSegmentedIndicatorRect } from '../utils.js';
import { renderExerciseHistory } from './workout-exercise-detail.js';
import { renderExerciseInfo } from '../exerciseInfo.js';

let currentContainer = null;
let onBack = null;
const state = {
  exerciseId: null,
  activeTab: 'stats', // 'stats' | 'history' | 'info'
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
  await paint();
}

export function unmount() {
  renderEpoch++;
}

async function paint(indicatorFromRect = null) {
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
    tabHtml = `<p class="text-body text-muted text-center py-12">Statistik folgt.</p>`;
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
      ${renderSegmentedControl(
        [
          { key: 'stats', label: 'Statistik' },
          { key: 'history', label: 'Verlauf' },
          { key: 'info', label: 'Info' },
        ],
        state.activeTab
      )}
      ${tabHtml}
    </div>
  `;
  positionSegmentedIndicator(currentContainer, { fromRect: indicatorFromRect });
  wireEvents();
}

function wireEvents() {
  currentContainer.querySelector('#stat-detail-back-btn')?.addEventListener('click', () => onBack());
  currentContainer.querySelectorAll('.segmented-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.activeTab === btn.dataset.tab) return;
      const fromRect = measureSegmentedIndicatorRect(currentContainer);
      state.activeTab = btn.dataset.tab;
      paint(fromRect);
    });
  });
}
