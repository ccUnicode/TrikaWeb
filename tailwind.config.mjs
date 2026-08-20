// tailwind.config.mjs
import { defineConfig } from "tailwindcss";

export default defineConfig({
  darkMode: 'class', // Enable dark mode with class strategy
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
          // Tokens heredados (superficies y bordes)
          bg: "#101010",
          surface: "#171A1F",
          card: "#1E2430",
          border: "#2A3240",
          "border-subtle": "#1E1E1E",
          text: "#E6E9EF",
          "text-muted": "#B4BDC9",

          // --- NUEVOS COLORES SEMÁNTICOS (UI Kit) ---
          primary: {
            DEFAULT: "#22C55E",
            hover: "#51A624",
            soft: "rgba(34, 197, 94, 0.1)", // bg-green-500/10 equivalent
          },
          danger: {
            DEFAULT: "#EF4444", // red-500
            hover: "#DC2626",   // red-600
            text: "#F87171",    // red-400
            soft: "rgba(239, 68, 68, 0.1)",
          },
          success: {
            DEFAULT: "#10B981", // emerald-500
            text: "#6EE7B7",    // emerald-300
            soft: "rgba(16, 185, 129, 0.1)",
          },
          warning: {
            DEFAULT: "#F59E0B", // amber-500
            text: "#FCD34D",    // amber-300
            soft: "rgba(245, 158, 11, 0.1)",
          },
          info: {
            DEFAULT: "#3B82F6", // blue-500
            text: "#60A5FA",    // blue-400
            soft: "rgba(59, 130, 246, 0.1)",
          }
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
