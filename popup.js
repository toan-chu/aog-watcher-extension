const ids = ["versionValue", "stateBadge", "readyBadge", "dryRunBadge", "testModeBadge", "systemAlerts", "alertPanel", "alertTitle", "alertMeta", "ackButton",
  "unknownChats", "unknownList", "roleValue", "queueValue", "groupsValue", "whatsappDot", "whatsappValue", "outlookDot", "outlookValue", "sharepointDot",
  "sharepointValue", "peerDot", "peerValue", "preflight", "preflightList", "testSoundButton", "soundOkButton", "shiftSetup", "startShiftButton",
  "shiftStatusHint", "endShiftButton", "leakSource", "leakWhat", "leakAt", "leakButton", "diagnosticsRows", "recentEvents", "sharepointButton",
  "settingsButton", "feedback"];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const slotRows = [...document.querySelectorAll(".slot-row")];
let endShiftConfirmTimer = null;
let lastStatus = null;
let slotsInitialized = false;

const ROLE_LABEL = { primary: "CHÍNH", backup: "DỰ PHÒNG" };
function showFeedback(message) { elements.feedback.textContent = message; }
function send(message) { return chrome.runtime.sendMessage(message); }
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) node.append(child);
  return node;
}
function localTime(timestamp) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("vi-VN", { hour12: false }) : "--:--:--";
}
function shortText(value, limit = 38) {
  const text = String(value ?? "");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
function resetEndShiftConfirm() {
  clearTimeout(endShiftConfirmTimer);
  endShiftConfirmTimer = null;
  elements.endShiftButton.dataset.confirming = "false";
  elements.endShiftButton.textContent = "Kết thúc ca";
}
function eventClass(eventType) {
  if (eventType === "ACK" || eventType === "PEER_HANDLED" || eventType === "FOLLOWUP_DONE") return "recent-event--ok";
  if (["MISSED", "LEAK_REPORTED", "SYSTEM_ALERT", "FOLLOWUP_OVERDUE"].includes(eventType)) return "recent-event--danger";
  if (String(eventType ?? "").startsWith("DRY_RUN") || String(eventType ?? "").startsWith("SKIPPED") || eventType === "UNKNOWN_CHAT") return "recent-event--warn";
  return "recent-event--neutral";
}
function setDot(name, level, text) {
  elements[`${name}Dot`].className = level === "ok" ? "online" : (level === "warn" ? "warn" : (level === "bad" ? "bad" : ""));
  elements[`${name}Value`].textContent = text;
  elements[`${name}Value`].title = text;
}
function readSlotsFromUI() {
  return slotRows.map((row) => ({ start: row.querySelector('[data-field="start"]').value, end: row.querySelector('[data-field="end"]').value, role: row.querySelector('[data-field="role"]').value }));
}
function writeSlotsToUI(slots) {
  slotRows.forEach((row, index) => {
    const slot = slots?.[index] ?? { start: "", end: "", role: "primary" };
    row.querySelector('[data-field="start"]').value = slot.start ?? "";
    row.querySelector('[data-field="end"]').value = slot.end ?? "";
    row.querySelector('[data-field="role"]').value = slot.role ?? "primary";
  });
}

function renderSystemAlerts(list = []) {
  elements.systemAlerts.replaceChildren(...list.map((item) => {
    const actions = el("div", { className: "sys__actions" });
    if (item.kind === "followup") {
      const alertId = item.key.slice("followup:".length);
      actions.append(
        el("button", { type: "button", className: "primary", textContent: "Xong", onclick: () => act({ type: "FOLLOWUP_ANSWER", alert_id: alertId, answer: "done" }, "Đã ghi: xử lý xong.") }),
        el("button", { type: "button", textContent: "Cần thêm thời gian", onclick: () => act({ type: "FOLLOWUP_ANSWER", alert_id: alertId, answer: "snooze" }, "Sẽ hỏi lại sau.") }),
      );
    } else if (!item.acknowledged) {
      actions.append(el("button", { type: "button", className: "primary", textContent: "Đã biết", onclick: () => act({ type: "SYSTEM_ALERT_ACK", key: item.key }, "Đã tắt chuông cảnh báo. Ô đỏ còn tới khi lỗi được sửa.") }));
    }
    const classes = ["sys"];
    if (!item.ring) classes.push("sys--quiet");
    if (item.acknowledged) classes.push("sys--ack");
    return el("div", { className: classes.join(" ") }, [el("strong", { textContent: item.title }), el("span", { textContent: item.message }), actions]);
  }));
}

function renderUnknown(list = []) {
  elements.unknownChats.hidden = list.length === 0;
  elements.unknownList.replaceChildren(...list.map((item) => el("div", { className: "unknown__row" }, [
    el("strong", { textContent: item.name }),
    el("div", {}, [
      el("button", { type: "button", className: "primary", textContent: "Thêm vào danh sách chung", onclick: () => act({ type: "UNKNOWN_CHAT_DECISION", name: item.name, decision: "team" }) }),
      el("button", { type: "button", textContent: "Bỏ qua", onclick: () => act({ type: "UNKNOWN_CHAT_DECISION", name: item.name, decision: "ignore" }) }),
    ]),
  ])));
}

function renderSources(status) {
  const hasSession = Boolean(status.session);
  for (const source of ["whatsapp", "outlook"]) {
    const value = status.sources?.[source];
    if (!value) setDot(source, "", hasSession ? "Đang kiểm tra…" : "--");
    else if (value.status === "ok") setDot(source, "ok", "Đang canh");
    else setDot(source, "bad", value.status === "blind" ? "MÙ — không đọc được" : (value.status === "wrong_folder" ? "Sai hộp thư" : "Không thấy tab"));
  }
  const sp = status.sharepoint ?? {};
  if (!sp.configured) setDot("sharepoint", "warn", "Chưa nối (Cài đặt)");
  else if (sp.ok) setDot("sharepoint", "ok", status.identity?.email || "Đã kết nối");
  else setDot("sharepoint", "bad", sp.error || "Lỗi kết nối");
  const peers = (status.peers ?? []).filter((peer) => peer.on_shift);
  if (!sp.configured) setDot("peer", "", "Cần SharePoint");
  else if (peers.length === 0) setDot("peer", hasSession ? "warn" : "", "Chưa vào ca");
  else if (peers.some((peer) => peer.status === "lost")) setDot("peer", "bad", `Mất liên lạc: ${peers.filter((peer) => peer.status === "lost").map((peer) => peer.name).join(", ")}`);
  else setDot("peer", "ok", peers.map((peer) => `${peer.name}${peer.ready ? " ✓" : ""}`).join(", "));
}

function renderPreflight(status) {
  const pf = status.preflight;
  elements.preflight.hidden = !status.session;
  const ready = Boolean(status.session && pf?.ready);
  elements.readyBadge.textContent = !status.session ? "CHƯA VÀO CA" : (ready ? "SẴN SÀNG" : "CHƯA SẴN SÀNG");
  elements.readyBadge.className = `ready ${!status.session ? "ready--off" : (ready ? "ready--ok" : "ready--bad")}`;
  if (!pf) { elements.preflightList.replaceChildren(el("li", { textContent: "Đang kiểm tra…" })); return; }
  // Popup height is limited (~600px): once ready, collapse the checklist to one line.
  document.querySelector(".preflight__actions").hidden = ready;
  if (ready) {
    const warns = pf.items.filter((item) => item.status === "warn").length;
    elements.preflightList.replaceChildren(el("li", { className: "pf--pass", textContent: `Đạt ${pf.items.length - warns}/${pf.items.length} mục${warns ? ` · ${warns} lưu ý` : ""} — sẵn sàng` }));
    return;
  }
  elements.preflightList.replaceChildren(...pf.items.map((item) => {
    const li = el("li", { className: `pf--${item.status}`, textContent: item.label });
    if (item.hint) li.append(el("small", { textContent: item.hint }));
    return li;
  }));
}

function render(status) {
  lastStatus = status;
  const active = status.app_state === "ALERTING";
  document.body.classList.toggle("is-alerting", active || (status.system_alerts ?? []).some((item) => item.ring && !item.acknowledged));
  elements.versionValue.textContent = status.version ?? "5.0";
  elements.stateBadge.textContent = active ? "ĐANG REO" : "IDLE";
  elements.stateBadge.className = `state ${active ? "state--alerting" : "state--idle"}`;
  elements.dryRunBadge.hidden = !status.dry_run;
  elements.testModeBadge.hidden = !status.test_mode;
  elements.testModeBadge.textContent = status.test_mode ? `TEST·${ROLE_LABEL[status.test_role] ?? ""}` : "TEST";
  elements.alertPanel.classList.toggle("alert-panel--active", active);
  const alert = status.current_alert;
  elements.alertTitle.textContent = active ? `${alert.unknown_chat ? "Nhóm lạ · " : ""}${alert.group_name || alert.subject || "AOG alert"}` : "Không có tin";
  elements.alertMeta.textContent = active ? `${alert.source === "email" ? "Outlook" : "WhatsApp"} · ${alert.sender || `${alert.unread_count || 1} tin chưa đọc`}` : "Watcher đang canh.";
  elements.ackButton.disabled = !active;

  renderSystemAlerts(status.system_alerts);
  renderUnknown(status.unknown_chats);
  renderSources(status);
  renderPreflight(status);

  const hasSession = Boolean(status.session);
  elements.roleValue.textContent = status.current_role ? ROLE_LABEL[status.current_role] : (hasSession ? "NGOÀI GIỜ" : "--");
  elements.queueValue.textContent = String(status.pending_count ?? 0);
  elements.groupsValue.textContent = String(status.groups?.effective ?? 0);
  elements.groupsValue.title = `Chung: ${status.groups?.team ?? 0} · Riêng: ${status.groups?.personal ?? 0} · Bỏ qua: ${status.groups?.ignored ?? 0}`;
  slotRows.forEach((row, index) => row.classList.toggle("slot-row--active", status.current_slot_index === index));

  if (hasSession) {
    elements.startShiftButton.textContent = "Đang trong ca";
    elements.startShiftButton.disabled = true;
    elements.startShiftButton.classList.add("role-row__active");
    elements.endShiftButton.hidden = false;
    const slotText = status.current_slot_index !== null ? `Slot ${status.current_slot_index + 1}` : (status.test_mode ? "Test mode" : "ngoài slot");
    elements.shiftStatusHint.textContent = `${slotText} · ${status.current_role ? ROLE_LABEL[status.current_role] : "--"}`;
  } else {
    elements.startShiftButton.textContent = "Bắt đầu ca";
    elements.startShiftButton.disabled = false;
    elements.startShiftButton.classList.remove("role-row__active");
    elements.endShiftButton.hidden = true;
    resetEndShiftConfirm();
    elements.shiftStatusHint.textContent = "Chưa bắt đầu ca";
  }
  if (document.activeElement?.closest?.(".slot-row") === null) writeSlotsToUI(status.shift_slots);
  if (!slotsInitialized) { document.querySelector(".slots").open = !hasSession; slotsInitialized = true; }

  elements.diagnosticsRows.replaceChildren(
    ...["whatsapp", "outlook"].map((source) => {
      const stats = status.health?.[source]?.stats;
      const label = source === "whatsapp" ? "WhatsApp" : "Outlook";
      const text = stats ? `${label}: ${stats.rows_seen ?? 0} dòng / ${stats.unread_seen ?? 0} chưa đọc / ${stats.alerts_sent ?? 0} alert${stats.unknown_sent ? ` / ${stats.unknown_sent} chat lạ` : ""}${stats.folder_gate === "blocked" ? ` / chặn (${stats.path})` : ""}` : `${label}: chưa có dữ liệu`;
      return el("div", { className: "diagnostics__row", textContent: text });
    }),
    el("div", { className: "diagnostics__row", textContent: `Chờ ghi SharePoint: ${status.outbox_size ?? 0} · Nhóm chung ${status.groups?.team ?? 0} · riêng ${status.groups?.personal ?? 0} · bỏ qua ${status.groups?.ignored ?? 0}` }),
  );
  elements.recentEvents.replaceChildren(...(status.recent_events ?? []).slice(-6).reverse().map((event) => {
    const context = event.subject || event.group_name || event.sender || event.title || "";
    const text = `${localTime(event.timestamp)} ${event.event_type}${event.source ? ` · ${event.source}` : ""}${context ? ` · ${context}` : ""}`;
    return el("li", { className: `recent-event ${eventClass(event.event_type)}`, textContent: shortText(text, 60), title: text });
  }));
  elements.sharepointButton.hidden = !status.sharepoint?.configured;
}

async function act(message, okText = "") {
  try {
    const response = await send(message);
    if (response?.status) render(response.status);
    if (response?.ok === false || response?.error) showFeedback(response.error);
    else showFeedback(response?.note || okText);
    return response;
  } catch (error) { showFeedback(`Lỗi: ${error.message}`); return null; }
}

async function reportBattery() {
  try {
    if (!navigator.getBattery) { await send({ type: "REPORT_BATTERY", battery: { supported: false } }); return; }
    const battery = await navigator.getBattery();
    await send({ type: "REPORT_BATTERY", battery: { supported: true, charging: battery.charging, level: battery.level } });
  } catch { /* ignore */ }
}

async function getStatus() {
  try {
    const response = await send({ type: "GET_STATUS" });
    if (response?.status) render(response.status);
  } catch (error) { showFeedback(`Lỗi trạng thái: ${error.message}`); }
}

async function saveSlots() {
  const slots = readSlotsFromUI();
  if (slots.some((slot) => !slot.start || !slot.end)) { showFeedback("Slot thiếu giờ bắt đầu/kết thúc."); return false; }
  await send({ type: "UPDATE_SHIFT_SLOTS", slots });
  return true;
}

slotRows.forEach((row) => row.addEventListener("change", async () => { if (await saveSlots()) showFeedback("Đã lưu giờ ca."); }));

elements.ackButton.addEventListener("click", async () => {
  elements.ackButton.disabled = true;
  elements.ackButton.textContent = "ĐANG GHI ACK…";
  await act({ type: "ACK_CURRENT" }, "Đã ACK. Máy kia được báo.");
  elements.ackButton.textContent = "ACK — TÔI NHẬN XỬ LÝ";
});

elements.startShiftButton.addEventListener("click", async () => {
  if (!(await saveSlots())) return;
  await reportBattery();
  await act({ type: "START_SHIFT" }, "Đã bắt đầu ca. Làm theo danh sách Kiểm tra đầu ca.");
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
  await act({ type: "END_SHIFT" }, "Ca đã kết thúc — máy này không còn reo.");
});

elements.testSoundButton.addEventListener("click", () => act({ type: "TEST_SOUND" }, "Đang phát chuông thử 6 giây…"));
elements.soundOkButton.addEventListener("click", () => act({ type: "SOUND_CONFIRMED" }, "Đã xác nhận nghe rõ chuông."));

elements.leakButton.addEventListener("click", async () => {
  const what = elements.leakWhat.value.trim();
  if (!what) { showFeedback("Nhập tên nhóm hoặc tiêu đề email."); return; }
  const at = elements.leakAt.value ? new Date(elements.leakAt.value).toISOString() : new Date().toISOString();
  const response = await act({ type: "REPORT_LEAK", source: elements.leakSource.value, what, at });
  if (response?.cause) showFeedback(`Đã ghi. Nguyên nhân: ${response.cause} — ${response.reason}`);
  elements.leakWhat.value = "";
});

elements.settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.sharepointButton.addEventListener("click", async () => {
  const stored = await chrome.storage.local.get("aog_config");
  const url = stored.aog_config?.sharepoint_site_url;
  if (url) chrome.tabs.create({ url });
});

chrome.runtime.onMessage.addListener((message) => { if (message.type === "STATUS_UPDATED") render(message.payload); });
reportBattery();
getStatus();
setInterval(getStatus, 2_000);
setInterval(reportBattery, 60_000);
