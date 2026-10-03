import { MUSCLES } from './db.js';
import { escapeHtml } from './utils.js';

// Übungs-Infos (primäre/sekundäre Muskeln) - EINE Quelle für das
// Übungs-Detail-Sheet im Workout-Tab (js/views/workout.js) und den
// Info-Reiter der Statistik-Übungs-Seite
// (js/views/statistics-exercise-detail.js). Änderungen hier wirken in beiden.
// Muskelgruppen als reine Anzeige-Chips (nicht antippbar, `text-ink` auf
// `bg-white/[0.08]` wie die unausgewählten Chips im Neue-Übung-Sheet).
// Übungen ohne Zuordnung (ältere, vor ADR 0013 angelegte) zeigen "Nicht
// zugeordnet" statt einer leeren Fläche. `primaryMuscleIds`/
// `secondaryMuscleIds` können bei solchen älteren Übungen fehlen
// (`undefined`), daher `?? []`. Seit ADR 0022 kann `primaryMuscleIds` auch
// mehrere Einträge haben - Anzeige analog zu den sekundären Muskeln (mehrere
// Chips statt genau einem).
export function renderExerciseInfo(exercise) {
  if (!exercise) return '';
  const muscleName = (id) => MUSCLES.find((m) => m.id === id)?.name;
  const chip = (id) =>
    `<span class="rounded-full px-3 py-1 text-body bg-white/[0.08] text-ink">${escapeHtml(muscleName(id) ?? id)}</span>`;
  const none = `<span class="text-body text-muted">Nicht zugeordnet</span>`;
  const primary = exercise.primaryMuscleIds ?? [];
  const secondary = exercise.secondaryMuscleIds ?? [];

  return `
    <div class="flex flex-col gap-6 py-1">
      <div class="flex flex-col gap-2">
        <span class="text-label-large text-muted">Primäre Muskeln</span>
        <div class="flex flex-wrap gap-2">${primary.length > 0 ? primary.map(chip).join('') : none}</div>
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-label-large text-muted">Sekundäre Muskeln</span>
        <div class="flex flex-wrap gap-2">${secondary.length > 0 ? secondary.map(chip).join('') : none}</div>
      </div>
    </div>
  `;
}
