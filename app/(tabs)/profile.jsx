import React, { useState } from "react";
import { View, Text, ScrollView, Switch, Pressable, SafeAreaView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import useAuth from "../../hooks/useAuth";
import useKnowledgeStore from "../../store/knowledgeStore";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const store = useKnowledgeStore();
  const [githubConnected, setGithubConnected] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [offlineSync, setOfflineSync] = useState(true);

  const username = user?.full_name || "Navas";
  const useremail = user?.email || "developer@example.com";

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
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View className="items-center mt-4 mb-6">
          <View className="w-20 h-20 rounded-full bg-primary/20 border border-primary/30 items-center justify-center mb-3">
            <Ionicons name="person" size={40} color={colors.primaryLight} />
          </View>
          <Text className="text-white text-lg font-black">{username}</Text>
          <Text className="text-text-secondary text-xs mt-0.5">{useremail}</Text>
        </View>

        {/* Sync Summary */}
        <Card className="p-4 mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-white text-xs font-bold mb-0.5">Database Status</Text>
            <Text className="text-text-secondary text-[10px]">
              {store.items.length} total items indexed in pgvector
            </Text>
          </View>
          <View className="bg-success/15 px-3 py-1 rounded-full flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-success mr-1.5" />
            <Text className="text-success text-[9px] font-bold uppercase">Online</Text>
          </View>
        </Card>

        {/* Section: AI Configurations */}
        <Text className="text-white text-sm font-bold uppercase tracking-wider mb-3">
          AI & Search Engine
        </Text>
        <Card className="p-4 mb-6">
          {/* Provider Option */}
          <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-2">
            Default AI Provider
          </Text>
          <View className="flex-row mb-4 bg-background border border-border p-1 rounded-xl">
            <Pressable
              onPress={() => setProvider("openai")}
              className={`flex-1 py-2 rounded-lg items-center ${provider === "openai" ? "bg-primary" : ""}`}
            >
              <Text className={`text-[10px] font-bold ${provider === "openai" ? "text-white" : "text-text-secondary"}`}>
                OpenAI (Cloud)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setProvider("ollama")}
              className={`flex-1 py-2 rounded-lg items-center ${provider === "ollama" ? "bg-primary" : ""}`}
            >
              <Text className={`text-[10px] font-bold ${provider === "ollama" ? "text-white" : "text-text-secondary"}`}>
                Ollama (Local)
              </Text>
            </Pressable>
          </View>

          {/* Sync Switch */}
          <View className="flex-row items-center justify-between pt-2 border-t border-border/40">
            <View>
              <Text className="text-white text-xs font-bold">Auto Offline Caching</Text>
              <Text className="text-text-muted text-[9px] mt-0.5">Sync changes when online</Text>
            </View>
            <Switch
              value={offlineSync}
              onValueChange={setOfflineSync}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === "android" ? "#ffffff" : ""}
            />
          </View>
        </Card>

        {/* Section: Integrations */}
        <Text className="text-white text-sm font-bold uppercase tracking-wider mb-3">
          Integrations
        </Text>
        <Card className="p-4 mb-8">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-lg bg-white/10 items-center justify-center mr-3">
                <Ionicons name="logo-github" size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text className="text-white text-xs font-bold">GitHub Sync</Text>
                <Text className="text-text-secondary text-[9px]">
                  {githubConnected ? "Connected as @navas-dev" : "Import READMEs & sources"}
                </Text>
              </View>
            </View>
            
            <Button
              variant={githubConnected ? "secondary" : "outline"}
              size="sm"
              onPress={handleGitHubConnect}
              textStyle="text-[10px]"
            >
              {githubConnected ? "Disconnect" : "Connect"}
            </Button>
          </View>
        </Card>

        {/* Action Button */}
        <Button variant="danger" onPress={logout} className="mb-10 shadow-lg shadow-error/15">
          Sign Out of Orio
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
import { Platform } from "react-native";
