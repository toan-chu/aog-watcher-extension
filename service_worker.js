import { ALERT_SOURCE, APP_STATE, APP_VERSION, DEFAULT_CONFIG, MESSAGE, ROLE, STORAGE_KEYS } from "./lib/constants.js";
import { deterministicAlertId } from "./lib/hash.js";
import { shouldSkipEmail } from "./lib/filter.js";
import { resolveRoleAtTime, isWithinAnySlot } from "./lib/shift_engine.js";
import { enrichEventRecord } from "./lib/event_log.js";
import { reduce } from "./lib/state_machine.js";
import { hydrateRuntimeState, serializeRuntimeState } from "./lib/runtime_state.js";
import { parseTag, serializeTag } from "./lib/peer_protocol.js";
import { dispatchPeerOnce, PeerDispatchGuard } from "./lib/peer_dispatch_guard.js";
import { markAlertSourceSeen, markSourceSeen } from "./lib/source_health.js";
import { createSharePointClient, normalizeSiteUrl } from "./lib/sharepoint_client.js";
import { SP_LISTS } from "./lib/sp_schema.js";
import {
  BLACKBOX_EVENTS, SIGNAL, checkSchema, ensureSchema, eventFields, executeOp, latestSignalId,
  pullMachines, pullSignals, pullTeamGroups, signalFields, upsertByKey,
} from "./lib/team_sync.js";
import { enqueueOp, dueOps, completeOp, failOp } from "./lib/outbox.js";
import { addName, classifyChat, CHAT_CLASS, effectiveGroups, removeName } from "./lib/groups.js";
import { evaluateSources, problemsOf, SOURCE_STATUS } from "./lib/blind_detector.js";
import { runPreflight } from "./lib/preflight.js";
import { shiftReminderState } from "./lib/shift_reminder.js";
import { evaluatePeers, wasOfflineAt } from "./lib/heartbeat.js";
import { classifyMiss } from "./lib/miss_cause.js";
import { answerFollowup, createFollowup, tickFollowups } from "./lib/followup.js";
import { applySharedSettings, changedKeys, publishSharedSettings, pullSharedSettings } from "./lib/shared_settings.js";
import { shiftDate, shiftRowFields } from "./lib/shift_row.js";
import {
  appendEventLog, clearShiftBaseline, endShiftSession, getConfig, getEventLog, getKey, getMachineId,
  getRoleSession, getRuntimeState, getShiftBaseline, getShiftSessions, getSourceHealth, isAlertEscalated,
  isAlertPeerHandled, markAlertEscalated, markAlertPeerHandled, setConfig, setKey, setRoleSession,
  setRuntimeState, setShiftBaseline, setSourceHealth, startShiftSession,
} from "./lib/storage.js";

const K = STORAGE_KEYS;
const TICK_ALARM = "aog:tick";
const GROUP_PULL_MS = 5 * 60_000;

let state = null;
let operation = Promise.resolve();
const peerDispatchGuard = new PeerDispatchGuard();
let healthRecords = null;
let flushing = false;

// ---------- helpers ----------
function timing(config) {
  return {
    primary_timeout_seconds: Number(config.primary_timeout_seconds) || 120,
    backup_delay_seconds: Number(config.backup_delay_seconds) || 180,
    max_alert_duration_seconds: Number(config.max_alert_duration_seconds) || 540,
  };
}
const normalizedName = (value) => String(value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
const isSameGroupName = (left, right) => Boolean(normalizedName(left)) && normalizedName(left) === normalizedName(right);
const idleThreshold = (config) => Math.max(15, Number(config.idle_threshold_seconds) || 15);
const spConfigured = (config) => Boolean(normalizeSiteUrl(config.sharepoint_site_url));
const spClient = (config) => createSharePointClient({ siteUrl: config.sharepoint_site_url });

function resolveCurrentRole(config, now = new Date()) {
  if (config.test_mode) {
    const forced = config.test_role === ROLE.BACKUP ? ROLE.BACKUP : ROLE.PRIMARY;
    return { role: forced, source: "test_mode", slot_index: null };
  }
  const resolved = resolveRoleAtTime(now, config.shift_slots);
  if (!resolved) return null;
  return { role: resolved.role, source: "slot", slot_index: resolved.slot_index, slot: resolved.slot };
}
function currentWithinShift(config, now = new Date()) {
  return config.test_mode ? true : isWithinAnySlot(now, config.shift_slots);
}

async function hydrate() {
  if (state) return state;
  const [stored, session] = await Promise.all([getRuntimeState(), getRoleSession()]);
  state = hydrateRuntimeState(stored, session);
  return state;
}
async function hydrateHealth() { healthRecords ??= await getSourceHealth(); return healthRecords; }
async function recordSourceHealth(source, stats = null) {
  await hydrateHealth();
  healthRecords = markSourceSeen(healthRecords, source, Date.now(), stats);
  await setSourceHealth(healthRecords);
}
async function recordAlertSourceHealth(alert) {
  await hydrateHealth();
  healthRecords = markAlertSourceSeen(healthRecords, alert);
  await setSourceHealth(healthRecords);
}
async function persist() { await setRuntimeState(serializeRuntimeState(state)); broadcastStatus(); }
function enqueue(work) {
  operation = operation.then(work, work).catch((error) => console.error("AOG Watcher operation failed", error));
  return operation;
}
async function dispatch(event) {
  await hydrate();
  const result = reduce(state, event);
  state = result.state;
  await persist();
  for (const effect of result.effects) await executeEffect(effect);
}

// ---------- audio / notifications ----------
async function ensureOffscreen() {
  const url = chrome.runtime.getURL("offscreen.html");
  const contexts = chrome.runtime.getContexts ? await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [url] }) : [];
  if (contexts.length === 0) await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["AUDIO_PLAYBACK"], justification: "Play escalating wake alarm while an AOG alert is active." });
}
async function playWakeAudio(config) {
  try {
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ type: MESSAGE.AUDIO_PLAY, mode: config.wake_audio_mode === "escalate" ? "escalate" : "gentle" });
  } catch (error) {
    await setKey(K.AUDIO_ERROR_AT, Date.now());
    await appendEventLog({ event_type: "AUDIO_FAILED", error: String(error?.message ?? error) });
  }
}
async function stopAudio() { await chrome.runtime.sendMessage({ type: MESSAGE.AUDIO_STOP }).catch(() => {}); }
async function notify(id, title, message) {
  await chrome.notifications.create(id, { type: "basic", iconUrl: "assets/icon128.png", title, message: message || " ", priority: 2, requireInteraction: true }).catch(() => {});
}
async function showWakeNotification(alert) {
  const prefix = alert.unknown_chat ? "Nhóm lạ · " : "";
  await notify(`aog-${alert.alert_id}`, "AOG alert", `${prefix}${alert.group_name || alert.subject || "New eligible alert"}`);
}
async function queryIdleState(config) {
  if (!chrome.idle?.queryState) return "idle";
  return new Promise((resolve) => {
    try { chrome.idle.queryState(idleThreshold(config), (stateName) => resolve(stateName || "active")); } catch { resolve("idle"); }
  });
}
async function clearTimers(name, alertId) {
  const alarms = await chrome.alarms.getAll();
  const prefix = `aog:${name}:`;
  await Promise.all(alarms.filter((alarm) => alarm.name.startsWith(prefix) && (!alertId || alarm.name === `${prefix}${alertId}`)).map((alarm) => chrome.alarms.clear(alarm.name)));
}

