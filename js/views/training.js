import {
  db,
  startWorkout,
  finishWorkout,
  addSet,
  deleteSet,
  getLastSetForExercise,
  createExercise,
  getRoutineExercises,
} from '../db.js';
import { escapeHtml } from '../utils.js';

let currentContainer = null;
let state = emptyState();

function emptyState() {
  return { mode: 'idle', workoutId: null, selectedExerciseId: null, pickerOpen: false, quickAddOpen: false };
}

// Einstiegspunkt (vom Router aufgerufen): prüft, ob bereits ein Training
// läuft (finishedAt === null) und stellt diesen Zustand wieder her, falls
// die App zwischendurch verlassen/neu geladen wurde.
export async function render(container) {
  currentContainer = container;
  const active = await db.workouts.filter((w) => w.finishedAt === null).first();

  if (active && state.workoutId === active.id) {
    state.mode = 'active';
  } else if (active) {
    state = { ...emptyState(), mode: 'active', workoutId: active.id };
  } else {
    state = emptyState();
  }

  await paint();
}

async function paint() {
  currentContainer.innerHTML = state.mode === 'active' ? await renderActive() : await renderIdle();
  wireEvents();
}

// --- Idle: Training starten ---

async function renderIdle() {
  const routines = await db.routines.orderBy('name').toArray();

  return `
    <div class="py-4 flex flex-col gap-6">
      <h1 class="text-2xl font-bold">Training</h1>

      <button id="start-no-routine-btn" class="tap-feedback bg-accent text-bg font-bold rounded-lg py-4 text-lg min-h-[44px]">
        Training starten
      </button>

      ${
        routines.length > 0
          ? `<div class="flex flex-col gap-2">
              <h2 class="text-sm text-white/60 uppercase tracking-wide">Oder mit Routine starten</h2>
              <ul class="flex flex-col gap-2">
                ${routines
                  .map(
                    (r) => `
                  <li>
                    <button data-routine="${r.id}" class="start-with-routine-btn tap-feedback w-full text-left bg-surface rounded-lg px-4 py-3 min-h-[44px]">
                      ${escapeHtml(r.name)}
                    </button>
                  </li>
                `
                  )
                  .join('')}
              </ul>
            </div>`
          : ''
      }
    </div>
  `;
}

// --- Active: Sätze eintragen ---

async function renderActive() {
  const workout = await db.workouts.get(state.workoutId);
  const routine = workout.routineId ? await db.routines.get(workout.routineId) : null;

  const routineEntries = routine ? await getRoutineExercises(routine.id) : [];
  const routineExercises = routine
    ? (await db.exercises.bulkGet(routineEntries.map((e) => e.exerciseId))).filter(Boolean)
    : [];
  const routineExerciseIds = new Set(routineExercises.map((e) => e.id));

  const allExercises = await db.exercises.orderBy('name').toArray();
  const otherExercises = allExercises.filter((e) => !routineExerciseIds.has(e.id));
  const exerciseNameById = Object.fromEntries(allExercises.map((e) => [e.id, e.name]));

  const sets = await db.sets.where('workoutId').equals(state.workoutId).toArray();
  sets.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const lastSet = state.selectedExerciseId ? await getLastSetForExercise(state.selectedExerciseId) : null;

  return `
    <div class="py-4 flex flex-col gap-4">
      <h1 class="text-2xl font-bold">Training läuft</h1>

      ${renderExercisePicker(routineExercises, otherExercises)}

      ${state.selectedExerciseId ? renderSetForm(exerciseNameById[state.selectedExerciseId], lastSet) : ''}

      <div class="flex flex-col gap-2">
        <h2 class="text-sm text-white/60 uppercase tracking-wide">Erfasste Sätze (${sets.length})</h2>
        ${
          sets.length === 0
            ? `<p class="text-white/60 text-center py-6">Noch keine Sätze erfasst.</p>`
            : `<ul class="flex flex-col gap-2">
                ${sets
                  .map(
                    (s) => `
                  <li class="bg-surface rounded-lg px-4 py-2 flex items-center justify-between">
                    <span>${escapeHtml(exerciseNameById[s.exerciseId] ?? 'Gelöschte Übung')} — ${s.weight} kg × ${s.reps}</span>
                    <button data-set="${s.id}" class="delete-set-btn tap-feedback min-w-[44px] min-h-[44px] text-red-400">✕</button>
                  </li>
                `
                  )
                  .join('')}
              </ul>`
        }
      </div>

      <button id="finish-workout-btn" class="tap-feedback bg-white/10 text-white font-semibold rounded-lg py-3 min-h-[44px] mt-2">
        Training beenden
      </button>
    </div>
  `;
}

function renderExercisePicker(routineExercises, otherExercises) {
  const chips = routineExercises
    .map(
      (ex) => `
      <button data-exercise="${ex.id}" class="exercise-chip tap-feedback rounded-full px-4 py-2 min-h-[44px] text-sm font-medium ${
        state.selectedExerciseId === ex.id ? 'bg-accent text-bg' : 'bg-surface text-white'
      }">
        ${escapeHtml(ex.name)}
      </button>
    `
    )
    .join('');

  return `
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap gap-2">
        ${chips}
        <button id="toggle-picker-btn" class="tap-feedback rounded-full px-4 py-2 min-h-[44px] text-sm font-medium bg-surface text-accent">
          ${state.pickerOpen ? 'Weitere Übungen ausblenden' : '+ Weitere Übung'}
        </button>
      </div>

      ${state.pickerOpen ? renderFullPicker(otherExercises) : ''}
    </div>
  `;
}

