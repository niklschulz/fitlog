// Seiten-Übergänge wie in iOS (s. ADR 0037/0038): Zurück per Wisch vom linken
// Rand, per Zurück-Pfeil und das Öffnen einer Unterseite nutzen dieselbe
// Schiebe-Bewegung. Betroffen: Übungs-Detailseite im Workout-Tab und
// Statistik-Übungsseite.
//
// Ablauf der Zurück-Geste:
//  - Start nur in einem schmalen Streifen am linken Rand (EDGE_WIDTH_PX) - ein
//    eigenes, fixes Element außerhalb des Seiteninhalts, das jeden Repaint
//    überlebt und keinen Seiteninhalt stört. `touch-action: none` (nicht
//    `pan-y`): Sonst darf iOS bei schrägen Wischbewegungen parallel vertikal
//    scrollen bzw. das Gummiband auslösen - die Seite ruckelte dann.
//    Offene Sheets liegen darüber und blockieren die Geste von selbst.
//  - Sobald der Finger wandert, wird die Detailseite als Abbild (Klon) über
//    den Container gelegt und `onBack()` zeichnet die ECHTE Übersicht darunter
//    (bei iOS liegt sie ebenfalls schon da). Das Abbild folgt dem Finger, die
//    Übersicht darunter läuft mit Versatz (-1/3 der Breite) nach, eine
//    abdunkelnde Ebene dazwischen blendet mit dem Weg aus.
//  - Beim Loslassen entscheiden, wie bei iOS, vor allem die Geschwindigkeit
//    (Fling nach rechts = zurück, nach links = bleiben), sonst die Hälfte des
//    Wegs. Das Ausgleiten ist eine gedämpfte Feder, die mit der
//    Fingergeschwindigkeit startet (kein Knick zwischen Finger und Animation).
//  - Bleibt die Seite stehen, ruft die Geste `onRestore()` auf, das die
//    Detailseite wieder aufbaut (Reiter/Auswahl bleiben erhalten), und legt
//    das Abbild erst dann wieder weg.
//
// Zurück-Pfeil (`triggerBack()`) und Öffnen (`pushPage()`) laufen über
// dieselbe Mechanik, nur ohne Finger.
//
// Layer-Reihenfolge (alles unterhalb der Scrims z-10, Bottom-Nav z-20 und der
// Sheets ab z-50): Container (statisch) < Abdunklung (6) < Abbild (7). Beim
// Öffnen: Abbild der alten Seite (6) < Abdunklung (7) < Container (8).
//
// Nur ein Streifen gleichzeitig (Modul-Singleton, wie die Notiz-/Action-
// Sheets): Aufrufer rufen `wireSwipeBack()` in ihrem render() und
// `unwireSwipeBack()` in ihrem unmount() auf. `unwireSwipeBack()` bricht eine
// laufende Geste/Animation nicht ab (onBack() ruft es selbst auf), sie räumt
// sich danach selbst auf.
const EDGE_WIDTH_PX = 22;
const START_SLOP_PX = 8;
const COMMIT_RATIO = 0.5;
const FLING_COMMIT = 1.0; // Bildschirmbreiten pro Sekunde, nach rechts
const FLING_CANCEL = 0.5; // Bildschirmbreiten pro Sekunde, nach links
const VELOCITY_WINDOW_MS = 100;
const PARALLAX = 1 / 3;
const DIM_MAX = 0.2;
const SPRING_OMEGA = 12; // gedämpft ohne Nachschwingen, ca. 0,35 s bis zur Ruhe
const SPRING_MAX_S = 0.7;
const SHADOW = '-2px 0 10px rgba(0, 0, 0, 0.3)';
const READY_FALLBACK_MS = 600;
const Z = { under: 6, dim: 7, top: 8, popUnder: 5, popDim: 6, popSnap: 7 };

let teardown = null;
let current = null;
let transitioning = false;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pageBackground = () => getComputedStyle(document.body).backgroundColor;

export function unwireSwipeBack() {
  current = null;
  teardown?.();
  teardown = null;
}

// Zurück-Pfeil: dieselbe Animation wie die Geste, ohne Finger. Ohne aktive
// Verdrahtung (oder bei "Bewegung reduzieren") direkt `fallback()`.
export function triggerBack(fallback) {
  if (current && !reduceMotion()) current.pop();
  else fallback?.();
}

