import { fontFamily } from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#061A33",
          50: "#eef2f7",
          100: "#d5dde8",
          200: "#aabac9",
          300: "#7f96ad",
          400: "#547191",
          500: "#3a5774",
          600: "#2a4058",
          700: "#1a2d42",
          800: "#0d2138",
          900: "#061A33",
          950: "#030d1a",
        },
        gold: {
          DEFAULT: "#F2B51D",
          light: "#FFC845",
          dark: "#D99E0E",
          50: "#fef9e9",
          100: "#fdefb8",
          200: "#fbe08a",
          300: "#f9d15c",
          400: "#F2B51D",
          500: "#d99e0e",
          600: "#b07c0a",
          700: "#875e08",
        },
        cream: "#F7F8FA",
      },
      fontFamily: {
        sans: ["Inter", ...fontFamily.sans],
        display: ["Montserrat", ...fontFamily.sans],
      },
      maxWidth: {
        container: "1280px",
      },
    },
  },
};
