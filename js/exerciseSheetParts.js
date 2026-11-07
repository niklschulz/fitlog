// Gemeinsame Bausteine der Übungs-Sheets (Workout-Tab: Übungen zum Tag/zur
// Routine hinzufügen; Statistik-Tab: Favoriten für den Übungen-Reiter).
// Geteilt sind Hülle, Suchleiste, Muskelfilter-Pille samt Auf-/Zu-Steuerung
// und das Teil-Repaint; Zeilen, Auswahl-Logik, Öffnen/Schließen des ganzen
// Sheets und Datenquelle bleiben bewusst in den Views (sie unterscheiden sich
// fachlich, s. docs/architecture.md "View-Pattern").
//
// Die Views halten dieselben State-Felder (`exerciseSheetSearch`,
// `exerciseSheetMuscleFilterId/-Open/-Closing`) und reichen ihr `state` hier
// herein. Das Sheet selbst wird nie komplett neu gerendert (sonst spielt die
// Slide-Animation erneut ab, ADR 0015): nur `#exercise-sheet-content` bzw. nur
// `#exercise-sheet-body` werden ersetzt - das Such-<input> bleibt beim Tippen
// unangetastet (Fokus, iOS-Key-Repeat der Löschen-Taste).
import { MUSCLE_GROUPS } from './db.js';
import { escapeHtml, renderMuscleFilterPopup, renderDropdownIcon } from './utils.js';
import { createSheetCloser, POPUP_CLOSE_ANIMATION_MS } from './sheet.js';

// Backdrop + Panel + Kopfzeile (Schließen, Titel/Ziehgriff, "+"). Z-Ebene per
// Inline-Style, weil sie je nach Aufrufer variiert (Workout: 52/53 über dem
// Routinen-Sheet). Der "+"-Button ist ein stabiles Grid-Kind und nie Teil
// eines Teil-Repaints.
export function renderExerciseSheetShell({ z, closing, contentHtml }) {
  const closingClass = closing ? 'closing' : '';
  return `
    <div id="exercise-sheet-root">
      <div id="exercise-sheet-backdrop" class="bottom-sheet-backdrop ${closingClass} fixed inset-0 bg-black/50" style="z-index: ${z.bg};"></div>
      <div class="bottom-sheet ${closingClass} fixed left-0 right-0 bottom-0 bg-surface rounded-sheet flex flex-col" style="z-index: ${z.panel};" role="dialog" aria-label="Übungen">
        <div class="grid grid-cols-3 items-center px-4 pt-3 pb-5 flex-shrink-0">
          <button id="exercise-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Übungen schließen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div id="exercise-sheet-handle" class="justify-self-center flex items-center justify-center w-full py-3 min-h-[44px]" style="touch-action: none;">
            <span class="text-card-title">Übungen</span>
          </div>
          <button id="exercise-sheet-new-btn" type="button" class="icon-btn-glass tap-feedback justify-self-end text-ink" aria-label="Neue Übung erstellen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div id="exercise-sheet-content" class="flex-1 min-h-0 flex flex-col">
          ${contentHtml}
        </div>
      </div>
    </div>
  `;
}

// Suchleiste + Muskelfilter + scrollende Liste. Hintergrund bewusst
// `bg-white/[0.08]` statt `bg-base` (Feld sitzt direkt auf `bg-surface`,
// s. design-system.md "Input").
export function renderExerciseSheetContentFrame(state, bodyHtml) {
  return `
    ${renderSearchBar(state.exerciseSheetSearch)}
    ${renderMuscleFilterPill(state)}
    <div id="exercise-sheet-body" class="bottom-sheet-scroll flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+112px)] flex flex-col gap-2">
      ${bodyHtml}
    </div>
  `;
}

function renderSearchBar(value) {
  return `
    <div class="px-4 pb-2 flex-shrink-0">
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M20 20l-4.7-4.7" />
          </svg>
        </span>
        <input id="exercise-sheet-search-input" type="text" inputmode="search" autocomplete="off" placeholder="Suche" value="${escapeHtml(value)}" class="w-full bg-white/[0.08] rounded-btn py-3 pl-10 pr-3 text-ink min-h-[44px]" />
      </div>
    </div>
  `;
}

