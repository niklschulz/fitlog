// Übungs-Seite im Statistik-Tab (Tipp auf eine Übung im Reiter "Übungen").
// Eigenständiges Sub-View-Modul wie workout-exercise-detail.js (gleiches
// render()/paint()/wireEvents()-Muster, Kopfzeile mit Zurück-Pfeil, Reiter als
// Segmented Control), aber übungsbezogen statt auf einen Tages-Eintrag
// bezogen: Reiter "Statistik", "Verlauf" und "Info". Verlauf nutzt dieselbe
// Darstellung wie die Workout-Übungsseite (renderExerciseHistory), Info
// denselben Inhalt wie das Übungs-Detail-Sheet (renderExerciseInfo).
// statistics.js übergibt nur die Übungs-ID und einen onBack-Callback.
import { db, getExerciseSetHistory, getPRsForExercises, todayISODate } from '../db.js';
import { escapeHtml, renderSegmentedControl, renderRangeControl, positionSegmentedIndicator, measureSegmentedIndicatorRect, renderPRIcon, CARD } from '../utils.js';
import { computePersonalBests, computeMaxWeightSeries, computeMaxRepsSeries } from '../exerciseStats.js';
import { buildYAxis, buildTimeAxis, renderLineChart, renderChartGuide, nearestIndexByX } from '../lineChart.js';
import { formatDate as formatDateVariant } from '../dates.js';
import { renderExerciseHistory } from './workout-exercise-detail.js';
import { wireSwipeBack, unwireSwipeBack, triggerBack } from '../swipeBack.js';
import { renderExerciseInfo } from '../exerciseInfo.js';

let currentContainer = null;
let onBack = null;
const state = {
  exerciseId: null,
  activeTab: 'stats', // 'stats' | 'history' | 'info'
  // Zeitraum für ALLE Statistiken dieser Übung ('3m' | '1j' | 'max'), bleibt
  // beim Reiter-Wechsel erhalten, startet bei jedem Öffnen neu auf 3M
  range: '3m',
  // Größe im Verlaufs-Diagramm (Schlüssel aus CHART_METRICS) und der darin
  // ausgewählte Punkt (`null` = letzter Punkt); beides wird bei Zeitraum- oder
  // Größen-Wechsel bzw. beim Öffnen zurückgesetzt
  metric: 'maxWeight',
  selectedIndex: null,
};

// Daten der aktuell gezeichneten Diagramm-Karte, damit die Punkt-Auswahl
// (wireEvents) Kopfzeile und Hervorhebung ohne neues paint() aktualisieren kann.
let chartView = null;

// Wie renderEpoch in workout-exercise-detail.js: verhindert, dass ein noch
// laufender paint() nach Zurück-Tap oder Tab-Wechsel einen fremden Container
// überschreibt.
let renderEpoch = 0;

// `container`/`refreshUnder`: s. workout-exercise-detail.js render().
export async function render(container, { exerciseId, onBack: onBackCallback, refreshUnder = null }) {
  renderEpoch++;
  currentContainer = container;
  onBack = onBackCallback;
  // Wisch vom linken Rand = Zurück-Pfeil (s. js/swipeBack.js).
  wireSwipeBack({ container, onBack: (opts) => onBack(opts), refreshUnder });
  state.exerciseId = exerciseId;
  state.activeTab = 'stats';
  state.range = '3m';
  state.metric = 'maxWeight';
  state.selectedIndex = null;
  await paint();
}

export function unmount() {
  renderEpoch++;
  unwireSwipeBack();
}

