import { lockBodyScroll, unlockBodyScroll, wireSheetDrag, createSheetCloser, cancelClosers } from './sheet.js';
import { getSettings, saveSettings } from './settings.js';
import {
  PLATE_WEIGHTS,
  DEFAULT_BAR_WEIGHT,
  totalWeight,
  canAddPlate,
  addPlate,
  removePlate,
  parseBarWeight,
  formatKg,
} from './plates.js';

// Scheiben-Rechner (s. ADR 0044): Bottom-Sheet mit einer Langhantel-Grafik
// (beide Seiten), in der man Scheiben antippt, um sie aufzulegen/abzunehmen.
// Standardmäßig werden beide Seiten gleich beladen; der Schalter „Ungleich
// beladen“ erlaubt unterschiedliche Beladung, dann wählt man in der Grafik die aktive Seite.
// Reine Rechenhilfe: ✓ übergibt das Gesamtgewicht an `onApply` (die
// Detailseite trägt es ins Gewichtsfeld ein) und schließt, ✕/Wegziehen/Tap
// auf den Hintergrund verwirft. Es gibt bewusst keine Kopplung in
// Gegenrichtung - das Sheet liest das Gewichtsfeld nie.
//
// Eigener State statt View-State (wie noteSheet.js): Scheiben, Seiten-Schalter
// und aktive Seite bleiben beim erneuten Öffnen erhalten, solange die
// Übungsseite offen ist; `unmountPlateSheet()` (im unmount() der Detailseite)
// setzt sie zurück. Das Stangengewicht dagegen liegt dauerhaft in den
// Einstellungen (`plateBarWeight`).
let container = null;
let open = false;
let closing = false;
let removeViewportListener = null;
// Scheiben je Seite, schwerste zuerst. Bei `synced` sind beide Listen gleich.
let plates = { left: [], right: [] };
let synced = true;
let activeSide = 'left'; // nur relevant, wenn `synced` aus ist
let barWeight = DEFAULT_BAR_WEIGHT;
let onApplyCallback = null;

// Grafik: Anzeige-Maße pro Scheibe (viewBox-Einheiten). Höhe und Dicke wachsen
// mit dem Gewicht, 25 und 20 kg sind wie in echt gleich groß. 8 Scheiben
// pro Seite à 25 kg (8 × 16) passen noch auf die Hülse (136 Einheiten).
// Die Klassen stehen ausgeschrieben da, damit Tailwind sie beim Build findet.
const PLATE_LOOK = {
  25: { color: 'plate-red', bg: 'bg-plate-red', h: 112, w: 15 },
  20: { color: 'plate-blue', bg: 'bg-plate-blue', h: 112, w: 14 },
  15: { color: 'plate-yellow', bg: 'bg-plate-yellow', h: 96, w: 13 },
  10: { color: 'plate-green', bg: 'bg-plate-green', h: 72, w: 12 },
  5: { color: 'plate-white', bg: 'bg-plate-white', h: 56, w: 10 },
  2.5: { color: 'plate-black', bg: 'bg-plate-black', h: 46, w: 9 },
  1.25: { color: 'plate-black', bg: 'bg-plate-black', h: 38, w: 8 },
};
// Auf hellen Scheiben (gelb, weiß) ist die Beschriftung dunkel.
const DARK_LABEL = new Set([15, 5]);

// Feste Grafik-Größe: Die Karte darf sich nie ändern, egal wie viele Scheiben
// aufliegen (oben Platz für die Seiten-Beschriftung bei ungleicher Beladung).
const VIEW_W = 340;
const VIEW_H = 156;
const CENTER_Y = 80;
const SLEEVE_START_X = 202; // rechte Hülse beginnt hinter dem Anschlag

function sideKey(side) {
  return synced ? 'left' : side;
}

// Seite, auf die Auflegen/„voll"-Prüfung wirkt.
function targetPlates() {
  return plates[sideKey(activeSide)];
}

export function unmountPlateSheet() {
  cancelClosers(closer);
  if (open) {
    open = false;
    closing = false;
    removeViewportListener?.();
    removeViewportListener = null;
    unlockBodyScroll();
  }
  plates = { left: [], right: [] };
  synced = true;
  activeSide = 'left';
  onApplyCallback = null;
}

