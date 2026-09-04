// Übungs-Detailseite (Abschnitt 12) - eigenständiges Sub-View-Modul,
// aufgerufen von workout.js statt in der App-weiten View-Registrierung
// (app.js). Folgt trotzdem demselben render()/paint()/wireEvents()-Muster
// wie die echten Views (exercises.js/routines.js), damit sie sich vollständig
// selbst verwaltet - workout.js übergibt nur die IDs plus einen
// onBack-Callback und mischt sich sonst nicht ein.
import { db, addSet, deleteSet, updateSet, getLastSetForExercise, getExerciseSetHistory, markWorkoutExerciseStarted } from '../db.js';
import { escapeHtml, renderSetTimelineRow } from '../utils.js';

// Anzahl standardmäßig angezeigter (leerer) Satz-Zeilen - bewusst als
// eigene Variable statt hart im Rendering verankert, Grundlage für eine
// spätere Einstellungsmöglichkeit im Profil-Tab (noch nicht gebaut, s.
// ADR 0010). Zeigt schon vorhandene Sätze werden nie abgeschnitten, nur bis
// zu dieser Anzahl mit leeren Platzhaltern aufgefüllt.
const DEFAULT_SET_COUNT = 3;

let currentContainer = null;
let onBack = null;
let state = {
  entryId: null,
  activeTab: 'today', // 'today' | 'history' | 'stats'
  selectedSetId: null,
};

export async function render(container, { entryId, onBack: onBackCallback }) {
  currentContainer = container;
  onBack = onBackCallback;
  state.entryId = entryId;
  state.activeTab = 'today';
  state.selectedSetId = null;
  await paint();
}

async function paint() {
  const entry = await db.workoutExercises.get(state.entryId);
  if (!entry) {
    // Eintrag existiert nicht mehr (z. B. Routine zwischenzeitlich
    // gewechselt) - kann hier nichts mehr anzeigen, zurück zur Übersicht.
    onBack();
    return;
  }

  const exercise = await db.exercises.get(entry.exerciseId);
  const exerciseName = exercise?.name ?? 'Gelöschte Übung';
  const workout = await db.workouts.get(entry.workoutId);
  const routineLabel = entry.sourceRoutineId
    ? ((await db.routines.get(entry.sourceRoutineId))?.name ?? 'Gelöschte Routine')
    : null;

  const todaySets = await db.sets.where({ workoutId: entry.workoutId, exerciseId: entry.exerciseId }).toArray();
  todaySets.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  let formWeight = '';
  let formReps = '';
  if (state.selectedSetId) {
    const selected = todaySets.find((s) => s.id === state.selectedSetId);
    if (selected) {
      formWeight = selected.weight;
      formReps = selected.reps;
    } else {
      state.selectedSetId = null;
    }
  }
  if (!state.selectedSetId) {
    // Vorbelegung mit dem zuletzt erfassten Wert dieser Übung, egal aus
    // welchem Workout-Tag - Progressive-Overload-Hilfe (s. Konzept Flow 3).
    const lastSet = await getLastSetForExercise(entry.exerciseId);
    formWeight = lastSet ? lastSet.weight : '';
    formReps = lastSet ? lastSet.reps : '';
  }

  const history = state.activeTab === 'history' ? await getExerciseSetHistory(entry.exerciseId, entry.workoutId) : [];

  currentContainer.innerHTML = `
    <div class="py-4 flex flex-col gap-4">
      ${renderHeader(exerciseName)}
      ${renderSegmentedControl(workout?.date)}
      ${state.activeTab === 'today' ? renderTodayTab(todaySets, formWeight, formReps, routineLabel) : ''}
      ${state.activeTab === 'history' ? renderHistoryTab(history) : ''}
      ${state.activeTab === 'stats' ? renderStatsTab() : ''}
    </div>
  `;

  wireEvents();
}

