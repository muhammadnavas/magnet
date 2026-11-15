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

function updateTaskQueries(queryClient, taskId, updater) {
  const snapshots = queryClient.getQueriesData({ queryKey: TASKS_KEY });
  for (const [key, data] of snapshots) {
    if (!Array.isArray(data)) continue;
    const allUpdated = data.map((task) => task.id === taskId ? updater(task) : task);
    queryClient.setQueryData(key, filterTasks(allUpdated, key[1] || null));
  }
}

let tasksRefreshPromise = null;
let tasksRefreshVersion = 0;

function refreshTasksInBackground(queryClient) {
  // If an older refresh is already running, wait for it and then issue a
  // fresh request. This prevents a pre-mutation response overwriting a newer
  // task status after the mutation has completed.
  if (tasksRefreshPromise) {
    return tasksRefreshPromise.then(() => refreshTasksInBackground(queryClient));
  }

  const requestVersion = tasksRefreshVersion;
  tasksRefreshPromise = api.get("/tasks")
    .then(async (res) => {
      const tasks = Array.isArray(res.data) ? res.data : [];
      if (requestVersion !== tasksRefreshVersion) return;
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
    // Render cached tasks immediately, then reconcile them with the server.
    queryFn: async () => {
      const cached = await getTasksFromCache();
      const visible = filterTasks(cached, statusFilter);
      syncTaskNotifications(visible).catch((err) => console.warn("Failed to sync task notifications:", err));
      refreshTasksInBackground(queryClient);
      return visible;
    },
    placeholderData: [],
    staleTime: 30_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
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
      tasksRefreshVersion += 1;
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
      const nextCached = [optimisticTask, ...cached.filter((t) => t.id !== optimisticTask.id)];
      await saveTasksToCache(nextCached);
      return { previousQueries, previousCached: cached, optimisticTask };
    },
    onSuccess: async (task, payload) => {
      tasksRefreshVersion += 1;
      const allTasks = await getTasksFromCache();
      const nextTasks = [task, ...allTasks.filter((t) => t.id !== payload._localId && t.id !== task.id)];
      await saveTasksToCache(nextTasks);
      for (const filter of [null, "pending", "completed"]) {
        qc.setQueryData([...TASKS_KEY, filter], filterTasks(nextTasks, filter));
      }
      if (!task._offline) qc.invalidateQueries({ queryKey: TASKS_KEY });
      await cancelTaskReminder(task.id);
      if (task.deadline) {
        await scheduleDeadlineAlert({ id: task.id, title: task.title, deadline: task.deadline });
      }
    },
    onError: async (err, payload, context) => {
      if (context?.previousQueries) context.previousQueries.forEach(([key, data]) => qc.setQueryData(key, data));
      if (context?.previousCached) await saveTasksToCache(context.previousCached);
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.patch(`/tasks/${id}`, payload)).data,
    onMutate: async ({ id, ...payload }) => {
      // Invalidate any in-flight background refresh so its older response
      // cannot overwrite this optimistic status change.
      tasksRefreshVersion += 1;
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const previousQueries = qc.getQueriesData({ queryKey: TASKS_KEY });
      const previousCached = await getTasksFromCache();
      updateTaskQueries(qc, id, (task) => ({ ...task, ...payload }));
      await saveTasksToCache(previousCached.map((task) => task.id === id ? { ...task, ...payload } : task));
      return { previousQueries, previousCached };
    },
    onSuccess: async (serverTask) => {
      // The API response is authoritative. Persist it before invalidating
      // queries, so a refresh/relaunch never hydrates the old status.
      tasksRefreshVersion += 1;
      const cached = await getTasksFromCache();
      const nextTasks = cached.map((task) => task.id === serverTask.id ? { ...task, ...serverTask } : task);
      if (!nextTasks.some((task) => task.id === serverTask.id)) nextTasks.unshift(serverTask);
      await saveTasksToCache(nextTasks);
      for (const filter of [null, "pending", "completed"]) {
        qc.setQueryData([...TASKS_KEY, filter], filterTasks(nextTasks, filter));
      }
    },
    onError: async (err, variables, context) => {
      if (context?.previousQueries) context.previousQueries.forEach(([key, data]) => qc.setQueryData(key, data));
      if (context?.previousCached) await saveTasksToCache(context.previousCached);
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
      tasksRefreshVersion += 1;
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const previousQueries = qc.getQueriesData({ queryKey: TASKS_KEY });
      const previousCached = await getTasksFromCache();
      qc.setQueriesData({ queryKey: TASKS_KEY }, (oldData) => Array.isArray(oldData) ? oldData.filter((t) => t.id !== id) : oldData);
      await saveTasksToCache(previousCached.filter((task) => task.id !== id));
      return { previousQueries, previousCached };
    },
    onError: async (err, id, context) => {
      if (context?.previousQueries) context.previousQueries.forEach(([key, data]) => qc.setQueryData(key, data));
      if (context?.previousCached) await saveTasksToCache(context.previousCached);
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
