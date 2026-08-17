/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'brand-forest-950': 'var(--brand-forest-950)',
        'brand-forest-900': 'var(--brand-forest-900)',
        'brand-forest-800': 'var(--brand-forest-800)',
        'brand-forest-700': 'var(--brand-forest-700)',
        'brand-forest-500': 'var(--brand-forest-500)',
        'brand-paper-50': 'var(--brand-paper-50)',
        'brand-paper-100': 'var(--brand-paper-100)',
        'brand-paper-200': 'var(--brand-paper-200)',
        'brand-paper-300': 'var(--brand-paper-300)',
        'brand-paper-400': 'var(--brand-paper-400)',
        'brand-terracotta-700': 'var(--brand-terracotta-700)',
        'brand-terracotta-600': 'var(--brand-terracotta-600)',
        'brand-terracotta-500': 'var(--brand-terracotta-500)',
        'brand-terracotta-200': 'var(--brand-terracotta-200)',
        'brand-brass-700': 'var(--brand-brass-700)',
        'brand-brass-500': 'var(--brand-brass-500)',
        'brand-canvas': 'var(--brand-canvas)',
        'brand-surface': 'var(--brand-surface)',
        'brand-surface-soft': 'var(--brand-surface-soft)',
        'brand-ink': 'var(--brand-ink)',
        'brand-ink-strong': 'var(--brand-ink-strong)',
        'brand-ink-muted': 'var(--brand-ink-muted)',
        'brand-action': 'var(--brand-action)',
        'brand-action-strong': 'var(--brand-action-strong)',
        'brand-success': 'var(--brand-success)',
        'brand-warning': 'var(--brand-warning)',
        'brand-danger': 'var(--brand-danger)',
        'brand-border': 'var(--brand-border)',
        'brand-border-subtle': 'var(--brand-border-subtle)',
      },
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
