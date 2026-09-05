import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Configure notification handler so alerts display with sound and banner even when the app is in foreground.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions and set up Android Notification Channel.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermissions() {
  if (Platform.OS === "web") return false;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Task Reminders",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6C63FF",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (e) {
    console.warn("requestNotificationPermissions failed:", e);
    return false;
  }
}

/**
 * Schedule a local notification for a task.
 *
 * - Fires a confirmation notification 2 seconds after creation.
 * - Schedules a repeating reminder every `reminderIntervalHours` hours.
 */
export async function scheduleTaskReminder(task) {
  if (Platform.OS === "web") return [];
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) {
      console.warn("Notification permission not granted. Reminder skipped.");
      return [];
    }

    // Cancel existing notifications for this task first
    await cancelTaskReminder(task.id);

    const intervalHours = task.reminderIntervalHours || task.reminder_interval_hours || 24;
    const intervalSeconds = Math.max(intervalHours * 60 * 60, 60);
    const ids = [];

    // 1. Immediate confirmation notification (2 seconds from now)
    const confirmId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Task Reminder Set!",
        body: `"${task.title}" — Reminding every ${intervalHours}h.`,
        data: { taskId: task.id, type: "confirm" },
        sound: true,
        channelId: "default",
      },
      trigger: { seconds: 2 },
    });
    ids.push(confirmId);

    // 2. Recurring reminder
    const repeatId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Task Reminder",
        body: task.title,
        data: { taskId: task.id, type: "repeat" },
        sound: true,
        channelId: "default",
      },
      trigger: {
        seconds: intervalSeconds,
        repeats: true,
      },
    });
    ids.push(repeatId);

    console.log(`Reminders scheduled for task "${task.title}" (every ${intervalHours}h, confirmId=${confirmId})`);
    return ids;
  } catch (e) {
    console.warn("scheduleTaskReminder failed:", e);
    return [];
  }
}

/**
 * Cancel all scheduled reminders for a task.
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
 * Schedule a one-time deadline alert that fires exactly at the task's deadline.
 */
export async function scheduleDeadlineAlert(task) {
  if (Platform.OS === "web" || !task.deadline) return null;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;

    const deadlineDate = new Date(task.deadline);
    if (deadlineDate <= new Date()) {
      console.warn("Deadline is in the past, skipping alert.");
      return null;
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📅 Task Due Now!",
        body: task.title,
        data: { taskId: task.id, type: "deadline" },
        sound: true,
        channelId: "default",
      },
      trigger: { date: deadlineDate },
    });

    console.log(`Deadline alert scheduled for "${task.title}" at ${deadlineDate.toISOString()}`);
    return identifier;
  } catch (e) {
    console.warn("scheduleDeadlineAlert failed:", e);
    return null;
  }
}
