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
  return `
    <li ${liAttrs} class="relative flex gap-3 ${liClasses}">
      ${highlighted ? '<div class="absolute -inset-x-4 -top-2 bottom-2 bg-raised -z-10"></div>' : ''}
      <div class="flex flex-col items-center flex-shrink-0">
        <span class="w-6 h-6 rounded-full flex items-center justify-center text-label flex-shrink-0 ${circleClasses}">${number}</span>
        ${!isLast ? '<div class="w-0.5 flex-1 bg-white/10 mt-1"></div>' : ''}
      </div>
      <div class="flex-1 pb-4">
        <div class="h-6 flex items-center gap-6 text-body">${contentHtml}</div>
      </div>
    </li>
  `;
}
