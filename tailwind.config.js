// tailwind.config.js
const { fontFamily } = require('tailwindcss/defaultTheme');

const brand = {
  50: '#edf5ef', 100: '#dfede3', 200: '#c0ddcb', 300: '#a0cdb2',
  400: '#6daa8a', 500: '#297b5b', 600: '#165a45', 700: '#104634',
  800: '#123b2c', 900: '#142f24'
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: brand,
        primary: { ...brand, DEFAULT: brand[600], hover: brand[700], focus: brand[500] },
        slate: { 400: '#5e7367', 500: '#4e6357' },
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
        'brand': '0 8px 24px -4px rgba(22, 90, 69, 0.3)',
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
