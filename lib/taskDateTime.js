const WEEKDAYS = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

const MONTHS = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function parseTime(text) {
  const value = text.toLowerCase();
  if (/\bmidnight\b/.test(value)) return { hour: 0, minute: 0 };
  if (/\b(noon|midday)\b/.test(value)) return { hour: 12, minute: 0 };

  const match = value.match(/\b(?:at|around|by|before|on)?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const pm = match[3].toLowerCase().replace(/\./g, "") === "pm";
    if (pm && hour !== 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
    return { hour, minute };
  }

  const twentyFour = value.match(/\b(?:at|around|by|before|on)?\s*(\d{1,2}):(\d{2})\b/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour <= 23 && minute <= 59) return { hour, minute };
  }

  // Only interpret bare hours when the wording clearly marks a time.
  const bare = value.match(/\b(?:at|around)\s+(\d{1,2})\b/);
  if (bare) {
    const hour = Number(bare[1]);
    if (hour >= 0 && hour <= 23) return { hour, minute: 0 };
  }

  return null;
}

function applyTime(date, time, defaultEndOfDay = true) {
  const d = new Date(date);
  if (time) d.setHours(time.hour, time.minute, 0, 0);
  else if (defaultEndOfDay) return endOfDay(d);
  return d;
}

function findExplicitDate(text, now) {
  const value = text.toLowerCase();

  // YYYY-MM-DD / YYYY/MM/DD. ISO ordering is unambiguous.
  let match = value.match(/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d;
  }

  // Indian-friendly numeric date: DD/MM[/YYYY]. Also accepts DD-MM-YYYY.
  match = value.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](20\d{2}))?\b/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3] || now.getFullYear());
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d;
  }

  // Month-name dates: September 11, Sep 11th, 11 September 2026.
  const monthNames = Object.keys(MONTHS).join("|");
  match = value.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, "i"));
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    const day = Number(match[2]);
    const year = Number(match[3] || now.getFullYear());
    const d = new Date(year, month, day);
    if (d.getMonth() === month && d.getDate() === day) return d;
  }

  match = value.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})(?:,?\\s+(20\\d{2}))?\\b`, "i"));
  if (match) {
    const day = Number(match[1]);
    const month = MONTHS[match[2].toLowerCase()];
    const year = Number(match[3] || now.getFullYear());
    const d = new Date(year, month, day);
    if (d.getMonth() === month && d.getDate() === day) return d;
  }

  return null;
}

function findWeekdayDate(text, now) {
  const value = text.toLowerCase();
  const match = value.match(/\b(this|next|coming)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (!match) return null;

  const target = WEEKDAYS[match[2]];
  const current = now.getDay();
  let delta = (target - current + 7) % 7;
  const modifier = match[1] || "";

  if (modifier === "next") delta = delta === 0 ? 7 : delta + 7;
  else if (modifier === "this" || modifier === "coming") {
    // "this Friday" means the next occurrence in the current week.
    // If it has already passed, move to the following week rather than the past.
    if (delta === 0 && now.getHours() >= 0) delta = 0;
  }

  const d = addDays(startOfDay(now), delta);
  return d;
}

function parseRelative(text, now) {
  const value = text.toLowerCase();
  let match = value.match(/\b(?:in|after|for|within)\s+(\d+(?:\.\d+)?)\s*(seconds?|secs?|s)\b/);
  if (match) return addMinutes(now, Number(match[1]) / 60);

  match = value.match(/\b(?:in|after|for|within)\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|m)\b/);
  if (match) return addMinutes(now, Number(match[1]));

  match = value.match(/\b(?:in|after|for|within)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h)\b/);
  if (match) return addMinutes(now, Number(match[1]) * 60);

  match = value.match(/\b(?:in|after|for|within)\s+(\d+(?:\.\d+)?)\s*(days?|d)\b/);
  if (match) return addDays(now, Number(match[1]));

  match = value.match(/\b(?:in|after|for|within)\s+(\d+(?:\.\d+)?)\s*(weeks?|wks?|wk|w)\b/);
  if (match) return addDays(now, Number(match[1]) * 7);

  if (/\bday after tomorrow\b/.test(value)) return addDays(now, 2);
  if (/\btomorrow\b/.test(value)) return addDays(now, 1);
  if (/\btoday\b/.test(value)) return new Date(now);

  return null;
}

function parseDayPart(text, date) {
  const value = text.toLowerCase();
  const d = new Date(date);
  if (/\bmidnight\b/.test(value)) d.setHours(0, 0, 0, 0);
  else if (/\b(noon|midday)\b/.test(value)) d.setHours(12, 0, 0, 0);
  else if (/\b(morning|am)\b/.test(value) && !/\d\s*(?:am|pm)/.test(value)) d.setHours(9, 0, 0, 0);
  else if (/\bafternoon\b/.test(value)) d.setHours(15, 0, 0, 0);
  else if (/\b(evening)\b/.test(value)) d.setHours(19, 0, 0, 0);
  else if (/\bnight\b/.test(value)) d.setHours(21, 0, 0, 0);
  return d;
}

/**
 * Deterministically extracts common task date/time expressions before AI output
 * is trusted. Returns a local-device ISO timestamp or null.
 */
export function parseTaskDateTime(text, baseDate = new Date()) {
  const value = String(text || "").trim();
  if (!value) return null;
  const now = new Date(baseDate);
  const time = parseTime(value);

  const relative = parseRelative(value, now);
  if (relative) {
    if (time) {
      const d = new Date(relative);
      d.setHours(time.hour, time.minute, 0, 0);
      return d.toISOString();
    }
    return relative.toISOString();
  }

  if (/\bday after tomorrow\b/i.test(value)) return endOfDay(addDays(now, 2)).toISOString();
  if (/\btomorrow\b/i.test(value)) return applyTime(addDays(now, 1), time).toISOString();
  if (/\btoday\b/i.test(value)) return applyTime(now, time).toISOString();

  const explicit = findExplicitDate(value, now);
  if (explicit) return applyTime(parseDayPart(value, explicit), time).toISOString();

  const weekday = findWeekdayDate(value, now);
  if (weekday) return applyTime(parseDayPart(value, weekday), time).toISOString();

  // Standalone clock time: choose the next occurrence today; if already passed,
  // choose tomorrow. This is only used when the user explicitly says "at/around".
  if (time && /\b(?:at|around)\s+\d/i.test(value)) {
    const d = new Date(now);
    d.setHours(time.hour, time.minute, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }

  return null;
}

export function hasExplicitDueExpression(text) {
  return Boolean(parseTaskDateTime(text));
}
