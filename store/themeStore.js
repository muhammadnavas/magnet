import { create } from "zustand";
import colors, { darkTheme, lightTheme } from "../constants/colors";

const useThemeStore = create((set, get) => ({
  theme: "dark", // "dark" | "light"
  colors: darkTheme,

  setTheme: (mode) => {
    const activeColors = mode === "light" ? lightTheme : darkTheme;
    set({ theme: mode, colors: activeColors });
  },

  toggleTheme: () => {
    const current = get().theme;
    const nextMode = current === "dark" ? "light" : "dark";
    const activeColors = nextMode === "light" ? lightTheme : darkTheme;
    set({ theme: nextMode, colors: activeColors });
  },
}));

export default useThemeStore;
