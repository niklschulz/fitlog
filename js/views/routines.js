import {
  db,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  getRoutineExercises,
  appendExerciseToRoutine,
  removeExerciseFromRoutine,
  reorderRoutineExercise,
} from '../db.js';
import { escapeHtml } from '../utils.js';

let currentContainer = null;
// mode: 'list' | 'name-form' | 'editor' | 'picker'
let state = { mode: 'list', routineId: null };

export function render(container) {
  currentContainer = container;
  state = { mode: 'list', routineId: null };
  paint();
}

async function paint() {
  switch (state.mode) {
    case 'name-form':
      currentContainer.innerHTML = renderNameForm();
      break;
    case 'editor':
      currentContainer.innerHTML = await renderEditor();
      break;
    case 'picker':
      currentContainer.innerHTML = await renderPicker();
      break;
    default:
      currentContainer.innerHTML = await renderList();
  }
  wireEvents();
}

// --- Liste ---

async function renderList() {
  const list = await db.routines.orderBy('name').toArray();
  const counts = await Promise.all(
    list.map((r) => db.routineExercises.where('routineId').equals(r.id).count())
  );

  return `
    <div class="py-4 flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-screen-title">Routinen</h1>
        <button id="add-routine-btn" class="tap-feedback bg-accent text-base font-semibold rounded-btn px-4 py-2 min-h-[44px]">
          + Neue Routine
        </button>
      </div>

      ${
        list.length === 0
          ? `<p class="text-body text-muted text-center py-12">Noch keine Routinen angelegt.</p>`
          : `<ul class="flex flex-col gap-2">
              ${list
                .map(
                  (r, i) => `
                <li>
                  <button data-id="${r.id}" class="routine-item tap-feedback w-full text-left bg-surface rounded-btn px-4 py-3 min-h-[44px] flex items-center justify-between">
                    <span class="text-card-title">${escapeHtml(r.name)}</span>
                    <span class="text-muted text-body">${counts[i]} Übung${counts[i] === 1 ? '' : 'en'}</span>
                  </button>
                </li>
              `
                )
                .join('')}
            </ul>`
      }
    </div>
  `;
}

// --- Name-Formular (Neuanlage) ---

function renderNameForm() {
  return `
    <div class="py-4 flex flex-col gap-4">
      <h1 class="text-screen-title">Neue Routine</h1>
      <form id="routine-name-form" class="flex flex-col gap-3 bg-surface rounded-card p-4">
        <label class="text-label text-muted" for="routine-name">Name</label>
        <input
          id="routine-name"
          name="name"
          type="text"
          autocomplete="off"
          placeholder="z. B. Push Day"
          class="bg-base rounded-btn px-3 py-3 text-ink min-h-[44px]"
          required
        />
        <div class="flex gap-3">
          <button type="submit" class="tap-feedback flex-1 bg-accent text-base font-semibold rounded-btn py-3 min-h-[44px]">
            Weiter
          </button>
          <button type="button" id="cancel-routine-btn" class="tap-feedback px-4 py-3 text-muted min-h-[44px]">
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  `;
}

// --- Editor (Name + Übungsliste) ---

async function renderEditor() {
  const routine = await db.routines.get(state.routineId);
  if (!routine) {
    state = { mode: 'list', routineId: null };
    return renderList();
  }

  const entries = await getRoutineExercises(routine.id);
  const exercises = await db.exercises.bulkGet(entries.map((e) => e.exerciseId));

  const rows = entries
    .map((entry, i) => {
      const exercise = exercises[i];
      const label = exercise ? escapeHtml(exercise.name) : 'Gelöschte Übung';
      return `
        <li class="bg-surface rounded-btn px-3 py-2 flex items-center gap-2">
          <span class="flex-1 text-body ${exercise ? '' : 'text-muted italic'}">${label}</span>
          <button data-entry="${entry.id}" data-dir="up" class="reorder-btn tap-feedback min-w-[44px] min-h-[44px] text-muted disabled:opacity-20" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button data-entry="${entry.id}" data-dir="down" class="reorder-btn tap-feedback min-w-[44px] min-h-[44px] text-muted disabled:opacity-20" ${i === entries.length - 1 ? 'disabled' : ''}>▼</button>
          <button data-entry="${entry.id}" class="remove-entry-btn tap-feedback min-w-[44px] min-h-[44px] text-red-400">✕</button>
        </li>
      `;
    })
    .join('');

  return `
    <div class="py-4 flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <button id="back-to-list-btn" class="tap-feedback min-w-[44px] min-h-[44px] text-muted">←</button>
        <h1 class="text-screen-title flex-1 truncate">${escapeHtml(routine.name)}</h1>
      </div>

      <form id="rename-routine-form" class="flex gap-3">
        <input
          id="routine-rename-input"
          name="name"
          type="text"
          autocomplete="off"
          value="${escapeHtml(routine.name)}"
          class="flex-1 bg-surface rounded-btn px-3 py-3 text-ink min-h-[44px]"
          required
        />
        <button type="submit" class="tap-feedback bg-accent text-base font-semibold rounded-btn px-4 min-h-[44px]">
          Speichern
        </button>
      </form>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="text-label text-muted uppercase">Übungen</h2>
          <button id="add-exercise-to-routine-btn" class="tap-feedback text-accent font-semibold min-h-[44px] px-2">
            + Übung hinzufügen
          </button>
        </div>
        ${
          entries.length === 0
            ? `<p class="text-body text-muted text-center py-8">Noch keine Übungen in dieser Routine.</p>`
            : `<ul class="flex flex-col gap-2">${rows}</ul>`
        }
      </div>

      <button id="delete-routine-btn" class="tap-feedback text-red-400 text-body py-2 min-h-[44px] mt-4">
        Routine löschen
      </button>
    </div>
  `;
}

