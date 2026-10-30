// tailwind.config.js
const { fontFamily } = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // ADD THIS LINE to enable dark mode
  darkMode: 'class',

  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Here we define our custom color palette
        primary: {
          DEFAULT: '#4338CA', // indigo-600
          hover: '#3730A3',   // indigo-700
          focus: '#A5B4FC',   // indigo-300
        },
        neutral: {
          100: '#F8FAFC', // slate-50  (Light BG)
          200: '#F1F5F9', // slate-100 (Light Subtle BG)
          300: '#E2E8F0', // slate-200 (Light Borders)
          400: '#94A3B8', // slate-400 (Light Secondary Text)
          500: '#475569', // slate-600 (Light Primary Text)
          600: '#1E293B', // slate-800 (Dark Cards)
          700: '#0F172A', // slate-900 (Dark BG)
          800: '#E2E8F0', // slate-200 (Dark Primary Text)
          900: '#94A3B8', // slate-400 (Dark Secondary Text)
        },
        success: {
          light: '#ECFDF5', // emerald-50
          DEFAULT: '#10B981', // emerald-500
          dark: '#D1FAE5',   // emerald-100
        },
        danger: {
          light: '#FEF2F2', // red-50
          DEFAULT: '#EF4444', // red-500
          dark: '#FEE2E2',   // red-100
        },
      },
      fontFamily: {
        // Here we add 'Inter' as the primary sans-serif font
        sans: ['Inter', ...fontFamily.sans],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwind-scrollbar'),
  ],
};