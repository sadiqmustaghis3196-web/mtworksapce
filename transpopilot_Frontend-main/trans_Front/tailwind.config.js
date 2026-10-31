/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#020617', // slate-950
          'bg-secondary': '#0f172a', // slate-900
          card: 'rgba(15, 23, 42, 0.5)', // slate-900/50
          border: 'rgba(255, 255, 255, 0.1)', // white/10
          accent: '#2563eb', // blue-600
          'accent-hover': '#3b82f6', // blue-500
          muted: '#94a3b8', // slate-400
        }
      }
    },
  },
  plugins: [],
};
