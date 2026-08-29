import { db, createExercise, updateExercise, deleteExercise } from '../db.js';
import { escapeHtml } from '../utils.js';

let currentContainer = null;
let editingId = null; // null = Liste, 'new' = Übung anlegen, <id> = Übung bearbeiten

export function render(container) {
  currentContainer = container;
  editingId = null;
  paint();
}

async function paint() {
  const list = await db.exercises.orderBy('name').toArray();

  currentContainer.innerHTML = `
    <div class="py-4 flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-bold">Übungen</h1>
        ${
          editingId === null
            ? `<button id="add-exercise-btn" class="tap-feedback bg-accent text-bg font-semibold rounded-lg px-4 py-2 min-h-[44px]">
                + Neue Übung
              </button>`
            : ''
        }
      </div>

      ${editingId !== null ? renderForm(list) : renderList(list)}
    </div>
  `;

  wireEvents();
}

function renderForm(list) {
  const editing = editingId !== 'new' ? list.find((e) => e.id === editingId) : null;
  const name = editing ? editing.name : '';

  return `
    <form id="exercise-form" class="flex flex-col gap-3 bg-surface rounded-lg p-4">
      <label class="text-sm text-white/60" for="exercise-name">Name</label>
      <input
        id="exercise-name"
        name="name"
        type="text"
        autocomplete="off"
        value="${escapeHtml(name)}"
        placeholder="z. B. Kniebeuge"
        class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-white min-h-[44px]"
        required
      />
      <div class="flex gap-3">
        <button type="submit" class="tap-feedback flex-1 bg-accent text-bg font-semibold rounded-lg py-3 min-h-[44px]">
          Speichern
        </button>
        <button type="button" id="cancel-exercise-btn" class="tap-feedback px-4 py-3 text-white/60 min-h-[44px]">
          Abbrechen
        </button>
      </div>
      ${
        editing
          ? `<button type="button" id="delete-exercise-btn" class="tap-feedback text-red-400 text-sm py-2 min-h-[44px]">
              Übung löschen
            </button>`
          : ''
      }
    </form>
  `;
}

function renderList(list) {
  if (list.length === 0) {
    return `<p class="text-white/60 text-center py-12">Noch keine Übungen angelegt.</p>`;
  }

  return `
    <ul class="flex flex-col gap-2">
      ${list
        .map(
          (ex) => `
        <li>
          <button data-id="${ex.id}" class="exercise-item tap-feedback w-full text-left bg-surface rounded-lg px-4 py-3 min-h-[44px]">
            ${escapeHtml(ex.name)}
          </button>
        </li>
      `
        )
        .join('')}
    </ul>
  `;
}

function wireEvents() {
  const addBtn = currentContainer.querySelector('#add-exercise-btn');
  addBtn?.addEventListener('click', () => {
    editingId = 'new';
    paint();
  });

  currentContainer.querySelectorAll('.exercise-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingId = btn.dataset.id;
      paint();
    });
  });

  const cancelBtn = currentContainer.querySelector('#cancel-exercise-btn');
  cancelBtn?.addEventListener('click', () => {
    editingId = null;
    paint();
  });

  const form = currentContainer.querySelector('#exercise-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) return;

    if (editingId === 'new') {
      await createExercise(name);
    } else {
      await updateExercise(editingId, name);
    }
    editingId = null;
    paint();
  });

  const deleteBtn = currentContainer.querySelector('#delete-exercise-btn');
  deleteBtn?.addEventListener('click', async () => {
    if (!confirm('Übung wirklich löschen? Sie wird aus allen Routinen entfernt, bereits erfasste Sätze bleiben erhalten.')) {
      return;
    }
    await deleteExercise(editingId);
    editingId = null;
    paint();
  });
}
