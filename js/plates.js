// Rechenlogik des Scheiben-Rechners (Langhantel, s. ADR 0044): Gesamtgewicht
// aus Stangengewicht und den Scheiben beider Seiten, Limit pro Seite, Eingabe-
// Prüfung des Stangengewichts. Reine Funktionen ohne DOM- und Dexie-Zugriff
// (getestet in tests/plates.test.js). Eine Scheiben-Liste gehört immer zu
// EINER Seite; der Aufrufer hält je eine Liste für links und rechts.

// Verfügbare Scheiben in kg, aufsteigend (feste Auswahl, s. ADR 0044).
export const PLATE_WEIGHTS = [1.25, 2.5, 5, 10, 15, 20, 25];

export const DEFAULT_BAR_WEIGHT = 20;

// So viele Scheiben passen pro Seite auf die Hülse (und in die Grafik).
export const MAX_PLATES_PER_SIDE = 8;

// Obergrenze für das Stangengewicht-Eingabefeld: schützt vor Tippfehlern
// (z. B. "2000"), keine echte Stange ist schwerer.
export const MAX_BAR_WEIGHT = 50;

// Rundet auf zwei Nachkommastellen - 1,25-kg-Scheiben sind binär exakt
// darstellbar, ein Stangengewicht wie 7,3 aber nicht (7,3 + 2,5 → 9,8 statt
// 9,799999…).
function round2(n) {
  return Math.round(n * 100) / 100;
}

// Gesamtgewicht = Stange + Scheiben der linken + Scheiben der rechten Seite.
// Ohne `rightPlates` ist die Beladung symmetrisch (rechts = links).
export function totalWeight(barWeight, leftPlates, rightPlates = leftPlates) {
  const sum = (plates) => plates.reduce((acc, w) => acc + w, 0);
  return round2(barWeight + sum(leftPlates) + sum(rightPlates));
}

export function canAddPlate(platesPerSide) {
  return platesPerSide.length < MAX_PLATES_PER_SIDE;
}

// Neue Liste mit der Scheibe, schwerste zuerst (so liegt die schwerste wie an
// einer echten Stange innen am Anschlag). Bei Limit/unbekanntem Wert
// unverändert.
export function addPlate(platesPerSide, weight) {
  if (!PLATE_WEIGHTS.includes(weight) || !canAddPlate(platesPerSide)) return platesPerSide;
  return [...platesPerSide, weight].sort((a, b) => b - a);
}

// Neue Liste ohne EINE Scheibe dieses Gewichts (die erste Fundstelle).
export function removePlate(platesPerSide, weight) {
  const i = platesPerSide.indexOf(weight);
  if (i === -1) return platesPerSide;
  return [...platesPerSide.slice(0, i), ...platesPerSide.slice(i + 1)];
}

// Stangengewicht aus dem Textfeld: akzeptiert Komma und Punkt, nur Zahlen
// über 0 bis MAX_BAR_WEIGHT. Ungültig → null (Aufrufer behält den letzten
// gültigen Wert).
export function parseBarWeight(input) {
  const n = Number(String(input).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_BAR_WEIGHT) return null;
  return round2(n);
}

// Deutsche Schreibweise ohne überflüssige Nullen: 42,5 / 20 / 1,25.
export function formatKg(value) {
  return String(round2(value)).replace('.', ',');
}
