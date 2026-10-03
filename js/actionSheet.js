import { lockBodyScroll, unlockBodyScroll, SHEET_CLOSE_ANIMATION_MS } from './sheet.js';
import { escapeHtml } from './utils.js';

// Eigenes Action Sheet im Stil des SwiftUI-`confirmationDialog`: oben eine
// Karte mit Nachricht und einer (destruktiven) Aktion, darunter abgesetzt
// eine eigene "Abbrechen"-Karte. Ersetzt `alert()`/`confirm()`, wo ein
// nativer Systemdialog nicht ausreicht (eigene Beschriftung, rote Aktion).
// Liefert ein Promise: `true` = Aktion gewählt, `false` = Abbrechen bzw.
// Tipp auf den Hintergrund.
//
// Hängt sich an `document.body` statt an einen View-Container: Das Sheet liegt
// über allen anderen Sheets (z-70, über der angehobenen Bottom-Nav, z-55) und
// darf von keinem paint() einer View weggeräumt werden, während es offen ist.
// Glass-Optik der Karten per `.popup-glass` (wie das Roster-Kontextmenü).
export function showActionSheet({ message, actionLabel, cancelLabel = 'Abbrechen' }) {
  return new Promise((resolve) => {
    lockBodyScroll();
    const root = document.createElement('div');
    root.id = 'action-sheet-root';
    root.innerHTML = `
      <div class="action-sheet-backdrop bottom-sheet-backdrop fixed inset-0 z-[70] bg-black/50"></div>
      <div class="action-sheet fixed left-0 right-0 bottom-0 z-[71] px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] flex flex-col gap-2" role="dialog" aria-modal="true">
        <div class="popup-glass rounded-sheet overflow-hidden flex flex-col">
          <p class="px-4 py-3 text-label text-muted text-center">${escapeHtml(message)}</p>
          <div class="border-t border-white/10"></div>
          <button type="button" class="action-sheet-action tap-feedback w-full min-h-[56px] px-4 text-body font-semibold text-red-400">${escapeHtml(actionLabel)}</button>
        </div>
        <button type="button" class="action-sheet-cancel popup-glass tap-feedback rounded-sheet w-full min-h-[56px] px-4 text-body font-semibold text-ink">${escapeHtml(cancelLabel)}</button>
      </div>
    `;
    document.body.appendChild(root);

    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      root.querySelector('.action-sheet-backdrop').classList.add('closing');
      root.querySelector('.action-sheet').classList.add('closing');
      setTimeout(() => {
        root.remove();
        unlockBodyScroll();
        resolve(result);
      }, SHEET_CLOSE_ANIMATION_MS);
    };
    root.querySelector('.action-sheet-backdrop').addEventListener('click', () => finish(false));
    root.querySelector('.action-sheet-cancel').addEventListener('click', () => finish(false));
    root.querySelector('.action-sheet-action').addEventListener('click', () => finish(true));
  });
}
