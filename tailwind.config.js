// Design-Tokens: zentrale Quelle, s. docs/design-system.md.
// Wird nur vom einmaligen CSS-Build gelesen (`npm run build:css`, s. ADR 0030) -
// die App selbst lädt nur das fertig erzeugte css/tailwind.css.
const plugin = require('tailwindcss/plugin');

// Einzige Farbliste der App. Neben den Tailwind-Klassen (`bg-accent` usw.) erzeugt das Plugin unten
// daraus CSS-Variablen, damit css/styles.css und JS keine eigenen Hex-Kopien brauchen.
const colors = {
  base: '#121212',
  surface: '#252525',
  raised: '#2A2A2A',
  highlight: '#404040',
  popup: '#363636', // rgba(255,255,255,0.08) über surface, deckend (Dropdown-Popups über Listen)
  accent: '#B5EB98',
  'accent-soft': '#E5F3DE', // Mischung aus ink und accent (Icon/Text auf Glas-Akzent-Buttons)
  'accent-muted': '#637456',
  divider: '#1A1A1A',
  ink: '#F5F5F5',
  muted: '#9B9BA1',
};

// Pro Farbe `--color-<name>: #hex` (z. B. für JS: `var(--color-highlight)`) und
// `--rgb-<name>: r g b` (für Transparenz in CSS: `rgb(var(--rgb-surface) / 0.55)`).
const colorVariables = plugin(({ addBase }) => {
  const vars = {};
  for (const [name, hex] of Object.entries(colors)) {
    vars[`--color-${name}`] = hex;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    vars[`--rgb-${name}`] = `${r} ${g} ${b}`;
  }
  addBase({ ':root': vars });
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js', '!./js/vendor/**'],
  theme: {
    extend: {
      colors,
      borderRadius: {
        card: '4px',
        btn: '4px',
        sheet: '26px',
        badge: '11px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        kpi: ['21px', { lineHeight: '1.2', fontWeight: '700' }],
        'screen-title': ['21px', { lineHeight: '1.2', fontWeight: '700' }],
        'card-title': ['16px', { lineHeight: '1.3', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.2', fontWeight: '400' }],
        label: ['11.5px', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '0.6px' }],
        'label-large': ['14px', { lineHeight: '1.3', fontWeight: '700' }],
      },
    },
  },
  plugins: [colorVariables],
};
