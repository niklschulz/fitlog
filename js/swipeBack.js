// Wisch-Geste "Zurück" wie in iOS (s. ADR 0036/0037): Ein Wisch vom linken
// Bildschirmrand nach rechts führt von einer Unterseite mit Zurück-Pfeil
// (Übungs-Detailseite im Workout-Tab, Statistik-Übungsseite) zurück.
//
// Ablauf wie bei iOS:
//  - Start nur in einem schmalen Streifen am linken Rand (EDGE_WIDTH_PX) -
//    ein eigenes, fixes Element außerhalb des Seiteninhalts, das daher bei
//    jedem Repaint der Seite bestehen bleibt und keinen Seiteninhalt (Reiter,
//    Zahlenfelder, Umsortieren per Gedrückthalten) stört. `touch-action: none`
//    (nicht `pan-y`): Sonst darf iOS bei schrägen Wischbewegungen parallel
//    vertikal scrollen bzw. das Gummiband auslösen - die Seite ruckelte dann
//    beim Ziehen auf und ab. Der Streifen ist nur 22 px breit, der Verlust des
//    Scrollens genau dort fällt nicht auf. Offene Sheets
//    liegen darüber (höherer z-index) und blockieren die Geste automatisch.
//  - Die Seite (`container`) folgt dem Finger 1:1 und wirft einen Schatten
//    auf den Hintergrund.
//  - Beim Loslassen entscheidet Weg (> 40 % der Breite) oder Geschwindigkeit,
//    ob sie zurückgeht oder federnd zurückspringt.
//  - Beim Zurückgehen wird ein Abbild der Seite (Klon) über den Rest geschoben
//    und gleitet nach rechts hinaus, während darunter die echte Übersicht neu
//    gezeichnet wird und mit leichtem Parallax-Versatz von links einläuft.
//    Ein Abbild statt der echten Seite, weil `onBack()` den Container
//    ohnehin neu befüllt.
//
// Nur ein Streifen gleichzeitig (Modul-Singleton, wie die Notiz-/Action-
// Sheets): Aufrufer rufen `wireSwipeBack()` in ihrem render() und
// `unwireSwipeBack()` in ihrem unmount() auf. `onBack({ swipe: true })` -
// der Aufrufer darf dann seine eigene Zurück-Animation weglassen.
const EDGE_WIDTH_PX = 22;
const START_SLOP_PX = 8;
const COMMIT_RATIO = 0.4;
const COMMIT_MIN_VELOCITY = 0.5; // px/ms
const COMMIT_MIN_DISTANCE_PX = 40;
const PARALLAX = 0.3;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SHADOW = '-10px 0 30px rgba(0, 0, 0, 0.45)';
const REVEAL_FALLBACK_MS = 600;

let teardown = null;

export function unwireSwipeBack() {
  teardown?.();
  teardown = null;
}

