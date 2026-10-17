import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Alert,
  Animated,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Button from "../../components/ui/Button";
import { useAppTheme } from "../../store/themeStore";
import { notifyNewAssignment } from "../../lib/notifications";
import api from "../../lib/api";

// ─── Status config (resolved at runtime with theme colors) ─────────────────
const getDueStatusConfig = (tc) => ({
  overdue:      { label: "Overdue",     color: tc.error,      icon: "alert-circle" },
  due_soon:     { label: "Due Soon",    color: tc.warning,    icon: "time" },
  upcoming:     { label: "Upcoming",    color: tc.success,    icon: "checkmark-circle" },
  no_due_date:  { label: "No Due Date", color: tc.text.muted, icon: "remove-circle-outline" },
});

// ─── Submission state config ────────────────────────────────────────────────
const SUBMISSION_CONFIG = {
  TURNED_IN:           { label: "Submitted",  icon: "checkmark-circle",   official: true  },
  RETURNED:            { label: "Graded",      icon: "ribbon",              official: true  },
  CREATED:             { label: "In Progress", icon: "create-outline",      official: false },
  RECLAIMED_BY_STUDENT:{ label: "Unsubmitted",icon: "arrow-undo-outline",  official: false },
  NEW:                 { label: "Not Started", icon: "ellipse-outline",     official: false },
};

const SEEN_KEY   = "orio_classroom_seen_ids";
const DONE_KEY   = "orio_classroom_done_ids";


const WORK_TYPE_ICONS = {
  ASSIGNMENT:              "document-text-outline",
  QUIZ:                    "help-circle-outline",
  QUESTION:                "chatbubble-question-outline",
  MATERIAL:                "book-outline",
  SHORT_ANSWER_QUESTION:   "create-outline",
  MULTIPLE_CHOICE_QUESTION:"list-outline",
};

// ─── Countdown helper ───────────────────────────────────────────────────────
function getCountdown(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - new Date();
  if (diff <= 0) {
    const abs = Math.abs(diff);
    const d = Math.floor(abs / 86400000);
    if (d > 0) return `${d}d overdue`;
    const h = Math.floor(abs / 3600000);
    if (h > 0) return `${h}h overdue`;
    return "Just overdue";
  }
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d left`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h left`;
  const m = Math.floor(diff / 60000);
  return `${m}m left`;
}

