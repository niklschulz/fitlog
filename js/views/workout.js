import {
  db,
  getWorkoutByDate,
  getOrCreateWorkoutForDate,
  getWorkoutExercises,
  applyRoutineToWorkout,
  removeRoutineFromWorkout,
  addExercisesToWorkout,
  removeExerciseFromWorkout,
  createExercise,
  deleteExercise,
  deleteRoutine,
  MUSCLE_GROUPS,
  todayISODate,
  addDays,
  daysBetween,
  mondayOf,
} from '../db.js';
import { escapeHtml, renderSetTimelineRow, renderSetValues, TEXTLINK_ACTION, BTN_PRIMARY, DESTRUCTIVE_LINK, LIST_ROW, withViewTransition } from '../utils.js';
import {
  lockBodyScroll,
  unlockBodyScroll,
  raiseNavAboveSheet,
  resetNavZIndex,
  wireSheetDrag,
  SHEET_CLOSE_ANIMATION_MS,
} from '../sheet.js';
import * as exerciseDetail from './workout-exercise-detail.js';
import * as routinesView from './routines.js';

let currentContainer = null;
let state = {
  selectedDate: todayISODate(),
  detailEntryId: null, // workoutExercises.id der geöffneten Übungs-Detailseite (Abschnitt 12), oder null für die Tagesübersicht
  routinePickerOpen: false,
  routinePickerClosing: false,
  // "Routinen"-Sheet: erreichbar über "Alle Routinen anzeigen" im
  // Routine-Picker-Dropdown. Inhalt bewusst noch reine Anzeige (Liste wie im
  // Routinen-Tab, ohne Tap-Aktion) - Verwaltung (Anlegen/Bearbeiten) folgt
  // als eigener, späterer Schritt beim gemeinsamen Ausbau des
  // Routinen-Bereichs.
  routinesSheetOpen: false,
  routinesSheetClosing: false,
  // "⋮"-Kontextmenü (Bearbeiten/Löschen) an einer Routinen-Karte im
  // Routinen-Sheet - analog zu exerciseRosterMenuEntryId oben, nur eine
  // Karte kann gleichzeitig ihr Menü offen haben.
  routinesSheetMenuRoutineId: null,
  routinesSheetMenuClosing: false,
  // Kleines Kontextmenü ("Übung entfernen") am "⋮"-Button jeder Roster-Karte
  // - nur eine Karte kann gleichzeitig ihr Menü offen haben.
  exerciseRosterMenuEntryId: null,
  exerciseRosterMenuClosing: false,
  calendarSheetOpen: false,
  calendarSheetClosing: false,
  // Übungs-Sheet (Abschnitt 13): Übungen ansehen/auswählen, um sie gesammelt
  // zum Tages-Workout hinzuzufügen, s. ADR 0011.
  exerciseSheetOpen: false,
  exerciseSheetClosing: false,
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
  // Neue-Übung-Sheet: überlagert ebenfalls das Übungs-Sheet (Stapel-Sheet,
  // s. exerciseDetailSheet), öffnet sich per "+"-Button. Schließen führt nur
  // zum Übungs-Sheet zurück (Nutzer-Vorgabe), nicht zum Workout-Tab - ergibt
  // sich automatisch aus dem Stapel-Sheet-Muster (exerciseSheetOpen bleibt
  // währenddessen unverändert true).
  exerciseCreateSheetOpen: false,
  exerciseCreateSheetClosing: false,
  exerciseCreateSheetName: '',
  exerciseCreateSheetPrimaryMuscleId: null,
  exerciseCreateSheetSecondaryMuscleIds: new Set(),
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
  state.routinesSheetOpen = false;
  state.routinesSheetClosing = false;
  state.routinesSheetMenuRoutineId = null;
  state.routinesSheetMenuClosing = false;
  state.exerciseRosterMenuEntryId = null;
  state.exerciseRosterMenuClosing = false;
  state.calendarSheetOpen = false;
  state.calendarSheetClosing = false;
  state.exerciseSheetOpen = false;
  state.exerciseSheetClosing = false;
  state.exerciseSheetSelectedIds = new Set();
  state.exerciseSheetSearch = '';
  state.exerciseSheetMuscleFilterId = null;
  state.exerciseSheetMuscleFilterOpen = false;
  state.exerciseSheetMuscleFilterClosing = false;
  state.exerciseDetailSheetOpen = false;
  state.exerciseDetailSheetClosing = false;
  state.exerciseDetailSheetExerciseId = null;
  state.exerciseCreateSheetOpen = false;
  state.exerciseCreateSheetClosing = false;
  state.exerciseCreateSheetName = '';
  state.exerciseCreateSheetPrimaryMuscleId = null;
  state.exerciseCreateSheetSecondaryMuscleIds = new Set();
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
  if (pendingExerciseRosterMenuCloseTimeout) {
    clearTimeout(pendingExerciseRosterMenuCloseTimeout);
    pendingExerciseRosterMenuCloseTimeout = null;
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
  if (pendingExerciseCreateSheetCloseTimeout) {
    clearTimeout(pendingExerciseCreateSheetCloseTimeout);
    pendingExerciseCreateSheetCloseTimeout = null;
  }
  if (pendingRoutinesSheetCloseTimeout) {
    clearTimeout(pendingRoutinesSheetCloseTimeout);
    pendingRoutinesSheetCloseTimeout = null;
  }
  if (pendingRoutinesSheetMenuCloseTimeout) {
    clearTimeout(pendingRoutinesSheetMenuCloseTimeout);
    pendingRoutinesSheetMenuCloseTimeout = null;
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
  if (state.exerciseCreateSheetOpen) {
    unlockBodyScroll();
    resetNavZIndex();
  }
  if (state.routinesSheetOpen) {
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
    ${state.routinesSheetOpen ? await renderRoutinesSheet() : ''}
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

// "Routinen"-Sheet (Top-Level-Sheet wie das Kalender-Sheet, kein
// Stapel-Sheet) - erreichbar über "Alle Routinen anzeigen" im
// Routine-Picker-Dropdown oben. Jede Routine als eigene Karte im selben
// Aufbau wie eine Roster-Karte (bg-surface rounded-card, Titel-Zeile +
// "⋮"-Kontextmenü-Button, s. renderExerciseRow) - Bearbeiten öffnet den
// bestehenden Routinen-Editor auf dem Routinen-Tab (s. requestEditRoutine()
// in routines.js), Löschen ruft deleteRoutine() mit Bestätigungsdialog.
async function renderRoutinesSheet() {
  const routines = await db.routines.orderBy('name').toArray();
  const exerciseCounts = await Promise.all(
    routines.map((r) => db.routineExercises.where('routineId').equals(r.id).count())
  );
  const closing = state.routinesSheetClosing;

  return `
    <div id="routines-sheet-backdrop" class="bottom-sheet-backdrop ${closing ? 'closing' : ''} fixed inset-0 z-50 bg-black/50"></div>
    <div class="bottom-sheet ${closing ? 'closing' : ''} fixed left-0 right-0 bottom-0 z-[51] bg-surface rounded-sheet flex flex-col">
      <div class="grid grid-cols-3 items-center px-4 pt-3 pb-5 flex-shrink-0">
        <button id="routines-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div id="routines-sheet-handle" class="justify-self-center flex items-center justify-center w-full py-3 min-h-[44px]" style="touch-action: none;">
          <span class="text-card-title">Routinen</span>
        </div>
        <div></div>
      </div>
      <div id="routines-sheet-content" class="bottom-sheet-scroll flex-1 overflow-y-auto min-h-0 px-4 pb-[calc(env(safe-area-inset-bottom)+32px)]">
        ${
          routines.length === 0
            ? `<p class="text-body text-muted text-center py-12">Noch keine Routinen angelegt.</p>`
            : `<ul class="flex flex-col gap-2">
                ${routines.map((r, i) => renderRoutineSheetCard(r, exerciseCounts[i])).join('')}
              </ul>`
        }
      </div>
    </div>
  `;
}

function renderRoutineSheetCard(routine, exerciseCount) {
  const menuOpen = state.routinesSheetMenuRoutineId === routine.id;

  return `
    <li class="relative">
      <div class="bg-surface rounded-card overflow-hidden">
        <div class="flex items-center gap-1 pl-4 pr-1 py-3 min-h-[44px]">
          <div class="flex-1 min-w-0 flex flex-col gap-0.5">
            <span class="text-card-title truncate">${escapeHtml(routine.name)}</span>
            <span class="text-label text-muted uppercase">${exerciseCount} Übung${exerciseCount === 1 ? '' : 'en'}</span>
          </div>
          <button
            type="button"
            data-routine="${routine.id}"
            class="routines-sheet-menu-btn tap-feedback flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted"
            aria-label="Optionen für ${escapeHtml(routine.name)}"
            aria-haspopup="true"
            aria-expanded="${menuOpen}"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
              <circle cx="12" cy="5" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="12" cy="19" r="1.75" />
            </svg>
          </button>
        </div>
      </div>
      ${menuOpen ? renderRoutinesSheetMenu(routine) : ''}
    </li>
  `;
}

// Kontextmenü (Bearbeiten/Löschen) - 1:1 dasselbe Muster wie
// renderExerciseRosterMenu (Liquid Glass, s. dortiger Kommentar für die
// Herleitung von rounded-sheet/popup-glass/top-0), nur mit zwei statt einem
// Eintrag.
function renderRoutinesSheetMenu(routine) {
  const closing = state.routinesSheetMenuClosing;
  return `
    <div id="routines-sheet-menu-backdrop" class="fixed inset-0 z-30"></div>
    <div class="routine-picker-popup popup-glass ${closing ? 'closing' : ''} absolute right-0 top-0 z-40 rounded-sheet p-1 min-w-[190px]">
      <button type="button" data-routine="${routine.id}" class="routines-sheet-edit-btn tap-feedback w-full text-left rounded-btn px-3 py-2 min-h-[44px] text-ink text-body">
        Bearbeiten
      </button>
      <button type="button" data-routine="${routine.id}" class="routines-sheet-delete-btn tap-feedback w-full text-left rounded-btn px-3 py-2 min-h-[44px] ${DESTRUCTIVE_LINK}">
        Löschen
      </button>
    </div>
  `;
}

// Analog zu openExerciseRosterMenu/closeExerciseRosterMenu weiter unten
// (gleiche Animation/Timeout-Konstante) - kein lockBodyScroll()/
// raiseNavAboveSheet() nötig, das leichte Kontextmenü ist kein echtes Sheet.
let pendingRoutinesSheetMenuCloseTimeout = null;

function openRoutinesSheetMenu(routineId) {
  state.routinesSheetMenuRoutineId = routineId;
  state.routinesSheetMenuClosing = false;
  paint();
}

function closeRoutinesSheetMenu() {
  if (!state.routinesSheetMenuRoutineId || state.routinesSheetMenuClosing) return;
  state.routinesSheetMenuClosing = true;
  paint();
  pendingRoutinesSheetMenuCloseTimeout = setTimeout(() => {
    pendingRoutinesSheetMenuCloseTimeout = null;
    state.routinesSheetMenuRoutineId = null;
    state.routinesSheetMenuClosing = false;
    paint();
  }, ROUTINE_PICKER_CLOSE_ANIMATION_MS);
}

async function openRoutinesSheet() {
  // Der kleine Dropdown-Picker ist noch offen (Auslöser des Klicks) - ohne
  // eigene Schließen-Animation ausblenden, da das neue Vollbild-Sheet ihn
  // ohnehin sofort überdeckt.
  state.routinePickerOpen = false;
  state.routinePickerClosing = false;
  state.routinesSheetOpen = true;
  state.routinesSheetClosing = false;
  lockBodyScroll();
  raiseNavAboveSheet();
  await paint();
}

// Analog zu closeCalendarSheet/finalizeCalendarSheetClose weiter oben.
let pendingRoutinesSheetCloseTimeout = null;

function finalizeRoutinesSheetClose() {
  pendingRoutinesSheetCloseTimeout = null;
  state.routinesSheetOpen = false;
  state.routinesSheetClosing = false;
  unlockBodyScroll();
  resetNavZIndex();
  paint();
}

function closeRoutinesSheet() {
  if (!state.routinesSheetOpen || state.routinesSheetClosing) return;
  state.routinesSheetClosing = true;
  paint();
  pendingRoutinesSheetCloseTimeout = setTimeout(finalizeRoutinesSheetClose, SHEET_CLOSE_ANIMATION_MS);
}

function wireRoutinesSheetDrag() {
  const backdropEl = currentContainer.querySelector('#routines-sheet-backdrop');
  wireSheetDrag({
    handle: currentContainer.querySelector('#routines-sheet-handle'),
    sheetEl: backdropEl?.nextElementSibling ?? null,
    backdropEl,
    isClosing: () => state.routinesSheetClosing,
    onDismiss: () => {
      pendingRoutinesSheetCloseTimeout = setTimeout(finalizeRoutinesSheetClose, SHEET_CLOSE_ANIMATION_MS);
    },
  });
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

// Tap auf Titel/Sätze öffnet die Übungs-Detailseite (Abschnitt 12) statt wie
// zuvor eine Inline-Akkordeon-Erweiterung - s. exercise-row-toggle in
// wireEvents(). Der "⋮"-Button öffnet ein kleines Kontextmenü (s.
// renderExerciseRosterMenu) zum Entfernen der Übung aus dem heutigen
// Workout (kein Bestätigungsdialog, s. Kommentar bei
// removeExerciseFromWorkout in js/db.js) - bewusst nur für noch unbegonnene
// Übungen (entry.startedAt === null, keine Sätze erfasst) angeboten,
// dieselbe Regel wie bei jeder bestehenden workoutExercises-Kaskade
// (Routine-Wechsel, Übung/Routine löschen, s. ADR 0007) - bereits erfasste
// Sätze dürfen nie verloren gehen. Kein Menü-Button für begonnene Übungen,
// statt eines Menüs mit einem einzigen, dauerhaft deaktivierten Eintrag.
// Titel-Zeile eigens in eine `items-center`-Flex-Zeile zusammen mit dem
// "⋮"-Button ausgelagert (statt beide gegen die gesamte, durch die
// Satz-Liste unterschiedlich hohe Karte auszurichten), damit der Button
// immer exakt auf Höhe des Titels sitzt, unabhängig von der Anzahl der
// Sätze darunter. Titel-Button und "⋮"-Button sind dafür zwei ECHTE
// Geschwister-Elemente, kein `<button>` im anderen verschachtelt
// (ungültiges HTML) - die Satz-Liste bekommt aus demselben Grund ihren
// eigenen, zweiten `.exercise-row-toggle`-Button (dieselbe Klasse/dasselbe
// `data-entry` wie der Titel-Button, dadurch automatisch mitverdrahtet).
function renderExerciseRow(entry, name, sets) {
  const label = name ?? 'Gelöschte Übung';
  const setRows = sets
    .map((s, i) =>
      renderSetTimelineRow(i + 1, renderSetValues(s.weight, s.reps), { isLast: i === sets.length - 1 })
    )
    .join('');
  const canRemove = entry.startedAt === null;
  const menuOpen = state.exerciseRosterMenuEntryId === entry.id;
  const titleClasses = `text-card-title truncate ${name ? '' : 'italic text-muted'}`;

  if (!canRemove) {
    return `
      <li class="relative">
        <button data-entry="${entry.id}" class="exercise-row-toggle tap-feedback w-full text-left px-4 py-3 min-h-[44px] flex flex-col gap-1 bg-surface rounded-card overflow-hidden">
          <span class="${titleClasses}">${escapeHtml(label)}</span>
          ${sets.length > 0 ? `<ul class="flex flex-col mt-2">${setRows}</ul>` : ''}
        </button>
      </li>
    `;
  }

  return `
    <li class="relative">
      <div class="bg-surface rounded-card overflow-hidden">
        <div class="flex items-center gap-1 pl-4 pr-1 py-3 min-h-[44px]">
          <button data-entry="${entry.id}" class="exercise-row-toggle tap-feedback flex-1 min-w-0 text-left">
            <span class="${titleClasses}">${escapeHtml(label)}</span>
          </button>
          <button
            type="button"
            data-entry="${entry.id}"
            class="exercise-roster-menu-btn tap-feedback flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted"
            aria-label="Optionen für ${escapeHtml(label)}"
            aria-haspopup="true"
            aria-expanded="${menuOpen}"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
              <circle cx="12" cy="5" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="12" cy="19" r="1.75" />
            </svg>
          </button>
        </div>
        ${
          sets.length > 0
            ? `<button data-entry="${entry.id}" class="exercise-row-toggle tap-feedback w-full text-left block px-4 pb-3 -mt-2">
                <ul class="flex flex-col">${setRows}</ul>
              </button>`
            : ''
        }
      </div>
      ${menuOpen ? renderExerciseRosterMenu(entry) : ''}
    </li>
  `;
}

// Kleines Kontextmenü nach einem iOS-Liquid-Glass-Referenzbild (Kopfzeile
// mit wiederholtem Titel und Icons vor den Einträgen bewusst nicht
// übernommen - nur Form/Material/Positionierung/Schatten). Konsequent aus
// bereits bestehenden Design-System-Bausteinen zusammengesetzt statt neu
// erfundener Werte:
// - Form: `rounded-sheet` (26px) - derselbe Radius-Token wie die
//   Bottom-Sheets, im Referenzbild deutlich raumgreifender als das
//   vorherige, kantige `rounded-card` ("Squircle"-Optik)
// - Material + Schatten: `.popup-glass` (css/styles.css) - identische Werte
//   wie `#bottom-nav`/`.icon-btn-glass`, keine eigene Schatten-Variante
//   nötig, das Standard-Glas passt bereits
// - Positionierung: `top-0` statt des vorherigen `top-[calc(100%+4px)]` -
//   das Menü überlagert die auslösende Karte direkt (wächst aus der
//   "⋮"-Antippstelle heraus), statt sauber getrennt darunter zu schweben
//
// Ein-/Ausblend-Animation weiterhin die geteilte `.routine-picker-popup`-
// Klasse. Eigener, unsichtbarer Vollbild-Backdrop zum Schließen bei Klick
// außerhalb. Sitzt als Geschwister-Element NACH der `overflow-hidden`-Karte
// im `<li>` (nicht darin), sonst würde die Karte das Popup an ihren
// abgerundeten Ecken abschneiden.
function renderExerciseRosterMenu(entry) {
  const closing = state.exerciseRosterMenuClosing;
  return `
    <div id="exercise-roster-menu-backdrop" class="fixed inset-0 z-30"></div>
    <div class="routine-picker-popup popup-glass ${closing ? 'closing' : ''} absolute right-0 top-0 z-40 rounded-sheet p-1 min-w-[190px]">
      <button type="button" data-entry="${entry.id}" class="exercise-roster-remove-btn tap-feedback w-full text-left rounded-btn px-3 py-2 min-h-[44px] ${DESTRUCTIVE_LINK}">
        Übung entfernen
      </button>
    </div>
  `;
}

// Analog zu closeRoutinePicker() weiter unten (gleiche Animation/Timeout-
// Konstante) - kein lockBodyScroll()/raiseNavAboveSheet() nötig, das leichte
// Kontextmenü ist wie der Routine-Picker kein echtes Sheet.
let pendingExerciseRosterMenuCloseTimeout = null;

function openExerciseRosterMenu(entryId) {
  state.exerciseRosterMenuEntryId = entryId;
  state.exerciseRosterMenuClosing = false;
  paint();
}

function closeExerciseRosterMenu() {
  if (!state.exerciseRosterMenuEntryId || state.exerciseRosterMenuClosing) return;
  state.exerciseRosterMenuClosing = true;
  paint();
  pendingExerciseRosterMenuCloseTimeout = setTimeout(() => {
    pendingExerciseRosterMenuCloseTimeout = null;
    state.exerciseRosterMenuEntryId = null;
    state.exerciseRosterMenuClosing = false;
    paint();
  }, ROUTINE_PICKER_CLOSE_ANIMATION_MS);
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
// Übungen ansehen/auswählen/suchen/filtern, um sie gesammelt zum
// Tages-Workout hinzuzufügen. Mehrfachauswahl statt Sofort-Hinzufügen
// (Nutzer-Vorgabe) - `exerciseSheetSelectedIds` sammelt IDs. Ein Tap auf den
// Übungsnamen öffnet das gestapelte Übungs-Detail-Sheet, der "+"-Button das
// gestapelte Neue-Übung-Sheet (beide unten) - "Neue Übung" war bis zur
// Vierundsechzigsten Iteration ein Inline-Modus *innerhalb* dieses Sheets
// (`state.exerciseSheetMode`), ist seitdem aber ein eigenes Stapel-Sheet wie
// das Übungs-Detail-Sheet (Nutzer-Vorgabe: Schließen führt nur zum
// Übungs-Sheet zurück, nicht zum Workout-Tab - ergibt sich automatisch aus
// dem Stapel-Muster). Löschen ist bewusst nicht Teil dieses Sheets selbst
// (Nutzer-Vorgabe) - lebt stattdessen im gestapelten Übungs-Detail-Sheet
// (roter Löschen-Button, s. weiter unten).
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

// Reine Listen-Inhalt von `#exercise-sheet-body` - ausgelagert, damit die
// Sucheingabe (s. repaintExerciseSheetBodyInPlace()) NUR diesen engsten
// möglichen Teilbaum ersetzen kann, ohne Suchfeld, Muskel-Filter oder
// Kopfzeile anzufassen. Wichtig, nicht nur Kosmetik: Das <input> selbst darf
// beim Tippen nie zerstört/neu erzeugt werden (s. CHANGELOG) - sonst bricht
// sowohl die gefühlte Reaktionsgeschwindigkeit als auch iOS' natives
// Key-Repeat beim Gedrückthalten der Löschen-Taste, das denselben
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

  return renderExerciseSheetList(filteredExercises, inWorkoutIds, selectedIds, allExercises.length);
}

function renderExerciseSheetContent() {
  const hasCommitBar = state.exerciseSheetSelectedIds.size > 0;

  return `
    ${renderExerciseSheetSearchBar()}
    ${renderExerciseSheetMuscleFilter()}
    <div id="exercise-sheet-body" class="bottom-sheet-scroll flex-1 overflow-y-auto px-4 ${hasCommitBar ? 'pb-4' : 'pb-[calc(env(safe-area-inset-bottom)+112px)]'} flex flex-col gap-2">
      ${renderExerciseSheetBody()}
    </div>
    ${hasCommitBar ? renderExerciseSheetCommitBar() : ''}
  `;
}

// Rein optische Bug-Fix-Historie (s. CHANGELOG): Backdrop und `.bottom-sheet`
// tragen die Slide-/Fade-Einstiegs-Animation als CSS-`animation`-Property -
// die spielt bei JEDEM Einfügen dieser Elemente ins DOM erneut ab, nicht nur
// beim allerersten Öffnen. Würde `renderExerciseSheet()` (das den kompletten
// `#exercise-sheet-root`-Teilbaum inkl. Backdrop/Panel erzeugt) bei jeder
// Sheet-interner Interaktion (Suche tippen, Muskel-Filter öffnen/schließen/
// auswählen, Auswahl) neu aufgerufen und eingesetzt, würde das gesamte Sheet
// dabei jedes Mal sichtbar erneut von unten hereinrutschen. Deshalb bleiben
// Backdrop und `.bottom-sheet` (samt Kopfzeile: Schließen-Button, Titel/
// Ziehgriff, "+"-Button) nach dem initialen Öffnen unangetastet - nur der
// stabil per ID adressierbare `#exercise-sheet-content`-Teilbaum (Suchfeld,
// Muskel-Filter, Liste, Commit-Leiste) wird bei internen Interaktionen
// ausgetauscht. Der "+"-Button selbst ändert sich seit der
// Vierundsechzigsten Iteration nie mehr (kein Inline-Modus-Wechsel mehr,
// "Neue Übung" ist ein eigenes Stapel-Sheet), sitzt deshalb wieder direkt
// und unverändert im Grid statt in einem eigenen Teil-Repaint-Wrapper.
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
          <button id="exercise-sheet-new-btn" type="button" class="icon-btn-glass tap-feedback justify-self-end text-ink" aria-label="Neue Übung erstellen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div id="exercise-sheet-content" class="flex-1 min-h-0 flex flex-col">
          ${renderExerciseSheetContent()}
        </div>
      </div>
    </div>
  `;
}

// Ersetzt nur `#exercise-sheet-content` (s. Kommentar bei
// renderExerciseSheet) - komplett synchron, liest wie renderExerciseSheet()
// nur aus dem bereits geladenen exerciseSheetCache. Deckt alle
// Sheet-internen Interaktionen ab (Suche, Muskel-Filter, Auswahl) - nur das
// initiale Öffnen und das Schließen des gesamten Sheets laufen weiterhin
// über das normale `paint()` (dort SOLL die Slide-Animation spielen).
function repaintExerciseSheetContentInPlace() {
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

// Eigene, nicht scrollende Flex-Zone zwischen Kopfzeile und Liste - Lupe
// als absolut positioniertes Icon links im Feld
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
    <ul class="flex flex-col gap-1">
      ${filteredExercises
        .map((ex) => renderExerciseSheetRow(ex, inWorkoutIds.has(ex.id), selectedIds.has(ex.id)))
        .join('')}
    </ul>
  `;
}

// Titel + primärer Muskel als Untertitel (analog zum Übungsanzahl-Untertitel
// im Routine-Picker, s. renderRoutinePickerPopup weiter oben: `text-label
// text-muted uppercase` unter dem Titel) - Übungen ohne primäre
// Muskelzuordnung (`primaryMuscleId` null/unbekannt) bekommen keinen
// Untertitel, statt eine leere/erfundene Zeile anzuzeigen. Die Auswahl-
// Fläche sitzt rechts (Nutzer-Vorgabe, s. Referenz-Screenshot) und zeigt
// entweder ein eckiges, antippbares Auswahl-Kästchen (togglet
// exerciseSheetSelectedIds) oder - für Übungen, die heute schon im Roster
// stehen - ein rein informatives, deaktiviertes Häkchen-Badge (Nutzer-
// Vorgabe: sichtbar lassen statt ausblenden, das Sheet dient auch zum
// Ansehen). Der Name-Block selbst ist immer ein eigenes Tap-Ziel zum
// Übungs-Detail-Sheet, unabhängig vom Auswahl-/Bereits-Vorhanden-Status.
function renderExerciseSheetRow(exercise, alreadyInWorkout, isSelected) {
  const muscleName = MUSCLE_GROUPS.find((m) => m.id === exercise.primaryMuscleId)?.name;

  const trailingColumn = alreadyInWorkout
    ? `<span class="min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0" aria-hidden="true">
        <span class="w-6 h-6 rounded-btn flex items-center justify-center bg-raised text-muted text-label">✓</span>
      </span>`
    : `<button type="button" data-id="${exercise.id}" class="exercise-select-toggle-btn tap-feedback min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0" aria-pressed="${isSelected}" aria-label="${escapeHtml(exercise.name)} ${isSelected ? 'abwählen' : 'auswählen'}">
        <span class="w-6 h-6 rounded-btn flex items-center justify-center text-label ${isSelected ? 'bg-accent' : 'border-2 border-white/25'}">${isSelected ? '✓' : ''}</span>
      </button>`;

  return `
    <li class="${LIST_ROW} flex items-center gap-3">
      <button type="button" data-id="${exercise.id}" class="exercise-open-detail-btn tap-feedback flex-1 min-w-0 flex flex-col gap-0.5 text-left">
        <span class="text-card-title truncate">${escapeHtml(exercise.name)}</span>
        ${muscleName ? `<span class="text-label text-muted uppercase">${escapeHtml(muscleName)}</span>` : ''}
      </button>
      ${trailingColumn}
    </li>
  `;
}

// Nicht Teil der scrollenden Liste, sondern eine eigene, nicht schrumpfende
// Flex-Zone unter ihr (nur gerendert, solange ≥1 Übung ausgewählt ist) -
// bekommt eine eigene, kleinere Bottom-Nav-Abstandsreserve als sonst z. B.
// die Kalender-Liste (112px), auf Nutzer-Wunsch näher an die Nav gerückt
// (die während offenem Sheet per raiseNavAboveSheet über allem schwebt),
// aber weiterhin groß genug, um den Button nicht dahinter verschwinden zu
// lassen. Zählt bewusst nicht mehr die Auswahl mit ("Hinzufügen (n)") -
// Nutzer-Vorgabe, die Auswahl-Anzahl ist über die Häkchen in der Liste
// ohnehin sichtbar.
function renderExerciseSheetCommitBar() {
  return `
    <div class="flex-shrink-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+88px)]">
      <button type="button" id="exercise-sheet-commit-btn" class="tap-feedback w-full ${BTN_PRIMARY} py-3 min-h-[44px]">
        Hinzufügen
      </button>
    </div>
  `;
}

async function openExerciseSheet() {
  state.exerciseSheetOpen = true;
  state.exerciseSheetClosing = false;
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

  // "+"-Button ist seit der Vierundsechzigsten Iteration ein stabiles,
  // direktes Grid-Kind (nie mehr Teil eines Teil-Repaints, s. Kommentar bei
  // renderExerciseSheet) - Listener deshalb hier bei den Root-Listenern
  // statt in wireExerciseSheetContentEvents(), sonst würde sich bei jedem
  // Such-/Filter-Teil-Repaint ein weiterer, doppelter Listener auf demselben,
  // nie neu erzeugten Button ansammeln.
  currentContainer.querySelector('#exercise-sheet-new-btn')?.addEventListener('click', () => {
    openExerciseCreateSheet();
  });

  wireExerciseSheetDrag();
  wireExerciseSheetContentEvents();
}

// Verdrahtet `#exercise-sheet-content` - aufgerufen sowohl aus
// wireExerciseSheetEvents() (nach vollem paint()) als auch aus
// repaintExerciseSheetContentInPlace() (nach jedem gezielten Teil-Ersetzen
// dieses Teilbaums, s. dort). Löst diese Interaktionen deshalb bewusst NICHT
// über das volle paint(), sondern über den Teil-Repaint aus, damit Backdrop/
// `.bottom-sheet`/Kopfzeile unangetastet bleiben (keine erneute
// Slide-Animation, s. Kommentar bei renderExerciseSheet).
function wireExerciseSheetContentEvents() {
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
      ? state.exerciseCreateSheetPrimaryMuscleId === muscle.id
      : state.exerciseCreateSheetSecondaryMuscleIds.has(muscle.id);
  // Bereits als primär gewählte Muskelgruppe ist unter den sekundären
  // deaktiviert - spiegelt die serverseitige Validierung in
  // validateMuscleAssignment() (js/db.js), die genau diese Überschneidung
  // ablehnt, s. ADR 0013.
  const isDisabled = role === 'secondary' && state.exerciseCreateSheetPrimaryMuscleId === muscle.id;

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
        <label class="text-label text-muted" for="exercise-create-sheet-name-input">Name</label>
        <input
          id="exercise-create-sheet-name-input"
          type="text"
          autocomplete="off"
          placeholder="z. B. Latzug"
          value="${escapeHtml(state.exerciseCreateSheetName)}"
          class="w-full bg-white/[0.08] rounded-btn py-3 px-3 text-ink min-h-[44px]"
        />
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-label text-muted">Primärer Muskel</span>
        <div class="flex flex-wrap gap-2">
          ${MUSCLE_GROUPS.map((m) => renderExerciseCreateSheetMuscleChip(m, 'primary')).join('')}
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-label text-muted">Sekundäre Muskeln</span>
        <div class="flex flex-wrap gap-2">
          ${MUSCLE_GROUPS.map((m) => renderExerciseCreateSheetMuscleChip(m, 'secondary')).join('')}
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
  const canSubmit = state.exerciseCreateSheetName.trim().length > 0;

  return `
    <div id="exercise-create-sheet-backdrop" class="bottom-sheet-backdrop fixed inset-0 z-[52] bg-black/50"></div>
    <div class="bottom-sheet fixed left-0 right-0 bottom-0 z-[53] bg-surface rounded-sheet flex flex-col">
      <div class="grid grid-cols-3 items-center px-4 pt-3 pb-5 flex-shrink-0">
        <button id="exercise-create-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div id="exercise-create-sheet-handle" class="justify-self-center flex items-center justify-center w-full py-3 min-h-[44px]" style="touch-action: none;">
          <span class="text-card-title">Neue Übung</span>
        </div>
        <button
          id="exercise-create-sheet-submit-btn"
          type="submit"
          form="exercise-create-sheet-form"
          class="icon-btn-glass icon-btn-glass-accent tap-feedback justify-self-end"
          aria-label="Übung erstellen"
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
async function openExerciseCreateSheet() {
  state.exerciseCreateSheetOpen = true;
  state.exerciseCreateSheetClosing = false;
  state.exerciseCreateSheetName = '';
  state.exerciseCreateSheetPrimaryMuscleId = null;
  state.exerciseCreateSheetSecondaryMuscleIds = new Set();
  lockBodyScroll();
  raiseNavAboveSheet();
  currentContainer.insertAdjacentHTML('beforeend', renderExerciseCreateSheet());
  wireExerciseCreateSheetEvents();
}

// Entfernt Backdrop + Panel direkt aus dem DOM (kein paint() mehr, s.
// openExerciseCreateSheet) - beide Referenzen werden VOR dem ersten Entfernen
// eingesammelt, da `nextElementSibling` nach dem Entfernen des Backdrops
// nicht mehr auffindbar wäre.
function finalizeExerciseCreateSheetClose() {
  pendingExerciseCreateSheetCloseTimeout = null;
  state.exerciseCreateSheetOpen = false;
  state.exerciseCreateSheetClosing = false;
  unlockBodyScroll();
  resetNavZIndex();
  const backdrop = currentContainer?.querySelector('#exercise-create-sheet-backdrop');
  backdrop?.nextElementSibling?.remove();
  backdrop?.remove();
}

let pendingExerciseCreateSheetCloseTimeout = null;

// Setzt die `closing`-Klasse direkt auf die bestehenden Elemente (statt sie
// über ein Neu-Rendern zu erzeugen) - spielt dieselbe CSS-Schließen-
// Animation ab, ohne dass dabei irgendetwas anderes im DOM angefasst wird.
function closeExerciseCreateSheet() {
  if (!state.exerciseCreateSheetOpen || state.exerciseCreateSheetClosing) return;
  state.exerciseCreateSheetClosing = true;
  const backdrop = currentContainer.querySelector('#exercise-create-sheet-backdrop');
  backdrop?.nextElementSibling?.classList.add('closing');
  backdrop?.classList.add('closing');
  pendingExerciseCreateSheetCloseTimeout = setTimeout(finalizeExerciseCreateSheetClose, SHEET_CLOSE_ANIMATION_MS);
}

function wireExerciseCreateSheetDrag() {
  const backdropEl = currentContainer.querySelector('#exercise-create-sheet-backdrop');
  wireSheetDrag({
    handle: currentContainer.querySelector('#exercise-create-sheet-handle'),
    sheetEl: backdropEl?.nextElementSibling ?? null,
    backdropEl,
    isClosing: () => state.exerciseCreateSheetClosing,
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
  const content = currentContainer?.querySelector('#exercise-create-sheet-content');
  if (!content) return;
  content.innerHTML = renderExerciseCreateSheetContent();
  wireExerciseCreateSheetContentEvents();
}

function wireExerciseCreateSheetContentEvents() {
  currentContainer.querySelector('#exercise-create-sheet-name-input')?.addEventListener('input', (e) => {
    state.exerciseCreateSheetName = e.target.value;
    // Kopfzeile wird hier bewusst NICHT neu gerendert (bleibt stabil) - nur
    // das `disabled`-Property des dort sitzenden Glass-Buttons wird direkt
    // umgeschaltet, den optischen Wechsel (grünes Glimmen an/aus) übernehmen
    // Tailwinds `disabled:`-Varianten automatisch über die native
    // `:disabled`-Pseudoklasse.
    const submitBtn = currentContainer.querySelector('#exercise-create-sheet-submit-btn');
    if (submitBtn) submitBtn.disabled = !e.target.value.trim();
  });

  currentContainer.querySelectorAll('.muscle-chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { role, muscle } = btn.dataset;
      if (role === 'primary') {
        // Erneuter Tap auf die bereits gewählte primäre Muskelgruppe hebt
        // die Auswahl wieder auf (Toggle, analog zur Routine-Auswahl).
        state.exerciseCreateSheetPrimaryMuscleId =
          state.exerciseCreateSheetPrimaryMuscleId === muscle ? null : muscle;
        // Falls dieselbe Muskelgruppe bereits sekundär gewählt war, dort
        // entfernen - vermeidet die von validateMuscleAssignment()
        // abgelehnte primär=sekundär-Überschneidung von vornherein.
        state.exerciseCreateSheetSecondaryMuscleIds.delete(muscle);
      } else {
        if (state.exerciseCreateSheetSecondaryMuscleIds.has(muscle)) {
          state.exerciseCreateSheetSecondaryMuscleIds.delete(muscle);
        } else {
          state.exerciseCreateSheetSecondaryMuscleIds.add(muscle);
        }
      }
      repaintExerciseCreateSheetContentInPlace();
    });
  });

  currentContainer.querySelector('#exercise-create-sheet-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = state.exerciseCreateSheetName.trim();
    if (!name) return;

    const exercise = await createExercise(name, {
      primaryMuscleId: state.exerciseCreateSheetPrimaryMuscleId,
      secondaryMuscleIds: [...state.exerciseCreateSheetSecondaryMuscleIds],
    });
    await loadExerciseSheetCache();
    state.exerciseSheetSelectedIds.add(exercise.id);
    closeExerciseCreateSheet();
    // Übungs-Sheet dahinter sofort mit der neuen Übung (vorausgewählt)
    // aktualisieren, statt erst beim nächsten ohnehin fälligen Repaint -
    // sichtbar, sobald die Schließen-Animation dieses Sheets durchgelaufen
    // ist und den Blick wieder freigibt.
    repaintExerciseSheetContentInPlace();
  });
}

function wireExerciseCreateSheetEvents() {
  currentContainer.querySelector('#exercise-create-sheet-backdrop')?.addEventListener('click', () => {
    closeExerciseCreateSheet();
  });

  currentContainer.querySelector('#exercise-create-sheet-close-btn')?.addEventListener('click', () => {
    closeExerciseCreateSheet();
  });

  wireExerciseCreateSheetDrag();
  wireExerciseCreateSheetContentEvents();
}

// --- Übungs-Detail-Sheet ---
//
// Überlagert das Übungs-Sheet (Stapel-Sheet, höhere z-Ebene) statt es zu
// ersetzen - Tap auf eine Übungszeile öffnet dieses zweite Sheet obendrauf,
// das darunterliegende bleibt offen/sichtbar. Inhalt ist bewusst noch ein
// Platzhalter (Konzept für die eigentlichen Details/Löschen-Aktion folgt
// separat, s. CHANGELOG) - Kopfzeile und Sheet-Mechanik sind aber bereits
// vollständig, damit später nur noch der Body-Inhalt ergänzt werden muss.
// Kopfzeile ohne `closing`-Fallunterscheidung, aus demselben Grund wie beim
// Neue-Übung-Sheet (s. renderExerciseCreateSheet): diese Funktion wird nur
// noch genau einmal beim Öffnen aufgerufen, die closing-Animation läuft über
// direktes `classList.add()` auf den bestehenden Elementen, s.
// closeExerciseDetailSheet().
async function renderExerciseDetailSheet() {
  const exercise = await db.exercises.get(state.exerciseDetailSheetExerciseId);
  const name = exercise?.name ?? 'Gelöschte Übung';

  return `
    <div id="exercise-detail-sheet-backdrop" class="bottom-sheet-backdrop fixed inset-0 z-[52] bg-black/50"></div>
    <div class="bottom-sheet fixed left-0 right-0 bottom-0 z-[53] bg-surface rounded-sheet flex flex-col">
      <div class="grid grid-cols-3 items-center px-4 pt-3 pb-6 flex-shrink-0">
        <button id="exercise-detail-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div id="exercise-detail-sheet-handle" class="justify-self-center flex items-center justify-center w-full py-3 min-h-[44px] px-2" style="touch-action: none;">
          <span class="text-card-title truncate">${escapeHtml(name)}</span>
        </div>
        <button id="exercise-detail-sheet-delete-btn" type="button" class="icon-btn-glass icon-btn-glass-danger tap-feedback justify-self-end" aria-label="Übung löschen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
            <path d="M4 7h16" />
            <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
            <path d="M6 7l1 12.5A2 2 0 0 0 9 21h6a2 2 0 0 0 2-2L18 7" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
      <div class="bottom-sheet-scroll flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <p class="text-body text-muted text-center py-12">Weitere Details folgen.</p>
      </div>
    </div>
  `;
}

// Öffnet OHNE das globale paint() - aus demselben Grund wie beim
// Neue-Übung-Sheet (s. openExerciseCreateSheet): das Übungs-Sheet darunter
// darf beim Stapeln nicht neu aufgebaut werden, sonst spielt dessen
// Slide-/Fade-Animation erneut ab, obwohl es bereits sichtbar ist.
async function openExerciseDetailSheet(exerciseId) {
  state.exerciseDetailSheetExerciseId = exerciseId;
  state.exerciseDetailSheetOpen = true;
  state.exerciseDetailSheetClosing = false;
  lockBodyScroll();
  raiseNavAboveSheet();
  currentContainer.insertAdjacentHTML('beforeend', await renderExerciseDetailSheet());
  wireExerciseDetailSheetEvents();
}

// Entfernt Backdrop + Panel direkt aus dem DOM (kein paint() mehr, s.
// openExerciseDetailSheet) - beide Referenzen werden VOR dem ersten Entfernen
// eingesammelt, s. finalizeExerciseCreateSheetClose.
function finalizeExerciseDetailSheetClose() {
  pendingExerciseDetailSheetCloseTimeout = null;
  state.exerciseDetailSheetOpen = false;
  state.exerciseDetailSheetClosing = false;
  state.exerciseDetailSheetExerciseId = null;
  unlockBodyScroll();
  resetNavZIndex();
  const backdrop = currentContainer?.querySelector('#exercise-detail-sheet-backdrop');
  backdrop?.nextElementSibling?.remove();
  backdrop?.remove();
}

let pendingExerciseDetailSheetCloseTimeout = null;

function closeExerciseDetailSheet() {
  if (!state.exerciseDetailSheetOpen || state.exerciseDetailSheetClosing) return;
  state.exerciseDetailSheetClosing = true;
  const backdrop = currentContainer.querySelector('#exercise-detail-sheet-backdrop');
  backdrop?.nextElementSibling?.classList.add('closing');
  backdrop?.classList.add('closing');
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

function wireExerciseDetailSheetEvents() {
  currentContainer.querySelector('#exercise-detail-sheet-backdrop')?.addEventListener('click', () => {
    closeExerciseDetailSheet();
  });

  currentContainer.querySelector('#exercise-detail-sheet-close-btn')?.addEventListener('click', () => {
    closeExerciseDetailSheet();
  });

  // Löschen mit Bestätigungsdialog (CLAUDE.md-Konvention für jedes Löschen
  // in der App) - deleteExercise() selbst entscheidet, was mit heute schon
  // begonnenen Sätzen passiert (s. js/db.js). Übungs-Sheet dahinter direkt
  // mit aktualisiertem Zwischenspeicher neu befüllt, statt erst beim
  // nächsten ohnehin fälligen Repaint - dieselbe Reihenfolge wie beim
  // Anlegen einer neuen Übung (s. openExerciseCreateSheet-Submit).
  currentContainer.querySelector('#exercise-detail-sheet-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('Übung wirklich löschen? Sie wird aus allen Routinen entfernt, bereits erfasste Sätze bleiben erhalten.')) {
      return;
    }
    const exerciseId = state.exerciseDetailSheetExerciseId;
    await deleteExercise(exerciseId);
    await loadExerciseSheetCache();
    state.exerciseSheetSelectedIds.delete(exerciseId);
    closeExerciseDetailSheet();
    repaintExerciseSheetContentInPlace();
  });

  wireExerciseDetailSheetDrag();
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
    openRoutinesSheet();
  });

  currentContainer.querySelector('#routines-sheet-backdrop')?.addEventListener('click', () => {
    closeRoutinesSheet();
  });
  currentContainer.querySelector('#routines-sheet-close-btn')?.addEventListener('click', () => {
    closeRoutinesSheet();
  });
  wireRoutinesSheetDrag();

  // "⋮"-Kontextmenü (Bearbeiten/Löschen) an einer Routinen-Karte im
  // Routinen-Sheet, s. renderRoutinesSheetMenu weiter oben.
  currentContainer.querySelectorAll('.routines-sheet-menu-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.routinesSheetMenuRoutineId === btn.dataset.routine) {
        closeRoutinesSheetMenu();
      } else {
        openRoutinesSheetMenu(btn.dataset.routine);
      }
    });
  });

  currentContainer.querySelector('#routines-sheet-menu-backdrop')?.addEventListener('click', () => {
    closeRoutinesSheetMenu();
  });

  // Bearbeiten verlässt das Sheet/den Workout-Tab und öffnet den
  // bestehenden Routinen-Editor direkt für diese Routine - s.
  // requestEditRoutine() in routines.js für den race-freien Übergabeweg
  // (Pending-Flag statt Timing-Annahme über den asynchronen paint()-Ablauf
  // von routines.js).
  currentContainer.querySelector('.routines-sheet-edit-btn')?.addEventListener('click', (e) => {
    const routineId = e.currentTarget.dataset.routine;
    routinesView.requestEditRoutine(routineId);
    document.querySelector('[data-view="routines"]')?.click();
  });

  currentContainer.querySelector('.routines-sheet-delete-btn')?.addEventListener('click', async (e) => {
    const routineId = e.currentTarget.dataset.routine;
    if (!confirm('Routine wirklich löschen?')) return;
    await deleteRoutine(routineId);
    state.routinesSheetMenuRoutineId = null;
    state.routinesSheetMenuClosing = false;
    await paint();
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

  // "⋮"-Kontextmenü zum Entfernen einer noch unbegonnenen Übung aus dem
  // heutigen Workout (s. renderExerciseRosterMenu weiter oben).
  currentContainer.querySelectorAll('.exercise-roster-menu-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.exerciseRosterMenuEntryId === btn.dataset.entry) {
        closeExerciseRosterMenu();
      } else {
        openExerciseRosterMenu(btn.dataset.entry);
      }
    });
  });

  currentContainer.querySelector('#exercise-roster-menu-backdrop')?.addEventListener('click', () => {
    closeExerciseRosterMenu();
  });

  // Kein Bestätigungsdialog (Nutzer-Vorgabe, s. Kommentar bei
  // removeExerciseFromWorkout in js/db.js).
  currentContainer.querySelector('.exercise-roster-remove-btn')?.addEventListener('click', async (e) => {
    const entryId = e.currentTarget.dataset.entry;
    await removeExerciseFromWorkout(entryId);
    state.exerciseRosterMenuEntryId = null;
    state.exerciseRosterMenuClosing = false;
    await paint();
  });

  // --- Übungs-Sheet (Abschnitt 13) ---

  currentContainer.querySelector('#add-exercise-to-workout-btn')?.addEventListener('click', () => {
    openExerciseSheet();
  });

  wireExerciseSheetEvents();
  // Neue-Übung-Sheet und Übungs-Detail-Sheet werden nicht mehr über das
  // globale paint()/wireEvents() verdrahtet, sondern jeweils direkt aus
  // ihrer eigenen open...Sheet()-Funktion heraus (s. dort) - sie sind
  // gestapelte Sheets, die das Übungs-Sheet darunter beim Öffnen/Schließen
  // nicht neu aufbauen dürfen.
}
