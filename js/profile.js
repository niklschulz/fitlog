// Geräte-lokale Profil-Konfiguration (Username + Sync-Token) für den späteren
// Sync (s. ADR 0006) – bewusst in localStorage statt Dexie, da reine
// Geräte-Konfiguration und keine Trainingsdaten.
const STORAGE_KEY = 'fitlog:profile';

export function getProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { username: '', token: '' };
  } catch {
    return { username: '', token: '' };
  }
}

export function saveProfile({ username, token }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ username, token }));
}