// Gedämpfte Feder ohne Nachschwingen (kritisch gedämpft), startet mit der
// Geschwindigkeit `velocity` (px/s) - so geht die Animation ohne Knick aus
// der Fingerbewegung hervor. x(t) = to + (d0 + (v0 + ω·d0)·t)·e^(-ω·t)
function springRun({ from, to, velocity = 0, onFrame }) {
  return new Promise((resolve) => {
    const d0 = from - to;
    const b = velocity + SPRING_OMEGA * d0;
    const t0 = performance.now();
    const step = (now) => {
      const t = clamp((now - t0) / 1000, 0, SPRING_MAX_S);
      const e = Math.exp(-SPRING_OMEGA * t);
      const x = to + (d0 + b * t) * e;
      const v = (b - SPRING_OMEGA * (d0 + b * t)) * e;
      const done = t >= SPRING_MAX_S || (Math.abs(x - to) < 0.5 && Math.abs(v) < 30);
      onFrame(done ? to : x);
      if (done) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// Abbild (Klon) des Containers an seiner aktuellen Position.
function makeSnapshot(container, rect, z) {
  const snap = document.createElement('div');
  snap.setAttribute('aria-hidden', 'true');
  snap.style.cssText =
    `position:fixed;left:0;top:${rect.top}px;width:${window.innerWidth}px;height:${rect.height}px;` +
    `overflow:hidden;z-index:${z};pointer-events:none;background:${pageBackground()};` +
    `box-shadow:${SHADOW};will-change:transform;`;
  const clone = container.cloneNode(true);
  clone.removeAttribute('id');
  // Bewusst KEIN `visibility: visible` am Klon: Das vorab gebaute Abbild wird am
  // Wrapper per `visibility: hidden` versteckt, ein sichtbarer Klon läge sonst
  // schon beim Auflegen des Fingers über der echten Seite und zeichnete
  // halbtransparente Elemente (z. B. den ausgegrauten "Löschen"-Button)
  // doppelt - sie wirkten dann heller.
  clone.style.cssText = 'width:100%;height:100%;transform:none;box-shadow:none;background:transparent;';
  snap.appendChild(clone);
  document.body.appendChild(snap);
  // Klone verlieren Scroll-Positionen (auch innerer Bereiche, z. B. des
  // Kalender-Streifens) und getippte Eingabewerte - elementweise übernehmen.
  const sources = [container, ...container.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  sources.forEach((src, i) => {
    const dst = copies[i];
    if (!dst) return;
    if (src.scrollTop || src.scrollLeft) {
      dst.scrollTop = src.scrollTop;
      dst.scrollLeft = src.scrollLeft;
    }
    if (src.tagName === 'INPUT') dst.value = src.value;
  });
  return snap;
}

function makeDim(rect, z, opacity) {
  const dim = document.createElement('div');
  dim.setAttribute('aria-hidden', 'true');
  dim.style.cssText =
    `position:fixed;left:0;top:${rect.top}px;width:100%;height:${rect.height}px;background:#000;` +
    `pointer-events:none;z-index:${z};opacity:${opacity};will-change:opacity;`;
  document.body.appendChild(dim);
  return dim;
}

// Wartet, bis `container` neuen Inhalt bekommen hat (die Aufrufer zeichnen
// asynchron, z. B. nach Datenbank-Abfragen), spätestens nach dem Fallback.
function whenContainerPainted(container) {
  let observer = null;
  let timeout = null;
  let resolveFn;
  const promise = new Promise((resolve) => {
    resolveFn = resolve;
  });
  const done = () => {
    observer?.disconnect();
    clearTimeout(timeout);
    resolveFn();
  };
  observer = new MutationObserver(done);
  observer.observe(container, { childList: true });
  timeout = setTimeout(done, READY_FALLBACK_MS);
  return { promise, cancel: done };
}

function resetContainerStyles(container) {
  container.style.transform = '';
  container.style.visibility = '';
  container.style.willChange = '';
  container.style.pointerEvents = '';
  container.style.position = '';
  container.style.zIndex = '';
  container.style.background = '';
  container.style.boxShadow = '';
  rerasterize(container);
}

// iOS zeichnet einen Scroll-Container, der während der Geste ausgeblendet und
// transformiert war (und dessen Position dabei per scrollTop gesetzt wurde),
// danach nur noch für den gerade sichtbaren Ausschnitt: der Rest der Liste blieb
// leer und der erste Wisch nach oben löste nur das Gummiband aus. Ein kurzes
// display:none/-Zurücksetzen (ohne dass dazwischen gezeichnet wird) verwirft die
// alte Kachel-Aufteilung und die native Scrollposition; die Position wird
// danach aus dem DOM-Wert wiederhergestellt.
function rerasterize(container) {
  const top = container.scrollTop;
  container.style.display = 'none';
  void container.offsetHeight;
  container.style.display = '';
  container.scrollTop = top;
  // iOS gleicht die native Position erst nach einem Frame ab: einen Frame lang
  // 1 px daneben, dann zurück (nur, wenn der Nutzer inzwischen nicht selbst
  // gescrollt hat).
  if (top < 1 && container.scrollHeight <= container.clientHeight) return;
  const nudged = top > 0 ? top - 1 : top + 1;
  requestAnimationFrame(() => {
    if (Math.abs(container.scrollTop - top) > 0.5) return;
    container.scrollTop = nudged;
    requestAnimationFrame(() => {
      if (Math.abs(container.scrollTop - nudged) <= 0.5) container.scrollTop = top;
    });
  });
}

// Öffnen einer Unterseite: Die alte Seite (Abbild) rückt mit Versatz nach links
// und wird abgedunkelt, die neue schiebt sich von rechts darüber - das
// Gegenstück zur Zurück-Geste. `renderFn()` zeichnet die neue Seite in
// `container`.
export function pushPage(container, renderFn) {
  if (transitioning) return;
  if (reduceMotion()) {
    renderFn();
    return;
  }
  transitioning = true;
  const width = window.innerWidth;
  const rect = container.getBoundingClientRect();
  const under = makeSnapshot(container, rect, Z.under);
  under.style.boxShadow = 'none';
  const dim = makeDim(rect, Z.dim, 0);

  container.style.visibility = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.position = 'relative';
  container.style.zIndex = String(Z.top);
  container.style.background = pageBackground();
  container.style.boxShadow = SHADOW;

  const painted = whenContainerPainted(container);
  renderFn();

  painted.promise
    .then(() => {
      container.style.transform = `translateX(${width}px)`;
      container.style.visibility = '';
      // Layout jetzt erzwingen, nicht erst im ersten Animations-Bild.
      void container.offsetHeight;
      return springRun({
        from: width,
        to: 0,
        onFrame: (x) => {
          const p = 1 - x / width;
          container.style.transform = `translateX(${x}px)`;
          under.style.transform = `translateX(${-width * PARALLAX * p}px)`;
          dim.style.opacity = String(DIM_MAX * p);
        },
      });
    })
    .finally(() => {
      under.remove();
      dim.remove();
      resetContainerStyles(container);
      transitioning = false;
    });
}

export function wireSwipeBack({ container, onBack, onRestore = null }) {
  unwireSwipeBack();
  if (!container) return;

  const strip = document.createElement('div');
  strip.id = 'swipe-back-edge';
  // z-index unterhalb der Bottom-Nav (z-20) und aller Sheets (ab z-50).
  strip.style.cssText = `position:fixed;top:0;bottom:0;left:0;width:${EDGE_WIDTH_PX}px;z-index:15;touch-action:none;overscroll-behavior:none;`;
  document.body.appendChild(strip);

  let pointerId = null;
  let startX = 0;
  let x = 0; // aktuelle Position der Seite (px)
  let active = false; // Seite wird gerade gezogen
  let reduced = false; // "Bewegung reduzieren": keine Visualisierung
  let busy = false; // Geste oder Zurück-Animation läuft
  let pendingTeardown = false;
  let samples = [];
  let frame = null;
  let width = 0;
  let scrollTop = 0;
  let snapshot = null;
  let under = null; // Abbild der gezeichneten Übersicht (Parallax), s. begin()
  let dim = null;
  let ready = false; // Übersicht unter dem Abbild ist gezeichnet
  let painted = null;
  let prepared = null; // vorab gebautes Abbild (s. onDown)

  function applyProgress(pos) {
    const p = clamp(pos / width, 0, 1);
    snapshot.style.transform = `translateX(${pos}px)`;
    dim.style.opacity = String(DIM_MAX * (1 - p));
    if (under) under.style.transform = `translateX(${-width * PARALLAX * (1 - p)}px)`;
  }

  function scheduleApply() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (snapshot) applyProgress(x);
    });
  }

  function cancelScheduled() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  // Baut das Abbild schon beim Auflegen des Fingers (Klonen + Layout kosten
  // etwas, das soll nicht das erste Zieh-Bild verzögern). Unsichtbar, bis die
  // Geste beginnt.
  function prepare() {
    discardPrepared();
    width = window.innerWidth;
    const rect = container.getBoundingClientRect();
    const snap = makeSnapshot(container, rect, Z.popSnap);
    snap.style.visibility = 'hidden';
    prepared = { snap, rect, scrollTop: container.scrollTop };
  }

  function discardPrepared() {
    prepared?.snap.remove();
    prepared = null;
  }

  function begin(startPos) {
    busy = true;
    transitioning = true;
    if (!prepared) prepare();
    snapshot = prepared.snap;
    scrollTop = prepared.scrollTop;
    snapshot.style.visibility = '';
    dim = makeDim(prepared.rect, Z.popDim, DIM_MAX);
    prepared = null;
    x = startPos;
    ready = false;
    // Der echte Container (Scroll-Container!) bleibt die ganze Geste über
    // unsichtbar und unverschoben: iOS zeichnete ihn sonst danach nur für den
    // sichtbaren Ausschnitt und scrollte nicht, sondern gummibandete. Den
    // Parallax-Versatz der Übersicht übernimmt stattdessen ein Abbild von ihr
    // (`under`), sobald sie gezeichnet ist.
    container.style.visibility = 'hidden';
    container.style.pointerEvents = 'none';
    applyProgress(x);

    const rect = snapshot.getBoundingClientRect();
    painted = whenContainerPainted(container);
    painted.promise.then(() => {
      if (!snapshot) return;
      ready = true;
      under = makeSnapshot(container, { top: rect.top, height: rect.height }, Z.popUnder);
      under.style.boxShadow = 'none';
      applyProgress(x);
    });
    // Echte Übersicht darunter zeichnen (ruft über unmount() auch
    // unwireSwipeBack() auf - `busy` hält den Streifen am Leben).
    onBack({ swipe: true });
  }

  function cleanupVisuals() {
    snapshot?.remove();
    under?.remove();
    dim?.remove();
    snapshot = null;
    under = null;
    dim = null;
    resetContainerStyles(container);
  }

  function endSession() {
    busy = false;
    transitioning = false;
    if (pendingTeardown) fullTeardown();
  }

  async function finish(commit, velocity) {
    const target = commit ? width : 0;
    await springRun({
      from: x,
      to: target,
      velocity,
      onFrame: (pos) => {
        x = clamp(pos, 0, width);
        applyProgress(x);
      },
    });
    // Übersicht muss gezeichnet sein, bevor das Abbild verschwindet.
    await painted.promise;
    if (!commit) {
      // Seite bleibt: Detailseite wieder aufbauen (Zustand bleibt erhalten),
      // erst dann das Abbild wegnehmen.
      try {
        await onRestore?.();
      } catch {
        /* Abbild trotzdem wegnehmen */
      }
      container.scrollTop = scrollTop;
    }
    cleanupVisuals();
    endSession();
  }

  // Geschwindigkeit der letzten VELOCITY_WINDOW_MS vor dem Loslassen. Steht der
  // Finger davor kurz still, zählt das als 0 (kein Fling).
  function velocityPxPerS(releaseTime) {
    const recent = samples.filter((s) => releaseTime - s.t <= VELOCITY_WINDOW_MS);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = last.t - first.t;
    return dt > 0 ? ((last.x - first.x) / dt) * 1000 : 0;
  }

  function onDown(e) {
    if (busy || transitioning || pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    x = 0;
    active = false;
    reduced = false;
    samples = [{ t: e.timeStamp, x: 0 }];
    if (!reduceMotion()) prepare();
    strip.setPointerCapture(pointerId);
  }

  function onMove(e) {
    if (e.pointerId !== pointerId) return;
    const pos = Math.max(0, e.clientX - startX);
    if (!active) {
      if (pos < START_SLOP_PX) return;
      active = true;
      if (reduceMotion()) reduced = true;
      else begin(pos);
    }
    x = pos;
    samples.push({ t: e.timeStamp, x: pos });
    if (samples.length > 12) samples.shift();
    if (!reduced) scheduleApply();
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (!active) {
      discardPrepared();
      return;
    }
    active = false;
    if (reduced) {
      // Ohne Animation: nur der Weg entscheidet.
      if (x > window.innerWidth * 0.4) onBack({ swipe: true });
      return;
    }
    cancelScheduled();
    const velocity = velocityPxPerS(e.timeStamp);
    const widths = velocity / width;
    let commit;
    if (e.type === 'pointercancel') commit = false;
    else if (widths <= -FLING_CANCEL) commit = false;
    else if (widths >= FLING_COMMIT) commit = true;
    else commit = x > width * COMMIT_RATIO;
    finish(commit, velocity);
  }

  // Zurück-Pfeil: dieselbe Animation ohne Finger.
  function pop() {
    if (busy || transitioning || pointerId !== null) return;
    prepare();
    begin(0);
    finish(true, 0);
  }

  // Zusätzlich zu `touch-action: none` (iOS wertet das nicht überall gleich
  // streng aus): Browser-eigene Touch-Verarbeitung (Scrollen, Gummiband) auf
  // dem Streifen unterbinden.
  strip.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  strip.addEventListener('pointerdown', onDown);
  strip.addEventListener('pointermove', onMove);
  strip.addEventListener('pointerup', onUp);
  strip.addEventListener('pointercancel', onUp);

  function fullTeardown() {
    pendingTeardown = false;
    cancelScheduled();
    painted?.cancel();
    discardPrepared();
    if (snapshot || under || dim) cleanupVisuals();
    strip.remove();
  }

  current = { pop };
  teardown = () => {
    // Läuft gerade eine Geste/Animation (onBack() ruft unmount() und damit
    // dies hier selbst auf), bleibt alles stehen - sie räumt sich selbst auf.
    if (busy) {
      pendingTeardown = true;
      return;
    }
    fullTeardown();
  };
}
