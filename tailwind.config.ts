import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0e14",
        paper: "#f7f7f5",
        talent: {
          DEFAULT: "#6d5efc",
          soft: "#efedff",
        },
        scout: {
          DEFAULT: "#0f9d76",
          soft: "#e7f8f1",
        },
        radar: {
          DEFAULT: "#e8622c",
          soft: "#fdece2",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,15,15,0.04), 0 8px 24px -12px rgba(15,15,15,0.12)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
