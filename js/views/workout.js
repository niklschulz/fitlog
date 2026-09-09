import {
  db,
  getWorkoutByDate,
  getOrCreateWorkoutForDate,
  getWorkoutExercises,
  applyRoutineToWorkout,
  removeRoutineFromWorkout,
  addExercisesToWorkout,
  createExercise,
  MUSCLE_GROUPS,
  todayISODate,
  toISODate,
} from '../db.js';
import { escapeHtml, renderSetTimelineRow, renderSetValues, TEXTLINK_ACTION, BTN_PRIMARY, INPUT, CARD, LIST_ROW, withViewTransition } from '../utils.js';
import {
  lockBodyScroll,
  unlockBodyScroll,
  raiseNavAboveSheet,
  resetNavZIndex,
  wireSheetDrag,
  SHEET_CLOSE_ANIMATION_MS,
} from '../sheet.js';
import * as exerciseDetail from './workout-exercise-detail.js';

let currentContainer = null;
let state = {
  selectedDate: todayISODate(),
  detailEntryId: null, // workoutExercises.id der geöffneten Übungs-Detailseite (Abschnitt 12), oder null für die Tagesübersicht
  routinePickerOpen: false,
  routinePickerClosing: false,
  calendarSheetOpen: false,
  calendarSheetClosing: false,
  // Übungs-Sheet (Abschnitt 13): Übungen ansehen/auswählen/neu anlegen, um
  // sie gesammelt zum Tages-Workout hinzuzufügen, s. ADR 0011.
  exerciseSheetOpen: false,
  exerciseSheetClosing: false,
  exerciseSheetMode: 'list', // 'list' | 'create'
  exerciseSheetSelectedIds: new Set(),
  exerciseSheetSearch: '',
  // Muskelgruppen-Filter (Dropdown-Pill, analog zur Routine-Auswahl oben) -
  // null = "Alle Muskelgruppen" (kein Filter aktiv), sonst eine MUSCLE_GROUPS-id.
  exerciseSheetMuscleFilterId: null,
  exerciseSheetMuscleFilterOpen: false,
  exerciseSheetMuscleFilterClosing: false,
  // Übungs-Detail-Sheet: überlagert das Übungs-Sheet (Stapel-Sheet), öffnet
  // sich bei Tap auf eine Übungszeile. Inhalt bewusst noch Platzhalter -
  // Konzept für die eigentlichen Details folgt separat.
  exerciseDetailSheetOpen: false,
  exerciseDetailSheetClosing: false,
  exerciseDetailSheetExerciseId: null,
};

// Erhöht sich bei jedem render()/unmount() (= neue Mount-Instanz dieser
// View). paint() merkt sich beim Start seinen aktuellen Wert und prüft ihn
// erneut, nachdem alle asynchronen DB-Abfragen durchgelaufen sind: Wurde in
// der Zwischenzeit der Tab gewechselt (unmount() erhöht den Zähler ebenso
// wie ein erneutes render()), bricht der veraltete paint()-Aufruf ab, statt
// den inzwischen von einer anderen View belegten Container per innerHTML zu
// überschreiben. Ohne diese Sperre reicht es, das Kalender-Sheet oder den
// Routine-Picker zu schließen und sofort den Tab zu wechseln, um die neue
// View mit dem alten Workout-Inhalt zu überschreiben (im Kalender-Fall sogar
// inklusive eines unsichtbaren, aber weiterhin klickfangenden Backdrops -
// das Schließen selbst löst ja außerhalb dieses Zählers direkt einen
// eigenen, nicht abwartbaren paint()-Aufruf aus, s. closeCalendarSheet()).
let renderEpoch = 0;

export async function render(container) {
  renderEpoch++;
  currentContainer = container;
  state.detailEntryId = null;
  state.routinePickerOpen = false;
  state.routinePickerClosing = false;
  state.calendarSheetOpen = false;
  state.calendarSheetClosing = false;
  state.exerciseSheetOpen = false;
  state.exerciseSheetClosing = false;
  state.exerciseSheetMode = 'list';
  state.exerciseSheetSelectedIds = new Set();
  state.exerciseSheetSearch = '';
  state.exerciseSheetMuscleFilterId = null;
  state.exerciseSheetMuscleFilterOpen = false;
  state.exerciseSheetMuscleFilterClosing = false;
  state.exerciseDetailSheetOpen = false;
  state.exerciseDetailSheetClosing = false;
  state.exerciseDetailSheetExerciseId = null;
  await paint();
}

