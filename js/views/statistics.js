// Statistik-Tab (Bottom-Nav) - ersetzt seit ADR 0018 den bisherigen
// Übungen-Tab. Aktuell reiner Platzhalter ohne eigenen Zustand, daher kein
// unmount() nötig (s. Kommentar zu showView() in app.js) - Inhalt folgt
// als eigener, späterer Schritt.
export function render(container) {
  container.innerHTML = `
    <div class="py-4 flex flex-col gap-4">
      <h1 class="text-screen-title">Statistik</h1>
      <p class="text-body text-muted text-center py-12">Statistik folgt.</p>
    </div>
  `;
}
