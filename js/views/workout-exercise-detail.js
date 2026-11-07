// Übungs-Detailseite (Abschnitt 12) - eigenständiges Sub-View-Modul,
// aufgerufen von workout.js statt in der App-weiten View-Registrierung
// (app.js). Folgt trotzdem demselben render()/paint()/wireEvents()-Muster
// wie die echten Views (workout.js/profile.js), damit sie sich vollständig
// selbst verwaltet - workout.js übergibt nur die IDs plus einen
// onBack-Callback und mischt sich sonst nicht ein.
import { db, addSet, deleteSet, updateSet, getLastSetForExercise, getExerciseSetHistory, markWorkoutExerciseStarted, getPRsForExercises } from '../db.js';
import {
  escapeHtml,
  renderSetTimelineRow,
  renderSetValues,
  renderPRBadge,
  renderSegmentedControl,
  positionSegmentedIndicator,
  measureSegmentedIndicatorRect,
  renderNote,
  renderNoteIcon,
  BTN_SECONDARY,
  CARD,
} from '../utils.js';
import { openNoteSheet, unmountNoteSheet } from '../noteSheet.js';
import { formatDate } from '../dates.js';
import { getSettings } from '../settings.js';
import { wireSwipeBack, unwireSwipeBack, triggerBack } from '../swipeBack.js';

let currentContainer = null;
let onBack = null;
// Öffnet das Übungs-Detail-Sheet (Muskeln) - von workout.js übergeben, da das
// Sheet dort lebt und nur eine Quelle haben soll.
let onOpenInfo = null;
let state = {
  entryId: null,
  exerciseId: null,
  activeTab: 'today', // 'today' | 'history' | 'stats'
  selectedSetId: null,
  // Für das Notiz-Sheet, bei jedem paint() aktualisiert (das Sheet muss
  // synchron öffnen können, s. js/noteSheet.js).
  noteContext: { exerciseName: '', dateISO: null, note: '' },
};

// Analog zu workout.js's eigenem renderEpoch (s. dort für die ausführliche
// Begründung): erhöht sich bei jedem render() (neuer Aufruf durch workout.js
// für einen Eintrag) und bei jedem unmount(). paint() prüft nach seinen
// asynchronen DB-Abfragen, ob sein eigener Stand noch aktuell ist, bevor es
// den Container beschreibt oder onBack() aufruft. Ohne diese Sperre könnte
// ein durch einen Reiter-Wechsel (Heute/Verlauf/Statistik) ausgelöster,
// noch laufender paint()-Aufruf nach einem Zurück-Tap oder einem Wechsel
// des Bottom-Nav-Tabs verspätet fertig werden und den dann längst von der
// Tagesübersicht oder einer ganz anderen View belegten Container
// überschreiben.
let renderEpoch = 0;

// PR-Markierungen der aktuell angezeigten Übung (setId -> 'weight' | 'reps',
// s. ADR 0025), bei jedem paint() neu berechnet - modulweit statt als
// Parameter, da renderSetContent() von beiden Reitern aus aufgerufen wird.
let prs = new Map();

// `container` ist die Seiten-Ebene (s. js/swipeBack.js, ADR 0039), nicht der
// Container der Übersicht. `refreshUnder` zeichnet die Übersicht beim
// Zurückwischen in place neu.
export async function render(container, { entryId, onBack: onBackCallback, onOpenInfo: onOpenInfoCallback, refreshUnder = null }) {
  renderEpoch++;
  currentContainer = container;
  onBack = onBackCallback;
  onOpenInfo = onOpenInfoCallback;
  // Wisch vom linken Rand = Zurück-Pfeil (s. js/swipeBack.js).
  wireSwipeBack({ container, onBack: (opts) => onBack(opts), refreshUnder });
  state.entryId = entryId;
  state.activeTab = 'today';
  state.selectedSetId = null;
  await paint();
}

// Von workout.js aufgerufen, sobald diese Sub-View verlassen wird - sowohl
// beim regulären Zurück-Tap (onBack) als auch, falls der komplette
// Workout-Tab gewechselt wird, während die Detailseite gerade aktiv ist
// (s. workout.js's eigenes unmount()).
export function unmount() {
  renderEpoch++;
  unwireSwipeBack();
  unmountNoteSheet();
}

// Von workout.js nach Bearbeiten/Löschen der Übung über das Info-Sheet
// aufgerufen. `refreshTitle()` ändert nur die Überschrift direkt im DOM (ein
// paint() würde das darüberliegende, offene Sheet mit wegräumen);
// `refresh()` zeichnet komplett neu - erst aufrufen, wenn das Sheet weg ist.
export function refreshTitle(name) {
  const h1 = currentContainer?.querySelector('h1');
  if (h1) h1.textContent = name;
}

export function refresh() {
  return paint();
}