function renderHeader(exerciseName) {
  return `
    <div class="flex items-center gap-3">
      <button id="detail-back-btn" type="button" class="icon-btn-glass tap-feedback w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-ink" aria-label="Zurück">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <h1 class="text-screen-title truncate">${escapeHtml(exerciseName)}</h1>
    </div>
  `;
}

function formatShortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function renderSegmentedControl(workoutDate) {
  const tabs = [
    { key: 'today', label: workoutDate ? formatShortDate(workoutDate) : '' },
    { key: 'history', label: 'Verlauf' },
    { key: 'stats', label: 'Statistik' },
  ];

  return `
    <div class="bg-surface rounded-full p-1 flex gap-1">
      ${tabs
        .map(
          (t) => `
        <button data-tab="${t.key}" type="button" class="segmented-tab tap-feedback flex-1 rounded-full py-2 min-h-[36px] text-label font-medium ${state.activeTab === t.key ? 'bg-raised text-ink' : 'text-muted'}">${escapeHtml(t.label)}</button>
      `
        )
        .join('')}
    </div>
  `;
}

function renderStepperRow(field, label, value) {
  const inputMode = field === 'weight' ? 'decimal' : 'numeric';
  const step = field === 'weight' ? '0.5' : '1';

  return `
    <div class="flex flex-col items-center gap-2">
      <span class="text-label uppercase text-muted tracking-wide">${label}</span>
      <div class="flex items-center gap-2">
        <button data-stepper="${field}" data-delta="-1" type="button" class="stepper-btn tap-feedback w-9 h-9 rounded-full bg-base text-ink text-lg font-semibold flex items-center justify-center flex-shrink-0">−</button>
        <input id="detail-${field}-input" type="number" inputmode="${inputMode}" step="${step}" min="0" value="${value}" class="w-16 text-center bg-base rounded-btn py-2 text-ink" />
        <button data-stepper="${field}" data-delta="1" type="button" class="stepper-btn tap-feedback w-9 h-9 rounded-full bg-base text-ink text-lg font-semibold flex items-center justify-center flex-shrink-0">+</button>
      </div>
    </div>
  `;
}

// Inhalt einer Satz-Zeile in der getrennten Notation ("35 kg" / "10 Reps"
// statt "35 kg × 10", s. design-system.md Siebzehnte Iteration) - leere
// Platzhalter zeigen nur einen Gedankenstrich statt beider Werte. Die
// Auswahl-Hervorhebung selbst wird nicht hier, sondern über den
// `highlighted`-Parameter von renderSetTimelineRow() gezeichnet (eigenes,
// aus dem Layout-Fluss genommenes Element - s. dort für die Begründung).
function renderSetContent(set) {
  if (!set) return `<span class="text-muted">–</span>`;
  return `<span>${set.weight} kg</span><span>${set.reps} Reps</span>`;
}

function renderTodayTab(sets, formWeight, formReps, routineLabel) {
  const rowCount = Math.max(sets.length, DEFAULT_SET_COUNT);
  const rows = Array.from({ length: rowCount }, (_, i) => sets[i] ?? null);
  const editing = !!state.selectedSetId;

  return `
    <div class="flex flex-col gap-5">
      <div class="flex flex-col gap-4">
        <div class="flex items-start justify-between gap-4">
          ${renderStepperRow('weight', 'Gewicht (kg)', formWeight)}
          ${renderStepperRow('reps', 'Reps', formReps)}
        </div>
        <div class="flex gap-3">
          <button id="detail-save-btn" type="button" class="tap-feedback flex-1 bg-raised text-ink font-semibold rounded-btn py-3 min-h-[44px]">${editing ? 'Update' : 'Speichern'}</button>
          <button id="detail-delete-btn" type="button" ${editing ? '' : 'disabled'} class="tap-feedback flex-1 bg-raised text-ink font-semibold rounded-btn py-3 min-h-[44px] ${editing ? '' : 'opacity-40 pointer-events-none'}">Delete</button>
        </div>
        ${routineLabel ? `<p class="text-label text-muted uppercase tracking-wide">Routine: ${escapeHtml(routineLabel)}</p>` : ''}
      </div>

      <ul class="flex flex-col">
        ${rows
          .map((set, i) => {
            const isSelected = set && state.selectedSetId === set.id;
            // Kreis bleibt bei Auswahl unverändert (kein eigener grauer
            // Fond mehr) - die Auswahl wird ausschließlich über das
            // bildschirmbreite Hervorhebungs-Band (highlighted) angezeigt,
            // ein zusätzlich eingefärbter Kreis wirkte wie ein
            // überflüssiges zweites Element.
            return renderSetTimelineRow(i + 1, renderSetContent(set), {
              isLast: i === rows.length - 1,
              liClasses: set ? 'set-row' : 'empty-set-row',
              liAttrs: set ? `data-set="${set.id}"` : 'data-row-empty="true"',
              highlighted: isSelected,
            });
          })
          .join('')}
      </ul>
    </div>
  `;
}

function formatHistoryDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
}

function renderHistoryTab(history) {
  if (history.length === 0) {
    return `<p class="text-body text-muted text-center py-6">Noch kein Verlauf für diese Übung.</p>`;
  }

  return `
    <div class="flex flex-col gap-5">
      ${history
        .map(
          (day) => `
        <div>
          <h3 class="text-card-title mb-2">${escapeHtml(formatHistoryDate(day.date))}</h3>
          <ul class="flex flex-col">
            ${day.sets
              .map((s, i) =>
                renderSetTimelineRow(i + 1, renderSetContent(s), { isLast: i === day.sets.length - 1 })
              )
              .join('')}
          </ul>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function renderStatsTab() {
  return `<p class="text-body text-muted text-center py-12">Statistik folgt.</p>`;
}

function wireEvents() {
  currentContainer.querySelector('#detail-back-btn')?.addEventListener('click', () => {
    onBack();
  });

  currentContainer.querySelectorAll('.segmented-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.activeTab === btn.dataset.tab) return;
      state.activeTab = btn.dataset.tab;
      paint();
    });
  });

  currentContainer.querySelectorAll('.stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.stepper;
      const delta = Number(btn.dataset.delta);
      const input = currentContainer.querySelector(`#detail-${field}-input`);
      const current = parseFloat(input.value) || 0;
      const next = Math.max(0, current + delta);
      input.value = field === 'reps' ? Math.round(next) : next;
    });
  });

  currentContainer.querySelectorAll('.set-row').forEach((row) => {
    row.addEventListener('click', () => {
      state.selectedSetId = row.dataset.set;
      paint();
    });
  });

  currentContainer.querySelectorAll('.empty-set-row').forEach((row) => {
    row.addEventListener('click', () => {
      state.selectedSetId = null;
      paint();
    });
  });

  currentContainer.querySelector('#detail-save-btn')?.addEventListener('click', async () => {
    const weight = parseFloat(currentContainer.querySelector('#detail-weight-input').value);
    const reps = parseInt(currentContainer.querySelector('#detail-reps-input').value, 10);
    if (Number.isNaN(weight) || Number.isNaN(reps)) return;

    const entry = await db.workoutExercises.get(state.entryId);
    if (!entry) return;

    if (state.selectedSetId) {
      await updateSet(state.selectedSetId, weight, reps);
      state.selectedSetId = null;
    } else {
      await addSet(entry.workoutId, entry.exerciseId, weight, reps);
      await markWorkoutExerciseStarted(entry.workoutId, entry.exerciseId);
    }
    paint();
  });

  currentContainer.querySelector('#detail-delete-btn')?.addEventListener('click', async () => {
    if (!state.selectedSetId) return;
    // Bewusst ohne Bestätigungsdialog, auf Nutzer-Wunsch - abweichend von der
    // sonst geltenden Projekt-Konvention (Löschen sonst immer mit confirm()),
    // s. CLAUDE.md und ADR 0010.
    await deleteSet(state.selectedSetId);
    state.selectedSetId = null;
    paint();
  });
}
