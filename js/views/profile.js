import { getProfile, saveProfile, clearProfile } from '../profile.js';
import { getSettings, saveSettings } from '../settings.js';
import { escapeHtml, BTN_PRIMARY, INPUT, CARD, withViewTransition } from '../utils.js';
import { lockBodyScroll, unlockBodyScroll, raiseNavAboveSheet, resetNavZIndex, wireSheetDrag, SHEET_CLOSE_ANIMATION_MS } from '../sheet.js';

let currentContainer = null;
let state = { mode: 'empty', linkSheetOpen: false, linkSheetClosing: false }; // mode: 'view' | 'empty'

export function render(container) {
  currentContainer = container;
  const profile = getProfile();
  state = {
    mode: profile.username && profile.token ? 'view' : 'empty',
    linkSheetOpen: false,
    linkSheetClosing: false,
  };
  paint();
}

// Analog zu workout.js's unmount() - das "Profil verknüpfen"-Sheet hält
// bei offenem Zustand einen unbeantworteten lockBodyScroll()/
// raiseNavAboveSheet()-Aufruf, der beim Tab-Wechsel ausgeglichen werden
// muss, s. js/sheet.js.
export function unmount() {
  if (pendingLinkSheetCloseTimeout) {
    clearTimeout(pendingLinkSheetCloseTimeout);
    pendingLinkSheetCloseTimeout = null;
  }
  if (state.linkSheetOpen) {
    unlockBodyScroll();
    resetNavZIndex();
  }
}

function paint() {
  const profile = getProfile();
  const body = state.mode === 'view' ? renderView(profile) : renderEmpty();

  currentContainer.innerHTML = `
    <div class="py-4 flex flex-col gap-4">
      <h1 class="text-screen-title">Profil</h1>
      ${body}
      ${renderSettings(getSettings())}
    </div>

    ${state.linkSheetOpen ? renderLinkSheet() : ''}
  `;

  wireEvents();
}

// Noch ohne Design-Feinschliff - reine Funktions-Umsetzung der beiden bisher
// hart codierten Konstanten (DEFAULT_SET_COUNT in workout-exercise-detail.js,
// WEEKLY_GOAL in statistics.js), die genau für diesen Einstellungsbereich
// vorbereitet waren, s. js/settings.js. Speichert direkt bei `change`
// (Blur/Enter), kein eigener Speichern-Button nötig.
function renderSettings(settings) {
  return `
    <div class="flex flex-col gap-2">
      <p class="text-body text-muted">Einstellungen</p>
      <div class="${CARD} flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-label text-muted" for="settings-default-set-count">Standardanzahl Sätze</label>
          <input
            id="settings-default-set-count"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            value="${settings.defaultSetCount}"
            class="bg-base ${INPUT}"
          />
          <p class="text-body text-muted">Lege fest, wie viele Sätze Fitlog für jede Übung standardmäßig vorsehen soll. Du kannst jederzeit mehr oder weniger Sätze absolvieren.</p>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-label text-muted" for="settings-weekly-goal">Wochenziel (Trainingstage pro Woche)</label>
          <input
            id="settings-weekly-goal"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            value="${settings.weeklyGoal}"
            class="bg-base ${INPUT}"
          />
          <p class="text-body text-muted">Fitlog kann dir anzeigen, wie häufig du in der aktuellen Woche schon trainiert hast. Lege hier dein Wochenziel fest.</p>
        </div>
      </div>
    </div>
  `;
}

function renderView(profile) {
  return `
    <div class="${CARD} flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-label text-muted">Angemeldet als</span>
        <span class="text-card-title">${escapeHtml(profile.username)}</span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-label text-muted">Token</span>
        <span class="font-mono text-body break-all">${escapeHtml(profile.token)}</span>
      </div>
    </div>

    <p class="text-label text-muted leading-relaxed">
      Wird für den späteren Sync zum eigenen Server verwendet. Sync ist aktuell noch nicht aktiv – das Training-Tracking funktioniert unabhängig davon vollständig offline weiter.
    </p>

    <button id="remove-profile-btn" class="tap-feedback ${BTN_PRIMARY} py-3 min-h-[44px]">
      Profil entfernen
    </button>
  `;
}

