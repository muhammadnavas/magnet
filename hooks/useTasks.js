import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../lib/api";
import {
  scheduleTaskReminder,
  scheduleDeadlineAlert,
  cancelTaskReminder,
  syncTaskNotifications,
} from "../lib/notifications";

const TASKS_KEY = ["tasks"];
const LOCAL_TASKS_CACHE_KEY = "@orio_cached_tasks";

async function saveTasksToCache(tasks) {
  try {
    if (Array.isArray(tasks)) {
      await AsyncStorage.setItem(LOCAL_TASKS_CACHE_KEY, JSON.stringify(tasks));
    }
  } catch (e) {
    console.warn("Failed to save tasks to local cache:", e);
  }
}

async function getTasksFromCache() {
  try {
    const data = await AsyncStorage.getItem(LOCAL_TASKS_CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn("Failed to read tasks from local cache:", e);
    return [];
  }
}

// ─── Fetch all tasks (with optional status filter) ───────────────────────────
export function useGetTasks(statusFilter = null) {
  return useQuery({
    queryKey: [...TASKS_KEY, statusFilter],
    queryFn: async () => {
      let tasks = [];
      try {
        const params = statusFilter ? { status_filter: statusFilter } : {};
        const res = await api.get("/tasks", { params });
        tasks = res.data;
        if (Array.isArray(tasks)) {
          await saveTasksToCache(tasks);
        }
      } catch (err) {
        console.warn("Backend API unreachable. Falling back to local offline task cache:", err);
        tasks = await getTasksFromCache();
        if (statusFilter && Array.isArray(tasks)) {
          tasks = tasks.filter((t) => t.status === statusFilter);
        }
      }

      if (Array.isArray(tasks)) {
        syncTaskNotifications(tasks).catch((err) =>
          console.warn("Failed to sync task notifications:", err)
        );
      }
      return tasks;
    },
    staleTime: 30_000,
  });
}

// ─── Create a new task ───────────────────────────────────────────────────────
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      try {
        const res = await api.post("/tasks", payload);
        return res.data;
      } catch (err) {
        console.warn("Backend post failed. Creating task in local offline cache:", err);
        const fallbackTask = {
          id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: payload.title || "Untitled Task",
          priority: payload.priority || "medium",
          deadline: payload.deadline || null,
          reminder_interval_hours: payload.reminder_interval_hours || 24,
          status: "pending",
          created_at: new Date().toISOString(),
        };
        const cached = await getTasksFromCache();
        const updated = [fallbackTask, ...cached];
        await saveTasksToCache(updated);
        return fallbackTask;
      }
    },
    onSuccess: async (task) => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      // Schedule reminders
      await scheduleTaskReminder({
        id: task.id,
        title: task.title,
        reminderIntervalHours: task.reminder_interval_hours,
      });
      if (task.deadline) {
        await scheduleDeadlineAlert({ id: task.id, title: task.title, deadline: task.deadline });
      }
    },
  });
}

// ─── Update / mark complete ──────────────────────────────────────────────────
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const res = await api.patch(`/tasks/${id}`, payload);
      return res.data;
    },
    onMutate: async ({ id, ...payload }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const previousQueries = qc.getQueriesData({ queryKey: TASKS_KEY });

      qc.setQueriesData({ queryKey: TASKS_KEY }, (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((t) => (t.id === id ? { ...t, ...payload } : t));
      });

      return { previousQueries };
    },
    onError: (err, newMeta, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([key, data]) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSettled: async (task) => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      if (task && task.status === "completed") {
        await cancelTaskReminder(task.id);
      }
    },
  });
}


// ─── Delete a task ───────────────────────────────────────────────────────────
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/tasks/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const previousQueries = qc.getQueriesData({ queryKey: TASKS_KEY });

      qc.setQueriesData({ queryKey: TASKS_KEY }, (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.filter((t) => t.id !== id);
      });

      return { previousQueries };
    },
    onError: (err, id, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([key, data]) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSettled: async (id) => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      if (id) await cancelTaskReminder(id);
    },
  });
}

// ─── Parse task using AI ─────────────────────────────────────────────────────
export function useParseTask() {
  return useMutation({
    mutationFn: async (raw_text) => {
      const current_time = new Date().toISOString();
      const res = await api.post("/tasks/parse", { raw_text, current_time });
      return res.data; // { title, priority, deadline, reminder_interval_hours }
    }
  });
}

