import { eventsToCsv } from "./lib/csv_export.js";
import { getTodayEvents } from "./lib/event_log.js";

const elements = Object.fromEntries(["stateBadge", "dryRunBadge", "testModeBadge", "alertPanel", "alertTitle", "alertMeta", "ackButton", "roleValue", "queueValue", "shiftValue", "whatsappDot", "whatsappValue", "outlookDot", "outlookValue", "diagnosticsRows", "shiftSetup", "startShiftButton", "shiftStatusHint", "endShiftButton", "recentEvents", "exportButton", "settingsButton", "feedback"].map((id) => [id, document.getElementById(id)]));

const slotRows = [...document.querySelectorAll(".slot-row")];
let endShiftConfirmTimer = null;

function showFeedback(message) { elements.feedback.textContent = message; }

function resetEndShiftConfirm() {
  clearTimeout(endShiftConfirmTimer);
  endShiftConfirmTimer = null;
  elements.endShiftButton.dataset.confirming = "false";
  elements.endShiftButton.textContent = "End shift";
}

function eventClass(eventType) {
  if (eventType === "ACK" || eventType === "PEER_HANDLED") return "recent-event--ok";
  if (eventType === "MISSED") return "recent-event--danger";
  if (String(eventType ?? "").startsWith("DRY_RUN") || String(eventType ?? "").startsWith("SKIPPED")) return "recent-event--warn";
  return "recent-event--neutral";
}

function shortText(value, limit = 35) {
  const text = String(value ?? "");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function localTime(timestamp) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("vi-VN", { hour12: false }) : "--:--:--";
}

function diagnosticText(source, stats) {
  if (!stats) return `${source}: no scan data yet`;
  const gate = stats.folder_gate === "blocked" ? ` / gate blocked (${stats.path || "unknown path"})` : "";
  return `${source}: ${stats.rows_seen ?? 0} rows / ${stats.unread_seen ?? 0} unread / ${stats.alerts_sent ?? 0} alert${gate}`;
}

function diagnosticHint(stats) {
  if (!stats) return "";
  if (stats.folder_gate === "blocked") return "Outlook folder gate is blocking this path.";
  if ((stats.unread_seen ?? 0) > 0 && (stats.alerts_sent ?? 0) === 0 && (stats.suppressed_baseline ?? 0) === 0) return "Check UI language or filters.";
  if ((stats.rows_seen ?? 0) > 0 && (stats.unread_seen ?? 0) === 0) return "Unread detection may not match this UI language.";
  return "";
}

function readSlotsFromUI() {
  return slotRows.map((row) => ({
    start: row.querySelector('[data-field="start"]').value,
    end: row.querySelector('[data-field="end"]').value,
    role: row.querySelector('[data-field="role"]').value,
  }));
}

function writeSlotsToUI(slots) {
  slotRows.forEach((row, index) => {
    const slot = slots?.[index] ?? { start: "", end: "", role: "primary" };
    row.querySelector('[data-field="start"]').value = slot.start ?? "";
    row.querySelector('[data-field="end"]').value = slot.end ?? "";
    row.querySelector('[data-field="role"]').value = slot.role ?? "primary";
  });
}

