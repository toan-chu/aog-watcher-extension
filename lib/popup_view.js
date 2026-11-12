export function popupMode(status = {}) {
  if (status.app_state === "ALERTING") return "ringing";
  return status.session ? "watching" : "off-shift";
}

export function watchingSummary(status = {}) {
  if (status.session && status.within_shift === false) {
    const next = status.next_duty_at ? ` Next duty starts at ${formatClock24(status.next_duty_at)}.` : " No upcoming duty slot is configured.";
    return { title: "Off duty", copy: `This machine will not ring.${next}`, tone: "warn" };
  }
  const healthy = ["whatsapp", "outlook"].every((source) => status.sources?.[source]?.status === "ok");
  return healthy
    ? { title: "Watching", copy: "This machine is actively watching for AOG messages.", tone: "ok" }
    : { title: "Watcher needs attention", copy: "WhatsApp or Outlook is not watching for AOG messages.", tone: "bad" };
}

export function statusBadge(status = {}) {
  const mode = popupMode(status);
  if (mode === "off-shift") return { text: "OFF SHIFT", state: "idle" };
  if (mode === "ringing") return { text: "RINGING", state: "alerting" };
  if (status.within_shift === false) return { text: "OFF DUTY", state: "idle" };
  return watchingSummary(status).tone === "ok"
    ? { text: "WATCHING", state: "watching" }
    : { text: "ATTENTION", state: "attention" };
}

export function peerEvidence(status = {}) {
  if (status.solo) return { tone: "ok", text: "Solo test: this machine plays both" };
  if (!status.sharepoint?.configured) return { tone: "warn", text: "SharePoint is not connected" };
  const peers = (status.peers ?? []).filter((peer) => peer.on_shift);
  // A Backup machine's partner is the Primary; every other machine looks for a Backup.
  const wanted = status.current_role === "backup" ? "primary" : "backup";
  const partners = peers.filter((peer) => peer.role === wanted);
  if (!partners.length) return { tone: "warn", text: wanted === "primary" ? "No primary on duty" : "No backup on duty" };
  if (partners.some((peer) => peer.status === "lost")) return { tone: "bad", text: "Partner machine lost" };
  return { tone: "ok", text: partners.map((peer) => peer.name || peer.email || "Online").join(", ") };
}

export function acceptAllView(status = {}) {
  const total = Math.max(0, Number(status.pending_count) || 0);
  return {
    hidden: total < 2,
    label: `Accept all (${total})`,
    count: `${total} pending alert${total === 1 ? "" : "s"}`,
  };
}

export function backupCountdownText(status = {}, now = Date.now()) {
  if (status.current_alert?.backup_stage) return "Backup stage (simulated)";
  if (status.current_role === "backup") return "Backup is active";
  const hasBackup = (status.peers ?? []).some((peer) => peer.on_shift && peer.status !== "lost" && peer.role === "backup");
  if (!hasBackup && !status.solo) return "No backup on duty";
  const seconds = Math.max(0, Math.ceil((Number(status.backup_call_at) - now) / 1000));
  const label = status.solo ? "Simulated Backup in" : "Calling Backup in";
  return seconds > 0
    ? `${label} ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : (status.solo ? "Simulated Backup now" : "Calling Backup now");
}

export function slotRoleSummary(slots = []) {
  const labels = { primary: "Primary", backup: "Backup", off: "Off" };
  const parts = slots.slice(0, 2).map((slot, index) => `Slot ${index + 1} ${labels[slot?.role] ?? "Not scheduled"}`);
  return parts.join(" · ") || "No shift times configured";
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
    case "SOLO_BACKUP_STAGE": return `Backup stage (simulated) started for ${target}.`;
    case "PREFLIGHT": return event.ready ? "Pre-shift check is ready." : "Pre-shift check needs attention.";
    default: return "Watcher recorded an update.";
  }
}
