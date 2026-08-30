import React, { useState } from "react";
import { View, Text, ScrollView, Switch, Pressable, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import config from "../../constants/config";
import useAuth from "../../hooks/useAuth";
import useKnowledgeStore from "../../store/knowledgeStore";
import useThemeStore from "../../store/themeStore";

export default function SettingsScreen() {
  const { user } = useAuth();
  const store = useKnowledgeStore();
  const { theme, setTheme, colors: themeColors } = useThemeStore();
  const [githubConnected, setGithubConnected] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [offlineSync, setOfflineSync] = useState(true);

  const username = user?.full_name || "Navas";
  const useremail = user?.email || "personal-app@orio.com";

  const handleGitHubConnect = () => {
    if (githubConnected) {
      Alert.alert("Disconnect GitHub", "Are you sure you want to disconnect?", [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: () => setGithubConnected(false) }
      ]);
    } else {
      Alert.alert("GitHub Integration", "GitHub Connect workflow is configured. Do you want to authorize?", [
        { text: "Cancel", style: "cancel" },
        { text: "Connect", onPress: () => {
          setGithubConnected(true);
          Alert.alert("Success", "GitHub account successfully linked.");
        }}
      ]);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1">
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text style={{ color: themeColors.primary }} className="text-xs font-bold uppercase tracking-widest mb-1">
            Application Preferences
          </Text>
          <Text style={{ color: themeColors.text.primary }} className="text-3xl font-black">
            Settings
          </Text>
        </View>

        {/* Developer Profile Info */}
        <Card className="p-5 mb-6 flex-row items-center justify-between border">
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-2xl bg-primary/20 items-center justify-center mr-4 border border-primary/30">
              <Ionicons name="person" size={24} color={themeColors.primary} />
            </View>
            <View>
              <Text style={{ color: themeColors.text.primary }} className="text-base font-bold">{username}</Text>
              <Text style={{ color: themeColors.text.secondary }} className="text-xs mt-0.5">{useremail}</Text>
            </View>
          </View>
          <View className="bg-success/15 px-3 py-1.5 rounded-full flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-success mr-2" />
            <Text className="text-success text-xs font-bold uppercase">Active</Text>
          </View>
        </Card>

        {/* Theme Appearance Mode Switcher */}
        <Text style={{ color: themeColors.text.primary }} className="text-sm font-bold uppercase tracking-wider mb-3">
          Appearance & Theme Mode
        </Text>
        <Card className="p-5 mb-6">
          <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">
            Interface Theme
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setTheme("dark")}
              style={{
                backgroundColor: theme === "dark" ? `${themeColors.primary}20` : themeColors.surface,
                borderColor: theme === "dark" ? themeColors.primary : themeColors.border,
              }}
              className="flex-1 p-4 rounded-2xl border items-center justify-center"
            >
              <Ionicons name="moon" size={24} color={theme === "dark" ? themeColors.primary : themeColors.text.secondary} className="mb-2" />
              <Text style={{ color: theme === "dark" ? themeColors.text.primary : themeColors.text.secondary }} className="text-xs font-bold">
                Dark Mode
              </Text>
              <Text style={{ color: themeColors.text.muted }} className="text-[10px] mt-0.5">Deep Space Black</Text>
            </Pressable>

            <Pressable
              onPress={() => setTheme("light")}
              style={{
                backgroundColor: theme === "light" ? `${themeColors.primary}20` : themeColors.surface,
                borderColor: theme === "light" ? themeColors.primary : themeColors.border,
              }}
              className="flex-1 p-4 rounded-2xl border items-center justify-center"
            >
              <Ionicons name="sunny" size={24} color={theme === "light" ? themeColors.primary : themeColors.text.secondary} className="mb-2" />
              <Text style={{ color: theme === "light" ? themeColors.text.primary : themeColors.text.secondary }} className="text-xs font-bold">
                Light Mode
              </Text>
              <Text style={{ color: themeColors.text.muted }} className="text-[10px] mt-0.5">Clean White BG</Text>
            </Pressable>
          </View>
        </Card>

        {/* System & Database Stats */}
        <Card className="p-5 mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text style={{ color: themeColors.text.primary }} className="text-sm font-bold">Vector Database Status</Text>
            <Text style={{ color: themeColors.primary }} className="text-xs font-bold">PostgreSQL + pgvector</Text>
          </View>
          <Text style={{ color: themeColors.text.secondary }} className="text-xs leading-relaxed">
            {store.items.length} knowledge items cataloged and embedded for RAG search.
          </Text>
        </Card>

        {/* AI Model Configuration */}
        <Text style={{ color: themeColors.text.primary }} className="text-sm font-bold uppercase tracking-wider mb-3">
          AI & RAG Model Provider
        </Text>
        <Card className="p-5 mb-6">
          <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">
            Primary LLM Engine
          </Text>
          
          <View className="gap-2 mb-4">
            <Pressable
              onPress={() => setProvider("gemini")}
              style={{
                backgroundColor: provider === "gemini" ? `${themeColors.primary}15` : themeColors.surface,
                borderColor: provider === "gemini" ? themeColors.primary : themeColors.border,
              }}
              className="p-3.5 rounded-xl border flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <Ionicons name="sparkles" size={18} color={provider === "gemini" ? themeColors.primary : themeColors.text.secondary} className="mr-3" />
                <View>
                  <Text style={{ color: provider === "gemini" ? themeColors.text.primary : themeColors.text.secondary }} className="text-sm font-bold">
                    Google Gemini 1.5 Flash
                  </Text>
                  <Text style={{ color: themeColors.text.muted }} className="text-xs mt-0.5">Recommended (Fast & Multi-modal)</Text>
                </View>
              </View>
              {provider === "gemini" && <Ionicons name="checkmark-circle" size={18} color={themeColors.primary} />}
            </Pressable>

            <Pressable
              onPress={() => setProvider("openai")}
              style={{
                backgroundColor: provider === "openai" ? `${themeColors.primary}15` : themeColors.surface,
                borderColor: provider === "openai" ? themeColors.primary : themeColors.border,
              }}
              className="p-3.5 rounded-xl border flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <Ionicons name="hardware-chip-outline" size={18} color={provider === "openai" ? themeColors.primary : themeColors.text.secondary} className="mr-3" />
                <View>
                  <Text style={{ color: provider === "openai" ? themeColors.text.primary : themeColors.text.secondary }} className="text-sm font-bold">
                    OpenAI GPT-4o Mini
                  </Text>
                  <Text style={{ color: themeColors.text.muted }} className="text-xs mt-0.5">Cloud LLM Fallback</Text>
                </View>
              </View>
              {provider === "openai" && <Ionicons name="checkmark-circle" size={18} color={themeColors.primary} />}
            </Pressable>

            <Pressable
              onPress={() => setProvider("ollama")}
              style={{
                backgroundColor: provider === "ollama" ? `${themeColors.primary}15` : themeColors.surface,
                borderColor: provider === "ollama" ? themeColors.primary : themeColors.border,
              }}
              className="p-3.5 rounded-xl border flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <Ionicons name="laptop-outline" size={18} color={provider === "ollama" ? themeColors.primary : themeColors.text.secondary} className="mr-3" />
                <View>
                  <Text style={{ color: provider === "ollama" ? themeColors.text.primary : themeColors.text.secondary }} className="text-sm font-bold">
                    Ollama Local
                  </Text>
                  <Text style={{ color: themeColors.text.muted }} className="text-xs mt-0.5">Offline Self-Hosted AI</Text>
                </View>
              </View>
              {provider === "ollama" && <Ionicons name="checkmark-circle" size={18} color={themeColors.primary} />}
            </Pressable>
          </View>

          {/* Sync Switch */}
          <View style={{ borderTopColor: themeColors.border }} className="flex-row items-center justify-between pt-3 border-t">
            <View className="flex-1 mr-4">
              <Text style={{ color: themeColors.text.primary }} className="text-sm font-bold">Offline Auto-Sync</Text>
              <Text style={{ color: themeColors.text.muted }} className="text-xs mt-0.5">Queue items when offline and sync when connected</Text>
            </View>
            <Switch
              value={offlineSync}
              onValueChange={setOfflineSync}
              trackColor={{ false: themeColors.border, true: themeColors.primary }}
              thumbColor={Platform.OS === "android" ? "#ffffff" : ""}
            />
          </View>
        </Card>

        {/* Backend & Integrations */}
        <Text style={{ color: themeColors.text.primary }} className="text-sm font-bold uppercase tracking-wider mb-3">
          Backend Connection
        </Text>
        <Card className="p-5 mb-10">
          <View className="mb-4">
            <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-1">
              Active API Server Endpoint
            </Text>
            <View style={{ backgroundColor: themeColors.surfaceHover, borderColor: themeColors.border }} className="border p-3 rounded-xl">
              <Text style={{ color: themeColors.text.primary }} className="text-xs font-mono">{config.API_URL}</Text>
            </View>
          </View>

          <View style={{ borderTopColor: themeColors.border }} className="flex-row items-center justify-between pt-3 border-t">
            <View className="flex-row items-center">
              <View style={{ backgroundColor: themeColors.surfaceHover }} className="w-9 h-9 rounded-xl items-center justify-center mr-3">
                <Ionicons name="logo-github" size={20} color={themeColors.text.primary} />
              </View>
              <View>
                <Text style={{ color: themeColors.text.primary }} className="text-sm font-bold">GitHub Sync</Text>
                <Text style={{ color: themeColors.text.secondary }} className="text-xs mt-0.5">
                  {githubConnected ? "Connected as @muhammadnavas" : "Link code & README sources"}
                </Text>
              </View>
            </View>
            
            <Button
              variant={githubConnected ? "secondary" : "outline"}
              size="sm"
              onPress={handleGitHubConnect}
              textStyle="text-xs"
            >
              {githubConnected ? "Disconnect" : "Connect"}
            </Button>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
