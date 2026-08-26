import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useAuthStore from "../store/authStore";
import api from "../lib/api";

export const useAuth = () => {
  const queryClient = useQueryClient();
  const store = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }) => {
      const response = await api.post("/auth/login", { email, password });
      return response.data;
    },
    onSuccess: (data) => {
      store.login(data.user, data.access_token, data.refresh_token);
      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
    }
  });

  const registerMutation = useMutation({
    mutationFn: async ({ email, password, full_name }) => {
      const response = await api.post("/auth/register", { email, password, full_name });
      return response.data;
    },
    onSuccess: (data) => {
      store.login(data.user, data.access_token, data.refresh_token);
      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
    }
  });

  const profileQuery = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: async () => {
      if (!store.accessToken) return null;
      const response = await api.get("/auth/me");
      return response.data;
    },
    enabled: !!store.accessToken,
  });

  const handleLogout = async () => {
    await store.logout();
    queryClient.clear();
  };

  return {
    user: store.user,
    accessToken: store.accessToken,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading || profileQuery.isFetching,
    initializeAuth: store.initializeAuth,
    
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    
    logout: handleLogout,
    profile: profileQuery.data || store.user,
    refetchProfile: profileQuery.refetch,
  };
};

export default useAuth;
