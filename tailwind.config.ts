/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,md,ts,vue}'],
  theme: {
    extend: {
      fontFamily: {
        Header: ['Kanit'],
        Secondary: ['Jost'],
      },
      colors: {
        background: {
          background: 'var(--background)',
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
      },
    },
  },
  plugins: [],
};
