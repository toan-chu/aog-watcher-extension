import { APP_STATE, DEFAULT_CONFIG, MESSAGE, ROLE } from "./lib/constants.js";
import { deterministicAlertId } from "./lib/hash.js";
import { shouldSkipEmail } from "./lib/filter.js";
import { resolveRoleAtTime, isWithinAnySlot } from "./lib/shift_engine.js";
import { enrichEventRecord } from "./lib/event_log.js";
import { reduce } from "./lib/state_machine.js";
import { hydrateRuntimeState, serializeRuntimeState } from "./lib/runtime_state.js";
import { parseTag, serializeTag } from "./lib/peer_protocol.js";
import { dispatchPeerOnce, PeerDispatchGuard } from "./lib/peer_dispatch_guard.js";
import { deriveHealth, markAlertSourceSeen, markSourceSeen } from "./lib/source_health.js";
import {
  appendEventLog,
  clearShiftBaseline,
  getConfig,
  getRoleSession,
  getRuntimeState,
  getEventLog,
  getShiftBaseline,
  getSourceHealth,
  endShiftSession,
  isAlertEscalated,
  isAlertPeerHandled,
  markAlertEscalated,
  markAlertPeerHandled,
  setConfig,
  setRoleSession,
  setShiftBaseline,
  startShiftSession,
  setRuntimeState,
  setSourceHealth,
} from "./lib/storage.js";

let state = null;
let operation = Promise.resolve();
const peerDispatchGuard = new PeerDispatchGuard();
let healthRecords = null;

function timing(config) {
  return {
    primary_timeout_seconds: Number(config.primary_timeout_seconds) || 120,
    backup_delay_seconds: Number(config.backup_delay_seconds) || 180,
    max_alert_duration_seconds: Number(config.max_alert_duration_seconds) || 540,
  };
}

// Resolve role for this dispatch. Priority:
// 1. Test mode → config.test_role (forces role, bypasses slots).
// 2. Slot covering `now` → that slot's role.
// 3. No slot matches → null (alert will be skipped as out_of_shift).
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
  if (config.test_mode) return true;
  return isWithinAnySlot(now, config.shift_slots);
}

async function hydrate() {
  if (state) return state;
  const [stored, session] = await Promise.all([getRuntimeState(), getRoleSession()]);
  state = hydrateRuntimeState(stored, session);
  return state;
}

async function hydrateHealth() {
  healthRecords ??= await getSourceHealth();
  return healthRecords;
}

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

async function persist() {
  await setRuntimeState(serializeRuntimeState(state));
  broadcastStatus();
}

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

async function ensureOffscreen() {
  const url = chrome.runtime.getURL("offscreen.html");
  const contexts = chrome.runtime.getContexts ? await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [url] }) : [];
  if (contexts.length === 0) await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["AUDIO_PLAYBACK"], justification: "Play escalating wake alarm while an AOG alert is active." });
}

async function clearTimers(name, alertId) {
  const alarms = await chrome.alarms.getAll();
  const prefix = `aog:${name}:`;
  await Promise.all(alarms.filter((alarm) => alarm.name.startsWith(prefix) && (!alertId || alarm.name === `${prefix}${alertId}`)).map((alarm) => chrome.alarms.clear(alarm.name)));
}

async function sendPeerText(text) {
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

function baselineFromSnapshot(shiftId, snapshot = {}) {
  return {
    shift_id: shiftId,
    created_at: new Date().toISOString(),
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
  const targets = [
    "https://web.whatsapp.com/*",
    "https://outlook.office.com/*",
    "https://outlook.office365.com/*",
    "https://outlook.live.com/*",
    "https://outlook.cloud.microsoft/*",
  ];
  const tabs = await chrome.tabs.query({ url: targets });
  await Promise.all(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: MESSAGE.REBASELINE }).catch(() => {})));
}

async function appendServiceEvent(record) {
  const config = await getConfig();
  const eventRecord = { ...record, timestamp: record.timestamp ?? new Date().toISOString() };
  const detectedById = new Map();
  if (eventRecord.event_type === "ACK" && eventRecord.alert_id && eventRecord.response_time_ms === undefined) {
    for (const event of await getEventLog()) {
      if (event.event_type === "DETECTED" && event.alert_id === eventRecord.alert_id) detectedById.set(event.alert_id, event.timestamp);
    }
  }
  const enriched = enrichEventRecord(eventRecord, { session: state?.session, config, detectedById });
  await appendEventLog(enriched);
}

