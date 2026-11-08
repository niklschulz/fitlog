// Gemeinsame Bausteine der Liniendiagramme (Volumen im Statistik-Tab, Verlauf
// einer Größe auf der Übungs-Seite), s. ADR 0043. Ohne Chart-Library (kein
// Build-Schritt): Y-Achse/Gitterlinien/Beschriftungen als absolut positionierte
// Elemente, die Verbindungslinie als SVG-`<polyline>`. Die Komponente kennt
// weder Wochen noch Trainingstage - X-Positionen (in Prozent), Tick-Format und
// Achsen-Beschriftungen liefert der Aufrufer. Reine Funktionen ohne DOM- und
// Dexie-Zugriff (getestet in tests/lineChart.test.js).
import { parseISODate, formatDate } from './dates.js';

// Rundet einen rohen Tick-Schritt auf einen "schönen" Wert (1/2/5 × 10^n) -
// vermeidet krumme Y-Achsen-Beschriftungen wie "1234". `minStep` erzwingt
// eine Untergrenze (z. B. 1000 beim "k"-Format des Volumen-Charts).
export function niceTickStep(rawStep, minStep = 0) {
  if (rawStep <= 0) return minStep || 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return Math.max(niceResidual * magnitude, minStep);
}

/**
 * Y-Achse, gezoomt auf den Wertebereich (beginnt bewusst nicht bei 0).
 *
 * Konvention für ALLE Diagramme (design-system.md): Der kleinste Tick liegt
 * genau auf der Grundlinie (X-Achse), der größte am oberen Plot-Rand direkt
 * unter der Trennlinie der Karte. Kein Polster - die Domäne wird auf ganze
 * Tick-Schritte nach unten/oben erweitert, alle Werte bleiben im Bereich.
 *
 * @param {number[]} values  mindestens ein Wert
 * @param {object} [opts]
 * @param {(domainMax:number)=>number} [opts.minStepFor]  Untergrenze des Tick-Schritts
 * @returns {{ domainMin, domainMax, topPct: (v:number)=>number, ticks: number[] }}
 */
export function buildYAxis(values, { minStepFor = () => 0 } = {}) {
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Alle Werte gleich: Wert ± 10 % (mindestens ± 1), damit er mittig steht
  const half = rawMax === rawMin ? Math.max(1, rawMax * 0.1) : 0;
  const lowest = rawMin - half;
  const highest = rawMax + half;

  const tickStep = niceTickStep((highest - lowest) / 4, minStepFor(highest));
  // Ganzzahlige Vielfache statt Aufaddieren: vermeidet Gleitkomma-Drift bei
  // Dezimal-Schritten (0,1 / 0,5)
  const round = (n) => Math.round(n * 1e9) / 1e9;
  const lo = Math.floor(round(lowest / tickStep));
  let hi = Math.ceil(round(highest / tickStep));
  if (hi <= lo) hi = lo + 1;
  const ticks = [];
  for (let i = lo; i <= hi; i++) ticks.push(round(i * tickStep));
  const domainMin = ticks[0];
  const domainMax = ticks[ticks.length - 1];
  const span = domainMax - domainMin;
  const topPct = (v) => ((domainMax - v) / span) * 100;
  return { domainMin, domainMax, topPct, ticks };
}

// Höchstens 4 X-Achsen-Beschriftungen statt einer pro Slot - bei mehr
// überlappen sie sich auf der schmalen Kartenbreite. Bis 6 Slots werden ALLE
// gezeigt, sonst entstünde durch die Rundung eine Lücke mitten in der Reihe
// (wirkt wie eine fehlende Woche). Liefert aufsteigende Indizes.
export function pickLabelIndices(count) {
  if (count <= 0) return [];
  const labelCount = count <= 6 ? count : 4;
  return [...new Set(Array.from({ length: labelCount }, (_, i) => Math.round((i / (labelCount - 1 || 1)) * (count - 1))))];
}