// Eine Stangenseite als SVG: Scheiben von innen nach außen, links gespiegelt.
function renderSidePlates(sidePlates, side) {
  let x = SLEEVE_START_X;
  return sidePlates
    .map((weight) => {
      const { color, h, w } = PLATE_LOOK[weight];
      const rightX = x;
      x += w + 1;
      const px = side === 'right' ? rightX : VIEW_W - rightX - w;
      const y = CENTER_Y - h / 2;
      const style = `fill: var(--color-${color}); stroke: rgb(var(--rgb-ink) / 0.4); stroke-width: 1;`;
      return `<g data-plate="${weight}" data-side="${side}" role="button" aria-label="${formatKg(weight)} kg abnehmen"><rect x="${px}" y="${y}" width="${w}" height="${h}" rx="2" style="${style}" /></g>`;
    })
    .join('');
}

// Stange, Anschläge und Scheiben als Inline-SVG. Farben nur über CSS-
// Variablen (ADR 0041). Ohne Synchronisierung zusätzlich: Beschriftung der
// Seiten, Hervorhebung der aktiven Seite und eine antippbare Fläche je Seite.
function renderBar() {
  const metal = 'fill: rgb(var(--rgb-muted) / 0.5);';
  const metalDark = 'fill: rgb(var(--rgb-muted) / 0.3);';
  const halfW = VIEW_W / 2;

  let sideUi = '';
  let sideHit = '';
  if (!synced) {
    const label = (side, text, cx) =>
      `<text x="${cx}" y="14" text-anchor="middle" style="font-size: 10px; font-weight: 600; letter-spacing: 0.6px; fill: ${
        activeSide === side ? 'var(--color-accent)' : 'var(--color-muted)'
      };">${text}</text>`;
    const band = (side, x) =>
      activeSide === side
        ? `<rect x="${x}" y="2" width="${halfW - 4}" height="${VIEW_H - 4}" rx="6" style="fill: rgb(var(--rgb-accent) / 0.1); stroke: rgb(var(--rgb-accent) / 0.55); stroke-width: 1;" />`
        : '';
    sideUi = band('left', 2) + band('right', halfW + 2) + label('left', 'LINKS', halfW / 2) + label('right', 'RECHTS', halfW + halfW / 2);
    // Transparent, aber antippbar - liegt über der Stange, unter den Scheiben.
    sideHit =
      `<rect data-side-select="left" x="0" y="0" width="${halfW}" height="${VIEW_H}" style="fill: transparent;" />` +
      `<rect data-side-select="right" x="${halfW}" y="0" width="${halfW}" height="${VIEW_H}" style="fill: transparent;" />`;
  }

  return `
    <svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" class="w-full block" role="img" aria-label="Langhantel, links ${plates.left.length}, rechts ${plates.right.length} Scheiben">
      ${sideUi}
      <rect x="2" y="${CENTER_Y - 4}" width="${VIEW_W - 4}" height="8" rx="4" style="${metalDark}" />
      <rect x="${VIEW_W - 140}" y="${CENTER_Y - 7}" width="138" height="14" rx="3" style="${metal}" />
      <rect x="2" y="${CENTER_Y - 7}" width="138" height="14" rx="3" style="${metal}" />
      <rect x="${SLEEVE_START_X - 7}" y="${CENTER_Y - 18}" width="7" height="36" rx="2" style="${metal}" />
      <rect x="${VIEW_W - SLEEVE_START_X}" y="${CENTER_Y - 18}" width="7" height="36" rx="2" style="${metal}" />
      ${sideHit}
      ${renderSidePlates(plates.right, 'right')}
      ${renderSidePlates(plates.left, 'left')}
    </svg>
  `;
}

// Schalter „Ungleich beladen“ (aus = Standard: beide Seiten gleich).
function renderSyncSwitch() {
  const unequal = !synced;
  return `
    <button id="plate-sync-btn" type="button" role="switch" aria-checked="${unequal}"
      class="tap-feedback flex items-center gap-3 min-h-[44px] text-body text-ink">
      <span class="relative flex-shrink-0 w-10 h-6 rounded-full ${unequal ? 'bg-accent' : 'bg-highlight'}">
        <span class="absolute top-0.5 w-5 h-5 rounded-full ${unequal ? 'left-[18px] bg-base' : 'left-0.5 bg-ink'}"></span>
      </span>
      Ungleich beladen
    </button>
  `;
}

