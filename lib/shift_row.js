// One AOG_Shifts row per person per night. Used for the shift schedule and for payroll.
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
  if (!Number.isFinite(date.getTime())) return "";
  return [date.getHours(), date.getMinutes()].map((part) => String(part).padStart(2, "0")).join(":");
}

export function acceptLog(events = [], shiftId) {
  return events
    .filter((event) => event.shift_id === shiftId && event.event_type === "ACCEPT")
    .map((event) => `${hhmm(event.timestamp)} ${event.group_name || event.subject || event.source || ""}`.trim())
    .join("; ");
}

// Which row belongs to this operator tonight. The shift lead may have created it in advance,
// so match on the company email; fall back to the operator name when the email is unknown.
export function shiftRowMatch({ session, name = "", email = "" }) {
  const date = shiftDate(session.started_at);
  return email ? { ShiftDate: date, Email: email } : { ShiftDate: date, OperatorName: name };
}

// A row the shift lead scheduled by name only (no email yet). Used only when no row matches the email.
export function shiftRowFallbackMatch({ session, name = "", email = "" }) {
  return email && name ? { ShiftDate: shiftDate(session.started_at), OperatorName: name } : null;
}

export function shiftRowFields({ session, name = "", email = "", ready = null, events = [], ended = false, now = new Date() }) {
  const date = shiftDate(session.started_at);
  const mine = events.filter((event) => event.shift_id === session.shift_id);
  const count = (...types) => mine.filter((event) => types.includes(event.event_type)).length;
  const fields = {
    Title: `${date} ${name || email}`.trim(),
    ShiftDate: date,
    OperatorName: name,
    Email: email,
    CheckIn: session.started_at ?? "",
    AlertCount: count("DETECTED"),
    AcceptedCount: count("ACCEPT"),
    MissCount: count("MISSED", "LEAK_REPORTED"),
    AcceptLog: acceptLog(events, session.shift_id),
  };
  if (ready !== null) fields.Ready = ready ? "Ready" : "Not ready";
  if (ended) {
    fields.CheckOut = now.toISOString();
    const started = Date.parse(session.started_at ?? "");
    if (Number.isFinite(started)) fields.Hours = Math.max(0, Math.round(((now.getTime() - started) / 3_600_000) * 100) / 100);
  }
  return fields;
}
