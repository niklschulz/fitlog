import {
  db,
  deleteWorkout,
  finishWorkout,
  addSet,
  updateSet,
  deleteSet,
  getLastSetForExercise,
  createExercise,
} from '../db.js';
import { escapeHtml } from '../utils.js';

let currentContainer = null;
let state = emptyState();

function emptyState() {
  return {
    mode: 'list', // 'list' | 'detail'
    workoutId: null,
    editingSetId: null,
    addMode: null, // null | 'picker' | 'form'
    addExerciseId: null,
    addQuickAddOpen: false,
  };
}

export function render(container) {
  currentContainer = container;
  state = emptyState();
  paint();
}

async function paint() {
  currentContainer.innerHTML = state.mode === 'detail' ? await renderDetail() : await renderList();
  wireEvents();
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDuration(startedAt, finishedAt) {
  if (!finishedAt) return 'läuft';
  const minutes = Math.max(1, Math.round((new Date(finishedAt) - new Date(startedAt)) / 60000));
  return `${minutes} Min`;
}

// --- Liste ---

async function renderList() {
  const workouts = await db.workouts.orderBy('startedAt').reverse().toArray();
  const routines = await db.routines.toArray();
  const routineNameById = Object.fromEntries(routines.map((r) => [r.id, r.name]));
  const setCounts = await Promise.all(workouts.map((w) => db.sets.where('workoutId').equals(w.id).count()));

  return `
    <div class="py-4 flex flex-col gap-4">
      <h1 class="text-screen-title">Verlauf</h1>
      ${
        workouts.length === 0
          ? `<p class="text-body text-muted text-center py-12">Noch keine Trainings aufgezeichnet.</p>`
          : `<ul class="flex flex-col gap-2">
              ${workouts
                .map((w, i) => {
                  const routineLabel = w.routineId ? routineNameById[w.routineId] ?? 'Gelöschte Routine' : 'Ohne Routine';
                  const count = setCounts[i];
                  return `
                  <li>
                    <button data-id="${w.id}" class="workout-item tap-feedback w-full text-left bg-surface rounded-card px-4 py-3 min-h-[44px] flex flex-col gap-1">
                      <div class="flex items-center justify-between">
                        <span class="text-card-title">${formatDate(w.startedAt)}</span>
                        <span class="text-muted text-body">${formatDuration(w.startedAt, w.finishedAt)}</span>
                      </div>
                      <div class="flex items-center justify-between text-body text-muted">
                        <span>${escapeHtml(routineLabel)}</span>
                        <span>${count} ${count === 1 ? 'Satz' : 'Sätze'}</span>
                      </div>
                    </button>
                  </li>
                `;
                })
                .join('')}
            </ul>`
      }
    </div>
  `;
}

// --- Detailansicht ---

async function renderDetail() {
  const workout = await db.workouts.get(state.workoutId);
  if (!workout) {
    state = emptyState();
    return renderList();
  }

  const routine = workout.routineId ? await db.routines.get(workout.routineId) : null;
  const sets = await db.sets.where('workoutId').equals(state.workoutId).sortBy('createdAt');
  const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
  const exercisesForSets = await db.exercises.bulkGet(exerciseIds);
  const exerciseNameById = Object.fromEntries(exerciseIds.map((id, i) => [id, exercisesForSets[i]?.name ?? null]));
  const allExercises = await db.exercises.orderBy('name').toArray();

  const routineLabel = workout.routineId ? (routine ? routine.name : 'Gelöschte Routine') : 'Ohne Routine';

  return `
    <div class="py-4 flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <button id="back-to-list-btn" class="tap-feedback min-w-[44px] min-h-[44px] text-muted">←</button>
        <div class="flex-1">
          <h1 class="text-screen-title">${formatDate(workout.startedAt)}</h1>
          <p class="text-body text-muted">${escapeHtml(routineLabel)} · ${formatDuration(workout.startedAt, workout.finishedAt)}</p>
        </div>
      </div>

      ${
        !workout.finishedAt
          ? `<button id="finish-workout-btn" class="tap-feedback bg-accent text-base font-semibold rounded-btn py-3 min-h-[44px]">Training beenden</button>`
          : ''
      }

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="text-label text-muted uppercase">Sätze</h2>
          <button id="add-set-btn" class="tap-feedback text-accent font-semibold min-h-[44px] px-2">+ Satz hinzufügen</button>
        </div>

        ${await renderAddSection(allExercises)}

        ${
          sets.length === 0
            ? `<p class="text-body text-muted text-center py-6">Noch keine Sätze erfasst.</p>`
            : `<ul class="flex flex-col gap-2">${sets
                .map((s) => renderSetRow(s, exerciseNameById[s.exerciseId]))
                .join('')}</ul>`
        }
      </div>

      <button id="delete-workout-btn" class="tap-feedback text-red-400 text-body py-2 min-h-[44px] mt-2">
        Training löschen
      </button>
    </div>
  `;
}

function renderSetRow(set, exerciseName) {
  const label = exerciseName ?? 'Gelöschte Übung';

  if (state.editingSetId === set.id) {
    return `
      <li class="bg-surface rounded-card p-3 flex flex-col gap-2">
        <span class="text-card-title ${exerciseName ? '' : 'italic text-muted'}">${escapeHtml(label)}</span>
        <form data-set="${set.id}" class="edit-set-form flex gap-3 items-end">
          <div class="flex-1 flex flex-col gap-1">
            <label class="text-label text-muted">Gewicht (kg)</label>
            <input name="weight" type="number" inputmode="decimal" step="0.5" min="0" value="${set.weight}" class="w-full bg-base rounded-btn px-3 py-2 text-ink min-h-[44px]" required />
          </div>
          <div class="flex-1 flex flex-col gap-1">
            <label class="text-label text-muted">Wdh.</label>
            <input name="reps" type="number" inputmode="numeric" step="1" min="0" value="${set.reps}" class="w-full bg-base rounded-btn px-3 py-2 text-ink min-h-[44px]" required />
          </div>
          <button type="submit" class="tap-feedback bg-accent text-base font-semibold rounded-btn px-4 min-h-[44px]">✓</button>
        </form>
        <div class="flex gap-3">
          <button data-set="${set.id}" class="cancel-edit-set-btn tap-feedback text-muted text-body py-1 min-h-[44px]">Abbrechen</button>
          <button data-set="${set.id}" class="delete-set-btn tap-feedback text-red-400 text-body py-1 min-h-[44px]">Löschen</button>
        </div>
      </li>
    `;
  }

  return `
    <li data-set="${set.id}" class="set-row tap-feedback bg-surface rounded-btn px-4 py-3 min-h-[44px] flex items-center justify-between">
      <span class="text-body ${exerciseName ? '' : 'italic text-muted'}">${escapeHtml(label)} — ${set.weight} kg × ${set.reps}</span>
      <span class="text-muted" aria-hidden="true">✎</span>
    </li>
  `;
}

// --- "Satz hinzufügen"-Bereich (auch nachträglich zu abgeschlossenen Trainings) ---

async function renderAddSection(allExercises) {
  if (state.addMode === 'picker') {
    return `
      <div class="bg-surface rounded-card p-3 flex flex-col gap-2">
        ${
          allExercises.length === 0
            ? `<p class="text-body text-muted py-2">Keine Übungen vorhanden.</p>`
            : `<ul class="flex flex-col gap-1 max-h-48 overflow-y-auto">
                ${allExercises
                  .map(
                    (ex) => `
                  <li>
                    <button data-exercise="${ex.id}" class="pick-add-exercise-btn tap-feedback w-full text-left rounded-btn px-3 py-2 min-h-[44px] bg-base text-ink text-body">
                      ${escapeHtml(ex.name)}
                    </button>
                  </li>
                `
                  )
                  .join('')}
              </ul>`
        }
        ${
          state.addQuickAddOpen
            ? `<form id="quick-add-exercise-form" class="flex gap-2 pt-1">
                <input id="quick-add-exercise-name" name="name" type="text" autocomplete="off" placeholder="Name der Übung" class="flex-1 bg-base rounded-btn px-3 py-2 text-ink min-h-[44px]" required />
                <button type="submit" class="tap-feedback bg-accent text-base font-semibold rounded-btn px-4 min-h-[44px]">Anlegen</button>
              </form>`
            : `<button id="open-quick-add-btn" class="tap-feedback text-accent text-body font-medium py-2 min-h-[44px] text-left">+ Neue Übung anlegen</button>`
        }
        <button id="cancel-add-btn" class="tap-feedback text-muted text-body py-1 min-h-[44px] text-left">Abbrechen</button>
      </div>
    `;
  }

  if (state.addMode === 'form') {
    const exercise = allExercises.find((e) => e.id === state.addExerciseId) ?? (await db.exercises.get(state.addExerciseId));
    const lastSet = await getLastSetForExercise(state.addExerciseId);

    return `
      <form id="add-set-form" class="flex flex-col gap-3 bg-surface rounded-card p-4">
        <span class="text-card-title">${escapeHtml(exercise?.name ?? '')}</span>
        <div class="flex gap-3">
          <div class="flex-1 flex flex-col gap-1">
            <label class="text-label text-muted">Gewicht (kg)</label>
            <input name="weight" type="number" inputmode="decimal" step="0.5" min="0" value="${lastSet ? lastSet.weight : ''}" class="w-full bg-base rounded-btn px-3 py-3 text-ink min-h-[44px]" required />
          </div>
          <div class="flex-1 flex flex-col gap-1">
            <label class="text-label text-muted">Wiederholungen</label>
            <input name="reps" type="number" inputmode="numeric" step="1" min="0" value="${lastSet ? lastSet.reps : ''}" class="w-full bg-base rounded-btn px-3 py-3 text-ink min-h-[44px]" required />
          </div>
        </div>
        <div class="flex gap-3">
          <button type="submit" class="tap-feedback flex-1 bg-accent text-base font-bold rounded-btn py-3 min-h-[44px]">Satz speichern</button>
          <button type="button" id="cancel-add-btn" class="tap-feedback px-4 py-3 text-muted min-h-[44px]">Abbrechen</button>
        </div>
      </form>
    `;
  }

  return '';
}

// --- Events ---

function wireEvents() {
  currentContainer.querySelectorAll('.workout-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      state = { ...emptyState(), mode: 'detail', workoutId: btn.dataset.id };
      paint();
    });
  });

  currentContainer.querySelector('#back-to-list-btn')?.addEventListener('click', () => {
    state = emptyState();
    paint();
  });

  currentContainer.querySelector('#finish-workout-btn')?.addEventListener('click', async () => {
    await finishWorkout(state.workoutId);
    paint();
  });

  currentContainer.querySelector('#delete-workout-btn')?.addEventListener('click', async () => {
    if (!confirm('Training wirklich löschen? Alle erfassten Sätze werden mitgelöscht.')) return;
    await deleteWorkout(state.workoutId);
    state = emptyState();
    paint();
  });

  currentContainer.querySelector('#add-set-btn')?.addEventListener('click', () => {
    state.addMode = 'picker';
    paint();
  });

  currentContainer.querySelector('#cancel-add-btn')?.addEventListener('click', () => {
    state.addMode = null;
    state.addExerciseId = null;
    state.addQuickAddOpen = false;
    paint();
  });

  currentContainer.querySelectorAll('.pick-add-exercise-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.addExerciseId = btn.dataset.exercise;
      state.addMode = 'form';
      state.addQuickAddOpen = false;
      paint();
    });
  });

  currentContainer.querySelector('#open-quick-add-btn')?.addEventListener('click', () => {
    state.addQuickAddOpen = true;
    paint();
  });

  currentContainer.querySelector('#quick-add-exercise-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    if (!name) return;
    const exercise = await createExercise(name);
    state.addExerciseId = exercise.id;
    state.addMode = 'form';
    state.addQuickAddOpen = false;
    paint();
  });

  currentContainer.querySelector('#add-set-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const weight = parseFloat(e.target.elements.weight.value);
    const reps = parseInt(e.target.elements.reps.value, 10);
    if (Number.isNaN(weight) || Number.isNaN(reps)) return;
    await addSet(state.workoutId, state.addExerciseId, weight, reps);
    state.addMode = null;
    state.addExerciseId = null;
    paint();
  });

  currentContainer.querySelectorAll('.set-row').forEach((row) => {
    row.addEventListener('click', () => {
      state.editingSetId = row.dataset.set;
      paint();
    });
  });

  currentContainer.querySelectorAll('.edit-set-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const weight = parseFloat(e.target.elements.weight.value);
      const reps = parseInt(e.target.elements.reps.value, 10);
      if (Number.isNaN(weight) || Number.isNaN(reps)) return;
      await updateSet(form.dataset.set, { weight, reps });
      state.editingSetId = null;
      paint();
    });
  });

  currentContainer.querySelectorAll('.cancel-edit-set-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.editingSetId = null;
      paint();
    });
  });

  currentContainer.querySelectorAll('.delete-set-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Satz wirklich löschen?')) return;
      await deleteSet(btn.dataset.set);
      state.editingSetId = null;
      paint();
    });
  });
}
