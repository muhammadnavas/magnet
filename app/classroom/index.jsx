import React, { useEffect, useState, useCallback } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { useAppTheme } from "../../store/themeStore";
import api from "../../lib/api";

const DUE_STATUS_CONFIG = {
  overdue: { label: "Overdue", color: "#EF4444", icon: "alert-circle-outline" },
  due_soon: { label: "Due Soon", color: "#F59E0B", icon: "time-outline" },
  upcoming: { label: "Upcoming", color: "#10B981", icon: "checkmark-circle-outline" },
  no_due_date: { label: "No Due Date", color: "#6B7280", icon: "remove-circle-outline" },
};

export default function ClassroomScreen() {
  const { themeColors } = useAppTheme();
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectLoading, setConnectLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Counts for status bar ──────────────────────────────────────────────
  const newCount = assignments.filter((a) => a.due_status === "upcoming").length;
  const dueSoonCount = assignments.filter((a) => a.due_status === "due_soon").length;
  const overdueCount = assignments.filter((a) => a.due_status === "overdue").length;

  const STATUS_CARDS = [
    { label: "Upcoming", value: String(newCount), icon: "sparkles-outline", color: "#10B981" },
    { label: "Due Soon", value: String(dueSoonCount), icon: "time-outline", color: "#F59E0B" },
    { label: "Overdue", value: String(overdueCount), icon: "alert-circle-outline", color: "#EF4444" },
  ];

  // ── Load status + data ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const statusRes = await api.get("/classroom/status");
      const isConnected = Boolean(statusRes.data?.connected);
      setConnected(isConnected);
      setEmail(statusRes.data?.email || "");

      if (isConnected) {
        const [coursesRes, assignmentsRes] = await Promise.all([
          api.get("/classroom/courses"),
          api.get("/classroom/assignments"),
        ]);
        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
        setAssignments(Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []);
      } else {
        setCourses([]);
        setAssignments([]);
      }
    } catch (error) {
      console.log("[CLASSROOM]", error?.response?.data || error?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Deep-link callback listener ────────────────────────────────────────
  useEffect(() => {
    loadData();

    const handleCallback = ({ url }) => {
      if (!url?.startsWith("orio://classroom/callback")) return;
      try {
        const parsed = new URL(url);
        const isConnected = parsed.searchParams.get("connected") === "true";
        const cbError = parsed.searchParams.get("error");
        if (isConnected) {
          loadData();
        } else if (cbError) {
          Alert.alert("Google Classroom", `Connection failed: ${cbError}`);
        }
      } catch (e) {
        console.log("[CLASSROOM CALLBACK]", e);
      }
    };

    const subscription = Linking.addEventListener("url", handleCallback);
    Linking.getInitialURL()
      .then((url) => url && handleCallback({ url }))
      .catch(() => {});
    return () => subscription.remove();
  }, [loadData]);

  // ── Connect ────────────────────────────────────────────────────────────
  const connectClassroom = async () => {
    try {
      setConnectLoading(true);
      const res = await api.get("/classroom/authorize");
      await Linking.openURL(res.data.authorization_url);
    } catch (error) {
      Alert.alert(
        "Google Classroom",
        error?.response?.data?.detail || "Could not start Google authorization."
      );
    } finally {
      setConnectLoading(false);
    }
  };

  // ── Disconnect ─────────────────────────────────────────────────────────
  const disconnectClassroom = () =>
    Alert.alert(
      "Disconnect Google Classroom?",
      "Orio will stop syncing your assignments and courses.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await api.post("/classroom/disconnect");
              setConnected(false);
              setEmail("");
              setCourses([]);
              setAssignments([]);
            } catch (error) {
              Alert.alert(
                "Google Classroom",
                error?.response?.data?.detail || "Could not disconnect."
              );
            }
          },
        },
      ]
    );

  // ── Format due date ────────────────────────────────────────────────────
  const formatDue = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1">
      <ScrollView
        className="flex-1 px-5 pt-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={themeColors.primary}
          />
        }
      >
        {/* ── Header ── */}
        <View className="flex-row items-center mb-6">
          <Pressable
            onPress={() => router.back()}
            style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }}
            className="w-10 h-10 rounded-xl border items-center justify-center mr-3"
          >
            <Ionicons name="arrow-back" size={20} color={themeColors.text.primary} />
          </Pressable>
          <View className="flex-1">
            <Text style={{ color: themeColors.primary }} className="text-xs font-bold uppercase tracking-widest mb-1">
              College
            </Text>
            <Text style={{ color: themeColors.text.primary }} className="text-2xl font-black">
              Google Classroom
            </Text>
          </View>
          <View style={{ backgroundColor: themeColors.surfaceHover }} className="w-10 h-10 rounded-xl items-center justify-center">
            <Ionicons name="school-outline" size={21} color={themeColors.primary} />
          </View>
        </View>

        {/* ── Connection status card ── */}
        <Card className="p-5 mb-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-3">
              <View
                style={{ backgroundColor: `${themeColors.primary}18`, borderColor: `${themeColors.primary}35` }}
                className="w-11 h-11 rounded-2xl border items-center justify-center mr-3"
              >
                <Ionicons name="school" size={21} color={themeColors.primary} />
              </View>
              <View className="flex-1">
                <Text style={{ color: themeColors.text.primary }} className="text-sm font-extrabold">
                  {connected ? email : "Not Connected"}
                </Text>
                <Text style={{ color: themeColors.text.muted }} className="text-[11px] mt-0.5">
                  {connected ? `${courses.length} courses · ${assignments.length} assignments` : "Link your Google account to sync assignments"}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center">
              <View
                style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: connected ? "#10B981" : "#EF4444", marginRight: 6 }}
              />
              <Text style={{ color: connected ? "#10B981" : "#EF4444" }} className="text-xs font-bold">
                {connected ? "Connected" : "Offline"}
              </Text>
            </View>
          </View>
        </Card>

        {/* ── Not connected state ── */}
        {!connected ? (
          <Card className="p-7 mb-10 items-center">
            <View
              style={{ backgroundColor: `${themeColors.primary}15` }}
              className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
            >
              <Ionicons name="school" size={32} color={themeColors.primary} />
            </View>
            <Text style={{ color: themeColors.text.primary }} className="text-base font-extrabold text-center">
              Connect Google Classroom
            </Text>
            <Text
              style={{ color: themeColors.text.muted }}
              className="text-xs text-center mt-2 mb-5 leading-5"
            >
              Orio will import your courses and assignments, calculate deadlines, and create tasks automatically.
            </Text>
            <Button
              variant="primary"
              onPress={connectClassroom}
              disabled={connectLoading}
            >
              {connectLoading ? "Opening Google..." : "Connect with Google"}
            </Button>
          </Card>
        ) : loading ? (
          <Card className="p-6 items-center mb-6">
            <Text style={{ color: themeColors.text.muted }} className="text-sm">
              Loading courses and assignments...
            </Text>
          </Card>
        ) : (
          <>
            {/* ── Stats bar ── */}
            <View className="flex-row gap-2 mb-6">
              {STATUS_CARDS.map((item) => (
                <View
                  key={item.label}
                  style={{ flex: 1, backgroundColor: themeColors.card, borderColor: themeColors.border }}
                  className="border rounded-2xl p-3"
                >
                  <Ionicons name={item.icon} size={17} color={item.color} />
                  <Text style={{ color: themeColors.text.primary }} className="text-xl font-black mt-2">
                    {item.value}
                  </Text>
                  <Text style={{ color: themeColors.text.muted }} className="text-[10px] font-bold mt-1">
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* ── Needs attention ── */}
            {(overdueCount > 0 || dueSoonCount > 0) && (
              <>
                <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">
                  Needs Attention
                </Text>
                <View className="mb-6">
                  {assignments
                    .filter((a) => a.due_status === "overdue" || a.due_status === "due_soon")
                    .map((a) => {
                      const cfg = DUE_STATUS_CONFIG[a.due_status];
                      return (
                        <Pressable key={a.id} onPress={() => a.alternate_link && Linking.openURL(a.alternate_link)} className="mb-2">
                          <Card className="p-4">
                            <View className="flex-row items-center">
                              <View
                                style={{ backgroundColor: `${cfg.color}18`, width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 }}
                              >
                                <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                              </View>
                              <View className="flex-1 mr-2">
                                <Text style={{ color: themeColors.text.primary }} className="text-sm font-bold" numberOfLines={1}>
                                  {a.title}
                                </Text>
                                <Text style={{ color: themeColors.text.muted }} className="text-[11px] mt-0.5" numberOfLines={1}>
                                  {a.course_name}
                                </Text>
                              </View>
                              <View style={{ alignItems: "flex-end" }}>
                                <Text style={{ color: cfg.color }} className="text-[10px] font-bold">
                                  {cfg.label}
                                </Text>
                                {a.due_date && (
                                  <Text style={{ color: themeColors.text.muted }} className="text-[10px] mt-0.5">
                                    {formatDue(a.due_date)}
                                  </Text>
                                )}
                              </View>
                            </View>
                          </Card>
                        </Pressable>
                      );
                    })}
                </View>
              </>
            )}

            {/* ── All assignments ── */}
            <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">
              All Assignments
            </Text>
            {assignments.length === 0 ? (
              <Card className="p-6 items-center mb-6">
                <Ionicons name="checkmark-done-outline" size={28} color={themeColors.text.muted} />
                <Text style={{ color: themeColors.text.muted }} className="text-sm text-center mt-2">
                  No assignments found in active courses.
                </Text>
              </Card>
            ) : (
              <View className="mb-4">
                {assignments.map((a) => {
                  const cfg = DUE_STATUS_CONFIG[a.due_status] || DUE_STATUS_CONFIG.no_due_date;
                  return (
                    <Pressable key={a.id} onPress={() => a.alternate_link && Linking.openURL(a.alternate_link)} className="mb-2">
                      <Card className="p-4">
                        <View className="flex-row items-center">
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ color: themeColors.text.primary }} className="text-sm font-bold" numberOfLines={1}>
                              {a.title}
                            </Text>
                            <Text style={{ color: themeColors.text.secondary }} className="text-[11px] mt-0.5" numberOfLines={1}>
                              {a.course_name}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <View style={{ backgroundColor: `${cfg.color}18`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                              <Text style={{ color: cfg.color }} className="text-[10px] font-bold">
                                {cfg.label}
                              </Text>
                            </View>
                            {a.due_date && (
                              <Text style={{ color: themeColors.text.muted }} className="text-[10px] mt-1">
                                {formatDue(a.due_date)}
                              </Text>
                            )}
                          </View>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* ── Disconnect ── */}
            <View className="mb-10 mt-2">
              <Pressable onPress={disconnectClassroom}>
                <Text style={{ color: "#EF4444" }} className="text-xs font-bold text-center">
                  Disconnect Google Classroom
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
