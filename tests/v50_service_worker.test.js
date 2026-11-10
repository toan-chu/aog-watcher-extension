// Behavioural test of service_worker.js with in-memory chrome.* and a fake SharePoint.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createChrome({ browserTabs = [], tabResponder = async () => ({ ok: true }) } = {}) {
  const store = {};
  const listeners = { message: [], alarm: [], installed: [], idle: [] };
  const alarms = new Map();
  const sent = [];
  const notifications = [];
  const tabMessages = [];
  const tabUpdates = [];
  const windowUpdates = [];
  const chrome = {
    _store: store, _alarms: alarms, _sent: sent, _notifications: notifications, _listeners: listeners,
    _tabMessages: tabMessages, _tabUpdates: tabUpdates, _windowUpdates: windowUpdates,
    storage: { local: {
      async get(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(list.filter((key) => key in store).map((key) => [key, structuredClone(store[key])]));
      },
      async set(values) { for (const [key, value] of Object.entries(values)) store[key] = structuredClone(value); },
    }, onChanged: { addListener() {} } },
    runtime: {
      id: "test",
      getURL: (path) => `chrome-extension://test/${path}`,
      getContexts: async () => [{}],
      async sendMessage(message) { sent.push(message); return {}; },
      onMessage: { addListener: (fn) => listeners.message.push(fn) },
      onInstalled: { addListener: (fn) => listeners.installed.push(fn) },
      onStartup: { addListener() {} },
    },
    alarms: {
      create: (name, info) => alarms.set(name, info),
      clear: async (name) => alarms.delete(name),
      getAll: async () => [...alarms.keys()].map((name) => ({ name })),
      onAlarm: { addListener: (fn) => listeners.alarm.push(fn) },
    },
    notifications: { create: async (id, opts) => notifications.push({ id, ...opts }), clear: async () => true },
    offscreen: { createDocument: async () => {} },
    idle: { queryState: (_t, cb) => cb("idle"), onStateChanged: { addListener: (fn) => listeners.idle.push(fn) } },
    tabs: {
      query: async () => browserTabs,
      sendMessage: async (tabId, message) => { tabMessages.push({ tabId, message }); return tabResponder(message, tabId); },
      update: async (tabId, options) => { tabUpdates.push({ tabId, options }); return {}; },
      create: async () => {},
    },
    windows: { update: async (windowId, options) => { windowUpdates.push({ windowId, options }); return {}; } },
  };
  return chrome;
}

function fakeSharePoint() {
  const lists = {};
  let nextId = 1;
  const rows = (title) => (lists[title] ??= []);
  const json = (status, body) => ({ ok: status < 300, status, redirected: false, url: "", text: async () => (body === undefined ? "" : JSON.stringify(body)), json: async () => body });
  const fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    const u = new URL(url);
    if (u.pathname.endsWith("/_api/contextinfo")) return json(200, { FormDigestValue: "d", FormDigestTimeoutSeconds: 1800 });
    if (u.pathname.endsWith("/_api/web/currentuser")) return json(200, { Title: "Hoài", Email: "hoai@acme.vn" });
    const match = decodeURIComponent(u.pathname).match(/getbytitle\('([^']+)'\)\/items(?:\((\d+)\))?$/);
    if (!match) return json(404, {});
    const [, title, id] = match;
    if (method === "GET") {
      let result = [...rows(title)];
      const filter = u.searchParams.get("$filter") ?? "";
      for (const clause of filter ? filter.split(" and ") : []) {
        const gt = clause.match(/^Id gt (\d+)$/);
        if (gt) result = result.filter((row) => row.Id > Number(gt[1]));
        const eq = clause.match(/^(\w+) eq '(.*)'$/);
        if (eq) result = result.filter((row) => String(row[eq[1]]) === eq[2]);
      }
      const order = u.searchParams.get("$orderby");
      if (order === "Id desc") result.sort((a, b) => b.Id - a.Id);
      return json(200, { value: result.slice(0, Number(u.searchParams.get("$top")) || 100) });
    }
    const body = JSON.parse(init.body ?? "{}");
    if (id) { const row = rows(title).find((item) => item.Id === Number(id)); Object.assign(row, body); return json(204); }
    const row = { Id: nextId++, ...body };
    rows(title).push(row);
    return json(201, row);
  };
  return { lists, rows, fetch };
}