export function wireSwipeBack({ container, onBack }) {
  unwireSwipeBack();
  if (!container) return;

  const strip = document.createElement('div');
  strip.id = 'swipe-back-edge';
  // z-index unterhalb der Bottom-Nav (z-20) und aller Sheets (ab z-50).
  strip.style.cssText = `position:fixed;top:0;bottom:0;left:0;width:${EDGE_WIDTH_PX}px;z-index:15;touch-action:none;overscroll-behavior:none;`;
  document.body.appendChild(strip);

  let pointerId = null;
  let startX = 0;
  let dx = 0;
  let active = false;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let busy = false;
  let snapshot = null;
  let revealTimeout = null;
  let observer = null;
  let frame = null;
  // Zurück-Animation läuft (Abbild gleitet hinaus, Übersicht läuft ein). onBack()
  // ruft über unmount() `unwireSwipeBack()` auf - das darf diese Animation nicht
  // abbrechen, sie räumt sich selbst auf.
  let committing = false;

  const background = () => getComputedStyle(document.body).backgroundColor;
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Position wird höchstens einmal pro Frame geschrieben (pointermove kann
  // öfter feuern als das Display aktualisiert) - gleichmäßigeres Mitziehen.
  function scheduleTransform() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      container.style.transform = `translateX(${dx}px)`;
    });
  }

  function cancelScheduledTransform() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  function clearContainerStyles() {
    cancelScheduledTransform();
    container.style.overflow = '';
    container.style.transform = '';
    container.style.boxShadow = '';
    container.style.background = '';
    container.style.willChange = '';
  }

  function onDown(e) {
    if (busy || pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    lastT = e.timeStamp;
    dx = 0;
    velocity = 0;
    active = false;
    // Seite schon jetzt auf eine eigene Ebene legen, damit das erste Bewegungs-
    // Bild nicht durch deren Anlegen stockt.
    container.style.willChange = 'transform';
    strip.setPointerCapture(pointerId);
  }

  function onMove(e) {
    if (e.pointerId !== pointerId) return;
    dx = Math.max(0, e.clientX - startX);
    if (!active) {
      if (dx < START_SLOP_PX) return;
      active = true;
      // Scrollen der Seite während der Geste sperren (Position bleibt erhalten).
      container.style.overflow = 'hidden';
      container.style.background = background();
      container.style.boxShadow = SHADOW;
    }
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = (e.clientX - lastX) / dt;
    lastX = e.clientX;
    lastT = e.timeStamp;
    scheduleTransform();
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (!active) {
      container.style.willChange = '';
      return;
    }
    active = false;
    cancelScheduledTransform();
    container.style.transform = `translateX(${dx}px)`;
    const width = window.innerWidth;
    const cancelled = e.type === 'pointercancel';
    const commit =
      !cancelled && (dx > width * COMMIT_RATIO || (velocity > COMMIT_MIN_VELOCITY && dx > COMMIT_MIN_DISTANCE_PX));
    if (commit) doCommit(width);
    else springBack();
  }

  function springBack() {
    if (reduceMotion()) {
      clearContainerStyles();
      return;
    }
    busy = true;
    const anim = container.animate(
      [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }],
      { duration: 220, easing: EASE }
    );
    anim.finished.finally(() => {
      clearContainerStyles();
      busy = false;
    });
  }

  function makeSnapshot(width) {
    const rect = container.getBoundingClientRect();
    const snap = document.createElement('div');
    snap.setAttribute('aria-hidden', 'true');
    snap.style.cssText =
      `position:fixed;left:0;top:${rect.top}px;width:${width}px;height:${rect.height}px;` +
      `overflow:hidden;z-index:15;pointer-events:none;background:${background()};` +
      `box-shadow:${SHADOW};transform:translateX(${dx}px);`;
    const clone = container.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.cssText = 'width:100%;height:100%;transform:none;box-shadow:none;background:transparent;';
    snap.appendChild(clone);
    document.body.appendChild(snap);
    clone.scrollTop = container.scrollTop;
    return snap;
  }

  function doCommit(width) {
    if (reduceMotion()) {
      clearContainerStyles();
      onBack({ swipe: true });
      return;
    }
    busy = true;
    committing = true;
    snapshot = makeSnapshot(width);
    clearContainerStyles();
    // Echter Container bleibt unsichtbar, bis onBack() die Übersicht
    // hineingezeichnet hat (paint() ist asynchron) - sonst blitzt kurz die
    // alte Seite links neben dem Abbild auf.
    container.style.visibility = 'hidden';

    const snap = snapshot;
    // Beide Animationen starten erst, wenn onBack() die Übersicht fertig in den
    // Container gezeichnet hat: Deren Aufbau und Layout ist die schwerste Arbeit
    // des Ganzen und würde sonst genau die ersten Bilder der Animation
    // blockieren (sichtbares Ruckeln). Das Abbild steht in der Zwischenzeit auf
    // der Loslass-Position still - nur die Dauer des Zeichnens.
    const reveal = () => {
      observer?.disconnect();
      observer = null;
      clearTimeout(revealTimeout);
      revealTimeout = null;
      container.style.visibility = '';
      // Layout jetzt erzwingen (nicht erst im ersten Animations-Bild).
      void container.offsetHeight;
      container.animate(
        [{ transform: `translateX(${-width * PARALLAX}px)` }, { transform: 'translateX(0)' }],
        { duration: 320, easing: EASE }
      );
      const remaining = Math.max(0, width - dx) / width;
      snap
        .animate(
          [{ transform: `translateX(${dx}px)` }, { transform: `translateX(${width}px)` }],
          { duration: 120 + remaining * 260, easing: EASE, fill: 'forwards' }
        )
        .finished.finally(() => {
          snap.remove();
          if (snapshot === snap) snapshot = null;
          busy = false;
          committing = false;
        });
    };
    // Vor onBack() anhängen, falls das Neuzeichnen synchron läuft.
    observer = new MutationObserver(reveal);
    observer.observe(container, { childList: true });
    revealTimeout = setTimeout(reveal, REVEAL_FALLBACK_MS);

    onBack({ swipe: true });
  }

  // Zusätzlich zu `touch-action: none` (iOS wertet das nicht überall gleich
  // streng aus): Browser-eigene Touch-Verarbeitung (Scrollen, Gummiband) auf
  // dem Streifen unterbinden.
  strip.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  strip.addEventListener('pointerdown', onDown);
  strip.addEventListener('pointermove', onMove);
  strip.addEventListener('pointerup', onUp);
  strip.addEventListener('pointercancel', onUp);

  teardown = () => {
    strip.remove();
    // Läuft gerade die Zurück-Animation, bleibt alles stehen - Abbild,
    // Beobachter und Einlauf-Animation räumen sich selbst auf.
    if (committing) return;
    observer?.disconnect();
    clearTimeout(revealTimeout);
    snapshot?.remove();
    snapshot = null;
    container.style.visibility = '';
    clearContainerStyles();
  };
}
