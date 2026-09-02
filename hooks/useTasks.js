import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import {
  scheduleTaskReminder,
  scheduleDeadlineAlert,
  cancelTaskReminder,
} from "../lib/notifications";

const TASKS_KEY = ["tasks"];

// ─── Fetch all tasks (with optional status filter) ───────────────────────────
export function useGetTasks(statusFilter = null) {
  return useQuery({
    queryKey: [...TASKS_KEY, statusFilter],
    queryFn: async () => {
      const params = statusFilter ? { status_filter: statusFilter } : {};
      const res = await api.get("/tasks", { params });
      return res.data;
    },
    staleTime: 30_000,
  });
}

// ─── Create a new task ───────────────────────────────────────────────────────
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/tasks", payload);
      return res.data;
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

