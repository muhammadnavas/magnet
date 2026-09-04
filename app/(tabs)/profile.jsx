import React, { useState } from "react";
import { View, Text, ScrollView, Switch, Pressable, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import config from "../../constants/config";
import useAuth from "../../hooks/useAuth";
import useKnowledgeStore from "../../store/knowledgeStore";
import { useAppTheme } from "../../store/themeStore";
import useBackendStatus from "../../hooks/useBackendStatus";

export default function SettingsScreen() {
  const { user } = useAuth();
  const store = useKnowledgeStore();
  const { theme, setTheme, themeColors } = useAppTheme();
  const { isConnected, isChecking, latency } = useBackendStatus();
  const [githubConnected, setGithubConnected] = useState(false);
  const [offlineSync, setOfflineSync] = useState(true);

  const username = user?.full_name || "Navas";
  const useremail = user?.email || "personal-app@orio.com";

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1">
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View className="mb-6">
          <Text style={{ color: themeColors.primary }} className="text-xs font-bold uppercase tracking-widest mb-1">Application Preferences</Text>
          <Text style={{ color: themeColors.text.primary }} className="text-3xl font-black">Settings</Text>
        </View>

        {/* Profile Card */}
        <Card className="p-4 mb-6 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View style={{ backgroundColor: `${themeColors.primary}20`, borderColor: `${themeColors.primary}40` }} className="w-12 h-12 rounded-2xl border items-center justify-center mr-4">
              <Ionicons name="person" size={22} color={themeColors.primary} />
            </View>
            <View>
              <Text style={{ color: themeColors.text.primary }} className="text-base font-bold">{username}</Text>
              <Text style={{ color: themeColors.text.secondary }} className="text-xs mt-0.5">{useremail}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: "#05966918" }} className="px-3 py-1.5 rounded-full flex-row items-center">
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#059669", marginRight: 5 }} />
            <Text style={{ color: "#059669" }} className="text-xs font-bold uppercase">Active</Text>
          </View>
        </Card>

        {/* Theme Switcher */}
        <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-2">Appearance</Text>
        <Card className="p-3 mb-6">
          <View className="flex-row gap-2">
            {[
              { mode: "dark", icon: "moon", label: "Dark Mode" },
              { mode: "light", icon: "sunny", label: "Light Mode" },
            ].map(({ mode, icon, label }) => {
              const active = theme === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setTheme(mode)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active ? `${themeColors.primary}20` : themeColors.surfaceHover,
                    borderWidth: 1.5,
                    borderColor: active ? themeColors.primary : themeColors.border,
                  }}
                >
                  <Ionicons name={icon} size={16} color={active ? themeColors.primary : themeColors.text.muted} style={{ marginRight: 8 }} />
                  <Text style={{ color: active ? themeColors.text.primary : themeColors.text.secondary, fontWeight: "700", fontSize: 13 }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Backend */}
        {/* Backend Connection */}
        <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">Backend Connection</Text>
        <Card className="p-5 mb-10">

          {/* Connection Status Row with Marker Light */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* Marker Light Dot */}
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: isChecking
                    ? "#F59E0B"
                    : isConnected
                    ? "#10B981"
                    : "#EF4444",
                  marginRight: 10,
                  shadowColor: isChecking
                    ? "#F59E0B"
                    : isConnected
                    ? "#10B981"
                    : "#EF4444",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9,
                  shadowRadius: 6,
                  elevation: 6,
                }}
              />
              <View>
                <Text style={{ color: themeColors.text.primary, fontWeight: "700", fontSize: 14 }}>
                  {isChecking
                    ? "Connecting..."
                    : isConnected
                    ? "Backend Connected"
                    : "Backend Offline"}
                </Text>
                <Text style={{ color: themeColors.text.muted, fontSize: 11, marginTop: 1 }}>
                  {isChecking
                    ? "Waking up Render server (up to 45s)..."
                    : isConnected
                    ? `Online · Latency ${latency ? `${latency}ms` : "OK"}`
                    : "Unable to reach API server"}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ borderTopColor: themeColors.border, borderTopWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <View style={{ backgroundColor: themeColors.surfaceHover, width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="logo-github" size={20} color={themeColors.text.primary} />
              </View>
              <View>
                <Text style={{ color: themeColors.text.primary, fontWeight: "700", fontSize: 14 }}>GitHub Sync</Text>
                <Text style={{ color: themeColors.text.secondary, fontSize: 11, marginTop: 2 }}>
                  {githubConnected ? "Connected as @muhammadnavas" : "Link code & README sources"}
                </Text>
              </View>
            </View>
            <Button variant={githubConnected ? "secondary" : "outline"} size="sm" onPress={() => setGithubConnected(!githubConnected)}>
              {githubConnected ? "Disconnect" : "Connect"}
            </Button>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
