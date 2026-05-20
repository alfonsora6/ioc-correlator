/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f3ff",
<<<<<<< HEAD
          100: "#ede9fe",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        glow: "0 0 40px rgba(124, 58, 237, 0.15)",
      },
=======
          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
        },
      },
      backdropBlur: {
        xs: "2px",
      },
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
    },
  },
  plugins: [],
};
