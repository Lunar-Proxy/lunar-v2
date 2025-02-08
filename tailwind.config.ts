/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,md,ts,vue}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'var(--background)',
          overlay: 'var(--background-overlay)',
        },
        text: {
          HEADER: 'var(--text-header)',
          SECONDARY: 'var(--text-secondary)',
        },
      },
      keyframes: {
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        spin: 'spin 1s linear 1',
      },
    },
  },
  plugins: [],
};
