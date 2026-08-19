/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#075E59', light: '#148078', dark: '#03423F' },
        secondary: { DEFAULT: '#E6A84B', light: '#F2C675', dark: '#A56B16' },
      },
      boxShadow: {
        panel: '0 16px 40px rgba(45, 55, 47, 0.08)',
        control: '0 8px 20px rgba(7, 94, 89, 0.12)',
      },
    },
  },
  plugins: [],
};
