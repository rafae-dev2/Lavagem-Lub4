/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#1a7a2e',
          'green-light': '#2ea84a',
          yellow: '#f5c518',
          'yellow-dark': '#d4a017',
          red: '#c0392b',
        }
      }
    },
  },
  plugins: [],
}