function renderPlateButtons() {
  const full = !canAddPlate(targetPlates());
  return PLATE_WEIGHTS.map((weight) => {
    const { bg } = PLATE_LOOK[weight];
    const label = DARK_LABEL.has(weight) ? 'text-base' : 'text-ink';
    return `
      <button type="button" data-add="${weight}" ${full ? 'disabled' : ''}
        class="tap-feedback min-h-[56px] rounded-btn font-semibold text-card-title ${label} ${bg} border border-ink/30 ${full ? 'opacity-40 pointer-events-none' : ''}"
        aria-label="${formatKg(weight)} kg auflegen">${formatKg(weight)}</button>
    `;
  }).join('');
}

function renderSheet() {
  return `
    <div id="plate-sheet-backdrop" class="bottom-sheet-backdrop fixed inset-0 bg-black/50" style="z-index: 52;"></div>
    <div id="plate-sheet-panel" class="bottom-sheet fixed left-0 right-0 bottom-0 bg-base rounded-sheet flex flex-col" style="z-index: 53; top: auto; max-height: calc(100dvh - env(safe-area-inset-top) - 8px); padding-bottom: env(safe-area-inset-bottom);">
      <div class="grid grid-cols-[44px_1fr_44px] items-center px-4 pt-3 pb-3 flex-shrink-0">
        <button id="plate-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div id="plate-sheet-handle" class="w-full min-h-[44px]" style="touch-action: none;"></div>
        <button id="plate-sheet-apply-btn" type="button" class="icon-btn-glass icon-btn-glass-accent tap-feedback justify-self-end" aria-label="Gewicht übernehmen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
      <div id="plate-sheet-body" class="bottom-sheet-scroll px-4 pb-5 flex flex-col gap-4 min-h-0 overflow-y-auto">
        <div class="flex flex-col gap-3">
          <h2 class="text-screen-title">Scheiben-Rechner</h2>
          <div class="flex flex-col gap-1">
            <span class="text-label uppercase text-muted">Gesamtgewicht</span>
            <span id="plate-total" class="text-kpi"></span>
          </div>
        </div>

        <div class="bg-surface rounded-card px-2 pt-4 pb-1 flex flex-col">
          <div id="plate-bar">${renderBar()}</div>
          <div id="plate-sync" class="px-2">${renderSyncSwitch()}</div>
        </div>

        <div class="grid grid-cols-4 gap-3 items-center">
          <label class="col-span-3 flex items-center justify-end gap-3">
            <span class="text-label uppercase text-muted">Stange (kg)</span>
            <input id="plate-bar-input" type="text" inputmode="decimal" autocomplete="off" value="${formatKg(barWeight)}" class="w-16 text-center bg-surface rounded-btn py-2 text-ink" style="font-size: 16px;" />
          </label>
          <button id="plate-clear-btn" type="button" class="tap-feedback w-full bg-surface rounded-btn px-3 py-2 min-h-[40px] text-body text-ink disabled:pointer-events-none">Leeren</button>
        </div>

        <div id="plate-buttons" class="grid grid-cols-4 gap-3">${renderPlateButtons()}</div>
      </div>
    </div>
  `;
}

// Nur die veränderlichen Teile neu zeichnen - das Stangen-Eingabefeld bleibt
// unangetastet (Fokus und Cursor gehen sonst bei jedem Tipp verloren).
function updateDynamic() {
  if (!container) return;
  const bar = container.querySelector('#plate-bar');
  if (bar) bar.innerHTML = renderBar();
  const sync = container.querySelector('#plate-sync');
  if (sync) sync.innerHTML = renderSyncSwitch();
  const buttons = container.querySelector('#plate-buttons');
  if (buttons) buttons.innerHTML = renderPlateButtons();
  const total = container.querySelector('#plate-total');
  if (total) total.textContent = `${formatKg(totalWeight(barWeight, plates.left, plates.right))} kg`;
  const clear = container.querySelector('#plate-clear-btn');
  if (clear) {
    const empty = !plates.left.length && !plates.right.length;
    clear.disabled = empty;
    clear.classList.toggle('opacity-40', empty);
  }
}

// Auflegen: bei gleicher Beladung auf beide Seiten, sonst auf die aktive.
function addToBar(weight) {
  if (synced) {
    const next = addPlate(plates.left, weight);
    plates = { left: next, right: next };
  } else {
    plates = { ...plates, [activeSide]: addPlate(plates[activeSide], weight) };
  }
}