function render(status) {
  const active = status.app_state === "ALERTING";
  elements.stateBadge.textContent = status.app_state;
  elements.stateBadge.className = `state ${active ? "state--alerting" : "state--idle"}`;
  elements.dryRunBadge.hidden = !status.dry_run;
  elements.testModeBadge.hidden = !status.test_mode;
  elements.testModeBadge.textContent = status.test_mode ? `TEST·${String(status.test_role ?? "").toUpperCase()}` : "TEST";
  elements.alertPanel.classList.toggle("alert-panel--active", active);
  elements.alertTitle.textContent = active ? (status.current_alert.group_name || status.current_alert.subject || "AOG alert") : "No active alert";
  elements.alertMeta.textContent = active ? `${status.current_alert.source} · ${status.current_alert.sender || `${status.current_alert.unread_count || 1} unread`}` : "Watcher is standing by.";
  elements.ackButton.disabled = !active;

  const hasSession = Boolean(status.session);
  const currentRole = status.current_role;
  elements.roleValue.textContent = currentRole ? currentRole.toUpperCase() : (hasSession ? "OUT OF SLOT" : "--");
  elements.queueValue.textContent = String(status.pending_count ?? 0);
  elements.shiftValue.textContent = status.test_mode ? "TEST" : (status.within_shift ? "ACTIVE" : "OFF");

  // Highlight active slot row.
  slotRows.forEach((row, index) => row.classList.toggle("slot-row--active", status.current_slot_index === index));

  // Toggle Start vs End button.
  if (hasSession) {
    elements.startShiftButton.textContent = "Shift running";
    elements.startShiftButton.disabled = true;
    elements.startShiftButton.classList.add("role-row__active");
    elements.endShiftButton.hidden = false;
    const slotText = status.current_slot_index !== null ? `Slot ${status.current_slot_index + 1}` : (status.test_mode ? "Test mode" : "ngoài slot");
    elements.shiftStatusHint.textContent = `${slotText} · ${currentRole ? currentRole.toUpperCase() : "no role"}`;
  } else {
    elements.startShiftButton.textContent = "Start shift";
    elements.startShiftButton.disabled = false;
    elements.startShiftButton.classList.remove("role-row__active");
    elements.endShiftButton.hidden = true;
    resetEndShiftConfirm();
    elements.shiftStatusHint.textContent = "Chưa bắt đầu ca";
  }

  // Sync slot inputs from storage only when user has not started editing.
  if (document.activeElement?.closest?.(".slot-row") === null) {
    writeSlotsToUI(status.shift_slots);
  }

  for (const source of ["whatsapp", "outlook"]) {
    const sourceHealth = status.health?.[source];
    const online = typeof sourceHealth === "object" ? Boolean(sourceHealth.connected) : Boolean(sourceHealth);
    elements[`${source}Dot`].classList.toggle("online", online);
    elements[`${source}Value`].textContent = online ? "Connected" : "Not detected";
  }
  elements.diagnosticsRows.replaceChildren(...["whatsapp", "outlook"].map((source) => {
    const stats = status.health?.[source]?.stats ?? null;
    const row = document.createElement("div");
    const hint = diagnosticHint(stats);
    row.className = hint ? "diagnostics__row diagnostics__row--warn" : "diagnostics__row";
    row.textContent = diagnosticText(source === "whatsapp" ? "WhatsApp" : "Outlook", stats);
    if (hint) {
      const small = document.createElement("small");
      small.textContent = hint;
      row.append(document.createElement("br"), small);
    }
    return row;
  }));
  const recent = status.recent_events ?? [];
  elements.recentEvents.replaceChildren(...recent.slice(-5).reverse().map((event) => {
    const item = document.createElement("li");
    const context = event.subject || event.group_name || event.sender || "";
    item.className = `recent-event ${eventClass(event.event_type)}`;
    item.textContent = `${localTime(event.timestamp)} ${event.event_type}${event.source ? ` · ${event.source}` : ""}${context ? ` · ${shortText(context)}` : ""}`;
    item.title = `${localTime(event.timestamp)} ${event.event_type}${event.source ? ` · ${event.source}` : ""}${context ? ` · ${context}` : ""}`;
    return item;
  }));
}

async function getStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (response?.status) render(response.status);
  } catch (error) { showFeedback(`Status error: ${error.message}`); }
}

async function saveSlots() {
  const slots = readSlotsFromUI();
  const invalid = slots.some((slot) => !slot.start || !slot.end);
  if (invalid) {
    showFeedback("Slot start/end thiếu giờ.");
    return false;
  }
  await chrome.runtime.sendMessage({ type: "UPDATE_SHIFT_SLOTS", slots });
  return true;
}

slotRows.forEach((row) => {
  row.addEventListener("change", async () => {
    const ok = await saveSlots();
    if (ok) showFeedback("Slots saved.");
  });
});

elements.ackButton.addEventListener("click", async () => {
  elements.ackButton.disabled = true;
  elements.ackButton.textContent = "ACKNOWLEDGING...";
  try {
    const response = await chrome.runtime.sendMessage({ type: "ACK_CURRENT" });
    if (response?.status) render(response.status);
  } catch (error) {
    showFeedback(`ACK failed: ${error.message}`);
  } finally {
    elements.ackButton.textContent = "ACKNOWLEDGE";
  }
});

elements.startShiftButton.addEventListener("click", async () => {
  if (!(await saveSlots())) return;
  const response = await chrome.runtime.sendMessage({ type: "START_SHIFT" });
  if (response?.status) render(response.status);
  showFeedback("Shift started.");
});

elements.endShiftButton.addEventListener("click", async () => {
  if (elements.endShiftButton.dataset.confirming !== "true") {
    elements.endShiftButton.dataset.confirming = "true";
    elements.endShiftButton.textContent = "Xác nhận kết thúc ca?";
    clearTimeout(endShiftConfirmTimer);
    endShiftConfirmTimer = setTimeout(resetEndShiftConfirm, 5000);
    return;
  }
  resetEndShiftConfirm();
  const response = await chrome.runtime.sendMessage({ type: "END_SHIFT" });
  if (response?.status) render(response.status);
  showFeedback("Ca đã kết thúc — không còn alert trên máy này.");
});

elements.settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.exportButton.addEventListener("click", async () => {
  const records = await getTodayEvents();
  const blob = new Blob([eventsToCsv(records)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `aog-events-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  showFeedback(`Exported ${records.length} records.`);
});

chrome.runtime.onMessage.addListener((message) => { if (message.type === "STATUS_UPDATED") render(message.payload); });
getStatus();
setInterval(getStatus, 2_000);
