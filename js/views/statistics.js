// Statistik-Tab (Bottom-Nav) - ersetzt seit ADR 0018 den bisherigen
// Übungen-Tab. Folgt render()/paint()/wireEvents() wie die übrigen Views
// (s. CLAUDE.md). Kein unmount() nötig: paint() liest zwar asynchron aus
// IndexedDB, überschreibt bei einem schnellen Tab-Wechsel aber denselben
// `viewContainer` wie jede andere View auch (s. app.js showView()) - dasselbe
// Risiko besteht z. B. auch in profile.js und wird dort ebenfalls nicht
// per Epoch-Sperre abgesichert, da das Zeitfenster bei rein lokalen
// IndexedDB-Lesezugriffen praktisch nicht auftritt.
import { getTrainedDates, getWeeklyTrainingVolumes, todayISODate, addDays, mondayOf } from '../db.js';
import { renderSegmentedControl, positionSegmentedIndicator, measureSegmentedIndicatorRect, CARD } from '../utils.js';
import { getSettings } from '../settings.js';

// Anzahl der im Balkendiagramm gezeigten Wochen (inkl. aktueller Woche),
// s. Markdown-Vorgabe "Default: letzte 8 Wochen".
const HISTORY_WEEKS = 8;

let currentContainer = null;
let state = { activeTab: 'overview', volumeRange: '3m' }; // activeTab: 'overview' | 'exercises'; volumeRange: '3m' | '1j' | 'max'

export function render(container) {
  currentContainer = container;
  state = { activeTab: 'overview', volumeRange: '3m' };
  paint();
}

