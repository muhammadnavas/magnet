import { create } from "zustand";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkTheme, lightTheme } from "../constants/colors";

const STORAGE_KEY = "orio_app_theme";

// --- Persistence helpers (works on Web + iOS + Android) ---
const saveTheme = async (mode) => {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    }
  } catch (_) {}
};

const loadTheme = async () => {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.localStorage.getItem(STORAGE_KEY) || "dark";
    } else {
      return (await AsyncStorage.getItem(STORAGE_KEY)) || "dark";
    }
  } catch (_) {
    return "dark";
  }
};

// Web sync read (only works on web, returns "dark" on native)
const loadThemeSync = () => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.localStorage.getItem(STORAGE_KEY) || "dark";
  }
  return "dark"; // Native will be hydrated async in initTheme()
};

const initialMode = loadThemeSync();

export const useThemeStore = create((set, get) => ({
  theme: initialMode,

  // Call this once on app launch from _layout.jsx to hydrate native theme
  initTheme: async () => {
    const saved = await loadTheme();
    if (saved !== get().theme) {
      set({ theme: saved });
    }
  },

  setTheme: (mode) => {
    saveTheme(mode);
    set({ theme: mode });
  },

  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    saveTheme(next);
    set({ theme: next });
  },
}));

// Convenience hook: returns theme + resolved color palette
export function useAppTheme() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const themeColors = theme === "light" ? lightTheme : darkTheme;
  return { theme, setTheme, toggleTheme, themeColors, isDark: theme === "dark" };
}

export default useThemeStore;
