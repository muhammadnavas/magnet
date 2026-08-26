import axios from "axios";
import config from "../constants/config";
import tokenStorage from "./storage";

const api = axios.create({
  baseURL: config.API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

api.interceptors.request.use(
  async (requestConfig) => {
    try {
      const token = await tokenStorage.getToken("accessToken");
      if (token) {
        requestConfig.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error("API request interceptor token fetch failed:", e);
    }
    return requestConfig;
  },
  (error) => Promise.reject(error)
);

export default api;
