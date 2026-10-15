import axios from "axios";
import config from "../constants/config";
import tokenStorage from "./storage";

const api = axios.create({
  baseURL: config.API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // Allow time for backend retrieval and LLM generation on slower responses.
  timeout: 90000,
});

api.interceptors.request.use(
  async (requestConfig) => {
    requestConfig.meta = { startTime: new Date().getTime() };
    try {
      const token = await tokenStorage.getToken("accessToken");
      if (token) {
        requestConfig.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error("[API REQUEST INTERCEPTOR ERROR]", e);
    }
    console.log(`[FRONTEND -> BACKEND REQ] ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`);
    return requestConfig;
  },
  (error) => {
    console.error("[FRONTEND -> BACKEND REQ ERROR]", error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    const duration = new Date().getTime() - (response.config.meta?.startTime || new Date().getTime());
    console.log(`[BACKEND -> FRONTEND RES] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response ? error.response.status : "NETWORK_ERROR";
    const detail = error.response?.data?.detail ? JSON.stringify(error.response.data.detail) : error.message;
    const duration = originalRequest?.meta?.startTime ? `${new Date().getTime() - originalRequest.meta.startTime}ms` : "N/A";

    console.error(`[BACKEND -> FRONTEND ERROR] ${status} ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url} (${duration}) - ${detail}`);

    // Do not silently retry with hardcoded credentials. Surface authentication
    // failures to the caller so the app can request a legitimate sign-in.
    return Promise.reject(error);
  }
);

export default api;


