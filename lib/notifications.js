import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Always configure the notification handler so alerts show even when the app is in foreground.
 * (Previously this was guarded by an isExpoGo check that silently swallowed all notifications.)
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermissions() {
  if (Platform.OS === "web") return false;
  try {
    // Check existing permission first to avoid repeated dialogs
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
 * Schedule a recurring local notification for a task.
 *
 * - Fires a first alert immediately (after 5s) so the user confirms the reminder is set.
 * - Then schedules a repeating reminder every `reminderIntervalHours` hours.
 *
 * Returns an array of notification identifiers (store to cancel later).
 */
export async function scheduleTaskReminder(task) {
  if (Platform.OS === "web") return [];
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) {
      console.warn("Notification permission not granted. Reminder skipped.");
      return [];
    }

    // Cancel any existing reminders for this task first
    await cancelTaskReminder(task.id);

    const intervalSeconds = Math.max((task.reminderIntervalHours || 24) * 60 * 60, 60);
    const ids = [];

    // 1. Immediate confirmation notification (5 seconds from now)
    const confirmId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Reminder Set!",
        body: `"${task.title}" — I'll remind you every ${task.reminderIntervalHours || 24}h.`,
        data: { taskId: task.id, type: "confirm" },
        sound: true,
      },
      trigger: { seconds: 5 },
    });
    ids.push(confirmId);

    // 2. Recurring reminder
    const repeatId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Task Reminder",
        body: task.title,
        data: { taskId: task.id, type: "repeat" },
        sound: true,
      },
      trigger: {
        seconds: intervalSeconds,
        repeats: true,
      },
    });
    ids.push(repeatId);

    console.log(`Reminders scheduled for task "${task.title}" (every ${task.reminderIntervalHours}h)`);
    return ids;
  } catch (e) {
    console.warn("scheduleTaskReminder failed:", e);
    return [];
  }
}

/**
 * Cancel all scheduled reminders for a task (matches by taskId in notification data).
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
