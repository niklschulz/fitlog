import { db, createExercise, updateExercise, MUSCLES } from './db.js';
import { escapeHtml } from './utils.js';
import { lockBodyScroll, unlockBodyScroll, raiseNavAboveSheet, resetNavZIndex, wireSheetDrag, SHEET_CLOSE_ANIMATION_MS } from './sheet.js';

// Neue-Übung-/Übung-bearbeiten-Sheet - geteilt zwischen Workout-Tab (Übungs-
// Sheet, Übungs-Detail-Sheet) und Statistik-Tab (Übungen-Reiter), damit
// Änderungen an einer Stelle überall wirken. Eigener State statt View-State:
// der Aufrufer übergibt beim Öffnen den Container (an den das Sheet angehängt
// wird), die z-Ebene (je nach darunterliegendem Sheet) und einen optionalen
// `onSaved({ exercise, editing })`-Callback, der NACH dem Start der
// Schließen-Animation läuft und die View hinter dem Sheet aktualisiert.
// Aufrufer müssen in ihrem unmount() `unmountExerciseCreateSheet()` aufrufen.
let container = null;
const s = {
  open: false,
  closing: false,
  name: '',
  primaryMuscleIds: new Set(),
  secondaryMuscleIds: new Set(),
  editingId: null,
  z: { bg: 52, panel: 53 },
  onSaved: null,
};

export function isExerciseCreateSheetOpen() {
  return s.open;
}

// Tab-Wechsel bei offenem Sheet: Timeout abbrechen, Scroll-Sperre und
// Nav-z-index ausgleichen (analog zu den unmount()-Blöcken der Views).
export function unmountExerciseCreateSheet() {
  if (pendingExerciseCreateSheetCloseTimeout) {
    clearTimeout(pendingExerciseCreateSheetCloseTimeout);
    pendingExerciseCreateSheetCloseTimeout = null;
  }
  if (s.open) {
    s.open = false;
    s.closing = false;
    s.editingId = null;
    unlockBodyScroll();
    resetNavZIndex();
  }
}

// --- Neue-Übung-Sheet ---
//
// Überlagert das Übungs-Sheet (Stapel-Sheet, gleiche höhere z-Ebene wie das
// Übungs-Detail-Sheet - beide werden nur aus dem Übungs-Sheet heraus
// geöffnet und nie gleichzeitig, s. ADR 0011). Bis zur Vierundsechzigsten
// Iteration war "Neue Übung" ein Inline-Zustand innerhalb des Übungs-Sheets
// selbst; jetzt ein eigenes Sheet (Nutzer-Vorgabe) - Schließen führt dadurch
// automatisch nur zum Übungs-Sheet zurück (dessen `exerciseSheetOpen` bleibt
// währenddessen unverändert true), nicht zum Workout-Tab.
//
// Name-Feld optisch wie das Suchfeld (`bg-white/[0.08]`, Nutzer-Vorgabe) -
// bewusst OHNE eigenen Teil-Repaint-Mechanismus wie beim Suchfeld: Der
// eingegebene Name wird zwar bei jedem Zeichen in `state` gespiegelt (damit
// ein späterer, durch einen Muskel-Chip ausgelöster Repaint ihn nicht
// verliert), löst dabei aber selbst NIE einen Repaint aus - nur der
// "Erstellen"-Button wird direkt per DOM-API aktiviert/deaktiviert. Dadurch
// bleibt das `<input>` beim Tippen so oder so unangetastet, ganz ohne das
// erst kürzlich für die Übungssuche gelöste Repaint-Problem überhaupt erst
// zu riskieren.
// Chips bewusst flach (`px-3 py-1`, kein erzwungenes `min-h-[44px]` wie
// sonst überall in der App) - Nutzer-Wunsch, da hier viele Chips dicht an
// dicht in einem Raster stehen und die sonst übliche 44px-Touch-Ziel-Höhe
// das Raster unnötig aufbläht. Bewusste, lokal begrenzte Ausnahme vom
// Touch-Ziel-Standard.
function renderExerciseCreateSheetMuscleChip(muscle, role) {
  const isSelected =
    role === 'primary'
      ? s.primaryMuscleIds.has(muscle.id)
      : s.secondaryMuscleIds.has(muscle.id);
  // Ein Muskel, der schon in der jeweils anderen Liste gewählt ist, ist hier
  // deaktiviert - spiegelt die serverseitige Validierung in
  // validateMuscleAssignment() (js/db.js), die eine Überschneidung von
  // primären und sekundären Muskeln ablehnt (s. ADR 0013/0022). Seit ADR
  // 0022 in beide Richtungen symmetrisch (vorher nur sekundär gegen den
  // einen primären Muskel, da primär noch eine Einzelauswahl war).
  const isDisabled =
    role === 'primary'
      ? s.secondaryMuscleIds.has(muscle.id)
      : s.primaryMuscleIds.has(muscle.id);

  return `
    <button
      type="button"
      data-role="${role}"
      data-muscle="${muscle.id}"
      class="muscle-chip-btn tap-feedback rounded-full px-3 py-1 text-body ${isSelected ? 'bg-accent text-base' : 'bg-white/[0.08] text-ink'} ${isDisabled ? 'opacity-40 pointer-events-none' : ''}"
      ${isDisabled ? 'disabled' : ''}
    >
      ${escapeHtml(muscle.name)}
    </button>
  `;
}