// `indicatorFromRect` s. Kommentar bei statistics.js's paint() - dieselbe
// Begründung gilt hier für den Reiter-Wechsel Heute/Verlauf/Statistik.
async function paint(indicatorFromRect = null) {
  const myEpoch = renderEpoch;
  const entry = await db.workoutExercises.get(state.entryId);
  if (myEpoch !== renderEpoch) return;
  if (!entry) {
    // Eintrag existiert nicht mehr (z. B. Routine zwischenzeitlich
    // gewechselt) - kann hier nichts mehr anzeigen, zurück zur Übersicht.
    onBack();
    return;
  }

  state.exerciseId = entry.exerciseId;
  const exercise = await db.exercises.get(entry.exerciseId);
  const exerciseName = exercise?.name ?? 'Gelöschte Übung';
  const workout = await db.workouts.get(entry.workoutId);
  const routineLabel = entry.sourceRoutineId
    ? ((await db.routines.get(entry.sourceRoutineId))?.name ?? 'Gelöschte Routine')
    : null;

  state.noteContext = { exerciseName, dateISO: workout?.date ?? null, note: entry.note ?? '' };

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

  const history = state.activeTab === 'history' ? await getExerciseSetHistory(entry.exerciseId) : [];
  // PR-Markierungen (s. ADR 0025) - im Tages- und Verlauf-Reiter.
  prs = state.activeTab === 'stats' ? new Map() : await getPRsForExercises([entry.exerciseId]);

  const html = `
    <div class="py-4 flex flex-col gap-4">
      ${renderHeader(exerciseName)}
      ${renderSegmentedControl(
        [
          { key: 'today', label: workout?.date ? formatShortDate(workout.date) : '' },
          { key: 'history', label: 'Verlauf' },
          { key: 'stats', label: 'Statistik' },
        ],
        state.activeTab
      )}
      ${state.activeTab === 'today' ? renderTodayTab(todaySets, formWeight, formReps, routineLabel, entry.note, exercise?.note) : ''}
      ${state.activeTab === 'history' ? renderHistoryTab(history) : ''}
      ${state.activeTab === 'stats' ? renderStatsTab() : ''}
    </div>
  `;

  if (myEpoch !== renderEpoch) return;

  currentContainer.innerHTML = html;
  positionSegmentedIndicator(currentContainer, { fromRect: indicatorFromRect });
  wireEvents();
}

function renderHeader(exerciseName) {
  return `
    <div class="grid grid-cols-[44px_1fr_44px] items-center gap-3">
      <button id="detail-back-btn" type="button" class="icon-btn-glass tap-feedback text-ink justify-self-start" aria-label="Zurück">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <h1 class="text-card-title text-center truncate">${escapeHtml(exerciseName)}</h1>
      <button id="detail-info-btn" type="button" class="icon-btn-glass tap-feedback text-ink justify-self-end" aria-label="Übungsdetails">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <circle cx="12" cy="7.75" r="0.5" fill="currentColor" />
        </svg>
      </button>
    </div>
  `;
}

function formatShortDate(dateStr) {
  return formatDate(dateStr, 'weekdayDayMonthShort');
}

function renderStepperRow(field, label, value) {
  const inputMode = field === 'weight' ? 'decimal' : 'numeric';
  const step = field === 'weight' ? '0.5' : '1';

  return `
    <div class="flex flex-col items-center gap-2">
      <span class="text-label uppercase text-muted">${label}</span>
      <div class="flex items-center gap-2">
        <button data-stepper="${field}" data-delta="-1" type="button" class="stepper-btn tap-feedback w-8 h-8 rounded-lg bg-raised text-ink text-lg font-semibold flex items-center justify-center flex-shrink-0">−</button>
        <input id="detail-${field}-input" type="number" inputmode="${inputMode}" step="${step}" min="0" value="${escapeHtml(value)}" class="w-16 text-center bg-base rounded-btn py-2 text-ink" />
        <button data-stepper="${field}" data-delta="1" type="button" class="stepper-btn tap-feedback w-8 h-8 rounded-lg bg-raised text-ink text-lg font-semibold flex items-center justify-center flex-shrink-0">+</button>
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
//
// `badgeInset`: Im Tages-Reiter stehen die Zeilen ohne umgebende Karte direkt
// auf der Seite - das PR-Badge säße dort bündig mit dem Seiteninhalt (z. B.
// der Kante des "Löschen"-Buttons). `mr-4` rückt es um denselben
// Innenabstand ein, den es in den Karten (Roster, Verlauf) durch deren `p-4`
// ohnehin hat.
// `prsMap` optional, damit der Verlauf auch von der Statistik-Übungsseite
// (s. exportierte renderExerciseHistory) mit eigener PR-Map gerendert werden kann.
function renderSetContent(set, { badgeInset = false, prsMap = prs } = {}) {
  if (!set) return `<span class="text-muted">–</span>`;
  return renderSetValues(set.weight, set.reps) + renderPRBadge(prsMap.get(set.id), { extraClasses: badgeInset ? 'mr-4' : '' });
}

// Infokasten mit der dauerhaften Notiz zur Übung (exercises.note, s. ADR 0036)
// ganz unten auf der Seite - nur lesbar, bearbeitet wird sie im Übungs-Detail-
// Sheet (Info-Button). Nicht zu verwechseln mit der Notiz zum Workout-Tag
// (`note`, direkt unter den Satz-Zeilen). Ohne Notiz leerer String.
function renderExerciseNoteBox(exerciseNote) {
  if (!exerciseNote) return '';
  return `
    <div id="detail-exercise-note" class="${CARD} flex flex-col gap-2">
      <span class="text-label uppercase text-muted">Notiz zur Übung</span>
      <p class="text-body text-ink whitespace-pre-line break-words">${escapeHtml(exerciseNote)}</p>
    </div>
  `;
}

function renderTodayTab(sets, formWeight, formReps, routineLabel, note, exerciseNote) {
  const rowCount = Math.max(sets.length, getSettings().defaultSetCount);
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
          <button id="detail-save-btn" type="button" class="tap-feedback flex-[4] min-w-0 ${BTN_SECONDARY} py-3 min-h-[44px]">${editing ? 'Ändern' : 'Speichern'}</button>
          <button id="detail-delete-btn" type="button" ${editing ? '' : 'disabled'} class="tap-feedback flex-[3] min-w-0 ${BTN_SECONDARY} py-3 min-h-[44px] ${editing ? '' : 'opacity-40 pointer-events-none'}">Löschen</button>
          <button id="detail-note-btn" type="button" class="tap-feedback flex-1 min-w-[44px] ${BTN_SECONDARY} py-3 min-h-[44px] flex items-center justify-center" aria-label="Notiz">${renderNoteIcon('w-5 h-5')}</button>
        </div>
        ${routineLabel ? `<p class="text-label text-muted uppercase">Routine: ${escapeHtml(routineLabel)}</p>` : ''}
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
            return renderSetTimelineRow(i + 1, renderSetContent(set, { badgeInset: true }), {
              isLast: i === rows.length - 1,
              liClasses: set ? 'set-row' : 'empty-set-row',
              liAttrs: set ? `data-set="${escapeHtml(set.id)}"` : 'data-row-empty="true"',
              highlighted: isSelected,
            });
          })
          .join('')}
      </ul>
      ${renderNote(note, { clamp: false })}
      ${renderExerciseNoteBox(exerciseNote)}
    </div>
  `;
}