// --- Übungs-Picker ---

async function renderPicker() {
  const routine = await db.routines.get(state.routineId);
  const entries = await getRoutineExercises(state.routineId);
  const usedIds = new Set(entries.map((e) => e.exerciseId));
  const allExercises = await db.exercises.orderBy('name').toArray();
  const available = allExercises.filter((e) => !usedIds.has(e.id));

  return `
    <div class="py-4 flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <button id="back-to-editor-btn" class="tap-feedback min-w-[44px] min-h-[44px] text-muted">←</button>
        <h1 class="text-screen-title flex-1 truncate">Übung hinzufügen</h1>
      </div>

      ${
        allExercises.length === 0
          ? `<p class="text-body text-muted text-center py-12">Es gibt noch keine Übungen. Lege zuerst welche im Tab "Übungen" an.</p>`
          : available.length === 0
            ? `<p class="text-body text-muted text-center py-12">Alle vorhandenen Übungen sind bereits Teil dieser Routine.</p>`
            : `<ul class="flex flex-col gap-2">
                ${available
                  .map(
                    (ex) => `
                  <li>
                    <button data-id="${ex.id}" class="pick-exercise-btn tap-feedback w-full text-left bg-surface rounded-btn px-4 py-3 min-h-[44px] text-card-title">
                      ${escapeHtml(ex.name)}
                    </button>
                  </li>
                `
                  )
                  .join('')}
              </ul>`
      }
    </div>
  `;
}

// --- Events ---

function wireEvents() {
  currentContainer.querySelector('#add-routine-btn')?.addEventListener('click', () => {
    state = { mode: 'name-form', routineId: null };
    paint();
  });

  currentContainer.querySelectorAll('.routine-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      state = { mode: 'editor', routineId: btn.dataset.id };
      paint();
    });
  });

  currentContainer.querySelector('#cancel-routine-btn')?.addEventListener('click', () => {
    state = { mode: 'list', routineId: null };
    paint();
  });

  currentContainer.querySelector('#routine-name-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    if (!name) return;
    const routine = await createRoutine(name);
    state = { mode: 'editor', routineId: routine.id };
    paint();
  });

  currentContainer.querySelector('#back-to-list-btn')?.addEventListener('click', () => {
    state = { mode: 'list', routineId: null };
    paint();
  });

  currentContainer.querySelector('#back-to-editor-btn')?.addEventListener('click', () => {
    state = { mode: 'editor', routineId: state.routineId };
    paint();
  });

  currentContainer.querySelector('#rename-routine-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    if (!name) return;
    await updateRoutine(state.routineId, name);
    paint();
  });

  currentContainer.querySelector('#add-exercise-to-routine-btn')?.addEventListener('click', () => {
    state = { mode: 'picker', routineId: state.routineId };
    paint();
  });

  currentContainer.querySelectorAll('.pick-exercise-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await appendExerciseToRoutine(state.routineId, btn.dataset.id);
      state = { mode: 'editor', routineId: state.routineId };
      paint();
    });
  });

  currentContainer.querySelectorAll('.reorder-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await reorderRoutineExercise(state.routineId, btn.dataset.entry, btn.dataset.dir);
      paint();
    });
  });

  currentContainer.querySelectorAll('.remove-entry-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await removeExerciseFromRoutine(btn.dataset.entry);
      paint();
    });
  });

  currentContainer.querySelector('#delete-routine-btn')?.addEventListener('click', async () => {
    if (!confirm('Routine wirklich löschen? Trainings, die auf ihr basierten, bleiben im Verlauf erhalten.')) {
      return;
    }
    await deleteRoutine(state.routineId);
    state = { mode: 'list', routineId: null };
    paint();
  });
}
