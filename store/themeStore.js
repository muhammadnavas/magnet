import { create } from "zustand";
import { darkTheme, lightTheme } from "../constants/colors";
import { Platform } from "react-native";

const STORAGE_KEY = "orio_app_theme";

const getInitialTheme = () => {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  }
  return "dark";
};

const initialMode = getInitialTheme();
const initialColors = initialMode === "light" ? lightTheme : darkTheme;

const useThemeStore = create((set, get) => ({
  theme: initialMode,
  colors: initialColors,

  setTheme: (mode) => {
    const activeColors = mode === "light" ? lightTheme : darkTheme;
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
    set({ theme: mode, colors: activeColors });
  },

  toggleTheme: () => {
    const current = get().theme;
    const nextMode = current === "dark" ? "light" : "dark";
    const activeColors = nextMode === "light" ? lightTheme : darkTheme;
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    }
    set({ theme: nextMode, colors: activeColors });
  },
}));

export default useThemeStore;
