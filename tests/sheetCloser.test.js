import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createSheetCloser, SHEET_CLOSE_ANIMATION_MS } from '../js/sheet.js';

function setup() {
  const s = { open: true, closing: false, animated: 0, finalized: 0 };
  const closer = createSheetCloser({
    isOpen: () => s.open,
    isClosing: () => s.closing,
    setClosing: () => { s.closing = true; },
    animate: () => { s.animated += 1; },
    finalize: () => { s.open = false; s.closing = false; s.finalized += 1; },
  });
  return { s, closer };
}

test('close(): animiert sofort, räumt erst nach der Animationsdauer auf', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const { s, closer } = setup();
  closer.close();
  assert.deepEqual([s.closing, s.animated, s.finalized], [true, 1, 0]);
  mock.timers.tick(SHEET_CLOSE_ANIMATION_MS - 1);
  assert.equal(s.finalized, 0);
  mock.timers.tick(1);
  assert.deepEqual([s.open, s.closing, s.finalized], [false, false, 1]);
  mock.timers.reset();
});

test('zweites close() während der Animation wirkt nicht', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const { s, closer } = setup();
  closer.close();
  closer.close();
  mock.timers.tick(SHEET_CLOSE_ANIMATION_MS * 2);
  assert.deepEqual([s.animated, s.finalized], [1, 1]);
  mock.timers.reset();
});

test('close() bei geschlossenem Sheet ist ein No-op', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const { s, closer } = setup();
  s.open = false;
  closer.close();
  mock.timers.tick(1000);
  assert.deepEqual([s.animated, s.finalized], [0, 0]);
  mock.timers.reset();
});

test('dismissedByDrag(): Flag + genau ein finalize, ohne animate()', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const { s, closer } = setup();
  closer.dismissedByDrag();
  assert.deepEqual([s.closing, s.animated], [true, 0]);
  closer.close(); // Backdrop-Tipp nach dem Ziehen
  closer.dismissedByDrag();
  mock.timers.tick(SHEET_CLOSE_ANIMATION_MS);
  assert.deepEqual([s.animated, s.finalized], [0, 1]);
  mock.timers.reset();
});

test('cancelPending(): finalize läuft nicht mehr, danach wieder schließbar', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const { s, closer } = setup();
  closer.close();
  closer.cancelPending();
  mock.timers.tick(1000);
  assert.equal(s.finalized, 0);
  s.closing = false; // unmount() setzt den View-State selbst zurück
  closer.close();
  mock.timers.tick(SHEET_CLOSE_ANIMATION_MS);
  assert.equal(s.finalized, 1);
  mock.timers.reset();
});
