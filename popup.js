import { acceptAllView, backupCountdownText, eventSentence, formatAgo, formatClock24, peerEvidence, popupMode, rosterSummary, statusBadge, watchingSummary } from "./lib/popup_view.js";

const ids = ["versionValue", "stateBadge", "readyBadge", "dryRunBadge", "testModeBadge", "tonightTab", "searchTab", "helpTab", "testTab", "tonightPanel", "searchPanel", "helpPanel", "testPanel",
  "offShiftScreen", "watchingScreen", "watchingTitle", "watchingCopy", "ringingScreen", "roleValue", "startShiftButton", "shiftStatusHint", "endShiftButton", "whatsappDot", "whatsappValue",
  "outlookDot", "outlookValue", "sharepointDot", "sharepointValue", "peerDot", "peerValue", "soundDot", "soundValue", "latestEventValue", "preflight",
  "preflightList", "testSoundButton", "soundOkButton", "watchSystemAlerts", "watchUnknownChats", "watchUnknownList", "recentEvents", "acceptButton", "acceptAllButton", "alertPanel",
  "alertTitle", "alertMeta", "pendingCount", "backupCountdown", "systemAlerts", "unknownChats", "unknownList", "searchChatInput", "helpButton", "helpButtonVi", "leakSource", "leakWhat", "leakAt",
  "leakButton", "diagnosticsRows", "sharepointButton", "settingsButton", "feedback",
  "testLockIcon", "testLock", "testPassword", "testTools", "testModeInput", "testRoleInput", "dryRunInput", "testSaveButton",
  "simChatInput", "simWhatsAppButton", "simSubjectInput", "simEmailButton", "testLockButton",
  "muteBar", "muteSoundButton", "muteWhatsAppButton", "muteOutlookButton", "ringTestButton", "ringHeardButton"];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const slotRows = [...document.querySelectorAll(".slot-row")];
const ROLE_LABEL = { primary: "Primary", backup: "Backup", off: "Off", solo: "Solo" };
// The lock only keeps the test tools out of everyday view; it is not a security control.
const TEST_PASSWORD = "deptrai";
const TEST_UNLOCK_KEY = "aog_test_unlocked";
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const PREFLIGHT_ACTION = {
  identity: "Open Settings and enter the operator name.",
  whatsapp: "Open or reload WhatsApp Web.",
  outlook: "Open or reload the AOG mailbox in Outlook.",
  sharepoint: "Open SharePoint and sign in.",
  groups: "Reconnect SharePoint to refresh the shared group list.",
  sound: "Select Test ring, confirm the sound, then select I hear it.",
  peer: "Your partner's AOG Watcher is not running. Call them.",
};

let endShiftConfirmTimer = null;
let lastStatus = null;

