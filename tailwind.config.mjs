// tailwind.config.mjs
import { defineConfig } from "tailwindcss";

export default defineConfig({
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,vue}"],
  // Force-generate key utilities for our theme tokens in case the scanner misses them
  safelist: [
    // Base palette
    "bg-global-bg",
    "text-global-text",
    "bg-global-surface",
    "bg-global-card",
    "border-global-border",
    // Brand accents
    "text-global-primary",
    "text-global-primary-hover",
    // Common variants used in nav/tabs
    "hover:bg-global-surface",
    "hover:text-global-primary-hover",
  ],

  theme: {
    extend: {
      colors: {
        global: {
          primary: "#22C55E",
          "primary-hover": "#51A624",
          bg: "#101010",
          surface: "#171A1F",
          card: "#1E2430",
          border: "#2A3240",
          "border-subtle": "#1E1E1E", // Custom subtle border color
          text: "#E6E9EF",
          "text-muted": "#B4BDC9", // Increased opacity for better readability
        },
      },
      maxWidth: {
        prose: "65ch", // For readable line lengths in bios/descriptions
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        h1: ["40px", { lineHeight: "48px", fontWeight: "700" }],
        h2: ["32px", { lineHeight: "40px", fontWeight: "600" }],
        h3: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "24px", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "16px", fontWeight: "400" }],
        button: ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "card-title": ["16px", { lineHeight: "22px", fontWeight: "600" }],
        tab: ["20px", { lineHeight: "28px", fontWeight: "500" }],
        "section-title": ["28px", { lineHeight: "36px", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
});
