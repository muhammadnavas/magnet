import React, { useRef } from "react";
import {
  View, Text, TouchableOpacity, Animated, Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../store/themeStore";
import { useUpdateTask, useDeleteTask } from "../../hooks/useTasks";
import { formatDistanceToNow, isPast, format } from "date-fns";

const PRIORITY_CONFIG = {
  high:   { color: "#EF4444", bg: "#EF444415", label: "High",   icon: "flame" },
  medium: { color: "#F59E0B", bg: "#F59E0B15", label: "Medium", icon: "alert-circle" },
  low:    { color: "#3B82F6", bg: "#3B82F615", label: "Low",    icon: "leaf" },
};

export default function TaskCard({ task }) {
  const { themeColors } = useAppTheme();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isCompleted = task.status === "completed";
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const isOverdue = task.deadline && !isCompleted && isPast(new Date(task.deadline));

  const handleToggleComplete = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    updateTask.mutate({
      id: task.id,
      status: isCompleted ? "pending" : "completed",
    });
  };

  const handleDelete = () => {
    Alert.alert("Delete Task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTask.mutate(task.id) },
    ]);
  };

  let deadlineText = null;
  if (task.deadline) {
    const d = new Date(task.deadline);
    if (isCompleted) {
      deadlineText = `Completed · Due ${format(d, "MMM d")}`;
    } else if (isOverdue) {
      deadlineText = `Overdue · ${formatDistanceToNow(d, { addSuffix: true })}`;
    } else {
      deadlineText = `Due ${formatDistanceToNow(d, { addSuffix: true })}`;
    }
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View
        style={{
          backgroundColor: themeColors.card,
          borderColor: isOverdue ? "#EF444440" : themeColors.border,
          borderWidth: 1,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          opacity: isCompleted ? 0.65 : 1,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          {/* Checkbox */}
          <TouchableOpacity
            onPress={handleToggleComplete}
            style={{
              width: 24, height: 24, borderRadius: 12,
              borderWidth: 2,
              borderColor: isCompleted ? themeColors.primary : themeColors.border,
              backgroundColor: isCompleted ? themeColors.primary : "transparent",
              alignItems: "center", justifyContent: "center",
              marginRight: 12, marginTop: 2,
            }}
          >
            {isCompleted && <Ionicons name="checkmark" size={14} color="#FFF" />}
          </TouchableOpacity>

          {/* Content */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: themeColors.text.primary,
                fontSize: 15,
                fontWeight: "700",
                textDecorationLine: isCompleted ? "line-through" : "none",
                marginBottom: 4,
              }}
            >
              {task.title}
            </Text>

            {task.description ? (
              <Text
                style={{ color: themeColors.text.secondary, fontSize: 12, marginBottom: 6 }}
                numberOfLines={2}
              >
                {task.description}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              {/* Priority badge */}
              <View
                style={{
                  backgroundColor: priority.bg,
                  borderRadius: 100,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons name={priority.icon} size={11} color={priority.color} style={{ marginRight: 4 }} />
                <Text style={{ color: priority.color, fontSize: 11, fontWeight: "700" }}>
                  {priority.label}
                </Text>
              </View>

              {/* Deadline chip */}
              {deadlineText && (
                <View
                  style={{
                    backgroundColor: isOverdue ? "#EF444415" : themeColors.surfaceHover,
                    borderRadius: 100,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name={isOverdue ? "warning" : "time-outline"}
                    size={11}
                    color={isOverdue ? "#EF4444" : themeColors.text.muted}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={{
                      color: isOverdue ? "#EF4444" : themeColors.text.muted,
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    {deadlineText}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Delete button */}
          <TouchableOpacity
            onPress={handleDelete}
            style={{ padding: 6, marginLeft: 4 }}
          >
            <Ionicons name="trash-outline" size={16} color={themeColors.text.muted} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
