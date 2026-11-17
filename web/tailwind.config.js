/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Ubuntu', 'sans-serif'],
      },
      colors: {
        tinta: {
          DEFAULT: '#1c2b36',
          suave: '#5b6b77',
          clara: '#8a98a3',
        },
        papel: '#fbfaf7',
        linha: '#e3e0d8',
        /** Cor da grelha e dos destaques no mapa */
        destaque: {
          DEFAULT: '#c2410c',
          claro: '#fed7aa',
        },
      },
    },
  },
  plugins: [],
};
