// Remind to open the shift at the first slot start, escalate when overdue.
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function localDateKey(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// Returns { level: "none"|"nudge"|"overdue", key } where key identifies the night (so each level fires once).
export function shiftReminderState({ slots = [], now = new Date(), hasSession = false, graceMinutes = 10, windowMinutes = 120 } = {}) {
  const first = (slots ?? []).find((slot) => TIME.test(slot?.start ?? ""));
  if (!first || hasSession) return { level: "none", key: null };
  const [hour, minute] = first.start.split(":").map(Number);
  const start = new Date(now);
  start.setHours(hour, minute, 0, 0);
  // Slot start may have been "yesterday" relative to now (after midnight).
  if (start.getTime() - now.getTime() > 12 * 3600_000) start.setDate(start.getDate() - 1);
  const elapsed = (now.getTime() - start.getTime()) / 60000;
  const key = localDateKey(start);
  if (elapsed < 0 || elapsed > windowMinutes) return { level: "none", key };
  if (elapsed >= graceMinutes) return { level: "overdue", key };
  return { level: "nudge", key };
}
