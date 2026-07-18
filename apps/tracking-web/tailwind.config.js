/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B8B4B', light: '#2EAF65', dark: '#146B39' },
      },
    },
  },
  plugins: [],
};