// Abnehmen einer Scheibe von der angetippten Seite (bei gleicher Beladung von
// beiden).
function removeFromBar(weight, side) {
  if (synced) {
    const next = removePlate(plates.left, weight);
    plates = { left: next, right: next };
  } else {
    plates = { ...plates, [side]: removePlate(plates[side], weight) };
    activeSide = side;
  }
}

// Schalter „Ungleich beladen“: Zurück zu „gleich“ gleicht beide Seiten an die
// zuletzt aktive Seite an (die andere wird überschrieben), Einschalten behält
// die bisherige Beladung und lässt sie ab jetzt einzeln ändern.
function toggleSynced() {
  if (!synced) {
    const source = plates[activeSide];
    plates = { left: [...source], right: [...source] };
  }
  synced = !synced;
}

// Liest das Textfeld: gültiger Wert wird übernommen (und mit `persist`
// gemerkt), sonst gilt der letzte gültige Wert weiter. `normalize` schreibt
// ihn zurück ins Feld (z. B. "20,0" → "20" oder nach ungültiger Eingabe).
function readBarWeight({ persist = false, normalize = false } = {}) {
  const input = container?.querySelector('#plate-bar-input');
  const parsed = parseBarWeight(input?.value ?? '');
  if (parsed !== null) {
    barWeight = parsed;
    if (persist) saveSettings({ ...getSettings(), plateBarWeight: barWeight });
  }
  if (normalize && input) input.value = formatKg(barWeight);
}

const closer = createSheetCloser({
  isOpen: () => open,
  isClosing: () => closing,
  setClosing: () => {
    closing = true;
  },
  animate: () => {
    document.activeElement?.blur?.();
    const backdrop = container?.querySelector('#plate-sheet-backdrop');
    backdrop?.nextElementSibling?.classList.add('closing');
    backdrop?.classList.add('closing');
  },
  finalize: () => {
    open = false;
    closing = false;
    removeViewportListener?.();
    removeViewportListener = null;
    unlockBodyScroll();
    const backdrop = container?.querySelector('#plate-sheet-backdrop');
    backdrop?.nextElementSibling?.remove();
    backdrop?.remove();
  },
});

