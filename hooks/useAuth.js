import { useMutation, useQuery } from "@tanstack/react-query";
import useAuthStore from "../store/authStore";
import api from "../lib/api";

export const useAuth = () => {
  const { user, accessToken, isAuthenticated, isLoading, login, logout, initializeAuth } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }) => {
      // Mock login for offline/scaffold testing if API is unreachable
      try {
        const response = await api.post("/auth/login", { email, password });
        return response.data;
      } catch (err) {
        if (!err.response) {
          // Dev mock fallback if server is not running
          console.warn("Backend server offline, logging in with mock credentials");
          return {
            user: { id: "1", email, full_name: "Navas" },
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
          };
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      login(data.user, data.access_token, data.refresh_token);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ name, email, password }) => {
      try {
        const response = await api.post("/auth/register", {
          full_name: name,
          email,
          password,
        });
        return response.data;
      } catch (err) {
        if (!err.response) {
          console.warn("Backend server offline, registering with mock credentials");
          return {
            user: { id: "1", email, full_name: name },
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
          };
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      login(data.user, data.access_token, data.refresh_token);
    },
  });

  const fetchProfileQuery = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: async () => {
      const response = await api.get("/auth/me");
      return response.data;
    },
    enabled: isAuthenticated,
  });

  return {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    initializeAuth,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    logout,
    profile: fetchProfileQuery.data,
    refetchProfile: fetchProfileQuery.refetch,
  };
};

export default useAuth;
