import { getProfile, saveProfile, clearProfile } from '../profile.js';
import { getSettings, saveSettings } from '../settings.js';
import { escapeHtml, BTN_PRIMARY, INPUT, CARD, withViewTransition } from '../utils.js';

let currentContainer = null;
let state = { mode: 'empty' }; // 'view' | 'empty' | 'form'

export function render(container) {
  currentContainer = container;
  const profile = getProfile();
  state = { mode: profile.username && profile.token ? 'view' : 'empty' };
  paint();
}

function paint() {
  const profile = getProfile();
  const body =
    state.mode === 'view' ? renderView(profile) : state.mode === 'form' ? renderForm() : renderEmpty();

  currentContainer.innerHTML = `
    <div class="py-4 flex flex-col gap-4">
      <h1 class="text-screen-title">Profil</h1>
      ${body}
      ${renderSettings(getSettings())}
    </div>
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

function renderEmpty() {
  return `
    <p class="text-body text-muted text-center py-8">Noch kein Profil hinterlegt.</p>
    <button id="add-profile-btn" class="tap-feedback ${BTN_PRIMARY} py-3 min-h-[44px]">
      Profil hinzufügen
    </button>
  `;
}

function renderForm() {
  return `
    <form id="profile-form" class="flex flex-col gap-4 ${CARD}">
      <div class="flex flex-col gap-1">
        <label class="text-label text-muted" for="profile-username">Username</label>
        <input
          id="profile-username"
          name="username"
          type="text"
          autocomplete="off"
          class="bg-base ${INPUT}"
          required
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-label text-muted" for="profile-token">Token</label>
        <input
          id="profile-token"
          name="token"
          type="text"
          autocomplete="off"
          class="bg-base ${INPUT}"
          required
        />
      </div>

      <p class="text-label text-muted leading-relaxed">
        Wird für den späteren Sync zum eigenen Server verwendet. Sync ist aktuell noch nicht aktiv – das Training-Tracking funktioniert unabhängig davon vollständig offline weiter.
      </p>

      <div class="flex gap-3">
        <button type="submit" class="tap-feedback flex-1 ${BTN_PRIMARY} py-3 min-h-[44px]">
          Speichern
        </button>
        <button type="button" id="cancel-profile-btn" class="tap-feedback px-4 py-3 text-muted min-h-[44px]">
          Abbrechen
        </button>
      </div>
    </form>
  `;
}

function wireEvents() {
  currentContainer.querySelector('#add-profile-btn')?.addEventListener('click', () => {
    withViewTransition(() => {
      state.mode = 'form';
      paint();
    }, 'forward');
  });

  currentContainer.querySelector('#cancel-profile-btn')?.addEventListener('click', () => {
    withViewTransition(() => {
      state.mode = 'empty';
      paint();
    }, 'back');
  });

  currentContainer.querySelector('#profile-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = e.target.elements.username.value.trim();
    const token = e.target.elements.token.value.trim();
    if (!username || !token) return;
    saveProfile({ username, token });
    withViewTransition(() => {
      state.mode = 'view';
      paint();
    }, 'forward');
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
