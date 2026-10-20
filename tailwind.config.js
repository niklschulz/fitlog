// Design-Tokens: zentrale Quelle, s. docs/design-system.md.
// Wird nur vom einmaligen CSS-Build gelesen (`npm run build:css`, s. ADR 0030) -
// die App selbst lädt nur das fertig erzeugte css/tailwind.css.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js', '!./js/vendor/**'],
  theme: {
    extend: {
      colors: {
        base: '#121212',
        surface: '#252525',
        raised: '#2A2A2A',
        highlight: '#404040',
        accent: '#B5EB98',
        'accent-muted': '#637456',
        divider: '#1A1A1A',
        ink: '#F5F5F5',
        muted: '#9B9BA1',
      },
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
};