async function executeEffect(effect) {
  const config = await getConfig();
  switch (effect.type) {
    case "START_WAKE":
      if (config.dry_run) {
        await appendServiceEvent({ event_type: "DRY_RUN_WOULD_WAKE", alert_id: effect.alert.alert_id, source: effect.alert.source, group_name: effect.alert.group_name, sender: effect.alert.sender, subject: effect.alert.subject });
        break;
      }
      await ensureOffscreen();
      await chrome.runtime.sendMessage({ type: MESSAGE.AUDIO_PLAY }).catch(() => {});
      await chrome.notifications.create(`aog-${effect.alert.alert_id}`, { type: "basic", iconUrl: "assets/icon128.png", title: "AOG alert", message: effect.alert.group_name || effect.alert.subject || "New eligible alert", priority: 2 }).catch(() => {});
      break;
    case "STOP_WAKE":
      await chrome.runtime.sendMessage({ type: MESSAGE.AUDIO_STOP }).catch(() => {});
      break;
    case "SCHEDULE_TIMER":
      await chrome.alarms.create(`aog:${effect.name}:${effect.alert_id}`, { when: Date.now() + Math.max(1000, effect.delay_ms) });
      break;
    case "CANCEL_TIMER":
      await clearTimers(effect.name, effect.alert_id);
      break;
    case "SEND_PEER_TAG": {
      const payload = {
        alert_id: effect.alert.alert_id,
        source: effect.alert.source,
        timestamp: new Date().toISOString(),
        from_role: state.session?.role,
        operator: config.self_display_name,
        group: effect.alert.group_name,
        unread_count: effect.alert.unread_count,
        sender: effect.alert.sender,
        subject: effect.alert.subject,
      };
      if (config.dry_run) {
        await appendServiceEvent({ event_type: "DRY_RUN_WOULD_SEND_TAG", alert_id: effect.alert.alert_id, source: effect.alert.source, tag: effect.tag, peer_text: serializeTag(effect.tag, payload) });
        break;
      }
      try {
        const result = await dispatchPeerOnce(peerDispatchGuard, effect.tag, effect.alert.alert_id, () => sendPeerText(serializeTag(effect.tag, payload)));
        if (result.duplicate) await appendEventLog({ event_type: "PEER_SEND_DUPLICATE_SKIPPED", alert_id: effect.alert.alert_id, tag: effect.tag });
      } catch {
        // sendPeerText records the failure; the guard releases the key so a later attempt can retry.
      }
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
          if (await isAlertEscalated(next.alert_id) || dueAt <= Date.now()) {
            await dispatch({ type: "TIMER_BACKUP_DELAY", payload: { alert_id: next.alert_id, timing: timing(config) } });
          } else {
            await chrome.alarms.create(`aog:backup_delay:${next.alert_id}`, { when: dueAt });
          }
        }
      }
      break;
    default:
      break;
  }
}

async function handleAlert(rawAlert) {
  await recordAlertSourceHealth(rawAlert);
  const config = await getConfig();
  await hydrate();
  if (!state.session) {
    await appendServiceEvent({ event_type: "SKIPPED_NO_SHIFT", source: rawAlert.source });
    return;
  }
  if (rawAlert.source === "email" && shouldSkipEmail(rawAlert, config)) {
    await appendServiceEvent({ event_type: "SKIPPED_EMAIL_FILTER", source: rawAlert.source, sender: rawAlert.sender, subject: rawAlert.subject });
    return;
  }
  const resolved = resolveCurrentRole(config);
  const withinShift = resolved !== null;
  if (resolved && state.session.role !== resolved.role) {
    state.session = { ...state.session, role: resolved.role, slot_index: resolved.slot_index };
    await setRoleSession(state.session);
    await dispatch({ type: "ROLE_CHANGED", payload: { role: resolved.role } });
  }
  const alert = { ...rawAlert, alert_id: deterministicAlertId(rawAlert), detected_at: rawAlert.detected_at ?? new Date().toISOString() };
  const peerHandled = await isAlertPeerHandled(alert.alert_id);
  await dispatch({ type: "ALERT_DETECTED", payload: { alert, within_shift: withinShift, peer_handled: peerHandled, timing: timing(config) } });
  if (state.session?.role === ROLE.BACKUP && await isAlertEscalated(alert.alert_id)) {
    await dispatch({ type: "PEER_ESCALATED_RECEIVED", payload: { alert_id: alert.alert_id, source: alert.source, timestamp: alert.detected_at, timing: timing(config) } });
  }
}

