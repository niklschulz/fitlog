import {
  db,
  getWorkoutByDate,
  getOrCreateWorkoutForDate,
  getWorkoutExercises,
  applyRoutineToWorkout,
  removeRoutineFromWorkout,
  markWorkoutExerciseStarted,
  addSet,
  deleteSet,
  getLastSetForExercise,
  todayISODate,
  toISODate,
} from '../db.js';
import { escapeHtml } from '../utils.js';

let currentContainer = null;
let state = {
  selectedDate: todayISODate(),
  expandedExerciseId: null,
  routinePickerOpen: false,
};

export async function render(container) {
  currentContainer = container;
  state.expandedExerciseId = null;
  state.routinePickerOpen = false;
  await paint();
}

// --- Datums-Hilfsfunktionen (lokale Zeitzone, kein UTC-Shift) ---

function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return toISODate(date);
}

function formatDayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return { weekday: date.toLocaleDateString('de-DE', { weekday: 'short' }), day: d };
}

function formatFullDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
}

async function getDatesWithSets(dates) {
  const workouts = await db.workouts.where('date').anyOf(dates).toArray();
  const result = new Set();
  for (const w of workouts) {
    const count = await db.sets.where('workoutId').equals(w.id).count();
    if (count > 0) result.add(w.date);
  }
  return result;
}

// --- Paint ---

