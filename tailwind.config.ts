import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        accent: 'hsl(var(--accent-h) var(--accent-s) var(--accent-l) / <alpha-value>)',
      },
    },
  },
  plugins: [],
} satisfies Config;
