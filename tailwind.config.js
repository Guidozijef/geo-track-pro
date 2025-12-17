/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tech: {
          bg: '#0f172a',
          panel: 'rgba(30, 41, 59, 0.85)',
          blue: '#3b82f6',
          glow: '#60a5fa',
          alert: '#ef4444',
          text: '#f1f5f9'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-alert': 'pulse-red 1.5s infinite',
      },
      keyframes: {
        'pulse-red': {
          '0%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)' },
          '70%': { boxShadow: '0 0 0 10px rgba(239, 68, 68, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
        }
      }
    },
  },
  plugins: [],
}