// ---------- system alerts (independent from the AOG state machine) ----------
async function getSystemAlerts() { return getKey(K.SYSTEM_ALERTS, {}); }
async function ringingSystemAlerts() {
  return Object.values(await getSystemAlerts()).filter((item) => item.ring && !item.acknowledged);
}
async function raiseSystemAlert(key, { kind, title, message, ring = true, rearm = false }) {
  const alerts = await getSystemAlerts();
  const existing = alerts[key];
  if (existing && !rearm) return false;
  alerts[key] = { key, kind, title, message, ring, acknowledged: false, created_at: new Date().toISOString() };
  await setKey(K.SYSTEM_ALERTS, alerts);
  await appendServiceEvent({ event_type: "SYSTEM_ALERT", kind, detail_key: key, title, message });
  await notify(`sys-${key}`, title, message);
  if (ring) await playWakeAudio(await getConfig());
  broadcastStatus();
  return true;
}
async function clearSystemAlert(key, { acknowledged = false } = {}) {
  const alerts = await getSystemAlerts();
  if (!alerts[key]) return;
  if (acknowledged) {
    alerts[key] = { ...alerts[key], acknowledged: true };
    await appendServiceEvent({ event_type: "SYSTEM_ALERT_ACK", kind: alerts[key].kind, detail_key: key });
  } else {
    delete alerts[key];
  }
  await setKey(K.SYSTEM_ALERTS, alerts);
  await chrome.notifications.clear(`sys-${key}`).catch(() => {});
  await reconcileAudio();
  broadcastStatus();
}
async function reconcileAudio() {
  await hydrate();
  const aogRinging = state.app_state === APP_STATE.ALERTING && !state.pending_wake;
  if (!aogRinging && (await ringingSystemAlerts()).length === 0) await stopAudio();
}

// ---------- team sync (SharePoint) ----------
async function identity() { return getKey(K.IDENTITY, { name: "", email: "" }); }

async function queueWrite(op) {
  const config = await getConfig();
  if (!spConfigured(config)) return;
  await setKey(K.OUTBOX, enqueueOp(await getKey(K.OUTBOX, []), op));
}

async function flushOutbox(config) {
  if (flushing || !spConfigured(config)) return;
  flushing = true;
  try {
    const client = spClient(config);
    let queue = await getKey(K.OUTBOX, []);
    let cache = await getKey(K.SP_ITEM_CACHE, {});
    for (const op of dueOps(queue)) {
      try {
        cache = await executeOp(client, op, cache);
        queue = completeOp(queue, op.id);
      } catch (error) {
        queue = failOp(queue, op.id, { error: error.message });
        if (error.status === 401 || error.status === 403) break;
      }
    }
    await setKey(K.OUTBOX, queue);
    await setKey(K.SP_ITEM_CACHE, cache);
  } finally { flushing = false; }
}

async function setSpStatus(patch) {
  const current = await getKey(K.SP_STATUS, {});
  await setKey(K.SP_STATUS, { ...current, ...patch, checked_at: Date.now() });
}

async function sendSignal(type, { alertId = "", source = "", payload = {} } = {}) {
  const config = await getConfig();
  if (!spConfigured(config)) return false;
  const fields = signalFields({ type, alertId, source, fromMachine: await getMachineId(), payload });
  try {
    await spClient(config).addItem(SP_LISTS.SIGNALS, fields);
    return true;
  } catch (error) {
    await setSpStatus({ ok: false, error: error.message });
    await queueWrite({ kind: "add", list: SP_LISTS.SIGNALS, fields });
    return false;
  }
}

async function machineFields(config, { problems = [], ready = null } = {}) {
  await hydrate();
  const who = await identity();
  const preflight = await getKey(K.PREFLIGHT, null);
  return {
    Title: config.self_display_name || who.name || "AOG machine",
    MachineId: await getMachineId(),
    OperatorName: config.self_display_name,
    Email: who.email,
    Role: state.session?.role ?? "",
    ShiftId: state.session?.shift_id ?? "",
    Ready: (ready ?? preflight?.ready) ? "1" : "0",
    Problems: problems,
    LastBeat: new Date().toISOString(),
    Version: APP_VERSION,
  };
}

async function heartbeat(config, problems) {
  const client = spClient(config);
  const cache = await getKey(K.SP_ITEM_CACHE, {});
  const fields = await machineFields(config, { problems });
  const result = await upsertByKey(client, SP_LISTS.MACHINES, "MachineId", fields.MachineId, fields, cache);
  await setKey(K.SP_ITEM_CACHE, result.cache);
}

