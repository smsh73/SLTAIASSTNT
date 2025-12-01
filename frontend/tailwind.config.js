/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6eef5',
          100: '#ccdce9',
          200: '#99b9d4',
          300: '#6696bf',
          400: '#3373aa',
          500: '#005095',
          600: '#003d73',
          700: '#003366',
          800: '#002952',
          900: '#001f3d',
        },
      },
    },
  },
  plugins: [],
}

