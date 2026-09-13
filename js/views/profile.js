import { getProfile, saveProfile, clearProfile } from '../profile.js';
import { getSettings, saveSettings } from '../settings.js';
import { escapeHtml, BTN_PRIMARY, BTN_SECONDARY, INPUT, CARD } from '../utils.js';
import { lockBodyScroll, unlockBodyScroll, raiseNavAboveSheet, resetNavZIndex, wireSheetDrag, SHEET_CLOSE_ANIMATION_MS } from '../sheet.js';

let currentContainer = null;
let state = {
  mode: 'empty', // 'view' | 'empty'
  linkSheetOpen: false,
  linkSheetClosing: false,
  linkSheetEditing: false,
  linkSheetProfile: null,
};

export function render(container) {
  currentContainer = container;
  const profile = getProfile();
  state = {
    mode: profile.username && profile.token ? 'view' : 'empty',
    linkSheetOpen: false,
    linkSheetClosing: false,
    linkSheetEditing: false,
    linkSheetProfile: null,
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
    <div class="flex flex-col gap-3">
      <div class="${CARD} flex flex-col gap-2">
        <label class="text-label-large text-muted" for="settings-default-set-count">Standardanzahl Sätze</label>
        <input
          id="settings-default-set-count"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          value="${settings.defaultSetCount}"
          class="bg-white/[0.08] ${INPUT}"
        />
        <p class="text-body text-muted">Lege fest, wie viele Sätze Fitlog für jede Übung standardmäßig vorsehen soll. Du kannst jederzeit mehr oder weniger Sätze absolvieren.</p>
      </div>
      <div class="${CARD} flex flex-col gap-2">
        <label class="text-label-large text-muted" for="settings-weekly-goal">Wochenziel (Trainingstage pro Woche)</label>
        <input
          id="settings-weekly-goal"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          value="${settings.weeklyGoal}"
          class="bg-white/[0.08] ${INPUT}"
        />
        <p class="text-body text-muted">Fitlog kann dir anzeigen, wie häufig du in der aktuellen Woche schon trainiert hast. Lege hier dein Wochenziel fest.</p>
      </div>
    </div>
  `;
}

function renderView(profile) {
  return `
    <div class="${CARD} flex items-center justify-between gap-3">
      <div class="flex flex-col gap-1 min-w-0">
        <span class="text-label-large text-muted">Angemeldet als</span>
        <span class="text-card-title truncate">${escapeHtml(profile.username)}</span>
      </div>
      <button id="edit-profile-btn" type="button" class="tap-feedback flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted" aria-label="Profil bearbeiten">
        ${renderEditIcon()}
      </button>
    </div>
  `;
}

// Stift-Icon für den Bearbeiten-Button auf der Profil-Karte - reines
// Icon-Element (kein icon-btn-glass), da es auf einer normalen Karte sitzt,
// nicht in der Navigation, s. "Glas-Effekt" in design-system.md.
function renderEditIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
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
    <button id="add-profile-btn" class="tap-feedback ${BTN_PRIMARY} py-3 min-h-[44px] flex items-center justify-center gap-2">
      Profil verknüpfen
      ${renderSignInIcon()}
    </button>
  `;
}

// "Profil verknüpfen"/"Profil bearbeiten"-Sheet - dieselbe Sheet-Komponente
// dient beiden Zwecken, je nachdem, ob beim ÖFFNEN schon ein Profil
// existiert (state.linkSheetEditing): Titel, Feld-Darstellung und der
// Aktions-Button wechseln entsprechend. Im Bearbeiten-Fall werden
// Username/Token als reiner, nicht editierbarer Text angezeigt (kein
// Speichern-Pfad) - die einzige Aktion bleibt "Profil entfernen" (ein
// Token-Wechsel läuft weiterhin über Entfernen + erneutes Verknüpfen).
//
// state.linkSheetEditing/-Profile werden bewusst einmalig beim Öffnen
// (openLinkSheet()) festgehalten statt hier bei jedem paint() live aus
// getProfile() neu berechnet: Sowohl "Verknüpfen" (saveProfile()) als auch
// "Profil entfernen" (clearProfile()) ändern das gespeicherte Profil, BEVOR
// closeLinkSheet() die Schließen-Animation startet - deren
// State-Änderung (linkSheetClosing) selbst einen paint() auslöst, während
// das Sheet noch sichtbar ist. Ohne dieses Festhalten hätte genau dieser
// Zwischen-Repaint eine live aus dem (bereits geänderten) Profil neu
// berechnete Editing-Erkennung gesehen und wäre z. B. beim Entfernen
// mitten in der Schließen-Animation kurz in den "Profil verknüpfen"-Zustand
// gekippt (grüner Button statt grau) - hier beobachtet und gefixt.
//
// Top-Level-Bottom-Sheet (kein gestapeltes Sheet darüber/darunter), deshalb
// als Teil des normalen paint()-Strings eingehängt statt per
// insertAdjacentHTML, analog zum Kalender-Sheet in workout.js (s. dort für
// die Begründung des Unterschieds zu gestapelten Sheets wie dem
// Neue-Übung-Sheet). Inputs nutzen die Sheet-Fläche-Variante
// `bg-white/[0.08]` statt `bg-base`, da sie direkt auf `bg-surface` sitzen,
// nicht in einer eigenen Karte, s. design-system.md.
function renderLinkSheet() {
  const isEditing = state.linkSheetEditing;
  const profile = state.linkSheetProfile;
  const title = isEditing ? 'Profil bearbeiten' : 'Profil verknüpfen';

  return `
    <div id="link-sheet-backdrop" class="bottom-sheet-backdrop ${state.linkSheetClosing ? 'closing' : ''} fixed inset-0 z-50 bg-black/50"></div>
    <div class="bottom-sheet ${state.linkSheetClosing ? 'closing' : ''} fixed left-0 right-0 bottom-0 z-[51] bg-surface rounded-sheet flex flex-col">
      <div class="grid grid-cols-[44px_1fr_44px] items-center px-4 pt-3 pb-5 flex-shrink-0">
        <button id="link-sheet-close-btn" type="button" class="icon-btn-glass tap-feedback justify-self-start text-ink" aria-label="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div id="link-sheet-handle" class="justify-self-center flex items-center justify-center w-full py-3 min-h-[44px]" style="touch-action: none;">
          <span class="text-card-title">${title}</span>
        </div>
        <div></div>
      </div>
      <div id="link-sheet-content" class="bottom-sheet-scroll flex-1 overflow-y-auto min-h-0 px-4 pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <form id="link-sheet-form" class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-label-large text-muted"${isEditing ? '' : ' for="link-sheet-username-input"'}>Username</label>
            ${
              isEditing
                ? `<p class="w-full bg-white/[0.08] ${INPUT} flex items-center">${escapeHtml(profile.username)}</p>`
                : `<input
              id="link-sheet-username-input"
              type="text"
              autocomplete="off"
              value=""
              class="w-full bg-white/[0.08] ${INPUT}"
              required
            />`
            }
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-label-large text-muted"${isEditing ? '' : ' for="link-sheet-token-input"'}>Token</label>
            ${
              isEditing
                ? `<p class="w-full bg-white/[0.08] ${INPUT} flex items-center">${escapeHtml(profile.token)}</p>`
                : `<input
              id="link-sheet-token-input"
              type="text"
              autocomplete="off"
              value=""
              class="w-full bg-white/[0.08] ${INPUT}"
              required
            />`
            }
          </div>
          ${
            isEditing
              ? `<button type="button" id="link-sheet-remove-btn" class="tap-feedback ${BTN_SECONDARY} py-3 min-h-[44px]">Profil entfernen</button>`
              : `<button type="submit" class="tap-feedback ${BTN_PRIMARY} py-3 min-h-[44px]">Verknüpfen</button>`
          }
        </form>
      </div>
    </div>
  `;
}

function openLinkSheet() {
  const profile = getProfile();
  state.linkSheetEditing = !!(profile.username && profile.token);
  state.linkSheetProfile = profile;
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

  currentContainer.querySelector('#edit-profile-btn')?.addEventListener('click', () => {
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

  currentContainer.querySelector('#link-sheet-remove-btn')?.addEventListener('click', () => {
    if (!confirm('Profil wirklich entfernen? Der Token muss danach erneut eingegeben werden.')) return;
    clearProfile();
    state.mode = 'empty';
    closeLinkSheet();
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