// Wird von app.js aufgerufen, bevor zu einer anderen View gewechselt wird
// (s. showView()). Nötig, seit die Bottom-Nav bei offenem Sheet nutzbar ist
// (s. raiseNavAboveSheet in js/sheet.js): Ein Tab-Wechsel während
// offenem/schließendem Sheet würde sonst dauerhaft die Body-Scroll-Sperre
// und den angehobenen Nav-z-index hinterlassen - und ein noch ausstehender
// Schließen-Timeout würde nachträglich paint() auf dem inzwischen von der
// neuen View belegten Container aufrufen. Jedes Sheet, das beim Verlassen
// noch offen war (open bleibt bei "closing" true, s. closeCalendarSheet()
// & Co.), hatte genau einen unbeantworteten lockBodyScroll()/
// raiseNavAboveSheet()-Aufruf - hier wird er exakt einmal pro betroffenem
// Sheet ausgeglichen, nicht pauschal (s. js/sheet.js zur Zähl-Logik, die
// gleichzeitig offene Stapel-Sheets wie Übungen+Übungs-Detail erlaubt).
export function unmount() {
  renderEpoch++;
  if (pendingCalendarSheetCloseTimeout) {
    clearTimeout(pendingCalendarSheetCloseTimeout);
    pendingCalendarSheetCloseTimeout = null;
  }
  if (pendingRoutinePickerCloseTimeout) {
    clearTimeout(pendingRoutinePickerCloseTimeout);
    pendingRoutinePickerCloseTimeout = null;
  }
  if (pendingExerciseSheetCloseTimeout) {
    clearTimeout(pendingExerciseSheetCloseTimeout);
    pendingExerciseSheetCloseTimeout = null;
  }
  if (pendingExerciseSheetMuscleFilterCloseTimeout) {
    clearTimeout(pendingExerciseSheetMuscleFilterCloseTimeout);
    pendingExerciseSheetMuscleFilterCloseTimeout = null;
  }
  if (pendingExerciseDetailSheetCloseTimeout) {
    clearTimeout(pendingExerciseDetailSheetCloseTimeout);
    pendingExerciseDetailSheetCloseTimeout = null;
  }
  if (state.calendarSheetOpen) {
    unlockBodyScroll();
    resetNavZIndex();
  }
  if (state.exerciseSheetOpen) {
    unlockBodyScroll();
    resetNavZIndex();
  }
  if (state.exerciseDetailSheetOpen) {
    unlockBodyScroll();
    resetNavZIndex();
  }
  // War die Übungs-Detailseite (Abschnitt 12) gerade aktiv, hat auch sie
  // noch einen eigenen renderEpoch-Zähler (s. dort) - unconditional
  // aufrufen ist harmlos, falls sie gar nicht aktiv war (kein aktueller
  // paint()-Aufruf, den es zu invalidieren gäbe).
  exerciseDetail.unmount();
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

// Body-Scroll-Sperre, Bottom-Nav-z-index-Anhebung und Drag-to-Dismiss sind
// generisch in js/sheet.js (s. Import oben, ADR 0011) - hier nur noch die
// Kalender-eigene Verwendung davon (Öffnen/Schließen-Zustand, Ziel-Monat).

// --- Paint ---

async function paint() {
  const myEpoch = renderEpoch;

  // Übungs-Detailseite (Abschnitt 12) ersetzt die Tagesübersicht komplett,
  // solange sie offen ist - eigenständiges Sub-View-Modul, verwaltet sich
  // ab hier vollständig selbst (eigenes render()/paint()/wireEvents()).
  // onBack räumt nur den State hier auf und rendert die Tagesübersicht neu.
  if (state.detailEntryId) {
    await exerciseDetail.render(currentContainer, {
      entryId: state.detailEntryId,
      onBack: () => {
        // Sub-View wird verlassen, noch bevor die Tagesübersicht neu
        // gerendert wird - ein zu diesem Zeitpunkt evtl. noch laufender
        // paint()-Aufruf der Detailseite (z. B. durch einen vorherigen
        // Reiter-Wechsel dort ausgelöst) darf den Container nicht mehr
        // überschreiben, sobald er fertig wird (s. exerciseDetail.unmount()).
        exerciseDetail.unmount();
        withViewTransition(() => {
          state.detailEntryId = null;
          paint();
        }, 'back');
      },
    });
    return;
  }

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

  const html = `
    <div class="py-4 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-screen-title">Workout</h1>
          <p class="text-body text-muted">${formatFullDate(state.selectedDate)}</p>
        </div>
        <button id="open-date-picker-btn" class="icon-btn-glass tap-feedback text-ink" aria-label="Kalender öffnen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <rect x="4" y="5.5" width="16" height="15" rx="3" />
            <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
          </svg>
        </button>
      </div>

      ${renderCalendarStrip(weeks, datesWithSets)}

      ${await renderRoutineSection(workout, routine)}

      ${renderExerciseRoster(entries, nameById, setsByExercise)}

      <button id="add-exercise-to-workout-btn" type="button" class="tap-feedback w-full flex items-center justify-center py-3 min-h-[44px] ${TEXTLINK_ACTION}">
        Übung hinzufügen
      </button>
    </div>

    ${state.calendarSheetOpen ? await renderCalendarSheet() : ''}
    ${state.exerciseSheetOpen ? renderExerciseSheet() : ''}
    ${state.exerciseDetailSheetOpen ? await renderExerciseDetailSheet() : ''}
  `;

  // Tab kann während der obigen awaits gewechselt worden sein (s. renderEpoch
  // oben) - ein veralteter paint()-Aufruf darf den inzwischen von einer
  // anderen View belegten Container nicht mehr überschreiben.
  if (myEpoch !== renderEpoch) return;

  currentContainer.innerHTML = html;
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
            // "Heute" bekommt immer nur einen ungefüllten Kreis (Rand) - auch
            // wenn der Tag zugleich ausgewählt ist oder bereits Sätze
            // dokumentiert sind. Hat also Vorrang vor beidem (anders als die
            // vorherige Priorität, bei der Auswahl/Dokumentation "heute"
            // überstimmt haben). Dokumentierte/ausgewählte Tage, die NICHT
            // heute sind, bekommen weiterhin den gefüllten Kreis - ein
            // kleiner Punkt darunter war laut Nutzer-Feedback optisch nicht
            // ausreichend.
            const circleClasses = isToday
              ? 'border-2 border-accent text-accent'
              : isSelected || hasSets
                ? 'bg-accent text-base'
                : 'text-ink';
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
    <div id="calendar-sheet-backdrop" class="bottom-sheet-backdrop ${closing ? 'closing' : ''} fixed inset-0 z-50 bg-black/50"></div>
    <div class="bottom-sheet ${closing ? 'closing' : ''} fixed left-0 right-0 bottom-0 z-[51] bg-surface rounded-sheet flex flex-col">
      <div class="grid grid-cols-3 items-center px-4 pt-3 pb-6 flex-shrink-0">
        <button id="calendar-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Kalender schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div id="calendar-sheet-handle" class="justify-self-center flex items-center justify-center w-full py-3 min-h-[44px]" style="touch-action: none;">
          <span class="text-card-title">Kalender</span>
        </div>
        <button id="calendar-sheet-today-btn" type="button" class="icon-btn-glass tap-feedback justify-self-end text-ink" aria-label="Zu heute springen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <rect x="4" y="5.5" width="16" height="15" rx="3" />
            <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
            <circle cx="12" cy="15.5" r="1.6" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>
      <div id="calendar-sheet-months" class="bottom-sheet-scroll flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+112px)] flex flex-col gap-6">
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
      <button id="routine-dropdown-btn" class="tap-feedback w-full bg-surface rounded-btn pl-4 pr-3 py-3 min-h-[44px] flex items-center justify-between gap-2">
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
  const exerciseCounts = await Promise.all(
    routines.map((r) => db.routineExercises.where('routineId').equals(r.id).count())
  );
  const closing = state.routinePickerClosing;

  return `
    <div id="routine-picker-backdrop" class="fixed inset-0 z-30"></div>
    <div class="routine-picker-popup ${closing ? 'closing' : ''} absolute left-0 right-0 top-[calc(100%+8px)] z-40 bg-surface rounded-card p-3 flex flex-col gap-2 shadow-lg shadow-black/40">
      ${
        routines.length === 0
          ? `<p class="text-body text-muted px-3 py-2">Noch keine Routinen vorhanden.</p>`
          : `<ul class="flex flex-col gap-1 max-h-64 overflow-y-auto">
              ${routines
                .map(
                  (r, i) => `
                <li>
                  <button data-routine="${r.id}" class="pick-routine-option-btn tap-feedback w-full text-left rounded-btn px-3 py-2 min-h-[44px] bg-surface text-ink text-body flex items-center justify-between">
                    <span class="flex flex-col gap-0.5">
                      <span>${escapeHtml(r.name)}</span>
                      <span class="text-label text-muted uppercase">${exerciseCounts[i]} Übung${exerciseCounts[i] === 1 ? '' : 'en'}</span>
                    </span>
                    ${r.id === workout?.routineId ? '<span class="text-accent">✓</span>' : ''}
                  </button>
                </li>
              `
                )
                .join('')}
            </ul>`
      }
      <button id="go-to-routines-option-btn" class="tap-feedback w-full text-left rounded-btn px-3 py-2 min-h-[44px] ${TEXTLINK_ACTION}">
        Alle Routinen anzeigen
      </button>
    </div>
  `;
}

function renderExerciseRoster(entries, nameById, setsByExercise) {
  if (entries.length === 0) {
    return `<p class="text-body text-muted text-center py-6">Noch keine Übungen in diesem Workout.</p>`;
  }

  return `
    <ul class="flex flex-col gap-2">
      ${entries.map((entry) => renderExerciseRow(entry, nameById[entry.exerciseId], setsByExercise[entry.exerciseId] ?? [])).join('')}
    </ul>
  `;
}

// Tap öffnet die Übungs-Detailseite (Abschnitt 12) statt wie zuvor eine
// Inline-Akkordeon-Erweiterung - s. exercise-row-toggle in wireEvents().
function renderExerciseRow(entry, name, sets) {
  const label = name ?? 'Gelöschte Übung';
  const setRows = sets
    .map((s, i) =>
      renderSetTimelineRow(i + 1, renderSetValues(s.weight, s.reps), { isLast: i === sets.length - 1 })
    )
    .join('');

  return `
    <li class="bg-surface rounded-card overflow-hidden">
      <button data-entry="${entry.id}" class="exercise-row-toggle tap-feedback w-full text-left px-4 py-3 min-h-[44px] flex flex-col gap-1">
        <span class="text-card-title ${name ? '' : 'italic text-muted'}">${escapeHtml(label)}</span>
        ${sets.length > 0 ? `<ul class="flex flex-col mt-2">${setRows}</ul>` : ''}
      </button>
    </li>
  `;
}

// --- Events ---

// Spielt die Schließen-Animation ab und entfernt den Picker erst danach
// wirklich aus dem DOM (muss zur Dauer von .routine-picker-popup.closing
// in css/styles.css passen).
const ROUTINE_PICKER_CLOSE_ANIMATION_MS = 150;

// Muss in unmount() abgebrochen werden können - analog zu
// pendingCalendarSheetCloseTimeout (s. dort für die Begründung: ein
// Tab-Wechsel während der Picker noch schließt, würde sonst diesen Timeout
// unangetastet weiterlaufen lassen).
let pendingRoutinePickerCloseTimeout = null;

function closeRoutinePicker() {
  if (!state.routinePickerOpen || state.routinePickerClosing) return;
  state.routinePickerClosing = true;
  paint();
  pendingRoutinePickerCloseTimeout = setTimeout(() => {
    pendingRoutinePickerCloseTimeout = null;
    state.routinePickerOpen = false;
    state.routinePickerClosing = false;
    paint();
  }, ROUTINE_PICKER_CLOSE_ANIMATION_MS);
}

// Analog zu closeRoutinePicker(), s. dort für die Begründung von Timing/
// Aufräum-Timeout.
let pendingExerciseSheetMuscleFilterCloseTimeout = null;

function closeExerciseSheetMuscleFilter() {
  if (!state.exerciseSheetMuscleFilterOpen || state.exerciseSheetMuscleFilterClosing) return;
  state.exerciseSheetMuscleFilterClosing = true;
  repaintExerciseSheetContentInPlace();
  pendingExerciseSheetMuscleFilterCloseTimeout = setTimeout(() => {
    pendingExerciseSheetMuscleFilterCloseTimeout = null;
    state.exerciseSheetMuscleFilterOpen = false;
    state.exerciseSheetMuscleFilterClosing = false;
    repaintExerciseSheetContentInPlace();
  }, ROUTINE_PICKER_CLOSE_ANIMATION_MS);
}

// Öffnet den Kalender, sperrt das Hintergrund-Scrollen (s. js/sheet.js) und
// scrollt nach dem Paint zum Monat des aktuell gewählten Tages.
async function openCalendarSheet() {
  state.calendarSheetOpen = true;
  state.calendarSheetClosing = false;
  lockBodyScroll();
  raiseNavAboveSheet();
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
// (muss zur Dauer von .bottom-sheet.closing in css/styles.css passen),
// danach erst wirklich aus dem State/DOM entfernen und das
// Hintergrund-Scrollen wieder freigeben. finalizeCalendarSheetClose ist der
// gemeinsame Abschluss-Schritt für diesen Weg UND für das Drag-to-Dismiss
// (s. wireSheetDrag in js/sheet.js) - dort läuft die Animation über eine
// direkte Transform-Transition statt der CSS-Keyframes, das Zurücksetzen
// von State und Body-Scroll-Lock ist aber identisch.
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
// die Nav währenddessen nutzbar ist, s. raiseNavAboveSheet), würde der
// verzögerte finalizeCalendarSheetClose()-Aufruf sonst noch nachträglich
// paint() auf dem inzwischen von einer anderen View belegten Container
// aufrufen und deren Inhalt überschreiben.
let pendingCalendarSheetCloseTimeout = null;

function closeCalendarSheet() {
  if (!state.calendarSheetOpen || state.calendarSheetClosing) return;
  state.calendarSheetClosing = true;
  paint();
  pendingCalendarSheetCloseTimeout = setTimeout(finalizeCalendarSheetClose, SHEET_CLOSE_ANIMATION_MS);
}

function wireCalendarSheetDrag() {
  const backdropEl = currentContainer.querySelector('#calendar-sheet-backdrop');
  wireSheetDrag({
    handle: currentContainer.querySelector('#calendar-sheet-handle'),
    // Mehrere `.bottom-sheet`-Elemente können gleichzeitig im DOM stehen
    // (Übungs-Sheet + Übungs-Detail-Sheet sind gestapelt) - der eindeutige
    // Backdrop identifiziert zuverlässig sein eigenes Panel als direkten
    // Nachbarn, statt sich auf die (dann mehrdeutige) generische Klasse zu
    // verlassen. Kalender-/Übungs-Sheet sind zwar nie gleichzeitig offen,
    // dieselbe robuste Selektion wird hier trotzdem einheitlich verwendet.
    sheetEl: backdropEl?.nextElementSibling ?? null,
    backdropEl,
    isClosing: () => state.calendarSheetClosing,
    onDismiss: () => {
      pendingCalendarSheetCloseTimeout = setTimeout(finalizeCalendarSheetClose, SHEET_CLOSE_ANIMATION_MS);
    },
  });
}

// --- Übungs-Sheet (Abschnitt 13) ---
//
// Zwei Inhalts-Zustände (`state.exerciseSheetMode`) innerhalb desselben
// Sheets statt eigener Sub-Views, analog zum Muster in exercises.js/
// routines.js: 'list' (Übungen ansehen/auswählen/suchen) und 'create'
// (Name-Formular für eine neue Übung). Mehrfachauswahl statt Sofort-
// Hinzufügen (Nutzer-Vorgabe) - `exerciseSheetSelectedIds` sammelt IDs, ein
// Tap auf den Übungsnamen selbst öffnet stattdessen das gestapelte
// Übungs-Detail-Sheet (s. unten), Löschen ist bewusst nicht Teil dieses
// Sheets (Nutzer-Vorgabe - bleibt vorerst dem Übungen-Tab vorbehalten, s.
// CHANGELOG).
//
// Die Übungsliste + der heutige Roster-Stand werden einmalig beim Öffnen
// geladen und in `exerciseSheetCache` gehalten, statt bei jedem Tastendruck
// im Suchfeld neu aus der DB zu fragen: Die Suche selbst ist ein reiner
// In-Memory-Filter über die bereits geladene Liste (Datenmenge einer
// Einzelnutzer-App ist dafür klein genug, s. ADR 0009) - dadurch kann
// `renderExerciseSheet()` synchron bleiben und `repaintExerciseSheetBodyInPlace()`
// (s. dort) ohne jeden `await` auskommen. Das ist kein Stil-Detail, sondern
// nötig: Ein volles `paint()` (mit eigenen DB-Abfragen) bei jedem Zeichen
// würde erstens unnötig oft den kompletten restlichen Tab neu laden und
// zweitens - da `paint()`-Aufrufe sich nicht gegenseitig abbrechen, s.
// renderEpoch weiter oben - bei schnellem Tippen in falscher Reihenfolge
// fertig werden können und einen älteren Suchstand zuletzt anzeigen.
let exerciseSheetCache = { allExercises: [], inWorkoutIds: new Set() };

async function loadExerciseSheetCache() {
  const workout = await getWorkoutByDate(state.selectedDate);
  const inWorkoutIds = new Set(workout ? (await getWorkoutExercises(workout.id)).map((e) => e.exerciseId) : []);
  const allExercises = await db.exercises.orderBy('name').toArray();
  exerciseSheetCache = { allExercises, inWorkoutIds };
}

// Rein optische Bug-Fix-Historie (s. CHANGELOG): Backdrop und `.bottom-sheet`
// tragen die Slide-/Fade-Einstiegs-Animation als CSS-`animation`-Property -
// die spielt bei JEDEM Einfügen dieser Elemente ins DOM erneut ab, nicht nur
// beim allerersten Öffnen. Würde `renderExerciseSheet()` (das den kompletten
// `#exercise-sheet-root`-Teilbaum inkl. Backdrop/Panel erzeugt) bei jeder
// Sheet-interner Interaktion (Suche tippen, Muskel-Filter öffnen/schließen/
// auswählen, Modus wechseln) neu aufgerufen und eingesetzt, würde das
// gesamte Sheet dabei jedes Mal sichtbar erneut von unten hereinrutschen.
// Deshalb bleiben Backdrop und `.bottom-sheet` (samt Kopfzeilen-Grundgerüst:
// Schließen-Button, Titel/Ziehgriff) nach dem initialen Öffnen unangetastet
// - nur zwei innere, stabil per ID adressierbare Teilbäume werden bei
// internen Interaktionen ausgetauscht: `#exercise-sheet-header-action`
// (der "+"-Button bzw. Platzhalter, ändert sich nur bei Modus-Wechsel) und
// `#exercise-sheet-content` (Suchfeld, Muskel-Filter, Liste, Commit-Leiste -
// ändert sich bei Suche/Filter/Auswahl/Modus). s.
// repaintExerciseSheetContentInPlace().
function renderExerciseSheetHeaderAction() {
  return state.exerciseSheetMode === 'list'
    ? `<button id="exercise-sheet-new-btn" type="button" class="icon-btn-glass tap-feedback text-ink" aria-label="Neue Übung erstellen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>`
    : '<div aria-hidden="true"></div>';
}

// Reine Listen-/Formular-Inhalt von `#exercise-sheet-body` - ausgelagert,
// damit die Sucheingabe (s. repaintExerciseSheetBodyInPlace()) NUR diesen
// engsten möglichen Teilbaum ersetzen kann, ohne Suchfeld, Muskel-Filter
// oder Kopfzeile anzufassen. Wichtig, nicht nur Kosmetik: Das <input>
// selbst darf beim Tippen nie zerstört/neu erzeugt werden (s. CHANGELOG) -
// sonst bricht sowohl die gefühlte Reaktionsgeschwindigkeit als auch iOS'
// natives Key-Repeat beim Gedrückthalten der Löschen-Taste, das denselben
// fokussierten DOM-Knoten über die ganze Wiederholungs-Geste hinweg
// voraussetzt.
function renderExerciseSheetBody() {
  const { allExercises, inWorkoutIds } = exerciseSheetCache;
  const selectedIds = state.exerciseSheetSelectedIds;

  const query = state.exerciseSheetSearch.trim().toLowerCase();
  let filteredExercises = query ? allExercises.filter((ex) => ex.name.toLowerCase().includes(query)) : allExercises;

  // Muskelgruppen-Filter: trifft, wenn die gewählte Muskelgruppe entweder
  // primär oder sekundär an der Übung beteiligt ist (nicht nur primär) -
  // z. B. soll ein "Trizeps"-Filter auch enge Bankdrücken-Varianten zeigen,
  // bei denen Trizeps nur sekundär mitarbeitet. Übungen ohne Zuordnung
  // (primaryMuscleId/secondaryMuscleIds `undefined`, s. ADR 0013) fallen bei
  // aktivem Filter automatisch raus.
  const muscleFilterId = state.exerciseSheetMuscleFilterId;
  if (muscleFilterId) {
    filteredExercises = filteredExercises.filter(
      (ex) => ex.primaryMuscleId === muscleFilterId || (ex.secondaryMuscleIds ?? []).includes(muscleFilterId)
    );
  }

  return state.exerciseSheetMode === 'create'
    ? renderExerciseCreateForm()
    : renderExerciseSheetList(filteredExercises, inWorkoutIds, selectedIds, allExercises.length);
}

function renderExerciseSheetContent() {
  const hasCommitBar = state.exerciseSheetMode === 'list' && state.exerciseSheetSelectedIds.size > 0;

  return `
    ${state.exerciseSheetMode === 'list' ? renderExerciseSheetSearchBar() : ''}
    ${state.exerciseSheetMode === 'list' ? renderExerciseSheetMuscleFilter() : ''}
    <div id="exercise-sheet-body" class="bottom-sheet-scroll flex-1 overflow-y-auto px-4 ${hasCommitBar ? 'pb-4' : 'pb-[calc(env(safe-area-inset-bottom)+112px)]'} flex flex-col gap-2">
      ${renderExerciseSheetBody()}
    </div>
    ${hasCommitBar ? renderExerciseSheetCommitBar(state.exerciseSheetSelectedIds.size) : ''}
  `;
}

function renderExerciseSheet() {
  const closing = state.exerciseSheetClosing;

  return `
    <div id="exercise-sheet-root">
      <div id="exercise-sheet-backdrop" class="bottom-sheet-backdrop ${closing ? 'closing' : ''} fixed inset-0 z-50 bg-black/50"></div>
      <div class="bottom-sheet ${closing ? 'closing' : ''} fixed left-0 right-0 bottom-0 z-[51] bg-surface rounded-sheet flex flex-col">
        <div class="grid grid-cols-3 items-center px-4 pt-3 pb-5 flex-shrink-0">
          <button id="exercise-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Übungen schließen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div id="exercise-sheet-handle" class="justify-self-center flex items-center justify-center w-full py-3 min-h-[44px]" style="touch-action: none;">
            <span class="text-card-title">Übungen</span>
          </div>
          <div id="exercise-sheet-header-action" class="justify-self-end">${renderExerciseSheetHeaderAction()}</div>
        </div>
        <div id="exercise-sheet-content" class="flex-1 min-h-0 flex flex-col">
          ${renderExerciseSheetContent()}
        </div>
      </div>
    </div>
  `;
}

// Ersetzt nur `#exercise-sheet-header-action` und `#exercise-sheet-content`
// (s. Kommentar bei renderExerciseSheetHeaderAction) - komplett synchron,
// liest wie renderExerciseSheet() nur aus dem bereits geladenen
// exerciseSheetCache. Deckt alle Sheet-internen Interaktionen ab (Suche,
// Muskel-Filter, Auswahl, Modus-Wechsel, Übung anlegen) - nur das initiale
// Öffnen und das Schließen des gesamten Sheets laufen weiterhin über das
// normale `paint()` (dort SOLL die Slide-Animation spielen).
function repaintExerciseSheetContentInPlace() {
  const headerAction = currentContainer?.querySelector('#exercise-sheet-header-action');
  if (headerAction) headerAction.innerHTML = renderExerciseSheetHeaderAction();

  const content = currentContainer?.querySelector('#exercise-sheet-content');
  if (!content) return;
  content.innerHTML = renderExerciseSheetContent();
  wireExerciseSheetContentEvents();
}

// Ersetzt NUR `#exercise-sheet-body` - der engste mögliche Teilbaum, der bei
// einer Sucheingabe tatsächlich betroffen ist (Suchfeld, Muskel-Filter und
// Kopfzeile bleiben unangetastet). Entscheidend: Das Such-`<input>` selbst
// liegt außerhalb von `#exercise-sheet-body` und wird hier nie berührt -
// Fokus, Cursor-Position und iOS' natives Key-Repeat (Löschen-Taste
// gedrückt halten) funktionieren dadurch komplett nativ, ganz ohne
// manuelles `.focus()`/`setSelectionRange()`-Nachstellen wie zuvor.
function repaintExerciseSheetBodyInPlace() {
  const body = currentContainer?.querySelector('#exercise-sheet-body');
  if (!body) return;
  body.innerHTML = renderExerciseSheetBody();
  wireExerciseSheetBodyEvents();
}

// Eigene, nicht scrollende Flex-Zone zwischen Kopfzeile und Liste (nur im
// 'list'-Zustand) - Lupe als absolut positioniertes Icon links im Feld
// (`pointer-events-none`, damit Klicks durchgereicht werden), sonst dasselbe
// visuelle Muster wie andere Inputs (`rounded-btn`, `min-h-[44px]`), nur mit
// angepasstem Innenabstand links statt der geteilten `INPUT`-Konstante.
// Hintergrund bewusst `bg-white/8` statt des sonst üblichen `bg-base`: Das
// Feld sitzt hier direkt auf der `bg-surface`-Sheet-Fläche, nicht wie sonst
// innerhalb einer zusätzlichen Karte - `bg-base` (dunkler als `bg-surface`)
// wäre dort nicht als "heller = Eingabefeld" lesbar. Ein halbtransparentes
// Weiß hebt sich unabhängig vom exakten darunterliegenden Farbwert ab, s.
// design-system.md "Input" für die etablierte Variante.
function renderExerciseSheetSearchBar() {
  return `
    <div class="px-4 pb-2 flex-shrink-0">
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M20 20l-4.7-4.7" />
          </svg>
        </span>
        <input
          id="exercise-sheet-search-input"
          type="text"
          inputmode="search"
          autocomplete="off"
          placeholder="Suche"
          value="${escapeHtml(state.exerciseSheetSearch)}"
          class="w-full bg-white/[0.08] rounded-btn py-3 pl-10 pr-3 text-ink min-h-[44px]"
        />
      </div>
    </div>
  `;
}

// Dropdown-Pill für den Muskelgruppen-Filter - 1:1 dasselbe visuelle/
// interaktive Muster wie die Routine-Auswahl oben im Roster
// (`renderRoutineSection()`/`renderRoutinePicker()`), mit einer bewussten
// Abweichung: Hintergrund `bg-white/[0.08]` statt `bg-surface`, damit der
// geschlossene Button optisch zur Farbe des Suchfelds direkt darüber passt
// (beide sitzen unmittelbar auf der `bg-surface`-Sheet-Fläche, s.
// design-system.md "Input"). Sonst identisch: `rounded-btn`-Pille mit Label
// + morphendem Chevron/X-Icon (`renderDropdownIcon()`, geteilt mit der
// Routine-Auswahl), öffnet beim Tap ein `absolute` positioniertes Popup mit
// Options-Liste (bleibt `bg-surface rounded-card` wie der Routine-Picker -
// ein Popup-Menü, kein Eingabefeld, s. "Karte/Formular"-Stil) + eigenem,
// bildschirmfüllendem Backdrop zum Schließen bei Klick außerhalb. Eigener
// State (`exerciseSheetMuscleFilterOpen/-Closing`) statt Wiederverwendung
// von `routinePickerOpen`, da beide unabhängig voneinander offen sein
// können müssten (hier: nie gleichzeitig sichtbar, da unterschiedliche
// Sheets/Views, aber konzeptionell getrennte Zustände).
function renderExerciseSheetMuscleFilter() {
  const selected = MUSCLE_GROUPS.find((m) => m.id === state.exerciseSheetMuscleFilterId);
  const label = selected ? selected.name : 'Alle Muskelgruppen';
  const visible = state.exerciseSheetMuscleFilterOpen;

  return `
    <div class="px-4 pb-4 flex-shrink-0">
      <div class="relative">
        <button id="exercise-sheet-muscle-filter-btn" type="button" class="tap-feedback w-full bg-white/[0.08] rounded-btn pl-4 pr-3 py-3 min-h-[44px] flex items-center justify-between gap-2">
          <span class="text-card-title truncate">${escapeHtml(label)}</span>
          ${renderDropdownIcon(state.exerciseSheetMuscleFilterOpen, state.exerciseSheetMuscleFilterClosing)}
        </button>
        ${visible ? renderExerciseSheetMuscleFilterPicker() : ''}
      </div>
    </div>
  `;
}

// Abweichungen vom Routine-Picker-Vorbild (Nutzer-Wunsch): Hintergrund
// optisch identisch zu Suchfeld/Filter-Button (s. Neunundfünfzigste
// Iteration), aber als DECKENDE Hex-Farbe statt `bg-white/[0.08]` - anders
// als das Suchfeld liegt dieses Popup über scrollbarem Listen-Inhalt
// (`absolute` über der Übungsliste), ein halbtransparenter Hintergrund
// ließe die Liste sichtbar durchscheinen. `#363636` = `rgba(255,255,255,
// 0.08)` über `bg-surface` (`#252525`) gerechnet (Canvas-`globalCompositeOperation`
// im Browser verifiziert) - optisch ununterscheidbar vom Suchfeld, aber
// deckend. Zeilen-Buttons selbst bleiben transparent (kein eigener
// Hintergrund) - Nutzer-Entscheidung nach Live-Vorschau, sie sollen nicht
// als abgesetzte Kästchen wirken, nur der Abstand trennt sie. Engster
// Zeilenabstand (`gap-0`, mehrfach auf Nutzer-Wunsch verringert von `gap-1`
// über `gap-0.5`) - hier nur einzeilige Einträge ohne Untertitel, anders als
// die Routine-Optionen mit Name+Übungsanzahl. Kein `max-h`/Scroll: Die Liste
// ist mit neun festen Einträgen (8 Muskelgruppen + "Alle") kurz genug, um
// immer vollständig zu passen.
function renderExerciseSheetMuscleFilterPicker() {
  const closing = state.exerciseSheetMuscleFilterClosing;
  const selectedId = state.exerciseSheetMuscleFilterId;

  const optionsHtml = [{ id: '', name: 'Alle Muskelgruppen' }, ...MUSCLE_GROUPS]
    .map(
      (m) => `
        <li>
          <button data-muscle="${m.id}" class="pick-muscle-filter-option-btn tap-feedback w-full text-left rounded-btn px-3 py-2 min-h-[44px] text-ink text-body flex items-center justify-between">
            <span>${escapeHtml(m.name)}</span>
            ${(m.id === '' ? selectedId === null : selectedId === m.id) ? '<span class="text-accent">✓</span>' : ''}
          </button>
        </li>
      `
    )
    .join('');

  return `
    <div id="exercise-sheet-muscle-filter-backdrop" class="fixed inset-0 z-30"></div>
    <div class="routine-picker-popup ${closing ? 'closing' : ''} absolute left-0 right-0 top-[calc(100%+8px)] z-40 bg-[#363636] rounded-card p-3 flex flex-col gap-2 shadow-lg shadow-black/40">
      <ul class="flex flex-col gap-0">
        ${optionsHtml}
      </ul>
    </div>
  `;
}

function renderExerciseSheetList(filteredExercises, inWorkoutIds, selectedIds, totalCount) {
  if (totalCount === 0) {
    return `<p class="text-body text-muted text-center py-12">Noch keine Übungen angelegt. Tippe oben rechts auf „+", um die erste zu erstellen.</p>`;
  }
  if (filteredExercises.length === 0) {
    return `<p class="text-body text-muted text-center py-12">Keine Übungen gefunden.</p>`;
  }

  return `
    <ul class="flex flex-col gap-2">
      ${filteredExercises
        .map((ex) => renderExerciseSheetRow(ex, inWorkoutIds.has(ex.id), selectedIds.has(ex.id)))
        .join('')}
    </ul>
  `;
}

// Führende Spalte zeigt entweder den Auswahl-Kreis (antippbar, toggelt
// exerciseSheetSelectedIds) oder - für Übungen, die heute schon im Roster
// stehen - ein rein informatives, deaktiviertes Häkchen-Badge (Nutzer-
// Vorgabe: sichtbar lassen statt ausblenden, das Sheet dient auch zum
// Ansehen). Der Name selbst ist immer ein eigenes Tap-Ziel zum Übungs-
// Detail-Sheet, unabhängig vom Auswahl-/Bereits-Vorhanden-Status.
function renderExerciseSheetRow(exercise, alreadyInWorkout, isSelected) {
  const leadingColumn = alreadyInWorkout
    ? `<span class="min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0" aria-hidden="true">
        <span class="w-6 h-6 rounded-full flex items-center justify-center bg-raised text-muted text-label">✓</span>
      </span>`
    : `<button type="button" data-id="${exercise.id}" class="exercise-select-toggle-btn tap-feedback min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0" aria-pressed="${isSelected}" aria-label="${escapeHtml(exercise.name)} ${isSelected ? 'abwählen' : 'auswählen'}">
        <span class="w-6 h-6 rounded-full flex items-center justify-center text-label ${isSelected ? 'bg-accent' : 'border-2 border-white/25'}">${isSelected ? '✓' : ''}</span>
      </button>`;

  return `
    <li class="${LIST_ROW} flex items-center gap-3">
      ${leadingColumn}
      <button type="button" data-id="${exercise.id}" class="exercise-open-detail-btn tap-feedback flex-1 text-left text-card-title truncate">
        ${escapeHtml(exercise.name)}
      </button>
    </li>
  `;
}

function renderExerciseCreateForm() {
  return `
    <form id="exercise-create-form" class="flex flex-col gap-3 ${CARD}">
      <label class="text-label text-muted" for="new-exercise-name">Name</label>
      <input
        id="new-exercise-name"
        name="name"
        type="text"
        autocomplete="off"
        placeholder="z. B. Kniebeuge"
        class="bg-base ${INPUT}"
        required
      />
      <div class="flex gap-3">
        <button type="submit" class="tap-feedback flex-1 ${BTN_PRIMARY} py-3 min-h-[44px]">
          Erstellen
        </button>
        <button type="button" id="exercise-create-cancel-btn" class="tap-feedback px-4 py-3 text-muted min-h-[44px]">
          Abbrechen
        </button>
      </div>
    </form>
  `;
}

// Nicht Teil der scrollenden Liste, sondern eine eigene, nicht schrumpfende
// Flex-Zone unter ihr (nur gerendert, solange ≥1 Übung ausgewählt ist) -
// bekommt dieselbe Bottom-Nav-Abstandsreserve wie sonst die Kalender-Liste
// (die Nav schwebt während offenem Sheet per raiseNavAboveSheet über allem),
// damit der Button nicht dahinter verschwindet.
function renderExerciseSheetCommitBar(count) {
  return `
    <div class="flex-shrink-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+112px)]">
      <button type="button" id="exercise-sheet-commit-btn" class="tap-feedback w-full ${BTN_PRIMARY} py-3 min-h-[44px]">
        Hinzufügen (${count})
      </button>
    </div>
  `;
}

async function openExerciseSheet() {
  state.exerciseSheetOpen = true;
  state.exerciseSheetClosing = false;
  state.exerciseSheetMode = 'list';
  state.exerciseSheetSelectedIds = new Set();
  state.exerciseSheetSearch = '';
  state.exerciseSheetMuscleFilterId = null;
  state.exerciseSheetMuscleFilterOpen = false;
  state.exerciseSheetMuscleFilterClosing = false;
  lockBodyScroll();
  raiseNavAboveSheet();
  await loadExerciseSheetCache();
  await paint();
}

function finalizeExerciseSheetClose() {
  pendingExerciseSheetCloseTimeout = null;
  state.exerciseSheetOpen = false;
  state.exerciseSheetClosing = false;
  unlockBodyScroll();
  resetNavZIndex();
  paint();
}

let pendingExerciseSheetCloseTimeout = null;

function closeExerciseSheet() {
  if (!state.exerciseSheetOpen || state.exerciseSheetClosing) return;
  state.exerciseSheetClosing = true;
  paint();
  pendingExerciseSheetCloseTimeout = setTimeout(finalizeExerciseSheetClose, SHEET_CLOSE_ANIMATION_MS);
}

function wireExerciseSheetDrag() {
  const backdropEl = currentContainer.querySelector('#exercise-sheet-backdrop');
  wireSheetDrag({
    handle: currentContainer.querySelector('#exercise-sheet-handle'),
    sheetEl: backdropEl?.nextElementSibling ?? null,
    backdropEl,
    isClosing: () => state.exerciseSheetClosing,
    onDismiss: () => {
      pendingExerciseSheetCloseTimeout = setTimeout(finalizeExerciseSheetClose, SHEET_CLOSE_ANIMATION_MS);
    },
  });
}

// Root-Listener: nur Elemente, die außerhalb von `#exercise-sheet-content`
// liegen und deshalb nie von `repaintExerciseSheetContentInPlace()`
// ersetzt/neu verdrahtet werden (Backdrop, Schließen-Button, Drag-Ziehgriff).
// Läuft ausschließlich nach einem vollen `paint()` - danach übernimmt
// `wireExerciseSheetContentEvents()` (unten) für alles, was sich bei
// Sheet-internen Interaktionen ändert. Der Auslöse-Button
// `#add-exercise-to-workout-btn` sitzt außerhalb des Sheets (Teil des
// Rosters) und bleibt deshalb im normalen `wireEvents()`.
function wireExerciseSheetEvents() {
  currentContainer.querySelector('#exercise-sheet-backdrop')?.addEventListener('click', () => {
    closeExerciseSheet();
  });

  currentContainer.querySelector('#exercise-sheet-close-btn')?.addEventListener('click', () => {
    closeExerciseSheet();
  });

  wireExerciseSheetDrag();
  wireExerciseSheetContentEvents();
}

// Verdrahtet `#exercise-sheet-header-action` + `#exercise-sheet-content` -
// aufgerufen sowohl aus wireExerciseSheetEvents() (nach vollem paint()) als
// auch aus repaintExerciseSheetContentInPlace() (nach jedem gezielten
// Teil-Ersetzen dieser beiden Teilbäume, s. dort). Löst diese Interaktionen
// deshalb bewusst NICHT über das volle paint(), sondern über den Teil-
// Repaint aus, damit Backdrop/`.bottom-sheet` unangetastet bleiben (keine
// erneute Slide-Animation, s. Kommentar bei renderExerciseSheetHeaderAction).
function wireExerciseSheetContentEvents() {
  currentContainer.querySelector('#exercise-sheet-new-btn')?.addEventListener('click', () => {
    state.exerciseSheetMode = 'create';
    repaintExerciseSheetContentInPlace();
  });

  currentContainer.querySelector('#exercise-create-cancel-btn')?.addEventListener('click', () => {
    state.exerciseSheetMode = 'list';
    repaintExerciseSheetContentInPlace();
  });

  currentContainer.querySelector('#exercise-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    if (!name) return;

    const exercise = await createExercise(name);
    await loadExerciseSheetCache();
    state.exerciseSheetSelectedIds.add(exercise.id);
    state.exerciseSheetMode = 'list';
    repaintExerciseSheetContentInPlace();
  });

  // Aktualisiert nur den Suchbegriff im State und rendert per
  // repaintExerciseSheetBodyInPlace() ausschließlich `#exercise-sheet-body`
  // neu - das Such-`<input>` selbst wird dabei nie angefasst, Fokus und
  // Cursor-Position bleiben deshalb automatisch erhalten (kein manuelles
  // Nachstellen mehr nötig, anders als beim vorherigen, zu breiten
  // Content-Repaint, s. CHANGELOG).
  const searchInput = currentContainer.querySelector('#exercise-sheet-search-input');
  searchInput?.addEventListener('input', (e) => {
    state.exerciseSheetSearch = e.target.value;
    repaintExerciseSheetBodyInPlace();
  });

  currentContainer.querySelector('#exercise-sheet-muscle-filter-btn')?.addEventListener('click', () => {
    if (state.exerciseSheetMuscleFilterOpen) {
      closeExerciseSheetMuscleFilter();
    } else {
      state.exerciseSheetMuscleFilterOpen = true;
      repaintExerciseSheetContentInPlace();
    }
  });

  currentContainer.querySelector('#exercise-sheet-muscle-filter-backdrop')?.addEventListener('click', () => {
    closeExerciseSheetMuscleFilter();
  });

  currentContainer.querySelectorAll('.pick-muscle-filter-option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.exerciseSheetMuscleFilterId = btn.dataset.muscle === '' ? null : btn.dataset.muscle;
      closeExerciseSheetMuscleFilter();
    });
  });

  wireExerciseSheetBodyEvents();

  currentContainer.querySelector('#exercise-sheet-commit-btn')?.addEventListener('click', async () => {
    const workout = await getOrCreateWorkoutForDate(state.selectedDate);
    await addExercisesToWorkout(workout.id, [...state.exerciseSheetSelectedIds]);
    closeExerciseSheet();
  });
}

