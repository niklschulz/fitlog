// Statistik-Tab (Bottom-Nav) - ersetzt seit ADR 0018 den bisherigen
// Übungen-Tab. Folgt render()/paint()/wireEvents() wie die übrigen Views
// (s. CLAUDE.md). Kein unmount() nötig: paint() liest zwar asynchron aus
// IndexedDB, überschreibt bei einem schnellen Tab-Wechsel aber denselben
// `viewContainer` wie jede andere View auch (s. app.js showView()) - dasselbe
// Risiko besteht z. B. auch in routines.js und wird dort ebenfalls nicht
// per Epoch-Sperre abgesichert, da das Zeitfenster bei rein lokalen
// IndexedDB-Lesezugriffen praktisch nicht auftritt.
import { getTrainedDates, todayISODate, addDays, mondayOf } from '../db.js';
import { renderSegmentedControl, CARD } from '../utils.js';
import { getSettings } from '../settings.js';

// Anzahl der im Balkendiagramm gezeigten Wochen (inkl. aktueller Woche),
// s. Markdown-Vorgabe "Default: letzte 8 Wochen".
const HISTORY_WEEKS = 8;

let currentContainer = null;
let state = { activeTab: 'overview' }; // 'overview' | 'exercises'

export function render(container) {
  currentContainer = container;
  state = { activeTab: 'overview' };
  paint();
}

async function paint() {
  const overviewHtml = state.activeTab === 'overview' ? await renderOverviewTab() : '';
  const exercisesHtml = state.activeTab === 'exercises' ? renderExercisesTab() : '';

  currentContainer.innerHTML = `
    <div class="py-4 flex flex-col gap-4">
      <h1 class="text-screen-title">Statistik</h1>
      ${renderSegmentedControl(
        [
          { key: 'overview', label: 'Übersicht' },
          { key: 'exercises', label: 'Übungen' },
        ],
        state.activeTab
      )}
      ${overviewHtml}
      ${exercisesHtml}
    </div>
  `;
  wireEvents();
}

// --- Übersicht-Reiter: "Workouts pro Woche" ---

function yearMonthOf(dateStr) {
  return dateStr.slice(0, 7); // 'YYYY-MM'
}

function addMonths(yearMonth, delta) {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Reine Berechnung, getrennt vom Rendering - erleichtert spätere
// automatisierte Tests, falls dieses Feature mal so heikel wird wie die
// Kaskaden-Funktionen in db.js (aktuell noch nicht der Fall, s.
// CLAUDE.md-Testkonvention).
//
// `trainedDates`: Tage mit mindestens einem erfassten Satz (s.
// getTrainedDates() in db.js - bewusst NICHT die rohen `workouts`-Zeilen,
// die schon ganz ohne geloggten Satz entstehen können).
function computeWorkoutsPerWeekStats(trainedDates, weeklyGoal, maxHistoryWeeks) {
  const today = todayISODate();
  const currentMonday = mondayOf(today);
  const currentYearMonth = yearMonthOf(today);
  const lastYearMonth = addMonths(currentYearMonth, -1);

  const thisWeekCount = trainedDates.filter((d) => d >= currentMonday && d <= addDays(currentMonday, 6)).length;
  const thisMonthCount = trainedDates.filter((d) => yearMonthOf(d) === currentYearMonth).length;
  const lastMonthCount = trainedDates.filter((d) => yearMonthOf(d) === lastYearMonth).length;

  // Immer genau maxHistoryWeeks Wochen (aktuelle + die vorherigen) - auf
  // Nutzer-Wunsch keine Verkürzung auf die Wochen seit dem ersten erfassten
  // Training mehr. Wochen ohne Training werden als Nullbalken angezeigt,
  // nicht ausgelassen (sonst verzerrt sich die X-Achse).
  const buckets = [];
  for (let i = maxHistoryWeeks - 1; i >= 0; i--) {
    const weekStart = addDays(currentMonday, -i * 7);
    const weekEnd = addDays(weekStart, 6);
    const count = trainedDates.filter((d) => d >= weekStart && d <= weekEnd).length;
    buckets.push({ weekStart, count, isCurrent: i === 0 });
  }

  return { thisWeekCount, thisMonthCount, lastMonthCount, weeklyGoal, buckets };
}

// ISO-8601-Kalenderwoche eines Montags: der Donnerstag derselben Woche
// bestimmt, in welches Wochennummer-Jahr sie fällt (Woche 1 ist die Woche
// mit dem ersten Donnerstag des Jahres). `mondayDateStr` ist hier immer ein
// Montag (kommt aus mondayOf()/addDays()-Arithmetik in
// computeWorkoutsPerWeekStats), deshalb reicht "+3 Tage" ohne eigene
// Wochentagsermittlung.
function isoWeekNumber(mondayDateStr) {
  const [y, m, d] = mondayDateStr.split('-').map(Number);
  const thursday = new Date(Date.UTC(y, m - 1, d + 3));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstThursdayDow = (firstThursday.getUTCDay() + 6) % 7; // 0=Mo..6=So
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDow + 3);
  return 1 + Math.round((thursday - firstThursday) / (7 * 86400000));
}

