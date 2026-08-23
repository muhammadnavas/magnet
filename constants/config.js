import { Platform } from "react-native";

// Configuration settings for mobile application
export const config = {
  APP_NAME: "Orio",
  
  // Use localhost for iOS simulator, and 10.0.2.2 for Android emulator
  API_URL: Platform.select({
    android: "http://10.0.2.2:8000/api/v1",
    ios: "http://localhost:8000/api/v1",
    default: "http://localhost:8000/api/v1",
  }),
  
  PAGINATION_LIMIT: 20,
  
  SUPPORTED_PROVIDERS: [
    { label: "OpenAI (GPT-4o)", value: "openai" },
    { label: "Ollama (Local Models)", value: "ollama" },
    { label: "Anthropic (Claude)", value: "anthropic" },
  ],
};

export default config;
