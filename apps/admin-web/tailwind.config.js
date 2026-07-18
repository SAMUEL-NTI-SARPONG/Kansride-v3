/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B8B4B', light: '#2EAF65', dark: '#146B39' },
        secondary: { DEFAULT: '#FFB800', light: '#FFCC40', dark: '#CC9300' },
      },
    },
  },
  plugins: [],
};
