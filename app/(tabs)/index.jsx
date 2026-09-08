import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Card from "../../components/ui/Card";
import Tag from "../../components/ui/Tag";
import EmptyState from "../../components/ui/EmptyState";
import useKnowledge from "../../hooks/useKnowledge";
import useAuth from "../../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import api from "../../lib/api";
import Logo from "../../components/ui/Logo";
import { useAppTheme } from "../../store/themeStore";

const QUICK_ACTIONS = [
  { id: "text", label: "Typed Input", icon: "pencil", type: "note", color: "#6C63FF" },
  { id: "pdf", label: "Upload PDF", icon: "document-text", type: "pdf", color: "#0284C7" },
  { id: "image", label: "Upload Image", icon: "image", type: "image", color: "#059669" },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const { themeColors } = useAppTheme();
  const { useGetItems } = useKnowledge();
  const { data: knowledgeItems = [] } = useGetItems();

  const { data: insightsData = [] } = useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      try {
        const response = await api.get("/insights");
        return response.data;
      } catch (e) { return []; }
    }
  });

  const username = user?.full_name && user.full_name !== "Personal User"
    ? user.full_name
    : "Navas";
  const itemsList = Array.isArray(knowledgeItems) ? knowledgeItems : [];
  const insightsList = Array.isArray(insightsData) ? insightsData : [];

  const recentItems = itemsList.slice(0, 3);
  const aiInsights = insightsList.map(insight => insight.message || "");

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1">
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Logo size="md" className="mb-1" />
            <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-widest">
              Good evening, {username} 👋
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/profile")}
            style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }}
            className="w-11 h-11 rounded-2xl border items-center justify-center"
          >
            <Ionicons name="settings-outline" size={20} color={themeColors.primary} />
          </Pressable>
        </View>

        {/* Quick Capture */}
        <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">Quick Capture</Text>
        <View className="flex-row gap-3 mb-8">
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.id}
              onPress={() => router.push({ pathname: "/capture", params: { selectType: action.type } })}
              style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }}
              className="flex-1 border p-4 rounded-2xl items-center justify-center"
            >
              <View style={{ backgroundColor: `${action.color}18` }} className="w-10 h-10 rounded-xl items-center justify-center mb-2">
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold text-center">{action.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* AI Insights */}
        {aiInsights.length > 0 && (
          <View className="mb-8">
            <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">AI Insights</Text>
            {aiInsights.map((insight, idx) => (
              <View key={idx} style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }} className="border p-4 rounded-2xl mb-2">
                <View className="flex-row items-start">
                  <Ionicons name="sparkles" size={14} color={themeColors.primary} style={{ marginRight: 8, marginTop: 2 }} />
                  <Text style={{ color: themeColors.text.secondary }} className="text-xs leading-relaxed flex-1">{insight}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Additions */}
        <View className="flex-row items-center justify-between mb-3">
          <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider">Recent Additions</Text>
          <Pressable onPress={() => router.push("/knowledge")}>
            <Text style={{ color: themeColors.primary }} className="text-xs font-bold">View All</Text>
          </Pressable>
        </View>

        {recentItems.length === 0 ? (
          <EmptyState
            title="No knowledge items yet"
            description="Use Quick Capture above to add your first note, link, code snippet, or PDF document."
            actionLabel="Capture Content"
            onActionPress={() => router.push("/capture")}
          />
        ) : (
          <View className="gap-3 mb-10">
            {recentItems.map((item) => (
              <Pressable key={item.id} onPress={() => router.push(`/knowledge/${item.id}`)}>
                <Card className="p-4 flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text style={{ color: themeColors.text.primary }} className="text-sm font-bold mb-1" numberOfLines={1}>{item.title}</Text>
                    <Text style={{ color: themeColors.text.secondary }} className="text-xs" numberOfLines={2}>{item.summary || item.rawContent}</Text>
                  </View>
                  <Tag text={item.contentType} size="sm" />
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