function renderExerciseCreateSheetContent() {
  return `
    <form id="exercise-create-sheet-form" class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <label class="text-label-large text-muted" for="exercise-create-sheet-name-input">Name</label>
        <input
          id="exercise-create-sheet-name-input"
          type="text"
          autocomplete="off"
          placeholder="z. B. Latzug"
          value="${escapeHtml(s.name)}"
          class="w-full bg-white/[0.08] rounded-btn py-3 px-3 text-ink min-h-[44px]"
        />
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-label-large text-muted">Primäre Muskeln</span>
        <div class="flex flex-wrap gap-2">
          ${MUSCLES.map((m) => renderExerciseCreateSheetMuscleChip(m, 'primary')).join('')}
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-label-large text-muted">Sekundäre Muskeln</span>
        <div class="flex flex-wrap gap-2">
          ${MUSCLES.map((m) => renderExerciseCreateSheetMuscleChip(m, 'secondary')).join('')}
        </div>
      </div>
    </form>
  `;
}

// Kopfzeile bewusst ohne `closing`-Fallunterscheidung mehr (anders als die
// übrigen Sheets): Diese Funktion wird seit der Fünfundsechzigsten Iteration
// nur noch genau einmal beim Öffnen aufgerufen (s. openExerciseCreateSheet)
// - die closing-Animation läuft seitdem über direktes `classList.add()` auf
// den bereits bestehenden Elementen statt über ein Neu-Rendern mit
// `closing: true`, s. closeExerciseCreateSheet(). "Erstellen" ist jetzt ein
// Glass-Button mit Haken-Icon oben rechts statt eines Buttons unten
// (Nutzer-Wunsch) - `text-accent` + dezentes grünes Glimmen im aktivierten
// Zustand, `disabled:`-Varianten übernehmen automatisch den deaktivierten
// Look, sobald `submitBtn.disabled` gesetzt wird (s.
// wireExerciseCreateSheetContentEvents). `form="exercise-create-sheet-form"`
// verbindet den Button mit dem Formular, obwohl er außerhalb von dessen
// DOM-Teilbaum sitzt (natives HTML-Attribut, seit Langem in Safari
// unterstützt) - dadurch bleibt die Kopfzeile stabil und wird nie mit
// neu gerendert, während Formularfelder/Chips sich ändern.
function renderExerciseCreateSheet() {
  const canSubmit = s.name.trim().length > 0;
  const isEditing = s.editingId !== null;
  const z = s.z;

  return `
    <div id="exercise-create-sheet-backdrop" class="bottom-sheet-backdrop fixed inset-0 z-[${z.bg}] bg-black/50"></div>
    <div class="bottom-sheet fixed left-0 right-0 bottom-0 z-[${z.panel}] bg-surface rounded-sheet flex flex-col">
      <div class="grid grid-cols-[44px_1fr_44px] items-center px-4 pt-3 pb-5 flex-shrink-0">
        <button id="exercise-create-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div id="exercise-create-sheet-handle" class="justify-self-center flex items-center justify-center w-full py-3 min-h-[44px]" style="touch-action: none;">
          <span class="text-card-title">${isEditing ? 'Übung bearbeiten' : 'Neue Übung'}</span>
        </div>
        <button
          id="exercise-create-sheet-submit-btn"
          type="submit"
          form="exercise-create-sheet-form"
          class="icon-btn-glass icon-btn-glass-accent tap-feedback justify-self-end"
          aria-label="${isEditing ? 'Änderungen speichern' : 'Übung erstellen'}"
          ${canSubmit ? '' : 'disabled'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
      <div id="exercise-create-sheet-content" class="bottom-sheet-scroll flex-1 overflow-y-auto min-h-0 px-4 pb-[calc(env(safe-area-inset-bottom)+32px)]">
        ${renderExerciseCreateSheetContent()}
      </div>
    </div>
  `;
}

