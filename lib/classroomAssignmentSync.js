import AsyncStorage from "@react-native-async-storage/async-storage";
import { notifyNewAssignment } from "./notifications";

const SEEN_KEY = "orio_classroom_seen_ids";
const CHECKPOINT_KEY = "orio_classroom_last_successful_sync_at";
let syncInFlight = null;

function timestampOf(assignment) {
  const raw = assignment?.creation_time || assignment?.update_time;
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

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
    if (!uniqueAssignments.length) return { assignments: uniqueAssignments, newCount: 0 };

    const [rawSeen, rawCheckpoint] = await Promise.all([
      AsyncStorage.getItem(SEEN_KEY),
      AsyncStorage.getItem(CHECKPOINT_KEY),
    ]);
    const hasBaseline = rawSeen !== null;
    const previous = new Set(rawSeen ? JSON.parse(rawSeen).map(String) : []);
    const checkpoint = rawCheckpoint ? Date.parse(rawCheckpoint) : null;
    const currentKeys = uniqueAssignments.map(classroomAssignmentKey);
    let newCount = 0;

    if (hasBaseline) {
      for (const assignment of uniqueAssignments) {
        const key = classroomAssignmentKey(assignment);
        const legacyId = String(assignment.id);
        if (previous.has(key) || previous.has(legacyId)) continue;

        const postedAt = timestampOf(assignment);
        // When Google supplies timestamps, only announce work posted/updated
        // after the last successful sync. Missing timestamps fall back to the
        // stable-ID check so an API response variation cannot hide new work.
        const newerThanCheckpoint =
          checkpoint === null || postedAt === null || postedAt > checkpoint;
        if (!newerThanCheckpoint) {
          previous.add(key);
          previous.add(legacyId);
          continue;
        }

        await notifyNewAssignment(
          assignment.title || "New assignment",
          assignment.course_name || "Google Classroom",
          assignment.alternate_link
        );
        previous.add(key);
        previous.add(legacyId);
        newCount += 1;
      }
    } else {
      // First sync is a baseline: don't send a flood of notifications for
      // coursework that already existed before Magnet was connected.
      currentKeys.forEach((key) => previous.add(key));
      uniqueAssignments.forEach((assignment) => previous.add(String(assignment.id)));
    }

    // Keep bounded ID history; the timestamp checkpoint prevents repeatedly
    // treating older dates as fresh posts on later syncs.
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...previous].slice(-2000)));
    await AsyncStorage.setItem(CHECKPOINT_KEY, new Date().toISOString());
    return { assignments: uniqueAssignments, newCount };
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}
