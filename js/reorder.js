// Umsortieren per Gedrückthalten und Verschieben (Long-Press + Drag) für eine
// Liste gleichartiger Zeilen. Bewusst mit Pointer Events statt dem HTML5-
// Drag&Drop-API - Letzteres feuert auf iOS/Touch nicht zuverlässig. Kennt
// weder Datenmodell noch Rendering: verschiebt während der Geste nur per
// `transform` und meldet am Ende (fromIndex, toIndex) an `onReorder`, das
// State ändert und neu rendert.
//
// Ablauf: Ein Antippen startet einen Timer. Bewegt sich der Finger davor
// (> MOVE_CANCEL_PX) oder bricht der Browser die Geste ab (nativer Scroll),
// wird nichts aktiviert und die Liste scrollt ganz normal. Erst nach
// LONG_PRESS_MS ohne Bewegung "hebt" sich die Zeile ab und folgt dem Finger;
// ab da wird natives Scrollen per touchmove-preventDefault unterdrückt (das
// wirkt nur, weil der Finger bis dahin stillstand - der Browser hat noch
// nicht mit dem Scrollen begonnen). Am Rand des Scroll-Containers scrollt ein
// rAF-Loop automatisch mit.
//
// iOS hat kein navigator.vibrate - das Anheben (Skalierung + Schatten) ist
// die einzige Rückmeldung für den Aktivierungszeitpunkt.

const LONG_PRESS_MS = 350;
const MOVE_CANCEL_PX = 8;
const EDGE_PX = 56;
const AUTOSCROLL_PX_PER_SECOND = 600;
const SETTLE_MS = 160;