// Listener für alles innerhalb von `#exercise-sheet-body` - aufgerufen sowohl
// aus wireExerciseSheetContentEvents() (nach vollem Content-Repaint) als auch
// aus repaintExerciseSheetBodyInPlace() (nach dem engen Teil-Repaint bei
// jedem Tastendruck im Suchfeld, s. dort). Auswahl-Toggle löst trotzdem den
// breiteren Content-Repaint aus (nicht nur den Body-Repaint), da sich dabei
// die außerhalb von `#exercise-sheet-body` liegende Commit-Leiste
// mit-ändern kann (erscheint/verschwindet je nach Auswahl-Anzahl).
function wireExerciseSheetBodyEvents() {
  currentContainer.querySelectorAll('.exercise-select-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (state.exerciseSheetSelectedIds.has(id)) {
        state.exerciseSheetSelectedIds.delete(id);
      } else {
        state.exerciseSheetSelectedIds.add(id);
      }
      repaintExerciseSheetContentInPlace();
    });
  });

  currentContainer.querySelectorAll('.exercise-open-detail-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      openExerciseDetailSheet(btn.dataset.id);
    });
  });
}

// --- Übungs-Detail-Sheet ---
//
// Überlagert das Übungs-Sheet (Stapel-Sheet, höhere z-Ebene) statt es zu
// ersetzen - Tap auf eine Übungszeile öffnet dieses zweite Sheet obendrauf,
// das darunterliegende bleibt offen/sichtbar. Inhalt ist bewusst noch ein
// Platzhalter (Konzept für die eigentlichen Details/Löschen-Aktion folgt
// separat, s. CHANGELOG) - Kopfzeile und Sheet-Mechanik sind aber bereits
// vollständig, damit später nur noch der Body-Inhalt ergänzt werden muss.
async function renderExerciseDetailSheet() {
  const closing = state.exerciseDetailSheetClosing;
  const exercise = await db.exercises.get(state.exerciseDetailSheetExerciseId);
  const name = exercise?.name ?? 'Gelöschte Übung';

  return `
    <div id="exercise-detail-sheet-backdrop" class="bottom-sheet-backdrop ${closing ? 'closing' : ''} fixed inset-0 z-[52] bg-black/50"></div>
    <div class="bottom-sheet ${closing ? 'closing' : ''} fixed left-0 right-0 bottom-0 z-[53] bg-surface rounded-sheet flex flex-col">
      <div class="grid grid-cols-3 items-center px-4 pt-3 pb-6 flex-shrink-0">
        <button id="exercise-detail-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div id="exercise-detail-sheet-handle" class="justify-self-center flex items-center justify-center w-full py-3 min-h-[44px] px-2" style="touch-action: none;">
          <span class="text-card-title truncate">${escapeHtml(name)}</span>
        </div>
        <div aria-hidden="true"></div>
      </div>
      <div class="bottom-sheet-scroll flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <p class="text-body text-muted text-center py-12">Weitere Details folgen.</p>
      </div>
    </div>
  `;
}