// Zwei unabhängige Segmented Controls auf derselben Seite (der Seiten-Reiter
// oben + der Zeitraum-Reiter im Volumen-Chart weiter unten, s.
// renderVolumeSection()) - jede braucht ihre eigene Positions-/Animations-
// Verfolgung, da measureSegmentedIndicatorRect()/positionSegmentedIndicator()
// (utils.js) jeweils nur die ERSTE `.segmented-control` innerhalb des
// übergebenen Containers finden - deshalb hier zwei eigene, per `#id`
// eingegrenzte Wrapper (`#page-tabs`/`#volume-range-control`) statt eines
// gemeinsamen `currentContainer`-Aufrufs. `pageFromRect`/`volumeFromRect`
// (je per measureSegmentedIndicatorRect() VOR dem jeweiligen Wechsel
// gemessen, s. wireEvents()) lassen nur den tatsächlich betroffenen
// Indikator gleitend animieren; der jeweils andere wird unverändert direkt
// repositioniert (kein Sprung, da er sich ja nicht bewegt hat).
async function paint({ pageFromRect = null, volumeFromRect = null } = {}) {
  const overviewHtml = state.activeTab === 'overview' ? await renderOverviewTab() : '';
  const exercisesHtml = state.activeTab === 'exercises' ? renderExercisesTab() : '';

  currentContainer.innerHTML = `
    <div class="py-4 flex flex-col gap-4">
      <h1 class="text-screen-title">Statistik</h1>
      <div id="page-tabs">
        ${renderSegmentedControl(
          [
            { key: 'overview', label: 'Übersicht' },
            { key: 'exercises', label: 'Übungen' },
          ],
          state.activeTab
        )}
      </div>
      ${overviewHtml}
      ${exercisesHtml}
    </div>
  `;
  positionSegmentedIndicator(currentContainer.querySelector('#page-tabs'), { fromRect: pageFromRect });
  positionSegmentedIndicator(currentContainer.querySelector('#volume-range-control'), { fromRect: volumeFromRect });
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
// unabhängigen zweiten Tons (s. Nutzer-Diskussion zum Feature) - als
// deckendes Token `bg-accent-muted` (#637456) statt `bg-accent/40`: optisch
// nahezu gleich, aber die gepunkteten Gitterlinien scheinen nicht mehr durch
// die Balken hindurch (Nutzer-Wunsch). Die y-Achsen-
// Spalte ist `w-8` (nicht das für einstellige Zahlen eigentlich ausreichende
// `w-6`) - MUSS mit der Spaltenbreite in renderVolumeChart() übereinstimmen,
// sonst beginnt der Plot-Bereich (Balken hier, Linie dort) bei
// unterschiedlichem X-Offset und die y-Achsen der beiden untereinander
// stehenden Diagramme wirken gegeneinander verschoben (Nutzer-Bugreport).
// Linksbündige Zahlen (Standard-Textausrichtung, keine Klasse nötig) - MUSS
// mit der Ausrichtung in renderVolumeChart() übereinstimmen (dort ebenfalls
// linksbündig, `left-0` statt `right-0`), sonst säßen die Ziffern trotz
// gleich breiter und gleich positionierter Spalte an entgegengesetzten
// Enden und wirkten weiterhin nicht bündig (Nutzer-Bugreport).
function renderChart(buckets, weeklyGoal) {
  const maxCount = Math.max(weeklyGoal, ...buckets.map((b) => b.count), 1);
  const tickStep = Math.max(1, Math.ceil(maxCount / 5));
  const ticks = [];
  for (let v = Math.ceil(maxCount / tickStep) * tickStep; v >= 0; v -= tickStep) ticks.push(v);

  return `
    <div class="flex flex-col gap-2">
      <div class="flex gap-2">
        <div class="w-8 shrink-0 flex flex-col justify-between h-40 pb-px">
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
                return `<div class="flex-1 rounded-t-sm ${b.isCurrent ? 'bg-accent' : 'bg-accent-muted'}" style="height:${heightPct}%" title="${b.count}"></div>`;
              })
              .join('')}
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <div class="w-8 shrink-0"></div>
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

// --- Übersicht-Reiter: "Volumen" (Zeitraum-Reiter 3M/1J/Max) ---
//
// Ersetzt seit der Hundertzweiundzwanzigsten Iteration das ursprüngliche
// "Volumen pro Trainingstag"-Diagramm (Hunderteinundzwanzigste Iteration)
// vollständig - nach einer vom Nutzer verfassten, deutlich ausführlicheren
// Markdown-Spezifikation umgesetzt (s. Session). Volumen eines Satzes =
// Gewicht × Wiederholungen; Wochenvolumen = Summe über alle Sätze/Übungen
// einer Kalenderwoche (Montag-Sonntag, ISO 8601). Monatswert = DURCHSCHNITT
// (nicht Summe) der trainierten (nicht leeren) vollständigen Wochen dieses
// Monats - verhindert, dass eine Urlaubswoche einen Monat künstlich
// absacken lässt oder Monate mit 4 vs. 5 Wochen unfair verglichen werden.
// Die laufende (unvollständige) Woche fließt NIRGENDS ein - der laufende
// Monat dagegen schon, sobald er mindestens eine vollständige trainierte
// Woche hat (ergibt sich automatisch aus derselben Formel).
//
// Zwei getrennte Datenreihen im Chart: Die PUNKTE zeigen die Rohwerte
// (Wochen- bzw. Monatswert), nur an trainierten Perioden. Die LINIE zeigt
// den gleitenden Durchschnitt (4 Kalenderwochen in der Wochenansicht, 3
// Kalendermonate in der Monatsansicht) - läuft bei einer leeren Periode
// flach weiter statt auf 0 zu fallen, s. computeMovingAverage().
//
// `Falls Sätze als Aufwärmsatz markiert werden können, zählen diese nicht
// mit`: Die App kennt aktuell keine Aufwärmsatz-Markierung (kein `isWarmup`-
// Feld an `sets`) - dieser Punkt der Spezifikation ist damit aktuell nicht
// anwendbar, alle Sätze zählen. Sobald ein solches Feld existiert, muss
// getWeeklyTrainingVolumes() (js/db.js) entsprechend gefiltert werden.

// Rundet einen rohen Tick-Schritt auf einen "schönen" Wert (1/2/5 × 10^n) -
// vermeidet krumme Y-Achsen-Beschriftungen wie "1234". `minStep` erzwingt
// eine Untergrenze (z. B. 1000, s. Aufrufer) - gefahrlos per Math.max
// kombinierbar, da ein sinnvoll gewähltes `minStep` (Zehnerpotenz × 1/2/5)
// selbst bereits ein "schöner" Wert ist.
function niceTickStep(rawStep, minStep = 0) {
  if (rawStep <= 0) return minStep || 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return Math.max(niceResidual * magnitude, minStep);
}

// "4800" -> "4,8k" (deutsches Dezimalkomma), sonst unverändert.
function formatVolumeTick(value) {
  if (value >= 1000) return `${(Math.round(value / 100) / 10).toString().replace('.', ',')}k`;
  return `${Math.round(value)}`;
}

const VOLUME_WEEK_WINDOW = 4; // Moving-Average-Fenster in der Wochenansicht (3M), Kalenderwochen
const VOLUME_MONTH_WINDOW = 3; // Moving-Average-Fenster in der Monatsansicht (1J/Max), Kalendermonate
const VOLUME_3M_WEEKS = 13;
const VOLUME_1J_MONTHS = 12;

// Montag der letzten VOLLSTÄNDIGEN Woche (ihr Sonntag ist bereits vorbei) -
// die laufende Woche selbst wird nie einbezogen (Nutzer-Vorgabe).
function lastCompleteWeekMonday(today) {
  return addDays(mondayOf(today), -7);
}

// Ordnet eine Woche (per Montag) ihrem Monat zu: der Monat, in dem ihr
// Donnerstag liegt (dieselbe ISO-8601-Regel wie bei isoWeekNumber() oben) -
// damit eine über einen Monatswechsel laufende Woche eindeutig genau einem
// Monat zugeordnet ist.
function monthOfWeek(weekStartMonday) {
  const [y, m, d] = weekStartMonday.split('-').map(Number);
  const thursday = new Date(y, m - 1, d + 3);
  return `${thursday.getFullYear()}-${String(thursday.getMonth() + 1).padStart(2, '0')}`;
}

// Dichte Wochen-Reihe von der ersten je trainierten Woche bis zur letzten
// vollständigen Woche - JEDE Kalenderwoche dazwischen bekommt einen Slot
// (`volume: null` bei einer "leeren Woche", auch wenn sie in `rawVolumes`
// komplett fehlt). Nötig, damit sowohl der gleitende Durchschnitt (der
// leere Wochen überspringen, aber ihre Kalenderposition im Fenster kennen
// muss) als auch die X-Achse (leere Wochen bekommen einen Slot, aber
// keinen Punkt, s. Spezifikation) korrekt funktionieren. `rawVolumes` kommt
// aufsteigend sortiert aus getWeeklyTrainingVolumes().
function buildWeeklySeries(rawVolumes, today) {
  if (rawVolumes.length === 0) return [];
  const volumeByWeekStart = Object.fromEntries(rawVolumes.map((w) => [w.weekStart, w.volume]));
  const lastMonday = lastCompleteWeekMonday(today);
  const firstMonday = rawVolumes[0].weekStart;
  if (firstMonday > lastMonday) return []; // erste je erfasste Woche ist die laufende Woche - noch keine vollständige Woche vorhanden

  const series = [];
  for (let w = firstMonday; w <= lastMonday; w = addDays(w, 7)) {
    series.push({ weekStart: w, volume: volumeByWeekStart[w] ?? null });
  }
  return series;
}

// Dichte Monats-Reihe, aus der Wochen-Reihe abgeleitet: ein Monatswert ist
// der Durchschnitt der trainierten (nicht leeren) Wochen dieses Monats -
// leere Wochen zählen nicht mit. Der laufende Monat bekommt - anders als
// die laufende Woche - durchaus einen Slot (und ggf. schon einen Wert,
// sobald er mindestens eine vollständige trainierte Woche hat); das ergibt
// sich automatisch aus derselben Formel, kein Sonderfall nötig.
function buildMonthlySeries(weeklySeries, today) {
  if (weeklySeries.length === 0) return [];
  const volumesByMonth = {};
  for (const w of weeklySeries) {
    if (w.volume == null) continue;
    (volumesByMonth[monthOfWeek(w.weekStart)] ??= []).push(w.volume);
  }
  const firstMonth = monthOfWeek(weeklySeries[0].weekStart);
  const lastMonth = yearMonthOf(today);

  const series = [];
  for (let m = firstMonth; m <= lastMonth; m = addMonths(m, 1)) {
    const volumes = volumesByMonth[m];
    series.push({ month: m, volume: volumes ? volumes.reduce((sum, v) => sum + v, 0) / volumes.length : null });
  }
  return series;
}

// Gleitender Durchschnitt über eine dichte Perioden-Reihe (Wochen oder
// Monate, je nach `windowSize`) - exakt gegen das Rechenbeispiel der
// Spezifikation verifiziert. Regeln: Bei einer TRAINIERTEN Periode ist der
// Wert der Durchschnitt der vorhandenen (nicht-leeren) Werte innerhalb der
// letzten `windowSize` Kalenderperioden (leere Perioden im Fenster werden
// übersprungen, nicht als 0 gezählt); bei einer LEEREN Periode bleibt der
// Wert unverändert (Linie läuft flach weiter statt auf 0 zu fallen). Wird
// über die GESAMTE Historie berechnet (nicht nur den sichtbaren
// Ausschnitt), damit die Linie am linken Rand des sichtbaren Bereichs
// bereits eingeschwungen beginnt statt bei 0 neu anzulaufen (Regel 4 der
// Spezifikation) - der Aufrufer schneidet den sichtbaren Ausschnitt danach
// per slice() zu.
function computeMovingAverage(periods, windowSize) {
  let lastValue = null;
  return periods.map((p, i) => {
    if (p.volume == null) return lastValue;
    const windowStart = Math.max(0, i - windowSize + 1);
    const trainedInWindow = periods.slice(windowStart, i + 1).filter((q) => q.volume != null);
    lastValue = trainedInWindow.reduce((sum, q) => sum + q.volume, 0) / trainedInWindow.length;
    return lastValue;
  });
}

// Reine Berechnung, getrennt vom Rendering (gleicher Grund wie
// computeWorkoutsPerWeekStats oben). `tabKey`: '3m' | '1j' | 'max'.
function computeVolumeChartStats(rawWeeklyVolumes, tabKey, today) {
  const weeklySeries = buildWeeklySeries(rawWeeklyVolumes, today);
  if (weeklySeries.length === 0) return { periods: [], ma: [], unit: 'week', maLast: null, changePct: null, tabKey };

  const weeklyMA = computeMovingAverage(weeklySeries, VOLUME_WEEK_WINDOW);
  const monthlySeries = buildMonthlySeries(weeklySeries, today);
  const monthlyMA = computeMovingAverage(monthlySeries, VOLUME_MONTH_WINDOW);

  // `maStart` ist die Vergleichsbasis für die %-Veränderung - bleibt
  // reiter-spezifisch (wochenbasiert für 3M, monatsbasiert für 1J/Max), da
  // ein Wochenwert "vor 12 Monaten" bzw. "beim allerersten Training" wenig
  // aussagekräftig wäre. Nutzer-Vorgabe.
  let periods, ma, unit, maStart;
  if (tabKey === '3m') {
    const start = Math.max(0, weeklySeries.length - VOLUME_3M_WEEKS);
    periods = weeklySeries.slice(start);
    ma = weeklyMA.slice(start);
    unit = 'week';
    maStart = ma.length > 0 ? ma[0] : null;
  } else {
    const count = tabKey === '1j' ? VOLUME_1J_MONTHS : monthlySeries.length;
    const start = Math.max(0, monthlySeries.length - count);
    periods = monthlySeries.slice(start);
    ma = monthlyMA.slice(start);
    unit = 'month';
    maStart = ma.length > 0 ? ma[0] : null;
  }

  // KPI-Zahl IMMER auf Wochenbasis (Nutzer-Vorgabe: soll sich zwischen den
  // Reitern nicht ändern) - unabhängig von `tabKey` der letzte Wert der
  // vollständigen Wochen-Serie (4-Wochen-Durchschnitt der letzten
  // vollständigen Woche). Für 3M identisch zum bisherigen Verhalten (der
  // letzte Eintrag der 3M-Wochenauswahl IST bereits dieser Wert); für
  // 1J/Max weicht die Zahl jetzt bewusst vom (weiterhin für die Linie im
  // Chart verwendeten) monatsbasierten `ma` ab.
  const maLast = weeklyMA.length > 0 ? weeklyMA[weeklyMA.length - 1] : null;

  // "Nur ein Datenpunkt" (s. Sonderfälle in der Spezifikation) - global
  // über die GESAMTE Wochen-Historie ausgewertet, nicht nur den sichtbaren
  // Ausschnitt: Mit nur einer je trainierten Woche ist die MA-Linie
  // zwangsläufig überall identisch (nichts zum Vergleichen), eine
  // prozentuale Veränderung wäre also immer exakt 0 % und damit
  // nichtssagend statt informativ, selbst wenn zufällig ≥2 Slots im
  // sichtbaren Fenster liegen.
  const trainedCount = weeklySeries.filter((p) => p.volume != null).length;
  const changePct = trainedCount > 1 && maStart ? Math.round(((maLast - maStart) / maStart) * 100) : null;

  return { periods, ma, unit, maLast, changePct, tabKey };
}

// "KW 37" statt Datum - auf Nutzer-Wunsch dasselbe Format wie im
// Balkendiagramm oben ("Workouts pro Woche"), das isoWeekNumber() bereits
// für genau diesen Zweck nutzt (dort zweizeilig "KW"/"37", hier wegen der
// absolut positionierten, nur teilweise sichtbaren Labels einzeilig).
function formatWeekAxisLabel(weekStart) {
  return `KW ${isoWeekNumber(weekStart)}`;
}

// `tabKey` unterscheidet 1J von Max (beide `unit: 'month'`, aber
// unterschiedliches Label-Format, auf Nutzer-Wunsch): 1J zeigt
// Monat+Jahr zweistellig ("Sep 26"), da hier immer nur ein einziges Jahr
// oder ein Jahreswechsel sichtbar ist - Max dagegen oft mehrere Jahre
// gleichzeitig, dort wären wiederholte Monatskürzel ohne Jahr mehrdeutig
// (s. ADR 0023, "bekannte Einschränkung"), deshalb dort nur die Jahreszahl
// ("2026") statt des Monats.
function formatMonthAxisLabel(yearMonth, tabKey) {
  const [y, m] = yearMonth.split('-').map(Number);
  if (tabKey === 'max') return `${y}`;
  const monthShort = new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'short' });
  return `${monthShort} ${String(y).slice(-2)}`;
}

