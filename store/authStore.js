import { create } from "zustand";
import { tokenStorage } from "../lib/storage";

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  initializeAuth: async () => {
    try {
      const accessToken = await tokenStorage.getToken("accessToken");
      const refreshToken = await tokenStorage.getToken("refreshToken");
      const userJson = await tokenStorage.getToken("user");

      if (accessToken && refreshToken && userJson) {
        set({
          user: JSON.parse(userJson),
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      console.error("Failed to initialize auth store", e);
      set({ isLoading: false });
    }
  },

  login: async (user, accessToken, refreshToken) => {
    try {
      await tokenStorage.setToken("accessToken", accessToken);
      await tokenStorage.setToken("refreshToken", refreshToken);
      await tokenStorage.setToken("user", JSON.stringify(user));
      
      set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (e) {
      console.error("Login save token failed", e);
    }
  },

  logout: async () => {
    try {
      await tokenStorage.removeToken("accessToken");
      await tokenStorage.removeToken("refreshToken");
      await tokenStorage.removeToken("user");
      
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (e) {
      console.error("Logout remove token failed", e);
    }
  },

  updateUser: async (user) => {
    try {
      await tokenStorage.setToken("user", JSON.stringify(user));
      set({ user });
    } catch (e) {
      console.error("Failed to update user profile in storage", e);
    }
  },

  setTokens: async (accessToken, refreshToken) => {
    try {
      await tokenStorage.setToken("accessToken", accessToken);
      await tokenStorage.setToken("refreshToken", refreshToken);
      set({ accessToken, refreshToken });
    } catch (e) {
      console.error("Failed to update tokens", e);
    }
  }
}));

export default useAuthStore;
