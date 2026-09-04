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
  routinePickerClosing: false,
  calendarSheetOpen: false,
  calendarSheetClosing: false,
};

export async function render(container) {
  currentContainer = container;
  state.expandedExerciseId = null;
  state.routinePickerOpen = false;
  state.routinePickerClosing = false;
  state.calendarSheetOpen = false;
  state.calendarSheetClosing = false;
  await paint();
}

// Wird von app.js aufgerufen, bevor zu einer anderen View gewechselt wird
// (s. showView()). Nötig, seit die Bottom-Nav bei offenem Kalender-Sheet
// nutzbar ist (s. raiseNavAboveCalendarSheet): Ein Tab-Wechsel während
// offenem/schließendem Sheet würde sonst dauerhaft die Body-Scroll-Sperre
// und den angehobenen Nav-z-index hinterlassen - und ein noch ausstehender
// Schließen-Timeout würde nachträglich paint() auf dem inzwischen von der
// neuen View belegten Container aufrufen.
export function unmount() {
  if (pendingCalendarSheetCloseTimeout) {
    clearTimeout(pendingCalendarSheetCloseTimeout);
    pendingCalendarSheetCloseTimeout = null;
  }
  unlockBodyScroll();
  resetNavZIndex();
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

// Montag der Woche, die dateStr enthält (ISO-Wochenstart).
function mondayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=So..6=Sa
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + diff);
  return toISODate(date);
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

// --- Monats-Hilfsfunktionen für den großen Kalender (Abschnitt 11) ---

// Fest ab Januar 2026 - App-Startzeitpunkt, keine Trainingsdaten davor möglich.
const CALENDAR_SHEET_MIN_MONTH = '2026-01';

