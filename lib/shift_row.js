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

// Which row belongs to this operator tonight. The shift lead may have created it in advance.
// Email is authoritative; an email-less operator uses the unclaimed Title row directly.
export function shiftRowMatch({ session, name = "", email = "" }) {
  const date = shiftDate(session.started_at);
  return email ? { ShiftDate: date, Email: email } : { ShiftDate: date, Title: name, Email: "" };
}

// A row the shift lead scheduled by display name only. It is claimable only while Email is blank.
export function shiftRowFallbackMatch({ session, name = "", email = "" }) {
  return email && name ? { ShiftDate: shiftDate(session.started_at), Title: name } : null;
}

// Payroll reads these cells, so write the machine's local time with its offset
// (2026-11-11T15:07:48+07:00) instead of UTC ("…08:07:48Z" looked earlier than the real check-out).
export function localStamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = -date.getTimezoneOffset();
  const local = new Date(date.getTime() + offset * 60000).toISOString().slice(0, 19);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function shiftRowFields({ session, name = "", email = "", ready = null, events = [], ended = false, now = new Date() }) {
  const date = shiftDate(session.started_at);
  const mine = events.filter((event) => event.shift_id === session.shift_id);
  const count = (...types) => mine.filter((event) => types.includes(event.event_type)).length;
  const fields = {
    Title: name || email,
    ShiftDate: date,
    Email: email,
    CheckIn: localStamp(session.started_at),
    AlertCount: count("DETECTED"),
    AcceptedCount: count("ACCEPT"),
    MissCount: count("MISSED", "LEAK_REPORTED"),
    AcceptLog: acceptLog(events, session.shift_id),
  };
  if (ready !== null) fields.Ready = ready ? "Ready" : "Not ready";
  // A shift started again the same night must not keep the previous check-out and hours.
  fields.CheckOut = "";
  fields.Hours = 0;
  if (ended) {
    fields.CheckOut = localStamp(now);
    const started = Date.parse(session.started_at ?? "");
    if (Number.isFinite(started)) fields.Hours = Math.max(0, Math.round(((now.getTime() - started) / 3_600_000) * 100) / 100);
  }
  return fields;
}

// 5.1 payroll counts for one person's night, written to their own AOG_Shifts row.
// Counted per message (alert_id), only inside the night [from, to], test messages excluded:
//   AlertCount    = messages that rang on this machine, or that were accepted here, plus missed-message reports
//   AcceptedCount = messages this person accepted
//   MissCount     = messages that rang here and ended without this person's Accept
//                   (rang out, partner took it, handed over at shift end; at night end: still open), plus reports.
//                   Exception: while this person was Backup, the partner (who is on watch) taking the message
//                   is not a miss: the Backup only covers for the person on watch.
// So AlertCount = AcceptedCount + MissCount + (Backup alerts the person on watch took) once the night is over.
export function shiftCounts(events = [], { from, to, ended = false } = {}) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  const inside = (value) => {
    const at = Date.parse(value ?? "");
    return Number.isFinite(at) && at >= start && at <= end;
  };
  const real = (event) => !String(event.alert_id ?? "").startsWith("sim-");
  const tonight = events.filter((event) => real(event) && inside(event.timestamp));
  const ids = (...types) => new Set(tonight.filter((event) => types.includes(event.event_type) && event.alert_id).map((event) => event.alert_id));
  const rang = ids("ALERTING");
  const accepted = ids("ACCEPT");
  const closedElsewhere = ids("MISSED", "PEER_HANDLED", "SHIFT_HANDOFF_SENT");
  const rangAsBackup = new Set(tonight.filter((event) => event.event_type === "ALERTING" && event.role === "backup" && event.alert_id).map((event) => event.alert_id));
  const coveredByPartner = new Set([...ids("PEER_HANDLED", "PEER_HANDLED_RECEIVED")].filter((id) => rangAsBackup.has(id)));
  const missed = [...rang].filter((id) => !accepted.has(id) && !coveredByPartner.has(id) && (ended || closedElsewhere.has(id)));
  const leaks = events.filter((event) => event.event_type === "LEAK_REPORTED" && inside(event.reported_for ?? event.timestamp)).length;
  const firstAccept = new Map();
  for (const event of tonight) if (event.event_type === "ACCEPT" && event.alert_id && !firstAccept.has(event.alert_id)) firstAccept.set(event.alert_id, event);
  return {
    AlertCount: new Set([...rang, ...accepted]).size + leaks,
    AcceptedCount: accepted.size,
    MissCount: missed.length + leaks,
    AcceptLog: [...firstAccept.values()].map((event) => `${hhmm(event.timestamp)} ${event.group_name || event.subject || event.source || ""}`.trim()).join("; "),
  };
}