// Sign-In-Icon rechts neben dem Button-Text (Nutzer-Referenzbild) - Pfeil,
// der in eine offene Klammer/Tür hineinläuft, im selben dünnen Stroke-Stil
// wie alle übrigen Icons der App (stroke-width 1.75, round-Caps, kein Fill)
// statt der dickeren, zweifarbigen Optik der Referenz.
function renderSignInIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
      <path d="M13 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M3 12h10M9 8l4 4-4 4" />
    </svg>
  `;
}

function renderEmpty() {
  return `
    <p class="text-body text-muted text-center py-8">Noch kein Profil hinterlegt.</p>
    <button id="add-profile-btn" class="tap-feedback ${BTN_PRIMARY} py-3 min-h-[44px] flex items-center justify-center gap-2">
      Profil verknüpfen
      ${renderSignInIcon()}
    </button>
  `;
}

// "Profil verknüpfen"-Sheet - Top-Level-Bottom-Sheet (kein gestapeltes
// Sheet darüber/darunter), deshalb als Teil des normalen paint()-Strings
// eingehängt statt per insertAdjacentHTML, analog zum Kalender-Sheet in
// workout.js (s. dort für die Begründung des Unterschieds zu gestapelten
// Sheets wie dem Neue-Übung-Sheet). Inputs nutzen die Sheet-Fläche-Variante
// `bg-white/[0.08]` statt `bg-base`, da sie direkt auf `bg-surface` sitzen,
// nicht in einer eigenen Karte, s. design-system.md.
function renderLinkSheet() {
  return `
    <div id="link-sheet-backdrop" class="bottom-sheet-backdrop ${state.linkSheetClosing ? 'closing' : ''} fixed inset-0 z-50 bg-black/50"></div>
    <div class="bottom-sheet ${state.linkSheetClosing ? 'closing' : ''} fixed left-0 right-0 bottom-0 z-[51] bg-surface rounded-sheet flex flex-col">
      <div class="grid grid-cols-3 items-center px-4 pt-3 pb-5 flex-shrink-0">
        <button id="link-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div id="link-sheet-handle" class="justify-self-center flex items-center justify-center w-full py-3 min-h-[44px]" style="touch-action: none;">
          <span class="text-card-title">Profil verknüpfen</span>
        </div>
        <div></div>
      </div>
      <div id="link-sheet-content" class="bottom-sheet-scroll flex-1 overflow-y-auto min-h-0 px-4 pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <form id="link-sheet-form" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-label text-muted" for="link-sheet-username-input">Username</label>
            <input
              id="link-sheet-username-input"
              type="text"
              autocomplete="off"
              class="w-full bg-white/[0.08] ${INPUT}"
              required
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-label text-muted" for="link-sheet-token-input">Token</label>
            <input
              id="link-sheet-token-input"
              type="text"
              autocomplete="off"
              class="w-full bg-white/[0.08] ${INPUT}"
              required
            />
          </div>
          <button type="submit" class="tap-feedback ${BTN_PRIMARY} py-3 min-h-[44px]">
            Verknüpfen
          </button>
        </form>
      </div>
    </div>
  `;
}

function openLinkSheet() {
  state.linkSheetOpen = true;
  state.linkSheetClosing = false;
  lockBodyScroll();
  raiseNavAboveSheet();
  paint();
}

// Analog zu closeCalendarSheet in workout.js: erst die Schließen-Animation
// abspielen (muss zur Dauer von .bottom-sheet.closing in css/styles.css
// passen), danach erst wirklich aus State/DOM entfernen.
let pendingLinkSheetCloseTimeout = null;

function finalizeLinkSheetClose() {
  pendingLinkSheetCloseTimeout = null;
  state.linkSheetOpen = false;
  state.linkSheetClosing = false;
  unlockBodyScroll();
  resetNavZIndex();
  paint();
}

function closeLinkSheet() {
  if (!state.linkSheetOpen || state.linkSheetClosing) return;
  state.linkSheetClosing = true;
  paint();
  pendingLinkSheetCloseTimeout = setTimeout(finalizeLinkSheetClose, SHEET_CLOSE_ANIMATION_MS);
}

function wireLinkSheetDrag() {
  const backdropEl = currentContainer.querySelector('#link-sheet-backdrop');
  wireSheetDrag({
    handle: currentContainer.querySelector('#link-sheet-handle'),
    sheetEl: backdropEl?.nextElementSibling ?? null,
    backdropEl,
    isClosing: () => state.linkSheetClosing,
    onDismiss: () => {
      pendingLinkSheetCloseTimeout = setTimeout(finalizeLinkSheetClose, SHEET_CLOSE_ANIMATION_MS);
    },
  });
}

function wireEvents() {
  currentContainer.querySelector('#add-profile-btn')?.addEventListener('click', () => {
    openLinkSheet();
  });

  currentContainer.querySelector('#link-sheet-backdrop')?.addEventListener('click', () => {
    closeLinkSheet();
  });
  currentContainer.querySelector('#link-sheet-close-btn')?.addEventListener('click', () => {
    closeLinkSheet();
  });
  wireLinkSheetDrag();

  currentContainer.querySelector('#link-sheet-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = currentContainer.querySelector('#link-sheet-username-input').value.trim();
    const token = currentContainer.querySelector('#link-sheet-token-input').value.trim();
    if (!username || !token) return;
    saveProfile({ username, token });
    state.mode = 'view';
    closeLinkSheet();
  });

  currentContainer.querySelector('#remove-profile-btn')?.addEventListener('click', () => {
    if (!confirm('Profil wirklich entfernen? Der Token muss danach erneut eingegeben werden.')) return;
    clearProfile();
    withViewTransition(() => {
      state.mode = 'empty';
      paint();
    }, 'back');
  });

  currentContainer.querySelector('#settings-default-set-count')?.addEventListener('change', (e) => {
    const value = parseInt(e.target.value, 10);
    const settings = getSettings();
    if (!Number.isInteger(value) || value < 1) {
      e.target.value = settings.defaultSetCount;
      return;
    }
    saveSettings({ ...settings, defaultSetCount: value });
  });

  currentContainer.querySelector('#settings-weekly-goal')?.addEventListener('change', (e) => {
    const value = parseInt(e.target.value, 10);
    const settings = getSettings();
    if (!Number.isInteger(value) || value < 1) {
      e.target.value = settings.weeklyGoal;
      return;
    }
    saveSettings({ ...settings, weeklyGoal: value });
  });
}
