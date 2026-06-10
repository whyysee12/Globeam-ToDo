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
          50: '#f4f6fc',
          100: '#e6ebf7',
          200: '#cbd5ef',
          300: '#a1b4e2',
          400: '#718ad2',
          500: '#4a65c2',
          600: '#384aa9',
          700: '#2f3b89',
          800: '#293370',
          900: '#252e5a',
          950: '#171c37',
        },
        accent: {
          500: '#10b981', // emerald-500
          600: '#059669',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
