import { describe, expect, it } from "vitest";
import { createSharePointClient, normalizeSiteUrl, odataString } from "../lib/sharepoint_client.js";
import { SP_FIELDS, SP_LISTS, clampFields, fieldSchemaXml } from "../lib/sp_schema.js";
import { ensureSchema, eventFields, executeOp, pullSignals, pushTeamGroup, upsertByKey } from "../lib/team_sync.js";

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
    const created = await client.addItem(SP_LISTS.EVENTS, { Title: "ACK" });
    expect(created.Id).toBe(7);
    const write = calls.find((call) => call.url.endsWith("/items"));
    expect(write.init.credentials).toBe("include");
    expect(write.init.headers["X-RequestDigest"]).toBe("digest-1");
    expect(write.url).toBe(`${SITE}/_api/web/lists/getbytitle('AOG_Events')/items`);
  });

  it("turns a login redirect / 403 into a clear Vietnamese error", async () => {
    const { impl } = fakeFetch([[/GET .*currentuser/, { status: 403, body: {} }]]);
    const client = createSharePointClient({ siteUrl: SITE, fetchImpl: impl });
    await expect(client.currentUser()).rejects.toThrow(/từ chối quyền/);
  });

  it("refuses to run without a valid site", async () => {
    const client = createSharePointClient({ siteUrl: "", fetchImpl: async () => { throw new Error("should not fetch"); } });
    await expect(client.items("X")).rejects.toThrow(/chưa cấu hình/);
  });
});

function memoryClient(initial = {}) {
  const lists = new Map(Object.entries(initial));
  let nextId = 100;
  const fields = new Map();
  return {
    lists,
    async listExists(title) { return lists.has(title); },
    async createList(title) { lists.set(title, []); },
    async fieldNames(title) { return [...(fields.get(title) ?? [])]; },
    async createField(title, xml) { const name = xml.match(/Name='([^']+)'/)[1]; fields.set(title, new Set([...(fields.get(title) ?? []), name])); },
    async items(title, { filter = "", orderby = "" } = {}) {
      let rows = [...(lists.get(title) ?? [])];
      const eq = filter.match(/^(\w+) eq '(.*)'$/);
      if (eq) rows = rows.filter((row) => String(row[eq[1]]) === eq[2].replace(/''/g, "'"));
      const gt = filter.match(/^Id gt (\d+)$/);
      if (gt) rows = rows.filter((row) => row.Id > Number(gt[1]));
      if (orderby === "Id desc") rows.sort((a, b) => b.Id - a.Id);
      if (orderby === "Id asc") rows.sort((a, b) => a.Id - b.Id);
      return rows;
    },
    async addItem(title, data) { const row = { Id: nextId++, ...data }; lists.set(title, [...(lists.get(title) ?? []), row]); return row; },
    async updateItem(title, id, data) { lists.set(title, lists.get(title).map((row) => row.Id === id ? { ...row, ...data } : row)); },
  };
}

describe("team sync", () => {
  it("creates all lists and columns once (idempotent)", async () => {
    const client = memoryClient();
    const first = await ensureSchema(client);
    expect(first.filter((line) => line.startsWith("Tạo bảng"))).toHaveLength(Object.values(SP_LISTS).length);
    expect(await ensureSchema(client)).toEqual([]);
  });

  it("does not duplicate a team group", async () => {
    const client = memoryClient({ [SP_LISTS.GROUPS]: [{ Id: 1, Title: "Runway ABC" }] });
    expect((await pushTeamGroup(client, "Runway ABC")).created).toBe(false);
    expect((await pushTeamGroup(client, "Runway XYZ")).created).toBe(true);
    expect(client.lists.get(SP_LISTS.GROUPS)).toHaveLength(2);
  });

  it("reads only new, recent signals from the other machine", async () => {
    const now = Date.parse("2026-09-28T20:00:00Z");
    const client = memoryClient({ [SP_LISTS.SIGNALS]: [
      { Id: 1, SignalType: "HANDLED", AlertId: "old", FromMachine: "peer", SentAt: new Date(now - 60_000).toISOString() },
      { Id: 2, SignalType: "HANDLED", AlertId: "mine", FromMachine: "me", SentAt: new Date(now).toISOString() },
      { Id: 3, SignalType: "ESCALATED", AlertId: "a3", FromMachine: "peer", SentAt: new Date(now).toISOString(), Payload: "{\"operator\":\"B\"}" },
      { Id: 4, SignalType: "HANDLED", AlertId: "stale", FromMachine: "peer", SentAt: new Date(now - 3600_000).toISOString() },
    ] });
    const { signals, lastId } = await pullSignals(client, { sinceId: 1, selfId: "me", now });
    expect(signals.map((signal) => signal.alert_id)).toEqual(["a3"]);
    expect(signals[0].payload.operator).toBe("B");
    expect(lastId).toBe(4);
  });

  it("two machines writing the same night converge on the oldest row", async () => {
    const client = memoryClient({ [SP_LISTS.SHIFTS]: [
      { Id: 5, ShiftDate: "2026-07-28", PrimaryName: "A" },
      { Id: 9, ShiftDate: "2026-07-28" },
    ] });
    await executeOp(client, { kind: "upsert", list: SP_LISTS.SHIFTS, key_field: "ShiftDate", key_value: "2026-07-28", fields: { BackupName: "B" }, shared: true }, { "AOG_Shifts:2026-07-28": 9 });
    const row5 = client.lists.get(SP_LISTS.SHIFTS).find((row) => row.Id === 5);
    expect(row5).toMatchObject({ PrimaryName: "A", BackupName: "B" });
  });

  it("upserts the machine heartbeat row instead of adding new rows", async () => {
    const client = memoryClient({ [SP_LISTS.MACHINES]: [] });
    let result = await upsertByKey(client, SP_LISTS.MACHINES, "MachineId", "m1", { MachineId: "m1", LastBeat: "t1" });
    result = await upsertByKey(client, SP_LISTS.MACHINES, "MachineId", "m1", { MachineId: "m1", LastBeat: "t2" }, result.cache);
    expect(client.lists.get(SP_LISTS.MACHINES)).toHaveLength(1);
    expect(client.lists.get(SP_LISTS.MACHINES)[0].LastBeat).toBe("t2");
  });

  it("maps a black-box event with miss cause and response time", () => {
    const fields = eventFields({ event_type: "MISSED", timestamp: "2026-09-28T20:00:00Z", alert_id: "a1", source: "whatsapp", group_name: "Runway", miss_cause: "Người", response_time_ms: 65_000, extra: "x" }, { machineId: "m1", email: "a@x.vn" });
    expect(fields).toMatchObject({ EventType: "MISSED", MissCause: "Người", ResponseSeconds: "65", Email: "a@x.vn", GroupOrSubject: "Runway" });
    expect(JSON.parse(fields.Detail)).toEqual({ extra: "x" });
  });

  it("builds valid field XML and clamps long text", () => {
    expect(fieldSchemaXml({ name: "Notes", type: "Note" })).toContain("Type='Note'");
    expect(clampFields(SP_LISTS.GROUPS, { Title: "x".repeat(400) }).Title).toHaveLength(255);
    for (const list of Object.values(SP_LISTS)) expect(Array.isArray(SP_FIELDS[list])).toBe(true);
  });
});
