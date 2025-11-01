/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",              // Vite entry point
    "./src/**/*.{js,ts,jsx,tsx}" // All source files
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb", // Tailwind blue-600
        secondary: "#9333ea", // Tailwind purple-600
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
