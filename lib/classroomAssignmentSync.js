import AsyncStorage from "@react-native-async-storage/async-storage";
import { notifyNewAssignment } from "./notifications";

const SEEN_KEY = "orio_classroom_seen_ids";
let syncInFlight = null;

export function classroomAssignmentKey(assignment) {
  return `${String(assignment?.course_id || "")}:${String(assignment?.id || "")}`;
}

export function deduplicateClassroomAssignments(assignments) {
  if (!Array.isArray(assignments)) return [];
  const unique = new Map();
  for (const assignment of assignments) {
    if (!assignment?.id) continue;
    const key = classroomAssignmentKey(assignment);
    const existing = unique.get(key);
    // Keep the most recently fetched version of a duplicate record.
    if (!existing || assignment.updated_at || assignment.update_time) {
      unique.set(key, assignment);
    }
  }
  return [...unique.values()];
}

/**
 * Shared by foreground and background sync so they cannot independently fire
 * duplicate notifications for the same coursework item.
 * The first successful sync establishes a baseline rather than notifying for
 * every old assignment already present in Classroom.
 */
export function syncClassroomAssignmentNotifications(assignments) {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const uniqueAssignments = deduplicateClassroomAssignments(assignments);
    if (!uniqueAssignments.length) return uniqueAssignments;

    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const hasBaseline = raw !== null;
    const previous = new Set(raw ? JSON.parse(raw).map(String) : []);
    const currentKeys = uniqueAssignments.map(classroomAssignmentKey);

    if (hasBaseline) {
      for (const assignment of uniqueAssignments) {
        const key = classroomAssignmentKey(assignment);
        const legacyId = String(assignment.id);
        if (previous.has(key) || previous.has(legacyId)) continue;
        await notifyNewAssignment(
          assignment.title || "New assignment",
          assignment.course_name || "Google Classroom",
          assignment.alternate_link
        );
        previous.add(key);
      }
    } else {
      currentKeys.forEach((key) => previous.add(key));
      uniqueAssignments.forEach((assignment) => previous.add(String(assignment.id)));
    }

    // Preserve history so a removed/reappearing coursework item isn't announced again.
    const history = [...previous].slice(-2000);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(history));
    return uniqueAssignments;
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}
