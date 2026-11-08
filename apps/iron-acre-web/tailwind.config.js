/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./layouts/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        "ia-bg": "#141a15",
        "ia-bg-alt": "#1b231c",

        "ia-text": "#e8eae2",
        "ia-muted": "#a3ad9f",

        "ia-primary": "#cc5500",
        "ia-primary-hover": "#db6712",

        "ia-border": "#2e3a2f",
        "ia-sage": "#8fa58a",
      },

      fontFamily: {
        display: [
          "Big Shoulders Display",
          "sans-serif",
        ],

        body: [
          "Figtree",
          "sans-serif",
        ],
      },

      maxWidth: {
        "ia-container": "1120px",
      },
    },
  },

  plugins: [],
};