// Öffnet OHNE das globale paint() - das würde den kompletten Sheet-Teilbaum
// des bereits offenen Übungs-Sheets mit neu aufbauen (Backdrop/Panel
// destroy-und-neu-erzeugen), wodurch dessen Slide-/Fade-Animation trotz
// bereits sichtbarem Sheet erneut abspielen würde (Nutzer-Beobachtung, s.
// CHANGELOG). Stattdessen wird nur dieses Sheet direkt ans Ende des
// Containers angehängt - alles andere (inkl. des Übungs-Sheets darunter)
// bleibt exakt so bestehen, wie es war, und wird schlicht überlagert.
// Mit `editExerciseId` öffnet dasselbe Sheet im Bearbeiten-Modus (Felder aus
// der bestehenden Übung vorausgefüllt, s. s.editingId).
export async function openExerciseCreateSheet({ container: containerEl, editExerciseId = null, z, onSaved = null }) {
  if (s.open) return;
  container = containerEl;
  s.z = z;
  s.onSaved = onSaved;
  const exercise = editExerciseId ? await db.exercises.get(editExerciseId) : null;
  s.editingId = exercise?.id ?? null;
  s.open = true;
  s.closing = false;
  s.name = exercise?.name ?? '';
  s.primaryMuscleIds = new Set(exercise?.primaryMuscleIds ?? []);
  s.secondaryMuscleIds = new Set(exercise?.secondaryMuscleIds ?? []);
  lockBodyScroll();
  raiseNavAboveSheet();
  container.insertAdjacentHTML('beforeend', renderExerciseCreateSheet());
  wireExerciseCreateSheetEvents();
}

// Entfernt Backdrop + Panel direkt aus dem DOM (kein paint() mehr, s.
// openExerciseCreateSheet) - beide Referenzen werden VOR dem ersten Entfernen
// eingesammelt, da `nextElementSibling` nach dem Entfernen des Backdrops
// nicht mehr auffindbar wäre.
function finalizeExerciseCreateSheetClose() {
  pendingExerciseCreateSheetCloseTimeout = null;
  s.open = false;
  s.closing = false;
  s.editingId = null;
  unlockBodyScroll();
  resetNavZIndex();
  const backdrop = container?.querySelector('#exercise-create-sheet-backdrop');
  backdrop?.nextElementSibling?.remove();
  backdrop?.remove();
}

let pendingExerciseCreateSheetCloseTimeout = null;

// Setzt die `closing`-Klasse direkt auf die bestehenden Elemente (statt sie
// über ein Neu-Rendern zu erzeugen) - spielt dieselbe CSS-Schließen-
// Animation ab, ohne dass dabei irgendetwas anderes im DOM angefasst wird.
function closeExerciseCreateSheet() {
  if (!s.open || s.closing) return;
  s.closing = true;
  const backdrop = container.querySelector('#exercise-create-sheet-backdrop');
  backdrop?.nextElementSibling?.classList.add('closing');
  backdrop?.classList.add('closing');
  pendingExerciseCreateSheetCloseTimeout = setTimeout(finalizeExerciseCreateSheetClose, SHEET_CLOSE_ANIMATION_MS);
}

