import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Registry to track active Web Notification timers by taskId.
 */
const webTimers = new Map();

/**
 * Configure notification handler so alerts display with sound and banner even when the app is in foreground.
 */
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Request notification permissions (supports iOS, Android, and Web browsers).
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermissions() {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") return true;
      if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      }
    }
    return false;
  }
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
 * Works seamlessly on iOS, Android, and Web browsers.
 *
 * - Fires a confirmation notification 2 seconds after creation.
 * - Schedules a repeating reminder every `reminderIntervalHours` hours.
 */
export async function scheduleTaskReminder(task) {
  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.warn("Notification permission not granted. Reminder skipped.");
    return [];
  }

  const intervalHours = task.reminderIntervalHours || task.reminder_interval_hours || 24;

  if (Platform.OS === "web") {
    await cancelTaskReminder(task.id);
    const timers = [];

    // 1. Immediate confirmation notification (2 seconds from now)
    const confirmTimer = setTimeout(() => {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("⏰ Task Reminder Set!", {
          body: `"${task.title}" — Reminding every ${intervalHours}h.`,
        });
      }
    }, 2000);
    timers.push(confirmTimer);

    // 2. Recurring interval
    const intervalMs = Math.max(intervalHours * 3600 * 1000, 60000);
    const repeatTimer = setInterval(() => {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("⏰ Task Reminder", {
          body: task.title,
        });
      }
    }, intervalMs);
    timers.push(repeatTimer);

    webTimers.set(task.id, timers);
    console.log(`Web reminders scheduled for task "${task.title}" (every ${intervalHours}h)`);
    return timers;
  }

  // Native (iOS / Android)
  try {
    await cancelTaskReminder(task.id);

    const intervalSeconds = Math.max(intervalHours * 60 * 60, 60);
    const ids = [];

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
  if (Platform.OS === "web") {
    const timers = webTimers.get(taskId);
    if (timers) {
      timers.forEach((t) => {
        clearTimeout(t);
        clearInterval(t);
      });
      webTimers.delete(taskId);
    }
    return;
  }
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
  if (!task.deadline) return null;

  const deadlineDate = new Date(task.deadline);
  const diffMs = deadlineDate.getTime() - Date.now();
  if (diffMs <= 0) {
    console.warn("Deadline is in the past, skipping alert.");
    return null;
  }

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  if (Platform.OS === "web") {
    const timer = setTimeout(() => {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("📅 Task Due Now!", {
          body: task.title,
        });
      }
    }, diffMs);
    const existing = webTimers.get(task.id) || [];
    webTimers.set(task.id, [...existing, timer]);
    return timer;
  }

  try {
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
