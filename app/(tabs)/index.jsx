import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Card from "../../components/ui/Card";
import Tag from "../../components/ui/Tag";
import EmptyState from "../../components/ui/EmptyState";
import useKnowledge from "../../hooks/useKnowledge";
import useAuth from "../../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import api from "../../lib/api";
import Logo from "../../components/ui/Logo";
import { useAppTheme } from "../../store/themeStore";
import { notifyNewAssignment, syncClassroomDeadlineNotifications } from "../../lib/notifications";

const SEEN_KEY = "orio_classroom_seen_ids";


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
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState("");
  const [githubRepoCount, setGithubRepoCount] = useState(null);
  const [classroomConnected, setClassroomConnected]   = useState(false);
  const [classroomOverdue,   setClassroomOverdue]     = useState(0);
  const [classroomDueSoon,   setClassroomDueSoon]     = useState(0);


  const { data: insightsData = [] } = useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      try {
        const response = await api.get("/insights");
        return response.data;
      } catch (e) { return []; }
    }
  });

  const loadGithubSummary = async () => {
    try {
      const status = await api.get("/github/status");
      const connected = Boolean(status.data?.connected);
      setGithubConnected(connected);
      setGithubUsername(status.data?.username || "");
      if (connected) {
        const response = await api.get("/github/repos");
        setGithubRepoCount(Array.isArray(response.data) ? response.data.length : null);
      } else {
        setGithubRepoCount(null);
      }
    } catch (e) {
      setGithubConnected(false);
      setGithubUsername("");
      setGithubRepoCount(null);
    }
  };

  const checkClassroomNotifications = async () => {
    try {
      const statusRes = await api.get("/classroom/status");
      const isConnected = Boolean(statusRes.data?.connected);
      setClassroomConnected(isConnected);
      if (!isConnected) {
        await syncClassroomDeadlineNotifications([], []);
        setClassroomOverdue(0);
        setClassroomDueSoon(0);
        return;
      }

      const assignmentsRes = await api.get("/classroom/assignments");
      const all = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : [];

      const doneRaw = await AsyncStorage.getItem("orio_classroom_done_ids");
      const doneIds = new Set(doneRaw ? JSON.parse(doneRaw).map(String) : []);
      await syncClassroomDeadlineNotifications(all, [...doneIds]);
      const isDone = (a) => doneIds.has(String(a.course_id || "") + ":" + String(a.id))
        || doneIds.has(a.id) || ["TURNED_IN", "RETURNED"].includes(a.submission_state);
      setClassroomOverdue(all.filter((a) => a.due_status === "overdue" && !isDone(a)).length);
      setClassroomDueSoon(all.filter((a) => a.due_status === "due_soon" && !isDone(a)).length);

      // Notify about new assignments
      const raw     = await AsyncStorage.getItem(SEEN_KEY);
      const seenIds = new Set(raw ? JSON.parse(raw) : []);
      const assignmentKey = (a) => String(a.course_id || "") + ":" + String(a.id);
      const newOnes = all.filter((a) => !seenIds.has(assignmentKey(a)) && !seenIds.has(a.id));
      if (seenIds.size > 0 && newOnes.length > 0) {
        for (const a of newOnes) {
          await notifyNewAssignment(a.title, a.course_name, a.alternate_link);
        }
      }
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(all.map(assignmentKey)));
    } catch (_) {}
  };

  useFocusEffect(useCallback(() => {
    loadGithubSummary();
    checkClassroomNotifications();
  }, []));


  const username = user?.full_name && user.full_name !== "Personal User" ? user.full_name : "Navas";
  const itemsList = Array.isArray(knowledgeItems) ? knowledgeItems : [];
  const insightsList = Array.isArray(insightsData) ? insightsData : [];
  const recentItems = itemsList.slice(0, 3);
  const aiInsights = insightsList.map(insight => insight.message || "");

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1">
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Logo size="md" className="mb-1" />
            <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-widest">Good evening, {username} 👋</Text>
          </View>
          <Pressable onPress={() => router.push("/profile")} style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }} className="w-11 h-11 rounded-2xl border items-center justify-center">
            <Ionicons name="settings-outline" size={20} color={themeColors.primary} />
          </Pressable>
        </View>

        <Pressable onPress={() => router.push("/classroom")} className="mb-4">
          <Card className="p-4">
            <View className="flex-row items-center">
              <View style={{ backgroundColor: `${themeColors.primary}18`, borderColor: `${themeColors.primary}35` }} className="w-11 h-11 rounded-2xl border items-center justify-center mr-3">
                <Ionicons name="school-outline" size={21} color={themeColors.primary} />
              </View>
              <View className="flex-1">
                <Text style={{ color: themeColors.text.primary }} className="text-sm font-extrabold">Google Classroom</Text>
                {classroomConnected ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    {classroomOverdue > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: themeColors.error }} />
                        <Text style={{ color: themeColors.error, fontSize: 10, fontWeight: "700" }}>
                          {classroomOverdue} overdue
                        </Text>
                      </View>
                    )}
                    {classroomDueSoon > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: themeColors.warning }} />
                        <Text style={{ color: themeColors.warning, fontSize: 10, fontWeight: "700" }}>
                          {classroomDueSoon} due soon
                        </Text>
                      </View>
                    )}
                    {classroomOverdue === 0 && classroomDueSoon === 0 && (
                      <Text style={{ color: themeColors.success, fontSize: 10, fontWeight: "700" }}>All caught up ✓</Text>
                    )}
                  </View>
                ) : (
                  <Text style={{ color: themeColors.text.muted }} className="text-[11px] mt-1">Assignments &amp; deadlines</Text>
                )}
              </View>
              <View className="items-end">
                {classroomConnected && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: themeColors.success }} />
                    <Text style={{ color: themeColors.success, fontSize: 10, fontWeight: "700" }}>LIVE</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={themeColors.primary} />
              </View>
            </View>
          </Card>
        </Pressable>


        <Pressable onPress={() => router.push("/github")} className="mb-7">
          <Card className="p-4">
            <View className="flex-row items-center">
              <View style={{ backgroundColor: themeColors.surfaceHover, borderColor: themeColors.border }} className="w-11 h-11 rounded-2xl border items-center justify-center mr-3"><Ionicons name="logo-github" size={22} color={themeColors.text.primary} /></View>
              <View className="flex-1"><Text style={{ color: themeColors.text.primary }} className="text-sm font-extrabold">GitHub Projects</Text>{githubConnected && <Text style={{ color: themeColors.text.muted }} className="text-[11px] mt-1" numberOfLines={1}>{`${githubRepoCount == null ? "Repositories connected" : `${githubRepoCount} repositories`}${githubUsername ? ` · @${githubUsername}` : ""}`}</Text>}</View>
              <View className="items-end"><Ionicons name="chevron-forward" size={16} color={themeColors.primary} /></View>
            </View>
          </Card>
        </Pressable>

        <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">Quick Capture</Text>
        <View className="flex-row gap-3 mb-8">{QUICK_ACTIONS.map((action) => <Pressable key={action.id} onPress={() => router.push({ pathname: "/capture", params: { selectType: action.type } })} style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }} className="flex-1 border p-4 rounded-2xl items-center justify-center"><View style={{ backgroundColor: `${action.color}18` }} className="w-10 h-10 rounded-xl items-center justify-center mb-2"><Ionicons name={action.icon} size={20} color={action.color} /></View><Text style={{ color: themeColors.text.primary }} className="text-xs font-bold text-center">{action.label}</Text></Pressable>)}</View>

        {aiInsights.length > 0 && <View className="mb-8"><Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">AI Insights</Text>{aiInsights.map((insight, idx) => <View key={idx} style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }} className="border p-4 rounded-2xl mb-2"><View className="flex-row items-start"><Ionicons name="sparkles" size={14} color={themeColors.primary} style={{ marginRight: 8, marginTop: 2 }} /><Text style={{ color: themeColors.text.secondary }} className="text-xs leading-relaxed flex-1">{insight}</Text></View></View>)}</View>}

        <View className="flex-row items-center justify-between mb-3"><Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider">Recent Additions</Text><Pressable onPress={() => router.push("/knowledge")}><Text style={{ color: themeColors.primary }} className="text-xs font-bold">View All</Text></Pressable></View>
        {recentItems.length === 0 ? <EmptyState title="No knowledge items yet" description="Use Quick Capture above to add your first note, link, code snippet, or PDF document." actionLabel="Capture Content" onActionPress={() => router.push("/capture")} /> : <View className="gap-3 mb-10">{recentItems.map((item) => <Pressable key={item.id} onPress={() => router.push(`/knowledge/${item.id}`)}><Card className="p-4 flex-row items-center justify-between"><View className="flex-1 mr-3"><Text style={{ color: themeColors.text.primary }} className="text-sm font-bold mb-1" numberOfLines={1}>{item.title}</Text><Text style={{ color: themeColors.text.secondary }} className="text-xs" numberOfLines={2}>{item.summary || item.rawContent}</Text></View><Tag text={item.contentType} size="sm" /></Card></Pressable>)}</View>}
      </ScrollView>
    </SafeAreaView>
  );
}