async function syncTeam(config, { problems = [], forceGroups = false } = {}) {
  if (!spConfigured(config)) { await setSpStatus({ ok: false, configured: false, error: "" }); return; }
  const client = spClient(config);
  try {
    const who = await identity();
    if (!who.email) await setKey(K.IDENTITY, await client.currentUser());
    await heartbeat(config, problems);
    await flushOutbox(config);

    // signals
    let cursor = await getKey(K.SIGNAL_CURSOR, null);
    if (cursor === null) cursor = await latestSignalId(client);
    const { signals, lastId } = await pullSignals(client, { sinceId: cursor, selfId: await getMachineId() });
    await setKey(K.SIGNAL_CURSOR, lastId);
    for (const signal of signals) await handleSignal(signal, config);

    // peers
    const peers = evaluatePeers(await pullMachines(client), { selfId: await getMachineId(), lostAfterMinutes: Number(config.peer_lost_minutes) || 5 });
    await setKey(K.PEERS, peers);
    await hydrate();
    for (const peer of peers) {
      const key = `peer:${peer.machine_id}`;
      if (state.session && peer.status === "lost") {
        await raiseSystemAlert(key, { kind: "peer_lost", title: "Máy trực cùng mất liên lạc", message: `${peer.name || peer.email || "Máy kia"} không gửi tín hiệu từ ${peer.last_beat ? new Date(peer.last_beat).toLocaleTimeString("vi-VN") : "?"} (ngủ, hết pin, mất mạng hoặc đóng trình duyệt).` });
      } else {
        await clearSystemAlert(key);
      }
      const blindKey = `peer_src:${peer.machine_id}`;
      if (state.session && peer.on_shift && peer.problems.length) {
        await raiseSystemAlert(blindKey, { kind: "peer_source", title: "Máy kia đang có vấn đề nguồn", message: `${peer.name}: ${peer.problems.map((item) => item.message).join(" · ")}`, ring: false });
      } else await clearSystemAlert(blindKey);
    }

    // groups
    const syncedAt = await getKey(K.TEAM_GROUPS_SYNCED_AT, 0);
    if (forceGroups || Date.now() - syncedAt > GROUP_PULL_MS) {
      await setKey(K.TEAM_GROUPS, await pullTeamGroups(client));
      await setKey(K.TEAM_GROUPS_SYNCED_AT, Date.now());
      const shared = await pullSharedSettings(client);
      const current = await getConfig();
      const merged = applySharedSettings(current, shared);
      const changed = changedKeys(current, merged);
      if (changed.length) {
        await setConfig(merged);
        await appendEventLog({ event_type: "SHARED_SETTINGS_APPLIED", keys: changed.join(",") });
      }
    }
    await setSpStatus({ ok: true, configured: true, error: "" });
  } catch (error) {
    await setSpStatus({ ok: false, configured: true, error: error.message });
  }
}

const seenSignalKeys = new Set();
async function handleSignal(signal, config) {
  const dedupe = `${signal.type}:${signal.alert_id}:${signal.from}`;
  if (seenSignalKeys.has(dedupe)) return;
  seenSignalKeys.add(dedupe);
  await hydrate();
  const payload = { alert_id: signal.alert_id, source: signal.source, timestamp: signal.payload.timestamp ?? signal.sent_at, timing: timing(config) };
  if (signal.type === SIGNAL.HANDLED) {
    await markAlertPeerHandled(signal.alert_id);
    await dispatch({ type: "PEER_HANDLED_RECEIVED", payload });
  } else if (signal.type === SIGNAL.ESCALATED) {
    await markAlertEscalated(signal.alert_id);
    await dispatch({ type: "PEER_ESCALATED_RECEIVED", payload });
  } else if (signal.type === SIGNAL.SHIFT_NOT_STARTED) {
    await raiseSystemAlert(`peer_shift:${signal.from}:${signal.payload.night ?? ""}`, { kind: "peer_shift", title: "Máy kia chưa mở ca", message: `${signal.payload.operator || "Máy kia"} đã quá giờ ca nhưng chưa bấm Bắt đầu ca.` });
  } else if (signal.type === SIGNAL.FOLLOWUP_OVERDUE) {
    await raiseSystemAlert(`peer_followup:${signal.alert_id}`, { kind: "peer_followup", title: "Tin AOG chưa được xác nhận xử lý", message: `${signal.payload.operator || "Máy kia"} đã ACK "${signal.payload.title || signal.alert_id}" nhưng không trả lời câu hỏi xử lý xong chưa.` });
  } else if (signal.type === SIGNAL.SOURCE_BLIND) {
    await raiseSystemAlert(`peer_blind:${signal.from}:${signal.source}`, { kind: "peer_source", title: "Máy kia không đọc được nguồn", message: `${signal.payload.operator || "Máy kia"}: ${signal.payload.message || signal.source}`, ring: false });
  }
}

// ---------- peer transport ----------
async function sendPeerTextViaWhatsApp(text) {
  const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  let lastError = "No WhatsApp Web tab found";
  for (const tab of tabs) {
    try {
      const result = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE.SEND_PEER_TAG, text });
      if (result?.ok) return;
      lastError = result?.error || lastError;
    } catch (error) { lastError = error.message; }
  }
  await appendEventLog({ event_type: "PEER_SEND_FAILED", error: lastError });
  throw new Error(lastError);
}

async function sendPeer(tag, alert, config) {
  const payload = {
    alert_id: alert.alert_id, source: alert.source, timestamp: new Date().toISOString(), from_role: state.session?.role,
    operator: config.self_display_name, group: alert.group_name, unread_count: alert.unread_count, sender: alert.sender, subject: alert.subject,
  };
  if (spConfigured(config)) {
    const ok = await sendSignal(tag === "HANDLED" ? SIGNAL.HANDLED : SIGNAL.ESCALATED, { alertId: alert.alert_id, source: alert.source, payload });
    if (ok) return;
  }
  if (!config.coord_group) return;
  await sendPeerTextViaWhatsApp(serializeTag(tag, payload));
}

