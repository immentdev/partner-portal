import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        trust: {
          DEFAULT: "#5195FF",
          dark: "#0E2D54",
        },
        equity: "#D30083",
        signal: "#05D8C8",
      },
      fontFamily: {
        sans: ["var(--font-inter-tight)", "sans-serif"],
        display: ["var(--font-syne)", "sans-serif"],
      },
      borderRadius: {
        card: "8px",
        control: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
