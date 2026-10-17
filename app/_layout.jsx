import React, { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import useAuthStore from "../store/authStore";
import useThemeStore from "../store/themeStore";
import "../global.css";
import { registerClassroomBackgroundSync } from "../lib/classroomBackgroundSync";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const OrioDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#0A0A0F",
    card: "#13131A",
    border: "#242433",
  },
};

function AuthGuard() {
  return <Slot />;
}

export default function RootLayout() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const initTheme = useThemeStore((state) => state.initTheme);
  const router = useRouter();

  useEffect(() => {
    initializeAuth();
    initTheme(); // Restore saved theme from AsyncStorage (mobile) or localStorage (web)
    // Importing the module defines the task at startup; registration lets the OS
    // poll for new Classroom assignments when the app is backgrounded or closed.
    registerClassroomBackgroundSync();
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      if (typeof data.url === "string" && /^https?:\\/\\//i.test(data.url)) {
        Linking.openURL(data.url).catch((error) => console.warn("Could not open Classroom assignment:", error));
      } else if (data.type === "new_assignment" || data.type === "classroom_deadline") {
        router.push("/classroom");
      }
    });
    return () => notificationSubscription.remove();
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider value={OrioDarkTheme}>
            <StatusBar style="light" />
            <AuthGuard />
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
