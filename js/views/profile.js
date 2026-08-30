import { getProfile, saveProfile, clearProfile } from '../profile.js';
import { escapeHtml } from '../utils.js';

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
      <h1 class="text-2xl font-bold">Profil</h1>
      ${body}
    </div>
  `;

  wireEvents();
}

function renderView(profile) {
  return `
    <div class="bg-surface rounded-lg p-4 flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-sm text-white/60">Angemeldet als</span>
        <span class="font-semibold text-lg">${escapeHtml(profile.username)}</span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-sm text-white/60">Token</span>
        <span class="font-mono text-sm break-all">${escapeHtml(profile.token)}</span>
      </div>
    </div>

    <p class="text-xs text-white/40 leading-relaxed">
      Wird für den späteren Sync zum eigenen Server verwendet. Sync ist aktuell noch nicht aktiv – das Training-Tracking funktioniert unabhängig davon vollständig offline weiter.
    </p>

    <button id="remove-profile-btn" class="tap-feedback bg-red-600 text-white font-bold rounded-lg py-3 min-h-[44px]">
      Profil entfernen
    </button>
  `;
}

function renderEmpty() {
  return `
    <p class="text-white/60 text-center py-8">Noch kein Profil hinterlegt.</p>
    <button id="add-profile-btn" class="tap-feedback bg-accent text-bg font-bold rounded-lg py-3 min-h-[44px]">
      Profil hinzufügen
    </button>
  `;
}

function renderForm() {
  return `
    <form id="profile-form" class="flex flex-col gap-4 bg-surface rounded-lg p-4">
      <div class="flex flex-col gap-1">
        <label class="text-sm text-white/60" for="profile-username">Username</label>
        <input
          id="profile-username"
          name="username"
          type="text"
          autocomplete="off"
          placeholder="z. B. Niklas"
          class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-white min-h-[44px]"
          required
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm text-white/60" for="profile-token">Token</label>
        <input
          id="profile-token"
          name="token"
          type="text"
          autocomplete="off"
          placeholder="Vom Server-Setup erhalten"
          class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-white min-h-[44px]"
          required
        />
      </div>

      <p class="text-xs text-white/40 leading-relaxed">
        Wird für den späteren Sync zum eigenen Server verwendet. Sync ist aktuell noch nicht aktiv – das Training-Tracking funktioniert unabhängig davon vollständig offline weiter.
      </p>

      <div class="flex gap-3">
        <button type="submit" class="tap-feedback flex-1 bg-accent text-bg font-bold rounded-lg py-3 min-h-[44px]">
          Speichern
        </button>
        <button type="button" id="cancel-profile-btn" class="tap-feedback px-4 py-3 text-white/60 min-h-[44px]">
          Abbrechen
        </button>
      </div>
    </form>
  `;
}

function wireEvents() {
  currentContainer.querySelector('#add-profile-btn')?.addEventListener('click', () => {
    state.mode = 'form';
    paint();
  });

  currentContainer.querySelector('#cancel-profile-btn')?.addEventListener('click', () => {
    state.mode = 'empty';
    paint();
  });

  currentContainer.querySelector('#profile-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = e.target.elements.username.value.trim();
    const token = e.target.elements.token.value.trim();
    if (!username || !token) return;
    saveProfile({ username, token });
    state.mode = 'view';
    paint();
  });

  currentContainer.querySelector('#remove-profile-btn')?.addEventListener('click', () => {
    clearProfile();
    state.mode = 'empty';
    paint();
  });
}