async function boot({ config = {}, sharepoint = null, browserTabs = [], tabResponder } = {}) {
  vi.resetModules();
  const chrome = createChrome({ browserTabs, tabResponder });
  globalThis.chrome = chrome;
  if (sharepoint) globalThis.fetch = sharepoint.fetch;
  const { DEFAULT_CONFIG } = await import("../lib/constants.js");
  chrome._store.aog_config = { ...DEFAULT_CONFIG, sharepoint_site_url: "", self_display_name: "Hoài", test_mode: true, test_role: "primary", ...config };
  await import("../service_worker.js");
  const send = (message) => new Promise((resolve) => { chrome._listeners.message[0](message, {}, resolve); });
  const alarm = (name) => chrome._listeners.alarm[0]({ name });
  const settle = async () => { await send({ type: "GET_STATUS" }); };
  return { chrome, send, alarm, settle };
}

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { delete globalThis.chrome; });

describe("service worker 5.0 behaviour", () => {
  it("unknown chat during shift rings and offers a decision; Ignore stops it for this machine only", async () => {
    const { chrome, send } = await boot();
    await send({ type: "START_SHIFT" });
    const response = await send({ type: "ALERT_DETECTED", alert: { source: "whatsapp", group_name: "Runway New", unknown_chat: true, unread_count: 1, message_text: "", detected_at: new Date().toISOString() } });
    expect(response.status.app_state).toBe("ALERTING");
    expect(response.status.unknown_chats.map((item) => item.name)).toEqual(["Runway New"]);
    const decided = await send({ type: "UNKNOWN_CHAT_DECISION", name: "Runway New", decision: "ignore" });
    expect(decided.note).toMatch(/will no longer ring/);
    expect(chrome._store.aog_config.ignored_chats).toEqual(["Runway New"]);
    expect(decided.status.unknown_chats).toEqual([]);
  });

  it("alerts before Start Shift are recorded but do not ring", async () => {
    const { send } = await boot();
    const response = await send({ type: "ALERT_DETECTED", alert: { source: "whatsapp", group_name: "Runway ABC", unread_count: 1, message_text: "" } });
    expect(response.status.app_state).toBe("IDLE");
    expect(response.status.recent_events.at(-1).event_type).toBe("SKIPPED_NO_SHIFT");
  });

  it("Accept creates a follow-up question; missing tabs raise a red source alert on tick", async () => {
    const { chrome, send, alarm, settle } = await boot();
    await send({ type: "START_SHIFT" });
    await send({ type: "ALERT_DETECTED", alert: { source: "email", sender: "ops@airline.com", subject: "AOG A321", message_id: "m1" } });
    const accepted = await send({ type: "ACCEPT_CURRENT" });
    expect(accepted.status.app_state).toBe("IDLE");
    expect(accepted.status.followups).toHaveLength(1);
    alarm("aog:tick");
    await settle();
    const status = (await send({ type: "GET_STATUS" })).status;
    expect(status.sources.whatsapp.status).toBe("missing");
    // Outlook just delivered an alert, so it counts as alive; WhatsApp tab never reported.
    expect(status.sources.outlook.status).toBe("ok");
    expect(status.system_alerts.map((item) => item.key)).toEqual(["source:whatsapp"]);
    expect(status.preflight.ready).toBe(false);
    expect(chrome._notifications.some((item) => item.title === "Source problem")).toBe(true);
    const dismissed = await send({ type: "DISMISS_SYSTEM_ALERT", key: "source:whatsapp" });
    expect(dismissed.status.system_alerts[0].dismissed).toBe(true);
  });

  it("Accept finishes handling and sends the fallback tag before a failed WhatsApp jump", async () => {
    const browserTabs = [{ id: 7, windowId: 3, url: "https://web.whatsapp.com/" }];
    const tabResponder = async (message) => message.type === "SEND_PEER_TAG"
      ? { ok: true }
      : { ok: false, error: 'WhatsApp opened "Wrong group" instead of "AOG CX". Nothing was typed.' };
    const { chrome, send } = await boot({ config: { coord_group: "AOG Coord" }, browserTabs, tabResponder });
    await send({ type: "START_SHIFT" });
    await send({ type: "ALERT_DETECTED", alert: { source: "whatsapp", group_name: "AOG CX", unread_count: 1 } });

    const accepted = await send({ type: "ACCEPT_CURRENT" });

    expect(accepted.status.app_state).toBe("IDLE");
    expect(accepted.ok).toBe(false);
    expect(accepted.error).toContain("Nothing was typed");
    expect(chrome._tabMessages.map((item) => item.message.type).filter((type) => type !== "REBASELINE")).toEqual(["SEND_PEER_TAG", "OPEN_WHATSAPP_CHAT"]);
    expect(chrome._tabUpdates).toEqual([]);
  });

  it("passes an empty greeting through as an empty draft and then focuses WhatsApp", async () => {
    const browserTabs = [{ id: 7, windowId: 3, url: "https://web.whatsapp.com/" }];
    const { chrome, send } = await boot({ config: { whatsapp_greeting: "" }, browserTabs });
    await send({ type: "START_SHIFT" });
    await send({ type: "ALERT_DETECTED", alert: { source: "whatsapp", group_name: "AOG CX", unread_count: 1 } });

    const accepted = await send({ type: "ACCEPT_CURRENT" });

    expect(accepted.status.app_state).toBe("IDLE");
    expect(chrome._tabMessages.at(-1).message).toMatchObject({ type: "OPEN_WHATSAPP_CHAT", chat_name: "AOG CX", draft_text: "" });
    expect(chrome._tabUpdates).toEqual([{ tabId: 7, options: { active: true } }]);
  });

  it("healthy sources + confirmed sound → READY without a power check", async () => {
    const { send, alarm, settle } = await boot();
    await send({ type: "START_SHIFT" });
    await send({ type: "CONTENT_HEALTH", source: "whatsapp", connected: true, stats: { rows_seen: 12 } });
    await send({ type: "CONTENT_HEALTH", source: "outlook", connected: true, stats: { rows_seen: 20, folder_gate: "pass" } });
    await send({ type: "SOUND_CONFIRMED" });
    alarm("aog:tick");
    await settle();
    const status = (await send({ type: "GET_STATUS" })).status;
    expect(status.preflight.ready).toBe(true);
    expect(status.preflight.items.map((item) => item.key)).not.toContain("power");
    expect(status.system_alerts).toEqual([]);
  });

  it("with SharePoint: Accept is sent as a signal, a peer ESCALATED signal is received, black box + night row are written", async () => {
    const sp = fakeSharePoint();
    const { send, alarm, settle } = await boot({ config: { sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();                     // first sync: sets signal cursor, identity, machine row
    const log = (type) => sp.rows("AOG_Log").filter((row) => row.RecordType === type);
    expect(log("Machine")).toHaveLength(1);
    await send({ type: "START_SHIFT" });
    await send({ type: "ALERT_DETECTED", alert: { source: "email", sender: "ops@airline.com", subject: "AOG A321", message_id: "m1" } });
    await send({ type: "ACCEPT_CURRENT" });
    const handled = log("Signal").find((row) => row.EventType === "HANDLED");
    expect(handled).toBeTruthy();
    // peer sends a signal → this machine raises the matching system alert
    sp.rows("AOG_Log").push({ Id: 999, RecordType: "Signal", EventType: "SHIFT_NOT_STARTED", AlertId: "", MachineId: "peer-1", At: new Date().toISOString(), Detail: JSON.stringify({ operator: "Toàn", night: "x" }) });
    alarm("aog:tick"); await settle();
    const status = (await send({ type: "GET_STATUS" })).status;
    expect(status.system_alerts.some((item) => item.kind === "peer_shift")).toBe(true);
    expect(log("Event").some((row) => row.EventType === "ACCEPT")).toBe(true);
    expect(log("Machine")).toHaveLength(1);                // heartbeat updates its own row, event rows with the same MachineId are left alone
    const night = sp.rows("AOG_Shifts");
    expect(night).toHaveLength(1);
    expect(night[0].Email).toBe("hoai@acme.vn");
    expect(night[0].AcceptedCount).toBe(1);
    expect(night[0].AcceptLog).toMatch(/AOG A321/);
    for (const title of ["AOG_Events", "AOG_Signals", "AOG_Machines"]) expect(sp.lists[title]).toBeUndefined();
    expect(status.sharepoint.ok).toBe(true);
  });

  it("with SharePoint: 'Thêm vào danh sách chung' writes AOG_Groups once", async () => {
    const sp = fakeSharePoint();
    const { send, alarm, settle } = await boot({ config: { sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    await send({ type: "START_SHIFT" });
    await send({ type: "ALERT_DETECTED", alert: { source: "whatsapp", group_name: "Runway New", unknown_chat: true, unread_count: 1, message_text: "" } });
    await send({ type: "UNKNOWN_CHAT_DECISION", name: "Runway New", decision: "team" });
    alarm("aog:tick"); await settle();
    expect(sp.rows("AOG_Groups").map((row) => row.Title)).toEqual(["Runway New"]);
  });
});