function renderFullPicker(otherExercises) {
  return `
    <div class="bg-surface rounded-lg p-3 flex flex-col gap-2">
      ${
        otherExercises.length === 0
          ? `<p class="text-white/60 text-sm py-2">Keine weiteren Übungen vorhanden.</p>`
          : `<ul class="flex flex-col gap-1 max-h-48 overflow-y-auto">
              ${otherExercises
                .map(
                  (ex) => `
                <li>
                  <button data-exercise="${ex.id}" class="exercise-chip tap-feedback w-full text-left rounded-lg px-3 py-2 min-h-[44px] ${
                    state.selectedExerciseId === ex.id ? 'bg-accent text-bg' : 'bg-bg text-white'
                  }">
                    ${escapeHtml(ex.name)}
                  </button>
                </li>
              `
                )
                .join('')}
            </ul>`
      }

      ${
        state.quickAddOpen
          ? `<form id="quick-add-exercise-form" class="flex gap-2 pt-2 border-t border-white/10">
              <input id="quick-add-exercise-name" name="name" type="text" autocomplete="off" placeholder="Name der Übung" class="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-2 text-white min-h-[44px]" required />
              <button type="submit" class="tap-feedback bg-accent text-bg font-semibold rounded-lg px-4 min-h-[44px]">Anlegen</button>
            </form>`
          : `<button id="open-quick-add-btn" class="tap-feedback text-accent text-sm font-medium py-2 min-h-[44px] text-left">+ Neue Übung anlegen</button>`
      }
    </div>
  `;
}

function renderSetForm(exerciseName, lastSet) {
  const weight = lastSet ? lastSet.weight : '';
  const reps = lastSet ? lastSet.reps : '';

  return `
    <form id="set-form" class="flex flex-col gap-3 bg-surface rounded-lg p-4">
      <span class="font-semibold">${escapeHtml(exerciseName)}</span>
      <div class="flex gap-3">
        <div class="flex-1 flex flex-col gap-1">
          <label class="text-sm text-white/60" for="set-weight">Gewicht (kg)</label>
          <input id="set-weight" name="weight" type="number" inputmode="decimal" step="0.5" min="0" value="${weight}" class="w-full bg-bg border border-white/10 rounded-lg px-3 py-3 text-white text-lg min-h-[44px]" required />
        </div>
        <div class="flex-1 flex flex-col gap-1">
          <label class="text-sm text-white/60" for="set-reps">Wiederholungen</label>
          <input id="set-reps" name="reps" type="number" inputmode="numeric" step="1" min="0" value="${reps}" class="w-full bg-bg border border-white/10 rounded-lg px-3 py-3 text-white text-lg min-h-[44px]" required />
        </div>
      </div>
      <button type="submit" class="tap-feedback bg-accent text-bg font-bold rounded-lg py-3 text-lg min-h-[44px]">
        Satz speichern
      </button>
    </form>
  `;
}

// --- Events ---

function wireEvents() {
  currentContainer.querySelector('#start-no-routine-btn')?.addEventListener('click', () => startAndShow(null));

  currentContainer.querySelectorAll('.start-with-routine-btn').forEach((btn) => {
    btn.addEventListener('click', () => startAndShow(btn.dataset.routine));
  });

  currentContainer.querySelectorAll('.exercise-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedExerciseId = btn.dataset.exercise;
      state.pickerOpen = false;
      state.quickAddOpen = false;
      paint();
    });
  });

  currentContainer.querySelector('#toggle-picker-btn')?.addEventListener('click', () => {
    state.pickerOpen = !state.pickerOpen;
    if (!state.pickerOpen) state.quickAddOpen = false;
    paint();
  });

  currentContainer.querySelector('#open-quick-add-btn')?.addEventListener('click', () => {
    state.quickAddOpen = true;
    paint();
  });

  currentContainer.querySelector('#quick-add-exercise-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    if (!name) return;
    const exercise = await createExercise(name);
    state.selectedExerciseId = exercise.id;
    state.pickerOpen = false;
    state.quickAddOpen = false;
    paint();
  });

  currentContainer.querySelector('#set-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const weight = parseFloat(e.target.elements.weight.value);
    const reps = parseInt(e.target.elements.reps.value, 10);
    if (Number.isNaN(weight) || Number.isNaN(reps)) return;
    await addSet(state.workoutId, state.selectedExerciseId, weight, reps);
    paint();
  });

  currentContainer.querySelectorAll('.delete-set-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteSet(btn.dataset.set);
      paint();
    });
  });

  currentContainer.querySelector('#finish-workout-btn')?.addEventListener('click', async () => {
    await finishWorkout(state.workoutId);
    state = emptyState();
    paint();
  });
}

async function startAndShow(routineId) {
  const workout = await startWorkout(routineId);
  let selectedExerciseId = null;
  if (routineId) {
    const entries = await getRoutineExercises(routineId);
    if (entries.length > 0) selectedExerciseId = entries[0].exerciseId;
  }
  state = { mode: 'active', workoutId: workout.id, selectedExerciseId, pickerOpen: false, quickAddOpen: false };
  paint();
}
