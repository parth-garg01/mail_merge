/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/src/**/*.{js,jsx}',
    './src/renderer/index.html'
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#172033'
        }
      }
    }
  },
  plugins: []
}