function renderCounterColumn(value, label, { goal, paddingClass = '' } = {}) {
  return `
    <div class="flex-1 flex flex-col gap-1 ${paddingClass}">
      <span class="text-kpi text-ink">${value}${goal ? `<span class="text-muted">/${goal}</span>` : ''}</span>
      <span class="text-label uppercase text-muted">${label}</span>
    </div>
  `;
}

// Balkendiagramm ohne SVG/Chart-Library (kein Build-Schritt, s. CLAUDE.md) -
// y-Achse per CSS-Grid-artiger Flex-Spalte mit gepunkteten Trennlinien,
// Balken als absolut positionierte Flex-Kinder mit prozentualer Höhe
// (0 % bei trainingsfreien Wochen, bewusst kein Mindest-Balken, s.
// computeWorkoutsPerWeekStats). Aktuelle Woche in `bg-accent` hervorgehoben,
// übrige Wochen in einer abgedunkelten Variante derselben Farbe statt eines
// unabhängigen zweiten Tons (s. Nutzer-Diskussion zum Feature).
function renderChart(buckets, weeklyGoal) {
  const maxCount = Math.max(weeklyGoal, ...buckets.map((b) => b.count), 1);
  const tickStep = Math.max(1, Math.ceil(maxCount / 5));
  const ticks = [];
  for (let v = Math.ceil(maxCount / tickStep) * tickStep; v >= 0; v -= tickStep) ticks.push(v);

  return `
    <div class="flex flex-col gap-2">
      <div class="flex gap-2">
        <div class="w-6 shrink-0 flex flex-col justify-between h-40 pb-px">
          ${ticks.map((v) => `<span class="text-label text-muted">${v}</span>`).join('')}
        </div>
        <div class="flex-1 relative h-40">
          <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
            ${ticks.map(() => `<div class="border-t border-dotted border-white/15"></div>`).join('')}
          </div>
          <div class="absolute inset-0 flex items-end gap-2">
            ${buckets
              .map((b) => {
                const heightPct = (b.count / ticks[0]) * 100;
                return `<div class="flex-1 rounded-t-sm ${b.isCurrent ? 'bg-accent' : 'bg-accent/40'}" style="height:${heightPct}%" title="${b.count}"></div>`;
              })
              .join('')}
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <div class="w-6 shrink-0"></div>
        <div class="flex-1 flex gap-2">
          ${buckets
            .map(
              (b) => `
              <div class="flex-1 flex flex-col items-center text-label text-muted">
                <span>KW</span>
                <span>${isoWeekNumber(b.weekStart)}</span>
              </div>
            `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

async function renderOverviewTab() {
  const trainedDates = await getTrainedDates();
  const stats = computeWorkoutsPerWeekStats(trainedDates, getSettings().weeklyGoal, HISTORY_WEEKS);

  return `
    <div class="flex flex-col gap-2">
      <p class="text-body text-muted">Workouts pro Woche</p>
      <div class="${CARD} flex flex-col gap-4">
        <div class="flex divide-x divide-white/10">
          ${renderCounterColumn(stats.thisWeekCount, 'Diese Woche', { goal: stats.weeklyGoal, paddingClass: 'pr-4' })}
          ${renderCounterColumn(stats.thisMonthCount, 'Dieser Monat', { paddingClass: 'px-4' })}
          ${renderCounterColumn(stats.lastMonthCount, 'Vorheriger Monat', { paddingClass: 'pl-4' })}
        </div>
        <div class="border-t border-white/10"></div>
        ${renderChart(stats.buckets, stats.weeklyGoal)}
      </div>
    </div>
  `;
}

function renderExercisesTab() {
  return `<p class="text-body text-muted text-center py-12">Übungen folgen.</p>`;
}

function wireEvents() {
  currentContainer.querySelectorAll('.segmented-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.activeTab === btn.dataset.tab) return;
      state.activeTab = btn.dataset.tab;
      paint();
    });
  });
}