// ---------- baseline ----------
function baselineFromSnapshot(shiftId, snapshot = {}) {
  return {
    shift_id: shiftId, created_at: new Date().toISOString(),
    outlook_ids: Array.isArray(snapshot.outlook_ids) ? [...snapshot.outlook_ids] : [],
    whatsapp_unread: snapshot.whatsapp_unread && typeof snapshot.whatsapp_unread === "object" ? { ...snapshot.whatsapp_unread } : {},
    sources: {},
  };
}
async function handleBaselineSync(message) {
  await hydrate();
  const shiftId = state.session?.shift_id;
  if (!shiftId) return { baseline: null };
  let baseline = await getShiftBaseline();
  if (!baseline || baseline.shift_id !== shiftId) {
    baseline = baselineFromSnapshot(shiftId, message.snapshot);
    baseline.sources[message.source] = true;
    await setShiftBaseline(baseline);
    await appendServiceEvent({ event_type: "BASELINE_CREATED", source: message.source, shift_id: shiftId });
    return { baseline };
  }
  const sources = { ...(baseline.sources ?? {}) };
  if (!sources[message.source]) {
    if (message.source === "outlook" && Array.isArray(message.snapshot?.outlook_ids)) baseline = { ...baseline, outlook_ids: [...message.snapshot.outlook_ids] };
    if (message.source === "whatsapp" && message.snapshot?.whatsapp_unread) baseline = { ...baseline, whatsapp_unread: { ...message.snapshot.whatsapp_unread } };
    baseline = { ...baseline, sources: { ...sources, [message.source]: true } };
    await setShiftBaseline(baseline);
    await appendServiceEvent({ event_type: "BASELINE_CREATED", source: message.source, shift_id: shiftId });
  }
  return { baseline };
}
async function sendRebaselineToTabs() {
  const targets = ["https://web.whatsapp.com/*", "https://outlook.office.com/*", "https://outlook.office365.com/*", "https://outlook.live.com/*", "https://outlook.cloud.microsoft/*"];
  const tabs = await chrome.tabs.query({ url: targets });
  await Promise.all(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: MESSAGE.REBASELINE }).catch(() => {})));
}

// ---------- event log (local + black box) ----------
async function appendServiceEvent(record) {
  const config = await getConfig();
  const eventRecord = { ...record, timestamp: record.timestamp ?? new Date().toISOString() };
  const detectedById = new Map();
  if (eventRecord.event_type === "ACK" && eventRecord.alert_id && eventRecord.response_time_ms === undefined) {
    for (const event of await getEventLog()) if (event.event_type === "DETECTED" && event.alert_id === eventRecord.alert_id) detectedById.set(event.alert_id, event.timestamp);
  }
  if (eventRecord.event_type === "MISSED" && !eventRecord.miss_cause) {
    const audioErrorAt = await getKey(K.AUDIO_ERROR_AT, 0);
    const soundAt = await getKey(K.SOUND_CONFIRMED_AT, 0);
    const shiftStart = Date.parse(state?.session?.started_at ?? "") || 0;
    const verdict = classifyMiss({ kind: "missed", audioFailed: Date.now() - audioErrorAt < 15 * 60_000, soundConfirmed: Boolean(soundAt && soundAt >= shiftStart - 30 * 60_000) });
    eventRecord.miss_cause = verdict.cause;
    eventRecord.miss_reason = verdict.reason;
  }
  const enriched = enrichEventRecord(eventRecord, { session: state?.session, config, detectedById });
  await appendEventLog(enriched);
  if (BLACKBOX_EVENTS.has(enriched.event_type)) {
    const who = await identity();
    await queueWrite({ kind: "add", list: SP_LISTS.EVENTS, fields: eventFields(enriched, { machineId: await getMachineId(), email: who.email }) });
  }
}

// ---------- effects ----------
async function executeEffect(effect) {
  const config = await getConfig();
  switch (effect.type) {
    case "START_WAKE":
      if (config.dry_run) {
        await appendServiceEvent({ event_type: "DRY_RUN_WOULD_WAKE", alert_id: effect.alert.alert_id, source: effect.alert.source, group_name: effect.alert.group_name, sender: effect.alert.sender, subject: effect.alert.subject });
        break;
      }
      if (await queryIdleState(config) === "active") {
        if (effect.alert.source === ALERT_SOURCE.WHATSAPP && isSameGroupName(effect.alert.group_name, effect.alert.active_conversation)) {
          state.pending_wake = effect.alert.alert_id;
          await persist();
          await appendServiceEvent({ event_type: "WAKE_SUPPRESSED_FOCUSED", alert_id: effect.alert.alert_id, source: effect.alert.source, group_name: effect.alert.group_name });
          break;
        }
        await showWakeNotification(effect.alert);
        state.pending_wake = effect.alert.alert_id;
        await persist();
        await appendServiceEvent({ event_type: "WAKE_DEFERRED_ACTIVE", alert_id: effect.alert.alert_id, source: effect.alert.source, group_name: effect.alert.group_name, sender: effect.alert.sender, subject: effect.alert.subject });
        break;
      }
      await playWakeAudio(config);
      await showWakeNotification(effect.alert);
      break;
    case "STOP_WAKE":
      state.pending_wake = null;
      await persist();
      await stopAudio();
      if ((await ringingSystemAlerts()).length) await playWakeAudio(config);
      break;
    case "SCHEDULE_TIMER":
      await chrome.alarms.create(`aog:${effect.name}:${effect.alert_id}`, { when: Date.now() + Math.max(1000, effect.delay_ms) });
      break;
    case "CANCEL_TIMER":
      await clearTimers(effect.name, effect.alert_id);
      break;
    case "SEND_PEER_TAG": {
      if (config.dry_run) {
        await appendServiceEvent({ event_type: "DRY_RUN_WOULD_SEND_TAG", alert_id: effect.alert.alert_id, source: effect.alert.source, tag: effect.tag });
        break;
      }
      try {
        const result = await dispatchPeerOnce(peerDispatchGuard, effect.tag, effect.alert.alert_id, () => sendPeer(effect.tag, effect.alert, config));
        if (result.duplicate) await appendEventLog({ event_type: "PEER_SEND_DUPLICATE_SKIPPED", alert_id: effect.alert.alert_id, tag: effect.tag });
      } catch { /* failure already logged; guard allows retry */ }
      break;
    }
    case "APPEND_EVENT_LOG":
      await appendServiceEvent(effect.payload);
      break;
    case "START_NEXT":
      if (state.session?.role === ROLE.PRIMARY) {
        await dispatch({ type: "START_NEXT", payload: { timing: timing(config) } });
      } else if (state.session?.role === ROLE.BACKUP) {
        const next = state.queue.nextPending();
        if (next) {
          const dueAt = new Date(next.detected_at).getTime() + timing(config).backup_delay_seconds * 1000;
          if (await isAlertEscalated(next.alert_id) || dueAt <= Date.now()) await dispatch({ type: "TIMER_BACKUP_DELAY", payload: { alert_id: next.alert_id, timing: timing(config) } });
          else await chrome.alarms.create(`aog:backup_delay:${next.alert_id}`, { when: dueAt });
        }
      }
      break;
    default:
      break;
  }
}