function formatHistoryDate(dateStr) {
  return formatDate(dateStr, 'fullLong');
}

// Verlauf-Reiter, auch vom Statistik-Tab (js/views/statistics-exercise-detail.js)
// unverändert genutzt: `history` = getExerciseSetHistory(), `prsMap` =
// getPRsForExercises()-Map der Übung.
export function renderExerciseHistory(history, prsMap) {
  return renderHistoryTab(history, prsMap, false);
}

// `showNotes`: Die Statistik-Übungsseite zeigt bewusst keine Notizen
// (s. ADR 0035).
function renderHistoryTab(history, prsMap = prs, showNotes = true) {
  if (history.length === 0) {
    return `<p class="text-body text-muted text-center py-6">Noch kein Verlauf für diese Übung.</p>`;
  }

  return `
    <div class="flex flex-col gap-5">
      ${history
        .map(
          (day) => `
        <div class="${CARD}">
          <h3 class="text-card-title mb-2">${escapeHtml(formatHistoryDate(day.date))}</h3>
          <ul class="flex flex-col">
            ${day.sets
              .map((s, i) =>
                renderSetTimelineRow(i + 1, renderSetContent(s, { prsMap }), { isLast: i === day.sets.length - 1 })
              )
              .join('')}
          </ul>
          ${showNotes ? renderNote(day.note, { extraClasses: 'mt-4' }) : ''}
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
  // Zurück-Pfeil mit derselben Schiebe-Animation wie die Wisch-Geste.
  currentContainer.querySelector('#detail-back-btn')?.addEventListener('click', () => {
    triggerBack(() => onBack());
  });

  currentContainer.querySelector('#detail-info-btn')?.addEventListener('click', () => {
    if (state.exerciseId) onOpenInfo?.(state.exerciseId);
  });

  currentContainer.querySelectorAll('.segmented-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.activeTab === btn.dataset.tab) return;
      const fromRect = measureSegmentedIndicatorRect(currentContainer);
      state.activeTab = btn.dataset.tab;
      // Auswahl wird beim Reiter-Wechsel verworfen (Testkonzept Fall 26) -
      // sonst könnte man z. B. über "Verlauf" navigieren und mit einer
      // stillen, nicht mehr sichtbaren Auswahl zum Tages-Reiter zurückkehren.
      state.selectedSetId = null;
      paint(fromRect);
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

  currentContainer.querySelector('#detail-note-btn')?.addEventListener('click', () => {
    openNoteSheet({
      // Sheets liegen im Container der Übersicht (über der Seiten-Ebene, die
      // einen eigenen Stapelkontext bildet), nicht in der Ebene selbst.
      container: document.getElementById('view-container'),
      entryId: state.entryId,
      exerciseName: state.noteContext.exerciseName,
      dateISO: state.noteContext.dateISO,
      initialNote: state.noteContext.note,
      onSaved: () => paint(),
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
    // sonst geltenden Projekt-Konvention (Löschen sonst immer per Action Sheet),
    // s. CLAUDE.md und ADR 0010.
    await deleteSet(state.selectedSetId);
    state.selectedSetId = null;
    paint();
  });
}
