/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Fantasy D&D inspired color scheme matching arandor.info
        primary: {
          50: '#faf5f5',
          100: '#f4e8e8',
          200: '#ead5d5',
          300: '#d9b4b4',
          400: '#c38888',
          500: '#a85e5e',
          600: '#8b4545',
          700: '#723636',
          800: '#5f2f2f',
          900: '#522b2b',
          950: '#2d1414',
          DEFAULT: '#8b4545', // Burgundy/Maroon
          dark: '#5f2f2f',
        },
        secondary: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
          DEFAULT: '#d97706', // Gold/Amber
          dark: '#92400e',
        },
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
          DEFAULT: '#475569', // Slate
          dark: '#1e293b',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
