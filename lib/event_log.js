import { appendEventLog, getEventLog } from "./storage.js";

export async function logEvent(eventType, data = {}) {
  return appendEventLog({ event_type: eventType, ...data });
}

export async function getTodayEvents(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return getEventLog({ date: local });
}

export function enrichEventRecord(record, { session = null, config = {}, detectedById = new Map(), now = new Date() } = {}) {
  const timestamp = record.timestamp ?? now.toISOString();
  const detectedAt = record.event_type === "DETECTED" && record.alert_id ? timestamp : detectedById.get(record.alert_id);
  const responseTimeMs = record.event_type === "ACK" && detectedAt ? Math.max(0, new Date(timestamp).getTime() - new Date(detectedAt).getTime()) : record.response_time_ms;
  return {
    shift_id: session?.shift_id ?? record.shift_id ?? null,
    operator_name: config.self_display_name ?? session?.operator_name ?? record.operator_name ?? "",
    partner_name: session?.partner_name ?? config.partner_display_name ?? record.partner_name ?? "",
    shift_start: session?.started_at ?? record.shift_start ?? null,
    shift_end: session?.ended_at ?? record.shift_end ?? null,
    ...record,
    timestamp,
    ...(responseTimeMs === undefined ? {} : { response_time_ms: responseTimeMs }),
  };
}
