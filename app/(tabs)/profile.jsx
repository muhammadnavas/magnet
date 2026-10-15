import React, { useState } from "react";
import { Alert, Linking, Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import config from "../../constants/config";
import useAuth from "../../hooks/useAuth";
import { useAppTheme } from "../../store/themeStore";
import useBackendStatus from "../../hooks/useBackendStatus";
import api from "../../lib/api";

const PROVIDER_META = {
  gemini: { icon: "sparkles", description: "Google Gemini for fast, grounded AI responses" },
  grok: { icon: "flash", description: "xAI Grok for an alternative AI experience" },
};

export default function SettingsScreen() {
  const { user } = useAuth();
  const { theme, setTheme, themeColors } = useAppTheme();
  const { isConnected, isChecking, latency } = useBackendStatus();
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);
  const [classroomConnected, setClassroomConnected] = useState(false);
  const [classroomEmail, setClassroomEmail] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("gemini");

  const username = "Navas";
  const useremail = user?.email || "personal-app@orio.com";
  const providers = config.SUPPORTED_PROVIDERS.filter((provider) => PROVIDER_META[provider.value]);

  const loadGithubStatus = async () => {
    try {
      const response = await api.get("/github/status");
      setGithubConnected(Boolean(response.data?.connected));
      setGithubUsername(response.data?.username || "");
    } catch (error) { setGithubConnected(false); setGithubUsername(""); console.log("[GITHUB STATUS]", error?.response?.data || error?.message); }
  };

  useFocusEffect(useCallback(() => {
    loadGithubStatus();
    // Load classroom status
    api.get("/classroom/status")
      .then((res) => {
        setClassroomConnected(Boolean(res.data?.connected));
        setClassroomEmail(res.data?.email || "");
      })
      .catch(() => {});

    const handleGithubCallback = ({ url }) => {
      if (!url?.startsWith("orio://github/callback")) return;
      try {
        const parsed = new URL(url);
        const connected = parsed.searchParams.get("connected") === "true";
        const callbackError = parsed.searchParams.get("error");
        if (connected) loadGithubStatus();
        else if (callbackError) Alert.alert("GitHub Connection Failed", callbackError);
      } catch (error) { console.log("[GITHUB CALLBACK]", error); }
    };
    const subscription = Linking.addEventListener("url", handleGithubCallback);
    Linking.getInitialURL().then((url) => url && handleGithubCallback({ url })).catch(() => {});
    return () => subscription.remove();
  }, []));

  const connectGithub = async () => {
    try { setGithubLoading(true); const response = await api.get("/github/authorize"); await Linking.openURL(response.data.authorization_url); }
    catch (error) { Alert.alert("GitHub", error?.response?.data?.detail || "Could not start GitHub authorization."); }
    finally { setGithubLoading(false); }
  };

  const connectClassroom = () => router.push("/classroom");

  const disconnectGithub = () => Alert.alert("Disconnect GitHub?", "Magnet will stop accessing your GitHub repositories.", [
    { text: "Cancel", style: "cancel" },
    { text: "Disconnect", style: "destructive", onPress: async () => { try { await api.post("/github/disconnect"); setGithubConnected(false); setGithubUsername(""); } catch (error) { Alert.alert("GitHub", error?.response?.data?.detail || "Could not disconnect GitHub."); } } },
  ]);

  const disconnectClassroom = () => Alert.alert("Disconnect Google Classroom?", "Magnet will stop syncing your assignments and courses.", [
    { text: "Cancel", style: "cancel" },
    { text: "Disconnect", style: "destructive", onPress: async () => { try { await api.post("/classroom/disconnect"); setClassroomConnected(false); setClassroomEmail(""); } catch (error) { Alert.alert("Google Classroom", error?.response?.data?.detail || "Could not disconnect."); } } },
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
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: isChecking ? "#F59E0B" : isConnected ? "#10B981" : "#EF4444", marginRight: 10 }} /><View><Text style={{ color: themeColors.text.primary, fontWeight: "700", fontSize: 14 }}>{isChecking ? "Connecting..." : isConnected ? "Backend Connected" : "Backend Offline"}</Text><Text style={{ color: themeColors.text.muted, fontSize: 11, marginTop: 1 }}>{isChecking ? "Waking up Render server (up to 45s)..." : isConnected ? `Online · Latency ${latency ? `${latency}ms` : "OK"}` : "Unable to reach API server"}</Text></View></View>
          <View style={{ borderTopColor: themeColors.border, borderTopWidth: 1, paddingTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}><View style={{ backgroundColor: themeColors.surfaceHover, width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 }}><Ionicons name="logo-github" size={20} color={themeColors.text.primary} /></View><View style={{ flex: 1 }}><Text style={{ color: themeColors.text.primary, fontWeight: "700", fontSize: 14 }}>GitHub Sync</Text><Text style={{ color: themeColors.text.secondary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{githubConnected ? `Connected as @${githubUsername}` : "Link code & README sources"}</Text></View></View>{githubConnected ? <Button variant="outline" size="sm" onPress={disconnectGithub}>Disconnect</Button> : <Button variant="outline" size="sm" onPress={connectGithub} disabled={githubLoading}>{githubLoading ? "..." : "Connect"}</Button>}</View>
            <Pressable onPress={connectClassroom} style={{ borderTopColor: themeColors.border, borderTopWidth: 1, marginTop: 14, paddingTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}><View style={{ backgroundColor: themeColors.surfaceHover, width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 }}><Ionicons name="school-outline" size={20} color={themeColors.text.primary} /></View><View style={{ flex: 1 }}><Text style={{ color: themeColors.text.primary, fontWeight: "700", fontSize: 14 }}>Google Classroom</Text><Text style={{ color: themeColors.text.secondary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{classroomConnected ? `Connected as ${classroomEmail}` : "Sync assignments & deadlines"}</Text></View></View>{classroomConnected ? <Button variant="outline" size="sm" onPress={disconnectClassroom}>Disconnect</Button> : <Button variant="outline" size="sm" onPress={connectClassroom}>Connect</Button>}</Pressable>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
