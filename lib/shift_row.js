// One SharePoint row per business night, shared by both operators.
// ShiftDate = local date the night started (a shift started before noon belongs to the previous night).
export function shiftDate(startedAt) {
  const date = new Date(startedAt);
  if (!Number.isFinite(date.getTime())) return "";
  const shifted = new Date(date);
  if (shifted.getHours() < 12) shifted.setDate(shifted.getDate() - 1);
  const local = new Date(shifted.getTime() - shifted.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function hhmm(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
}

export function ackLog(events = [], shiftId) {
  return events
    .filter((event) => event.shift_id === shiftId && event.event_type === "ACK")
    .map((event) => `${hhmm(event.timestamp)} ${event.group_name || event.subject || event.source || ""}`.trim())
    .join("; ");
}

// role: the role this machine held when the shift started ("primary"|"backup").
export function shiftRowFields({ session, role, name = "", email = "", ready = null, events = [], ended = false, now = new Date() }) {
  const prefix = role === "backup" ? "Backup" : "Primary";
  const mine = events.filter((event) => event.shift_id === session.shift_id);
  const fields = {
    Title: `Ca ${shiftDate(session.started_at)}`,
    ShiftDate: shiftDate(session.started_at),
    [`${prefix}Name`]: name,
    [`${prefix}Email`]: email,
    [`${prefix}CheckIn`]: session.started_at ?? "",
    [`${prefix}AckLog`]: ackLog(events, session.shift_id),
    AlertCount: String(mine.filter((event) => event.event_type === "DETECTED").length),
    MissCount: String(mine.filter((event) => event.event_type === "MISSED" || event.event_type === "LEAK_REPORTED").length),
  };
  if (ready !== null) fields[`${prefix}Ready`] = ready ? "Sẵn sàng" : "Chưa đạt";
  if (ended) fields[`${prefix}CheckOut`] = now.toISOString();
  return fields;
}