async function paint() {
  const dates = [];
  for (let i = -14; i <= 14; i++) dates.push(addDays(state.selectedDate, i));
  const datesWithSets = await getDatesWithSets(dates);

  const workout = await getWorkoutByDate(state.selectedDate);
  const routine = workout?.routineId ? await db.routines.get(workout.routineId) : null;
  const entries = workout ? await getWorkoutExercises(workout.id) : [];

  const exerciseIds = entries.map((e) => e.exerciseId);
  const exercises = await db.exercises.bulkGet(exerciseIds);
  const nameById = Object.fromEntries(exerciseIds.map((id, i) => [id, exercises[i]?.name ?? null]));

  const setsByExercise = {};
  if (workout) {
    const sets = await db.sets.where('workoutId').equals(workout.id).toArray();
    sets.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    for (const s of sets) {
      (setsByExercise[s.exerciseId] ??= []).push(s);
    }
  }

  let expandedLastSet = null;
  if (state.expandedExerciseId) {
    const entry = entries.find((e) => e.id === state.expandedExerciseId);
    if (entry) {
      expandedLastSet = await getLastSetForExercise(entry.exerciseId);
    } else {
      state.expandedExerciseId = null;
    }
  }

  currentContainer.innerHTML = `
    <div class="py-4 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-screen-title">Workout</h1>
        <button id="open-date-picker-btn" class="tap-feedback min-w-[44px] min-h-[44px] text-muted" aria-label="Datum wählen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-[22px] h-[22px] ml-auto">
            <rect x="4" y="5.5" width="16" height="15" rx="3" />
            <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
          </svg>
        </button>
        <input id="date-picker-input" type="date" value="${state.selectedDate}" class="sr-only" />
      </div>

      ${renderCalendarStrip(dates, datesWithSets)}

      <h2 class="text-card-title">${formatFullDate(state.selectedDate)}</h2>

      ${renderRoutineSection(workout, routine)}

      ${state.routinePickerOpen ? await renderRoutinePicker() : ''}

      ${renderExerciseRoster(entries, nameById, setsByExercise, expandedLastSet)}

      <button type="button" class="tap-feedback bg-surface text-muted rounded-btn py-3 min-h-[44px] opacity-50" disabled>
        + Übung hinzufügen
      </button>
    </div>
  `;

  wireEvents();

  // Erst im nächsten Frame scrollen - direkt nach dem innerHTML-Update hat
  // der Browser das Layout des Scroll-Containers noch nicht fertig berechnet.
  requestAnimationFrame(() => {
    const selectedDayBtn = currentContainer.querySelector('.calendar-day-btn[data-date="' + state.selectedDate + '"]');
    selectedDayBtn?.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
}

function renderCalendarStrip(dates, datesWithSets) {
  return `
    <div class="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
      ${dates
        .map((d) => {
          const { weekday, day } = formatDayLabel(d);
          const isSelected = d === state.selectedDate;
          const hasDot = datesWithSets.has(d);
          const dotClass = hasDot ? (isSelected ? 'bg-base' : 'bg-accent') : 'bg-transparent';
          return `
          <button data-date="${d}" class="calendar-day-btn tap-feedback flex-shrink-0 flex flex-col items-center gap-1 w-12 py-2 rounded-btn min-h-[44px] ${isSelected ? 'bg-accent text-base' : 'bg-surface text-ink'}">
            <span class="text-label ${isSelected ? '' : 'text-muted'}">${weekday}</span>
            <span class="text-card-title">${day}</span>
            <span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span>
          </button>
        `;
        })
        .join('')}
    </div>
  `;
}

function renderRoutineSection(workout, routine) {
  if (!workout || !workout.routineId) {
    return `
      <button id="pick-routine-btn" class="tap-feedback bg-surface rounded-card px-4 py-3 min-h-[44px] flex items-center justify-between">
        <span class="text-card-title">Routine wählen</span>
        <span class="text-accent text-card-title">＋</span>
      </button>
    `;
  }

  return `
    <div class="bg-surface rounded-card px-4 py-3 flex items-center justify-between gap-2">
      <span class="text-card-title truncate">${escapeHtml(routine ? routine.name : 'Gelöschte Routine')}</span>
      <div class="flex gap-1 flex-shrink-0">
        <button id="switch-routine-btn" class="tap-feedback text-accent text-body font-medium px-2 min-h-[44px]">Wechseln</button>
        <button id="remove-routine-btn" class="tap-feedback text-red-400 text-body font-medium px-2 min-h-[44px]">Entfernen</button>
      </div>
    </div>
  `;
}

async function renderRoutinePicker() {
  const routines = await db.routines.orderBy('name').toArray();

  return `
    <div class="bg-surface rounded-card p-3 flex flex-col gap-2">
      ${
        routines.length === 0
          ? `<p class="text-body text-muted py-2">Noch keine Routinen vorhanden.</p>`
          : `<ul class="flex flex-col gap-1">
              ${routines
                .map(
                  (r) => `
                <li>
                  <button data-routine="${r.id}" class="pick-routine-option-btn tap-feedback w-full text-left rounded-btn px-3 py-2 min-h-[44px] bg-base text-ink text-body">
                    ${escapeHtml(r.name)}
                  </button>
                </li>
              `
                )
                .join('')}
            </ul>`
      }
      <button id="cancel-routine-picker-btn" class="tap-feedback text-muted text-body py-1 min-h-[44px] text-left">Abbrechen</button>
    </div>
  `;
}

function renderExerciseRoster(entries, nameById, setsByExercise, expandedLastSet) {
  if (entries.length === 0) {
    return `<p class="text-body text-muted text-center py-6">Noch keine Übungen in diesem Workout.</p>`;
  }

  return `
    <ul class="flex flex-col gap-2">
      ${entries
        .map((entry) =>
          renderExerciseRow(entry, nameById[entry.exerciseId], setsByExercise[entry.exerciseId] ?? [], expandedLastSet)
        )
        .join('')}
    </ul>
  `;
}

function renderExerciseRow(entry, name, sets, expandedLastSet) {
  const label = name ?? 'Gelöschte Übung';
  const expanded = state.expandedExerciseId === entry.id;

  return `
    <li class="bg-surface rounded-card overflow-hidden">
      <button data-entry="${entry.id}" class="exercise-row-toggle tap-feedback w-full text-left px-4 py-3 min-h-[44px] flex items-center justify-between">
        <span class="text-card-title ${name ? '' : 'italic text-muted'}">${escapeHtml(label)}</span>
        <span class="text-label text-muted">${sets.length > 0 ? `${sets.length} Satz${sets.length === 1 ? '' : 'e'}` : ''}</span>
      </button>
      ${expanded ? renderExercisePanel(entry, sets, expandedLastSet) : ''}
    </li>
  `;
}

function renderExercisePanel(entry, sets, lastSet) {
  const weight = lastSet ? lastSet.weight : '';
  const reps = lastSet ? lastSet.reps : '';

  return `
    <div class="px-4 pb-4 flex flex-col gap-3">
      ${
        sets.length > 0
          ? `<ul class="flex flex-col gap-1">
              ${sets
                .map(
                  (s) => `
                <li class="flex items-center justify-between text-body">
                  <span>${s.weight} kg × ${s.reps}</span>
                  <button data-set="${s.id}" class="delete-set-btn tap-feedback min-w-[44px] min-h-[44px] text-red-400">✕</button>
                </li>
              `
                )
                .join('')}
            </ul>`
          : ''
      }
      <form data-entry="${entry.id}" data-exercise="${entry.exerciseId}" class="set-entry-form flex gap-3 items-end">
        <div class="flex-1 flex flex-col gap-1">
          <label class="text-label text-muted">Gewicht (kg)</label>
          <input name="weight" type="number" inputmode="decimal" step="0.5" min="0" value="${weight}" class="w-full bg-base rounded-btn px-3 py-2 text-ink min-h-[44px]" required />
        </div>
        <div class="flex-1 flex flex-col gap-1">
          <label class="text-label text-muted">Wdh.</label>
          <input name="reps" type="number" inputmode="numeric" step="1" min="0" value="${reps}" class="w-full bg-base rounded-btn px-3 py-2 text-ink min-h-[44px]" required />
        </div>
        <button type="submit" class="tap-feedback bg-accent text-base font-semibold rounded-btn px-4 min-h-[44px]">Speichern</button>
      </form>
    </div>
  `;
}

// --- Events ---

function wireEvents() {
  currentContainer.querySelectorAll('.calendar-day-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedDate = btn.dataset.date;
      state.expandedExerciseId = null;
      state.routinePickerOpen = false;
      paint();
    });
  });

  currentContainer.querySelector('#open-date-picker-btn')?.addEventListener('click', () => {
    const input = currentContainer.querySelector('#date-picker-input');
    if (input.showPicker) {
      input.showPicker();
    } else {
      input.click();
    }
  });

  currentContainer.querySelector('#date-picker-input')?.addEventListener('change', (e) => {
    if (!e.target.value) return;
    state.selectedDate = e.target.value;
    state.expandedExerciseId = null;
    state.routinePickerOpen = false;
    paint();
  });

  currentContainer.querySelector('#pick-routine-btn')?.addEventListener('click', () => {
    state.routinePickerOpen = true;
    paint();
  });

  currentContainer.querySelector('#switch-routine-btn')?.addEventListener('click', () => {
    state.routinePickerOpen = true;
    paint();
  });

  currentContainer.querySelector('#cancel-routine-picker-btn')?.addEventListener('click', () => {
    state.routinePickerOpen = false;
    paint();
  });

  currentContainer.querySelectorAll('.pick-routine-option-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const workout = await getOrCreateWorkoutForDate(state.selectedDate);
      await applyRoutineToWorkout(workout.id, btn.dataset.routine);
      state.routinePickerOpen = false;
      paint();
    });
  });

  currentContainer.querySelector('#remove-routine-btn')?.addEventListener('click', async () => {
    const workout = await getWorkoutByDate(state.selectedDate);
    if (!workout) return;
    await removeRoutineFromWorkout(workout.id);
    paint();
  });

  currentContainer.querySelectorAll('.exercise-row-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.expandedExerciseId = state.expandedExerciseId === btn.dataset.entry ? null : btn.dataset.entry;
      paint();
    });
  });

  currentContainer.querySelectorAll('.set-entry-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const weight = parseFloat(e.target.elements.weight.value);
      const reps = parseInt(e.target.elements.reps.value, 10);
      if (Number.isNaN(weight) || Number.isNaN(reps)) return;

      const workout = await getWorkoutByDate(state.selectedDate);
      const exerciseId = form.dataset.exercise;
      await addSet(workout.id, exerciseId, weight, reps);
      await markWorkoutExerciseStarted(workout.id, exerciseId);
      paint();
    });
  });

  currentContainer.querySelectorAll('.delete-set-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteSet(btn.dataset.set);
      paint();
    });
  });
}