// Dropdown-Pille wie die Routine-Auswahl im Roster (Label + morphender
// Chevron), Popup mit den Muskelgruppen (deckend, s. renderMuscleFilterPopup).
function renderMuscleFilterPill(state) {
  const selected = MUSCLE_GROUPS.find((m) => m.id === state.exerciseSheetMuscleFilterId);
  const label = selected ? selected.name : 'Alle Muskelgruppen';
  const open = state.exerciseSheetMuscleFilterOpen;
  return `
    <div class="px-4 pb-4 flex-shrink-0">
      <div class="relative">
        <button id="exercise-sheet-muscle-filter-btn" type="button" class="tap-feedback w-full bg-white/[0.08] rounded-btn pl-4 pr-3 py-3 min-h-[44px] flex items-center justify-between gap-2">
          <span class="text-card-title truncate">${escapeHtml(label)}</span>
          ${renderDropdownIcon(open, state.exerciseSheetMuscleFilterClosing)}
        </button>
        ${open ? renderMuscleFilterPopup(MUSCLE_GROUPS, state.exerciseSheetMuscleFilterId, state.exerciseSheetMuscleFilterClosing) : ''}
      </div>
    </div>
  `;
}

// Ersetzt `#exercise-sheet-content`; die Scroll-Position der Liste bleibt
// erhalten (der Body ist ein neuer DOM-Knoten). `wire` verdrahtet danach den
// neuen Teilbaum.
export function repaintExerciseSheetContentInPlace(container, renderContent, wire) {
  const content = container?.querySelector('#exercise-sheet-content');
  if (!content) return;
  const scrollTop = content.querySelector('#exercise-sheet-body')?.scrollTop ?? 0;
  content.innerHTML = renderContent();
  const body = content.querySelector('#exercise-sheet-body');
  if (body) body.scrollTop = scrollTop;
  wire();
}

// Ersetzt NUR `#exercise-sheet-body` - das Such-<input> liegt außerhalb und
// wird nie berührt.
export function repaintExerciseSheetBodyInPlace(container, renderBody, wire) {
  const body = container?.querySelector('#exercise-sheet-body');
  if (!body) return;
  body.innerHTML = renderBody();
  wire();
}

// Closer für das Filter-Popup (Schließen-Animation über Teil-Repaint).
// `getState` statt `state`: statistics.js ersetzt sein State-Objekt bei jedem
// render() komplett.
export function createMuscleFilterCloser(getState, repaintContent) {
  return createSheetCloser({
    isOpen: () => getState().exerciseSheetMuscleFilterOpen,
    isClosing: () => getState().exerciseSheetMuscleFilterClosing,
    setClosing: () => { getState().exerciseSheetMuscleFilterClosing = true; },
    animate: repaintContent,
    finalize: () => {
      const state = getState();
      state.exerciseSheetMuscleFilterOpen = false;
      state.exerciseSheetMuscleFilterClosing = false;
      repaintContent();
    },
    durationMs: POPUP_CLOSE_ANIMATION_MS,
  });
}

// Suche und Muskelfilter von `#exercise-sheet-content` verdrahten. Die
// Listen-Zeilen (Auswahl, Favorit, Detail) verdrahtet die View selbst.
export function wireExerciseSheetControls(container, { state, repaintBody, repaintContent, closeFilter }) {
  container.querySelector('#exercise-sheet-search-input')?.addEventListener('input', (e) => {
    state.exerciseSheetSearch = e.target.value;
    repaintBody();
  });
  container.querySelector('#exercise-sheet-muscle-filter-btn')?.addEventListener('click', () => {
    if (state.exerciseSheetMuscleFilterOpen) {
      closeFilter();
    } else {
      state.exerciseSheetMuscleFilterOpen = true;
      repaintContent();
    }
  });
  container.querySelector('#exercise-sheet-muscle-filter-backdrop')?.addEventListener('click', closeFilter);
  container.querySelectorAll('.pick-muscle-filter-option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.exerciseSheetMuscleFilterId = btn.dataset.muscle === '' ? null : btn.dataset.muscle;
      closeFilter();
    });
  });
}
