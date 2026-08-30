import { getProfile, saveProfile } from '../profile.js';
import { escapeHtml } from '../utils.js';

let currentContainer = null;
let state = { justSaved: false };

export function render(container) {
  currentContainer = container;
  state = { justSaved: false };
  paint();
}

function paint() {
  const { username, token } = getProfile();

  currentContainer.innerHTML = `
    <div class="py-4 flex flex-col gap-4">
      <h1 class="text-2xl font-bold">Profil</h1>

      <form id="profile-form" class="flex flex-col gap-4 bg-surface rounded-lg p-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm text-white/60" for="profile-username">Username</label>
          <input
            id="profile-username"
            name="username"
            type="text"
            autocomplete="off"
            value="${escapeHtml(username)}"
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
            value="${escapeHtml(token)}"
            placeholder="Vom Server-Setup erhalten"
            class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-white min-h-[44px]"
            required
          />
        </div>

        <p class="text-xs text-white/40 leading-relaxed">
          Wird für den späteren Sync zum eigenen Server verwendet. Sync ist aktuell noch nicht aktiv – das Training-Tracking funktioniert unabhängig davon vollständig offline weiter.
        </p>

        <button type="submit" class="tap-feedback bg-accent text-bg font-bold rounded-lg py-3 min-h-[44px]">
          Speichern
        </button>

        ${state.justSaved ? '<p class="text-accent text-sm text-center">✓ Gespeichert</p>' : ''}
      </form>
    </div>
  `;

  wireEvents();
}

function wireEvents() {
  currentContainer.querySelector('#profile-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = e.target.elements.username.value.trim();
    const token = e.target.elements.token.value.trim();
    if (!username || !token) return;
    saveProfile({ username, token });
    state.justSaved = true;
    paint();
  });
}
