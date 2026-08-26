import { Platform } from "react-native";

// Configuration settings for mobile application
export const config = {
  APP_NAME: "Orio",
  
  // Loads backend base URL dynamically from the EXPO_PUBLIC_API_URL environment variable
  API_URL: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  
  PAGINATION_LIMIT: 20,
  
  SUPPORTED_PROVIDERS: [
    { label: "OpenAI (GPT-4o)", value: "openai" },
    { label: "Ollama (Local Models)", value: "ollama" },
    { label: "Anthropic (Claude)", value: "anthropic" },
  ],
};

export default config;