// Liniendiagramm ohne Chart-Library (kein Build-Schritt, s. CLAUDE.md) - Y-
// Achse/Gitterlinien als absolut positionierte Elemente (Prozent-Position
// aus dem Werte-Bereich berechnet, die Skala beginnt bewusst nicht bei 0,
// sondern ist auf den tatsächlichen Wertebereich gezoomt, damit
// Schwankungen sichtbar bleiben). Verbindungslinie (der gleitende
// Durchschnitt) als native SVG-`<polyline>` mit `preserveAspectRatio="none"`
// (füllt die volle Kartenbreite). Zeigt NUR den gleitenden Durchschnitt -
// die ursprünglich zusätzlich eingezeichneten Rohwert-Punkte wurden auf
// Nutzer-Wunsch entfernt (weniger Wirrwarr, die Linie allein transportiert
// den Trend bereits ausreichend); der Werte-Bereich für die Y-Achse
// berücksichtigt entsprechend auch nur noch die MA-Werte, nicht mehr die
// Rohwerte. Farbe über `text-accent` + `stroke="currentColor"` statt eines
// Hex-Werts direkt im SVG-Attribut - bleibt dadurch automatisch mit dem
// zentralen `accent`-Design-Token synchron (s. index.html), auch wenn
// dessen Wert sich künftig wieder ändert. `vector-effect="non-scaling-
// stroke"` verhindert unterschiedlich dicke Liniensegmente (Nutzer-
// Bugreport): Ohne dieses Attribut skaliert `stroke-width` mit der nicht
// seitenverhältnistreuen `viewBox`-Streckung (`preserveAspectRatio="none"`)
// mit, wodurch steilere Segmente dünner/dicker wirken als flachere - mit
// dem Attribut bleibt die Strichdicke unabhängig vom Liniensegment-Winkel
// konstant in echten Bildschirm-Pixeln. Zusätzlich zu den aus `ticks`
// berechneten Gitterlinien eine feste Grundlinie am unteren Rand (`bottom-0`,
// nicht über `ticks` erzeugt): Da die Y-Domäne auf den tatsächlichen
// Wertebereich gezoomt ist (nicht bei 0 beginnend), landet ein "schöner"
// niceTickStep()-Wert nur zufällig exakt am unteren Rand - ohne diese Zeile
// stünde direkt über der x-Achsen-Beschriftung mal eine Linie, mal keine, je
// nach Zufall (Nutzer-Vorgabe: soll wie beim Balkendiagramm darüber immer da
// sein).
function renderVolumeChart(stats) {
  const { periods, ma, unit, tabKey } = stats;
  const maValues = ma.filter((v) => v != null);

  const rawMin = Math.min(...maValues);
  const rawMax = Math.max(...maValues);
  const range = rawMax - rawMin || rawMax || 1;
  const pad = range * 0.15;
  const domainMin = Math.max(0, rawMin - pad);
  const domainMax = rawMax + pad;
  const span = domainMax - domainMin || 1;
  const topPct = (v) => ((domainMax - v) / span) * 100;
  const xPct = (i) => (periods.length > 1 ? (i / (periods.length - 1)) * 100 : 50);

  // Ab 1000 kg zeigt formatVolumeTick() die "k"-Kurzform ("4k") - ohne
  // Untergrenze könnte der rohe Schritt dabei z. B. 500 ergeben (Nutzer-
  // Bugreport: "4,5k" statt einer ganzen Zahl), da die Y-Domäne auf den
  // tatsächlichen Wertebereich gezoomt ist und der Schritt dadurch auch bei
  // großen Absolutwerten klein ausfallen kann. `minStep: 1000` erzwingt
  // dort ausschließlich ganze Tausender-Schritte (1k/2k/5k/10k/...).
  const tickStep = niceTickStep((domainMax - domainMin) / 4, domainMax >= 1000 ? 1000 : 0);
  const ticks = [];
  for (let v = Math.ceil(domainMin / tickStep) * tickStep; v <= domainMax; v += tickStep) ticks.push(v);

  // MA-Linie durchgängig über ALLE Perioden (auch leere, s. o.) - nur
  // Segmente mit bekanntem Wert werden überhaupt gezeichnet (ganz am
  // linken Rand, bevor die erste trainierte Periode je stattfand, gibt es
  // noch keinen MA-Wert, s. computeMovingAverage()).
  const linePoints = ma
    .map((v, i) => (v == null ? null : `${xPct(i)},${topPct(v)}`))
    .filter(Boolean)
    .join(' ');

  // Höchstens 4 X-Achsen-Beschriftungen statt einer pro Slot - bei mehr
  // überlappen sich die Beschriftungen auf der schmalen Kartenbreite (s.
  // Browser-Verifikation beim ursprünglichen Tages-Diagramm). Bei wenigen
  // Perioden (<= 6, passen ohne Kollisionsrisiko nebeneinander) werden
  // stattdessen ALLE gezeigt - sonst erzeugt die gleichmäßige Verteilung von
  // z. B. 4 Labels auf 5 Perioden zwangsläufig eine Lücke MITTEN in der
  // Reihe (0,1,3,4 statt 0,1,2,3,4 - Index 2 fällt bei der Rundung heraus),
  // was wie eine fehlende Woche/ein fehlender Monat wirkt statt wie
  // bewusstes Verdichten (Nutzer-Bugreport: "KW37 fehlt").
  const labelCount = periods.length <= 6 ? periods.length : 4;
  const labelIndices = [...new Set(Array.from({ length: labelCount }, (_, i) => Math.round((i / (labelCount - 1 || 1)) * (periods.length - 1))))];
  const axisLabelOf = (p) => (unit === 'week' ? formatWeekAxisLabel(p.weekStart) : formatMonthAxisLabel(p.month, tabKey));
  // Aufeinanderfolgende Duplikate entfernen (z. B. zwei Monate desselben
  // Jahres im Max-Reiter, dessen Format nur die Jahreszahl zeigt - beide
  // ergäben "2026") - nur die jeweils erste Beschriftung eines Werts bleibt
  // stehen. `labelIndices` ist chronologisch aufsteigend sortiert (Set
  // erhält die Einfügereihenfolge), ein Vergleich mit dem Vorgänger reicht.
  const dedupedLabelIndices = labelIndices.filter(
    (idx, pos) => pos === 0 || axisLabelOf(periods[idx]) !== axisLabelOf(periods[labelIndices[pos - 1]])
  );

  // Eigene, von den Datenpunkten (xPct, s. o.) UNABHÄNGIGE Positions-Skala
  // nur für die Beschriftungen: reserviert an jedem Rand eine Marge, innerhalb
  // derer JEDES Label zentriert sitzt (immer translateX(-50%), kein
  // Sonderfall mehr fürs erste/letzte Label). Vorher waren erstes/letztes
  // Label kantenbündig (0%/100%, Text wuchs nach innen) und die übrigen an
  // ihrer echten xPct-Position zentriert - bei vollständig gezeigten
  // Perioden (s. o.) ergab das trotz gleichmäßig verteilter Perioden
  // ungleichmäßige Lücken (außen eng, innen weit auseinander, Nutzer-
  // Bugreport). Die Marge (8 %, rund 24px bei typischer Kartenbreite) ist
  // großzügig genug für die breiteste vorkommende Beschriftung ("Sep 26"),
  // ohne über den Kartenrand hinauszuragen (16px Karten-Padding als
  // zusätzlicher Puffer, s. `CARD` in utils.js).
  const AXIS_LABEL_EDGE_MARGIN_PCT = 8;
  const labelPct = (i) =>
    periods.length > 1 ? AXIS_LABEL_EDGE_MARGIN_PCT + (i / (periods.length - 1)) * (100 - 2 * AXIS_LABEL_EDGE_MARGIN_PCT) : 50;

  return `
    <div class="flex flex-col gap-2">
      <div class="flex gap-2">
        <div class="w-8 shrink-0 relative h-40">
          ${ticks.map((t) => `<span class="absolute left-0 text-label text-muted" style="top:${topPct(t)}%; transform: translateY(-50%);">${formatVolumeTick(t)}</span>`).join('')}
        </div>
        <div class="flex-1 relative h-40">
          ${ticks.map((t) => `<div class="absolute left-0 right-0 border-t border-dotted border-white/15" style="top:${topPct(t)}%"></div>`).join('')}
          <div class="absolute left-0 right-0 bottom-0 border-t border-dotted border-white/15"></div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full text-accent">
            <polyline points="${linePoints}" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
      <div class="flex gap-2">
        <div class="w-8 shrink-0"></div>
        <div class="flex-1 relative h-4">
          ${dedupedLabelIndices
            .map((i) => {
              // Genau EIN übrig gebliebenes Label (z. B. "2026" im Max-
              // Reiter, wenn die gesamte Zeitspanne noch unter einem Jahr
              // liegt, s. o.) steht mittig statt an seiner ursprünglichen,
              // chronologischen Position - es repräsentiert dann die
              // gesamte sichtbare Achse, nicht nur einen einzelnen
              // Zeitpunkt darin (Nutzer-Vorgabe).
              const left = dedupedLabelIndices.length === 1 ? 50 : labelPct(i);
              return `<span class="absolute text-label text-muted whitespace-nowrap" style="left:${left}%; transform: translateX(-50%);">${axisLabelOf(periods[i])}</span>`;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

// Zeitraum-Reiter (3M/1J/Max) als zweite, eigenständige Segmented Control
// auf derselben Seite - Wrapper-`id` s. paint()/wireEvents() für die
// Begründung, warum ein eigener Wrapper nötig ist.
const VOLUME_RANGE_TABS = [
  { key: '3m', label: '3M' },
  { key: '1j', label: '1J' },
  { key: 'max', label: 'Max' },
];

function renderVolumeSection(volumeRange, stats) {
  const hasData = stats.periods.length > 0;
  const changeHtml =
    stats.changePct == null
      ? ''
      : `<span class="text-body ${stats.changePct >= 0 ? 'text-accent' : 'text-red-400'}">${stats.changePct >= 0 ? '+' : ''}${stats.changePct} %</span>`;

  // Kompakt statt volle Kartenbreite (Nutzer-Wunsch): derselbe
  // renderSegmentedControl() wie überall sonst, aber in einen schmalen,
  // rechtsbündigen Wrapper gesteckt statt in einen vollbreiten - die
  // Segmente selbst bleiben `flex-1` (füllen weiterhin GENAU diesen
  // schmalen Wrapper, nicht mehr die ganze Karte). Keine Änderung an
  // utils.js nötig.
  const tabsHtml = `<div id="volume-range-control" class="w-36 shrink-0">${renderSegmentedControl(VOLUME_RANGE_TABS, volumeRange)}</div>`;

  if (!hasData) {
    return `
      <div class="flex flex-col gap-2">
        <p class="text-body text-muted">Volumen</p>
        <div class="${CARD} flex flex-col gap-4">
          <div class="flex justify-end">${tabsHtml}</div>
          <p class="text-body text-muted text-center py-6">Noch keine vollständige Trainingswoche erfasst.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="flex flex-col gap-2">
      <p class="text-body text-muted">Volumen</p>
      <div class="${CARD} flex flex-col gap-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex flex-col gap-1 min-w-0">
            <div class="flex items-baseline gap-2 flex-wrap">
              <span class="text-kpi text-ink whitespace-nowrap">${Math.round(stats.maLast)} <span class="text-muted text-body font-normal">kg</span></span>
              ${changeHtml}
            </div>
            <span class="text-label uppercase text-muted whitespace-nowrap">Ø Wochenvolumen</span>
          </div>
          ${tabsHtml}
        </div>
        <div class="border-t border-divider"></div>
        ${renderVolumeChart(stats)}
      </div>
    </div>
  `;
}

async function renderOverviewTab() {
  const trainedDates = await getTrainedDates();
  const stats = computeWorkoutsPerWeekStats(trainedDates, getSettings().weeklyGoal, HISTORY_WEEKS);
  const volumeStats = computeVolumeChartStats(await getWeeklyTrainingVolumes(), state.volumeRange, todayISODate());

  return `
    <div class="flex flex-col gap-2">
      <p class="text-body text-muted">Workouts pro Woche</p>
      <div class="${CARD} flex flex-col gap-4">
        <div class="flex divide-x divide-divider">
          ${renderCounterColumn(stats.thisWeekCount, 'Diese Woche', { goal: stats.weeklyGoal, paddingClass: 'pr-4' })}
          ${renderCounterColumn(stats.thisMonthCount, 'Dieser Monat', { paddingClass: 'px-4' })}
          ${renderCounterColumn(stats.lastMonthCount, 'Vorheriger Monat', { paddingClass: 'pl-4' })}
        </div>
        <div class="border-t border-divider"></div>
        ${renderChart(stats.buckets, stats.weeklyGoal)}
      </div>
    </div>
    ${renderVolumeSection(state.volumeRange, volumeStats)}
  `;
}

function renderExercisesTab() {
  return `<p class="text-body text-muted text-center py-12">Übungen folgen.</p>`;
}

function wireEvents() {
  currentContainer.querySelectorAll('#page-tabs .segmented-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.activeTab === btn.dataset.tab) return;
      const fromRect = measureSegmentedIndicatorRect(currentContainer.querySelector('#page-tabs'));
      state.activeTab = btn.dataset.tab;
      paint({ pageFromRect: fromRect });
    });
  });

  // Nur vorhanden, solange der Übersicht-Reiter aktiv ist (s.
  // renderVolumeSection()) - querySelectorAll liefert sonst einfach eine
  // leere Liste, forEach darauf ist ein No-op.
  currentContainer.querySelectorAll('#volume-range-control .segmented-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.volumeRange === btn.dataset.tab) return;
      const fromRect = measureSegmentedIndicatorRect(currentContainer.querySelector('#volume-range-control'));
      state.volumeRange = btn.dataset.tab;
      paint({ volumeFromRect: fromRect });
    });
  });
}
