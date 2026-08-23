import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Secure storage helper functions for saving and loading sensitive data like auth tokens
export const tokenStorage = {
  async setToken(key, value) {
    try {
      if (Platform.OS === "web") {
        localStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
      return true;
    } catch (e) {
      console.error("Error setting token:", e);
      return false;
    }
  },

  async getToken(key) {
    try {
      if (Platform.OS === "web") {
        return localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.error("Error getting token:", e);
      return null;
    }
  },

  async removeToken(key) {
    try {
      if (Platform.OS === "web") {
        localStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
      return true;
    } catch (e) {
      console.error("Error removing token:", e);
      return false;
    }
  },
};

export default tokenStorage;
