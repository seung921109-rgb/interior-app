/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f4ef",
          100: "#efe8dc",
          800: "#2c261f",
          900: "#1c1814",
        },
        clay: {
          500: "#c45c26",
          600: "#a84b1c",
        },
      },
      boxShadow: {
        tab: "0 -8px 24px rgba(28, 24, 20, 0.08)",
      },
    },
  },
  plugins: [],
}
