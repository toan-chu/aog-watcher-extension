import { describe, expect, it } from "vitest";
import { createSharePointClient, normalizeSiteUrl, odataString } from "../lib/sharepoint_client.js";
import { RECORD_TYPE, SP_FIELDS, SP_LISTS, clampFields, fieldSchemaXml } from "../lib/sp_schema.js";
import { ensureSchema, eventFields, executeOp, pullMachines, pullSignals, pullTeamGroups, purgeOldLog, pushTeamGroup, signalFields, upsertMachine } from "../lib/team_sync.js";

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, init });
    for (const [pattern, handler] of routes) {
      if (pattern.test(`${init.method ?? "GET"} ${url}`)) {
        const result = typeof handler === "function" ? handler(url, init) : handler;
        const status = result.status ?? 200;
        const body = result.body === undefined ? "" : JSON.stringify(result.body);
        return { ok: status >= 200 && status < 300, status, url, redirected: false, text: async () => body, json: async () => JSON.parse(body) };
      }
    }
    return { ok: false, status: 404, url, text: async () => "not found", json: async () => ({}) };
  };
  return { impl, calls };
}

const SITE = "https://acme.sharepoint.com/sites/AOG";

describe("sharepoint client", () => {
  it("normalizes pasted site links and rejects non-SharePoint hosts", () => {
    expect(normalizeSiteUrl("https://acme.sharepoint.com/sites/AOG/Lists/AOG_Groups/AllItems.aspx")).toBe(SITE);
    expect(normalizeSiteUrl("https://evil.example.com/sites/AOG")).toBe("");
    expect(normalizeSiteUrl("http://acme.sharepoint.com/sites/AOG")).toBe("");
    expect(odataString("O'Neil")).toBe("'O''Neil'");
  });

  it("uses browser cookies and a request digest for writes", async () => {
    const { impl, calls } = fakeFetch([
      [/POST .*_api\/contextinfo/, { body: { FormDigestValue: "digest-1", FormDigestTimeoutSeconds: 1800 } }],
      [/POST .*items$/, { status: 201, body: { Id: 7 } }],
    ]);
    const client = createSharePointClient({ siteUrl: SITE, fetchImpl: impl });
    const created = await client.addItem(SP_LISTS.LOG, { Title: "ACCEPT" });
    expect(created.Id).toBe(7);
    const write = calls.find((call) => call.url.endsWith("/items"));
    expect(write.init.credentials).toBe("include");
    expect(write.init.headers["X-RequestDigest"]).toBe("digest-1");
    expect(write.url).toBe(`${SITE}/_api/web/lists/getbytitle('AOG_Log')/items`);
  });

  it("turns a login redirect / 403 into a clear English error", async () => {
    const { impl } = fakeFetch([[/GET .*currentuser/, { status: 403, body: {} }]]);
    const client = createSharePointClient({ siteUrl: SITE, fetchImpl: impl });
    await expect(client.currentUser()).rejects.toThrow(/SharePoint denied access/);
  });

  it("refuses to run without a valid site", async () => {
    const client = createSharePointClient({ siteUrl: "", fetchImpl: async () => { throw new Error("should not fetch"); } });
    await expect(client.items("X")).rejects.toThrow(/not configured/);
  });
});

function memoryClient(initial = {}, { columns = null } = {}) {
  const lists = new Map(Object.entries(initial));
  let nextId = 100;
  const fields = new Map();
  return {
    lists,
    recycled: [],
    async listExists(title) { return lists.has(title); },
    async createList(title) { lists.set(title, []); },
    async fieldNames(title) { return [...(fields.get(title) ?? [])]; },
    async createField(title, xml) { const name = xml.match(/Name='([^']+)'/)[1]; fields.set(title, new Set([...(fields.get(title) ?? []), name])); },
    async items(title, { select = [], filter = "", orderby = "", top = 100 } = {}) {
      // A real list answers 400 when $select names a column it does not have.
      if (columns && select.some((name) => !columns.includes(name))) throw Object.assign(new Error("SharePoint error 400"), { status: 400 });
      let rows = [...(lists.get(title) ?? [])];
      for (const clause of filter ? filter.split(" and ") : []) {
        const eq = clause.match(/^(\w+) eq '(.*)'$/);
        if (eq) rows = rows.filter((row) => String(row[eq[1]]) === eq[2].replace(/''/g, "'"));
        const gt = clause.match(/^Id gt (\d+)$/);
        if (gt) rows = rows.filter((row) => row.Id > Number(gt[1]));
      }
      if (orderby === "Id desc") rows.sort((a, b) => b.Id - a.Id);
      if (orderby === "Id asc") rows.sort((a, b) => a.Id - b.Id);
      return rows.slice(0, top);
    },
    async addItem(title, data) { const row = { Id: nextId++, ...data }; lists.set(title, [...(lists.get(title) ?? []), row]); return row; },
    async updateItem(title, id, data) { lists.set(title, lists.get(title).map((row) => row.Id === id ? { ...row, ...data } : row)); },
    async recycleItem(title, id) { this.recycled.push(id); lists.set(title, lists.get(title).filter((row) => row.Id !== id)); },
  };
}

