const WEEKDAYS = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11,
};

function startOfDay(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function endOfDay(date) { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function addMinutes(date, minutes) { return new Date(date.getTime() + minutes * 60 * 1000); }

function parseTime(text) {
  const value = text.toLowerCase();
  if (/\bmidnight\b/.test(value)) return { hour: 0, minute: 0 };
  if (/\b(noon|midday)\b/.test(value)) return { hour: 12, minute: 0 };

  const meridiem = value.match(/\b(?:at|around|by|before|on|for)?\s*(\d{1,2})(?::|\.)(\d{2})\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (meridiem) {
    let hour = Number(meridiem[1]); const minute = Number(meridiem[2]);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const pm = meridiem[3].toLowerCase().replace(/\./g, "") === "pm";
    if (pm && hour !== 12) hour += 12; if (!pm && hour === 12) hour = 0;
    return { hour, minute };
  }

  const twentyFour = value.match(/\b(?:at|around|by|before|on|for)?\s*(\d{1,2})(?::|\.)(\d{2})\b/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]); const minute = Number(twentyFour[2]);
    if (hour <= 23 && minute <= 59) return { hour, minute };
  }

  const bare = value.match(/\b(?:at|around|by|before|on|for)\s+(\d{1,2})\b/);
  if (bare) { const hour = Number(bare[1]); if (hour <= 23) return { hour, minute: 0 }; }
  return null;
}

function getDayPartTime(text) {
  const value = text.toLowerCase();
  if (/\bmidnight\b/.test(value)) return { hour: 0, minute: 0 };
  if (/\b(noon|midday)\b/.test(value)) return { hour: 12, minute: 0 };
  if (/\bmorning\b/.test(value) && !parseTime(value)) return { hour: 9, minute: 0 };
  if (/\bafternoon\b/.test(value)) return { hour: 15, minute: 0 };
  if (/\bevening\b/.test(value)) return { hour: 19, minute: 0 };
  if (/\bnight\b/.test(value)) return { hour: 21, minute: 0 };
  return null;
}

function applyTime(date, time, defaultEndOfDay = true) {
  const d = new Date(date);
  if (time) d.setHours(time.hour, time.minute, 0, 0);
  else if (defaultEndOfDay) return endOfDay(d);
  return d;
}

function validDate(year, month, day) {
  const d = new Date(year, month, day);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null;
}

function findExplicitDate(text, now) {
  const value = text.toLowerCase(); let match;
  match = value.match(/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
  if (match) return validDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  match = value.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](20\d{2}))?\b/);
  if (match) {
    const day = Number(match[1]); const month = Number(match[2]) - 1; const explicitYear = Boolean(match[3]);
    let year = Number(match[3] || now.getFullYear()); let d = validDate(year, month, day);
    if (d && !explicitYear && d.getTime() < startOfDay(now).getTime()) d = validDate(year + 1, month, day);
    return d;
  }
  const monthNames = Object.keys(MONTHS).join("|");
  match = value.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, "i"));
  if (match) {
    const month = MONTHS[match[1].toLowerCase()]; const day = Number(match[2]); const explicitYear = Boolean(match[3]);
    let year = Number(match[3] || now.getFullYear()); let d = validDate(year, month, day);
    if (d && !explicitYear && d.getTime() < startOfDay(now).getTime()) d = validDate(year + 1, month, day);
    return d;
  }
  match = value.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})(?:,?\\s+(20\\d{2}))?\\b`, "i"));
  if (match) {
    const day = Number(match[1]); const month = MONTHS[match[2].toLowerCase()]; const explicitYear = Boolean(match[3]);
    let year = Number(match[3] || now.getFullYear()); let d = validDate(year, month, day);
    if (d && !explicitYear && d.getTime() < startOfDay(now).getTime()) d = validDate(year + 1, month, day);
    return d;
  }
  return null;
}

function findWeekdayDate(text, now) {
  const value = text.toLowerCase();
  const match = value.match(/\b(last|this|next|coming)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (!match) return null;
  const target = WEEKDAYS[match[2]], current = now.getDay();
  let delta = (target - current + 7) % 7; const modifier = match[1] || "";
  if (modifier === "next") delta = delta === 0 ? 7 : delta + 7;
  if (modifier === "last") delta = delta === 0 ? -7 : delta - 7;
  return addDays(startOfDay(now), delta);
}

function parseRelative(text, now) {
  const value = text.toLowerCase(); let match;
  const units = [
    [/\b(?:in|after|for|within)\s+(\d+(?:\.\d+)?)\s*(seconds?|secs?|s)\b/, 1 / 60],
    [/\b(?:in|after|for|within)\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|m)\b/, 1],
    [/\b(?:in|after|for|within)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h)\b/, 60],
    [/\b(?:in|after|for|within)\s+(\d+(?:\.\d+)?)\s*(days?|d)\b/, 1440],
    [/\b(?:in|after|for|within)\s+(\d+(?:\.\d+)?)\s*(weeks?|wks?|wk|w)\b/, 10080],
  ];
  for (const [pattern, multiplier] of units) { match = value.match(pattern); if (match) return addMinutes(now, Number(match[1]) * multiplier); }
  match = value.match(/\b(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|min|m|hours?|hrs?|hr|h|days?|d|weeks?|wks?|wk|w)\s+(?:from\s+now|from\s+the\s+current\s+time)\b/);
  if (match) {
    const n = Number(match[1]), unit = match[2];
    const multiplier = /^s/.test(unit) ? 1 / 60 : /^m/.test(unit) ? 1 : /^h/.test(unit) ? 60 : /^d/.test(unit) ? 1440 : 10080;
    return addMinutes(now, n * multiplier);
  }
  if (/\bnext\s+week\b/.test(value)) return addDays(now, 7);
  if (/\bnext\s+month\b/.test(value)) { const d = new Date(now); d.setMonth(d.getMonth() + 1); return d; }
  if (/\bnext\s+year\b/.test(value)) { const d = new Date(now); d.setFullYear(d.getFullYear() + 1); return d; }
  if (/\bday after tomorrow\b/.test(value)) return addDays(now, 2);
  if (/\btomorrow\b/.test(value)) return addDays(now, 1);
  if (/\btoday\b/.test(value)) return new Date(now);
  return null;
}

export function parseTaskDateTime(text, baseDate = new Date()) {
  const value = String(text || "").trim(); if (!value) return null;
  const now = new Date(baseDate); const time = parseTime(value); const dayPart = getDayPartTime(value); const effectiveTime = time || dayPart;
  const relative = parseRelative(value, now);
  if (relative) {
    if (effectiveTime) { const d = new Date(relative); d.setHours(effectiveTime.hour, effectiveTime.minute, 0, 0); return d.toISOString(); }
    return relative.toISOString();
  }
  const simpleDay = /\b(day after tomorrow|tomorrow|today)\b/i.exec(value);
  if (simpleDay) {
    const key = simpleDay[1].toLowerCase(); const offset = key === "today" ? 0 : key === "tomorrow" ? 1 : 2;
    return applyTime(addDays(now, offset), effectiveTime).toISOString();
  }
  const explicit = findExplicitDate(value, now);
  if (explicit) return applyTime(explicit, effectiveTime).toISOString();
  const weekday = findWeekdayDate(value, now);
  if (weekday) return applyTime(weekday, effectiveTime).toISOString();
  if (effectiveTime && /\b(?:at|around|by|before|on|for)\s+\d/i.test(value)) {
    const d = new Date(now); d.setHours(effectiveTime.hour, effectiveTime.minute, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  return null;
}

export function hasExplicitDueExpression(text) { return Boolean(parseTaskDateTime(text)); }
