import useAuthStore from "../store/authStore";

// Compatibility hook for screens that display the single personal profile.
// Magnet intentionally has no login, registration, or token-management flow.
export const useAuth = () => {
  const store = useAuthStore();
  return {
    user: store.user,
    accessToken: null,
    isAuthenticated: true,
    isLoading: false,
    initializeAuth: store.initializeAuth,
    logout: async () => {},
    profile: store.user,
    refetchProfile: async () => ({ data: store.user }),
  };
};

export default useAuth;