function yearMonthOf(dateStr) {
  return dateStr.slice(0, 7);
}

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(yearMonth, delta) {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Ein Monat über den aktuellen Monat hinaus erreichbar - relativ zum
// echten heutigen Datum berechnet, nicht fest verdrahtet.
function calendarSheetMaxMonth() {
  return addMonths(currentYearMonth(), 1);
}

function monthLabel(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function daysInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${yearMonth}-${String(i + 1).padStart(2, '0')}`);
}

// Anzahl leerer Füllzellen vor dem 1. des Monats, damit die Wochentags-
// Spalten (Montag-Start) stimmen.
function leadingBlankCount(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const dow = new Date(y, m - 1, 1).getDay(); // 0=So..6=Sa
  return dow === 0 ? 6 : dow - 1;
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

// Wie getDatesWithSets, aber für einen zusammenhängenden Datumsbereich (statt
// einer expliziten Tagesliste) über eine einzige Range-Abfrage plus einen
// einzigen Sets-Bulk-Abruf - effizienter als N Einzelabfragen pro Monat, s.
// ADR 0009 (ersetzt das ursprüngliche Monats-für-Monat-Nachladen).
async function getDatesWithSetsInRange(fromDate, toDateExclusive) {
  const workouts = await db.workouts.where('date').between(fromDate, toDateExclusive, true, false).toArray();
  if (workouts.length === 0) return new Set();

  const dateByWorkoutId = Object.fromEntries(workouts.map((w) => [w.id, w.date]));
  const sets = await db.sets.where('workoutId').anyOf(Object.keys(dateByWorkoutId)).toArray();

  const result = new Set();
  for (const s of sets) {
    result.add(dateByWorkoutId[s.workoutId]);
  }
  return result;
}

// Alle im großen Kalender erreichbaren Monate, chronologisch.
function allowedSheetMonths() {
  const months = [];
  let ym = CALENDAR_SHEET_MIN_MONTH;
  const max = calendarSheetMaxMonth();
  while (ym <= max) {
    months.push(ym);
    ym = addMonths(ym, 1);
  }
  return months;
}

// Verhindert Scrollen des Workout-Tabs im Hintergrund, während das
// Kalender-Sheet offen ist.
//
// Frühere Version setzte body auf position:fixed (samt negativem
// top-Offset) - das ist auf dem Papier vom Sheet selbst (ebenfalls
// position:fixed) unabhängig, hat sich auf einem echten iPhone aber
// nachweislich auf dessen Positionierung ausgewirkt (Sheet zu weit unten UND
// weiterhin ein Lücke am unteren Rand statt exakt an bottom:0 zu sitzen) -
// vermutlich eine WebKit-Eigenheit, wie position:fixed auf body verschachtelte
// fixed-Elemente behandelt, die sich in der (Chromium-basierten) Testumgebung
// nicht nachstellen ließ. Stattdessen jetzt der einfachere, body selbst nicht
// aus dem normalen Fluss nehmende Ansatz: overflow:hidden auf body (blockiert
// Maus-/Tastatur-/Trackpad-Scroll) plus ein gezielter touchmove-Blocker für
// iOS' Rubber-Band-Scroll (den overflow:hidden allein auf Safari nicht immer
// verhindert) - der Blocker lässt Touch-Bewegungen innerhalb des
// Kalender-Monats-Bereichs explizit durch, damit das Sheet selbst weiter
// scrollbar bleibt.
let calendarSheetTouchBlocker = null;

function lockBodyScroll() {
  document.body.style.overflow = 'hidden';
  calendarSheetTouchBlocker = (e) => {
    if (e.target.closest('#calendar-sheet-months')) return;
    e.preventDefault();
  };
  document.addEventListener('touchmove', calendarSheetTouchBlocker, { passive: false });
}

function unlockBodyScroll() {
  document.body.style.overflow = '';
  if (calendarSheetTouchBlocker) {
    document.removeEventListener('touchmove', calendarSheetTouchBlocker);
    calendarSheetTouchBlocker = null;
  }
}

// Die Bottom-Nav liegt normalerweise unterhalb des Kalender-Sheets
// (z-20 vs. z-50/51) und wäre dadurch komplett verdeckt. Während das Sheet
// offen ist, wird ihr z-index per Inline-Style gezielt angehoben (höhere
// Priorität als jede Klassen-Regel, unabhängig von der CSS-Ladereihenfolge
// zwischen Tailwind und styles.css) - bewusst nur für die Dauer des
// Sheet-Lebenszyklus und nicht dauerhaft, damit andere Overlays (z. B. der
// Routine-Picker) weiterhin unbeeinflusst über der Nav liegen.
function raiseNavAboveCalendarSheet() {
  document.getElementById('bottom-nav')?.style.setProperty('z-index', '55');
}

function resetNavZIndex() {
  document.getElementById('bottom-nav')?.style.removeProperty('z-index');
}

// --- Paint ---

async function paint() {
  // Vorwoche, aktuelle Woche, folgende Woche (±1 Woche um die Auswahl) -
  // je ein 7-Tage-Block, s. renderCalendarStrip.
  const currentMonday = mondayOf(state.selectedDate);
  const weeks = [-1, 0, 1].map((offset) => {
    const weekStart = addDays(currentMonday, offset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  });
  const allDates = weeks.flat();
  const datesWithSets = await getDatesWithSets(allDates);

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
        <button id="open-date-picker-btn" class="tap-feedback min-w-[44px] min-h-[44px] text-muted" aria-label="Kalender öffnen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-[22px] h-[22px] ml-auto">
            <rect x="4" y="5.5" width="16" height="15" rx="3" />
            <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
          </svg>
        </button>
      </div>

      ${renderCalendarStrip(weeks, datesWithSets)}

      ${await renderRoutineSection(workout, routine)}

      ${renderExerciseRoster(entries, nameById, setsByExercise, expandedLastSet)}

      <button type="button" class="tap-feedback w-full flex items-center justify-center gap-2 py-3 min-h-[44px] text-muted opacity-60" disabled>
        <span class="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs leading-none">+</span>
        <span class="text-body font-medium">Übung hinzufügen</span>
      </button>
    </div>

    ${state.calendarSheetOpen ? await renderCalendarSheet() : ''}
  `;

  wireEvents();

  // Erst im nächsten Frame scrollen - direkt nach dem innerHTML-Update hat
  // der Browser das Layout des Scroll-Containers noch nicht fertig berechnet.
  requestAnimationFrame(() => {
    const weekBlock = currentContainer.querySelector('.calendar-week[data-week-start="' + currentMonday + '"]');
    weekBlock?.scrollIntoView({ block: 'nearest', inline: 'start' });
  });
}

// Kalenderzeile als Abfolge von Wochenblöcken. Jeder Wochenblock ist genau
// einen Bildschirm breit und der einzige Snap-Punkt (snap-start), wodurch
// die Zeile pro voller Woche einrastet statt pro Einzeltag. Innerhalb eines
// Blocks sitzen die 7 Tage per `flex justify-between` (nicht als
// Grid-Spalten mit gestrecktem Inhalt!) - jeder Tag ist ein eigenständiger,
// an seinem Inhalt (Wochentag-Text + Tageszahl, zueinander zentriert)
// bemessener Block, `justify-between` verteilt diese 7 Blöcke mit
// gleichmäßigem Abstand über die volle Breite und drückt dabei automatisch
// den ersten (Montag) an den linken und den letzten (Sonntag) an den
// rechten Rand - exakt linksbündig mit der "Workout"-Überschrift bzw.
// rechtsbündig mit dem Kalender-Icon.
//
// Der Abstand zwischen den Wochen (Orientierungshilfe zwischen Sonntag
// und Montag) läuft bewusst NICHT über die Flex-`gap`-Eigenschaft, da
// `gap` + `scroll-snap` in Safari/WebKit nicht immer zuverlässig
// zusammenspielen (bekannte Cross-Browser-Inkonsistenz) und dadurch die
// exakte Links-/Rechtsbündigkeit einer eingerasteten Woche verschieben
// konnte. Stattdessen ein expliziter, unsichtbarer Abstandshalter
// zwischen den Wochenblöcken - ein normales Flex-Kind ohne snap-Bezug,
// das die Snap-Position der Wochenblöcke selbst nicht beeinflussen kann.
const WEEK_GAP_PX = 24;

function renderCalendarStrip(weeks, datesWithSets) {
  const today = todayISODate();

  const weekBlocks = weeks.map(
    (week) => `
    <div class="calendar-week flex justify-between flex-shrink-0 w-full snap-start" data-week-start="${week[0]}">
      ${week
        .map((d) => {
          const { weekday, day } = formatDayLabel(d);
          const isSelected = d === state.selectedDate;
          const isToday = d === today;
          const hasDot = datesWithSets.has(d);
          const dayNumClasses = isSelected ? 'bg-accent text-base' : isToday ? 'text-accent' : 'text-ink';
          return `
          <button data-date="${d}" class="calendar-day-btn tap-feedback flex flex-col items-center gap-1.5 py-1 min-h-[44px]">
            <span class="text-label uppercase ${isSelected ? 'text-ink' : 'text-muted'}">${weekday}</span>
            <span class="text-card-title w-8 h-8 flex items-center justify-center rounded-lg ${dayNumClasses}">${day}</span>
            <span class="w-1.5 h-1.5 rounded-full ${hasDot ? 'bg-accent' : 'bg-transparent'}"></span>
          </button>
        `;
        })
        .join('')}
    </div>
  `
  );

  const spacer = `<div class="flex-shrink-0" style="width: ${WEEK_GAP_PX}px" aria-hidden="true"></div>`;

  return `
    <div class="flex snap-x snap-mandatory overflow-x-auto -mx-4 px-4 scroll-px-4">
      ${weekBlocks.join(spacer)}
    </div>
  `;
}

// --- Großer Kalender (Bottom-Sheet, Abschnitt 11) ---
//
// Rendert den kompletten erlaubten Datumsbereich auf einmal (nicht
// nachladend beim Scrollen) - der Bereich ist praktisch begrenzt (ab Januar
// 2026, wächst nur um einen Monat pro echtem Kalendermonat), eine einzige
// Bulk-Abfrage (getDatesWithSetsInRange) plus einmaliges HTML-Rendern ist
// dafür sowohl einfacher als auch spürbar flüssiger als das ursprüngliche
// Nachladen-beim-Scrollen, das durch die asynchronen DB-Abfragen mitten in
// der Scroll-Geste geruckelt hat. Details/Historie: ADR 0009 (löst ADR 0008 ab).

function renderSheetMonth(yearMonth, datesWithSets) {
  const days = daysInMonth(yearMonth);
  const blanks = leadingBlankCount(yearMonth);
  const today = todayISODate();

  return `
    <div class="calendar-sheet-month" data-year-month="${yearMonth}">
      <h3 class="text-card-title mb-3 capitalize">${monthLabel(yearMonth)}</h3>
      <div class="grid grid-cols-7 gap-y-3">
        ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
          .map((w) => `<div class="text-label uppercase text-muted text-center">${w}</div>`)
          .join('')}
        ${Array.from({ length: blanks })
          .map(() => `<div></div>`)
          .join('')}
        ${days
          .map((d) => {
            const isSelected = d === state.selectedDate;
            const isToday = d === today;
            const hasSets = datesWithSets.has(d);
            const dayNum = Number(d.slice(8, 10));
            // Dokumentierte Tage (und die Auswahl) bekommen einen gefüllten
            // Kreis - ein kleiner Punkt darunter war laut Nutzer-Feedback
            // optisch nicht ausreichend. "Heute" bekommt, wenn nicht
            // gleichzeitig dokumentiert/ausgewählt, einen ungefüllten Kreis
            // (nur Rand) - Auswahl/Dokumentation haben also Vorrang vor der
            // Heute-Markierung, analog zur Priorität in der kleinen
            // Kalenderzeile.
            const circleClasses =
              isSelected || hasSets ? 'bg-accent text-base' : isToday ? 'border-2 border-accent text-accent' : 'text-ink';
            return `
            <button data-date="${d}" class="calendar-sheet-day-btn tap-feedback flex items-center justify-center min-h-[44px]">
              <span class="text-card-title w-8 h-8 flex items-center justify-center rounded-full ${circleClasses}">${dayNum}</span>
            </button>
          `;
          })
          .join('')}
      </div>
    </div>
  `;
}

async function renderCalendarSheet() {
  const closing = state.calendarSheetClosing;
  const months = allowedSheetMonths();
  const fromDate = `${CALENDAR_SHEET_MIN_MONTH}-01`;
  const toDateExclusive = `${addMonths(calendarSheetMaxMonth(), 1)}-01`;
  const datesWithSets = await getDatesWithSetsInRange(fromDate, toDateExclusive);
  const monthSections = months.map((ym) => renderSheetMonth(ym, datesWithSets)).join('');

  return `
    <div id="calendar-sheet-backdrop" class="calendar-sheet-backdrop ${closing ? 'closing' : ''} fixed inset-0 z-50 bg-black/50"></div>
    <div class="calendar-sheet ${closing ? 'closing' : ''} fixed left-0 right-0 bottom-0 z-[51] bg-surface rounded-sheet flex flex-col" style="height: 88vh; height: 88dvh;">
      <div class="grid grid-cols-3 items-center px-4 pt-3 flex-shrink-0">
        <div aria-hidden="true"></div>
        <div id="calendar-sheet-handle" class="justify-self-center flex items-center justify-center w-full py-3 min-h-[44px]" style="touch-action: none;">
          <span class="w-9 h-1 rounded-full bg-white/25"></span>
        </div>
        <button id="calendar-sheet-today-btn" class="tap-feedback justify-self-end text-label font-semibold text-accent px-2 py-2 min-h-[44px]">Heute</button>
      </div>
      <div id="calendar-sheet-months" class="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+112px)] flex flex-col gap-6">
        ${monthSections}
      </div>
    </div>
  `;
}

// Chevron-zu-X-Icon aus zwei Balken, die zwischen einer Chevron- und einer
// X-Formation hin- und herschieben (s. .dropdown-chevron-icon in
// css/styles.css). Die Animationsklasse hängt direkt an
// state.routinePickerOpen/-Closing statt an einem separaten "hat sich
// gerade geändert"-Flag: Während der Picker offen ist, führt jede
// Nutzer-Interaktion zwangsläufig zu einem Schließen (Backdrop blockiert
// den Rest der Seite), es gibt also keinen Zwischenzustand, in dem ein
// erneutes Paint fälschlich eine Animation replayen würde.
function renderDropdownIcon(open, closing) {
  const stateClass = closing ? 'is-closing' : open ? 'is-open' : '';
  return `
    <span class="dropdown-chevron-icon ${stateClass} flex-shrink-0" aria-hidden="true">
      <span class="bar bar-a"></span>
      <span class="bar bar-b"></span>
    </span>
  `;
}

// Dropdown-Pill, die den Routine-Picker als Overlay öffnet (verdrängt den
// übrigen Inhalt nicht, s. wireEvents/Backdrop). Pfeil morpht bei
// geöffnetem Picker zu einem X, das ihn wieder schließt.
async function renderRoutineSection(workout, routine) {
  const label = !workout || !workout.routineId ? 'Routine wählen' : routine ? routine.name : 'Gelöschte Routine';
  const visible = state.routinePickerOpen;

  return `
    <div class="relative">
      <button id="routine-dropdown-btn" class="tap-feedback w-full bg-surface rounded-full pl-4 pr-3 py-3 min-h-[44px] flex items-center justify-between gap-2">
        <span class="text-card-title truncate">${escapeHtml(label)}</span>
        ${renderDropdownIcon(state.routinePickerOpen, state.routinePickerClosing)}
      </button>
      ${visible ? await renderRoutinePicker(workout) : ''}
    </div>
  `;
}

// Poppt beim Öffnen aus der Dropdown-Pille heraus (CSS-Animation spielt
// automatisch beim Einfügen ins DOM). Zum Schließen wird erst die
// "closing"-Klasse gesetzt (spielt die Umkehr-Animation) und das Element
// nach Ablauf der Animationsdauer per Timeout wirklich entfernt, s.
// closeRoutinePicker() in wireEvents.
async function renderRoutinePicker(workout) {
  const routines = await db.routines.orderBy('name').toArray();
  const closing = state.routinePickerClosing;

  return `
    <div id="routine-picker-backdrop" class="fixed inset-0 z-30"></div>
    <div class="routine-picker-popup ${closing ? 'closing' : ''} absolute left-0 right-0 top-[calc(100%+8px)] z-40 bg-surface rounded-card p-3 flex flex-col gap-2 shadow-lg shadow-black/40">
      ${
        routines.length === 0
          ? `<p class="text-body text-muted py-2">Noch keine Routinen vorhanden.</p>`
          : `<ul class="flex flex-col gap-1 max-h-64 overflow-y-auto">
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
      <button id="go-to-routines-option-btn" class="tap-feedback w-full text-left rounded-btn px-3 py-2 min-h-[44px] text-accent text-body font-medium">
        Alle Routinen anzeigen
      </button>
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

// Spielt die Schließen-Animation ab und entfernt den Picker erst danach
// wirklich aus dem DOM (muss zur Dauer von .routine-picker-popup.closing
// in css/styles.css passen).
const ROUTINE_PICKER_CLOSE_ANIMATION_MS = 150;

function closeRoutinePicker() {
  if (!state.routinePickerOpen || state.routinePickerClosing) return;
  state.routinePickerClosing = true;
  paint();
  setTimeout(() => {
    state.routinePickerOpen = false;
    state.routinePickerClosing = false;
    paint();
  }, ROUTINE_PICKER_CLOSE_ANIMATION_MS);
}

// Öffnet den Kalender, sperrt das Hintergrund-Scrollen (s.
// lockBodyScroll) und scrollt nach dem Paint zum Monat des aktuell
// gewählten Tages.
async function openCalendarSheet() {
  state.calendarSheetOpen = true;
  state.calendarSheetClosing = false;
  lockBodyScroll();
  raiseNavAboveCalendarSheet();
  // paint() muss vor dem Scroll-Versuch fertig sein - es lädt die
  // Kalenderdaten asynchron (getDatesWithSetsInRange), das innerHTML steht
  // also erst nach dem await tatsächlich im DOM.
  await paint();

  requestAnimationFrame(() => {
    const targetMonth = yearMonthOf(state.selectedDate);
    const monthEl = currentContainer.querySelector(`.calendar-sheet-month[data-year-month="${targetMonth}"]`);
    monthEl?.scrollIntoView({ block: 'start' });
  });
}

// Analog zu closeRoutinePicker: erst die Schließen-Animation abspielen
// (muss zur Dauer von .calendar-sheet.closing in css/styles.css passen),
// danach erst wirklich aus dem State/DOM entfernen und das
// Hintergrund-Scrollen wieder freigeben. finalizeCalendarSheetClose ist der
// gemeinsame Abschluss-Schritt für diesen Weg UND für das Drag-to-Dismiss
// (s. wireCalendarSheetDrag) - dort läuft die Animation über eine direkte
// Transform-Transition statt der CSS-Keyframes, das Zurücksetzen von State
// und Body-Scroll-Lock ist aber identisch.
const CALENDAR_SHEET_CLOSE_ANIMATION_MS = 200;

function finalizeCalendarSheetClose() {
  pendingCalendarSheetCloseTimeout = null;
  state.calendarSheetOpen = false;
  state.calendarSheetClosing = false;
  unlockBodyScroll();
  resetNavZIndex();
  paint();
}

// Hält die ID des ausstehenden Abschluss-Timeouts fest (Schließen-Animation
// noch nicht fertig). Muss in unmount() abgebrochen werden können: Wechselt
// der Nutzer den Tab, während die Animation noch läuft (jetzt möglich, da
// die Nav währenddessen nutzbar ist, s. raiseNavAboveCalendarSheet), würde
// der verzögerte finalizeCalendarSheetClose()-Aufruf sonst noch nachträglich
// paint() auf dem inzwischen von einer anderen View belegten Container
// aufrufen und deren Inhalt überschreiben.
let pendingCalendarSheetCloseTimeout = null;

function closeCalendarSheet() {
  if (!state.calendarSheetOpen || state.calendarSheetClosing) return;
  state.calendarSheetClosing = true;
  paint();
  pendingCalendarSheetCloseTimeout = setTimeout(finalizeCalendarSheetClose, CALENDAR_SHEET_CLOSE_ANIMATION_MS);
}

// Drag-to-Dismiss am Ziehgriff: Der Griff selbst wird per Pointer Events
// (touch- und mausfähig) verfolgt, Sheet und Backdrop werden währenddessen
// direkt per Inline-Style bewegt/abgeblendet (außerhalb von paint(), da wir
// hier 1:1 dem Finger folgen müssen statt in Render-Zyklen zu denken).
// `touch-action: none` auf dem Griff (s. renderCalendarSheet) verhindert,
// dass Safari die Geste stattdessen als Seiten-Scroll interpretiert.
const CALENDAR_SHEET_DRAG_CLOSE_THRESHOLD_PX = 120;
let calendarSheetDrag = null;

function wireCalendarSheetDrag() {
  const handle = currentContainer.querySelector('#calendar-sheet-handle');
  const sheetEl = currentContainer.querySelector('.calendar-sheet');
  const backdropEl = currentContainer.querySelector('#calendar-sheet-backdrop');
  if (!handle || !sheetEl || !backdropEl) return;

  handle.addEventListener('pointerdown', (e) => {
    if (state.calendarSheetClosing) return;
    calendarSheetDrag = { startY: e.clientY };
    sheetEl.style.transition = 'none';
    backdropEl.style.transition = 'none';
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // Kein aktiver Pointer mit dieser ID (z. B. bei synthetischen Events) -
      // die Drag-Logik selbst funktioniert auch ohne Capture weiter, nur
      // ohne die Garantie, dass Move-Events bei schnellen Gesten am
      // Element "kleben" bleiben.
    }
  });

  handle.addEventListener('pointermove', (e) => {
    if (!calendarSheetDrag) return;
    const delta = Math.max(0, e.clientY - calendarSheetDrag.startY);
    sheetEl.style.transform = `translateY(${delta}px)`;
    backdropEl.style.opacity = String(1 - Math.min(delta / sheetEl.offsetHeight, 1));
  });

  const endDrag = (e) => {
    if (!calendarSheetDrag) return;
    const delta = Math.max(0, e.clientY - calendarSheetDrag.startY);
    calendarSheetDrag = null;

    sheetEl.style.transition = `transform ${CALENDAR_SHEET_CLOSE_ANIMATION_MS}ms ease`;
    backdropEl.style.transition = `opacity ${CALENDAR_SHEET_CLOSE_ANIMATION_MS}ms ease`;

    if (delta > CALENDAR_SHEET_DRAG_CLOSE_THRESHOLD_PX) {
      sheetEl.style.transform = 'translateY(100%)';
      backdropEl.style.opacity = '0';
      pendingCalendarSheetCloseTimeout = setTimeout(finalizeCalendarSheetClose, CALENDAR_SHEET_CLOSE_ANIMATION_MS);
    } else {
      sheetEl.style.transform = 'translateY(0)';
      backdropEl.style.opacity = '1';
      setTimeout(() => {
        sheetEl.style.transition = '';
        sheetEl.style.transform = '';
        backdropEl.style.transition = '';
        backdropEl.style.opacity = '';
      }, CALENDAR_SHEET_CLOSE_ANIMATION_MS);
    }
  };

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}

function wireEvents() {
  currentContainer.querySelectorAll('.calendar-day-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedDate = btn.dataset.date;
      state.expandedExerciseId = null;
      state.routinePickerOpen = false;
      state.routinePickerClosing = false;
      paint();
    });
  });

  currentContainer.querySelector('#open-date-picker-btn')?.addEventListener('click', () => {
    openCalendarSheet();
  });

  currentContainer.querySelector('#calendar-sheet-backdrop')?.addEventListener('click', () => {
    closeCalendarSheet();
  });

  // Springt nur innerhalb des großen Kalenders zum heutigen Monat, wählt
  // den Tag NICHT aus und schließt das Sheet nicht - anders als ein Tap auf
  // einen Tag, der sofort navigiert. Reine Scroll-Hilfe.
  currentContainer.querySelector('#calendar-sheet-today-btn')?.addEventListener('click', () => {
    const todayMonth = yearMonthOf(todayISODate());
    const monthEl = currentContainer.querySelector(`.calendar-sheet-month[data-year-month="${todayMonth}"]`);
    monthEl?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  wireCalendarSheetDrag();

  // Delegierter Listener auf dem Container statt auf jedem Tages-Button
  // einzeln, konsistent mit den übrigen Listen in dieser View.
  currentContainer.querySelector('#calendar-sheet-months')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.calendar-sheet-day-btn');
    if (!btn) return;
    state.selectedDate = btn.dataset.date;
    state.expandedExerciseId = null;
    closeCalendarSheet();
  });

  currentContainer.querySelector('#routine-dropdown-btn')?.addEventListener('click', () => {
    if (state.routinePickerOpen) {
      closeRoutinePicker();
    } else {
      state.routinePickerOpen = true;
      paint();
    }
  });

  currentContainer.querySelector('#routine-picker-backdrop')?.addEventListener('click', () => {
    closeRoutinePicker();
  });

  currentContainer.querySelector('#go-to-routines-option-btn')?.addEventListener('click', () => {
    document.querySelector('[data-view="routines"]')?.click();
  });

  currentContainer.querySelectorAll('.pick-routine-option-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      // Klick auf die bereits ausgewählte Routine entfernt sie wieder
      // (Toggle) statt eines separaten "Keine Routine"-Buttons.
      const existingWorkout = await getWorkoutByDate(state.selectedDate);
      if (existingWorkout?.routineId === btn.dataset.routine) {
        await removeRoutineFromWorkout(existingWorkout.id);
      } else {
        const workout = await getOrCreateWorkoutForDate(state.selectedDate);
        await applyRoutineToWorkout(workout.id, btn.dataset.routine);
      }
      closeRoutinePicker();
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
