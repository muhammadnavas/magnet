import React from "react";
import { View, Text, ScrollView, Pressable, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import colors from "../../constants/colors";
import Card from "../../components/ui/Card";
import useKnowledge from "../../hooks/useKnowledge";
import useAuth from "../../hooks/useAuth";
import useChat from "../../hooks/useChat";
import api from "../../lib/api";

const QUICK_CAPTURE_ACTIONS = [
  { label: "PDF", icon: "document-text", color: "#6C63FF", type: "pdf" },
  { label: "Screenshot", icon: "image", color: "#00E5A0", type: "image" },
  { label: "Note", icon: "pencil", color: "#A0A0B8", type: "note" },
  { label: "URL", icon: "link", color: "#FF9F43", type: "url" },
  { label: "Code", icon: "code-working", color: "#00D4FF", type: "code" },
  { label: "Voice", icon: "mic", color: "#6C63FF", type: "voice" },
  { label: "Error", icon: "bug", color: "#FF6B6B", type: "error" },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const { useGetItems } = useKnowledge();
  const { data: knowledgeItems = [] } = useGetItems();
  const { conversations } = useChat();

  // Fetch real insights dynamically from API
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

  // Compute real dynamic stats
  const uniqueProjectsCount = [...new Set(knowledgeItems.map(i => i.project))].filter(Boolean).length;
  const uniqueTagsCount = [...new Set(knowledgeItems.flatMap(i => i.tags))].filter(Boolean).length;

  const stats = [
    { label: "Knowledge", count: knowledgeItems.length, icon: "bulb-outline" },
    { label: "Documents", count: knowledgeItems.filter(i => i.contentType === "pdf").length, icon: "document-text-outline" },
    { label: "Projects", count: uniqueProjectsCount, icon: "folder-outline" },
    { label: "Topics", count: uniqueTagsCount, icon: "pricetags-outline" },
    { label: "Conversations", count: conversations.length, icon: "chatbubbles-outline" },
  ];

  const recentItems = knowledgeItems.slice(0, 3);

  const aiInsights = insightsData.map(insight => insight.message);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Header Greeting */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-text-secondary text-xs font-semibold uppercase tracking-widest mb-1">
              Welcome back
            </Text>
            <Text className="text-white text-xl font-black">
              Good evening, {username} 👋
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/profile")}
            className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
          >
            <Ionicons name="person" size={18} color={colors.text.secondary} />
          </Pressable>
        </View>

        {/* Quick Capture Panel */}
        <Text className="text-white text-sm font-bold uppercase tracking-wider mb-3">
          Quick Capture
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row mb-6 -mx-5 px-5"
        >
          {QUICK_CAPTURE_ACTIONS.map((action, idx) => (
            <Pressable
              key={`${action.label}-${idx}`}
              onPress={() => router.push({ pathname: "/capture", params: { selectType: action.type } })}
              style={({ pressed }) => [
                pressed ? { opacity: 0.8, transform: [{ scale: 0.96 }] } : {}
              ]}
              className="items-center mr-4"
            >
              <View
                style={{ backgroundColor: `${action.color}15` }}
                className="w-12 h-12 rounded-xl items-center justify-center mb-2 border border-border/40"
              >
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-wider">
                {action.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Knowledge Statistics Grid */}
        <Text className="text-white text-sm font-bold uppercase tracking-wider mb-3">
          Library Stats
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row mb-6 -mx-5 px-5"
        >
          {stats.map((stat, idx) => (
            <Card key={`${stat.label}-${idx}`} className="p-3 mr-3 items-center justify-center min-w-[90px] h-[85px]">
              <Ionicons name={stat.icon} size={18} color={colors.primaryLight} className="mb-1" />
              <Text className="text-white text-base font-black mb-0.5">{stat.count}</Text>
              <Text className="text-text-muted text-[8px] font-bold uppercase tracking-wider">{stat.label}</Text>
            </Card>
          ))}
        </ScrollView>

        {/* AI Insights Panel */}
        <Text className="text-white text-sm font-bold uppercase tracking-wider mb-3">
          AI Insights
        </Text>
        <View className="mb-6">
          {aiInsights.map((insight, idx) => (
            <Card key={`insight-${idx}`} className="p-3 mb-2 flex-row items-center border border-primary/10">
              <View className="w-6 h-6 rounded-lg bg-primary/10 items-center justify-center mr-3">
                <Ionicons name="sparkles" size={12} color={colors.primaryLight} />
              </View>
              <Text className="text-text-secondary text-xs flex-1 font-medium leading-relaxed">
                {insight}
              </Text>
            </Card>
          ))}
        </View>

        {/* Recent Knowledge */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white text-sm font-bold uppercase tracking-wider">
            Recent Additions
          </Text>
          <Pressable onPress={() => router.push("/knowledge")}>
            <Text className="text-primary-light text-xs font-semibold">View All</Text>
          </Pressable>
        </View>
        <View className="mb-10">
          {recentItems.map((item) => (
            <Pressable key={item.id} onPress={() => router.push(`/knowledge/${item.id}`)} className="mb-2">
              <Card className="p-3.5 flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-8 h-8 rounded-lg bg-surface-hover border border-border items-center justify-center mr-3">
                    <Ionicons
                      name={
                        item.contentType === "pdf"
                          ? "document-text"
                          : item.contentType === "code"
                          ? "code-working"
                          : item.contentType === "error"
                          ? "bug"
                          : "pencil"
                      }
                      size={16}
                      color={colors.primaryLight}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-xs font-bold mb-0.5" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text className="text-text-muted text-[10px]" numberOfLines={1}>
                      {item.summary}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.text.muted} />
              </Card>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
