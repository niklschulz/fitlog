// Geteilte Mechanik für große Bottom-Sheets (Kalender, Übungen,
// Übungs-Detail, s. ADR 0011) - Höhe/Animation/Optik stecken in der
// `.bottom-sheet`/`.bottom-sheet-backdrop`-Klasse in css/styles.css, hier nur
// das nicht-visuelle Verhalten: Body-Scroll-Sperre, Bottom-Nav-z-index und
// Drag-to-Dismiss. Jedes Sheet bleibt fachlich (State, Open/Close-Zeitpunkt,
// Render-Inhalt) beim jeweiligen View-Modul, s. docs/architecture.md
// "View-Pattern" - dieses Modul kennt weder Kalender- noch Übungs-Inhalte.

// Body-Scroll-Sperre und Bottom-Nav-Anhebung sind gezählt statt reiner
// An/Aus-Flags: Das Übungs-Sheet und sein Detail-Sheet können gleichzeitig
// offen sein (Stapel-Sheets). Schließt man das obere, während das untere
// noch offen ist, darf weder die Sperre noch die Nav-Anhebung aufgehoben
// werden - erst wenn der letzte Lock-Aufruf mit einem Unlock beantwortet
// wurde. Jeder Open-Aufruf einer View muss von genau einem passenden
// Close-Aufruf begleitet werden (normal oder über unmount(), s. workout.js).
let bodyScrollLockCount = 0;
let sheetTouchBlocker = null;

// Frühere Version setzte body auf position:fixed (samt negativem
// top-Offset) - das ist auf dem Papier vom Sheet selbst (ebenfalls
// position:fixed) unabhängig, hat sich auf einem echten iPhone aber
// nachweislich auf dessen Positionierung ausgewirkt (Sheet zu weit unten UND
// weiterhin eine Lücke am unteren Rand statt exakt an bottom:0 zu sitzen) -
// vermutlich eine WebKit-Eigenheit, wie position:fixed auf body verschachtelte
// fixed-Elemente behandelt, die sich in der (Chromium-basierten) Testumgebung
// nicht nachstellen ließ. Stattdessen der einfachere, body selbst nicht aus
// dem normalen Fluss nehmende Ansatz: overflow:hidden auf body (blockiert
// Maus-/Tastatur-/Trackpad-Scroll) plus ein gezielter touchmove-Blocker für
// iOS' Rubber-Band-Scroll (den overflow:hidden allein auf Safari nicht immer
// verhindert) - der Blocker lässt Touch-Bewegungen innerhalb des scrollbaren
// Inhalts eines offenen Sheets (`.bottom-sheet-scroll`) explizit durch, damit
// das jeweilige Sheet selbst weiter scrollbar bleibt.
export function lockBodyScroll() {
  bodyScrollLockCount += 1;
  if (bodyScrollLockCount > 1) return;

  document.body.style.overflow = 'hidden';
  sheetTouchBlocker = (e) => {
    if (e.target.closest('.bottom-sheet-scroll')) return;
    e.preventDefault();
  };
  document.addEventListener('touchmove', sheetTouchBlocker, { passive: false });
}

export function unlockBodyScroll() {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount > 0) return;

  document.body.style.overflow = '';
  if (sheetTouchBlocker) {
    document.removeEventListener('touchmove', sheetTouchBlocker);
    sheetTouchBlocker = null;
  }
}

// Die Bottom-Nav liegt normalerweise unterhalb eines Sheets (z-20 vs.
// z-50+) und wäre dadurch komplett verdeckt. Während mindestens ein Sheet
// offen ist, wird ihr z-index per Inline-Style gezielt angehoben (höhere
// Priorität als jede Klassen-Regel, unabhängig von der CSS-Ladereihenfolge
// zwischen Tailwind und styles.css) - bewusst nur für die Dauer des
// Sheet-Lebenszyklus und nicht dauerhaft, damit andere Overlays (z. B. der
// Routine-Picker) weiterhin unbeeinflusst über der Nav liegen. Gezählt aus
// demselben Grund wie lockBodyScroll oben.
let navRaiseCount = 0;

