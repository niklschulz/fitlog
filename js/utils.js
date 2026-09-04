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
export function renderSetTimelineRow(number, contentHtml, { isLast = false, circleClasses = 'bg-base text-muted', liClasses = '', liAttrs = '' } = {}) {
  return `
    <li ${liAttrs} class="flex gap-3 ${liClasses}">
      <div class="flex flex-col items-center flex-shrink-0">
        <span class="w-6 h-6 rounded-full flex items-center justify-center text-label flex-shrink-0 ${circleClasses}">${number}</span>
        ${!isLast ? '<div class="w-0.5 flex-1 bg-white/10 mt-1"></div>' : ''}
      </div>
      <div class="flex-1 pb-4 flex items-center gap-6 text-body">${contentHtml}</div>
    </li>
  `;
}