// Zwei Segmented Controls auf der Seite (Reiter + Zeitraum), jede in einem
// eigenen Wrapper (`#stat-detail-tabs`/`#stat-range-control`), s. statistics.js.
async function paint({ tabsFromRect = null, rangeFromRect = null } = {}) {
  const myEpoch = renderEpoch;
  const exercise = await db.exercises.get(state.exerciseId);
  if (myEpoch !== renderEpoch) return;
  if (!exercise) {
    // Übung wurde zwischenzeitlich gelöscht - zurück zur Liste
    onBack();
    return;
  }

  let tabHtml = '';
  chartView = null;
  if (state.activeTab === 'history') {
    const [history, prs] = await Promise.all([getExerciseSetHistory(exercise.id), getPRsForExercises([exercise.id])]);
    tabHtml = renderExerciseHistory(history, prs);
  } else if (state.activeTab === 'info') {
    tabHtml = renderExerciseInfo(exercise);
  } else {
    const history = await getExerciseSetHistory(exercise.id);
    const bests = computePersonalBests(history, state.range, todayISODate());
    const metric = CHART_METRICS.find((m) => m.key === state.metric) ?? CHART_METRICS[0];
    const series = metric.series(history, state.range, todayISODate());
    tabHtml = `
      <div class="flex justify-end">${renderRangeControl('stat-range-control', state.range)}</div>
      ${renderMetricChart(metric, series)}
      ${renderPersonalBests(bests)}
    `;
  }
  if (myEpoch !== renderEpoch) return;

  currentContainer.innerHTML = `
    <div class="py-4 flex flex-col gap-4">
      <div class="grid grid-cols-[44px_1fr_44px] items-center gap-3">
        <button id="stat-detail-back-btn" type="button" class="icon-btn-glass tap-feedback text-ink justify-self-start" aria-label="Zurück">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 class="text-card-title text-center truncate">${escapeHtml(exercise.name)}</h1>
      </div>
      <div id="stat-detail-tabs">
        ${renderSegmentedControl(
          [
            { key: 'stats', label: 'Statistik' },
            { key: 'history', label: 'Verlauf' },
            { key: 'info', label: 'Info' },
          ],
          state.activeTab
        )}
      </div>
      ${tabHtml}
    </div>
  `;
  positionSegmentedIndicator(currentContainer.querySelector('#stat-detail-tabs'), { fromRect: tabsFromRect });
  positionSegmentedIndicator(currentContainer.querySelector('#stat-range-control'), { fromRect: rangeFromRect });
  wireEvents();
}

// --- Verlaufs-Diagramm einer Größe ---
//
// Karte über den Bestwerten (ADR 0043): Kopfzeile mit Wert + Datum des
// ausgewählten (Standard: letzten) Punkts, Liniendiagramm mit Einzelpunkten
// (Tippen/Wischen wählt einen Punkt) und darunter die Größen-Leiste. Weitere
// Größen später nur als zusätzlicher Eintrag in CHART_METRICS: jede liefert
// `[{ date, value, ... }]`. Diagramm-Markup und Achsen: js/lineChart.js.
// `detail(point)`: Zusatz hinter der Kopfzahl (HTML), `minStep`: Untergrenze
// des Y-Tick-Schritts (Reps: ganze Zahlen).
const detailSpan = (text) => ` <span class="text-muted text-body font-normal">(${escapeHtml(text)})</span>`;
const CHART_METRICS = [
  {
    key: 'maxWeight',
    label: 'Maximales Gewicht',
    unit: 'kg',
    series: computeMaxWeightSeries,
    detail: (p) => (p.reps ? detailSpan(`x${p.reps}`) : ''),
    minStep: 0,
  },
  {
    key: 'maxReps',
    label: 'Maximale Reps',
    unit: 'Reps',
    series: computeMaxRepsSeries,
    detail: (p) => detailSpan(`${formatNumber(p.weight)} kg`),
    minStep: 1,
  },
];

// Y-Ticks und Kopfzahl: bis zu zwei Nachkommastellen (2,5-kg-Scheiben), ",0" entfällt
const formatTick = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });

function renderChartHeader(metric, point) {
  if (!point) return '';
  return `
    <span class="text-kpi text-ink whitespace-nowrap">${formatNumber(point.value)} <span class="text-muted text-body font-normal">${metric.unit}</span>${metric.detail(point)}</span>
    <span class="text-label uppercase text-muted whitespace-nowrap">${escapeHtml(formatDate(point.date))}</span>
  `;
}

