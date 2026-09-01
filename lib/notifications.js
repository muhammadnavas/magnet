import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Check if running inside Expo Go app (SDK 53+ limits push in Expo Go)
const isExpoGo = Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient";

// Safely configure handler (ignored gracefully in Expo Go)
try {
  if (!isExpoGo && Platform.OS !== "web") {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (e) {
  // Ignored gracefully in Expo Go
}

export async function requestNotificationPermissions() {
  if (Platform.OS === "web" || isExpoGo) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (e) {
    return false;
  }
}

/**
 * Schedule a recurring local notification for a task.
 * Fires every `intervalHours` hours until cancelled.
 * Returns the notification identifier (store it to cancel later).
 */
export async function scheduleTaskReminder(task) {
  if (Platform.OS === "web") return null;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;

    // Cancel any existing reminder for this task first
    await cancelTaskReminder(task.id);

    const intervalSeconds = (task.reminderIntervalHours || 24) * 60 * 60;

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ Task Reminder`,
        body: task.title,
        data: { taskId: task.id },
        sound: true,
      },
      trigger: {
        seconds: intervalSeconds,
        repeats: true,
      },
    });

    return identifier;
  } catch (e) {
    console.warn("scheduleTaskReminder failed:", e);
    return null;
  }
}

/**
 * Cancel a scheduled reminder using the stored notification identifier.
 */
export async function cancelTaskReminder(taskId) {
  if (Platform.OS === "web") return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content?.data?.taskId === taskId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch (e) {
    console.warn("cancelTaskReminder failed:", e);
  }
}

/**
 * Schedule an immediate (one-time) notification for a deadline.
 * fires at the deadline date/time.
 */
export async function scheduleDeadlineAlert(task) {
  if (Platform.OS === "web" || !task.deadline) return null;
  try {
    const deadlineDate = new Date(task.deadline);
    if (deadlineDate <= new Date()) return null; // Already past

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `📅 Task Due Now!`,
        body: task.title,
        data: { taskId: task.id, type: "deadline" },
        sound: true,
      },
      trigger: { date: deadlineDate },
    });
    return identifier;
  } catch (e) {
    console.warn("scheduleDeadlineAlert failed:", e);
    return null;
  }
}
