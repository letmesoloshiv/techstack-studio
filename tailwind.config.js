/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        flow: {
          '0%': { strokeDashoffset: '40' },
          '100%': { strokeDashoffset: '0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(0,-6px,0)' },
        },
        sheen: {
          '0%': { transform: 'translateX(-110%)' },
          '60%, 100%': { transform: 'translateX(110%)' },
        },
        spinSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        flow: 'flow 1.6s linear infinite',
        pulseSoft: 'pulseSoft 3s ease-in-out infinite',
        drift: 'drift 6s ease-in-out infinite',
        sheen: 'sheen 4.5s ease-in-out infinite',
        spinSlow: 'spinSlow 24s linear infinite',
      },
    },
  },
  plugins: [],
};