function renderMetricChips() {
  return `
    <div id="stat-metric-chips" class="flex gap-2 overflow-x-auto" role="group" aria-label="Größe">
      ${CHART_METRICS.map((m) => {
        const active = m.key === state.metric;
        return `<button type="button" data-metric="${m.key}" aria-pressed="${active}" class="metric-chip tap-feedback shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-body ${
          active ? 'bg-accent text-base' : 'bg-white/[0.08] text-ink'
        }">${escapeHtml(m.label)}</button>`;
      }).join('')}
    </div>
  `;
}

function renderMetricChart(metric, series) {
  const chips = renderMetricChips();
  if (series.length === 0) {
    return `
      <div class="${CARD} flex flex-col gap-4">
        <p class="text-body text-muted text-center py-6">Keine Daten im Zeitraum.</p>
        ${chips}
      </div>
    `;
  }
  const { xPcts, labels } = buildTimeAxis(series.map((p) => p.date), state.range);
  const points = series.map((p, i) => ({ xPct: xPcts[i], value: p.value }));
  const yAxis = buildYAxis(
    points.map((p) => p.value),
    { minStepFor: () => metric.minStep }
  );
  const selected = state.selectedIndex ?? series.length - 1;
  chartView = { metric, series, xPcts };
  const last = series[series.length - 1];
  const ariaLabel = `${metric.label}, ${series.length} ${series.length === 1 ? 'Trainingstag' : 'Trainingstage'}, zuletzt ${formatNumber(last.value)} ${metric.unit} am ${formatDate(last.date)}`;
  return `
    <div class="${CARD} flex flex-col gap-4">
      <div id="stat-chart-header" class="flex flex-col gap-1">${renderChartHeader(metric, series[selected])}</div>
      <div class="border-t border-divider"></div>
      ${renderLineChart({
        points,
        yAxis,
        tickLabel: formatTick,
        labels,
        rootAttrs: `role="img" aria-label="${escapeHtml(ariaLabel)}"`,
        plotClass: 'chart-plot-interactive',
        plotAttrs: 'id="stat-chart-plot"',
        overlayHtml: renderChartGuide(points, selected),
      })}
      ${chips}
    </div>
  `;
}

// Punkt auswählen: nur Kopfzeile und Hilfslinie ändern, kein neues paint()
function selectChartPoint(index) {
  if (!chartView || index < 0 || index === state.selectedIndex) return;
  state.selectedIndex = index;
  const { metric, series, xPcts } = chartView;
  currentContainer.querySelector('#stat-chart-header').innerHTML = renderChartHeader(metric, series[index]);
  const guide = currentContainer.querySelector('#stat-chart-plot .chart-guide');
  guide.style.left = `${xPcts[index]}%`;
  guide.style.display = '';
}

function wireChartSelection() {
  const plot = currentContainer.querySelector('#stat-chart-plot');
  if (!plot || !chartView) return;
  const select = (e) => {
    const rect = plot.getBoundingClientRect();
    if (rect.width === 0) return;
    selectChartPoint(nearestIndexByX(chartView.xPcts, ((e.clientX - rect.left) / rect.width) * 100));
  };
  plot.addEventListener('pointerdown', (e) => {
    plot.setPointerCapture?.(e.pointerId);
    select(e);
  });
  plot.addEventListener('pointermove', (e) => {
    if (plot.hasPointerCapture?.(e.pointerId)) select(e);
  });
}

// --- Persönliche Bestwerte ---
//
// Tabelle nach Vorbild der Referenz-App: Überschrift links, Zeitraum rechts,
// darunter eine Karte mit je einer Zeile pro Wert (Icon-Kreis, Name, rechts
// Wert + Datum). Berechnung: js/exerciseStats.js (computePersonalBests).
const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"';
const BEST_ICONS = {
  oneRm: `<svg ${ICON_ATTRS}><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4" /></svg>`,
  // Gewicht und Reps: dieselben Formen wie die PR-Markierungen, als Outline
  weight: renderPRIcon('weight', { sizeClass: 'w-5 h-5', outline: true }),
  volume: `<svg ${ICON_ATTRS}><path d="M6 20v-8M12 20V5M18 20v-9" /></svg>`,
  reps: renderPRIcon('reps', { sizeClass: 'w-5 h-5', outline: true }),
};

