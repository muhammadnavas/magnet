import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../lib/api";
import { scheduleDeadlineAlert, cancelTaskReminder, syncTaskNotifications } from "../lib/notifications";

const TASKS_KEY = ["tasks"];
const LOCAL_TASKS_CACHE_KEY = "@orio_cached_tasks";

async function saveTasksToCache(tasks) {
  try {
    if (Array.isArray(tasks)) await AsyncStorage.setItem(LOCAL_TASKS_CACHE_KEY, JSON.stringify(tasks));
  } catch (e) { console.warn("Failed to save tasks to local cache:", e); }
}

async function getTasksFromCache() {
  try {
    const data = await AsyncStorage.getItem(LOCAL_TASKS_CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { console.warn("Failed to read tasks from local cache:", e); return []; }
}

function filterTasks(tasks, statusFilter) {
  if (!Array.isArray(tasks)) return [];
  return statusFilter ? tasks.filter((task) => task.status === statusFilter) : tasks;
}

let tasksRefreshPromise = null;

function refreshTasksInBackground(queryClient) {
  if (tasksRefreshPromise) return tasksRefreshPromise;
  tasksRefreshPromise = api.get("/tasks")
    .then(async (res) => {
      const tasks = Array.isArray(res.data) ? res.data : [];
      await saveTasksToCache(tasks);
      for (const filter of [null, "pending", "completed"]) {
        queryClient.setQueryData([...TASKS_KEY, filter], filterTasks(tasks, filter));
      }
      syncTaskNotifications(tasks).catch((err) => console.warn("Failed to sync task notifications:", err));
    })
    .catch((err) => {
      console.warn("Task background refresh failed; continuing with local cache:", err);
    })
    .finally(() => { tasksRefreshPromise = null; });
  return tasksRefreshPromise;
}

export function useGetTasks(statusFilter = null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [...TASKS_KEY, statusFilter],
    // Return local data immediately; refresh the server copy without blocking
    // the first render. Query invalidations also trigger this background sync.
    queryFn: async () => {
      const cached = await getTasksFromCache();
      const visible = filterTasks(cached, statusFilter);
      syncTaskNotifications(visible).catch((err) => console.warn("Failed to sync task notifications:", err));
      refreshTasksInBackground(queryClient);
      return visible;
    },
    // Avoid a full-screen loading state while AsyncStorage hydrates the cache.
    // Real cached/server data replaces this placeholder as soon as available.
    placeholderData: [],
    staleTime: 30_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    // The screen inserts the task optimistically before this request starts.
    // Keep the request asynchronous so a sleeping backend never blocks input.
    mutationFn: async (payload) => {
      const { _localId, ...serverPayload } = payload;
      try {
        const res = await api.post("/tasks", serverPayload);
        return { ...res.data, _localId, _offline: false };
      } catch (err) {
        console.warn("Task API unavailable; keeping task in local cache for retry:", err);
        return {
          id: _localId,
          title: serverPayload.title || "Untitled Task",
          priority: serverPayload.priority || "medium",
          deadline: serverPayload.deadline || null,
          reminder_interval_hours: 0,
          status: "pending",
          created_at: new Date().toISOString(),
          _offline: true,
        };
      }
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const previousQueries = qc.getQueriesData({ queryKey: TASKS_KEY });
      const optimisticTask = {
        id: payload._localId,
        title: payload.title || "Untitled Task",
        priority: payload.priority || "medium",
        deadline: payload.deadline || null,
        reminder_interval_hours: payload.reminder_interval_hours || 0,
        status: "pending",
        created_at: new Date().toISOString(),
        _sending: true,
      };
      qc.setQueriesData({ queryKey: TASKS_KEY }, (oldData) =>
        Array.isArray(oldData) ? [optimisticTask, ...oldData.filter((t) => t.id !== optimisticTask.id)] : oldData
      );
      const cached = await getTasksFromCache();
      await saveTasksToCache([optimisticTask, ...cached.filter((t) => t.id !== optimisticTask.id)]);
      return { previousQueries, optimisticTask };
    },
    onSuccess: async (task, payload) => {
      qc.setQueriesData({ queryKey: TASKS_KEY }, (oldData) =>
        Array.isArray(oldData)
          ? [task, ...oldData.filter((t) => t.id !== payload._localId && t.id !== task.id)]
          : oldData
      );
      const allTasks = await getTasksFromCache();
      await saveTasksToCache([task, ...allTasks.filter((t) => t.id !== payload._localId && t.id !== task.id)]);
      if (!task._offline) qc.invalidateQueries({ queryKey: TASKS_KEY });
      await cancelTaskReminder(task.id);
      if (task.deadline) {
        await scheduleDeadlineAlert({ id: task.id, title: task.title, deadline: task.deadline });
      }
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.patch(`/tasks/${id}`, payload)).data,
    onMutate: async ({ id, ...payload }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const previousQueries = qc.getQueriesData({ queryKey: TASKS_KEY });
      qc.setQueriesData({ queryKey: TASKS_KEY }, (oldData) => Array.isArray(oldData) ? oldData.map((t) => t.id === id ? { ...t, ...payload } : t) : oldData);
      return { previousQueries };
    },
    onError: (err, newMeta, context) => {
      if (context?.previousQueries) context.previousQueries.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: async (task) => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      if (!task) return;
      await cancelTaskReminder(task.id);
      if (task.status === "pending" && task.deadline) {
        await scheduleDeadlineAlert({ id: task.id, title: task.title, deadline: task.deadline });
      }
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => { await api.delete(`/tasks/${id}`); return id; },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const previousQueries = qc.getQueriesData({ queryKey: TASKS_KEY });
      qc.setQueriesData({ queryKey: TASKS_KEY }, (oldData) => Array.isArray(oldData) ? oldData.filter((t) => t.id !== id) : oldData);
      return { previousQueries };
    },
    onError: (err, id, context) => {
      if (context?.previousQueries) context.previousQueries.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: async (id) => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      if (id) await cancelTaskReminder(id);
    },
  });
}

export function useParseTask() {
  return useMutation({
    mutationFn: async (raw_text) => {
      const current_time = new Date().toISOString();
      const res = await api.post("/tasks/parse", { raw_text, current_time });
      return res.data;
    },
  });
}
