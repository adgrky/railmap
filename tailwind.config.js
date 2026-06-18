/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // SPEC §6 デザイントークン
        bg: "#0b0e14",
        surface: "#151a23",
        "surface-2": "#1e2530",
        text: "#e8ecf4",
        "text-dim": "#8b93a3",
        "line-unvisited": "#3a3f4a",
        "accent-blue": "#38bdf8",
        "accent-green": "#34d399",
        "accent-pink": "#f472b6",
        gold: "#fbbf24",
        danger: "#f87171",
      },
      borderRadius: { token: "14px" },
    },
  },
  plugins: [],
};