function wireExerciseCreateSheetDrag() {
  const backdropEl = container.querySelector('#exercise-create-sheet-backdrop');
  wireSheetDrag({
    handle: container.querySelector('#exercise-create-sheet-handle'),
    sheetEl: backdropEl?.nextElementSibling ?? null,
    backdropEl,
    isClosing: () => s.closing,
    onDismiss: () => {
      pendingExerciseCreateSheetCloseTimeout = setTimeout(finalizeExerciseCreateSheetClose, SHEET_CLOSE_ANIMATION_MS);
    },
  });
}

// Ersetzt nur `#exercise-create-sheet-content` (Muskel-Chip-Taps) - Backdrop/
// Panel/Kopfzeile (inkl. des "Erstellen"-Glass-Buttons) bleiben unangetastet,
// aus demselben Grund wie beim Übungs-Sheet (keine erneute Slide-Animation,
// s. dort).
function repaintExerciseCreateSheetContentInPlace() {
  const content = container?.querySelector('#exercise-create-sheet-content');
  if (!content) return;
  content.innerHTML = renderExerciseCreateSheetContent();
  wireExerciseCreateSheetContentEvents();
}

function wireExerciseCreateSheetContentEvents() {
  container.querySelector('#exercise-create-sheet-name-input')?.addEventListener('input', (e) => {
    s.name = e.target.value;
    // Kopfzeile wird hier bewusst NICHT neu gerendert (bleibt stabil) - nur
    // das `disabled`-Property des dort sitzenden Glass-Buttons wird direkt
    // umgeschaltet, den optischen Wechsel (grünes Glimmen an/aus) übernehmen
    // Tailwinds `disabled:`-Varianten automatisch über die native
    // `:disabled`-Pseudoklasse.
    const submitBtn = container.querySelector('#exercise-create-sheet-submit-btn');
    if (submitBtn) submitBtn.disabled = !e.target.value.trim();
  });

  container.querySelectorAll('.muscle-chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { role, muscle } = btn.dataset;
      if (role === 'primary') {
        // Seit ADR 0022 wie bei den sekundären Muskeln eine Mehrfachauswahl
        // (Toggle) statt einer Einzelauswahl - eine Übung kann jetzt mehrere
        // primäre Muskeln haben.
        if (s.primaryMuscleIds.has(muscle)) {
          s.primaryMuscleIds.delete(muscle);
        } else {
          s.primaryMuscleIds.add(muscle);
          // Falls derselbe Muskel bereits sekundär gewählt war, dort
          // entfernen - vermeidet die von validateMuscleAssignment()
          // abgelehnte primär=sekundär-Überschneidung von vornherein (die
          // Chips sind für diesen Fall ohnehin bereits gegenseitig
          // deaktiviert, s. renderExerciseCreateSheetMuscleChip()).
          s.secondaryMuscleIds.delete(muscle);
        }
      } else {
        if (s.secondaryMuscleIds.has(muscle)) {
          s.secondaryMuscleIds.delete(muscle);
        } else {
          s.secondaryMuscleIds.add(muscle);
          s.primaryMuscleIds.delete(muscle);
        }
      }
      repaintExerciseCreateSheetContentInPlace();
    });
  });

  container.querySelector('#exercise-create-sheet-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = s.name.trim();
    if (!name) return;

    const editingId = s.editingId;
    const assignment = {
      primaryMuscleIds: [...s.primaryMuscleIds],
      secondaryMuscleIds: [...s.secondaryMuscleIds],
    };
    let exercise;
    if (editingId) {
      await updateExercise(editingId, name, assignment);
      exercise = await db.exercises.get(editingId);
    } else {
      exercise = await createExercise(name, assignment);
    }
    // Schließen vor dem Callback: Alles hinter dem Sheet wird vom Aufrufer
    // sofort aktualisiert (sichtbar, sobald die Schließen-Animation den Blick
    // freigibt).
    const onSaved = s.onSaved;
    closeExerciseCreateSheet();
    await onSaved?.({ exercise, editing: Boolean(editingId) });
  });
}

function wireExerciseCreateSheetEvents() {
  container.querySelector('#exercise-create-sheet-backdrop')?.addEventListener('click', () => {
    closeExerciseCreateSheet();
  });

  container.querySelector('#exercise-create-sheet-close-btn')?.addEventListener('click', () => {
    closeExerciseCreateSheet();
  });

  wireExerciseCreateSheetDrag();
  wireExerciseCreateSheetContentEvents();
}