function formatDue(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ item, tc }) {
  const anim = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: anim }] }}>
      <Pressable
        onPressIn={() => Animated.spring(anim, { toValue: 0.93, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start()}
        style={{
          backgroundColor: tc.card,
          borderRadius: 18,
          padding: 14,
          borderWidth: 1,
          borderColor: tc.border,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ backgroundColor: tc.surfaceHover, padding: 7, borderRadius: 12 }}>
            <Ionicons name={item.icon} size={18} color={item.color} />
          </View>
          <Text style={{ color: item.color, fontSize: 22, fontWeight: "900" }}>{item.value}</Text>
        </View>
        <Text style={{ color: tc.text.muted, fontSize: 11, fontWeight: "700", marginTop: 10 }}>
          {item.label.toUpperCase()}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Assignment card ────────────────────────────────────────────────────────
function AssignmentCard({ a, tc, localDone, onToggleDone }) {
  const DSC      = getDueStatusConfig(tc);
  const markedDone = localDone || SUBMISSION_CONFIG[a.submission_state]?.official;
  const cfg      = markedDone ? { label: "Done", color: tc.success, icon: "checkmark-circle" } : (DSC[a.due_status] || DSC.no_due_date);
  const countdown = getCountdown(a.due_date);
  const typeIcon  = WORK_TYPE_ICONS[a.work_type] || "document-text-outline";
  const anim      = useRef(new Animated.Value(1)).current;

  // Derive submission display
  const subCfg    = SUBMISSION_CONFIG[a.submission_state] || SUBMISSION_CONFIG.NEW;
  const isDone    = subCfg.official || localDone;
  const subColor  = subCfg.official ? tc.success : (localDone ? tc.primary : tc.text.muted);
  const subLabel  = localDone && !subCfg.official ? "Marked Done" : subCfg.label;
  const subIcon   = localDone && !subCfg.official ? "checkmark-circle" : subCfg.icon;

  return (
    <Animated.View style={{ marginBottom: 10, transform: [{ scale: anim }], opacity: isDone ? 0.75 : 1 }}>
      <View
        style={{
          backgroundColor: tc.card,
          borderRadius: 18,
          padding: 16,
          borderWidth: 1,
          borderColor: tc.border,
          borderLeftWidth: 4,
          borderLeftColor: isDone ? tc.success : cfg.color,
        }}
      >
        {/* Title row */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 10 }}>
          <View style={{ backgroundColor: tc.surfaceHover, padding: 8, borderRadius: 12, marginRight: 12 }}>
            <Ionicons name={typeIcon} size={18} color={isDone ? tc.success : cfg.color} />
          </View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text
              style={{
                color: tc.text.primary, fontWeight: "700", fontSize: 14,
                textDecorationLine: isDone ? "line-through" : "none",
                opacity: isDone ? 0.7 : 1,
              }}
              numberOfLines={2}
            >
              {a.title}
            </Text>
            <Text style={{ color: tc.text.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
              {a.course_name}
            </Text>
          </View>
          {/* Status badge */}
          <View style={{ backgroundColor: tc.surfaceHover, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 }}>
            <Text style={{ color: isDone ? tc.success : cfg.color, fontWeight: "800", fontSize: 10 }}>{isDone ? "Done" : cfg.label}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {/* Left: submission state */}
          <Pressable
            onPress={() => !subCfg.official && onToggleDone(a)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              backgroundColor: tc.surfaceHover,
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
            }}
          >
            <Ionicons name={subIcon} size={13} color={subColor} />
            <Text style={{ color: subColor, fontSize: 11, fontWeight: "700" }}>{subLabel}</Text>
            {!subCfg.official && (
              <Ionicons
                name={localDone ? "close-circle-outline" : "add-circle-outline"}
                size={12}
                color={tc.text.muted}
              />
            )}
          </Pressable>

          {/* Right: due date + countdown + open */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {a.due_date && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="calendar-outline" size={12} color={tc.text.muted} />
                <Text style={{ color: tc.text.muted, fontSize: 11 }}>{formatDue(a.due_date)}</Text>
              </View>
            )}
            {a.max_points != null && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="ribbon-outline" size={11} color={tc.text.muted} />
                <Text style={{ color: tc.text.muted, fontSize: 11 }}>{a.max_points}pt</Text>
              </View>
            )}
            {!isDone && countdown && (
              <View style={{ backgroundColor: tc.surfaceHover, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                <Text style={{ color: cfg.color, fontSize: 10, fontWeight: "700" }}>{countdown}</Text>
              </View>
            )}
            {a.alternate_link ? (
              <Pressable onPress={() => Linking.openURL(a.alternate_link)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open assignment in Google Classroom">
                <Ionicons name="open-outline" size={15} color={tc.primary} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}


// ─── Course card ─────────────────────────────────────────────────────────
function CourseCard({ course, tc }) {
  const anim = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ marginBottom: 10, transform: [{ scale: anim }] }}>
      <Pressable
        onPressIn={() => Animated.spring(anim, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start()}
        onPress={() => course.alternate_link && Linking.openURL(course.alternate_link)}
        style={{
          backgroundColor: tc.card,
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tc.border,
        }}
      >
        {/* Top accent bar using primary */}
        <View style={{ height: 4, backgroundColor: tc.primary }} />
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: tc.text.primary, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>
                {course.name}
              </Text>
              {course.section && (
                <Text style={{ color: tc.primary, fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                  {course.section}
                </Text>
              )}
              {course.description_heading && (
                <Text style={{ color: tc.text.muted, fontSize: 11, marginTop: 4 }} numberOfLines={2}>
                  {course.description_heading}
                </Text>
              )}
            </View>
            <View style={{ backgroundColor: tc.surfaceHover, padding: 10, borderRadius: 14 }}>
              <Ionicons name="book-outline" size={22} color={tc.primary} />
            </View>
          </View>

          {/* Meta row */}
          {(course.room || course.enrollment_code) && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, gap: 12 }}>
              {course.room && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="location-outline" size={12} color={tc.text.muted} />
                  <Text style={{ color: tc.text.muted, fontSize: 11 }}>{course.room}</Text>
                </View>
              )}
              {course.enrollment_code && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="key-outline" size={12} color={tc.text.muted} />
                  <Text style={{ color: tc.text.muted, fontSize: 11 }}>{course.enrollment_code}</Text>
                </View>
              )}
              <View style={{ marginLeft: "auto" }}>
                <Ionicons name="open-outline" size={13} color={tc.text.muted} />
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Filter chip ─────────────────────────────────────────────────────────
function FilterChip({ label, active, color, onPress, tc }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: active ? tc.primary : tc.card,
        borderWidth: 1,
        borderColor: active ? tc.primary : tc.border,
        marginRight: 8,
      }}
    >
      <Text style={{ color: active ? "#fff" : tc.text.muted, fontSize: 12, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────
export default function ClassroomScreen() {
  const { themeColors: tc } = useAppTheme();
  const DSC = getDueStatusConfig(tc);

  const [connected,      setConnected]      = useState(false);
  const [email,          setEmail]          = useState("");
  const [courses,        setCourses]        = useState([]);
  const [assignments,    setAssignments]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [refreshing,     setRefreshing]     = useState(false);
  const [activeTab,      setActiveTab]      = useState("assignments");
  const [filter,         setFilter]         = useState("all");
  const [search,         setSearch]         = useState("");
  const [localDoneIds,   setLocalDoneIds]   = useState(new Set());

  // ── AsyncStorage helpers ──────────────────────────────────────────────
  const loadLocalDone = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DONE_KEY);
      if (raw) setLocalDoneIds(new Set(JSON.parse(raw)));
    } catch (_) {}
  }, []);

  const assignmentDoneKey = (a) => `${a.course_id || ""}:${a.id}`;
  const isLocallyDone = (a) => localDoneIds.has(assignmentDoneKey(a)) || localDoneIds.has(a.id);

  const toggleDone = useCallback(async (assignment) => {
    const key = assignmentDoneKey(assignment);
    setLocalDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(key) || next.has(assignment.id)) {
        next.delete(key);
        next.delete(assignment.id);
      } else {
        next.add(key);
      }
      AsyncStorage.setItem(DONE_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);
  const upcomingCount = assignments.filter((a) => a.due_status === "upcoming" && !isLocallyDone(a)).length;
  const dueSoonCount  = assignments.filter((a) => a.due_status === "due_soon" && !isLocallyDone(a)).length;
  const overdueCount  = assignments.filter((a) => a.due_status === "overdue" && !isLocallyDone(a)).length;

  const STAT_CARDS = [
    { label: "Upcoming", value: upcomingCount, icon: "sparkles",     color: tc.success },
    { label: "Due Soon", value: dueSoonCount,  icon: "time",         color: tc.warning },
    { label: "Overdue",  value: overdueCount,  icon: "alert-circle", color: tc.error },
  ];

  const FILTER_CHIPS = [
    { key: "all",        label: "All" },
    { key: "overdue",    label: "Overdue" },
    { key: "due_soon",   label: "Due Soon" },
    { key: "upcoming",   label: "Upcoming" },
    { key: "no_due_date",label: "No Date" },
  ];

  const filteredAssignments = assignments.filter((a) => {
    const matchFilter = filter === "all" || (filter === "overdue" && a.due_status === "overdue" && !isLocallyDone(a)) || (filter === "due_soon" && a.due_status === "due_soon" && !isLocallyDone(a)) || (filter === "upcoming" && a.due_status === "upcoming" && !isLocallyDone(a)) || (filter === "no_due_date" && a.due_status === "no_due_date");
    const matchSearch = !search
      || a.title.toLowerCase().includes(search.toLowerCase())
      || a.course_name.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const urgentCount = overdueCount + dueSoonCount;

  // ── Data loading ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const statusRes   = await api.get("/classroom/status");
      const isConnected = Boolean(statusRes.data?.connected);
      setConnected(isConnected);
      setEmail(statusRes.data?.email || "");

      if (isConnected) {
        const [coursesRes, assignmentsRes] = await Promise.all([
          api.get("/classroom/courses"),
          api.get("/classroom/assignments"),
        ]);
        const newAssignments = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : [];
        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
        setAssignments(newAssignments);

        // ── New assignment detection & notifications ──────────────────
        try {
          const raw     = await AsyncStorage.getItem(SEEN_KEY);
          const seenIds = new Set(raw ? JSON.parse(raw) : []);
          const newOnes = newAssignments.filter((a) => !seenIds.has(a.id));
          // Only notify if we had previous data (not first load)
          if (seenIds.size > 0 && newOnes.length > 0) {
            for (const a of newOnes) {
              await notifyNewAssignment(a.title, a.course_name);
            }
          }
          // Save current IDs as seen
          await AsyncStorage.setItem(
            SEEN_KEY,
            JSON.stringify(newAssignments.map((a) => a.id))
          );
        } catch (_) {}
      } else {
        setCourses([]);
        setAssignments([]);
      }
    } catch (e) {
      console.log("[CLASSROOM]", e?.response?.data || e?.message);
      setConnected(false);
      setEmail("");
      setCourses([]);
      setAssignments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);


  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  // ── Deep-link listener ────────────────────────────────────────────────
  useEffect(() => {
    loadLocalDone();
    const handleCallback = ({ url }) => {
      if (!url?.startsWith("orio://classroom/callback")) return;
      try {
        const parsed      = new URL(url);
        const isConnected = parsed.searchParams.get("connected") === "true";
        const cbError     = parsed.searchParams.get("error");
        if (isConnected) loadData();
        else if (cbError) setConnectError(`Connection failed: ${decodeURIComponent(cbError).replace(/_/g, " ")}`);
      } catch (e) {
        console.log("[CLASSROOM CALLBACK]", e);
      }
    };
    const sub = Linking.addEventListener("url", handleCallback);
    Linking.getInitialURL().then((url) => url && handleCallback({ url })).catch(() => {});
    return () => sub.remove();
  }, [loadData, loadLocalDone]);


  // ── Connect ───────────────────────────────────────────────────────────
  const connectClassroom = async () => {
    try {
      setConnectError("");
      setConnectLoading(true);
      const res = await api.get("/classroom/authorize");
      await Linking.openURL(res.data.authorization_url);
    } catch (e) {
      setConnectError(e?.response?.data?.detail || "Could not start Google authorization. Please try again.");
    } finally {
      setConnectLoading(false);
    }
  };

  // ── Disconnect ────────────────────────────────────────────────────────


  // ── Render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tc.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={tc.primary}
          />
        }
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
            style={{
              backgroundColor: tc.card, borderColor: tc.border, borderWidth: 1,
              width: 40, height: 40, borderRadius: 14,
              alignItems: "center", justifyContent: "center", marginRight: 12,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={tc.text.primary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: tc.primary, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 2 }}>
              COLLEGE
            </Text>
            <Text style={{ color: tc.text.primary, fontSize: 24, fontWeight: "900" }}>
              Google Classroom
            </Text>
          </View>
          <View style={{ backgroundColor: tc.surfaceHover, width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="school" size={22} color={tc.primary} />
          </View>
        </View>

        {Boolean(connectError) && (
          <View style={{
            flexDirection: "row", alignItems: "flex-start", backgroundColor: tc.card,
            borderRadius: 16, padding: 14, marginBottom: 18, borderWidth: 1,
            borderColor: tc.error || "#EF4444",
          }}>
            <Ionicons name="alert-circle-outline" size={20} color={tc.error || "#EF4444"} style={{ marginRight: 10, marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: tc.text.primary, fontSize: 14, fontWeight: "800", marginBottom: 4 }}>
                Could not connect Google Classroom
              </Text>
              <Text style={{ color: tc.text.muted, fontSize: 13, lineHeight: 19 }}>
                {connectError}
              </Text>
              <Text style={{ color: tc.text.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                Check the Google Classroom OAuth settings on the backend, then try again from Settings.
              </Text>
            </View>
            <Pressable onPress={() => setConnectError("")} hitSlop={8}>
              <Ionicons name="close" size={18} color={tc.text.muted} />
            </Pressable>
          </View>
        )}

        {/* ── Connection banner ────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            backgroundColor: tc.card, borderRadius: 20, padding: 16, marginBottom: 20,
            borderWidth: 1, borderColor: tc.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12 }}>
            <View style={{
              backgroundColor: tc.surfaceHover, borderRadius: 14,
              width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 12,
            }}>
              <Ionicons name="school" size={22} color={connected ? tc.success : tc.text.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tc.text.primary, fontWeight: "800", fontSize: 14 }}>
                {connected ? email : "Not Connected"}
              </Text>
              <Text style={{ color: tc.text.muted, fontSize: 11, marginTop: 2 }}>
                {connected
                  ? `${courses.length} courses · ${assignments.length} assignments`
                  : "Link your Google account to sync"}
              </Text>
            </View>
          </View>
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 5,
            backgroundColor: tc.surfaceHover,
            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
          }}>
            <View style={{
              width: 6, height: 6, borderRadius: 3,
              backgroundColor: connected ? tc.success : tc.text.muted,
            }} />
            <Text style={{ color: connected ? tc.success : tc.text.muted, fontSize: 11, fontWeight: "800" }}>
              {connected ? "Live" : "Offline"}
            </Text>
          </View>
        </View>

        {/* ── Not connected ────────────────────────────────────────── */}
        {!connected && (
          <View style={{
            backgroundColor: tc.card, borderRadius: 24, padding: 32,
            alignItems: "center", borderWidth: 1, borderColor: tc.border, marginBottom: 20,
          }}>
            <View style={{ backgroundColor: tc.surfaceHover, padding: 20, borderRadius: 24, marginBottom: 16 }}>
              <Ionicons name="school" size={40} color={tc.primary} />
            </View>
            <Text style={{ color: tc.text.primary, fontWeight: "900", fontSize: 18, textAlign: "center" }}>
              Connect Google Classroom
            </Text>
            <Text style={{ color: tc.text.muted, fontSize: 13, textAlign: "center", marginTop: 8, marginBottom: 16, lineHeight: 20 }}>
              Sync your courses and assignments, get deadline alerts, and never miss a submission.
            </Text>
            <View style={{
              flexDirection: "row", alignItems: "flex-start", backgroundColor: tc.surfaceHover,
              borderRadius: 14, padding: 14, width: "100%",
            }}>
              <Ionicons name="settings-outline" size={18} color={tc.primary} style={{ marginRight: 10, marginTop: 1 }} />
              <Text style={{ flex: 1, color: tc.text.muted, fontSize: 13, lineHeight: 19 }}>
                To connect Google Classroom, open Settings and connect your Google account.
              </Text>
            </View>
          </View>
        )}

        {/* ── Loading ──────────────────────────────────────────────── */}
        {connected && loading && (
          <View style={{
            backgroundColor: tc.card, borderRadius: 20, padding: 28,
            alignItems: "center", borderWidth: 1, borderColor: tc.border,
          }}>
            <Ionicons name="sync-outline" size={28} color={tc.primary} />
            <Text style={{ color: tc.text.muted, fontSize: 14, marginTop: 10 }}>
              Syncing courses & assignments...
            </Text>
          </View>
        )}

        {/* ── Connected + loaded ───────────────────────────────────── */}
        {connected && !loading && (
          <>
            {/* Stats */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
              {STAT_CARDS.map((item) => (
                <StatCard key={item.label} item={item} tc={tc} />
              ))}
            </View>

            {/* Urgent banner */}
            {urgentCount > 0 && (
              <View style={{
                backgroundColor: tc.card,
                borderRadius: 14, padding: 14,
                flexDirection: "row", alignItems: "center", marginBottom: 20,
                borderWidth: 1, borderColor: tc.border,
                borderLeftWidth: 4, borderLeftColor: tc.error,
              }}>
                <Ionicons name="warning-outline" size={18} color={tc.error} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tc.text.primary, fontWeight: "800", fontSize: 13 }}>
                    {urgentCount} assignment{urgentCount > 1 ? "s" : ""} need your attention
                  </Text>
                  <Text style={{ color: tc.text.muted, fontSize: 11, marginTop: 1 }}>
                    {overdueCount > 0 ? `${overdueCount} overdue` : ""}
                    {overdueCount > 0 && dueSoonCount > 0 ? " · " : ""}
                    {dueSoonCount > 0 ? `${dueSoonCount} due soon` : ""}
                  </Text>
                </View>
              </View>
            )}

            {/* Tabs */}
            <View style={{
              flexDirection: "row", backgroundColor: tc.card, borderRadius: 16,
              padding: 4, marginBottom: 20, borderWidth: 1, borderColor: tc.border,
            }}>
              {[
                { key: "assignments", label: "Assignments", icon: "document-text-outline", count: assignments.length },
                { key: "courses",     label: "Courses",     icon: "book-outline",          count: courses.length },
              ].map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    style={{
                      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                      paddingVertical: 10, borderRadius: 12, gap: 6,
                      backgroundColor: active ? tc.primary : "transparent",
                    }}
                  >
                    <Ionicons name={tab.icon} size={15} color={active ? "#fff" : tc.text.muted} />
                    <Text style={{ color: active ? "#fff" : tc.text.muted, fontWeight: "700", fontSize: 13 }}>
                      {tab.label}
                    </Text>
                    <View style={{
                      backgroundColor: active ? "rgba(255,255,255,0.2)" : tc.surfaceHover,
                      paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
                    }}>
                      <Text style={{ color: active ? "#fff" : tc.text.muted, fontSize: 10, fontWeight: "800" }}>
                        {tab.count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Assignments tab ─────────────────────────────────── */}
            {activeTab === "assignments" && (
              <>
                {/* Search */}
                <View style={{
                  flexDirection: "row", alignItems: "center",
                  backgroundColor: tc.card, borderRadius: 14,
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderWidth: 1, borderColor: tc.border, marginBottom: 14, gap: 10,
                }}>
                  <Ionicons name="search-outline" size={16} color={tc.text.muted} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search assignments or courses..."
                    placeholderTextColor={tc.text.muted}
                    style={{ flex: 1, color: tc.text.primary, fontSize: 13 }}
                  />
                  {search.length > 0 && (
                    <Pressable onPress={() => setSearch("")}>
                      <Ionicons name="close-circle" size={16} color={tc.text.muted} />
                    </Pressable>
                  )}
                </View>

                {/* Filter chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 16 }}
                  contentContainerStyle={{ paddingRight: 16 }}
                >
                  {FILTER_CHIPS.map((chip) => (
                    <FilterChip
                      key={chip.key}
                      label={chip.label}
                      active={filter === chip.key}
                      onPress={() => setFilter(chip.key)}
                      tc={tc}
                    />
                  ))}
                </ScrollView>

                {/* List */}
                {filteredAssignments.length === 0 ? (
                  <View style={{
                    backgroundColor: tc.card, borderRadius: 20, padding: 32,
                    alignItems: "center", borderWidth: 1, borderColor: tc.border,
                  }}>
                    <Ionicons name="checkmark-done-circle-outline" size={40} color={tc.text.muted} />
                    <Text style={{ color: tc.text.muted, fontSize: 14, marginTop: 12, textAlign: "center" }}>
                      {search ? "No matching assignments found." : "No assignments in this category."}
                    </Text>
                  </View>
                ) : (
                  filteredAssignments.map((a) => (
                    <AssignmentCard
                      key={a.id}
                      a={a}
                      tc={tc}
                      localDone={isLocallyDone(a)}
                      onToggleDone={toggleDone}
                    />
                  ))
                )}
              </>
            )}

            {/* ── Courses tab ─────────────────────────────────────── */}
            {activeTab === "courses" && (
              courses.length === 0 ? (
                <View style={{
                  backgroundColor: tc.card, borderRadius: 20, padding: 32,
                  alignItems: "center", borderWidth: 1, borderColor: tc.border,
                }}>
                  <Ionicons name="book-outline" size={40} color={tc.text.muted} />
                  <Text style={{ color: tc.text.muted, fontSize: 14, marginTop: 12, textAlign: "center" }}>
                    No active courses found.
                  </Text>
                </View>
              ) : (
                courses.map((course) => (
                  <CourseCard key={course.id} course={course} tc={tc} />
                ))
              )
            )}


          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
