import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const webTimers = new Map();

function parseTaskDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === "string") {
    const hasTz = dateVal.endsWith("Z") || dateVal.includes("+") || dateVal.includes("-", 10);
    const formatted = hasTz ? dateVal : `${dateVal}Z`;
    const d = new Date(formatted);
    return isNaN(d.getTime()) ? new Date(dateVal) : d;
  }
  return new Date(dateVal);
}

function playWebNotificationSound() {
  if (typeof window === "undefined" || Platform.OS !== "web") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("AudioContext chime failed:", e);
  }
}

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  });
}

export async function requestNotificationPermissions() {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") return true;
      if (Notification.permission !== "denied") {
        try {
          return (await Notification.requestPermission()) === "granted";
        } catch (e) {
          console.warn("Notification.requestPermission failed:", e);
        }
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
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
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

export async function scheduleTaskReminder(task) {
  if (!task || task.status === "completed") return [];

  const granted = await requestNotificationPermissions();
  const intervalHours = Number(task.reminderIntervalHours || task.reminder_interval_hours || 24);

  if (Platform.OS === "web") {
    const intervalMs = Math.max(intervalHours * 3600 * 1000, 60000);
    const repeatTimer = setInterval(() => {
      playWebNotificationSound();
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("⏰ Task Reminder", { body: task.title });
        } catch (e) {
          console.warn("Web Notification constructor failed:", e);
        }
      }
    }, intervalMs);
    webTimers.set(task.id, [...(webTimers.get(task.id) || []), repeatTimer]);
    console.log(`Web reminder scheduled for "${task.title}" every ${intervalHours}h`);
    return [repeatTimer];
  }

  if (!granted) {
    console.warn("Notification permission not granted. Reminder skipped.");
    return [];
  }

  try {
    const intervalSeconds = Math.max(intervalHours * 60 * 60, 60);
    const repeatId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Task Reminder",
        body: task.title,
        data: { taskId: task.id, type: "repeat" },
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        channelId: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: intervalSeconds,
        repeats: true,
        channelId: "default",
      },
    });

    console.log(`Reminder scheduled for "${task.title}" in ${intervalHours}h (repeatId=${repeatId})`);
    return [repeatId];
  } catch (e) {
    console.warn("scheduleTaskReminder failed:", e);
    return [];
  }
}

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
    await Promise.all(
      scheduled
        .filter((n) => n.content?.data?.taskId === taskId)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch (e) {
    console.warn("cancelTaskReminder failed:", e);
  }
}

export async function scheduleDeadlineAlert(task) {
  if (!task || !task.deadline || task.status === "completed") return null;

  const deadlineDate = parseTaskDate(task.deadline);
  if (!deadlineDate || isNaN(deadlineDate.getTime())) return null;

  const diffMs = deadlineDate.getTime() - Date.now();
  console.log(`Scheduling deadline alert for "${task.title}" at ${deadlineDate.toISOString()} (in ${Math.round(diffMs / 1000)}s)`);

  if (diffMs <= 0) {
    console.warn("Deadline is in the past, skipping alert.");
    return null;
  }

  const granted = await requestNotificationPermissions();

  if (Platform.OS === "web") {
    const existing = webTimers.get(task.id) || [];
    const timer = setTimeout(() => {
      playWebNotificationSound();
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("📅 Task Due Now!", { body: `"${task.title}" is due now!` });
        } catch (e) {
          console.warn("Web Notification constructor failed:", e);
        }
      }
    }, diffMs);
    webTimers.set(task.id, [...existing, timer]);
    return timer;
  }

  if (!granted) return null;

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📅 Task Due Now!",
        body: `"${task.title}" is due now!`,
        data: { taskId: task.id, type: "deadline" },
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        channelId: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: deadlineDate,
        channelId: "default",
      },
    });

    console.log(`Deadline alert scheduled for "${task.title}" at ${deadlineDate.toISOString()} (id=${identifier})`);
    return identifier;
  } catch (e) {
    console.warn("scheduleDeadlineAlert failed:", e);
    return null;
  }
}

export async function syncTaskNotifications(tasks) {
  if (!Array.isArray(tasks)) return;

  try {
    // Remove stale/duplicate schedules first.
    for (const task of tasks) {
      await cancelTaskReminder(task.id);
    }

    // IMPORTANT: schedule the repeating reminder first. It must not cancel
    // the deadline alert, because both notifications belong to the same task.
    for (const task of tasks) {
      if (task.status !== "pending") continue;
      await scheduleTaskReminder(task);
      if (task.deadline) {
        await scheduleDeadlineAlert(task);
      }
    }
  } catch (e) {
    console.warn("syncTaskNotifications error:", e);
  }
}
