export function popupMode(status = {}) {
  if (status.app_state === "ALERTING") return "ringing";
  return status.session ? "watching" : "off-shift";
}

export function watchingSummary(status = {}) {
  const healthy = ["whatsapp", "outlook"].every((source) => status.sources?.[source]?.status === "ok");
  return healthy
    ? { title: "Watching", copy: "This machine is actively watching for AOG messages.", tone: "ok" }
    : { title: "Watcher needs attention", copy: "WhatsApp or Outlook is not watching for AOG messages.", tone: "bad" };
}

export function formatClock24(value, { seconds = false } = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return seconds ? "--:--:--" : "--:--";
  const parts = [date.getHours(), date.getMinutes(), ...(seconds ? [date.getSeconds()] : [])];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatAgo(value, now = Date.now()) {
  const at = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(at) || at <= 0) return "not checked yet";
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 60) return `checked ${seconds}s ago`;
  return `checked ${Math.floor(seconds / 60)}m ago`;
}

function subject(event) {
  return event.group_name || event.subject || event.sender || event.title || "the AOG message";
}

export function eventSentence(event = {}) {
  const target = subject(event);
  switch (event.event_type) {
    case "SHIFT_STARTED": return "Shift started.";
    case "SHIFT_ENDED": return "Shift ended.";
    case "DETECTED": return `${event.source === "email" ? "Outlook" : "WhatsApp"} detected ${target}.`;
    case "ALERTING": return `Watcher started ringing for ${target}.`;
    case "ACCEPT": return `${event.operator_name || "Operator"} accepted ${target}.`;
    case "PEER_HANDLED":
    case "PEER_HANDLED_RECEIVED": return `Partner machine accepted ${target}.`;
    case "MISSED": return `${target} was marked as missed.`;
    case "LEAK_REPORTED": return `A missed message was reported for ${target}.`;
    case "UNKNOWN_CHAT": return `Unknown chat ${target} sent a message.`;
    case "FOLLOWUP_DONE": return `Handling was confirmed complete for ${target}.`;
    case "FOLLOWUP_OVERDUE": return `Handling confirmation is overdue for ${target}.`;
    case "SYSTEM_ALERT": return event.title ? `${event.title}.` : "Watcher reported a system problem.";
    case "PREFLIGHT": return event.ready ? "Pre-shift check is ready." : "Pre-shift check needs attention.";
    default: return "Watcher recorded an update.";
  }
}