// ---------- alerts ----------
async function handleAlert(rawAlert) {
  await recordAlertSourceHealth(rawAlert);
  const config = await getConfig();
  await hydrate();
  if (!state.session) {
    await appendServiceEvent({ event_type: "SKIPPED_NO_SHIFT", source: rawAlert.source, group_name: rawAlert.group_name, subject: rawAlert.subject });
    return;
  }
  if (rawAlert.source === "email" && shouldSkipEmail(rawAlert, config)) {
    await appendServiceEvent({ event_type: "SKIPPED_EMAIL_FILTER", source: rawAlert.source, sender: rawAlert.sender, subject: rawAlert.subject });
    return;
  }
  if (rawAlert.unknown_chat) {
    const kind = classifyChat(rawAlert.group_name, { team: await getKey(K.TEAM_GROUPS, []), personal: config.customer_groups, ignored: config.ignored_chats, coord: config.coord_group });
    if (kind === CHAT_CLASS.IGNORED || kind === CHAT_CLASS.COORD) return;
    const pending = await getKey(K.UNKNOWN_CHATS, []);
    if (!pending.some((item) => isSameGroupName(item.name, rawAlert.group_name))) {
      pending.push({ name: rawAlert.group_name, first_seen: new Date().toISOString() });
      await setKey(K.UNKNOWN_CHATS, pending.slice(-30));
    }
    await appendServiceEvent({ event_type: "UNKNOWN_CHAT", source: rawAlert.source, group_name: rawAlert.group_name });
    if (config.unknown_chat_alert === false) return;
  }
  const resolved = resolveCurrentRole(config);
  if (resolved && state.session.role !== resolved.role) {
    state.session = { ...state.session, role: resolved.role, slot_index: resolved.slot_index };
    await setRoleSession(state.session);
    await dispatch({ type: "ROLE_CHANGED", payload: { role: resolved.role } });
  }
  const alert = { ...rawAlert, alert_id: rawAlert.alert_id ?? deterministicAlertId(rawAlert), detected_at: rawAlert.detected_at ?? new Date().toISOString() };
  const peerHandled = await isAlertPeerHandled(alert.alert_id);
  await dispatch({ type: "ALERT_DETECTED", payload: { alert, within_shift: resolved !== null, peer_handled: peerHandled, timing: timing(config) } });
  if (state.session?.role === ROLE.BACKUP && await isAlertEscalated(alert.alert_id)) {
    await dispatch({ type: "PEER_ESCALATED_RECEIVED", payload: { alert_id: alert.alert_id, source: alert.source, timestamp: alert.detected_at, timing: timing(config) } });
  }
}

async function handlePeerText(text) {
  const parsed = parseTag(text);
  if (!parsed) return;
  await hydrate();
  const config = await getConfig();
  if (parsed.payload.operator && parsed.payload.operator === config.self_display_name && parsed.payload.from_role === state.session?.role) return;
  if (parsed.tag === "ESCALATED") {
    await markAlertEscalated(parsed.payload.alert_id);
    await dispatch({ type: "PEER_ESCALATED_RECEIVED", payload: { ...parsed.payload, timing: timing(config) } });
  } else {
    await markAlertPeerHandled(parsed.payload.alert_id);
    await dispatch({ type: "PEER_HANDLED_RECEIVED", payload: parsed.payload });
  }
}

// ---------- shift ----------
async function writeShiftRow(config, session, { ended = false } = {}) {
  if (!session?.shift_id) return;
  const who = await identity();
  const preflight = await getKey(K.PREFLIGHT, null);
  const role = session.initial_role ?? session.role;
  const fields = shiftRowFields({ session, role, name: config.self_display_name || who.name, email: who.email, ready: preflight ? preflight.ready : null, events: await getEventLog(), ended });
  await queueWrite({ kind: "upsert", list: SP_LISTS.SHIFTS, key_field: "ShiftDate", key_value: shiftDate(session.started_at), fields, shared: true });
}

async function startShift() {
  const config = await getConfig();
  const resolved = resolveCurrentRole(config);
  const initialRole = resolved?.role ?? (config.test_role === ROLE.BACKUP ? ROLE.BACKUP : ROLE.PRIMARY);
  const shift = await startShiftSession({ role: initialRole, config });
  const session = { role: initialRole, initial_role: initialRole, slot_index: resolved?.slot_index ?? null, started_at: shift.started_at, shift_id: shift.shift_id, operator_name: shift.operator_name, partner_name: shift.partner_name };
  await setRoleSession(session);
  await hydrate();
  state.session = session;
  await dispatch({ type: "ROLE_CHANGED", payload: { role: initialRole } });
  await appendServiceEvent({ event_type: "SHIFT_STARTED", role: initialRole, slot_index: resolved?.slot_index ?? null, test_mode: Boolean(config.test_mode) });
  await setKey(K.SOURCE_EVAL, { zeroSince: {}, sources: {} });
  for (const key of Object.keys(await getSystemAlerts())) if (key.startsWith("reminder:")) await clearSystemAlert(key);
  // Fire-and-forget: MUST NOT await (BASELINE_SYNC is processed on this same serialized queue).
  sendRebaselineToTabs();
  await writeShiftRow(config, session);
  syncTeam(config, { forceGroups: true }).then(() => enqueue(() => evaluateSelf()));
}

