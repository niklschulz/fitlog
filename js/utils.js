// Komponenten-Muster als gemeinsame Klassen-Konstanten (s. design-system.md,
// "Komponenten-Muster"): Ohne Build-Schritt gibt es kein Tailwind-`@apply`,
// über das mehrere Utility-Klassen unter einem eigenen CSS-Klassennamen
// gebündelt werden könnten (ADR 0002) - eine exportierte String-Konstante,
// die Views in ihre Template-Strings interpolieren, ist der Weg ohne
// Build-Schritt, der denselben Zweck erfüllt: eine einzige Stelle pro
// Muster statt an jeder Verwendung von Hand kopierter Klassen-Ketten.
export const BTN_PRIMARY = 'bg-accent text-base font-semibold rounded-btn';

// Form-Input (s. design-system.md, "Input"): Hintergrund bewusst nicht Teil
// der Konstante - bg-base ist der Standardfall (Input innerhalb einer
// bg-surface-Karte), das Umbenennen-Formular im Routine-Editor weicht
// bewusst auf bg-surface ab (kein Karten-Hintergrund dort, s. "Offene
// Punkte"), jede Stelle setzt die Hintergrundfarbe deshalb selbst davor.
export const INPUT = 'rounded-btn px-3 py-3 text-ink min-h-[44px]';

export const BTN_SECONDARY = 'bg-raised text-ink font-semibold rounded-btn';

export const DESTRUCTIVE_LINK = 'text-red-400 text-body';

export const CARD = 'bg-surface rounded-card p-4';

// Kompakte Listenzeile (s. design-system.md, "Listenzeile") - die größere
// Karten-Variante (rounded-card) hat aktuell nur einen Anwendungsfall
// (Übungs-Roster im Workout-Tab) und lohnt deshalb noch keine eigene
// Konstante.
export const LIST_ROW = 'bg-surface rounded-btn px-4 py-3';

export const TEXTLINK_ACTION = 'text-accent text-body font-medium';

