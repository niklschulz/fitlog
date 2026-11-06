// Seiten-Übergänge wie in iOS (s. ADR 0037/0038/0039): Zurück per Wisch vom
// linken Rand, per Zurück-Pfeil und das Öffnen einer Unterseite nutzen
// dieselbe Schiebe-Bewegung. Betroffen: Übungs-Detailseite im Workout-Tab und
// Statistik-Übungsseite.
//
// Seiten-Ebene (ADR 0039): Eine Unterseite wird NICHT mehr in den Scroll-
// Container der Übersicht (`#view-container`) gezeichnet, sondern in eine
// eigene, frisch erzeugte Ebene (`#page-layer`, fixiert über dem Container).
// Der Container der Übersicht bleibt damit die ganze Zeit sichtbar, wird nie
// verschoben, ausgeblendet oder neu befüllt und behält seine Scrollposition
// von selbst. Hintergrund: Wurde derselbe Container zwischen kurzer
// Detailseite und langer Liste getauscht (und dabei ausgeblendet/verschoben),
// legte iOS dafür keinen funktionierenden nativen Scroller mehr an - die Liste
// ließ sich nach dem Zurückwischen nur noch per Gummiband dehnen.
//
// Ablauf der Zurück-Geste:
//  - Start nur in einem schmalen Streifen am linken Rand (EDGE_WIDTH_PX) - ein
//    eigenes, fixes Element außerhalb des Seiteninhalts. `touch-action: none`
//    (nicht `pan-y`): Sonst darf iOS bei schrägen Wischbewegungen parallel
//    vertikal scrollen bzw. das Gummiband auslösen.
//    Offene Sheets liegen darüber und blockieren die Geste von selbst.
//  - Beim Ziehen folgt die Seiten-Ebene dem Finger. Darunter liegt ein Abbild
//    (Klon) der Übersicht, das mit Versatz (-1/3 der Breite) nachläuft, eine
//    abdunkelnde Ebene dazwischen blendet mit dem Weg aus. `refreshUnder()`
//    des Aufrufers zeichnet die echte Übersicht währenddessen in place neu
//    (geänderte Sätze), das Abbild wird danach erneuert.
//  - Beim Loslassen entscheiden, wie bei iOS, vor allem die Geschwindigkeit
//    (Fling nach rechts = zurück, nach links = bleiben), sonst die Hälfte des
//    Wegs. Das Ausgleiten ist eine gedämpfte Feder, die mit der
//    Fingergeschwindigkeit startet.
//  - Zurück: `onBack({ animated: true })` räumt die Seite auf (Modul
//    abmelden, State, Ebene entfernen). Bleiben: Die Ebene gleitet zurück, es
//    gibt nichts neu aufzubauen.
//
// Zurück-Pfeil (`triggerBack()`) und Öffnen (`openPage()`) laufen über
// dieselbe Mechanik, nur ohne Finger.
//
// Layer-Reihenfolge (alles unterhalb der Scrims z-10, Bottom-Nav z-20 und der
// Sheets ab z-50, die weiter im Container der Übersicht liegen): Container
// (statisch) < Abbild (5) < Abdunklung (6) < Seiten-Ebene (8).
//
// Nur ein Streifen gleichzeitig (Modul-Singleton, wie die Notiz-/Action-
// Sheets): Aufrufer rufen `wireSwipeBack()` in ihrem render() und
// `unwireSwipeBack()` in ihrem unmount() auf. `unwireSwipeBack()` bricht eine
// laufende Geste/Animation nicht ab, sie räumt sich danach selbst auf.
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
const Z = { under: 5, dim: 6, layer: 8 };

let teardown = null;
let current = null;
let transitioning = false;
let pageLayer = null;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pageBackground = () => getComputedStyle(document.body).backgroundColor;
const listContainer = () => document.getElementById('view-container');

export function unwireSwipeBack() {
  current = null;
  teardown?.();
  teardown = null;
}