// Marge, innerhalb derer jede Beschriftung mittig sitzt (kein Sonderfall fürs
// erste/letzte Label), s. leftWithEdgeMargin().
export const AXIS_LABEL_EDGE_MARGIN_PCT = 8;

// X-Position (0-100) einer Beschriftung auf der Rand-Marge-Skala: unabhängig
// von der Position der Datenpunkte, damit gleichmäßig verteilte Labels auch
// gleichmäßige Lücken ergeben.
export function leftWithEdgeMargin(xPct) {
  return AXIS_LABEL_EDGE_MARGIN_PCT + (xPct / 100) * (100 - 2 * AXIS_LABEL_EDGE_MARGIN_PCT);
}

/**
 * Beschriftungen finalisieren: aufeinanderfolgende Duplikate entfernen (nur die
 * jeweils erste bleibt, z. B. mehrere Monate desselben Jahres bei reiner
 * Jahreszahl) und genau EINE übrig gebliebene Beschriftung mittig setzen - sie
 * steht dann für die gesamte Achse.
 *
 * @param {{ pos:number, text:string }[]} candidates  chronologisch aufsteigend
 * @param {(pos:number)=>number} leftOf  Position -> `left` in Prozent
 * @returns {{ leftPct:number, text:string }[]}
 */
export function layoutAxisLabels(candidates, leftOf) {
  const deduped = candidates.filter((c, i) => i === 0 || c.text !== candidates[i - 1].text);
  return deduped.map((c) => ({ leftPct: deduped.length === 1 ? 50 : leftOf(c.pos), text: c.text }));
}

// Index des Punkts, dessen X-Position (Prozent) `targetPct` am nächsten liegt;
// bei Gleichstand der frühere. -1 ohne Punkte.
export function nearestIndexByX(xPcts, targetPct) {
  let best = -1;
  let bestDist = Infinity;
  xPcts.forEach((x, i) => {
    const dist = Math.abs(x - targetPct);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  });
  return best;
}

// --- Zeit-Achse (Punkt pro Datum, zeitlich proportional) ---

const DAY_MS = 86400000;
// Abstand zum Plot-Rand in Prozent: erster/letzter Punkt (und die Labels darunter)
// sitzen nicht auf der Kante, sodass Punkt und Beschriftung auf derselben
// X-Position stehen.
export const TIME_AXIS_INSET_PCT = 6;

const daysBetween = (a, b) => Math.round((parseISODate(b) - parseISODate(a)) / DAY_MS);

