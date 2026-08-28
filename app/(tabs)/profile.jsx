import React, { useState } from "react";
import { View, Text, ScrollView, Switch, Pressable, SafeAreaView, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import config from "../../constants/config";
import useAuth from "../../hooks/useAuth";
import useKnowledgeStore from "../../store/knowledgeStore";

export default function SettingsScreen() {
  const { user } = useAuth();
  const store = useKnowledgeStore();
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
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-primary-light text-xs font-bold uppercase tracking-widest mb-1">
            Application Preferences
          </Text>
          <Text className="text-white text-3xl font-black">
            Settings
          </Text>
        </View>

        {/* Developer Profile Info */}
        <Card className="p-5 mb-6 flex-row items-center justify-between border border-border bg-card">
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-2xl bg-primary/20 items-center justify-center mr-4 border border-primary/30">
              <Ionicons name="person" size={24} color={colors.primaryLight} />
            </View>
            <View>
              <Text className="text-white text-base font-bold">{username}</Text>
              <Text className="text-text-secondary text-xs mt-0.5">{useremail}</Text>
            </View>
          </View>
          <View className="bg-success/15 px-3 py-1.5 rounded-full flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-success mr-2" />
            <Text className="text-success text-xs font-bold uppercase">Active</Text>
          </View>
        </Card>

        {/* System & Database Stats */}
        <Card className="p-5 mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-white text-sm font-bold">Vector Database Status</Text>
            <Text className="text-primary-light text-xs font-bold">PostgreSQL + pgvector</Text>
          </View>
          <Text className="text-text-secondary text-xs leading-relaxed">
            {store.items.length} knowledge items cataloged and embedded for RAG search.
          </Text>
        </Card>

        {/* AI Model Configuration */}
        <Text className="text-white text-sm font-bold uppercase tracking-wider mb-3">
          AI & RAG Model Provider
        </Text>
        <Card className="p-5 mb-6">
          <Text className="text-text-muted text-xs font-bold uppercase tracking-wider mb-3">
            Primary LLM Engine
          </Text>
          
          <View className="gap-2 mb-4">
            <Pressable
              onPress={() => setProvider("gemini")}
              className={`p-3.5 rounded-xl border flex-row items-center justify-between ${
                provider === "gemini" 
                  ? "bg-primary/15 border-primary" 
                  : "bg-surface border-border"
              }`}
            >
              <View className="flex-row items-center">
                <Ionicons name="sparkles" size={18} color={provider === "gemini" ? colors.primaryLight : colors.text.secondary} className="mr-3" />
                <View>
                  <Text className={`text-sm font-bold ${provider === "gemini" ? "text-white" : "text-text-secondary"}`}>
                    Google Gemini 1.5 Flash
                  </Text>
                  <Text className="text-text-muted text-xs mt-0.5">Recommended (Fast & Multi-modal)</Text>
                </View>
              </View>
              {provider === "gemini" && <Ionicons name="checkmark-circle" size={18} color={colors.primaryLight} />}
            </Pressable>

            <Pressable
              onPress={() => setProvider("openai")}
              className={`p-3.5 rounded-xl border flex-row items-center justify-between ${
                provider === "openai" 
                  ? "bg-primary/15 border-primary" 
                  : "bg-surface border-border"
              }`}
            >
              <View className="flex-row items-center">
                <Ionicons name="hardware-chip-outline" size={18} color={provider === "openai" ? colors.primaryLight : colors.text.secondary} className="mr-3" />
                <View>
                  <Text className={`text-sm font-bold ${provider === "openai" ? "text-white" : "text-text-secondary"}`}>
                    OpenAI GPT-4o Mini
                  </Text>
                  <Text className="text-text-muted text-xs mt-0.5">Cloud LLM Fallback</Text>
                </View>
              </View>
              {provider === "openai" && <Ionicons name="checkmark-circle" size={18} color={colors.primaryLight} />}
            </Pressable>

            <Pressable
              onPress={() => setProvider("ollama")}
              className={`p-3.5 rounded-xl border flex-row items-center justify-between ${
                provider === "ollama" 
                  ? "bg-primary/15 border-primary" 
                  : "bg-surface border-border"
              }`}
            >
              <View className="flex-row items-center">
                <Ionicons name="laptop-outline" size={18} color={provider === "ollama" ? colors.primaryLight : colors.text.secondary} className="mr-3" />
                <View>
                  <Text className={`text-sm font-bold ${provider === "ollama" ? "text-white" : "text-text-secondary"}`}>
                    Ollama Local
                  </Text>
                  <Text className="text-text-muted text-xs mt-0.5">Offline Self-Hosted AI</Text>
                </View>
              </View>
              {provider === "ollama" && <Ionicons name="checkmark-circle" size={18} color={colors.primaryLight} />}
            </Pressable>
          </View>

          {/* Sync Switch */}
          <View className="flex-row items-center justify-between pt-3 border-t border-border/40">
            <View className="flex-1 mr-4">
              <Text className="text-white text-sm font-bold">Offline Auto-Sync</Text>
              <Text className="text-text-muted text-xs mt-0.5">Queue items when offline and sync when connected</Text>
            </View>
            <Switch
              value={offlineSync}
              onValueChange={setOfflineSync}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === "android" ? "#ffffff" : ""}
            />
          </View>
        </Card>

        {/* Backend & Integrations */}
        <Text className="text-white text-sm font-bold uppercase tracking-wider mb-3">
          Backend Connection
        </Text>
        <Card className="p-5 mb-10">
          <View className="mb-4">
            <Text className="text-text-muted text-xs font-bold uppercase tracking-wider mb-1">
              Active API Server Endpoint
            </Text>
            <View className="bg-surface border border-border p-3 rounded-xl">
              <Text className="text-white text-xs font-mono">{config.API_URL}</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between pt-3 border-t border-border/40">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-white/10 items-center justify-center mr-3">
                <Ionicons name="logo-github" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text className="text-white text-sm font-bold">GitHub Sync</Text>
                <Text className="text-text-secondary text-xs mt-0.5">
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