async function endCurrentShift() {
  await hydrate();
  const shiftId = state.session?.shift_id;
  if (shiftId) await endShiftSession(shiftId);
  await clearShiftBaseline();
  await setRoleSession(null);
  state.session = null;
  await appendServiceEvent({ event_type: "SHIFT_ENDED", shift_id: shiftId ?? null });
  await persist();
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

async function status() {
  await hydrate();
  await hydrateHealth();
  const config = await getConfig();
  const recentEvents = (await getEventLog()).slice(-5);
  const resolved = resolveCurrentRole(config);
  return {
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
    health: deriveHealth(healthRecords),
    dry_run: Boolean(config.dry_run),
    recent_events: recentEvents,
  };
}

function broadcastStatus() {
  status().then((payload) => chrome.runtime.sendMessage({ type: MESSAGE.STATUS_UPDATED, payload }).catch(() => {}));
}

chrome.runtime.onInstalled.addListener(() => enqueue(async () => {
  const config = await getConfig();
  await setConfig({ ...DEFAULT_CONFIG, ...config });
  await hydrate();
  await persist();
}));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MESSAGE.AUDIO_PLAY || message.type === MESSAGE.AUDIO_STOP || message.type === MESSAGE.STATUS_UPDATED) return false;
  enqueue(async () => {
    if (message.type === MESSAGE.ALERT_DETECTED) await handleAlert(message.alert);
    else if (message.type === MESSAGE.BASELINE_SYNC) sendResponse(await handleBaselineSync(message));
    else if (message.type === MESSAGE.PEER_TAG_RECEIVED) await handlePeerText(message.text);
    else if (message.type === MESSAGE.ACK_CURRENT) await dispatch({ type: "ALERT_ACK" });
    else if (message.type === MESSAGE.START_SHIFT) {
      const config = await getConfig();
      const resolved = resolveCurrentRole(config);
      const initialRole = resolved?.role ?? (config.test_role === ROLE.BACKUP ? ROLE.BACKUP : ROLE.PRIMARY);
      const shift = await startShiftSession({ role: initialRole, config });
      const session = { role: initialRole, slot_index: resolved?.slot_index ?? null, started_at: shift.started_at, shift_id: shift.shift_id, operator_name: shift.operator_name, partner_name: shift.partner_name };
      await setRoleSession(session);
      await hydrate();
      state.session = session;
      await dispatch({ type: "ROLE_CHANGED", payload: { role: initialRole } });
      await appendServiceEvent({ event_type: "SHIFT_STARTED", role: initialRole, slot_index: resolved?.slot_index ?? null, test_mode: Boolean(config.test_mode) });
      await sendRebaselineToTabs();
    } else if (message.type === MESSAGE.UPDATE_SHIFT_SLOTS) {
      const config = await getConfig();
      await setConfig({ ...config, shift_slots: message.slots });
      broadcastStatus();
    } else if (message.type === MESSAGE.END_SHIFT) {
      await endCurrentShift();
    } else if (message.type === MESSAGE.CONTENT_HEALTH) {
      if (message.connected) await recordSourceHealth(message.source, message.stats ?? null);
      broadcastStatus();
    } else if (message.type === MESSAGE.SETTINGS_UPDATED) broadcastStatus();
    if (message.type !== MESSAGE.BASELINE_SYNC) sendResponse({ ok: true, status: await status() });
  });
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => enqueue(async () => {
  const match = alarm.name.match(/^aog:(primary_timeout|backup_delay|max_alert_duration):(.+)$/);
  if (!match) return;
  const config = await getConfig();
  const type = { primary_timeout: "TIMER_PRIMARY_TIMEOUT", backup_delay: "TIMER_BACKUP_DELAY", max_alert_duration: "TIMER_MAX_DURATION" }[match[1]];
  await dispatch({ type, payload: { alert_id: match[2], timing: timing(config) } });
}));
