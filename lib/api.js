import axios from "axios";
import config from "../constants/config";

const api = axios.create({
  baseURL: config.API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

export default api;
