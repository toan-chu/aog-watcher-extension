import { RECORD_TYPE, SP_FIELDS, SP_LISTS, clampFields, fieldSchemaXml } from "./sp_schema.js";
import { odataString } from "./sharepoint_client.js";
import { normalizeGroupName, uniqueNames } from "./groups.js";

export const SIGNAL = Object.freeze({
  HANDLED: "HANDLED",
  ESCALATED: "ESCALATED",
  SHIFT_NOT_STARTED: "SHIFT_NOT_STARTED",
  FOLLOWUP_OVERDUE: "FOLLOWUP_OVERDUE",
  SOURCE_BLIND: "SOURCE_BLIND",
});

// Create missing lists/columns. Idempotent; safe to run again. Never deletes anything.
export async function ensureSchema(client, { log = () => {} } = {}) {
  const report = [];
  for (const title of Object.values(SP_LISTS)) {
    if (!(await client.listExists(title))) {
      await client.createList(title);
      report.push(`Created list ${title}`);
    }
    const existing = new Set(await client.fieldNames(title));
    for (const field of SP_FIELDS[title]) {
      if (existing.has(field.name)) continue;
      await client.createField(title, fieldSchemaXml(field));
      report.push(`Added column ${title}.${field.name}`);
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

// ---------- groups ----------
const isInactive = (value) => value === false || value === 0 || value === "0" || String(value).toLowerCase() === "false" || String(value).toLowerCase() === "no";

// Only the chat name (Title) is required. A row with Active = No is skipped; a list without
// an Active column still works (every row counts as active).
export async function pullTeamGroups(client) {
  let rows;
  try {
    rows = await client.items(SP_LISTS.GROUPS, { select: ["Id", "Title", "Active"], orderby: "Title", top: 2000 });
  } catch (error) {
    if (error.status !== 400) throw error;
    rows = await client.items(SP_LISTS.GROUPS, { select: ["Id", "Title"], orderby: "Title", top: 2000 });
  }
  return uniqueNames(rows.filter((row) => !isInactive(row.Active)).map((row) => row.Title));
}

export async function pushTeamGroup(client, name, { by = "", now = new Date() } = {}) {
  const existing = await client.items(SP_LISTS.GROUPS, { select: ["Id", "Title"], filter: `Title eq ${odataString(name)}`, orderby: "", top: 5 });
  if (existing.some((row) => normalizeGroupName(row.Title) === normalizeGroupName(name))) return { created: false };
  await client.addItem(SP_LISTS.GROUPS, clampFields(SP_LISTS.GROUPS, { Title: name, AddedBy: by, AddedAt: now.toISOString() }));
  return { created: true };
}

// ---------- AOG_Log: signals between machines ----------
export function signalFields({ type, alertId = "", source = "", fromMachine, payload = {}, now = new Date() }) {
  return clampFields(SP_LISTS.LOG, {
    Title: `${type} ${alertId}`.trim(), RecordType: RECORD_TYPE.SIGNAL, EventType: type, AlertId: alertId, Source: source,
    MachineId: fromMachine, At: now.toISOString(), Detail: payload,
  });
}

export async function pullSignals(client, { sinceId = 0, selfId = "", now = Date.now(), maxAgeMs = 15 * 60_000 } = {}) {
  const rows = await client.items(SP_LISTS.LOG, {
    select: ["Id", "RecordType", "EventType", "AlertId", "Source", "MachineId", "At", "Detail"],
    filter: `RecordType eq ${odataString(RECORD_TYPE.SIGNAL)} and Id gt ${Number(sinceId) || 0}`,
    orderby: "Id asc",
    top: 200,
  });
  const lastId = rows.reduce((max, row) => Math.max(max, Number(row.Id) || 0), Number(sinceId) || 0);
  const signals = rows
    .filter((row) => row.MachineId !== selfId)
    .filter((row) => { const at = Date.parse(row.At ?? ""); return Number.isFinite(at) && Math.abs(now - at) <= maxAgeMs; })
    .map((row) => {
      let payload = {};
      try { payload = row.Detail ? JSON.parse(row.Detail) : {}; } catch { payload = {}; }
      return { id: Number(row.Id), type: row.EventType, alert_id: row.AlertId, source: row.Source, from: row.MachineId, sent_at: row.At, payload };
    });
  return { signals, lastId };
}

// Newest row id of any kind: a safe starting cursor for signals.
export async function latestSignalId(client) {
  const rows = await client.items(SP_LISTS.LOG, { select: ["Id"], orderby: "Id desc", top: 1 });
  return Number(rows[0]?.Id) || 0;
}

// ---------- AOG_Log: machine heartbeat (one row per machine, updated in place) ----------
export function machineLogFields(machine) {
  return {
    Title: machine.Title, RecordType: RECORD_TYPE.MACHINE, EventType: "HEARTBEAT", MachineId: machine.MachineId,
    OperatorName: machine.OperatorName, Email: machine.Email, Role: machine.Role, ShiftId: machine.ShiftId,
    Ready: machine.Ready, Version: machine.Version, At: machine.LastBeat, Detail: machine.Problems,
  };
}

export async function upsertMachine(client, machine, itemIdCache = {}) {
  return upsertByMatch(client, SP_LISTS.LOG, { RecordType: RECORD_TYPE.MACHINE, MachineId: machine.MachineId }, machineLogFields(machine), itemIdCache);
}

// Returns rows in the shape lib/heartbeat.js expects.
export async function pullMachines(client) {
  const rows = await client.items(SP_LISTS.LOG, {
    select: ["Id", "MachineId", "OperatorName", "Email", "Role", "ShiftId", "Ready", "At", "Detail", "Version"],
    filter: `RecordType eq ${odataString(RECORD_TYPE.MACHINE)}`,
    orderby: "Id asc",
    top: 50,
  });
  return rows.map((row) => ({
    MachineId: row.MachineId, OperatorName: row.OperatorName, Email: row.Email, Role: row.Role, ShiftId: row.ShiftId,
    Ready: row.Ready, Problems: row.Detail, LastBeat: row.At, Version: row.Version,
  }));
}

// ---------- upsert ----------
// Find the row whose columns equal `match`, then update it; create it when none exists.
// itemIdCache: { [key]: spItemId } persisted by the caller, so later updates skip the lookup.
// fallbackMatch + claimField: when nothing matches `match`, adopt the oldest row that equals
// fallbackMatch and whose claimField is still empty (a row scheduled by name, not yet claimed).
const matchFilter = (match) => Object.entries(match).map(([key, value]) => `${key} eq ${odataString(value)}`).join(" and ");

export async function upsertByMatch(client, list, match, fields, itemIdCache = {}, { fallbackMatch = null, claimField = "", createFields = {} } = {}) {
  const cacheKey = `${list}:${Object.values(match).join("|")}`;
  const clamped = clampFields(list, fields);
  let id = itemIdCache[cacheKey];
  if (!id) {
    const rows = await client.items(list, { select: ["Id"], filter: matchFilter(match), orderby: "Id asc", top: 1 });
    id = rows[0]?.Id;
  }
  if (!id && fallbackMatch && claimField) {
    const rows = await client.items(list, { select: ["Id", claimField], filter: matchFilter(fallbackMatch), orderby: "Id asc", top: 20 });
    id = rows.find((row) => !String(row[claimField] ?? "").trim())?.Id;
  }
  if (id) {
    try {
      await client.updateItem(list, id, clamped);
      return { id, cache: { ...itemIdCache, [cacheKey]: id } };
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
  const created = await client.addItem(list, clampFields(list, { ...match, ...fields, ...createFields }));
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
      const result = await upsertByMatch(client, op.list, op.match, op.fields, itemIdCache, {
        fallbackMatch: op.fallback_match ?? null,
        claimField: op.claim_field ?? "",
        createFields: op.create_fields ?? {},
      });
      return result.cache;
    }
    // Update one known row and never create one (payroll counts on the person's own roster row).
    // A row deleted meanwhile is dropped quietly.
    case "update":
      try { await client.updateItem(op.list, op.id, clampFields(op.list, op.fields)); }
      catch (error) { if (error.status !== 404) throw error; }
      return itemIdCache;
    case "group":
      await pushTeamGroup(client, op.name, { by: op.by, now: new Date(op.created_at ?? Date.now()) });
      return itemIdCache;
    default:
      throw new Error(`Unknown outbox op ${op.kind}`);
  }
}

// ---------- AOG_Log: black box events ----------
// Only what is needed to find and fix a problem goes to SharePoint; everything else stays in the local log.
export const BLACKBOX_EVENTS = new Set([
  "SHIFT_STARTED", "SHIFT_ENDED", "DETECTED", "ACCEPT", "MISSED", "PEER_ESCALATED_SENT", "PEER_ESCALATED_RECEIVED",
  "LEAK_REPORTED", "SYSTEM_ALERT", "SOURCE_STATUS", "MUTE_CHANGED",
]);
// Written even without a running shift: the end of the shift itself, and a missed message reported afterwards.
export const OFF_SHIFT_BLACKBOX_EVENTS = new Set(["SHIFT_ENDED", "LEAK_REPORTED"]);

export function eventFields(record, { machineId = "", email = "" } = {}) {
  const known = new Set(["event_type", "timestamp", "shift_id", "alert_id", "source", "group_name", "subject", "sender", "role", "operator_name", "response_time_ms", "miss_cause"]);
  const detail = Object.fromEntries(Object.entries(record).filter(([key, value]) => !known.has(key) && value !== null && value !== undefined && value !== ""));
  return clampFields(SP_LISTS.LOG, {
    Title: record.event_type,
    RecordType: RECORD_TYPE.EVENT,
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

// ---------- AOG_Log: housekeeping ----------
// Remove rows older than keepDays, oldest first, at most `batch` per call. Rows go to the site
// recycle bin. Stops at the first row that is still young enough: rows are created in time order.
// A live machine row is old by Id but fresh by At, so it is stepped over, not removed.
export async function purgeOldLog(client, { keepDays = 90, now = Date.now(), batch = 100 } = {}) {
  const days = Number(keepDays);
  if (!Number.isFinite(days) || days <= 0) return 0;
  const cutoff = now - days * 86_400_000;
  const rows = await client.items(SP_LISTS.LOG, { select: ["Id", "At", "RecordType"], orderby: "Id asc", top: batch });
  let removed = 0;
  for (const row of rows) {
    const at = Date.parse(row.At ?? "");
    if (Number.isFinite(at) && at < cutoff) { await client.recycleItem(SP_LISTS.LOG, row.Id); removed += 1; continue; }
    if (row.RecordType === RECORD_TYPE.MACHINE) continue;
    break;
  }
  return removed;
}