function addDaysISO(dateStr, n) {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Beschriftung je Zeitraum (wie beim Volumen-Chart): 3M Tag + Monat, 1J Monat +
// zweistelliges Jahr, Max nur die Jahreszahl (mehrere Jahre gleichzeitig).
export function formatTimeAxisLabel(dateStr, range) {
  const year = parseISODate(dateStr).getFullYear();
  if (range === 'max') return `${year}`;
  if (range === '1j') return `${formatDate(dateStr, 'monthShort')} ${String(year).slice(-2)}`;
  return formatDate(dateStr, 'dayMonthShort');
}

/**
 * X-Positionen und Beschriftungen für Datenpunkte, zeitlich proportional
 * zwischen erstem und letztem Datum (mit Rand, s. TIME_AXIS_INSET_PCT).
 *
 * @param {string[]} dates  ISO-Daten, aufsteigend
 * @param {string} range    '3m' | '1j' | 'max' (bestimmt das Label-Format)
 * @returns {{ xPcts:number[], labels:{ leftPct:number, text:string }[] }}
 *   Ein einzelner Punkt (oder ein einziges Datum) steht mittig.
 */
export function buildTimeAxis(dates, range) {
  if (dates.length === 0) return { xPcts: [], labels: [] };
  const first = dates[0];
  const span = daysBetween(first, dates[dates.length - 1]);
  const toPct = (offsetDays) => (span === 0 ? 50 : TIME_AXIS_INSET_PCT + (offsetDays / span) * (100 - 2 * TIME_AXIS_INSET_PCT));
  const xPcts = dates.map((d) => toPct(daysBetween(first, d)));

  const offsets = span === 0 ? [0] : [0, 1, 2, 3].map((k) => Math.round((k / 3) * span));
  const candidates = offsets.map((offset) => ({ pos: toPct(offset), text: formatTimeAxisLabel(addDaysISO(first, offset), range) }));
  return { xPcts, labels: layoutAxisLabels(candidates, (pos) => pos) };
}

// --- Markup ---

const GRIDLINE = 'border-t border-dotted border-white/15';

/**
 * Senkrechte Hilfslinie am ausgewählten Punkt (keine Einzelpunkte, nur die
 * Linie, s. ADR 0043 Nachtrag). Style: `.chart-guide` in css/styles.css.
 */
export function renderChartGuide(points, selectedIndex) {
  const guideLeft = points[selectedIndex]?.xPct ?? 0;
  return `<span class="chart-guide" style="left:${guideLeft}%;${selectedIndex == null || selectedIndex < 0 ? ' display:none;' : ''}"></span>`;
}

/**
 * Liniendiagramm-Markup: Y-Spalte, gepunktete Gitterlinien samt fester
 * Grundlinie (da die Y-Domäne nicht bei 0 beginnt, träfe ein Tick nur zufällig
 * den unteren Rand), Polyline in `text-accent` mit `non-scaling-stroke`
 * (gleichmäßig dicke Segmente trotz gestrecktem viewBox) und Label-Zeile.
 *
 * @param {object} o
 * @param {{ xPct:number, value:number }[]} o.points  nur Punkte mit Wert, aufsteigend
 * @param {ReturnType<typeof buildYAxis>} o.yAxis
 * @param {(value:number)=>string} o.tickLabel  Format der Y-Beschriftung
 * @param {{ leftPct:number, text:string }[]} o.labels  X-Beschriftungen (s. layoutAxisLabels)
 * @param {string} [o.rootAttrs]  Zusatz-Attribute am Wurzelelement (z. B. role/aria-label)
 * @param {string} [o.plotAttrs]  Zusatz-Attribute an der Plot-Fläche (z. B. data-*, Klassen via plotClass)
 * @param {string} [o.plotClass]  Zusatz-Klassen an der Plot-Fläche
 * @param {string} [o.overlayHtml]  Markup über der Linie (z. B. renderChartGuide())
 */
export function renderLineChart({ points, yAxis, tickLabel, labels, rootAttrs = '', plotAttrs = '', plotClass = '', overlayHtml = '' }) {
  const { ticks, topPct } = yAxis;
  const linePoints = points.map((p) => `${p.xPct},${topPct(p.value)}`).join(' ');
  return `
    <div class="flex flex-col gap-2" ${rootAttrs}>
      <div class="flex gap-2">
        <div class="w-8 shrink-0 relative h-40">
          ${ticks.map((t) => `<span class="absolute left-0 text-label text-muted" style="top:${topPct(t)}%; transform: translateY(-50%);">${tickLabel(t)}</span>`).join('')}
        </div>
        <div class="flex-1 relative h-40 ${plotClass}" ${plotAttrs}>
          ${ticks.map((t) => `<div class="absolute left-0 right-0 ${GRIDLINE}" style="top:${topPct(t)}%"></div>`).join('')}
          <div class="absolute left-0 right-0 bottom-0 ${GRIDLINE}"></div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full text-accent">
            <polyline points="${linePoints}" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" />
          </svg>
          ${overlayHtml}
        </div>
      </div>
      <div class="flex gap-2">
        <div class="w-8 shrink-0"></div>
        <div class="flex-1 relative h-4">
          ${labels.map((l) => `<span class="absolute text-label text-muted whitespace-nowrap" style="left:${l.leftPct}%; transform: translateX(-50%);">${l.text}</span>`).join('')}
        </div>
      </div>
    </div>
  `;
}
