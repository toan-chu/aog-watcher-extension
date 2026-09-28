import { SP_FIELDS, SP_LISTS, clampFields, fieldSchemaXml } from "./sp_schema.js";
import { odataString } from "./sharepoint_client.js";
import { normalizeGroupName, uniqueNames } from "./groups.js";

export const SIGNAL = Object.freeze({
  HANDLED: "HANDLED",
  ESCALATED: "ESCALATED",
  SHIFT_NOT_STARTED: "SHIFT_NOT_STARTED",
  FOLLOWUP_OVERDUE: "FOLLOWUP_OVERDUE",
  SOURCE_BLIND: "SOURCE_BLIND",
});

// Create missing lists/columns. Idempotent; safe to run again.
export async function ensureSchema(client, { log = () => {} } = {}) {
  const report = [];
  for (const title of Object.values(SP_LISTS)) {
    if (!(await client.listExists(title))) {
      await client.createList(title);
      report.push(`Tạo bảng ${title}`);
    }
    const existing = new Set(await client.fieldNames(title));
    for (const field of SP_FIELDS[title]) {
      if (existing.has(field.name)) continue;
      await client.createField(title, fieldSchemaXml(field));
      report.push(`Thêm cột ${title}.${field.name}`);
    }
  }
  log(report);
  return report;
}

export async function checkSchema(client) {
  const missing = [];
  for (const title of Object.values(SP_LISTS)) {
    if (!(await client.listExists(title))) { missing.push(title); continue; }
    const existing = new Set(await client.fieldNames(title));
    for (const field of SP_FIELDS[title]) if (!existing.has(field.name)) missing.push(`${title}.${field.name}`);
  }
  return missing;
}

export async function pullTeamGroups(client) {
  const rows = await client.items(SP_LISTS.GROUPS, { select: ["Id", "Title"], orderby: "Title", top: 2000 });
  return uniqueNames(rows.map((row) => row.Title));
}

export async function pushTeamGroup(client, name, { by = "", now = new Date() } = {}) {
  const existing = await client.items(SP_LISTS.GROUPS, { select: ["Id", "Title"], filter: `Title eq ${odataString(name)}`, orderby: "", top: 5 });
  if (existing.some((row) => normalizeGroupName(row.Title) === normalizeGroupName(name))) return { created: false };
  await client.addItem(SP_LISTS.GROUPS, clampFields(SP_LISTS.GROUPS, { Title: name, AddedBy: by, AddedAt: now.toISOString() }));
  return { created: true };
}

export async function pullSignals(client, { sinceId = 0, selfId = "", now = Date.now(), maxAgeMs = 15 * 60_000 } = {}) {
  const rows = await client.items(SP_LISTS.SIGNALS, {
    select: ["Id", "Title", "SignalType", "AlertId", "Source", "FromMachine", "SentAt", "Payload"],
    filter: `Id gt ${Number(sinceId) || 0}`,
    orderby: "Id asc",
    top: 200,
  });
  const lastId = rows.reduce((max, row) => Math.max(max, Number(row.Id) || 0), Number(sinceId) || 0);
  const signals = rows
    .filter((row) => row.FromMachine !== selfId)
    .filter((row) => { const at = Date.parse(row.SentAt ?? ""); return Number.isFinite(at) && Math.abs(now - at) <= maxAgeMs; })
    .map((row) => {
      let payload = {};
      try { payload = row.Payload ? JSON.parse(row.Payload) : {}; } catch { payload = {}; }
      return { id: Number(row.Id), type: row.SignalType, alert_id: row.AlertId, source: row.Source, from: row.FromMachine, sent_at: row.SentAt, payload };
    });
  return { signals, lastId };
}

export function signalFields({ type, alertId = "", source = "", fromMachine, payload = {}, now = new Date() }) {
  return clampFields(SP_LISTS.SIGNALS, { Title: `${type} ${alertId}`.trim(), SignalType: type, AlertId: alertId, Source: source, FromMachine: fromMachine, SentAt: now.toISOString(), Payload: payload });
}

export async function latestSignalId(client) {
  const rows = await client.items(SP_LISTS.SIGNALS, { select: ["Id"], orderby: "Id desc", top: 1 });
  return Number(rows[0]?.Id) || 0;
}