function showFeedback(message = "") { elements.feedback.textContent = message; }
function send(message) { return chrome.runtime.sendMessage(message); }
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) node.append(child);
  return node;
}
function shortText(value, limit = 62) {
  const text = String(value ?? "");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
function eventClass(eventType) {
  if (["ACCEPT", "PEER_HANDLED", "PEER_HANDLED_RECEIVED", "FOLLOWUP_DONE"].includes(eventType)) return "recent-event--ok";
  if (["MISSED", "LEAK_REPORTED", "SYSTEM_ALERT", "FOLLOWUP_OVERDUE"].includes(eventType)) return "recent-event--danger";
  if (String(eventType ?? "").startsWith("SKIPPED") || eventType === "UNKNOWN_CHAT") return "recent-event--warn";
  return "recent-event--neutral";
}
function setDot(name, level, text) {
  elements[`${name}Dot`].className = level === "ok" ? "online" : (level === "warn" ? "warn" : (level === "bad" ? "bad" : ""));
  elements[`${name}Value`].textContent = text;
  elements[`${name}Value`].title = text;
}
function resetEndShiftConfirm() {
  clearTimeout(endShiftConfirmTimer);
  endShiftConfirmTimer = null;
  elements.endShiftButton.dataset.confirming = "false";
  elements.endShiftButton.textContent = "End shift";
}
function readSlotsFromUI() {
  return slotRows.map((row) => ({
    start: row.querySelector('[data-field="start"]').value.trim(),
    end: row.querySelector('[data-field="end"]').value.trim(),
    role: row.querySelector('[data-field="role"]').value,
  }));
}
function writeSlotsToUI(slots = []) {
  slotRows.forEach((row, index) => {
    const slot = slots[index] ?? { start: "", end: "", role: "primary" };
    row.querySelector('[data-field="start"]').value = slot.start ?? "";
    row.querySelector('[data-field="end"]').value = slot.end ?? "";
    row.querySelector('[data-field="role"]').value = slot.role ?? "primary";
  });
}

function systemAlertNodes(list = []) {
  return list.map((item) => {
    const actions = el("div", { className: "sys__actions" });
    if (item.kind === "followup") {
      const alertId = item.key.slice("followup:".length);
      actions.append(
        el("button", { type: "button", className: "primary", textContent: "Done", onclick: () => act({ type: "FOLLOWUP_ANSWER", alert_id: alertId, answer: "done" }, "Recorded as done.") }),
        el("button", { type: "button", textContent: "Need more time", onclick: () => act({ type: "FOLLOWUP_ANSWER", alert_id: alertId, answer: "snooze" }, "Watcher will ask again later.") }),
      );
    } else if (!item.dismissed) {
      actions.append(el("button", { type: "button", className: "primary", textContent: "Dismiss", onclick: () => act({ type: "DISMISS_SYSTEM_ALERT", key: item.key }, "Alert sound dismissed.") }));
    }
    const classes = ["sys"];
    if (!item.ring) classes.push("sys--quiet");
    if (item.dismissed) classes.push("sys--dismissed");
    return el("div", { className: classes.join(" ") }, [el("strong", { textContent: item.title }), el("span", { textContent: item.message }), actions]);
  });
}
function renderSystemAlerts(list = []) {
  elements.systemAlerts.replaceChildren(...systemAlertNodes(list));
  elements.watchSystemAlerts.replaceChildren(...systemAlertNodes(list));
}
function unknownChatNodes(list = []) {
  return list.map((item) => el("div", { className: "unknown__row" }, [
    el("strong", { textContent: item.name }),
    el("div", {}, [
      el("button", { type: "button", className: "primary", textContent: "Add to shared list", onclick: () => act({ type: "UNKNOWN_CHAT_DECISION", name: item.name, decision: "team" }) }),
      el("button", { type: "button", textContent: "Ignore", onclick: () => act({ type: "UNKNOWN_CHAT_DECISION", name: item.name, decision: "ignore" }) }),
    ]),
  ]));
}
function renderUnknown(list = []) {
  elements.unknownChats.hidden = list.length === 0;
  elements.watchUnknownChats.hidden = list.length === 0;
  elements.unknownList.replaceChildren(...unknownChatNodes(list));
  elements.watchUnknownList.replaceChildren(...unknownChatNodes(list));
}

function renderSources(status) {
  const summary = watchingSummary(status);
  elements.watchingTitle.textContent = summary.title;
  elements.watchingTitle.className = `screen-title screen-title--watching-${summary.tone}`;
  elements.watchingCopy.textContent = summary.copy;
  elements.watchingCopy.className = `watching-copy${summary.tone !== "ok" ? ` watching-copy--${summary.tone}` : ""}`;
  for (const source of ["whatsapp", "outlook"]) {
    const value = status.sources?.[source];
    const checked = formatAgo(status.health?.[source]?.last_seen);
    if (status.mute?.[source]) setDot(source, "warn", "Ringing off");
    else if (value?.status === "ok") setDot(source, "ok", checked);
    else if (value?.status === "blind") setDot(source, "bad", "BLIND — reload the tab");
    else if (value?.status === "wrong_folder") setDot(source, "bad", "Open the AOG mailbox");
    else setDot(source, "bad", "Open the tab");
  }
  const sp = status.sharepoint ?? {};
  if (!sp.configured) setDot("sharepoint", "warn", "Connect in Settings");
  else if (sp.ok) setDot("sharepoint", "ok", formatAgo(sp.checked_at));
  else setDot("sharepoint", "bad", "Open SharePoint and sign in");
  const peer = peerEvidence(status);
  setDot("peer", peer.tone, peer.text);
  if (status.sound_confirmed_at) setDot("sound", "ok", `at ${formatClock24(status.sound_confirmed_at)}`);
  else setDot("sound", "bad", "Run Test ring");
}
function renderPreflight(status) {
  const ready = Boolean(status.preflight?.ready);
  const offDuty = Boolean(status.session) && status.within_shift === false;
  elements.preflight.hidden = ready || !status.session || offDuty;
  elements.readyBadge.textContent = !status.session ? "OFF SHIFT" : (offDuty ? "OFF DUTY" : (ready ? "READY" : "ACTION NEEDED"));
  elements.readyBadge.className = `ready ${!status.session || offDuty ? "ready--off" : (ready ? "ready--ok" : "ready--bad")}`;
  const pending = (status.preflight?.items ?? []).filter((item) => item.status !== "pass");
  elements.preflightList.replaceChildren(...pending.map((item) => el("li", {
    className: `pf--${item.status}`,
    textContent: PREFLIGHT_ACTION[item.key] || item.hint || `Fix ${item.label}.`,
  })));
}
function renderRecent(all = []) {
  const events = all.filter((event) => eventSentence(event));
  const latest = events.at(-1);
  elements.latestEventValue.textContent = latest ? `${formatClock24(latest.timestamp)} · ${eventSentence(latest)}` : "No events yet";
  const nodes = events.slice(-6).reverse().map((event) => {
    const sentence = `${formatClock24(event.timestamp, { seconds: true })} ${eventSentence(event)}`;
    const openable = (event.source === "whatsapp" && event.group_name) || event.source === "email";
    return el("button", {
      type: "button",
      className: `recent-event ${eventClass(event.event_type)}${openable ? " recent-event--openable" : ""}`,
      textContent: shortText(sentence, 60),
      title: sentence,
      disabled: !openable,
      onclick: openable ? () => act({ type: "OPEN_ALERT_TARGET", target: event, draft_text: "" }) : null,
    });
  });
  elements.recentEvents.replaceChildren(...nodes.map((node) => el("li", {}, [node])));
}
function renderDiagnostics(status) {
  elements.diagnosticsRows.replaceChildren(...["whatsapp", "outlook"].map((source) => {
    const stats = status.health?.[source]?.stats;
    const label = source === "whatsapp" ? "WhatsApp" : "Outlook";
    const text = stats ? `${label}: ${stats.rows_seen ?? 0} rows · ${stats.unread_seen ?? 0} unread · ${stats.alerts_sent ?? 0} alerts${stats.folder_gate === "blocked" ? ` · blocked (${stats.path || "wrong mailbox"})` : ""}` : `${label}: no data yet`;
    return el("div", { className: "diagnostics__row", textContent: text });
  }));
}
function renderCountdown() {
  if (!lastStatus || popupMode(lastStatus) !== "ringing") return;
  elements.backupCountdown.textContent = backupCountdownText(lastStatus);
}

function render(status) {
  lastStatus = status;
  if (testUnlocked) fillTestTools(status);
  const mode = popupMode(status);
  elements.offShiftScreen.hidden = mode !== "off-shift";
  elements.watchingScreen.hidden = mode !== "watching";
  elements.ringingScreen.hidden = mode !== "ringing";
  document.body.dataset.mode = mode;
  renderMute(status, mode);
  elements.versionValue.textContent = status.version ?? "5.0";
  const badge = statusBadge(status);
  elements.stateBadge.textContent = badge.text;
  elements.stateBadge.className = `state state--${badge.state}`;
  elements.dryRunBadge.hidden = !status.dry_run;
  elements.testModeBadge.hidden = !status.test_mode;
  elements.testModeBadge.textContent = status.test_mode ? `TEST·${ROLE_LABEL[status.test_role] ?? ""}` : "TEST";

  // 5.1: no Start/End shift and no slot editing; the roster (or Test mode) decides.
  const roster = rosterSummary(status);
  elements.roleValue.textContent = roster.title;
  elements.shiftStatusHint.textContent = roster.hint;
  elements.startShiftButton.hidden = true;
  elements.endShiftButton.hidden = true;
  const shiftSetup = document.getElementById("shiftSetup");
  if (shiftSetup) shiftSetup.hidden = true;

  const alert = status.current_alert;
  elements.acceptButton.disabled = mode !== "ringing";
  const acceptAll = acceptAllView(status);
  elements.acceptAllButton.hidden = acceptAll.hidden || mode !== "ringing";
  elements.acceptAllButton.textContent = acceptAll.label;
  elements.pendingCount.hidden = acceptAll.hidden || mode !== "ringing";
  elements.pendingCount.textContent = acceptAll.count;
  elements.alertTitle.textContent = alert?.group_name || alert?.subject || "AOG alert";
  elements.alertMeta.textContent = alert ? `${alert.source === "email" ? "Outlook" : "WhatsApp"} · ${alert.sender || `${alert.unread_count || 1} unread message${alert.unread_count === 1 ? "" : "s"}`}` : "";
  renderCountdown();
  renderSystemAlerts(status.system_alerts);
  renderUnknown(status.unknown_chats);
  renderSources(status);
  renderPreflight(status);
  elements.readyBadge.hidden = mode !== "watching";
  renderRecent(status.recent_events ?? []);
  renderDiagnostics(status);
  elements.sharepointButton.hidden = !status.sharepoint?.configured;
}

// Ring switches show only while on watch; pressed = that ringing is off on this machine.
const MUTE_BUTTONS = ["muteSoundButton", "muteWhatsAppButton", "muteOutlookButton"];
function renderMute(status, mode) {
  elements.muteBar.hidden = mode === "off-shift";
  for (const id of MUTE_BUTTONS) {
    const button = elements[id];
    const off = Boolean(status.mute?.[button.dataset.mute]);
    button.setAttribute("aria-pressed", String(off));
    button.title = off ? "Ringing is off on this machine. Click to turn it back on." : "Click to stop this ringing on this machine for the rest of your watch.";
  }
}
for (const id of MUTE_BUTTONS) {
  elements[id].addEventListener("click", () => {
    const button = elements[id];
    const on = button.getAttribute("aria-pressed") !== "true";
    act({ type: "SET_MUTE", what: button.dataset.mute, on }, on ? `${button.textContent} ringing is off on this machine` : `${button.textContent} ringing is back on`);
  });
}

async function act(message, okText = "") {
  try {
    const response = await send(message);
    if (response?.status) render(response.status);
    showFeedback(response?.ok === false || response?.error ? response.error : (response?.note || okText));
    return response;
  } catch (error) { showFeedback(`Error: ${error.message}`); return null; }
}
async function getStatus() {
  try {
    const response = await send({ type: "GET_STATUS" });
    if (response?.status) render(response.status);
  } catch (error) { showFeedback(`Status error: ${error.message}`); }
}
async function saveSlots() {
  const slots = readSlotsFromUI();
  if (slots.some((slot) => !TIME_PATTERN.test(slot.start) || !TIME_PATTERN.test(slot.end))) {
    showFeedback("Use 24-hour times in HH:mm format.");
    return false;
  }
  await send({ type: "UPDATE_SHIFT_SLOTS", slots });
  return true;
}
async function populateActiveChat() {
  const response = await send({ type: "GET_ACTIVE_WHATSAPP_CHAT" }).catch((error) => ({ ok: false, error: error.message }));
  elements.searchChatInput.value = response?.chat ?? "";
  if (response?.ok === false) showFeedback(response.error);
}
function showTab(name) {
  for (const tabName of ["tonight", "search", "help", "test"]) {
    const active = tabName === name;
    elements[`${tabName}Tab`].classList.toggle("tab--active", active);
    elements[`${tabName}Tab`].setAttribute("aria-selected", String(active));
    elements[`${tabName}Panel`].hidden = !active;
  }
  showFeedback("");
  if (name === "search") populateActiveChat();
}

slotRows.forEach((row) => row.addEventListener("change", saveSlots));
elements.tonightTab.addEventListener("click", () => showTab("tonight"));
elements.searchTab.addEventListener("click", () => showTab("search"));
elements.helpTab.addEventListener("click", () => showTab("help"));
elements.testTab.addEventListener("click", () => { showTab("test"); renderTestLock(); });
elements.acceptButton.addEventListener("click", async () => {
  elements.acceptButton.disabled = true;
  elements.acceptButton.textContent = "ACCEPTING…";
  await act({ type: "ACCEPT_CURRENT" }, "Accepted. Opening the source…");
  elements.acceptButton.textContent = "ACCEPT — I'LL HANDLE IT";
});
elements.acceptAllButton.addEventListener("click", async () => {
  elements.acceptAllButton.disabled = true;
  elements.acceptAllButton.textContent = "ACCEPTING ALL…";
  await act({ type: "ACCEPT_ALL" }, "Accepted all pending alerts. Opening the current source…");
  elements.acceptAllButton.disabled = false;
});
elements.startShiftButton.addEventListener("click", async () => { if (await saveSlots()) await act({ type: "START_SHIFT" }, "Shift started."); });
elements.endShiftButton.addEventListener("click", async () => {
  if (elements.endShiftButton.dataset.confirming !== "true") {
    elements.endShiftButton.dataset.confirming = "true";
    elements.endShiftButton.textContent = "Confirm end shift?";
    clearTimeout(endShiftConfirmTimer);
    endShiftConfirmTimer = setTimeout(resetEndShiftConfirm, 5000);
    return;
  }
  resetEndShiftConfirm();
  await act({ type: "END_SHIFT" }, "Shift ended.");
});
elements.testSoundButton.addEventListener("click", () => act({ type: "TEST_SOUND" }, "Playing the test ring for 6 seconds…"));
elements.soundOkButton.addEventListener("click", () => act({ type: "SOUND_CONFIRMED" }, "Test ring confirmed audible."));
elements.ringTestButton.addEventListener("click", () => act({ type: "TEST_SOUND" }, "Playing the test ring for 6 seconds…"));
elements.ringHeardButton.addEventListener("click", () => act({ type: "SOUND_CONFIRMED" }, "Test ring confirmed audible."));
elements.leakButton.addEventListener("click", async () => {
  const what = elements.leakWhat.value.trim();
  if (!what) { showFeedback("Enter a group name or email subject."); return; }
  const at = elements.leakAt.value ? new Date(elements.leakAt.value).toISOString() : new Date().toISOString();
  await act({ type: "REPORT_LEAK", source: elements.leakSource.value, what, at }, "Missed message recorded.");
  elements.leakWhat.value = "";
});
elements.helpButton.addEventListener("click", () => chrome.tabs.create({ url: "https://github.com/toan-chu/aog-watcher-extension#readme" }));
elements.helpButtonVi.addEventListener("click", () => chrome.tabs.create({ url: "https://github.com/toan-chu/aog-watcher-extension/blob/master/README.vi.md" }));
elements.settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.sharepointButton.addEventListener("click", async () => {
  const stored = await chrome.storage.local.get("aog_config");
  if (stored.aog_config?.sharepoint_site_url) chrome.tabs.create({ url: stored.aog_config.sharepoint_site_url });
});

// ---------- Test tab ----------
const sessionStore = chrome.storage.session ?? chrome.storage.local;
let testUnlocked = false;
async function loadTestUnlock() {
  try { testUnlocked = Boolean((await sessionStore.get(TEST_UNLOCK_KEY))[TEST_UNLOCK_KEY]); } catch { testUnlocked = false; }
  renderTestLock();
}
function renderTestLock() {
  elements.testLock.hidden = testUnlocked;
  elements.testTools.hidden = !testUnlocked;
  elements.testLockIcon.textContent = testUnlocked ? "🔓" : "🔒";
  if (testUnlocked && lastStatus) fillTestTools(lastStatus);
}
function fillTestTools(status) {
  if (document.activeElement && elements.testTools.contains(document.activeElement)) return;
  elements.testModeInput.checked = Boolean(status.test_mode);
  elements.testRoleInput.value = ["primary", "backup", "solo"].includes(status.test_role) ? status.test_role : "primary";
  elements.dryRunInput.checked = Boolean(status.dry_run);
}
elements.testLock.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (elements.testPassword.value.trim().toLowerCase() !== TEST_PASSWORD) { showFeedback("Wrong test password."); return; }
  elements.testPassword.value = "";
  testUnlocked = true;
  try { await sessionStore.set({ [TEST_UNLOCK_KEY]: true }); } catch { /* stays unlocked while the popup is open */ }
  showFeedback("");
  renderTestLock();
});
elements.testLockButton.addEventListener("click", async () => {
  testUnlocked = false;
  try { await sessionStore.remove(TEST_UNLOCK_KEY); } catch { /* ignore */ }
  renderTestLock();
});
elements.testSaveButton.addEventListener("click", () => act({
  type: "UPDATE_TEST_SETTINGS",
  test_mode: elements.testModeInput.checked,
  test_role: elements.testRoleInput.value,
  dry_run: elements.dryRunInput.checked,
}, "Test mode saved."));
elements.simWhatsAppButton.addEventListener("click", () => act({ type: "SIMULATE_ALERT", source: "whatsapp", name: elements.simChatInput.value }));
elements.simEmailButton.addEventListener("click", () => act({ type: "SIMULATE_ALERT", source: "email", name: elements.simSubjectInput.value }));
loadTestUnlock();

chrome.runtime.onMessage.addListener((message) => { if (message.type === "STATUS_UPDATED") render(message.payload); });
getStatus();
setInterval(getStatus, 2_000);
setInterval(renderCountdown, 1_000);