async function endCurrentShift() {
  await hydrate();
  const config = await getConfig();
  const session = state.session;
  const shiftId = session?.shift_id;
  if (shiftId) await endShiftSession(shiftId);
  await clearShiftBaseline();
  await setRoleSession(null);
  state.session = null;
  await appendServiceEvent({ event_type: "SHIFT_ENDED", shift_id: shiftId ?? null });
  await writeShiftRow(config, session, { ended: true });
  await setKey(K.FOLLOWUPS, []);
  await setKey(K.SYSTEM_ALERTS, {});
  await setKey(K.PREFLIGHT, null);
  await stopAudio();
  await persist();
  if (spConfigured(config)) await syncTeam(config).catch(() => {});
}

// ---------- periodic self-evaluation ----------
async function recordTick(now = Date.now()) {
  const minute = Math.floor(now / 60_000) * 60_000;
  const ticks = await getKey(K.TICKS, []);
  if (ticks.at(-1) !== minute) {
    const cutoff = now - 48 * 3600_000;
    await setKey(K.TICKS, [...ticks.filter((tick) => tick >= cutoff), minute]);
  }
}

async function evaluateSources_(config, now = Date.now()) {
  await hydrateHealth();
  const previous = await getKey(K.SOURCE_EVAL, { zeroSince: {}, sources: {} });
  const rules = { missing_after_ms: 3 * 60_000, blind_after_ms: Math.max(1, Number(config.blind_after_minutes) || 5) * 60_000 };
  const evaluation = evaluateSources(healthRecords, { now, zeroSince: previous.zeroSince, rules });
  await setKey(K.SOURCE_EVAL, evaluation);
  // timeline of status changes (for leak classification)
  const timeline = await getKey(K.SOURCE_TIMELINE, []);
  let changed = false;
  for (const [source, value] of Object.entries(evaluation.sources)) {
    if (previous.sources?.[source]?.status !== value.status) {
      timeline.push({ at: now, source, status: value.status });
      changed = true;
      if (state?.session) await appendServiceEvent({ event_type: "SOURCE_STATUS", source, status: value.status, message: value.message });
    }
  }
  if (changed) await setKey(K.SOURCE_TIMELINE, timeline.filter((item) => item.at >= now - 48 * 3600_000));
  return evaluation;
}

async function evaluateSelf() {
  const config = await getConfig();
  await hydrate();
  const now = Date.now();
  await recordTick(now);
  const evaluation = await evaluateSources_(config, now);
  const problems = problemsOf(evaluation);

  if (state.session) {
    for (const source of ["whatsapp", "outlook"]) {
      const value = evaluation.sources[source];
      const key = `source:${source}`;
      if (value.status === SOURCE_STATUS.OK) { await clearSystemAlert(key); continue; }
      const raised = await raiseSystemAlert(key, { kind: "source", title: value.status === SOURCE_STATUS.BLIND ? "Watcher đang MÙ" : "Nguồn tin có vấn đề", message: value.message });
      if (raised) await sendSignal(SIGNAL.SOURCE_BLIND, { source, payload: { operator: config.self_display_name, message: value.message, status: value.status } });
    }
  }

  // shift reminder
  const reminder = shiftReminderState({ slots: config.shift_slots, now: new Date(now), hasSession: Boolean(state.session), graceMinutes: Number(config.shift_reminder_grace_minutes) || 10 });
  if (reminder.level !== "none" && !config.test_mode) {
    const done = await getKey(K.REMINDER_STATE, {});
    const doneKey = `${reminder.key}:${reminder.level}`;
    if (!done[doneKey]) {
      done[doneKey] = now;
      await setKey(K.REMINDER_STATE, Object.fromEntries(Object.entries(done).slice(-20)));
      if (reminder.level === "nudge") await notify(`reminder-${reminder.key}`, "Tới giờ trực AOG", "Mở popup AOG Watcher và bấm Bắt đầu ca.");
      else {
        await raiseSystemAlert(`reminder:${reminder.key}`, { kind: "shift_reminder", title: "Chưa bắt đầu ca trực", message: `Đã quá ${config.shift_reminder_grace_minutes || 10} phút sau giờ ca. Bấm Bắt đầu ca ngay. Máy kia đã được báo.` });
        await sendSignal(SIGNAL.SHIFT_NOT_STARTED, { payload: { operator: config.self_display_name, night: reminder.key } });
      }
    }
  }

  // follow-ups
  if (state.session) {
    const { followups, actions } = tickFollowups(await getKey(K.FOLLOWUPS, []), { now, answerWithinMinutes: Number(config.followup_answer_minutes) || 5 });
    await setKey(K.FOLLOWUPS, followups);
    for (const action of actions) {
      const item = action.followup;
      if (action.type === "ask") {
        await appendServiceEvent({ event_type: "FOLLOWUP_ASKED", alert_id: item.alert_id, source: item.source, group_name: item.title });
        await raiseSystemAlert(`followup:${item.alert_id}`, { kind: "followup", title: "Đã xử lý xong chưa?", message: `"${item.title}" — bấm Xong hoặc Cần thêm thời gian.`, rearm: true });
      } else {
        await clearSystemAlert(`followup:${item.alert_id}`);
        await appendServiceEvent({ event_type: "FOLLOWUP_OVERDUE", alert_id: item.alert_id, source: item.source, group_name: item.title });
        await raiseSystemAlert(`followup_overdue:${item.alert_id}`, { kind: "followup_overdue", title: "Không trả lời câu hỏi xử lý", message: `"${item.title}" đã ACK nhưng chưa xác nhận xử lý xong. Máy kia đã được báo.` });
        await sendSignal(SIGNAL.FOLLOWUP_OVERDUE, { alertId: item.alert_id, source: item.source, payload: { operator: config.self_display_name, title: item.title } });
      }
    }
  }

  // preflight
  if (state.session) await refreshPreflight(config, evaluation);

  await syncTeam(config, { problems });
  broadcastStatus();
}