// `liftedBackground`: Die Zeilen der Liste sind meist halbtransparent
// (Sheet-Fläche-Variante) - die angehobene Zeile muss deckend sein, sonst
// scheint die darunter liegende Zeile durch. Default = bg-highlight.
export function wireLongPressReorder({
  listEl,
  itemSelector,
  ignoreSelector = null,
  scrollEl = null,
  liftedBackground = '#404040',
  onReorder,
}) {
  if (!listEl) return;

  let pending = null;
  let drag = null;

  // Muss non-passive sein, sonst wird preventDefault ignoriert. Nur aktiv,
  // solange wirklich gezogen wird - davor bleibt Scrollen unberührt.
  listEl.addEventListener(
    'touchmove',
    (e) => {
      if (drag && e.cancelable) e.preventDefault();
    },
    { passive: false }
  );
  listEl.addEventListener('contextmenu', (e) => {
    if (pending || drag) e.preventDefault();
  });

  listEl.addEventListener('pointerdown', (e) => {
    if (pending || drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const item = e.target.closest(itemSelector);
    if (!item || !listEl.contains(item)) return;
    if (ignoreSelector && e.target.closest(ignoreSelector)) return;

    pending = {
      pointerId: e.pointerId,
      item,
      startX: e.clientX,
      startY: e.clientY,
      timer: setTimeout(activate, LONG_PRESS_MS),
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  });

  function removeWindowListeners() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  }

  function activate() {
    const p = pending;
    if (!p) return;
    p.timer = null;

    const items = [...listEl.querySelectorAll(itemSelector)];
    const index = items.indexOf(p.item);
    const scroll0 = scrollEl?.scrollTop ?? 0;
    // Positionen in Inhaltskoordinaten (unabhängig vom aktuellen Scrollstand),
    // damit Auto-Scroll während des Ziehens die Rechnung nicht verfälscht.
    const rects = items.map((el) => el.getBoundingClientRect());
    const tops = rects.map((r) => r.top + scroll0);
    const heights = rects.map((r) => r.height);
    const gap = items.length > 1 ? tops[1] - (tops[0] + heights[0]) : 0;

    drag = {
      pointerId: p.pointerId,
      item: p.item,
      items,
      index,
      target: index,
      startY: p.startY,
      lastY: p.startY,
      scroll0,
      tops,
      heights,
      step: heights[index] + gap,
      raf: null,
      lastTick: 0,
    };
    pending = null;

    try {
      p.item.setPointerCapture(p.pointerId);
    } catch {
      // Kein aktiver Pointer (z. B. synthetische Events) - Window-Listener genügen.
    }

    items.forEach((el) => {
      el.style.transition = el === p.item ? 'none' : `transform ${SETTLE_MS}ms ease`;
    });
    p.item.style.position = 'relative';
    p.item.style.zIndex = '10';
    p.item.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.45)';
    p.item.style.willChange = 'transform';
    p.item.style.backgroundColor = liftedBackground;

    update();
    drag.raf = requestAnimationFrame(tick);
  }

  function offset() {
    return drag.lastY - drag.startY + ((scrollEl?.scrollTop ?? 0) - drag.scroll0);
  }

  function update() {
    const { items, index, tops, heights, step } = drag;
    const last = items.length - 1;
    const minDy = tops[0] - tops[index];
    const maxDy = tops[last] + heights[last] - (tops[index] + heights[index]);
    const dy = Math.max(minDy, Math.min(maxDy, offset()));
    drag.item.style.transform = `translateY(${dy}px) scale(1.02)`;

    const center = tops[index] + heights[index] / 2 + dy;
    let target = 0;
    items.forEach((_, j) => {
      if (j !== index && tops[j] + heights[j] / 2 < center) target += 1;
    });
    drag.target = target;

    items.forEach((el, j) => {
      if (j === index) return;
      let shift = 0;
      if (index < target && j > index && j <= target) shift = -step;
      else if (target < index && j >= target && j < index) shift = step;
      el.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  }

  // Zeitbasiert statt "px pro Frame" - sonst scrollt es auf 120-Hz-Displays
  // (ProMotion) doppelt so schnell wie auf 60 Hz.
  function tick(now) {
    if (!drag) return;
    const dt = drag.lastTick ? Math.min(now - drag.lastTick, 50) : 16;
    drag.lastTick = now;
    if (scrollEl) {
      const rect = scrollEl.getBoundingClientRect();
      const px = (AUTOSCROLL_PX_PER_SECOND * dt) / 1000;
      if (drag.lastY < rect.top + EDGE_PX) scrollEl.scrollTop -= px;
      else if (drag.lastY > rect.bottom - EDGE_PX) scrollEl.scrollTop += px;
    }
    update();
    drag.raf = requestAnimationFrame(tick);
  }

  function onMove(e) {
    if (pending && e.pointerId === pending.pointerId) {
      if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) > MOVE_CANCEL_PX) cancelPending();
      return;
    }
    if (drag && e.pointerId === drag.pointerId) drag.lastY = e.clientY;
  }

  function cancelPending() {
    if (pending?.timer) clearTimeout(pending.timer);
    pending = null;
    removeWindowListeners();
  }

  function onCancel() {
    if (pending) cancelPending();
    else if (drag) finish(false);
  }

  function onUp() {
    if (pending) cancelPending();
    else if (drag) finish(true);
  }

  function finish(commit) {
    const d = drag;
    cancelAnimationFrame(d.raf);
    removeWindowListeners();

    const { items, index, tops, heights } = d;
    const target = commit ? d.target : index;

    // Gezogene Zeile in ihren Ziel-Slot gleiten lassen, erst danach neu
    // rendern - die neue Reihenfolge entspricht dann exakt dem angezeigten
    // Bild, ohne Sprung.
    let slotDy = 0;
    if (target > index) slotDy = tops[target] + heights[target] - (tops[index] + heights[index]);
    else if (target < index) slotDy = tops[target] - tops[index];
    d.item.style.transition = `transform ${SETTLE_MS}ms ease, box-shadow ${SETTLE_MS}ms ease`;
    d.item.style.boxShadow = '';
    d.item.style.transform = `translateY(${slotDy}px)`;

    setTimeout(() => {
      try {
        d.item.releasePointerCapture(d.pointerId);
      } catch {
        // schon freigegeben
      }
      items.forEach((el) => {
        el.style.transition = '';
        el.style.transform = '';
        el.style.position = '';
        el.style.zIndex = '';
        el.style.willChange = '';
        el.style.boxShadow = '';
        el.style.backgroundColor = '';
      });
      drag = null;
      if (target !== index) onReorder(index, target);
    }, SETTLE_MS);
  }
}
