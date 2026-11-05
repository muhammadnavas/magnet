import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useGetTasks, useCreateTask, useParseTask } from "../../hooks/useTasks";
import { useAppTheme } from "../../store/themeStore";
import { requestNotificationPermissions } from "../../lib/notifications";
import { parseTaskDateTime } from "../../lib/taskDateTime";
import TaskCard from "../../components/tasks/TaskCard";
import VoiceInput from "../../components/voice/VoiceInput";

const FILTERS = [
  { key: null, label: "All" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Done" },
];

function cleanTaskTitle(text, parsedTitle) {
  const raw = String(text || "").trim();
  const candidate = String(parsedTitle || "").trim();
  const stripInstructionAndTime = (value) => String(value || "")
    .replace(/^\s*(?:please\s+)?(?:could\s+you\s+)?(?:set\s+(?:a\s+)?reminder(?:\s+for)?|remind\s+me(?:\s+to)?|reminder\s+to|create\s+(?:a\s+)?task(?:\s+to)?|add\s+(?:a\s+)?task(?:\s+to)?)\s*/i, "")
    .replace(/\s+(?:in|after|within|for)\s+\d+(?:\.\d+)?\s*(?:seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?)\b.*$/i, "")
    .replace(/\s+(?:today|tomorrow|tonight|this\s+(?:morning|afternoon|evening)|next\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:at|around|by|before|on)\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\b.*$/i, "")
    .replace(/[,.!?\s]+$/, "")
    .trim();
  const rawTitle = stripInstructionAndTime(raw);
  const aiTitle = stripInstructionAndTime(candidate);
  const generic = /^(?:reminder|reminders|give me a reminder|set a reminder|task|untitled task|please remind me)$/i;
  let title = aiTitle && !generic.test(aiTitle) ? aiTitle : rawTitle;
  if (!title || generic.test(title) || /^(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?$/i.test(title)) {
    title = rawTitle && !generic.test(rawTitle) ? rawTitle : "Reminder";
  }
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function hasExplicitTiming(text) {
  const value = String(text || "");
  return /\b(?:today|tomorrow|tonight|morning|afternoon|evening|midnight|noon|next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\b(?:in|after|within|for)\s+\d+(?:\.\d+)?\s*(?:seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?)\b)\b/i.test(value);
}
function applyDueTime(task, text) {
  const hasTiming = hasExplicitTiming(text);
  const parsedDeadline = hasTiming ? parseTaskDateTime(text) : null;
  const title = cleanTaskTitle(text, task?.title);
  // Never trust an AI-invented deadline when the user gave no timing.
  // Explicit times/dates are resolved locally so a clock time means its next
  // occurrence, not an arbitrary timestamp guessed by the model.
  return {
    ...task,
    title,
    deadline: hasTiming ? (parsedDeadline || task?.deadline || null) : null,
  };
}

function isReminderWithoutTime(text, task) {
  const value = String(text || "");
  const reminderIntent = /\bremind(?:er)?\b|\bnotify me\b|\balert me\b/i.test(value);
  return reminderIntent && !hasExplicitTiming(value) && !task?.deadline;
}

export default function TasksScreen() {
  const { themeColors } = useAppTheme();
  const [filter, setFilter] = useState(null);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const { data: tasks = [], isLoading } = useGetTasks(filter);
  const createTask = useCreateTask();
  const parseTask = useParseTask();

  useEffect(() => { requestNotificationPermissions(); }, []);
  const handleInputFocus = () => requestNotificationPermissions();

  const createParsedTask = (task) => {
    createTask.mutate({
      ...task,
      deadline: task.deadline || null,
      reminder_interval_hours: 0,
    });
    setInput("");
    inputRef.current?.blur();
  };

  const askForReminderTime = (task) => {
    Alert.alert(
      "When should I remind you?",
      "This task has no due time yet.",
      [
        { text: "In 30 min", onPress: () => createParsedTask({ ...task, deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString() }) },
        { text: "In 1 hour", onPress: () => createParsedTask({ ...task, deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString() }) },
        { text: "Tomorrow", onPress: () => createParsedTask({ ...task, deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }) },
      ]
    );
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Accept immediately using the on-device date parser. AI/backend work must
    // never sit in front of the user's send action (Render may be cold-starting).
    requestNotificationPermissions();
    const localTask = applyDueTime({
      title: trimmed,
      priority: "medium",
      deadline: null,
      reminder_interval_hours: 0,
    }, trimmed);

    const taskToCreate = isReminderWithoutTime(trimmed, localTask)
      ? { ...localTask, deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
      : localTask;

    createParsedTask(taskToCreate);
  };

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const pendingCount = tasks.filter((t) => t.status === "pending").length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ color: themeColors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>My Tasks</Text>
          <Text style={{ color: themeColors.text.primary, fontSize: 26, fontWeight: "900" }}>What's on your plate?</Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
            {[{ count: pendingCount, label: "Pending", color: "#F59E0B" }, { count: completedCount, label: "Done", color: "#059669" }].map(({ count, label, color }) => (
              <View key={label} style={{ backgroundColor: `${color}15`, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color, fontSize: 18, fontWeight: "900", marginRight: 6 }}>{count}</Text>
                <Text style={{ color: themeColors.text.muted, fontSize: 12, fontWeight: "600" }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 12 }}>
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return <TouchableOpacity key={label} onPress={() => setFilter(key)} style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, borderWidth: 1, backgroundColor: active ? themeColors.primary : themeColors.card, borderColor: active ? themeColors.primary : themeColors.border }}>
              <Text style={{ color: active ? "#FFF" : themeColors.text.secondary, fontSize: 12, fontWeight: "700" }}>{label}</Text>
            </TouchableOpacity>;
          })}
        </View>

        {isLoading ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={themeColors.primary} /></View> :
          <FlatList data={tasks} keyExtractor={(item) => item.id} renderItem={({ item }) => <TaskCard task={item} />} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 }} showsVerticalScrollIndicator={false} ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
              <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1, borderRadius: 20, width: 64, height: 64, alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Ionicons name="checkmark-done-circle-outline" size={32} color={themeColors.primary} /></View>
              <Text style={{ color: themeColors.text.primary, fontSize: 16, fontWeight: "700", marginBottom: 6 }}>{filter === "completed" ? "No completed tasks yet" : "No tasks yet"}</Text>
              <Text style={{ color: themeColors.text.secondary, fontSize: 13, textAlign: "center", maxWidth: 280 }}>Tasks without a date stay open. Say “remind me in 15 minutes” when you want a notification.</Text>
            </View>
          } />}

        <View style={{ borderTopWidth: 1, borderTopColor: themeColors.border, backgroundColor: themeColors.background, padding: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1, borderRadius: 28, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 }}>
            <TextInput ref={inputRef} value={input} onChangeText={setInput} onFocus={handleInputFocus} placeholder='e.g. "Submit assignment by Thursday"' placeholderTextColor={themeColors.text.muted} multiline style={{ flex: 1, color: themeColors.text.primary, fontSize: 14, maxHeight: 100, paddingTop: Platform.OS === "ios" ? 8 : 4, paddingBottom: Platform.OS === "ios" ? 8 : 4 }} onSubmitEditing={handleSend} blurOnSubmit={false} />
            <VoiceInput onTranscript={(transcript) => setInput((current) => current ? `${current} ${transcript}` : transcript)} disabled={false} />
            <TouchableOpacity onPress={handleSend} disabled={!input.trim()} style={{ width: 36, height: 36, borderRadius: 18, marginLeft: 8, backgroundColor: input.trim() ? themeColors.primary : themeColors.border, alignItems: "center", justifyContent: "center" }}>
              {createTask.isPending ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="arrow-up" size={18} color="#FFF" />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
