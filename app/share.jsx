import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import useKnowledgeStore from "../store/knowledgeStore";
import { useAppTheme } from "../store/themeStore";

function getContentType(value) {
  return /^https?:\/\/\S+$/i.test(value) ? "url" : "note";
}

function getTitle(value) {
  if (/^https?:\/\/\S+$/i.test(value)) {
    try { return value.match(/^https?:\/\/([^/?#]+)/i)?.[1]?.replace(/^www\./, "") || "Shared link"; } catch {}
  }
  const firstLine = value.split("\n").map((line) => line.trim()).find(Boolean) || "Shared content";
  return firstLine.slice(0, 70) || "Shared content";
}

export default function ShareScreen() {
  const params = useLocalSearchParams();
  const sharedText = useMemo(() => {
    const value = params.text || params.url || "";
    return (Array.isArray(value) ? value[0] : value).trim();
  }, [params.text, params.url]);
  const store = useKnowledgeStore();
  const { themeColors } = useAppTheme();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const type = getContentType(sharedText);
  const title = getTitle(sharedText);
  const duplicate = Boolean(sharedText) && (store.items || []).some((item) => {
    const existing = (item.rawContent || "").trim();
    return existing && existing.toLowerCase() === sharedText.toLowerCase();
  });

  useEffect(() => {
    store.fetchItems();
  }, []);

  useEffect(() => {
    if (!sharedText) {
      Alert.alert("Nothing to share", "Share text or a link to Magnet to save it to your Knowledge Library.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/capture") },
      ]);
    }
  }, [sharedText]);

  const saveSharedContent = async () => {
    if (!sharedText || saving || saved) return;
    setSaving(true);
    try {
      await store.addKnowledgeItem({
        title,
        contentType: type,
        rawContent: sharedText,
        summary: sharedText.slice(0, 160),
        tags: ["shared"],
      });
      await store.fetchItems();
      setSaved(true);
      Alert.alert("Saved to Magnet", "Your shared content has been added to the Knowledge Library.", [
        { text: "View Knowledge", onPress: () => router.replace("/(tabs)/knowledge") },
        { text: "Done", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (error) {
      console.error("Failed to save shared content:", error);
      Alert.alert("Couldn't save this yet", "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={["top", "left", "right", "bottom"]}>
      <Stack.Screen options={{ title: "Share to Magnet", headerShown: false }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 22, justifyContent: "center" }}>
        <Pressable onPress={() => router.back()} style={{ alignSelf: "flex-start", padding: 8, marginBottom: 28 }}>
          <Ionicons name="close" size={24} color={themeColors.text.secondary} />
        </Pressable>
        <View style={{ width: 62, height: 62, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: `${themeColors.primary}20`, marginBottom: 22 }}>
          <Ionicons name="bookmark" size={30} color={themeColors.primary} />
        </View>
        <Text style={{ color: themeColors.text.primary, fontSize: 28, fontWeight: "900", marginBottom: 8 }}>Save to Magnet</Text>
        <Text style={{ color: themeColors.text.secondary, fontSize: 15, lineHeight: 22, marginBottom: 26 }}>
          Keep useful links and snippets in your personal knowledge library.
        </Text>
        <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Ionicons name={type === "url" ? "link-outline" : "document-text-outline"} size={18} color={themeColors.primary} />
            <Text style={{ color: themeColors.text.secondary, fontSize: 12, fontWeight: "800", marginLeft: 8, textTransform: "uppercase" }}>
              {type === "url" ? "Shared link" : "Shared text"}
            </Text>
          </View>
          <Text selectable style={{ color: themeColors.text.primary, fontSize: 16, fontWeight: "800", marginBottom: 10 }}>{title}</Text>
          <Text selectable style={{ color: themeColors.text.secondary, fontSize: 14, lineHeight: 21 }} numberOfLines={8}>{sharedText || "No shared text was received."}</Text>
        </View>
        {duplicate ? (
          <View style={{ flexDirection: "row", alignItems: "center", padding: 13, borderRadius: 14, backgroundColor: `${themeColors.primary}12`, marginBottom: 16 }}>
            <Ionicons name="checkmark-circle-outline" size={20} color={themeColors.primary} />
            <Text style={{ color: themeColors.text.primary, flex: 1, marginLeft: 9, fontSize: 13 }}>This content may already be in your library. You can still save another copy.</Text>
          </View>
        ) : null}
        <Pressable disabled={!sharedText || saving || saved} onPress={saveSharedContent} style={{ backgroundColor: !sharedText || saving || saved ? themeColors.border : themeColors.primary, borderRadius: 16, minHeight: 54, alignItems: "center", justifyContent: "center", flexDirection: "row", marginTop: 4 }}>
          <Ionicons name={saved ? "checkmark-circle" : "bookmark-outline"} size={19} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "800", marginLeft: 9 }}>{saving ? "Saving…" : saved ? "Saved" : duplicate ? "Save anyway" : "Save to Knowledge"}</Text>
        </Pressable>
        <Text style={{ color: themeColors.text.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 14 }}>
          Shared content is sent to your Magnet account for processing and search.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
