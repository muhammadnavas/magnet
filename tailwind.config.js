/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0A0A0F",
        surface: {
          DEFAULT: "#13131A",
          hover: "#1C1C28",
        },
        primary: {
          DEFAULT: "#6C63FF",
          dark: "#574EED",
          light: "#8F88FF",
        },
        accent: "#00D4FF",
        success: "#00E5A0",
        warning: "#FF9F43",
        error: "#FF6B6B",
        text: {
          primary: "#FFFFFF",
          secondary: "#A0A0B8",
          muted: "#60607A",
        }
      }
    },
  },
  plugins: [],
};
