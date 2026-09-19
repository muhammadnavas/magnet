/**
 * classroomBackgroundSync.js
 *
 * Registers an Expo Background Fetch task that silently polls the backend
 * for new Google Classroom assignments and fires a local notification when
 * any are found — even while the app is closed.
 *
 * iOS:  fires every ~15 min (OS-throttled)
 * Android: fires every 15 min via WorkManager; survives app kill & device reboot
 */

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// ─── Constants ──────────────────────────────────────────────────────────────
export const CLASSROOM_SYNC_TASK = "ORIO_CLASSROOM_SYNC";

const SEEN_KEY = "orio_classroom_seen_ids";
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ─── Standalone API helper (no axios / no React hooks) ──────────────────────
async function bgFetch(path) {
  const token = Platform.OS !== "web"
    ? await SecureStore.getItemAsync("accessToken")
    : null;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.json();
}

// ─── Notification helper (no-hooks version) ──────────────────────────────────
async function sendBgNotification(title, courseName) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("classroom", {
      name: "Google Classroom",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#6C63FF",
      sound: "default",
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "📚 New Assignment!",
      body: `${title}\n${courseName}`,
      data: { type: "new_assignment" },
      sound: "default",
      channelId: "classroom",
    },
    trigger: null, // immediate
  });
}

// ─── Task definition (MUST be at module level, called before any trigger) ───
// Expo requires TaskManager.defineTask() to run synchronously during app init.
TaskManager.defineTask(CLASSROOM_SYNC_TASK, async () => {
  console.log("[CLASSROOM BG SYNC] Task fired");
  try {
    // 1. Check if classroom is connected
    const status = await bgFetch("/classroom/status");
    if (!status?.connected) {
      console.log("[CLASSROOM BG SYNC] Not connected, skipping.");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 2. Fetch all assignments
    const assignments = await bgFetch("/classroom/assignments");
    if (!Array.isArray(assignments)) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 3. Diff against last-seen IDs
    const raw     = await AsyncStorage.getItem(SEEN_KEY);
    const seenIds = new Set(raw ? JSON.parse(raw) : []);
    const newOnes = assignments.filter((a) => !seenIds.has(a.id));

    // 4. Fire a notification for each new assignment (skip first-ever sync)
    if (seenIds.size > 0 && newOnes.length > 0) {
      for (const a of newOnes) {
        await sendBgNotification(a.title, a.course_name);
      }
      console.log(`[CLASSROOM BG SYNC] Notified for ${newOnes.length} new assignment(s)`);
    }

    // 5. Persist current assignment IDs as "seen"
    await AsyncStorage.setItem(
      SEEN_KEY,
      JSON.stringify(assignments.map((a) => a.id))
    );

    return newOnes.length > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;

  } catch (e) {
    console.warn("[CLASSROOM BG SYNC] Error:", e?.message);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Registration helpers (call from app startup) ────────────────────────────

/**
 * Start polling. Safe to call multiple times — checks if already registered.
 */
export async function registerClassroomBackgroundSync() {
  if (Platform.OS === "web") return; // Background Fetch not supported on web

  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.warn("[CLASSROOM BG SYNC] Background fetch is restricted/denied by OS.");
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(CLASSROOM_SYNC_TASK);
    if (isRegistered) {
      console.log("[CLASSROOM BG SYNC] Already registered.");
      return;
    }

    await BackgroundFetch.registerTaskAsync(CLASSROOM_SYNC_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (iOS minimum enforced by OS)
      stopOnTerminate: false,   // Android: keep running after app is killed
      startOnBoot: true,        // Android: restart after device reboot
    });
    console.log("[CLASSROOM BG SYNC] Registered successfully.");
  } catch (e) {
    console.warn("[CLASSROOM BG SYNC] Registration failed:", e?.message);
  }
}

/**
 * Stop polling. Call when user disconnects Google Classroom.
 */
export async function unregisterClassroomBackgroundSync() {
  if (Platform.OS === "web") return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(CLASSROOM_SYNC_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(CLASSROOM_SYNC_TASK);
      console.log("[CLASSROOM BG SYNC] Unregistered.");
    }
  } catch (e) {
    console.warn("[CLASSROOM BG SYNC] Unregistration failed:", e?.message);
  }
}
