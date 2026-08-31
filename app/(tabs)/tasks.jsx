import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useGetTasks, useCreateTask } from "../../hooks/useTasks";
import { useAppTheme } from "../../store/themeStore";
import { requestNotificationPermissions } from "../../lib/notifications";
import TaskCard from "../../components/tasks/TaskCard";

// ──────────────────────────────────────────────────────────────
// Natural language parser — runs on-device, no API call needed
// ──────────────────────────────────────────────────────────────
function parseTask(text) {
  const lower = text.toLowerCase();

  // Priority detection
  let priority = "medium";
  if (/urgent|asap|critical|high priority|important/.test(lower)) priority = "high";
  else if (/low priority|whenever|not urgent|eventually/.test(lower)) priority = "low";

  // Deadline detection — weekday names
  let deadline = null;
  const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = new Date();
  for (let i = 0; i < DAYS.length; i++) {
    if (lower.includes(DAYS[i])) {
      const diff = (i - today.getDay() + 7) % 7 || 7;
      deadline = new Date(today);
      deadline.setDate(today.getDate() + diff);
      deadline.setHours(23, 59, 0, 0);
      break;
    }
  }

  // "tomorrow"
  if (!deadline && lower.includes("tomorrow")) {
    deadline = new Date(today);
    deadline.setDate(today.getDate() + 1);
    deadline.setHours(23, 59, 0, 0);
  }

  // "today"
  if (!deadline && lower.includes("today")) {
    deadline = new Date(today);
    deadline.setHours(23, 59, 0, 0);
  }

  // "in X days"
  const inDays = lower.match(/in (\d+) days?/);
  if (!deadline && inDays) {
    deadline = new Date(today);
    deadline.setDate(today.getDate() + parseInt(inDays[1]));
    deadline.setHours(23, 59, 0, 0);
  }

  // Clean up title — remove common deadline/priority phrases
  let title = text
    .replace(/by (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi, "")
    .replace(/by tomorrow|by today/gi, "")
    .replace(/in \d+ days?/gi, "")
    .replace(/urgent|asap|high priority|low priority|not urgent/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) title = text.trim(); // fallback

  return { title, priority, deadline };
}

// ──────────────────────────────────────────────────────────────
const FILTERS = [
  { key: null, label: "All" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Done" },
];

export default function TasksScreen() {
  const { themeColors } = useAppTheme();
  const [filter, setFilter] = useState(null);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  const { data: tasks = [], isLoading } = useGetTasks(filter);
  const createTask = useCreateTask();

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const { title, priority, deadline } = parseTask(trimmed);
    createTask.mutate({ title, priority, deadline, reminder_interval_hours: 24 });
    setInput("");
    inputRef.current?.blur();
  };

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const pendingCount = tasks.filter((t) => t.status === "pending").length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ color: themeColors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>
            My Tasks
          </Text>
          <Text style={{ color: themeColors.text.primary, fontSize: 26, fontWeight: "900" }}>
            What's on your plate?
          </Text>

          {/* Stats row */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
            {[
              { count: pendingCount, label: "Pending", color: "#F59E0B" },
              { count: completedCount, label: "Done", color: "#059669" },
            ].map(({ count, label, color }) => (
              <View
                key={label}
                style={{
                  backgroundColor: `${color}15`, borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 8,
                  flexDirection: "row", alignItems: "center",
                }}
              >
                <Text style={{ color, fontSize: 18, fontWeight: "900", marginRight: 6 }}>{count}</Text>
                <Text style={{ color: themeColors.text.muted, fontSize: 12, fontWeight: "600" }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Filter pills ── */}
        <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 12 }}>
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => setFilter(key)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 7,
                  borderRadius: 100, borderWidth: 1,
                  backgroundColor: active ? themeColors.primary : themeColors.card,
                  borderColor: active ? themeColors.primary : themeColors.border,
                }}
              >
                <Text style={{ color: active ? "#FFF" : themeColors.text.secondary, fontSize: 12, fontWeight: "700" }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Task List ── */}
        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={themeColors.primary} />
          </View>
        ) : (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <TaskCard task={item} />}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
                <View
                  style={{
                    backgroundColor: themeColors.card, borderColor: themeColors.border,
                    borderWidth: 1, borderRadius: 20, width: 64, height: 64,
                    alignItems: "center", justifyContent: "center", marginBottom: 16,
                  }}
                >
                  <Ionicons name="checkmark-done-circle-outline" size={32} color={themeColors.primary} />
                </View>
                <Text style={{ color: themeColors.text.primary, fontSize: 16, fontWeight: "700", marginBottom: 6 }}>
                  {filter === "completed" ? "No completed tasks yet" : "No tasks yet"}
                </Text>
                <Text style={{ color: themeColors.text.secondary, fontSize: 13, textAlign: "center", maxWidth: 260 }}>
                  Type anything below — "Submit assignment by Thursday" — and I'll create a task with a reminder!
                </Text>
              </View>
            }
          />
        )}

        {/* ── Input Bar (ChatGPT style) ── */}
        <View
          style={{
            borderTopWidth: 1, borderTopColor: themeColors.border,
            backgroundColor: themeColors.background, padding: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row", alignItems: "center",
              backgroundColor: themeColors.card, borderColor: themeColors.border,
              borderWidth: 1, borderRadius: 28, paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
            }}
          >
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              placeholder='e.g. "Submit assignment by Thursday"'
              placeholderTextColor={themeColors.text.muted}
              multiline
              style={{
                flex: 1, color: themeColors.text.primary, fontSize: 14,
                maxHeight: 100,
                paddingTop: Platform.OS === "ios" ? 8 : 4,
                paddingBottom: Platform.OS === "ios" ? 8 : 4,
              }}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || createTask.isPending}
              style={{
                width: 36, height: 36, borderRadius: 18, marginLeft: 8,
                backgroundColor: input.trim() ? themeColors.primary : themeColors.border,
                alignItems: "center", justifyContent: "center",
              }}
            >
              {createTask.isPending
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Ionicons name="arrow-up" size={18} color="#FFF" />
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