async function refreshPreflight(config, evaluation = null) {
  evaluation ??= await getKey(K.SOURCE_EVAL, { sources: {} });
  const sp = await getKey(K.SP_STATUS, {});
  const result = runPreflight({
    config,
    sources: evaluation.sources,
    sharepoint: { configured: spConfigured(config), ok: Boolean(sp.ok), error: sp.error },
    groupsSyncedAt: await getKey(K.TEAM_GROUPS_SYNCED_AT, 0),
    battery: await getKey(K.BATTERY, null),
    soundConfirmedAt: await getKey(K.SOUND_CONFIRMED_AT, 0),
    shiftStartedAt: Date.parse(state?.session?.started_at ?? "") || 0,
    peers: await getKey(K.PEERS, []),
  });
  const previous = await getKey(K.PREFLIGHT, null);
  await setKey(K.PREFLIGHT, result);
  if (state?.session && previous?.ready !== result.ready) {
    await appendServiceEvent({ event_type: "PREFLIGHT", ready: result.ready, failed: result.failed.join(",") });
    await writeShiftRow(config, state.session);
  }
  return result;
}

// ---------- operator actions ----------
async function decideUnknownChat(name, decision) {
  const config = await getConfig();
  let next = { ...config };
  let note = "";
  if (decision === "team") {
    if (spConfigured(config)) {
      await setKey(K.TEAM_GROUPS, addName(await getKey(K.TEAM_GROUPS, []), name));
      await queueWrite({ kind: "group", name, by: config.self_display_name });
      flushOutbox(config).catch(() => {});
      note = "Đã thêm vào danh sách chung trên SharePoint";
    } else {
      next.customer_groups = addName(config.customer_groups, name);
      note = "Chưa nối SharePoint — tạm thêm cho máy này";
    }
  } else if (decision === "ignore") {
    next.ignored_chats = addName(config.ignored_chats, name);
    next.customer_groups = removeName(config.customer_groups, name);
    note = "Máy này sẽ không reo cho chat này nữa";
  } else return { ok: false, error: "Quyết định không hợp lệ" };
  await setConfig(next);
  await setKey(K.UNKNOWN_CHATS, (await getKey(K.UNKNOWN_CHATS, [])).filter((item) => !isSameGroupName(item.name, name)));
  await appendServiceEvent({ event_type: "UNKNOWN_CHAT_DECISION", group_name: name, decision });
  return { ok: true, note };
}

async function reportLeak({ source, what, at }) {
  await hydrate();
  const time = Date.parse(at) || Date.now();
  const sessions = await getShiftSessions();
  const shiftActive = sessions.some((session) => Date.parse(session.started_at) <= time && (!session.ended_at || Date.parse(session.ended_at) >= time));
  const timeline = (await getKey(K.SOURCE_TIMELINE, [])).filter((item) => item.source === (source === "email" ? "outlook" : source) && item.at <= time);
  const sourceStatus = timeline.at(-1)?.status ?? "ok";
  const verdict = classifyMiss({ kind: "leak", shiftActive, sourceStatus, machineOffline: wasOfflineAt(await getKey(K.TICKS, []), time) });
  await appendServiceEvent({ event_type: "LEAK_REPORTED", source, group_name: source === "whatsapp" ? what : "", subject: source === "whatsapp" ? "" : what, reported_for: new Date(time).toISOString(), miss_cause: verdict.cause, miss_reason: verdict.reason });
  return { ok: true, cause: verdict.cause, reason: verdict.reason };
}

// ---------- status ----------
async function status() {
  await hydrate();
  await hydrateHealth();
  const config = await getConfig();
  const resolved = resolveCurrentRole(config);
  const evaluation = await getKey(K.SOURCE_EVAL, { sources: {} });
  const team = await getKey(K.TEAM_GROUPS, []);
  return {
    version: APP_VERSION,
    app_state: state.app_state,
    current_alert: state.current_alert,
    pending_count: state.queue.countPending(),
    session: state.session,
    within_shift: currentWithinShift(config),
    current_role: resolved?.role ?? null,
    current_slot_index: resolved?.slot_index ?? null,
    role_source: resolved?.source ?? null,
    shift_slots: config.shift_slots ?? [],
    test_mode: Boolean(config.test_mode),
    test_role: config.test_role ?? ROLE.PRIMARY,
    dry_run: Boolean(config.dry_run),
    health: healthRecords,
    sources: evaluation.sources ?? {},
    preflight: await getKey(K.PREFLIGHT, null),
    sharepoint: { ...(await getKey(K.SP_STATUS, {})), configured: spConfigured(config) },
    identity: await identity(),
    peers: await getKey(K.PEERS, []),
    system_alerts: Object.values(await getSystemAlerts()),
    unknown_chats: await getKey(K.UNKNOWN_CHATS, []),
    followups: await getKey(K.FOLLOWUPS, []),
    outbox_size: (await getKey(K.OUTBOX, [])).length,
    groups: { team: team.length, personal: (config.customer_groups ?? []).length, ignored: (config.ignored_chats ?? []).length, effective: effectiveGroups({ team, personal: config.customer_groups, ignored: config.ignored_chats, coord: config.coord_group }).length },
    recent_events: (await getEventLog()).slice(-6),
  };
}
function broadcastStatus() {
  status().then((payload) => chrome.runtime.sendMessage({ type: MESSAGE.STATUS_UPDATED, payload }).catch(() => {})).catch(() => {});
}

// ---------- wiring ----------
function ensureTickAlarm() { chrome.alarms.create(TICK_ALARM, { periodInMinutes: 0.5, delayInMinutes: 0.1 }); }

chrome.runtime.onInstalled.addListener(() => enqueue(async () => {
  const config = await getConfig();
  await setConfig({ ...DEFAULT_CONFIG, ...config });
  await getMachineId();
  await hydrate();
  await persist();
  ensureTickAlarm();
}));
chrome.runtime.onStartup?.addListener(() => { ensureTickAlarm(); });
ensureTickAlarm();

