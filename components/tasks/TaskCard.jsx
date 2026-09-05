import React, { useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, Animated, Platform
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
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const isCompleted = task.status === "completed";
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
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
    deleteTask.mutate(task.id);
  };

  const parseDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === "string") {
      const hasTz = val.endsWith("Z") || val.includes("+") || val.includes("-", 10);
      const formatted = hasTz ? val : `${val}Z`;
      const d = new Date(formatted);
      return isNaN(d.getTime()) ? new Date(val) : d;
    }
    return new Date(val);
  };

  const createdAtRaw = task.created_at || task.createdAt;
  let createdText = null;
  if (createdAtRaw) {
    const cd = parseDate(createdAtRaw);
    if (cd && !isNaN(cd.getTime())) {
      createdText = `Created ${format(cd, "MMM d, h:mm a")}`;
    }
  }

  let deadlineText = null;
  const deadlineDate = parseDate(task.deadline);
  const isOverdue = deadlineDate && !isCompleted && isPast(deadlineDate);

  if (deadlineDate && !isNaN(deadlineDate.getTime())) {
    if (isCompleted) {
      deadlineText = `Completed · Due ${format(deadlineDate, "MMM d")}`;
    } else if (isOverdue) {
      deadlineText = `Overdue · ${formatDistanceToNow(deadlineDate, { addSuffix: true })}`;
    } else {
      deadlineText = `Due ${formatDistanceToNow(deadlineDate, { addSuffix: true })}`;
    }
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View
        style={{
          backgroundColor: isConfirmingDelete ? "#EF444410" : themeColors.card,
          borderColor: isConfirmingDelete ? "#EF444450" : (isOverdue ? "#EF444440" : themeColors.border),
          borderWidth: 1,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          opacity: isCompleted && !isConfirmingDelete ? 0.65 : 1,
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

            {/* Badges / Or Delete Confirmation */}
            {isConfirmingDelete ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <Text style={{ color: "#EF4444", fontSize: 12, fontWeight: "600", marginRight: 4 }}>Delete task?</Text>
                <TouchableOpacity
                  onPress={() => setIsConfirmingDelete(false)}
                  style={{ backgroundColor: themeColors.surfaceHover, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                >
                  <Text style={{ color: themeColors.text.primary, fontSize: 11, fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDelete}
                  style={{ backgroundColor: "#EF4444", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                >
                  <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>Delete</Text>
                </TouchableOpacity>
              </View>
            ) : (
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

                {/* Creation Date & Time chip */}
                {createdText && (
                  <View
                    style={{
                      backgroundColor: themeColors.surfaceHover,
                      borderRadius: 100,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={11}
                      color={themeColors.text.muted}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={{
                        color: themeColors.text.muted,
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                    >
                      {createdText}
                    </Text>
                  </View>
                )}

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
            )}
          </View>

          {/* Delete button (only show if not confirming) */}
          {!isConfirmingDelete && (
            <TouchableOpacity
              onPress={() => setIsConfirmingDelete(true)}
              style={{ padding: 6, marginLeft: 4 }}
            >
              <Ionicons name="trash-outline" size={16} color={themeColors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

