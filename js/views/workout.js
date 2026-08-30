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

function daysBetween(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

function formatDayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return { weekday: date.toLocaleDateString('de-DE', { weekday: 'short' }), day: d };
}

// Relative Bezeichnung für nahe Tage ("Heute"/"Gestern"/"Morgen"), sonst
// vollständiger Wochentag - angelehnt an die Referenz-App.
function formatFullDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const datePart = date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' });
  const diff = daysBetween(todayISODate(), dateStr);

  if (diff === 0) return `Heute, ${datePart}`;
  if (diff === -1) return `Gestern, ${datePart}`;
  if (diff === 1) return `Morgen, ${datePart}`;
  return `${date.toLocaleDateString('de-DE', { weekday: 'long' })}, ${datePart}`;
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
        <div>
          <h1 class="text-screen-title">Workout</h1>
          <p class="text-body text-muted">${formatFullDate(state.selectedDate)}</p>
        </div>
        <button id="open-date-picker-btn" class="tap-feedback min-w-[44px] min-h-[44px] text-muted" aria-label="Datum wählen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-[22px] h-[22px] ml-auto">
            <rect x="4" y="5.5" width="16" height="15" rx="3" />
            <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
          </svg>
        </button>
        <input id="date-picker-input" type="date" value="${state.selectedDate}" class="sr-only" />
      </div>

      ${renderCalendarStrip(dates, datesWithSets)}

      ${renderRoutineSection(workout, routine)}

      ${state.routinePickerOpen ? await renderRoutinePicker(workout) : ''}

      ${renderExerciseRoster(entries, nameById, setsByExercise, expandedLastSet)}

      <button type="button" class="tap-feedback w-full flex items-center justify-center gap-2 py-3 min-h-[44px] text-muted opacity-60" disabled>
        <span class="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs leading-none">+</span>
        <span class="text-body font-medium">Übung hinzufügen</span>
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

// Kalenderzeile ohne Einzel-Pill-Hintergrund je Tag (an Referenz angelehnt):
// Wochentag als schlichter Text, nur die Tageszahl des ausgewählten Tages
// bekommt ein kleines rundes Accent-Badge. scroll-snap sorgt dafür, dass
// sich die Zeile wie ein Wochen-Swipe anfühlt, technisch bleibt es aber ein
// durchgehender ±2-Wochen-Scroll (Abschnitt 10).
function renderCalendarStrip(dates, datesWithSets) {
  return `
    <div class="flex snap-x snap-mandatory overflow-x-auto -mx-4 px-4">
      ${dates
        .map((d) => {
          const { weekday, day } = formatDayLabel(d);
          const isSelected = d === state.selectedDate;
          const hasDot = datesWithSets.has(d);
          return `
          <button data-date="${d}" class="calendar-day-btn tap-feedback snap-start flex-shrink-0 basis-[14.2857%] flex flex-col items-center gap-1.5 py-1 min-h-[44px]">
            <span class="text-label uppercase ${isSelected ? 'text-ink' : 'text-muted'}">${weekday}</span>
            <span class="text-card-title w-8 h-8 flex items-center justify-center rounded-lg ${isSelected ? 'bg-accent text-base' : 'text-ink'}">${day}</span>
            <span class="w-1.5 h-1.5 rounded-full ${hasDot ? 'bg-accent' : 'bg-transparent'}"></span>
          </button>
        `;
        })
        .join('')}
    </div>
  `;
}

// Dropdown-Pill (öffnet den Routine-Picker) + Link zum Routinen-Tab, an
// Referenz angelehnt statt separater "Wechseln"/"Entfernen"-Buttons.
function renderRoutineSection(workout, routine) {
  const label = !workout || !workout.routineId ? 'Routine wählen' : routine ? routine.name : 'Gelöschte Routine';

  return `
    <div class="flex items-center gap-2">
      <button id="routine-dropdown-btn" class="tap-feedback flex-1 bg-surface rounded-full pl-4 pr-3 py-3 min-h-[44px] flex items-center justify-between gap-2">
        <span class="text-card-title truncate">${escapeHtml(label)}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-muted flex-shrink-0">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <button id="go-to-routines-btn" class="tap-feedback text-accent text-body font-medium px-2 min-h-[44px] flex-shrink-0">Routinen</button>
    </div>
  `;
}

async function renderRoutinePicker(workout) {
  const routines = await db.routines.orderBy('name').toArray();

  return `
    <div class="bg-surface rounded-card p-3 flex flex-col gap-2">
      ${
        workout?.routineId
          ? `<button id="clear-routine-option-btn" class="tap-feedback w-full text-left rounded-btn px-3 py-2 min-h-[44px] bg-base text-red-400 text-body">
              Keine Routine (entfernen)
            </button>`
          : ''
      }
      ${
        routines.length === 0
          ? `<p class="text-body text-muted py-2">Noch keine Routinen vorhanden.</p>`
          : `<ul class="flex flex-col gap-1">
              ${routines
                .map(
                  (r) => `
                <li>
                  <button data-routine="${r.id}" class="pick-routine-option-btn tap-feedback w-full text-left rounded-btn px-3 py-2 min-h-[44px] bg-base text-ink text-body flex items-center justify-between">
                    <span>${escapeHtml(r.name)}</span>
                    ${r.id === workout?.routineId ? '<span class="text-accent">✓</span>' : ''}
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
          ? `<ul class="flex flex-col gap-2">
              ${sets
                .map(
                  (s, i) => `
                <li class="flex items-center gap-3 text-body">
                  <span class="w-6 h-6 rounded-full bg-base flex items-center justify-center text-label text-muted flex-shrink-0">${i + 1}</span>
                  <span class="flex-1">${s.weight} kg × ${s.reps}</span>
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

  currentContainer.querySelector('#routine-dropdown-btn')?.addEventListener('click', () => {
    state.routinePickerOpen = !state.routinePickerOpen;
    paint();
  });

  currentContainer.querySelector('#go-to-routines-btn')?.addEventListener('click', () => {
    document.querySelector('[data-view="routines"]')?.click();
  });

  currentContainer.querySelector('#cancel-routine-picker-btn')?.addEventListener('click', () => {
    state.routinePickerOpen = false;
    paint();
  });

  currentContainer.querySelector('#clear-routine-option-btn')?.addEventListener('click', async () => {
    const workout = await getWorkoutByDate(state.selectedDate);
    if (workout) await removeRoutineFromWorkout(workout.id);
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