// `container`: Element, an das das Sheet angehängt wird (`#view-container`, s.
// Aufruf in workout-exercise-detail.js). `onApply(kg)` läuft beim ✓ mit dem
// Gesamtgewicht, noch bevor das Sheet zugeht.
export function openPlateSheet({ container: containerEl, onApply }) {
  if (open) return;
  container = containerEl;
  onApplyCallback = onApply;
  barWeight = parseBarWeight(getSettings().plateBarWeight) ?? DEFAULT_BAR_WEIGHT;
  open = true;
  closing = false;
  lockBodyScroll();
  container.insertAdjacentHTML('beforeend', renderSheet());
  updateDynamic();

  const panel = container.querySelector('#plate-sheet-panel');
  const backdropEl = container.querySelector('#plate-sheet-backdrop');

  // Tastatur (Stangen-Textfeld): iOS überdeckt nur den unteren Teil des
  // Layout-Viewports. Das Sheet bleibt am unteren Rand verankert, sein
  // Innenabstand unten wächst um die Tastaturhöhe; da das Sheet dadurch höher
  // als der Bildschirm werden kann, ist der Inhalt scrollbar. Wichtig für ein
  // ruckelfreies Ein-/Ausfahren (Bild-für-Bild-Auswertung einer iPhone-
  // Aufnahme, s. ADR 0044): Der Abstand folgt NUR den Visual-Viewport-
  // Ereignissen, die iOS während der Tastatur-Animation schickt - kein
  // sofortiges Setzen beim Fokus/Blur (das ließ das Sheet erst nach oben
  // springen und wieder zurückfallen) und kein Scrollen während der
  // Animation. Das Stangenfeld wird erst gescrollt, wenn sich die Tastatur
  // beruhigt hat, und nur, wenn es nicht schon sichtbar ist. Meldet iOS auch
  // 700 ms nach dem Fokus keine Tastaturhöhe, gilt auf Touch-Geräten ein
  // Schätzwert.
  const barInput = container.querySelector('#plate-bar-input');
  const vv = window.visualViewport;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  let timers = [];
  let fallbackArmed = false;
  let settleTimer = null;
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
    clearTimeout(settleTimer);
    settleTimer = null;
  };
  const measuredKeyboard = () => (vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0);
  const applyKeyboardInset = () => {
    if (!panel || !open) return 0;
    let keyboard = measuredKeyboard();
    if (!keyboard && fallbackArmed && document.activeElement === barInput) keyboard = Math.round(window.innerHeight * 0.4);
    const value = keyboard ? `${keyboard}px` : 'env(safe-area-inset-bottom)';
    if (panel.style.paddingBottom !== value) panel.style.paddingBottom = value;
    return keyboard;
  };
  // Erst nach der Animation: Feld nur dann in den sichtbaren Bereich scrollen,
  // wenn es nicht ohnehin zu sehen ist.
  const scheduleReveal = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (document.activeElement === barInput && applyKeyboardInset()) {
        barInput.closest('label')?.scrollIntoView({ block: 'nearest' });
      }
    }, 250);
  };
  barInput?.addEventListener('focus', () => {
    fallbackArmed = false;
    timers.push(
      setTimeout(() => {
        fallbackArmed = coarse;
        applyKeyboardInset();
        scheduleReveal();
      }, 700)
    );
  });
  barInput?.addEventListener('blur', () => {
    fallbackArmed = false;
    // Kein sofortiges Zurücksetzen: Die Resize-Ereignisse der ausfahrenden
    // Tastatur führen den Abstand mit. Nur zur Sicherheit am Ende abgleichen.
    timers.push(setTimeout(applyKeyboardInset, 900));
  });
  if (vv) {
    const onViewportResize = () => {
      applyKeyboardInset();
      if (document.activeElement === barInput) scheduleReveal();
    };
    // Verschiebt iOS die Seite trotzdem (Tastatur schiebt den Viewport),
    // wird sie zurückgesetzt, damit die Kopfzeile des Sheets sichtbar bleibt.
    const onViewportScroll = () => {
      if (window.scrollY !== 0 || vv.pageTop !== 0) window.scrollTo(0, 0);
      applyKeyboardInset();
    };
    vv.addEventListener('resize', onViewportResize);
    vv.addEventListener('scroll', onViewportScroll);
    removeViewportListener = () => {
      vv.removeEventListener('resize', onViewportResize);
      vv.removeEventListener('scroll', onViewportScroll);
      clearTimers();
    };
  } else {
    removeViewportListener = clearTimers;
  }

  container.querySelector('#plate-bar')?.addEventListener('click', (e) => {
    const group = e.target.closest('[data-plate]');
    if (group) {
      removeFromBar(Number(group.dataset.plate), group.dataset.side);
      updateDynamic();
      return;
    }
    const sideHit = e.target.closest('[data-side-select]');
    if (sideHit && !synced) {
      activeSide = sideHit.dataset.sideSelect;
      updateDynamic();
    }
  });

  container.querySelector('#plate-sync')?.addEventListener('click', (e) => {
    if (!e.target.closest('#plate-sync-btn')) return;
    toggleSynced();
    updateDynamic();
  });

  container.querySelector('#plate-buttons')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    addToBar(Number(btn.dataset.add));
    updateDynamic();
  });

  container.querySelector('#plate-clear-btn')?.addEventListener('click', () => {
    plates = { left: [], right: [] };
    updateDynamic();
  });

  // Live mitrechnen, solange der Text gültig ist; gemerkt wird erst beim
  // Verlassen des Felds (change).
  barInput?.addEventListener('input', () => {
    readBarWeight();
    updateDynamic();
  });
  barInput?.addEventListener('change', () => {
    readBarWeight({ persist: true, normalize: true });
    updateDynamic();
  });
  barInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') barInput.blur();
  });

  backdropEl?.addEventListener('click', () => closer.close());
  container.querySelector('#plate-sheet-close-btn')?.addEventListener('click', () => closer.close());
  container.querySelector('#plate-sheet-apply-btn')?.addEventListener('click', () => {
    if (closing) return;
    // Falls das Feld noch fokussiert ist (change noch nicht gefeuert).
    readBarWeight({ persist: true, normalize: true });
    onApplyCallback?.(totalWeight(barWeight, plates.left, plates.right));
    closer.close();
  });

  wireSheetDrag({
    handle: container.querySelector('#plate-sheet-handle'),
    sheetEl: panel,
    backdropEl,
    isClosing: () => closing,
    onDismiss: () => closer.dismissedByDrag(),
  });
}
