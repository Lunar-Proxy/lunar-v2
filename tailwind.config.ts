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
          default: 'var(--bg-default)',
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
