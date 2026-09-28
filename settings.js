import { getConfig, setConfig } from "./lib/storage.js";
import { normalizeSiteUrl } from "./lib/sharepoint_client.js";
import { uniqueNames } from "./lib/groups.js";

const byId = (id) => document.getElementById(id);
const lines = (value) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const unique = (items) => [...new Set(items)];

function setResult(text, kind = "") {
  const node = byId("spResult");
  node.textContent = text;
  node.className = `result ${kind}`;
}

async function load() {
  const config = await getConfig();
  byId("sharepointSiteUrl").value = config.sharepoint_site_url ?? "";
  byId("selfDisplayName").value = config.self_display_name;
  byId("coordGroup").value = config.coord_group;
  byId("unknownChatAlert").checked = config.unknown_chat_alert !== false;
  byId("customerGroups").value = (config.customer_groups ?? []).join("\n");
  byId("ignoredChats").value = (config.ignored_chats ?? []).join("\n");
  byId("outlookWatchPath").value = config.outlook_watch_path ?? "";
  byId("senderWhitelist").value = (config.sender_whitelist ?? []).join("\n");
  byId("skipDomains").value = (config.skip_sender_domains ?? []).join("\n");
  byId("subjectKeywords").value = (config.subject_keywords ?? []).join("\n");
  byId("primaryTimeout").value = config.primary_timeout_seconds;
  byId("backupDelay").value = config.backup_delay_seconds;
  byId("maxDuration").value = config.max_alert_duration_seconds;
  byId("idleThreshold").value = Math.max(15, Number(config.idle_threshold_seconds) || 15);
  byId("wakeAudioMode").value = config.wake_audio_mode === "escalate" ? "escalate" : "gentle";
  byId("followupEnabled").checked = config.followup_enabled !== false;
  byId("followupAfter").value = config.followup_after_minutes;
  byId("followupAnswer").value = config.followup_answer_minutes;
  byId("peerLost").value = config.peer_lost_minutes;
  byId("reminderGrace").value = config.shift_reminder_grace_minutes;
  byId("blindAfter").value = config.blind_after_minutes;
  byId("testMode").checked = config.test_mode;
  byId("testRole").value = config.test_role === "backup" ? "backup" : "primary";
  byId("dryRun").checked = config.dry_run;
  const stored = await chrome.storage.local.get(["aog_team_groups", "aog_team_groups_synced_at"]);
  const team = stored.aog_team_groups ?? [];
  byId("teamGroupsInfo").textContent = team.length ? `Đang có ${team.length} nhóm chung (đồng bộ lúc ${new Date(stored.aog_team_groups_synced_at).toLocaleString("vi-VN")}).` : "Chưa đồng bộ nhóm chung.";
}

