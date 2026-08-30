import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import Card from "../../components/ui/Card";
import Tag from "../../components/ui/Tag";
import EmptyState from "../../components/ui/EmptyState";
import useKnowledge from "../../hooks/useKnowledge";
import useAuth from "../../hooks/useAuth";
import useChat from "../../hooks/useChat";
import { useQuery } from "@tanstack/react-query";
import api from "../../lib/api";

const QUICK_ACTIONS = [
  { id: "text", label: "Typed Input", icon: "pencil", type: "note", color: "#A0A0B8" },
  { id: "pdf", label: "Upload PDF", icon: "document-text", type: "pdf", color: "#6C63FF" },
  { id: "image", label: "Upload Image", icon: "image", type: "image", color: "#00E5A0" },
];

import Logo from "../../components/ui/Logo";
import useThemeStore from "../../store/themeStore";

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors: themeColors } = useThemeStore();
  const { useGetItems } = useKnowledge();
  const { conversations } = useChat();
  const { data: knowledgeItems = [] } = useGetItems();

  const { data: insightsData = [] } = useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      try {
        const response = await api.get("/insights");
        return response.data;
      } catch (e) {
        return [];
      }
    }
  });

  const username = user?.full_name || "Navas";

  // Compute real dynamic stats with defensive array verification
  const itemsList = Array.isArray(knowledgeItems) ? knowledgeItems : [];
  const convsList = Array.isArray(conversations) ? conversations : [];
  const insightsList = Array.isArray(insightsData) ? insightsData : [];

  const uniqueProjectsCount = [...new Set(itemsList.map(i => i.project))].filter(Boolean).length;
  const uniqueTagsCount = [...new Set(itemsList.flatMap(i => i.tags))].filter(Boolean).length;

  const stats = [
    { label: "Knowledge", count: itemsList.length, icon: "bulb-outline" },
    { label: "Documents", count: itemsList.filter(i => i.contentType === "pdf").length, icon: "document-text-outline" },
    { label: "Projects", count: uniqueProjectsCount, icon: "folder-outline" },
    { label: "Topics", count: uniqueTagsCount, icon: "pricetags-outline" },
  ];

  const recentItems = itemsList.slice(0, 3);
  const aiInsights = insightsList.map(insight => insight.message || "");

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1">
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        {/* User Greeting Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Logo size="md" className="mb-1" />
            <Text className="text-text-muted text-xs font-bold uppercase tracking-widest">
              Good evening, {username} 👋
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/profile")}
            className="w-11 h-11 rounded-2xl bg-surface border border-border items-center justify-center"
          >
            <Ionicons name="settings-outline" size={20} color={colors.primaryLight} />
          </Pressable>
        </View>

        {/* Quick Capture Generalized Section */}
        <Text className="text-white text-sm font-bold uppercase tracking-wider mb-3">
          Quick Capture
        </Text>
        <View className="flex-row gap-3 mb-8">
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.id}
              onPress={() => router.push({ pathname: "/capture", params: { selectType: action.type } })}
              className="flex-1 bg-card border border-border p-4 rounded-2xl items-center justify-center active:opacity-80"
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: `${action.color}15` }}>
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <Text className="text-white text-xs font-bold text-center">
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Library Stats Section - Comfortable 2x2 Grid */}
        <Text className="text-white text-sm font-bold uppercase tracking-wider mb-3">
          Library Stats
        </Text>
        <View className="flex-row flex-wrap gap-3 mb-8">
          {stats.map((stat) => (
            <View key={stat.label} className="w-[48%] bg-card border border-border p-4 rounded-2xl">
              <View className="flex-row items-center justify-between mb-3">
                <Ionicons name={stat.icon} size={20} color={colors.primaryLight} />
                <Text className="text-text-muted text-xs font-bold uppercase">{stat.label}</Text>
              </View>
              <Text className="text-white text-2xl font-black">{stat.count}</Text>
            </View>
          ))}
        </View>

        {/* AI Insights Card Section */}
        {aiInsights.length > 0 && (
          <View className="mb-8">
            <Text className="text-white text-sm font-bold uppercase tracking-wider mb-3">
              AI Insights
            </Text>
            {aiInsights.map((insight, idx) => (
              <Card key={idx} className="p-4 mb-2.5 border-l-4 border-l-primary bg-primary/5">
                <View className="flex-row items-start">
                  <Ionicons name="sparkles" size={16} color={colors.primaryLight} className="mr-3 mt-0.5" />
                  <Text className="text-text-secondary text-xs leading-relaxed font-medium flex-1">
                    {insight}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Recent Additions List */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white text-sm font-bold uppercase tracking-wider">
            Recent Additions
          </Text>
          <Pressable onPress={() => router.push("/knowledge")}>
            <Text className="text-primary-light text-xs font-bold">View All</Text>
          </Pressable>
        </View>

        {recentItems.length === 0 ? (
          <EmptyState
            title="No knowledge items yet"
            description="Use Quick Capture above to add your first note, link, code snippet, or PDF document."
            actionLabel="Capture Content"
            onAction={() => router.push("/capture")}
          />
        ) : (
          <View className="gap-3 mb-10">
            {recentItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/knowledge/${item.id}`)}
              >
                <Card className="p-4 flex-row items-center justify-between border border-border">
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center mb-1">
                      <Ionicons
                        name={
                          item.contentType === "pdf" ? "document-text" :
                            item.contentType === "code" ? "code-working" :
                              item.contentType === "url" ? "link" : "pencil"
                        }
                        size={14}
                        color={colors.primaryLight}
                        className="mr-2"
                      />
                      <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider">
                        {item.project}
                      </Text>
                    </View>
                    <Text className="text-white text-sm font-bold mb-1" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text className="text-text-secondary text-xs" numberOfLines={2}>
                      {item.summary || item.rawContent}
                    </Text>
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
