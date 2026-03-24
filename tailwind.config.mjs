import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'xs': '480px',
      },
      colors: {
        // Warm obsidian/charcoal — replacing burgundy
        primary: {
          50: '#f8f7f4',
          100: '#ede9e1',
          200: '#d8d0c4',
          300: '#bcaf9f',
          400: '#9d8c7a',
          500: '#857263',
          600: '#6e5d4f',
          700: '#5a4d44',
          800: '#3f3530',
          900: '#2d2420',
          950: '#1c1511',
          DEFAULT: '#5a4d44',
          dark: '#3f3530',
        },
        // True orange — replacing gold/amber
        secondary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
          DEFAULT: '#ea580c',
          dark: '#9a3412',
        },
        // Neutral slate — unchanged
        accent: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
          DEFAULT: '#475569',
          dark: '#1e293b',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
}
