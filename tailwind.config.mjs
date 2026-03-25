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
        // Warm amber/gold — headings glow golden in dark mode
        primary: {
          50: '#faf7f0',
          100: '#f4ead6',
          200: '#e8d0a0',
          300: '#d9af60',
          400: '#c99032',  // dark mode heading — warm gold
          500: '#ae7220',
          600: '#8d5a18',
          700: '#6e4514',  // light mode heading — warm dark brown
          800: '#4e3010',
          900: '#321e08',
          950: '#190f03',
          DEFAULT: '#6e4514',
          dark: '#4e3010',
        },
        // True orange — primary accent
        secondary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',  // ember orange
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
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
}
