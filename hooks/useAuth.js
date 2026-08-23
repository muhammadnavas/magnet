import { useMutation, useQuery } from "@tanstack/react-query";
import useAuthStore from "../store/authStore";
import api from "../lib/api";

export const useAuth = () => {
  const mockUser = {
    id: "system-id",
    email: "personal-app@orio.local",
    full_name: "Navas"
  };

  return {
    user: mockUser,
    accessToken: "mock-access-token",
    isAuthenticated: true,
    isLoading: false,
    initializeAuth: async () => {},
    login: () => {},
    isLoggingIn: false,
    loginError: null,
    register: () => {},
    isRegistering: false,
    registerError: null,
    logout: async () => {},
    profile: mockUser,
    refetchProfile: async () => {},
  };
};

export default useAuth;
