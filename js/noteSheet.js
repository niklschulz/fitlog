import { setWorkoutExerciseNote, toISODate } from './db.js';
import { escapeHtml } from './utils.js';
import { formatDate } from './dates.js';
import { lockBodyScroll, unlockBodyScroll, wireSheetDrag, SHEET_CLOSE_ANIMATION_MS } from './sheet.js';

// Notiz-Sheet (s. ADR 0035): Bottom-Sheet mit einem Eingabefeld für
// die Notiz zu einer Übung an einem Workout-Tag. ✓ speichert und schließt,
// ✕/Wegziehen/Tap auf den Hintergrund schließt ohne Rückfrage und verwirft
// ungespeicherten Text. Eigener State statt View-State (wie
// exerciseCreateSheet.js): Der Aufrufer übergibt den Container, an den das
// Sheet angehängt wird, und einen `onSaved()`-Callback, der erst NACH der
// Schließen-Animation läuft - ein paint() der Detailseite ersetzt deren
// gesamten Container-Inhalt und würde das Sheet sonst mitten in der
// Animation entfernen. Aufrufer müssen in ihrem unmount()
// `unmountNoteSheet()` aufrufen.
//
// `bottom-sheet-scroll` am Eingabefeld ist Pflicht: lockBodyScroll() blockt
// per preventDefault jedes touchmove außerhalb dieser Klasse - das schloss
// auch das Ziehen der blauen iOS-Markierungsgriffe über mehrere Wörter aus.
//
// Das Eingabefeld ist bewusst ein `contenteditable`-Element statt eines
// `<textarea>`: iOS blendet über der Tastatur sonst die Formular-Leiste mit
// Pfeilen und Haken ein, die sich per Web-API nicht abschalten lässt.
//
// Bewusst ohne raiseNavAboveSheet(): Bei offener Tastatur wäre die Nav
// darüber nur im Weg (Referenz-Screenshot zeigt sie ebenfalls nicht).
let container = null;
let open = false;
let closing = false;
let pendingCloseTimeout = null;
let removeViewportListener = null;
let onSavedCallback = null;
let saved = false;

const NOTE_MAX_LENGTH = 500;

