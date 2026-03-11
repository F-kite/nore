/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        'nore-base': 'var(--nore-base)',
        'nore-surface': 'var(--nore-surface)',
        'nore-elevated': 'var(--nore-elevated)',
        'nore-text-primary': 'var(--nore-text-primary)',
        'nore-text-secondary': 'var(--nore-text-secondary)',
        'nore-text-tertiary': 'var(--nore-text-tertiary)',
        'nore-border': 'var(--nore-border)',
        'nore-border-hover': 'var(--nore-border-hover)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', 'monospace'],
      },
    },
  },
  plugins: [],
}
