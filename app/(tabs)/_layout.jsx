import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../store/themeStore";

export default function TabLayout() {
  const { theme, themeColors } = useAppTheme();

  return (
    <Tabs
      key={theme}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: themeColors.primary,
        tabBarInactiveTintColor: themeColors.text.muted,
        tabBarStyle: {
          backgroundColor: themeColors.card,
          borderTopColor: themeColors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "bold",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="knowledge"
        options={{
          title: "Knowledge",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "book" : "book-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "checkmark-circle" : "checkmark-circle-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: "Ask AI",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: "Capture",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: "Settings",
        }}
      />
    </Tabs>

  );
}
