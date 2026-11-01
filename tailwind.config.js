// tailwind.config.js
const { fontFamily } = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          DEFAULT: '#4f46e5',
          hover: '#4338ca',
          focus: '#818cf8',
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
          light: '#ECFDF5',
          DEFAULT: '#10B981',
          dark: '#D1FAE5',
        },
        danger: {
          light: '#FEF2F2',
          DEFAULT: '#EF4444',
          dark: '#FEE2E2',
        },
      },
      fontFamily: {
        sans: ['Inter', '"DM Sans"', ...fontFamily.sans],
        display: ['"Plus Jakarta Sans"', 'Manrope', 'Inter', ...fontFamily.sans],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card': '0 2px 8px -2px rgba(15, 23, 42, 0.06), 0 1px 3px -1px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 12px 28px -6px rgba(15, 23, 42, 0.1), 0 4px 10px -2px rgba(15, 23, 42, 0.04)',
        'popover': '0 20px 40px -8px rgba(15, 23, 42, 0.12), 0 6px 14px -3px rgba(15, 23, 42, 0.06)',
        'brand': '0 8px 24px -4px rgba(79, 70, 229, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-down': 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwind-scrollbar'),
  ],
};