async function openExerciseDetailSheet(exerciseId) {
  state.exerciseDetailSheetExerciseId = exerciseId;
  state.exerciseDetailSheetOpen = true;
  state.exerciseDetailSheetClosing = false;
  lockBodyScroll();
  raiseNavAboveSheet();
  await paint();
}

function finalizeExerciseDetailSheetClose() {
  pendingExerciseDetailSheetCloseTimeout = null;
  state.exerciseDetailSheetOpen = false;
  state.exerciseDetailSheetClosing = false;
  state.exerciseDetailSheetExerciseId = null;
  unlockBodyScroll();
  resetNavZIndex();
  paint();
}

let pendingExerciseDetailSheetCloseTimeout = null;

function closeExerciseDetailSheet() {
  if (!state.exerciseDetailSheetOpen || state.exerciseDetailSheetClosing) return;
  state.exerciseDetailSheetClosing = true;
  paint();
  pendingExerciseDetailSheetCloseTimeout = setTimeout(finalizeExerciseDetailSheetClose, SHEET_CLOSE_ANIMATION_MS);
}

function wireExerciseDetailSheetDrag() {
  const backdropEl = currentContainer.querySelector('#exercise-detail-sheet-backdrop');
  wireSheetDrag({
    handle: currentContainer.querySelector('#exercise-detail-sheet-handle'),
    sheetEl: backdropEl?.nextElementSibling ?? null,
    backdropEl,
    isClosing: () => state.exerciseDetailSheetClosing,
    onDismiss: () => {
      pendingExerciseDetailSheetCloseTimeout = setTimeout(finalizeExerciseDetailSheetClose, SHEET_CLOSE_ANIMATION_MS);
    },
  });
}

function wireEvents() {
  currentContainer.querySelectorAll('.calendar-day-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedDate = btn.dataset.date;
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

  currentContainer.querySelector('#calendar-sheet-close-btn')?.addEventListener('click', () => {
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

  // Öffnet die Übungs-Detailseite (Abschnitt 12) statt wie zuvor inline zu
  // expandieren.
  currentContainer.querySelectorAll('.exercise-row-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      withViewTransition(() => {
        state.detailEntryId = btn.dataset.entry;
        paint();
      }, 'forward');
    });
  });

  // --- Übungs-Sheet (Abschnitt 13) ---

  currentContainer.querySelector('#add-exercise-to-workout-btn')?.addEventListener('click', () => {
    openExerciseSheet();
  });

  wireExerciseSheetEvents();

  // --- Übungs-Detail-Sheet ---

  currentContainer.querySelector('#exercise-detail-sheet-backdrop')?.addEventListener('click', () => {
    closeExerciseDetailSheet();
  });

  currentContainer.querySelector('#exercise-detail-sheet-close-btn')?.addEventListener('click', () => {
    closeExerciseDetailSheet();
  });

  wireExerciseDetailSheetDrag();
}