const formatNumber = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
// 1RM ist eine Schätzung: eine Nachkommastelle (",0" entfällt)
const formatOneRm = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });

// Das Jahr steht immer dabei (Nutzer-Vorgabe) - Zeiträume und Bestwerte
// können über Jahre zurückreichen.
function formatDate(dateStr, { weekday = false } = {}) {
  return formatDateVariant(dateStr, weekday ? 'weekdayDayMonthShortYear' : 'dayMonthShortYear');
}

function renderBestRow(icon, label, best, valueText) {
  const value = best
    ? `<span class="text-body text-ink">${valueText}</span>
       <span class="text-label uppercase text-muted">${escapeHtml(formatDate(best.date, { weekday: true }))}</span>`
    : `<span class="text-body text-muted">–</span>`;
  return `
    <div class="flex items-center gap-3 py-3 min-h-[56px]">
      <span class="w-10 h-10 rounded-full bg-white/[0.08] text-ink flex items-center justify-center flex-shrink-0" aria-hidden="true">${icon}</span>
      <span class="text-card-title flex-1 min-w-0 truncate">${label}</span>
      <span class="flex flex-col items-end gap-0.5 text-right">${value}</span>
    </div>
  `;
}

function renderPersonalBests(bests) {
  const periodLabel = bests.rangeStart ? `${formatDate(bests.rangeStart)} – ${formatDate(todayISODate())}` : '';
  const o = bests.oneRm;
  const w = bests.weight;
  const v = bests.volume;
  const r = bests.reps;
  return `
    <div class="flex flex-col gap-2">
      <div class="flex items-baseline justify-between gap-3">
        <p class="text-label-large text-muted">Persönliche Bestwerte</p>
        <span class="text-label text-muted">${escapeHtml(periodLabel)}</span>
      </div>
      <div class="${CARD} !py-0 divide-y divide-divider">
        ${renderBestRow(BEST_ICONS.oneRm, '1RM', o, o ? `${formatOneRm(o.oneRm)} kg` : '')}
        ${renderBestRow(BEST_ICONS.weight, 'Gewicht', w, w ? `${formatNumber(w.weight)} kg <span class="text-muted">(x${escapeHtml(w.reps)})</span>` : '')}
        ${renderBestRow(BEST_ICONS.volume, 'Volumen', v, v ? `${formatNumber(v.volume)} kg` : '')}
        ${renderBestRow(BEST_ICONS.reps, 'Reps', r, r ? `${escapeHtml(r.reps)} Reps <span class="text-muted">(${formatNumber(r.weight)} kg)</span>` : '')}
      </div>
    </div>
  `;
}

function wireEvents() {
  wireChartSelection();
  currentContainer.querySelectorAll('#stat-metric-chips .metric-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.metric === btn.dataset.metric) return;
      state.metric = btn.dataset.metric;
      state.selectedIndex = null;
      paint();
    });
  });
  currentContainer.querySelector('#stat-detail-back-btn')?.addEventListener('click', () => triggerBack(() => onBack()));
  currentContainer.querySelectorAll('#stat-detail-tabs .segmented-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.activeTab === btn.dataset.tab) return;
      const fromRect = measureSegmentedIndicatorRect(currentContainer.querySelector('#stat-detail-tabs'));
      state.activeTab = btn.dataset.tab;
      paint({ tabsFromRect: fromRect });
    });
  });
  currentContainer.querySelectorAll('#stat-range-control .segmented-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.range === btn.dataset.tab) return;
      const fromRect = measureSegmentedIndicatorRect(currentContainer.querySelector('#stat-range-control'));
      state.range = btn.dataset.tab;
      state.selectedIndex = null;
      paint({ rangeFromRect: fromRect });
    });
  });
}