// Liquid-Glass-Navigationsgefühl (Übungs-Detailseite, Formulare in
// exercises.js/routines.js/profile.js): Ein "Reingehen" (neue, tiefere
// Ebene öffnen, z. B. Übung antippen) bekommt Skalierung+Fade, ein
// "Zurückgehen" ein Slide-nach-unten+Fade - Richtung wird kurz vor dem
// Übergang als Attribut auf <html> gesetzt, die eigentlichen Keyframes
// stehen in css/styles.css (::view-transition-old/-new(root)). Fällt ohne
// Attribut-Zuordnung nichts auf, deshalb hier explizit setzen statt sich
// auf einen Default zu verlassen.
//
// Kein Build-Schritt/Framework nötig (ADR 0001/0002) - die View Transitions
// API ist eine native Browser-API (Safari ab 18.2, Fitlog setzt iOS 18 als
// Mindestversion voraus), kein zusätzliches Bundle. Ohne Unterstützung oder
// bei aktiviertem "Bewegung reduzieren" läuft renderFn() einfach direkt,
// ohne jeden Übergang - kein Bruch, nur kein Effekt (s. auch die
// @media(prefers-reduced-motion)-Regel in styles.css für den Fall, dass die
// Browser-Unterstützung zwar da ist, aber keine Animation gewünscht ist).
export function withViewTransition(renderFn, direction = 'forward') {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !document.startViewTransition) {
    renderFn();
    return;
  }
  document.documentElement.setAttribute('data-transition-direction', direction);
  const transition = document.startViewTransition(renderFn);
  transition.finished.finally(() => {
    document.documentElement.removeAttribute('data-transition-direction');
  });
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Eine Zeile einer "verbundenen" Satz-Liste: Nummern-Kreis + vertikale
// Verbindungslinie zum nächsten Kreis (leer beim letzten Eintrag) links,
// beliebiger Inhalt (Gewicht/Reps o. Ä.) rechts. Wiederverwendet zwischen
// der Roster-Zeile im Workout-Tab, dem Tages-Reiter und dem Verlauf-Reiter
// der Übungs-Detailseite (s. design-system.md, Siebzehnte Iteration).
//
// `highlighted` zeichnet ein randloses, bildschirmbreites Hervorhebungs-Band
// hinter Kreis und Inhalt (Neunzehnte bis Zweiundzwanzigste Iteration).
// Bewusst als `position: absolute`-Element umgesetzt statt als
// Hintergrundfarbe auf der Zeile selbst: Der Inhalts-Bereich hat unten
// zusätzlichen Platz (`pb-4`) für die Verbindungslinie zum nächsten Kreis -
// eine Hintergrundfarbe direkt auf der Zeile würde diesen Platz mit
// einfärben. Der Inhalt steckt deshalb in einer `h-6`-Box (exakt so hoch
// wie der Nummern-Kreis daneben) statt einfach nur der Textzeile selbst zu
// folgen - Text und Kreis sind dadurch beide exakt 24px hoch und um
// denselben Mittelpunkt zentriert (vorher lag der Text, da niedriger als
// der Kreis, beim Antippen sichtbar nicht mittig zum Kreis). Weil dieser
// Mittelpunkt jetzt stimmt, lässt sich das Band per `-top-2 bottom-2`
// symmetrisch (8px) über diese 24px-Box hinaus vergrößern, ohne die
// Zentrierung zu verlieren - anders als in der Einundzwanzigsten
// Iteration, wo derselbe Zuschlag auf einer noch falsch sitzenden
// Text-Box zu einem sichtbaren Versatz führte. Da das Band völlig aus dem
// Layout-Fluss herausgenommen ist, verändert Ein-/Ausblenden nie die
// Zeilenhöhe - kein "Springen" benachbarter Zeilen beim Auswählen.
// `-inset-x-4` gleicht das seitliche Container-Padding aus, damit das Band
// bis an den Bildschirmrand reicht; `-z-10` hält es hinter Kreis/Linie/Text
// (die als normale, nicht positionierte Flex-Kinder sonst dahinter
// verschwinden würden).
export function renderSetTimelineRow(number, contentHtml, { isLast = false, circleClasses = 'bg-base text-muted', liClasses = '', liAttrs = '', highlighted = false } = {}) {
  // `pb-4` reserviert Platz für die Verbindungslinie zum nächsten Kreis -
  // bei der letzten Zeile gibt es keine, das Reservieren erzeugte dort
  // unnötigen Leerraum (sichtbar z. B. als zu großer Abstand zwischen
  // letzter Zeile und Karten-Unterkante, wenn die Liste in einer Karte
  // steckt, s. design-system.md Fünfzigste Iteration). Nur bei
  // Nicht-letzten Zeilen gesetzt.
  //
  // Das Hervorhebungs-Band muss diesen Wegfall mitziehen, um weiterhin
  // exakt auf den 24px-Kreis zentriert zu bleiben (s. Zweiundzwanzigste/
  // Dreiundzwanzigste Iteration für die ursprüngliche Herleitung von
  // `-top-2 bottom-2`): Ohne `pb-4` ist die Zeile nur noch 24px hoch statt
  // 40px - `bottom-2` (8px *innerhalb* der Zeile) würde das Band dann nach
  // oben verschieben. Bei der letzten Zeile deshalb stattdessen `-bottom-2`
  // (8px *außerhalb*), symmetrisch zu `-top-2` auf der anderen Seite.
  const bandBottomClass = isLast ? '-bottom-2' : 'bottom-2';
  return `
    <li ${liAttrs} class="relative flex gap-3 ${liClasses}">
      ${highlighted ? `<div class="absolute -inset-x-4 -top-2 ${bandBottomClass} bg-raised -z-10"></div>` : ''}
      <div class="flex flex-col items-center flex-shrink-0">
        <span class="w-6 h-6 rounded-full flex items-center justify-center text-label flex-shrink-0 ${circleClasses}">${number}</span>
        ${!isLast ? '<div class="w-0.5 flex-1 bg-white/10 mt-1"></div>' : ''}
      </div>
      <div class="flex-1 ${isLast ? '' : 'pb-4'}">
        <div class="h-6 flex items-center gap-6 text-body">${contentHtml}</div>
      </div>
    </li>
  `;
}

// Gewicht/Reps-Wertepaar einer Satz-Zeile, spaltenbündig über mehrere
// Zeilen hinweg - sowohl die Zahl als auch die Einheit dahinter. Jede Zahl
// steckt in einer eigenen, fest breiten Box (`inline-block ... text-right`)
// statt ihrer natürlichen Textbreite zu folgen und ist darin rechtsbündig -
// die Einheit folgt direkt danach und landet dadurch automatisch an
// derselben Kante wie in jeder anderen Zeile, unabhängig davon, wie viele
// Stellen der jeweilige Wert hat (z. B. "5" vs. "999.5"). Die Boxen sind
// bewusst breiter als die längsten realistisch vorkommenden Werte
// ("999.5" kg, "999" Reps) statt genau passend - eine Zahl, die ihre Box
// überfüllt, überragt sie sichtbar auf der falschen Seite und zerstört
// damit den festen Abstand zur Einheit (s. Sechsundzwanzigste Iteration).
// Einheit in `text-muted`, damit die Zahl selbst optisch leichter zu
// erfassen ist (dasselbe Muted-Token wie sonst im Design-System für
// sekundäre Beschriftungen, z. B. "text-label text-muted").
// Wiederverwendet zwischen Roster-Zeile (Workout-Tab) und
// Übungs-Detailseite (Tages-/Verlauf-Reiter), s. design-system.md
// Vierundzwanzigste bis Sechsundzwanzigste Iteration.
export function renderSetValues(weight, reps) {
  return `
    <span class="inline-flex items-baseline gap-1">
      <span class="inline-block w-16 text-right">${weight}</span><span class="text-muted">kg</span>
    </span>
    <span class="inline-flex items-baseline gap-1">
      <span class="inline-block w-8 text-right">${reps}</span><span class="text-muted">Reps</span>
    </span>
  `;
}