function placeCaretAtEnd(el) {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export function unmountNoteSheet() {
  if (pendingCloseTimeout) {
    clearTimeout(pendingCloseTimeout);
    pendingCloseTimeout = null;
  }
  if (open) {
    open = false;
    closing = false;
    removeViewportListener?.();
    removeViewportListener = null;
    unlockBodyScroll();
  }
}

// "Heute, 1. November" / "Gestern, 31. Oktober" / "Samstag, 25. Oktober"
function formatSheetDate(dateISO) {
  const dayMonth = formatDate(dateISO, 'dayMonthLong');
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (dateISO === toISODate(today)) return `Heute, ${dayMonth}`;
  if (dateISO === toISODate(yesterday)) return `Gestern, ${dayMonth}`;
  return `${formatDate(dateISO, 'weekdayLong')}, ${dayMonth}`;
}

function renderSheet({ exerciseName, dateISO, initialNote, z }) {
  const title = initialNote ? 'Notiz bearbeiten' : 'Notiz hinzufügen';
  return `
    <div id="note-sheet-backdrop" class="bottom-sheet-backdrop fixed inset-0 bg-black/50" style="z-index: ${z.bg};"></div>
    <div id="note-sheet-panel" class="bottom-sheet fixed left-0 right-0 bottom-0 bg-base rounded-sheet flex flex-col" style="z-index: ${z.panel};">
      <div class="grid grid-cols-[44px_1fr_44px] items-center px-4 pt-3 pb-5 flex-shrink-0">
        <button id="note-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div id="note-sheet-handle" class="w-full min-h-[44px]" style="touch-action: none;"></div>
        <button id="note-sheet-save-btn" type="button" class="icon-btn-glass icon-btn-glass-accent tap-feedback justify-self-end" aria-label="Notiz speichern">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
      <div class="px-4 pb-4 flex-shrink-0 flex flex-col gap-2">
        <h2 class="text-screen-title">${title}</h2>
        <p class="text-card-title mt-3 truncate">${escapeHtml(exerciseName)}</p>
        ${dateISO ? `<p class="text-label uppercase text-muted">${escapeHtml(formatSheetDate(dateISO))}</p>` : ''}
      </div>
      <div class="px-4 flex-1 min-h-0 flex flex-col">
        <div class="h-px bg-white/10 flex-shrink-0"></div>
        <div
          id="note-sheet-input"
          contenteditable="plaintext-only"
          role="textbox"
          aria-multiline="true"
          aria-label="Notiz"
          data-placeholder="Notiz zu dieser Übung…"
          class="note-sheet-input bottom-sheet-scroll flex-1 min-h-0 w-full overflow-y-auto text-ink outline-none pt-5 pb-4 whitespace-pre-wrap break-words"
          style="font-size: 16px; line-height: 1.4; -webkit-user-select: text; user-select: text;"
        >${escapeHtml(initialNote)}</div>
      </div>
    </div>
  `;
}

// Bewusst synchron (kein await vor dem focus()-Aufruf unten): iOS öffnet die
// Tastatur nur, wenn focus() noch innerhalb der Tipp-Geste läuft - ein
// DB-Zugriff davor hätte die Geste "verbraucht" und die Tastatur blieb zu.
// Name, Datum und bisherige Notiz liefert deshalb der Aufrufer, der sie
// beim Zeichnen der Seite ohnehin schon geladen hat.
//
// Zwei Verwendungen (s. ADR 0036): Notiz zu einer Übung an einem Workout-Tag
// (`entryId` + `dateISO`, Standard) oder dauerhafte Notiz zur Übung selbst
// (`saveNote`: eigene Speicher-Funktion, `dateISO: null` blendet die
// Datumszeile aus). `z` hebt das Sheet über andere Stapel-Sheets.
export function openNoteSheet({
  container: containerEl,
  entryId,
  exerciseName,
  dateISO,
  initialNote = '',
  onSaved = null,
  saveNote = null,
  z = { bg: 52, panel: 53 },
}) {
  if (open) return;
  container = containerEl;
  onSavedCallback = onSaved;
  saved = false;
  open = true;
  closing = false;
  lockBodyScroll();
  container.insertAdjacentHTML(
    'beforeend',
    renderSheet({
      exerciseName,
      dateISO: saveNote ? (dateISO ?? null) : (dateISO ?? toISODate(new Date())),
      initialNote,
      z,
    })
  );

  const input = container.querySelector('#note-sheet-input');
  const panel = container.querySelector('#note-sheet-panel');

  // iOS lässt das Layout-Viewport bei offener Tastatur unverändert und
  // überdeckt nur den unteren Teil. Das Sheet selbst bleibt deshalb bis zum
  // unteren Bildschirmrand gezogen (Hintergrund hinter der Tastatur), nur
  // sein Innenabstand unten wächst um die Tastaturhöhe - dadurch endet das
  // Textfeld an der Oberkante der Tastatur, der Cursor bleibt sichtbar.
  const vv = window.visualViewport;
  if (vv && panel) {
    const update = () => {
      panel.style.paddingBottom = `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`;
    };
    // Verschiebt iOS die Seite trotzdem (Tastatur schiebt den Viewport),
    // wird sie zurückgesetzt, damit die Kopfzeile des Sheets sichtbar bleibt.
    const onViewportScroll = () => {
      if (window.scrollY !== 0 || vv.pageTop !== 0) window.scrollTo(0, 0);
      update();
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', onViewportScroll);
    removeViewportListener = () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', onViewportScroll);
    };
  }

  // contenteditable kennt kein `maxlength` - Limit von Hand durchsetzen.
  input?.addEventListener('input', () => {
    if (input.innerText.length > NOTE_MAX_LENGTH) {
      input.innerText = input.innerText.slice(0, NOTE_MAX_LENGTH);
      placeCaretAtEnd(input);
    }
  });

  container.querySelector('#note-sheet-backdrop')?.addEventListener('click', closeSheet);
  container.querySelector('#note-sheet-close-btn')?.addEventListener('click', closeSheet);
  container.querySelector('#note-sheet-save-btn')?.addEventListener('click', async () => {
    if (closing) return;
    await (saveNote ? saveNote(input.innerText) : setWorkoutExerciseNote(entryId, input.innerText));
    saved = true;
    closeSheet();
  });
  wireDrag();

  // Fokus nach dem Einfügen, Cursor ans Textende.
  // preventScroll: Das Sheet startet per Slide-Animation unterhalb des
  // Bildschirms - ohne diese Option scrollt iOS beim Fokussieren dorthin und
  // schiebt dabei die ganze Seite (samt Sheet) nach oben, sodass die
  // Kopfzeile außer Sicht gerät.
  input?.focus({ preventScroll: true });
  placeCaretAtEnd(input);
}

function finalizeClose() {
  pendingCloseTimeout = null;
  open = false;
  closing = false;
  removeViewportListener?.();
  removeViewportListener = null;
  unlockBodyScroll();
  const backdrop = container?.querySelector('#note-sheet-backdrop');
  backdrop?.nextElementSibling?.remove();
  backdrop?.remove();
  const cb = saved ? onSavedCallback : null;
  onSavedCallback = null;
  cb?.();
}

function closeSheet() {
  if (!open || closing) return;
  closing = true;
  document.activeElement?.blur?.();
  const backdrop = container.querySelector('#note-sheet-backdrop');
  backdrop?.nextElementSibling?.classList.add('closing');
  backdrop?.classList.add('closing');
  pendingCloseTimeout = setTimeout(finalizeClose, SHEET_CLOSE_ANIMATION_MS);
}

function wireDrag() {
  const backdropEl = container.querySelector('#note-sheet-backdrop');
  wireSheetDrag({
    handle: container.querySelector('#note-sheet-handle'),
    sheetEl: backdropEl?.nextElementSibling ?? null,
    backdropEl,
    isClosing: () => closing,
    onDismiss: () => {
      closing = true;
      document.activeElement?.blur?.();
      pendingCloseTimeout = setTimeout(finalizeClose, SHEET_CLOSE_ANIMATION_MS);
    },
  });
}
