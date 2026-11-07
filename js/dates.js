// Datums-Helfer ohne DOM- und Dexie-Zugriff (lokale Zeitzone, kein UTC-Shift)
// - eine Stelle für das Parsen von 'YYYY-MM-DD'/'YYYY-MM' und für alle
// deutschen Datums-Ausgaben der Views. Rein, damit sie wie muscleStats.js
// ohne Datenbank in Node testbar bleiben (tests/dates.test.js).

// 'YYYY-MM-DD' (oder 'YYYY-MM' = 1. des Monats) als lokales Datum. Bewusst
// NICHT `new Date('YYYY-MM-DD')`: das wäre UTC-Mitternacht und verschiebt
// den Tag je nach Zeitzone.
export function parseISODate(dateStr) {
  const [y, m, d = 1] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Benannte Ausgabe-Varianten (Intl-Optionen für de-DE). Jede Variante
// reproduziert exakt die Optionen, die vorher lokal in den Views standen.
const DATE_FORMATS = {
  weekdayShort: { weekday: 'short' }, // "Mo"
  weekdayLong: { weekday: 'long' }, // "Montag"
  dayMonthLong: { day: 'numeric', month: 'long' }, // "1. November"
  dayMonth2Long: { day: '2-digit', month: 'long' }, // "01. November"
  monthShort: { month: 'short' }, // "Nov"
  monthYearLong: { month: 'long', year: 'numeric' }, // "November 2026"
  weekdayDayMonthShort: { weekday: 'short', day: 'numeric', month: 'short' }, // "Sa., 1. Nov."
  dayMonthShort: { day: 'numeric', month: 'short' }, // "1. Nov."
  dayMonthShortYear: { day: 'numeric', month: 'short', year: 'numeric' }, // "1. Nov. 2026"
  weekdayDayMonthShortYear: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, // "Sa., 1. Nov. 2026"
  fullLong: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }, // "Sonntag, 01. November 2026"
};

export function formatDate(dateStr, variant) {
  const options = DATE_FORMATS[variant];
  if (!options) throw new Error(`Unbekannte Datums-Variante: ${variant}`);
  return parseISODate(dateStr).toLocaleDateString('de-DE', options);
}

// 'YYYY-MM-DD...' (auch ISO-Zeitstempel) als 'TT.MM.JJJJ' - reine
// String-Umordnung, kein Date.
export function formatDateDotted(isoDate) {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

// 'YYYY-MM' eines 'YYYY-MM-DD'-Datums.
export function yearMonthOf(dateStr) {
  return dateStr.slice(0, 7);
}

// 'YYYY-MM' + n Monate.
export function addMonths(yearMonth, delta) {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
