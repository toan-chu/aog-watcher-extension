import { DEFAULT_CONFIG, STORAGE_KEYS } from "./constants.js";

function localStorageArea() {
  if (!globalThis.chrome?.storage?.local) throw new Error("chrome.storage.local is unavailable");
  return globalThis.chrome.storage.local;
}

export async function getConfig() {
  const result = await localStorageArea().get(STORAGE_KEYS.CONFIG);
  return { ...DEFAULT_CONFIG, ...(result[STORAGE_KEYS.CONFIG] ?? {}) };
}

export async function setConfig(config) {
  const merged = { ...DEFAULT_CONFIG, ...config };
  await localStorageArea().set({ [STORAGE_KEYS.CONFIG]: merged });
  return merged;
}

export async function getRoleSession() {
  const result = await localStorageArea().get(STORAGE_KEYS.ROLE_SESSION);
  return result[STORAGE_KEYS.ROLE_SESSION] ?? null;
}

export async function setRoleSession(session) {
  await localStorageArea().set({ [STORAGE_KEYS.ROLE_SESSION]: session });
  return session;
}

export async function clearRoleSession() {
  await localStorageArea().set({ [STORAGE_KEYS.ROLE_SESSION]: null });
}

export async function getRuntimeState() {
  const result = await localStorageArea().get(STORAGE_KEYS.RUNTIME_STATE);
  return result[STORAGE_KEYS.RUNTIME_STATE] ?? null;
}

export async function setRuntimeState(state) {
  await localStorageArea().set({ [STORAGE_KEYS.RUNTIME_STATE]: state });
}

export async function getSourceHealth() {
  const result = await localStorageArea().get(STORAGE_KEYS.SOURCE_HEALTH);
  return result[STORAGE_KEYS.SOURCE_HEALTH] ?? {};
}

export async function setSourceHealth(health) {
  await localStorageArea().set({ [STORAGE_KEYS.SOURCE_HEALTH]: health });
}

export async function getShiftBaseline() {
  const result = await localStorageArea().get(STORAGE_KEYS.SHIFT_BASELINE);
  return result[STORAGE_KEYS.SHIFT_BASELINE] ?? null;
}

export async function setShiftBaseline(baseline) {
  await localStorageArea().set({ [STORAGE_KEYS.SHIFT_BASELINE]: baseline });
  return baseline;
}

export async function clearShiftBaseline() {
  await localStorageArea().set({ [STORAGE_KEYS.SHIFT_BASELINE]: null });
}

export async function appendEventLog(record) {
  const result = await localStorageArea().get(STORAGE_KEYS.EVENT_LOG);
  const log = Array.isArray(result[STORAGE_KEYS.EVENT_LOG]) ? result[STORAGE_KEYS.EVENT_LOG] : [];
  log.push({ timestamp: new Date().toISOString(), handled_by: null, ...record });
  const trimmed = log.slice(-5000);
  await localStorageArea().set({ [STORAGE_KEYS.EVENT_LOG]: trimmed });
  return trimmed.at(-1);
}

export async function getShiftSessions() {
  const result = await localStorageArea().get(STORAGE_KEYS.SHIFT_SESSIONS);
  return Array.isArray(result[STORAGE_KEYS.SHIFT_SESSIONS]) ? result[STORAGE_KEYS.SHIFT_SESSIONS] : [];
}

export async function setShiftSessions(sessions) {
  await localStorageArea().set({ [STORAGE_KEYS.SHIFT_SESSIONS]: sessions });
  return sessions;
}

export async function startShiftSession({ role, config, now = new Date() }) {
  const sessions = await getShiftSessions();
  const startedAt = now.toISOString();
  const shiftId = `shift-${startedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 7)}`;
  const session = {
    shift_id: shiftId,
    operator_name: config.self_display_name ?? "",
    partner_name: config.partner_display_name ?? "",
    role,
    started_at: startedAt,
    ended_at: null,
    config_snapshot: {
      customer_groups: config.customer_groups ?? [],
      coord_group: config.coord_group ?? "",
      shift_slots: Array.isArray(config.shift_slots) ? config.shift_slots.map((slot) => ({ ...slot })) : [],
    },
  };
  const updated = [...sessions.map((item) => item.ended_at ? item : { ...item, ended_at: item.ended_at ?? startedAt }), session].slice(-500);
  await setShiftSessions(updated);
  return session;
}

export async function endShiftSession(shiftId, endedAt = new Date().toISOString()) {
  const sessions = await getShiftSessions();
  const updated = sessions.map((session) => session.shift_id === shiftId ? { ...session, ended_at: session.ended_at ?? endedAt } : session);
  await setShiftSessions(updated);
  return updated.find((session) => session.shift_id === shiftId) ?? null;
}

export async function getEventLog({ date } = {}) {
  const result = await localStorageArea().get(STORAGE_KEYS.EVENT_LOG);
  const log = Array.isArray(result[STORAGE_KEYS.EVENT_LOG]) ? result[STORAGE_KEYS.EVENT_LOG] : [];
  return date ? log.filter((record) => String(record.timestamp).slice(0, 10) === date) : log;
}

export async function clearEventLog(beforeDate) {
  const log = await getEventLog();
  const remaining = beforeDate ? log.filter((record) => new Date(record.timestamp) >= new Date(beforeDate)) : [];
  await localStorageArea().set({ [STORAGE_KEYS.EVENT_LOG]: remaining });
}

async function updateIdSet(key, alertId) {
  const result = await localStorageArea().get(key);
  const ids = new Set(result[key] ?? []);
  ids.add(alertId);
  await localStorageArea().set({ [key]: [...ids].slice(-500) });
}

export async function markAlertEscalated(alertId) { await updateIdSet(STORAGE_KEYS.ESCALATED_ALERT_IDS, alertId); }
export async function markAlertPeerHandled(alertId) { await updateIdSet(STORAGE_KEYS.PEER_HANDLED_ALERT_IDS, alertId); }

export async function isAlertEscalated(alertId) {
  const result = await localStorageArea().get(STORAGE_KEYS.ESCALATED_ALERT_IDS);
  return (result[STORAGE_KEYS.ESCALATED_ALERT_IDS] ?? []).includes(alertId);
}

export async function isAlertPeerHandled(alertId) {
  const result = await localStorageArea().get(STORAGE_KEYS.PEER_HANDLED_ALERT_IDS);
  return (result[STORAGE_KEYS.PEER_HANDLED_ALERT_IDS] ?? []).includes(alertId);
}

// 5.0 generic helpers
export async function getKey(key, fallback = null) {
  const result = await localStorageArea().get(key);
  return result[key] ?? fallback;
}

export async function setKey(key, value) {
  await localStorageArea().set({ [key]: value });
  return value;
}

export async function getMachineId() {
  let id = await getKey(STORAGE_KEYS.MACHINE_ID);
  if (!id) {
    id = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await setKey(STORAGE_KEYS.MACHINE_ID, id);
  }
  return id;
}
