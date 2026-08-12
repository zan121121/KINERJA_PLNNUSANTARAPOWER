/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.ejs"],
  theme: {
    extend: {
      colors: {
        'brand-blue': '#00CCFF',
        'brand-yellow': '#FFFF00',
        'brand-navy': '#0B1E3F',
        'brand-navy-light': '#132C55',
      },
    },
  },
  plugins: [],
}