export function raiseNavAboveSheet() {
  navRaiseCount += 1;
  document.getElementById('bottom-nav')?.style.setProperty('z-index', '55');
}

export function resetNavZIndex() {
  navRaiseCount = Math.max(0, navRaiseCount - 1);
  if (navRaiseCount > 0) return;
  document.getElementById('bottom-nav')?.style.removeProperty('z-index');
}

// Muss zur Dauer der `.bottom-sheet(.closing)`-Keyframes in css/styles.css
// passen - jedes View-Modul hält seinen eigenen Abschluss-Timeout danach.
export const SHEET_CLOSE_ANIMATION_MS = 220;
export const SHEET_DRAG_CLOSE_THRESHOLD_PX = 120;

// Drag-to-Dismiss am Ziehgriff: Der Griff selbst wird per Pointer Events
// (touch- und mausfähig) verfolgt, Sheet und Backdrop werden währenddessen
// direkt per Inline-Style bewegt/abgeblendet (außerhalb von paint(), da hier
// 1:1 dem Finger gefolgt werden muss statt in Render-Zyklen zu denken).
// `touch-action: none` auf dem Griff (am jeweiligen Element im aufrufenden
// View-Modul gesetzt) verhindert, dass Safari die Geste stattdessen als
// Seiten-Scroll interpretiert.
//
// Reine Mechanik ohne eigenes State-Wissen: `isClosing()` verhindert einen
// Drag-Start während die Schließen-Animation bereits läuft, `onDismiss()`
// wird genau dann aufgerufen, wenn der Nutzer über den Schwellenwert gezogen
// hat - der Aufrufer setzt darin selbst den Abschluss-Timeout (muss dessen ID
// für eigene Aufräumarbeiten in unmount() halten können, s. workout.js).
export function wireSheetDrag({ handle, sheetEl, backdropEl, isClosing, onDismiss }) {
  if (!handle || !sheetEl || !backdropEl) return;

  let drag = null;

  handle.addEventListener('pointerdown', (e) => {
    if (isClosing()) return;
    drag = { startY: e.clientY };
    sheetEl.style.transition = 'none';
    backdropEl.style.transition = 'none';
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // Kein aktiver Pointer mit dieser ID (z. B. bei synthetischen Events) -
      // die Drag-Logik selbst funktioniert auch ohne Capture weiter, nur
      // ohne die Garantie, dass Move-Events bei schnellen Gesten am
      // Element "kleben" bleiben.
    }
  });

  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const delta = Math.max(0, e.clientY - drag.startY);
    sheetEl.style.transform = `translateY(${delta}px)`;
    backdropEl.style.opacity = String(1 - Math.min(delta / sheetEl.offsetHeight, 1));
  });

  const finishDrag = (e) => {
    if (!drag) return;
    const delta = Math.max(0, e.clientY - drag.startY);
    drag = null;

    sheetEl.style.transition = `transform ${SHEET_CLOSE_ANIMATION_MS}ms ease`;
    backdropEl.style.transition = `opacity ${SHEET_CLOSE_ANIMATION_MS}ms ease`;

    if (delta > SHEET_DRAG_CLOSE_THRESHOLD_PX) {
      sheetEl.style.transform = 'translateY(100%)';
      backdropEl.style.opacity = '0';
      onDismiss();
    } else {
      sheetEl.style.transform = 'translateY(0)';
      backdropEl.style.opacity = '1';
      setTimeout(() => {
        sheetEl.style.transition = '';
        sheetEl.style.transform = '';
        backdropEl.style.transition = '';
        backdropEl.style.opacity = '';
      }, SHEET_CLOSE_ANIMATION_MS);
    }
  };

  handle.addEventListener('pointerup', finishDrag);
  handle.addEventListener('pointercancel', finishDrag);
}