async function handleMessage(message) {
  switch (message.type) {
    case MESSAGE.ALERT_DETECTED: await handleAlert(message.alert); return {};
    case MESSAGE.PEER_TAG_RECEIVED: await handlePeerText(message.text); return {};
    case MESSAGE.PREVIEW_AUDIO:
    case MESSAGE.TEST_SOUND:
      await playWakeAudio({ wake_audio_mode: message.mode === "escalate" ? "escalate" : (await getConfig()).wake_audio_mode });
      setTimeout(() => enqueue(() => reconcileAudio()), 6000);
      return {};
    case MESSAGE.SOUND_CONFIRMED:
      await setKey(K.SOUND_CONFIRMED_AT, Date.now());
      await hydrate();
      if (state.session) await refreshPreflight(await getConfig());
      return {};
    case MESSAGE.REPORT_BATTERY:
      await setKey(K.BATTERY, { ...message.battery, at: Date.now() });
      return {};
    case MESSAGE.ACK_CURRENT: {
      await hydrate();
      const alert = state.current_alert;
      await dispatch({ type: "ALERT_ACK" });
      const config = await getConfig();
      if (alert && state.current_alert?.alert_id !== alert.alert_id) await writeShiftRow(config, state.session);
      if (alert && state.current_alert?.alert_id !== alert.alert_id && config.followup_enabled) {
        const followups = (await getKey(K.FOLLOWUPS, [])).filter((item) => item.alert_id !== alert.alert_id);
        await setKey(K.FOLLOWUPS, [...followups, createFollowup(alert, { askAfterMinutes: Number(config.followup_after_minutes) || 10 })]);
      }
      return {};
    }
    case MESSAGE.START_SHIFT: await startShift(); return {};
    case MESSAGE.END_SHIFT: await endCurrentShift(); return {};
    case MESSAGE.UPDATE_SHIFT_SLOTS: {
      const config = await getConfig();
      await setConfig({ ...config, shift_slots: message.slots });
      return {};
    }
    case MESSAGE.CONTENT_HEALTH:
      if (message.connected) await recordSourceHealth(message.source, message.stats ?? null);
      return {};
    case MESSAGE.UNKNOWN_CHAT_DECISION: return decideUnknownChat(message.name, message.decision);
    case MESSAGE.SYSTEM_ALERT_ACK: await clearSystemAlert(message.key, { acknowledged: true }); return {};
    case MESSAGE.FOLLOWUP_ANSWER: {
      const config = await getConfig();
      await setKey(K.FOLLOWUPS, answerFollowup(await getKey(K.FOLLOWUPS, []), message.alert_id, message.answer, { snoozeMinutes: Number(config.followup_after_minutes) || 10 }));
      await clearSystemAlert(`followup:${message.alert_id}`);
      if (message.answer === "done") await appendServiceEvent({ event_type: "FOLLOWUP_DONE", alert_id: message.alert_id });
      return {};
    }
    case MESSAGE.REPORT_LEAK: return reportLeak(message);
    case MESSAGE.SP_TEST: {
      const config = await getConfig();
      const client = spClient(message.site_url ? { sharepoint_site_url: message.site_url } : config);
      try {
        const user = await client.currentUser();
        await setKey(K.IDENTITY, user);
        const missing = await checkSchema(client);
        return { ok: true, user, missing, site: client.site };
      } catch (error) { return { ok: false, error: error.message }; }
    }
    case MESSAGE.SP_SETUP: {
      const config = await getConfig();
      const client = spClient(message.site_url ? { sharepoint_site_url: message.site_url } : config);
      try {
        const report = await ensureSchema(client);
        return { ok: true, report };
      } catch (error) { return { ok: false, error: error.message }; }
    }
    case MESSAGE.SYNC_NOW: await evaluateSelf(); return {};
    case MESSAGE.SP_PUBLISH_SETTINGS: {
      const config = await getConfig();
      if (!spConfigured(config)) return { ok: false, error: "Chưa nối SharePoint" };
      try {
        const written = await publishSharedSettings(spClient(config), config, { by: config.self_display_name });
        return { ok: true, written };
      } catch (error) { return { ok: false, error: error.message }; }
    }
    case MESSAGE.SETTINGS_UPDATED: {
      const config = await getConfig();
      if (spConfigured(config)) await syncTeam(config, { forceGroups: true });
      return {};
    }
    default: return {};
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MESSAGE.AUDIO_PLAY || message.type === MESSAGE.AUDIO_STOP || message.type === MESSAGE.STATUS_UPDATED) return false;
  enqueue(async () => {
    if (message.type === MESSAGE.BASELINE_SYNC) { sendResponse(await handleBaselineSync(message)); return; }
    let result = {};
    try { result = await handleMessage(message); } catch (error) { result = { ok: false, error: error.message }; }
    broadcastStatus();
    sendResponse({ ok: true, ...result, status: await status() });
  });
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => enqueue(async () => {
  if (alarm.name === TICK_ALARM) { await evaluateSelf(); return; }
  const match = alarm.name.match(/^aog:(primary_timeout|backup_delay|max_alert_duration):(.+)$/);
  if (!match) return;
  const config = await getConfig();
  const type = { primary_timeout: "TIMER_PRIMARY_TIMEOUT", backup_delay: "TIMER_BACKUP_DELAY", max_alert_duration: "TIMER_MAX_DURATION" }[match[1]];
  await dispatch({ type, payload: { alert_id: match[2], timing: timing(config) } });
}));

chrome.idle?.onStateChanged?.addListener((idleState) => enqueue(async () => {
  if (idleState !== "idle" && idleState !== "locked") return;
  await hydrate();
  if (state.app_state !== APP_STATE.ALERTING || !state.pending_wake || state.pending_wake !== state.current_alert?.alert_id) return;
  const config = await getConfig();
  await playWakeAudio(config);
  state.pending_wake = null;
  await persist();
}));
