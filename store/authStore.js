import { create } from "zustand";

// Personal single-user mode: no account, password, or bearer-token lifecycle.
const personalUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "personal@magnet.local",
  full_name: "Personal User",
  is_active: true,
};

export const useAuthStore = create((set) => ({
  user: personalUser,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: true,
  isLoading: false,
  initializeAuth: async () => set({
    user: personalUser,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: true,
    isLoading: false,
  }),
  login: async () => set({ user: personalUser, isAuthenticated: true, isLoading: false }),
  logout: async () => set({ user: personalUser, isAuthenticated: true, isLoading: false }),
  updateUser: async (user) => set({ user: { ...personalUser, ...user } }),
  setTokens: async () => set({ accessToken: null, refreshToken: null }),
}));

export default useAuthStore;