describe("team sync", () => {
  it("uses exactly four lists and creates them with their columns once (idempotent)", async () => {
    expect(Object.values(SP_LISTS)).toEqual(["AOG_Groups", "AOG_Settings", "AOG_Shifts", "AOG_Log"]);
    const client = memoryClient();
    const first = await ensureSchema(client);
    expect(first.filter((line) => line.startsWith("Created list"))).toHaveLength(4);
    expect(first).toContain("Added column AOG_Log.RecordType");
    expect(await ensureSchema(client)).toEqual([]);
  });

  it("keeps Customer only as a ChatType choice, not as an AOG_Groups column", () => {
    expect(SP_FIELDS[SP_LISTS.GROUPS].map((field) => field.name)).toEqual(["ChatType", "Active", "AddedBy", "AddedAt", "Note"]);
    expect(SP_FIELDS[SP_LISTS.GROUPS].find((field) => field.name === "ChatType")).toMatchObject({ choices: ["Customer", "Flyer"], default: "Customer" });
  });

  it("uses Title as the operator name in AOG_Shifts without an OperatorName column", () => {
    const names = SP_FIELDS[SP_LISTS.SHIFTS].map((field) => field.name);
    expect(names).not.toContain("OperatorName");
    expect(names).toContain("Email");
  });

  it("does not duplicate a team group", async () => {
    const client = memoryClient({ [SP_LISTS.GROUPS]: [{ Id: 1, Title: "Runway ABC" }] });
    expect((await pushTeamGroup(client, "Runway ABC")).created).toBe(false);
    expect((await pushTeamGroup(client, "Runway XYZ")).created).toBe(true);
    expect(client.lists.get(SP_LISTS.GROUPS)).toHaveLength(2);
  });

  it("stops watching a group the team lead switched off, without the row being deleted", async () => {
    const client = memoryClient({ [SP_LISTS.GROUPS]: [
      { Id: 1, Title: "Runway ABC", Active: true },
      { Id: 2, Title: "Old customer", Active: false },
      { Id: 3, Title: "No value yet" },
    ] });
    expect(await pullTeamGroups(client)).toEqual(["Runway ABC", "No value yet"]);
    expect(client.lists.get(SP_LISTS.GROUPS)).toHaveLength(3);
  });

  it("still reads the groups when the list has no Active column", async () => {
    const client = memoryClient({ [SP_LISTS.GROUPS]: [{ Id: 1, Title: "Runway ABC" }] }, { columns: ["Id", "Title"] });
    expect(await pullTeamGroups(client)).toEqual(["Runway ABC"]);
  });

  it("reads only new, recent signals from the other machine and ignores event rows", async () => {
    const now = Date.parse("2026-09-28T20:00:00Z");
    const signal = (Id, EventType, AlertId, MachineId, ageMs, Detail) => ({ Id, RecordType: RECORD_TYPE.SIGNAL, EventType, AlertId, MachineId, At: new Date(now - ageMs).toISOString(), Detail });
    const client = memoryClient({ [SP_LISTS.LOG]: [
      signal(1, "HANDLED", "old", "peer", 60_000),
      signal(2, "HANDLED", "mine", "me", 0),
      signal(3, "ESCALATED", "a3", "peer", 0, "{\"operator\":\"B\"}"),
      { Id: 4, RecordType: RECORD_TYPE.EVENT, EventType: "HANDLED", AlertId: "event-row", MachineId: "peer", At: new Date(now).toISOString() },
      signal(5, "HANDLED", "stale", "peer", 3_600_000),
    ] });
    const { signals, lastId } = await pullSignals(client, { sinceId: 1, selfId: "me", now });
    expect(signals.map((item) => item.alert_id)).toEqual(["a3"]);
    expect(signals[0]).toMatchObject({ type: "ESCALATED", from: "peer" });
    expect(signals[0].payload.operator).toBe("B");
    expect(lastId).toBe(5);
    expect(signalFields({ type: "HANDLED", alertId: "a1", source: "whatsapp", fromMachine: "m1", payload: { x: 1 } })).toMatchObject({ RecordType: "Signal", EventType: "HANDLED", MachineId: "m1", Detail: "{\"x\":1}" });
  });

  it("gives each operator their own shift row and never overwrites the partner's", async () => {
    const client = memoryClient({ [SP_LISTS.SHIFTS]: [
      // created in advance by the shift lead
      { Id: 5, Title: "A", ShiftDate: "2026-07-28", Email: "a@x.vn", Slot1Role: "Primary" },
    ] });
    let cache = {};
    cache = await executeOp(client, { kind: "upsert", list: SP_LISTS.SHIFTS, match: { ShiftDate: "2026-07-28", Email: "a@x.vn" }, fields: { CheckIn: "t-a", AcceptedCount: 2 }, create_fields: { Title: "Wrong" } }, cache);
    cache = await executeOp(client, { kind: "upsert", list: SP_LISTS.SHIFTS, match: { ShiftDate: "2026-07-28", Email: "b@x.vn" }, fields: { CheckIn: "t-b", AcceptedCount: 1 }, create_fields: { Title: "B" } }, cache);
    cache = await executeOp(client, { kind: "upsert", list: SP_LISTS.SHIFTS, match: { ShiftDate: "2026-07-28", Email: "b@x.vn" }, fields: { CheckOut: "t-b2", Hours: 4.5 } }, cache);
    const rows = client.lists.get(SP_LISTS.SHIFTS);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.Email === "a@x.vn")).toMatchObject({ Id: 5, Title: "A", Slot1Role: "Primary", CheckIn: "t-a", AcceptedCount: 2 });
    expect(rows.find((row) => row.Email === "b@x.vn")).toMatchObject({ Title: "B", ShiftDate: "2026-07-28", CheckIn: "t-b", CheckOut: "t-b2", Hours: 4.5, AcceptedCount: 1 });
  });

  it("fills in the row the shift lead scheduled by name, and leaves a namesake's claimed row alone", async () => {
    const client = memoryClient({ [SP_LISTS.SHIFTS]: [
      { Id: 5, Title: "Leah", ShiftDate: "2026-11-10", Email: "other.leah@x.vn", CheckIn: "theirs" },
      { Id: 6, Title: "Leah", ShiftDate: "2026-11-10", Email: "", Slot1Role: "Primary" },
    ] });
    const op = (fields) => ({ kind: "upsert", list: SP_LISTS.SHIFTS, match: { ShiftDate: "2026-11-10", Email: "leah@x.vn" }, fallback_match: { ShiftDate: "2026-11-10", Title: "Leah" }, claim_field: "Email", fields });
    let cache = await executeOp(client, op({ Title: "Leah", Email: "leah@x.vn", CheckIn: "t1" }), {});
    cache = await executeOp(client, op({ CheckOut: "t2", Hours: 4 }), cache);
    await executeOp(client, op({ AcceptedCount: 3 }), {});   // no cache (another session): now found by email
    const rows = client.lists.get(SP_LISTS.SHIFTS);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.Id === 5)).toMatchObject({ Email: "other.leah@x.vn", CheckIn: "theirs" });
    expect(rows.find((row) => row.Id === 6)).toMatchObject({ Slot1Role: "Primary", Email: "leah@x.vn", CheckIn: "t1", CheckOut: "t2", Hours: 4, AcceptedCount: 3 });
  });

  it("keeps one heartbeat row per machine, apart from that machine's event rows", async () => {
    const client = memoryClient({ [SP_LISTS.LOG]: [{ Id: 1, RecordType: RECORD_TYPE.EVENT, EventType: "ACCEPT", MachineId: "m1", At: "t0" }] });
    const machine = (LastBeat) => ({ Title: "A", MachineId: "m1", OperatorName: "A", Email: "a@x.vn", Role: "primary", ShiftId: "s1", Ready: "1", Problems: [], LastBeat, Version: "5.0.0" });
    let result = await upsertMachine(client, machine("t1"));
    result = await upsertMachine(client, machine("t2"), result.cache);
    const rows = client.lists.get(SP_LISTS.LOG);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.Id === 1)).toMatchObject({ RecordType: "Event", At: "t0" });
    expect(await pullMachines(client)).toEqual([expect.objectContaining({ MachineId: "m1", LastBeat: "t2", ShiftId: "s1", Ready: "1", Problems: "[]" })]);
  });

  it("removes log rows older than the keep period, oldest first, and leaves live rows alone", async () => {
    const now = Date.parse("2026-11-10T00:00:00Z");
    const daysAgo = (days) => new Date(now - days * 86_400_000).toISOString();
    const client = memoryClient({ [SP_LISTS.LOG]: [
      { Id: 1, RecordType: RECORD_TYPE.MACHINE, MachineId: "m1", At: daysAgo(0) },   // old id, fresh heartbeat
      { Id: 2, RecordType: RECORD_TYPE.EVENT, At: daysAgo(120) },
      { Id: 3, RecordType: RECORD_TYPE.SIGNAL, At: daysAgo(91) },
      { Id: 4, RecordType: RECORD_TYPE.EVENT, At: daysAgo(89) },
      { Id: 5, RecordType: RECORD_TYPE.EVENT, At: daysAgo(200) },                    // out of order: stop before it
    ], [SP_LISTS.SHIFTS]: [{ Id: 9, ShiftDate: "2025-01-01" }] });
    expect(await purgeOldLog(client, { keepDays: 90, now })).toBe(2);
    expect(client.recycled).toEqual([2, 3]);
    expect(client.lists.get(SP_LISTS.LOG).map((row) => row.Id)).toEqual([1, 4, 5]);
    expect(client.lists.get(SP_LISTS.SHIFTS)).toHaveLength(1);
    expect(await purgeOldLog(client, { keepDays: 0, now })).toBe(0);
  });

  it("maps a black-box event with miss cause and response time", () => {
    const fields = eventFields({ event_type: "MISSED", timestamp: "2026-09-28T20:00:00Z", alert_id: "a1", source: "whatsapp", group_name: "Runway", miss_cause: "Person", response_time_ms: 65_000, extra: "x" }, { machineId: "m1", email: "a@x.vn" });
    expect(fields).toMatchObject({ RecordType: "Event", EventType: "MISSED", MissCause: "Person", ResponseSeconds: "65", Email: "a@x.vn", GroupOrSubject: "Runway" });
    expect(JSON.parse(fields.Detail)).toEqual({ extra: "x" });
  });

  it("builds field XML per column type and shapes values to the column", () => {
    expect(fieldSchemaXml({ name: "Notes", type: "Note" })).toContain("Type='Note'");
    expect(fieldSchemaXml({ name: "RecordType", type: "Text", indexed: true })).toContain("Indexed='TRUE'");
    expect(fieldSchemaXml({ name: "Hours", type: "Number" })).toBe("<Field Type='Number' DisplayName='Hours' Name='Hours' StaticName='Hours' />");
    expect(fieldSchemaXml({ name: "Active", type: "Boolean", default: "1" })).toContain("<Default>1</Default>");
    expect(fieldSchemaXml({ name: "ChatType", type: "Choice", choices: ["Customer", "Flyer"], default: "Customer" })).toContain("<CHOICES><CHOICE>Customer</CHOICE><CHOICE>Flyer</CHOICE></CHOICES>");
    expect(clampFields(SP_LISTS.GROUPS, { Title: "x".repeat(400) }).Title).toHaveLength(255);
    expect(clampFields(SP_LISTS.SHIFTS, { Hours: "4.5", AlertCount: 3, MissCount: "n/a", Ready: true })).toEqual({ Hours: 4.5, AlertCount: 3, Ready: "true" });
    for (const list of Object.values(SP_LISTS)) expect(Array.isArray(SP_FIELDS[list])).toBe(true);
  });
});
