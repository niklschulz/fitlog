import { getQuoteOfTheDay } from '../quotes.js';
import { escapeHtml } from '../utils.js';

export function render(container) {
  const quote = getQuoteOfTheDay();
  container.innerHTML = `
    <div class="min-h-[65vh] flex items-center justify-center px-6 py-16">
      <p class="font-display text-3xl leading-snug text-center">${escapeHtml(quote)}</p>
    </div>
  `;
}