export async function pullMachines(client) {
  return client.items(SP_LISTS.MACHINES, { select: ["Id", "Title", "MachineId", "OperatorName", "Email", "Role", "ShiftId", "Ready", "Problems", "LastBeat", "Version"], orderby: "Id asc", top: 50 });
}

// Find-or-create by a key column, then update. itemIdCache: { [key]: spItemId } persisted by caller.
// shared=true: the row is written by several machines (night shift row) → always resolve the
// OLDEST matching row, so two machines that raced to create it converge on the same row.
export async function upsertByKey(client, list, keyField, keyValue, fields, itemIdCache = {}, { shared = false } = {}) {
  const cacheKey = `${list}:${keyValue}`;
  const clamped = clampFields(list, fields);
  let id = shared ? null : itemIdCache[cacheKey];
  if (!id) {
    const rows = await client.items(list, { select: ["Id"], filter: `${keyField} eq ${odataString(keyValue)}`, orderby: shared ? "Id asc" : "Id desc", top: 1 });
    id = rows[0]?.Id;
  }
  if (id) {
    try {
      await client.updateItem(list, id, clamped);
      return { id, cache: { ...itemIdCache, [cacheKey]: id } };
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
  const created = await client.addItem(list, clamped);
  const newId = created?.Id ?? created?.ID ?? created?.d?.Id;
  return { id: newId, cache: newId ? { ...itemIdCache, [cacheKey]: newId } : itemIdCache };
}

// Execute one outbox op. Returns updated id cache.
export async function executeOp(client, op, itemIdCache = {}) {
  switch (op.kind) {
    case "add":
      await client.addItem(op.list, clampFields(op.list, op.fields));
      return itemIdCache;
    case "upsert": {
      const result = await upsertByKey(client, op.list, op.key_field, op.key_value, op.fields, itemIdCache, { shared: Boolean(op.shared) });
      return result.cache;
    }
    case "group":
      await pushTeamGroup(client, op.name, { by: op.by, now: new Date(op.created_at ?? Date.now()) });
      return itemIdCache;
    default:
      throw new Error(`Unknown outbox op ${op.kind}`);
  }
}

// Map a local event record to an AOG_Events row.
export const BLACKBOX_EVENTS = new Set([
  "SHIFT_STARTED", "SHIFT_ENDED", "DETECTED", "ALERTING", "ACK", "PEER_HANDLED", "PEER_ESCALATED_SENT", "PEER_ESCALATED_RECEIVED",
  "MISSED", "LEAK_REPORTED", "UNKNOWN_CHAT", "UNKNOWN_CHAT_DECISION", "SYSTEM_ALERT", "SYSTEM_ALERT_ACK", "PREFLIGHT",
  "FOLLOWUP_ASKED", "FOLLOWUP_DONE", "FOLLOWUP_OVERDUE", "SOURCE_STATUS", "SKIPPED_NO_SHIFT", "WAKE_SUPPRESSED_FOCUSED", "WAKE_DEFERRED_ACTIVE",
]);

export function eventFields(record, { machineId = "", email = "" } = {}) {
  const known = new Set(["event_type", "timestamp", "shift_id", "alert_id", "source", "group_name", "subject", "sender", "role", "operator_name", "response_time_ms", "miss_cause"]);
  const detail = Object.fromEntries(Object.entries(record).filter(([key, value]) => !known.has(key) && value !== null && value !== undefined && value !== ""));
  return clampFields(SP_LISTS.EVENTS, {
    Title: record.event_type,
    EventType: record.event_type,
    At: record.timestamp,
    ShiftId: record.shift_id ?? "",
    AlertId: record.alert_id ?? "",
    Source: record.source ?? "",
    GroupOrSubject: record.group_name || record.subject || "",
    Sender: record.sender ?? "",
    Role: record.role ?? "",
    OperatorName: record.operator_name ?? "",
    Email: email,
    MachineId: machineId,
    ResponseSeconds: Number.isFinite(record.response_time_ms) ? String(Math.round(record.response_time_ms / 1000)) : "",
    MissCause: record.miss_cause ?? "",
    Detail: Object.keys(detail).length ? detail : "",
  });
}
