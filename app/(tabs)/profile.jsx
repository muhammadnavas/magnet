import React, { useEffect, useState } from "react";
import { Alert, FlatList, Linking, Modal, Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import config from "../../constants/config";
import useAuth from "../../hooks/useAuth";
import useKnowledgeStore from "../../store/knowledgeStore";
import { useAppTheme } from "../../store/themeStore";
import useBackendStatus from "../../hooks/useBackendStatus";
import api from "../../lib/api";

const PROVIDER_META = {
  gemini: { icon: "sparkles", description: "Google Gemini for fast, grounded AI responses" },
  grok: { icon: "flash", description: "xAI Grok for an alternative AI experience" },
};

export default function SettingsScreen() {
  const { user } = useAuth();
  const store = useKnowledgeStore();
  const { theme, setTheme, themeColors } = useAppTheme();
  const { isConnected, isChecking, latency } = useBackendStatus();
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubRepos, setGithubRepos] = useState([]);
  const [showGithubRepos, setShowGithubRepos] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("gemini");

  const username = "Navas";
  const useremail = user?.email || "personal-app@orio.com";
  const providers = config.SUPPORTED_PROVIDERS.filter((provider) => PROVIDER_META[provider.value]);

  const loadGithubStatus = async () => {
    try {
      const response = await api.get("/github/status");
      setGithubConnected(Boolean(response.data?.connected));
      setGithubUsername(response.data?.username || "");
    } catch (error) { console.log("[GITHUB STATUS]", error?.response?.data || error?.message); }
  };

  useEffect(() => {
    loadGithubStatus();
    const handleGithubCallback = ({ url }) => {
      if (!url?.startsWith("orio://github/callback")) return;
      try {
        const parsed = new URL(url);
        const connected = parsed.searchParams.get("connected") === "true";
        const callbackError = parsed.searchParams.get("error");
        if (connected) { loadGithubStatus(); Alert.alert("GitHub Connected", "Your GitHub account is now connected to Orio."); }
        else if (callbackError) Alert.alert("GitHub Connection Failed", callbackError);
      } catch (error) { console.log("[GITHUB CALLBACK]", error); }
    };
    const subscription = Linking.addEventListener("url", handleGithubCallback);
    Linking.getInitialURL().then((url) => url && handleGithubCallback({ url })).catch(() => {});
    return () => subscription.remove();
  }, []);

  const connectGithub = async () => {
    try { setGithubLoading(true); const response = await api.get("/github/authorize"); await Linking.openURL(response.data.authorization_url); }
    catch (error) { Alert.alert("GitHub", error?.response?.data?.detail || "Could not start GitHub authorization."); }
    finally { setGithubLoading(false); }
  };

  const connectClassroom = () => router.push("/classroom");

  const openGithubRepos = async () => {
    try { setGithubLoading(true); const response = await api.get("/github/repos"); setGithubRepos(response.data || []); setShowGithubRepos(true); }
    catch (error) { if (error?.response?.status === 401) { setGithubConnected(false); setGithubUsername(""); } Alert.alert("GitHub", error?.response?.data?.detail || "Could not load repositories."); }
    finally { setGithubLoading(false); }
  };

  const disconnectGithub = () => Alert.alert("Disconnect GitHub?", "Orio will stop accessing your GitHub repositories.", [
    { text: "Cancel", style: "cancel" },
    { text: "Disconnect", style: "destructive", onPress: async () => { try { await api.post("/github/disconnect"); setGithubConnected(false); setGithubUsername(""); setGithubRepos([]); } catch (error) { Alert.alert("GitHub", error?.response?.data?.detail || "Could not disconnect GitHub."); } } },
  ]);

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1">
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <View className="mb-6"><Text style={{ color: themeColors.primary }} className="text-xs font-bold uppercase tracking-widest mb-1">Application Preferences</Text><Text style={{ color: themeColors.text.primary }} className="text-3xl font-black">Settings</Text></View>
        <Card className="p-4 mb-6 flex-row items-center justify-between"><View className="flex-row items-center"><View style={{ backgroundColor: `${themeColors.primary}20`, borderColor: `${themeColors.primary}40` }} className="w-12 h-12 rounded-2xl border items-center justify-center mr-4"><Ionicons name="person" size={22} color={themeColors.primary} /></View><View><Text style={{ color: themeColors.text.primary }} className="text-base font-bold">{username}</Text><Text style={{ color: themeColors.text.secondary }} className="text-xs mt-0.5">{useremail}</Text></View></View><View style={{ backgroundColor: "#05966918" }} className="px-3 py-1.5 rounded-full flex-row items-center"><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#059669", marginRight: 5 }} /><Text style={{ color: "#059669" }} className="text-xs font-bold uppercase">Active</Text></View></Card>

        <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-2">Appearance</Text>
        <Card className="p-3 mb-6"><View className="flex-row gap-2">{[{ mode: "dark", icon: "moon", label: "Dark Mode" }, { mode: "light", icon: "sunny", label: "Light Mode" }].map(({ mode, icon, label }) => { const active = theme === mode; return <Pressable key={mode} onPress={() => setTheme(mode)} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: active ? `${themeColors.primary}20` : themeColors.surfaceHover, borderWidth: 1.5, borderColor: active ? themeColors.primary : themeColors.border }}><Ionicons name={icon} size={16} color={active ? themeColors.primary : themeColors.text.muted} style={{ marginRight: 8 }} /><Text style={{ color: active ? themeColors.text.primary : themeColors.text.secondary, fontWeight: "700", fontSize: 13 }}>{label}</Text></Pressable>; })}</View></Card>

        <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-2">AI Provider</Text>
        <Card className="p-3 mb-6">{providers.map((provider, index) => { const active = selectedProvider === provider.value; const meta = PROVIDER_META[provider.value]; return <Pressable key={provider.value} onPress={() => setSelectedProvider(provider.value)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, backgroundColor: active ? `${themeColors.primary}12` : "transparent", borderWidth: 1.5, borderColor: active ? themeColors.primary : "transparent", marginBottom: index === providers.length - 1 ? 0 : 8 }}><View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12, backgroundColor: active ? `${themeColors.primary}20` : themeColors.surfaceHover }}><Ionicons name={meta.icon} size={19} color={active ? themeColors.primary : themeColors.text.secondary} /></View><View style={{ flex: 1 }}><Text style={{ color: themeColors.text.primary, fontWeight: "800", fontSize: 14 }}>{provider.label}</Text><Text style={{ color: themeColors.text.muted, fontSize: 11, marginTop: 3 }}>{meta.description}</Text></View><View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: active ? themeColors.primary : themeColors.border, alignItems: "center", justifyContent: "center" }}>{active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: themeColors.primary }} />}</View></Pressable>; })}<Text style={{ color: themeColors.text.muted, fontSize: 10, marginTop: 10, marginHorizontal: 4 }}>Your selection is used for AI responses. Embeddings continue to use the configured knowledge-search model.</Text></Card>

        <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">Backend Connection</Text>
        <Card className="p-5 mb-10">
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}><View style={{ flexDirection: "row", alignItems: "center" }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: isChecking ? "#F59E0B" : isConnected ? "#10B981" : "#EF4444", marginRight: 10 }} /><View><Text style={{ color: themeColors.text.primary, fontWeight: "700", fontSize: 14 }}>{isChecking ? "Connecting..." : isConnected ? "Backend Connected" : "Backend Offline"}</Text><Text style={{ color: themeColors.text.muted, fontSize: 11, marginTop: 1 }}>{isChecking ? "Waking up Render server (up to 45s)..." : isConnected ? `Online · Latency ${latency ? `${latency}ms` : "OK"}` : "Unable to reach API server"}</Text></View></View></View>
          <View style={{ borderTopColor: themeColors.border, borderTopWidth: 1, paddingTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}><View style={{ backgroundColor: themeColors.surfaceHover, width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 }}><Ionicons name="logo-github" size={20} color={themeColors.text.primary} /></View><View><Text style={{ color: themeColors.text.primary, fontWeight: "700", fontSize: 14 }}>GitHub Sync</Text><Text style={{ color: themeColors.text.secondary, fontSize: 11, marginTop: 2 }}>{githubConnected ? `Connected as @${githubUsername}` : "Link code & README sources"}</Text></View></View>{githubConnected ? <View className="flex-row gap-2"><Button variant="secondary" size="sm" onPress={openGithubRepos} disabled={githubLoading}>{githubLoading ? "..." : "Repos"}</Button><Button variant="outline" size="sm" onPress={disconnectGithub}>Disconnect</Button></View> : <Button variant="outline" size="sm" onPress={connectGithub} disabled={githubLoading}>{githubLoading ? "..." : "Connect"}</Button>}</View>
            <Pressable onPress={connectClassroom} style={{ borderTopColor: themeColors.border, borderTopWidth: 1, marginTop: 14, paddingTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}><View style={{ backgroundColor: themeColors.surfaceHover, width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 }}><Ionicons name="school-outline" size={20} color={themeColors.text.primary} /></View><View style={{ flex: 1 }}><Text style={{ color: themeColors.text.primary, fontWeight: "700", fontSize: 14 }}>Google Classroom</Text><Text style={{ color: themeColors.text.secondary, fontSize: 11, marginTop: 2 }}>Sync assignments & deadlines</Text></View></View><View className="flex-row items-center"><Text style={{ color: themeColors.primary }} className="text-xs font-bold mr-1">Open</Text><Ionicons name="chevron-forward" size={16} color={themeColors.primary} /></View></Pressable>
          </View>
        </Card>
      </ScrollView>
      <Modal visible={showGithubRepos} animationType="slide" transparent onRequestClose={() => setShowGithubRepos(false)}><View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" }}><View style={{ maxHeight: "78%", backgroundColor: themeColors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}><View className="flex-row items-center justify-between mb-4"><View><Text style={{ color: themeColors.text.primary, fontSize: 22, fontWeight: "900" }}>GitHub Repositories</Text><Text style={{ color: themeColors.text.muted, fontSize: 12, marginTop: 3 }}>Choose a repository to import into Orio</Text></View><Pressable onPress={() => setShowGithubRepos(false)} style={{ padding: 8 }}><Ionicons name="close" size={24} color={themeColors.text.secondary} /></Pressable></View><FlatList data={githubRepos} keyExtractor={(item) => String(item.id)} showsVerticalScrollIndicator={false} renderItem={({ item }) => <View style={{ borderWidth: 1, borderColor: themeColors.border, borderRadius: 14, padding: 14, marginBottom: 10, backgroundColor: themeColors.surface }}><View className="flex-row items-center justify-between"><View style={{ flex: 1, paddingRight: 10 }}><Text style={{ color: themeColors.text.primary, fontWeight: "800", fontSize: 15 }}>{item.name}</Text><Text style={{ color: themeColors.text.muted, fontSize: 11, marginTop: 3 }} numberOfLines={2}>{item.description || "No description"}</Text></View></View></View>} /></View></View></Modal>
    </SafeAreaView>
  );
}
