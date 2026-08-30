export const darkTheme = {
  mode: "dark",
  background: "#0A0A0F", // Deep space dark
  card: "#13131A",       // Elevation 1 card surface
  cardHover: "#1C1C28",  // Elevation 2 card surface
  surface: "#13131A",
  surfaceHover: "#1C1C28",
  border: "#242433",      // Subtle card border
  
  primary: "#6C63FF",    // Indigo violet accent
  primaryHover: "#574EED",
  primaryLight: "#8F88FF",
  
  accent: "#00D4FF",     // Cyan accent
  success: "#00E5A0",    // Emerald green
  warning: "#FF9F43",    // Orange
  error: "#FF6B6B",      // Soft red
  
  text: {
    primary: "#FFFFFF",
    secondary: "#A0A0B8",
    muted: "#80809C",
    highlight: "#00D4FF",
  },
  
  shadow: "rgba(0, 0, 0, 0.4)",
};

export const lightTheme = {
  mode: "light",
  background: "#F1F5F9", // Crisp light slate background
  card: "#FFFFFF",       // Pure white card surface
  cardHover: "#F8FAFC",  // Slightly elevated surface
  surface: "#FFFFFF",
  surfaceHover: "#F1F5F9",
  border: "#CBD5E1",      // Crisp border
  
  primary: "#6C63FF",    // Primary violet accent
  primaryHover: "#574EED",
  primaryLight: "#4F46E5",
  
  accent: "#0284C7",     // Blue accent
  success: "#059669",    // Emerald green
  warning: "#D97706",    // Orange
  error: "#DC2626",      // Soft red
  
  text: {
    primary: "#0F172A",   // Very dark navy heading text
    secondary: "#334155", // Crisp dark slate body text
    muted: "#64748B",     // Medium slate label text (high contrast)
    highlight: "#0284C7",
  },
  
  shadow: "rgba(0, 0, 0, 0.08)",
};

export const colors = darkTheme;
export default colors;
