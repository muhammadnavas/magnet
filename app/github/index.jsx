import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Card from "../../components/ui/Card";
import { useAppTheme } from "../../store/themeStore";
import api from "../../lib/api";

export default function GitHubScreen() {
  const { themeColors } = useAppTheme();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const loadRepos = async () => {
    try {
      setLoading(true);
      const status = await api.get("/github/status");
      setConnected(Boolean(status.data?.connected));
      if (!status.data?.connected) {
        setRepos([]);
        return;
      }
      const response = await api.get("/github/repos");
      setRepos(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("[GITHUB PAGE]", error?.response?.data || error?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRepos(); }, []);

  const openRepo = (repo) => {
    if (repo?.html_url) Linking.openURL(repo.html_url);
  };

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1">
      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center mb-6">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 }}>
            <Ionicons name="arrow-back" size={20} color={themeColors.text.primary} />
          </Pressable>
          <View>
            <Text style={{ color: themeColors.primary }} className="text-xs font-bold uppercase tracking-widest">Developer Workspace</Text>
            <Text style={{ color: themeColors.text.primary }} className="text-3xl font-black">GitHub</Text>
          </View>
        </View>

        <Card className="p-5 mb-6">
          <View className="flex-row items-center">
            <View style={{ backgroundColor: themeColors.surfaceHover }} className="w-12 h-12 rounded-2xl items-center justify-center mr-4">
              <Ionicons name="logo-github" size={26} color={themeColors.text.primary} />
            </View>
            <View className="flex-1">
              <Text style={{ color: themeColors.text.primary }} className="text-base font-extrabold">Your Projects</Text>
              <Text style={{ color: themeColors.text.muted }} className="text-xs mt-1">Repositories connected to Magnet</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: connected ? "#10B981" : "#EF4444", marginRight: 6 }} />
              <Text style={{ color: connected ? "#10B981" : "#EF4444" }} className="text-xs font-bold">{connected ? "Connected" : "Offline"}</Text>
            </View>
          </View>
        </Card>

        {!connected ? (
          <Card className="p-6 items-center mb-10">
            <Ionicons name="logo-github" size={34} color={themeColors.text.muted} />
            <Text style={{ color: themeColors.text.primary }} className="text-base font-extrabold mt-3">Connect GitHub first</Text>
            <Text style={{ color: themeColors.text.muted }} className="text-xs text-center mt-1 mb-4">Connect your GitHub account from Settings to see your projects here.</Text>

          </Card>
        ) : loading ? (
          <Card className="p-6 items-center"><Text style={{ color: themeColors.text.muted }} className="text-sm">Loading your projects...</Text></Card>
        ) : repos.length === 0 ? (
          <Card className="p-6 items-center mb-10">
            <Ionicons name="folder-open-outline" size={32} color={themeColors.text.muted} />
            <Text style={{ color: themeColors.text.primary }} className="text-base font-extrabold mt-3">No repositories found</Text>
            <Text style={{ color: themeColors.text.muted }} className="text-xs text-center mt-1">No accessible GitHub repositories were returned.</Text>
          </Card>
        ) : (
          <View className="mb-10">
            <View className="flex-row items-center justify-between mb-3">
              <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider">Repositories</Text>
              <Text style={{ color: themeColors.text.muted }} className="text-xs">{repos.length} projects</Text>
            </View>
            {repos.map((repo) => (
              <Pressable key={String(repo.id || repo.full_name || repo.name)} onPress={() => openRepo(repo)} className="mb-3">
                <Card className="p-4">
                  <View className="flex-row items-center">
                    <View style={{ backgroundColor: themeColors.surfaceHover }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
                      <Ionicons name="code-slash-outline" size={20} color={themeColors.primary} />
                    </View>
                    <View className="flex-1 mr-3">
                      <Text style={{ color: themeColors.text.primary }} className="text-sm font-extrabold" numberOfLines={1}>{repo.name}</Text>
                      <Text style={{ color: themeColors.text.muted }} className="text-[11px] mt-1" numberOfLines={2}>{repo.description || "No description"}</Text>
                      <View className="flex-row items-center mt-2">
                        {repo.language ? <Text style={{ color: themeColors.text.secondary }} className="text-[10px] font-semibold mr-3">{repo.language}</Text> : null}
                        <Ionicons name="star-outline" size={12} color={themeColors.text.muted} />
                        <Text style={{ color: themeColors.text.muted }} className="text-[10px] ml-1">{repo.stargazers_count || 0}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={themeColors.text.muted} />
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