function numberOr(id, fallback) {
  const value = Number(byId(id).value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function save({ quiet = false } = {}) {
  const status = byId("status");
  const siteRaw = byId("sharepointSiteUrl").value.trim();
  const site = siteRaw ? normalizeSiteUrl(siteRaw) : "";
  if (siteRaw && !site) { status.textContent = "Link SharePoint không hợp lệ (phải là https://...sharepoint.com/sites/...)."; return false; }
  const coordGroup = byId("coordGroup").value.trim();
  const customerGroups = uniqueNames(lines(byId("customerGroups").value));
  if (coordGroup && customerGroups.some((group) => group.toLocaleLowerCase() === coordGroup.toLocaleLowerCase())) { status.textContent = "Nhóm điều phối không được nằm trong nhóm khách."; return false; }
  const existing = await getConfig();
  const config = {
    ...existing,
    sharepoint_site_url: site,
    self_display_name: byId("selfDisplayName").value.trim(),
    coord_group: coordGroup,
    unknown_chat_alert: byId("unknownChatAlert").checked,
    customer_groups: customerGroups,
    ignored_chats: uniqueNames(lines(byId("ignoredChats").value)),
    outlook_watch_path: byId("outlookWatchPath").value.trim(),
    sender_whitelist: unique(lines(byId("senderWhitelist").value)),
    skip_sender_domains: unique(lines(byId("skipDomains").value).map((item) => item.replace(/^@/, "").toLocaleLowerCase())),
    subject_keywords: unique(lines(byId("subjectKeywords").value)),
    primary_timeout_seconds: numberOr("primaryTimeout", 120),
    backup_delay_seconds: numberOr("backupDelay", 180),
    max_alert_duration_seconds: numberOr("maxDuration", 540),
    idle_threshold_seconds: Math.max(15, numberOr("idleThreshold", 15)),
    wake_audio_mode: byId("wakeAudioMode").value === "escalate" ? "escalate" : "gentle",
    followup_enabled: byId("followupEnabled").checked,
    followup_after_minutes: numberOr("followupAfter", 10),
    followup_answer_minutes: numberOr("followupAnswer", 5),
    peer_lost_minutes: numberOr("peerLost", 5),
    shift_reminder_grace_minutes: numberOr("reminderGrace", 10),
    blind_after_minutes: numberOr("blindAfter", 5),
    test_mode: byId("testMode").checked,
    test_role: byId("testRole").value === "backup" ? "backup" : "primary",
    dry_run: byId("dryRun").checked,
  };
  await setConfig(config);
  await chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" }).catch(() => {});
  if (!quiet) { status.style.color = "var(--green)"; status.textContent = "Đã lưu."; }
  return true;
}

byId("settingsForm").addEventListener("submit", async (event) => { event.preventDefault(); await save(); await load(); });

async function busy(button, work) {
  button.disabled = true;
  button.dataset.busy = "true";
  try { await work(); } finally { button.disabled = false; button.dataset.busy = "false"; }
}

byId("spTest").addEventListener("click", () => busy(byId("spTest"), async () => {
  if (!(await save({ quiet: true }))) return;
  setResult("Đang kiểm tra…");
  const response = await chrome.runtime.sendMessage({ type: "SP_TEST" });
  if (!response?.ok) {
    setResult(`Chưa kết nối được: ${response?.error ?? "không rõ lỗi"}\n→ Bấm "Mở SharePoint", đăng nhập bằng email công ty, rồi bấm lại "Đăng nhập & kiểm tra".`, "bad");
    return;
  }
  const missing = response.missing ?? [];
  const who = `${response.user?.name ?? ""} <${response.user?.email ?? ""}>`;
  if (missing.length) setResult(`Đã đăng nhập: ${who}\nSite chưa có đủ bảng (${missing.length} mục thiếu). Nhờ trưởng team bấm "Tạo bảng".`, "bad");
  else {
    setResult(`Đã đăng nhập: ${who}\nĐủ bảng. Đang lấy nhóm chung và cài đặt chung…`, "ok");
    await chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });
    await load();
    setResult(`Đã đăng nhập: ${who}\nĐã nối SharePoint. Nhóm chung và cài đặt chung đã được lấy về.`, "ok");
  }
}));

byId("spOpen").addEventListener("click", () => {
  const site = normalizeSiteUrl(byId("sharepointSiteUrl").value);
  if (!site) { setResult("Dán link SharePoint trước.", "bad"); return; }
  chrome.tabs.create({ url: site });
});

byId("spSetup").addEventListener("click", () => busy(byId("spSetup"), async () => {
  if (!(await save({ quiet: true }))) return;
  setResult("Đang tạo bảng…");
  const response = await chrome.runtime.sendMessage({ type: "SP_SETUP" });
  if (!response?.ok) { setResult(`Không tạo được: ${response?.error}`, "bad"); return; }
  setResult(response.report?.length ? `Đã tạo:\n${response.report.join("\n")}` : "Đã đủ bảng, không cần tạo thêm.", "ok");
}));

byId("spPublish").addEventListener("click", () => busy(byId("spPublish"), async () => {
  if (!(await save({ quiet: true }))) return;
  const response = await chrome.runtime.sendMessage({ type: "SP_PUBLISH_SETTINGS" });
  setResult(response?.ok ? `Đã đẩy ${response.written} cài đặt chung lên AOG_Settings.` : `Không đẩy được: ${response?.error}`, response?.ok ? "ok" : "bad");
}));

byId("previewAudio").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "PREVIEW_AUDIO", mode: byId("wakeAudioMode").value }).catch(() => {});
  byId("status").style.color = "var(--green)";
  byId("status").textContent = "Đang phát thử chuông.";
});

load().catch((error) => { byId("status").textContent = `Không tải được: ${error.message}`; });
