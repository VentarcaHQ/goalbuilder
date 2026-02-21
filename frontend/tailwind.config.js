/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Structural colours — only black, white, grey in UI
        terminal: {
          bg:      "#0a0a0a",
          surface: "#111111",
          panel:   "#161616",
          border:  "#2a2a2a",
          text:    "#d4d4d4",
          muted:   "#666666",
          dim:     "#3a3a3a",
          white:   "#ffffff",
        },
        // Only used in charts and status indicators
        chart: {
          green:   "#22c55e",   // 90th percentile / success
          blue:    "#3b82f6",   // 50th percentile / neutral
          red:     "#ef4444",   // 10th percentile / warning
          amber:   "#f59e0b",   // caution
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Courier New", "monospace"],
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0" },
        },
        typewriter: {
          from: { width: "0" },
          to:   { width: "100%" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        scanline: {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
      animation: {
        blink:     "blink 1s step-end infinite",
        "fade-in": "fadeIn 0.3s ease forwards",
        scanline:  "scanline 8s linear infinite",
      },
    },
  },
  plugins: [],
};
