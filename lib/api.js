import axios from "axios";
import config from "../constants/config";
import { tokenStorage } from "./storage";
import { useAuthStore } from "../store/authStore";

const api = axios.create({
  baseURL: config.API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request Interceptor: Attach access token
api.interceptors.request.use(
  async (reqConfig) => {
    const accessToken = await tokenStorage.getToken("accessToken");
    if (accessToken && reqConfig.headers) {
      reqConfig.headers.Authorization = `Bearer ${accessToken}`;
    }
    return reqConfig;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Prevent infinite loops and refresh tokens failing
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/auth/login") &&
      !originalRequest.url.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;
      try {
        const refreshToken = await tokenStorage.getToken("refreshToken");
        if (!refreshToken) {
          // No refresh token available, force logout
          useAuthStore.getState().logout();
          return Promise.reject(error);
        }

        // Call backend token refresh endpoint
        const response = await axios.post(`${config.API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = response.data;
        
        // Save new tokens
        await useAuthStore.getState().setTokens(access_token, refresh_token);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Auto refresh token failed, logging out...", refreshError);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