// Entfernt die Seiten-Ebene (falls vorhanden). Von den onBack-Callbacks der
// Aufrufer und beim Tab-Wechsel benutzt.
export function removePageLayer() {
  pageLayer?.remove();
  pageLayer = null;
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

// Neue Seiten-Ebene: gleiche Scroll-Eigenschaften (Klassen, Padding, Safe-
// Area) wie der Container der Übersicht, aber ein eigener, frischer Scroller.
function createPageLayer(list) {
  removePageLayer();
  const layer = document.createElement('div');
  layer.id = 'page-layer';
  layer.className = list.className;
  layer.style.cssText =
    `position:fixed;top:0;right:0;bottom:0;left:0;z-index:${Z.layer};background:${pageBackground()};`;
  document.body.appendChild(layer);
  pageLayer = layer;
  return layer;
}

// Öffnen einer Unterseite: Die Übersicht (Abbild) rückt mit Versatz nach links
// und wird abgedunkelt, die neue Seiten-Ebene schiebt sich von rechts darüber -
// das Gegenstück zur Zurück-Geste. `renderFn(layer)` zeichnet die neue Seite in
// die Ebene; der echte Container der Übersicht bleibt unberührt darunter.
export function openPage(list, renderFn) {
  if (transitioning || pageLayer) return;
  const layer = createPageLayer(list);
  if (reduceMotion()) {
    renderFn(layer);
    return;
  }
  transitioning = true;
  const width = window.innerWidth;
  const rect = list.getBoundingClientRect();
  const under = makeSnapshot(list, rect, Z.under);
  under.style.boxShadow = 'none';
  const dim = makeDim(rect, Z.dim, 0);

  layer.style.transform = `translateX(${width}px)`;
  layer.style.boxShadow = SHADOW;

  const painted = whenContainerPainted(layer);
  renderFn(layer);

  painted.promise
    .then(() => {
      // Layout jetzt erzwingen, nicht erst im ersten Animations-Bild.
      void layer.offsetHeight;
      return springRun({
        from: width,
        to: 0,
        onFrame: (x) => {
          const p = 1 - x / width;
          layer.style.transform = `translateX(${x}px)`;
          under.style.transform = `translateX(${-width * PARALLAX * p}px)`;
          dim.style.opacity = String(DIM_MAX * p);
        },
      });
    })
    .finally(() => {
      under.remove();
      dim.remove();
      layer.style.transform = '';
      layer.style.boxShadow = '';
      transitioning = false;
    });
}

// `container` ist die Seiten-Ebene der Unterseite. `onBack({ animated })`
// räumt die Seite auf (Modul abmelden, State, `removePageLayer()`);
// `animated: true` heißt: die Übersicht wurde schon über `refreshUnder()`
// aktualisiert. `refreshUnder()` zeichnet die Übersicht in place neu (gibt
// optional ein Promise zurück).
export function wireSwipeBack({ container, onBack, refreshUnder = null }) {
  unwireSwipeBack();
  if (!container) return;
  const layer = container;

  const strip = document.createElement('div');
  strip.id = 'swipe-back-edge';
  // z-index unterhalb der Bottom-Nav (z-20) und aller Sheets (ab z-50).
  strip.style.cssText = `position:fixed;top:0;bottom:0;left:0;width:${EDGE_WIDTH_PX}px;z-index:15;touch-action:none;overscroll-behavior:none;`;
  document.body.appendChild(strip);

  let pointerId = null;
  let startX = 0;
  let x = 0; // aktuelle Position der Seiten-Ebene (px)
  let active = false; // Seite wird gerade gezogen
  let reduced = false; // "Bewegung reduzieren": keine Visualisierung
  let busy = false; // Geste oder Zurück-Animation läuft
  let pendingTeardown = false;
  let samples = [];
  let frame = null;
  let width = 0;
  let under = null; // Abbild der Übersicht (Parallax)
  let dim = null;
  let prepared = null; // vorab gebautes Abbild (s. onDown)
  let refreshing = null;

  function applyProgress(pos) {
    const p = clamp(pos / width, 0, 1);
    layer.style.transform = `translateX(${pos}px)`;
    if (under) under.style.transform = `translateX(${-width * PARALLAX * (1 - p)}px)`;
    if (dim) dim.style.opacity = String(DIM_MAX * (1 - p));
  }

  function scheduleApply() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (dim) applyProgress(x);
    });
  }

  function cancelScheduled() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  // Baut das Abbild der Übersicht schon beim Auflegen des Fingers (Klonen +
  // Layout kosten etwas, das soll nicht das erste Zieh-Bild verzögern).
  // Unsichtbar, bis die Geste beginnt.
  function prepare() {
    discardPrepared();
    width = window.innerWidth;
    const list = listContainer();
    const rect = list.getBoundingClientRect();
    const snap = makeSnapshot(list, rect, Z.under);
    snap.style.boxShadow = 'none';
    snap.style.visibility = 'hidden';
    prepared = { snap, rect };
  }

  function discardPrepared() {
    prepared?.snap.remove();
    prepared = null;
  }

  function begin(startPos) {
    busy = true;
    transitioning = true;
    if (!prepared) prepare();
    under = prepared.snap;
    under.style.visibility = '';
    const rect = prepared.rect;
    dim = makeDim(rect, Z.dim, DIM_MAX);
    prepared = null;
    x = startPos;
    layer.style.boxShadow = SHADOW;
    applyProgress(x);

    // Übersicht darunter in place aktualisieren (Sätze der Detailseite),
    // danach das Abbild erneuern. Der echte Container bleibt sichtbar und
    // unverschoben, nur eben vom Abbild/der Ebene verdeckt.
    if (refreshUnder) {
      refreshing = Promise.resolve()
        .then(() => refreshUnder())
        .then(() => {
          if (!under) return;
          const fresh = makeSnapshot(listContainer(), rect, Z.under);
          fresh.style.boxShadow = 'none';
          fresh.style.transform = under.style.transform;
          under.remove();
          under = fresh;
        })
        .catch(() => {});
    } else {
      refreshing = Promise.resolve();
    }
  }

  function cleanupVisuals() {
    under?.remove();
    dim?.remove();
    under = null;
    dim = null;
    if (layer.isConnected) {
      layer.style.transform = '';
      layer.style.boxShadow = '';
    }
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
    // Aktualisierte Übersicht muss da sein, bevor die Ebene verschwindet.
    await refreshing;
    if (commit) {
      // Ruft über unmount() auch unwireSwipeBack() auf - `busy` hält den
      // Streifen bis hierher am Leben.
      onBack({ animated: true });
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
      if (x > window.innerWidth * 0.4) onBack({ animated: false });
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
    discardPrepared();
    if (under || dim) cleanupVisuals();
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
