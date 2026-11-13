// Behavioural test of service_worker.js with in-memory chrome.* and a fake SharePoint.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeTag } from "../lib/peer_protocol.js";
import { shiftDate } from "../lib/shift_row.js";

function createChrome({ browserTabs = [], tabResponder = async () => ({ ok: true }), idleState = "idle" } = {}) {
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
    idle: { queryState: (_t, cb) => cb(idleState), onStateChanged: { addListener: (fn) => listeners.idle.push(fn) } },
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
    const listRoot = decodeURIComponent(u.pathname).match(/getbytitle\('([^']+)'\)$/);
    if (listRoot && method === "GET") return json(200, { Id: 1 });
    const listFields = decodeURIComponent(u.pathname).match(/getbytitle\('([^']+)'\)\/fields$/);
    if (listFields && method === "GET") return json(200, { value: [] });
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

async function boot({ config = {}, sharepoint = null, browserTabs = [], tabResponder, idleState = "idle" } = {}) {
  vi.resetModules();
  const chrome = createChrome({ browserTabs, tabResponder, idleState });
  globalThis.chrome = chrome;
  if (sharepoint) globalThis.fetch = sharepoint.fetch;
  const { DEFAULT_CONFIG } = await import("../lib/constants.js");
  chrome._store.aog_config = { ...DEFAULT_CONFIG, sharepoint_site_url: "", self_display_name: "Hoài", test_mode: true, test_role: "primary", followup_enabled: true, ...config };
  await import("../service_worker.js");
  const send = (message) => new Promise((resolve) => { chrome._listeners.message[0](message, {}, resolve); });
  const alarm = (name) => chrome._listeners.alarm[0]({ name });
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await send({ type: "GET_STATUS" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await send({ type: "GET_STATUS" });
  };
  return { chrome, send, alarm, settle };
}

beforeEach(() => { vi.useRealTimers(); });

// Test mode never writes the roster or Event rows, so tests of those writes run as a real shift
// with one slot covering the whole day.
const REAL_DUTY = { test_mode: false, shift_slots: [{ start: "00:00", end: "23:59", role: "primary" }] };

// A roster window in AOG_Shifts, minutes relative to now (5.1: Start/End carry date and time).
const stamp = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
function addWindow(sp, { name = "Hoài", email = "hoai@acme.vn", from = -60, to = 180 } = {}) {
  const now = Date.now();
  sp.rows("AOG_Shifts").push({ Id: 100 + sp.rows("AOG_Shifts").length, Title: name, Email: email, Start: stamp(new Date(now + from * 60_000)), End: stamp(new Date(now + to * 60_000)) });
}
afterEach(() => { delete globalThis.chrome; });

describe("service worker 5.0 behaviour", () => {
  it("takes the operator name from the roster on Sign in", async () => {
    const sp = fakeSharePoint();
    addWindow(sp, { name: "Leah" });
    const { chrome, send } = await boot({ config: { sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG", self_display_name: "Lahe" }, sharepoint: sp });
    const signedIn = await send({ type: "SP_TEST" });
    expect(signedIn.note).toBe('Name updated to "Leah" from the roster');
    expect(chrome._store.aog_config.self_display_name).toBe("Leah");
  });

  it("payroll: writes only the four count cells on this person's own row, never creates rows or touches the partner's", async () => {
    const sp = fakeSharePoint();
    addWindow(sp, { name: "Shift lead name" });
    addWindow(sp, { name: "Julia", email: "julia@acme.vn", from: 180, to: 400 });
    const partnerBefore = JSON.stringify(sp.rows("AOG_Shifts")[1]);
    const { send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    alarm("aog:tick"); await settle();                     // the watch starts by itself from the roster
    expect((await send({ type: "GET_STATUS" })).status.session?.role).toBe("primary");
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "p1", source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    await send({ type: "ACCEPT_CURRENT" });
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "p2", source: "whatsapp", group_name: "AOG TWO", unread_count: 1 } });
    alarm("aog:max_alert_duration:p2"); await settle();
    alarm("aog:tick"); await settle();                     // counts queued
    alarm("aog:tick"); await settle();                     // and sent
    const rows = sp.rows("AOG_Shifts");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ Id: 100, Title: "Shift lead name", Email: "hoai@acme.vn", AlertCount: 2, AcceptedCount: 1, MissCount: 1 });
    expect(rows[0].AcceptLog).toMatch(/^\d{2}:\d{2} AOG TEST$/);
    expect(JSON.stringify(rows[1])).toBe(partnerBefore);
  });

  it("payroll: as Backup, a message the person on watch took is counted as an alert, never as a miss", async () => {
    const sp = fakeSharePoint();
    addWindow(sp, { name: "Julia", email: "julia@acme.vn", from: -30, to: 60 });
    addWindow(sp, { from: 60, to: 300 });
    const { send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    alarm("aog:tick"); await settle();
    expect((await send({ type: "GET_STATUS" })).status.session?.role).toBe("backup");
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "b1", source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    alarm("aog:backup_delay:b1"); await settle();
    expect((await send({ type: "GET_STATUS" })).status.app_state).toBe("ALERTING");
    sp.rows("AOG_Log").push({ Id: 5000, RecordType: "Signal", EventType: "HANDLED", AlertId: "b1", Source: "whatsapp", MachineId: "julia-pc", At: new Date().toISOString(), Detail: JSON.stringify({ operator: "Julia", from_role: "primary" }) });
    alarm("aog:tick"); await settle();
    alarm("aog:tick"); await settle();
    expect((await send({ type: "GET_STATUS" })).status.app_state).toBe("IDLE");
    expect(sp.rows("AOG_Shifts")[1]).toMatchObject({ Email: "hoai@acme.vn", AlertCount: 1, AcceptedCount: 0, MissCount: 0 });
    await send({ type: "END_SHIFT" });
    alarm("aog:tick"); await settle();
    expect(sp.rows("AOG_Shifts")[1]).toMatchObject({ AlertCount: 1, MissCount: 0 });
  });

  it("Test mode tells no other machine about its sources, and heartbeats carry no old slot times", async () => {
    const sp = fakeSharePoint();
    const { send, alarm, settle } = await boot({ config: { ...REAL_DUTY, test_mode: true, test_role: "primary", sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    await send({ type: "START_SHIFT" });
    const realNow = Date.now;
    Date.now = () => realNow() + 3 * 60_000;
    try { alarm("aog:tick"); await settle(); alarm("aog:tick"); await settle(); } finally { Date.now = realNow; }
    expect((await send({ type: "GET_STATUS" })).status.system_alerts.map((item) => item.kind)).toContain("source");
    expect(sp.rows("AOG_Log").filter((row) => row.EventType === "SOURCE_BLIND")).toEqual([]);
    const machine = sp.rows("AOG_Log").find((row) => row.RecordType === "Machine");
    expect(machine.Detail).not.toContain("shift_slots");
  });

  it("payroll: nothing is written in test mode", async () => {
    const sp = fakeSharePoint();
    addWindow(sp);
    const before = JSON.stringify(sp.rows("AOG_Shifts"));
    const { send, alarm, settle } = await boot({ config: { ...REAL_DUTY, test_mode: true, test_role: "primary", sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "t1", source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    await send({ type: "ACCEPT_CURRENT" });
    alarm("aog:tick"); await settle();
    expect(JSON.stringify(sp.rows("AOG_Shifts"))).toBe(before);
  });

  it("ring switches: a muted source does not ring but still waits for Accept and goes to Backup; reset at watch end", async () => {
    const { chrome, send } = await boot({ config: REAL_DUTY });
    await send({ type: "START_SHIFT" });
    const off = await send({ type: "SET_MUTE", what: "whatsapp", on: true });
    expect(off.status.mute).toEqual({ sound: false, whatsapp: true, outlook: false });
    chrome._sent.length = 0;
    const ringing = await send({ type: "ALERT_DETECTED", alert: { alert_id: "m1", source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    expect(ringing.status.app_state).toBe("ALERTING");
    expect(chrome._sent.some((message) => message.type === "AUDIO_PLAY")).toBe(false);
    expect([...chrome._alarms.keys()]).toContain("aog:primary_timeout:m1");
    expect(ringing.status.recent_events.some((event) => event.event_type === "MUTE_CHANGED")).toBe(true);
    await send({ type: "END_SHIFT" });
    expect((await send({ type: "GET_STATUS" })).status.mute).toEqual({ sound: false, whatsapp: false, outlook: false });
    expect((await send({ type: "SET_MUTE", what: "sound", on: true })).ok).toBe(false);
  });

  it("ring switches: Outlook off removes the Outlook source problem and the Outlook pre-shift demand", async () => {
    const { send } = await boot({ config: REAL_DUTY });
    await send({ type: "START_SHIFT" });
    let status = (await send({ type: "GET_STATUS" })).status;
    expect(status.preflight.failed).toContain("outlook");
    status = (await send({ type: "SET_MUTE", what: "outlook", on: true })).status;
    expect(status.preflight.failed).not.toContain("outlook");
    expect(status.system_alerts.map((item) => item.key)).not.toContain("source:outlook");
  });

  it("ring switches: Sound off silences everything on this machine; the other source still rings when only one is off", async () => {
    const { chrome, send } = await boot({ config: REAL_DUTY });
    await send({ type: "START_SHIFT" });
    await send({ type: "SET_MUTE", what: "outlook", on: true });
    chrome._sent.length = 0;
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "w1", source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    expect(chrome._sent.some((message) => message.type === "AUDIO_PLAY")).toBe(true);
    await send({ type: "SET_MUTE", what: "sound", on: true });
    expect(chrome._sent.at(-1)?.type === "AUDIO_STOP" || chrome._sent.some((message) => message.type === "AUDIO_STOP")).toBe(true);
  });

  it("someone not on the roster stays off duty and silent", async () => {
    const sp = fakeSharePoint();
    addWindow(sp, { name: "Julia", email: "julia@acme.vn" });
    const { chrome, send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    const status = (await send({ type: "GET_STATUS" })).status;
    expect(status.session).toBeNull();
    expect(status.app_state).toBe("IDLE");
    expect(chrome._sent.some((message) => message.type === "AUDIO_PLAY")).toBe(false);
  });

  it("uses the roster-corrected name in Machine, Event and peer Signal rows", async () => {
    const sp = fakeSharePoint();
    addWindow(sp, { name: "Leah" });
    const { send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG", self_display_name: "Lahe" }, sharepoint: sp });

    await send({ type: "START_SHIFT" });
    await send({ type: "ALERT_DETECTED", alert: { source: "email", sender: "ops@airline.com", subject: "AOG TEST", message_id: "roster-name" } });
    await send({ type: "ACCEPT_CURRENT" });
    alarm("aog:tick"); await settle();
    const rows = sp.rows("AOG_Log");

    expect(rows.find((row) => row.RecordType === "Machine")?.OperatorName).toBe("Leah");
    expect(rows.find((row) => row.RecordType === "Event" && row.EventType === "ACCEPT")?.OperatorName).toBe("Leah");
    expect(JSON.parse(rows.find((row) => row.RecordType === "Signal" && row.EventType === "HANDLED")?.Detail ?? "{}").operator).toBe("Leah");
  });

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

  it("records an Off-slot alert without ringing, then rings for a new Primary-slot alert", async () => {
    const { send } = await boot({ config: {
      test_mode: false,
      shift_slots: [{ start: "00:00", end: "00:00", role: "off" }],
    } });
    await send({ type: "START_SHIFT" });
    const startedAt = (await send({ type: "GET_STATUS" })).status.session.started_at;
    const off = await send({ type: "ALERT_DETECTED", alert: { alert_id: "off-message", source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    expect(off.status.current_role).toBe("off");
    expect(off.status.app_state).toBe("IDLE");
    expect(off.status.recent_events.some((event) => event.event_type === "SKIPPED_OUT_OF_SHIFT")).toBe(true);

    await send({ type: "UPDATE_SHIFT_SLOTS", slots: [{ start: "00:00", end: "00:00", role: "primary" }] });
    const primary = await send({ type: "ALERT_DETECTED", alert: { alert_id: "primary-message", source: "whatsapp", group_name: "AOG TEST", unread_count: 2 } });
    expect(primary.status.current_role).toBe("primary");
    expect(primary.status.app_state).toBe("ALERTING");
    expect(primary.status.session.started_at).toBe(startedAt);
  });

  it("keeps ringing until max duration when the slot becomes Off without an on-duty peer", async () => {
    const { chrome, send, alarm, settle } = await boot({ config: {
      test_mode: false,
      shift_slots: [{ start: "00:00", end: "00:00", role: "primary" }],
    } });
    await send({ type: "START_SHIFT" });
    const ringing = await send({ type: "ALERT_DETECTED", alert: { alert_id: "boundary", source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    expect(ringing.status.app_state).toBe("ALERTING");
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "boundary-2", source: "whatsapp", group_name: "AOG TWO", unread_count: 1 } });

    await send({ type: "UPDATE_SHIFT_SLOTS", slots: [{ start: "00:00", end: "00:00", role: "off" }] });
    alarm("aog:primary_timeout:boundary");
    await settle();

    let status = (await send({ type: "GET_STATUS" })).status;
    expect(status.current_role).toBe("off");
    expect(status.app_state).toBe("ALERTING");
    expect(status.pending_count).toBe(2);
    expect(status.recent_events.some((event) => event.event_type === "PEER_ESCALATED_SENT")).toBe(false);

    alarm("aog:max_alert_duration:boundary");
    await settle();
    status = (await send({ type: "GET_STATUS" })).status;
    expect(status.app_state).toBe("ALERTING");
    expect(status.current_alert.alert_id).toBe("boundary-2");

    alarm("aog:max_alert_duration:boundary-2");
    await settle();
    status = (await send({ type: "GET_STATUS" })).status;
    expect(status.app_state).toBe("IDLE");
    expect(status.recent_events.filter((event) => event.event_type === "MISSED").map((event) => event.alert_id)).toEqual(["boundary", "boundary-2"]);
  });

  it("hands ringing alerts to an on-duty peer when this slot becomes Off", async () => {
    const browserTabs = [{ id: 7, windowId: 3, url: "https://web.whatsapp.com/" }];
    const { chrome, send, alarm, settle } = await boot({
      config: { test_mode: false, coord_group: "AOG Coord", shift_slots: [{ start: "00:00", end: "00:00", role: "primary" }] },
      browserTabs,
    });
    await send({ type: "START_SHIFT" });
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "handoff", source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    chrome._store.aog_peers = [{ machine_id: "peer", role: "primary", on_shift: true, status: "alive" }];

    await send({ type: "UPDATE_SHIFT_SLOTS", slots: [{ start: "00:00", end: "00:00", role: "off" }] });
    alarm("aog:primary_timeout:handoff");
    await settle();

    const status = (await send({ type: "GET_STATUS" })).status;
    expect(status.app_state).toBe("IDLE");
    expect(status.pending_count).toBe(0);
    expect(chrome._tabMessages.filter((item) => item.message.type === "SEND_PEER_TAG")).toHaveLength(1);
    expect(status.recent_events.some((event) => event.event_type === "SHIFT_HANDOFF_SENT" && event.alert_id === "handoff")).toBe(true);
  });

  it("rings from a new SharePoint ESCALATED signal even when the alert was never detected locally", async () => {
    const sp = fakeSharePoint();
    const { send, alarm, settle } = await boot({ config: { sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG", test_role: "backup" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    await send({ type: "START_SHIFT" });
    const timestamp = new Date().toISOString();
    sp.rows("AOG_Log").push({
      Id: 900, RecordType: "Signal", EventType: "ESCALATED", AlertId: "from-peer", Source: "whatsapp",
      MachineId: "peer", At: timestamp,
      Detail: JSON.stringify({ timestamp, group: "AOG TEST", sender: "Customer One", subject: "AOG A321", unread_count: 3 }),
    });

    alarm("aog:tick"); await settle();
    const status = (await send({ type: "GET_STATUS" })).status;

    expect(status.app_state).toBe("ALERTING");
    expect(status.current_alert).toMatchObject({
      alert_id: "from-peer", source: "whatsapp", group_name: "AOG TEST",
      sender: "Customer One", subject: "AOG A321", unread_count: 3,
    });
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
    // first 2 minutes of the watch: tabs may not have reported yet, so no source alert
    expect((await send({ type: "GET_STATUS" })).status.system_alerts).toEqual([]);
    const realNow = Date.now;
    Date.now = () => realNow() + 3 * 60_000;
    try { alarm("aog:tick"); await settle(); } finally { Date.now = realNow; }
    const status = (await send({ type: "GET_STATUS" })).status;
    // Neither tab ever reported (the Outlook alert 3 minutes ago no longer counts as alive).
    expect(status.sources.whatsapp.status).toBe("missing");
    expect(status.system_alerts.map((item) => item.key)).toContain("source:whatsapp");
    expect(status.preflight.ready).toBe(false);
    expect(chrome._notifications.some((item) => item.title === "Source problem")).toBe(true);
    const dismissed = await send({ type: "DISMISS_SYSTEM_ALERT", key: "source:whatsapp" });
    expect(dismissed.status.system_alerts.find((item) => item.key === "source:whatsapp").dismissed).toBe(true);
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

  it("Accept all handles three alerts, creates three follow-ups and opens only the ringing chat", async () => {
    const sp = fakeSharePoint();
    addWindow(sp);
    const browserTabs = [{ id: 7, windowId: 3, url: "https://web.whatsapp.com/" }];
    const { chrome, send, alarm, settle } = await boot({
      config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" },
      sharepoint: sp,
      browserTabs,
    });
    alarm("aog:tick"); await settle();
    await send({ type: "START_SHIFT" });
    for (const [index, group] of ["AOG ONE", "AOG TWO", "AOG THREE"].entries()) {
      await send({ type: "ALERT_DETECTED", alert: { alert_id: `a${index + 1}`, source: "whatsapp", group_name: group, unread_count: 1 } });
    }

    const accepted = await send({ type: "ACCEPT_ALL" });
    alarm("aog:tick"); await settle();

    expect(accepted.status.app_state).toBe("IDLE");
    expect(accepted.status.pending_count).toBe(0);
    expect(accepted.status.followups).toHaveLength(3);
    expect(sp.rows("AOG_Log").filter((row) => row.RecordType === "Signal" && row.EventType === "HANDLED")).toHaveLength(3);
    const acceptEvents = sp.rows("AOG_Log").filter((row) => row.RecordType === "Event" && row.EventType === "ACCEPT");
    expect(acceptEvents).toHaveLength(3);
    expect(acceptEvents.every((row) => JSON.parse(row.Detail).accept_method === "button")).toBe(true);
    expect(chrome._tabMessages.filter((item) => item.message.type === "OPEN_WHATSAPP_CHAT")).toEqual([
      expect.objectContaining({ message: expect.objectContaining({ chat_name: "AOG ONE" }) }),
    ]);
  });

  it("does not Accept merely because the alert chat was already open without focus", async () => {
    const { send, alarm, settle } = await boot();
    await send({ type: "START_SHIFT" });
    await send({ type: "CONTENT_HEALTH", source: "whatsapp", connected: true, stats: { rows_seen: 2 } });
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "a1", source: "whatsapp", group_name: "AOG ONE", unread_count: 1, active_conversation: "AOG ONE" } });

    const observed = await send({ type: "WHATSAPP_READ_OBSERVED", active_chat: "AOG ONE", focused_active_chat: "", visible_read_chats: [] });

    expect(observed.status.app_state).toBe("ALERTING");
    expect(observed.status.current_alert.alert_id).toBe("a1");
    expect(observed.status.followups).toEqual([]);
  });

  it("focused exact WhatsApp chat Accepts without navigation or greeting", async () => {
    const sp = fakeSharePoint();
    addWindow(sp);
    const browserTabs = [{ id: 7, windowId: 3, url: "https://web.whatsapp.com/" }];
    const { chrome, send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp, browserTabs, idleState: "active" });
    alarm("aog:tick"); await settle();
    await send({ type: "START_SHIFT" });
    await send({ type: "CONTENT_HEALTH", source: "whatsapp", connected: true, stats: { rows_seen: 2 } });
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "a1", source: "whatsapp", group_name: "AOG ONE", unread_count: 1 } });

    const accepted = await send({ type: "WHATSAPP_READ_OBSERVED", focused_active_chat: "AOG ONE", visible_read_chats: [] });
    alarm("aog:tick"); await settle();

    expect(accepted.status.app_state).toBe("IDLE");
    expect(accepted.status.followups).toHaveLength(1);
    expect(sp.rows("AOG_Log").filter((row) => row.RecordType === "Signal" && row.EventType === "HANDLED")).toHaveLength(1);
    const event = sp.rows("AOG_Log").find((row) => row.RecordType === "Event" && row.EventType === "ACCEPT");
    expect(JSON.parse(event.Detail).accept_method).toBe("open_chat");
    expect(chrome._tabMessages.some((item) => item.message.type === "OPEN_WHATSAPP_CHAT")).toBe(false);
  });

  it("opening one of three chats Accepts only that queued alert", async () => {
    const sp = fakeSharePoint();
    const { send, alarm, settle } = await boot({ config: { sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp, idleState: "active" });
    alarm("aog:tick"); await settle();
    await send({ type: "START_SHIFT" });
    await send({ type: "CONTENT_HEALTH", source: "whatsapp", connected: true, stats: { rows_seen: 3 } });
    alarm("aog:tick"); await settle();
    for (const [index, group] of ["AOG ONE", "AOG TWO", "AOG THREE"].entries()) {
      await send({ type: "ALERT_DETECTED", alert: { alert_id: `a${index + 1}`, source: "whatsapp", group_name: group, unread_count: 1 } });
    }

    const accepted = await send({ type: "WHATSAPP_READ_OBSERVED", focused_active_chat: "AOG TWO", visible_read_chats: [] });

    expect(accepted.status.app_state).toBe("ALERTING");
    expect(accepted.status.current_alert.alert_id).toBe("a1");
    expect(accepted.status.pending_count).toBe(2);
    expect(accepted.status.followups.map((item) => item.alert_id)).toEqual(["a2"]);
    expect(sp.rows("AOG_Log").filter((row) => row.RecordType === "Signal" && row.EventType === "HANDLED").map((row) => row.AlertId)).toEqual(["a2"]);
  });

  it("does not auto-Accept read evidence while WhatsApp is not healthy", async () => {
    const { send } = await boot();
    await send({ type: "START_SHIFT" });
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "a1", source: "whatsapp", group_name: "AOG ONE", unread_count: 1 } });

    const ignored = await send({ type: "WHATSAPP_READ_OBSERVED", active_chat: "AOG ONE", visible_read_chats: ["AOG ONE"] });

    expect(ignored.status.app_state).toBe("ALERTING");
    expect(ignored.status.current_alert.alert_id).toBe("a1");
    expect(ignored.status.followups).toEqual([]);
  });

  it.each(["idle", "locked"])("does not Accept a focused chat while the computer is %s", async (idleState) => {
    const { send, alarm, settle } = await boot({ idleState });
    await send({ type: "START_SHIFT" });
    await send({ type: "CONTENT_HEALTH", source: "whatsapp", connected: true, stats: { rows_seen: 2 } });
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "a1", source: "whatsapp", group_name: "AOG ONE", unread_count: 1 } });

    const observed = await send({ type: "WHATSAPP_READ_OBSERVED", focused_active_chat: "AOG ONE", visible_read_chats: [] });

    expect(observed.status.app_state).toBe("ALERTING");
    expect(observed.status.current_alert.alert_id).toBe("a1");
    expect(observed.status.followups).toEqual([]);
  });

  it("still Accepts confirmed unread-zero row evidence while the computer is idle", async () => {
    const { send, alarm, settle } = await boot({ idleState: "idle" });
    await send({ type: "START_SHIFT" });
    await send({ type: "CONTENT_HEALTH", source: "whatsapp", connected: true, stats: { rows_seen: 2 } });
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "a1", source: "whatsapp", group_name: "AOG ONE", unread_count: 1 } });

    const accepted = await send({ type: "WHATSAPP_READ_OBSERVED", focused_active_chat: "", visible_read_chats: ["AOG ONE"] });

    expect(accepted.status.app_state).toBe("IDLE");
    expect(accepted.status.followups.map((item) => item.alert_id)).toEqual(["a1"]);
  });

  it("lets Backup auto-Accept an escalated alert after the exact chat opens", async () => {
    const { send, alarm, settle } = await boot({ config: { test_role: "backup" }, idleState: "active" });
    await send({ type: "START_SHIFT" });
    await send({ type: "CONTENT_HEALTH", source: "whatsapp", connected: true, stats: { rows_seen: 2 } });
    alarm("aog:tick"); await settle();
    const detectedAt = new Date().toISOString();
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "backup-a1", source: "whatsapp", group_name: "AOG ONE", unread_count: 1, detected_at: detectedAt } });
    await send({ type: "PEER_TAG_RECEIVED", text: serializeTag("ESCALATED", { alert_id: "backup-a1", source: "whatsapp", timestamp: detectedAt, from_role: "primary", operator: "Partner" }) });

    const accepted = await send({ type: "WHATSAPP_READ_OBSERVED", focused_active_chat: "AOG ONE", visible_read_chats: [] });

    expect(accepted.status.app_state).toBe("IDLE");
    expect(accepted.status.pending_count).toBe(0);
    expect(accepted.status.followups.map((item) => item.alert_id)).toEqual(["backup-a1"]);
  });

  it("ignores old peer signals when Backup starts with an old unread alert", async () => {
    const sp = fakeSharePoint();
    sp.rows("AOG_Log").push({
      Id: 50, RecordType: "Signal", EventType: "ESCALATED", AlertId: "old-a1", Source: "whatsapp",
      MachineId: "peer", At: new Date(Date.now() - 3_600_000).toISOString(), Detail: JSON.stringify({ operator: "Partner" }),
    });
    const { send, alarm, settle } = await boot({ config: { sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG", test_role: "backup" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    await send({ type: "START_SHIFT" });

    const oldUnread = await send({ type: "ALERT_DETECTED", alert: { alert_id: "old-a1", source: "whatsapp", group_name: "AOG ONE", unread_count: 4 } });

    expect(oldUnread.status.app_state).toBe("IDLE");
    expect(oldUnread.status.pending_count).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await settle();
  });

  it("never raises lost or not-started alerts for a peer whose embedded schedule is Off", async () => {
    const sp = fakeSharePoint();
    sp.rows("AOG_Log").push({
      Id: 40, RecordType: "Machine", EventType: "HEARTBEAT", MachineId: "peer-off", OperatorName: "Ethan",
      Role: "primary", ShiftId: "old-shift", Ready: "1", At: new Date(Date.now() - 20 * 60_000).toISOString(),
      Detail: JSON.stringify({ problems: [], shift_slots: [{ start: "00:00", end: "00:00", role: "off" }], test_mode: false }),
    });
    const { chrome, send, alarm, settle } = await boot({ config: { sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    await send({ type: "START_SHIFT" });
    chrome._store.aog_system_alerts = {
      "peer_shift:peer-off:night": { key: "peer_shift:peer-off:night", kind: "peer_shift", title: "Old", message: "Old", ring: true, dismissed: false },
    };
    sp.rows("AOG_Log").push({
      Id: 999, RecordType: "Signal", EventType: "SHIFT_NOT_STARTED", AlertId: "", MachineId: "peer-off",
      At: new Date().toISOString(), Detail: JSON.stringify({ operator: "Ethan", night: "night" }),
    });

    alarm("aog:tick"); await settle();
    const status = (await send({ type: "GET_STATUS" })).status;

    expect(status.peers).toEqual([expect.objectContaining({ machine_id: "peer-off", on_shift: false, status: "off" })]);
    expect(status.system_alerts.filter((item) => item.kind === "peer_lost" || item.kind === "peer_shift")).toEqual([]);
    expect(chrome._notifications.some((item) => item.title === "Partner machine lost" || item.title === "Partner machine has not started its shift")).toBe(false);
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

  it("with SharePoint: Accept is sent as a signal, a peer ESCALATED signal is received, black box written, roster untouched", async () => {
    const sp = fakeSharePoint();
    addWindow(sp);
    const { send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
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
    expect(night[0]).not.toHaveProperty("CheckIn");
    expect(night[0]).toMatchObject({ AlertCount: 1, AcceptedCount: 1, MissCount: 0 });
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

  it("End shift silences everything: no queued alert, no alert timers, no ring when the person walks away", async () => {
    const { chrome, send, alarm, settle } = await boot({ idleState: "active" });
    await send({ type: "START_SHIFT" });
    await send({ type: "CONTENT_HEALTH", source: "whatsapp", connected: true, stats: { rows_seen: 2 } });
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "loud", source: "whatsapp", group_name: "AOG ONE", unread_count: 1 } });
    expect((await send({ type: "GET_STATUS" })).status.app_state).toBe("ALERTING");

    await send({ type: "END_SHIFT" }); await settle();
    const status = (await send({ type: "GET_STATUS" })).status;
    expect(status.app_state).toBe("IDLE");
    expect(status.pending_count).toBe(0);
    expect([...chrome._alarms.keys()].filter((name) => /^aog:(primary_timeout|backup_delay|max_alert_duration):/.test(name))).toEqual([]);

    const before = chrome._sent.filter((message) => message.type === "AUDIO_PLAY").length;
    await chrome._listeners.idle[0]("idle"); await settle();
    expect(chrome._sent.filter((message) => message.type === "AUDIO_PLAY").length).toBe(before);
  });

  it("a partner's follow-up signal does not ring a machine that is off shift", async () => {
    const sp = fakeSharePoint();
    const { chrome, send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    const timestamp = new Date().toISOString();
    sp.rows("AOG_Log").push({
      Id: 901, RecordType: "Signal", EventType: "FOLLOWUP_OVERDUE", AlertId: "done-earlier", Source: "whatsapp",
      MachineId: "peer", At: timestamp, Detail: JSON.stringify({ timestamp, operator: "Ethan", title: "AOG TEST" }),
    });
    const before = chrome._sent.filter((message) => message.type === "AUDIO_PLAY").length;
    alarm("aog:tick"); await settle();
    const status = (await send({ type: "GET_STATUS" })).status;
    expect((status.system_alerts ?? []).map((item) => item.key)).not.toContain("peer_followup:done-earlier");
    expect(chrome._sent.filter((message) => message.type === "AUDIO_PLAY").length).toBe(before);
  });

  it("Test tab: simulated messages need Test mode, and Test mode starts watching by itself", async () => {
    const { send } = await boot({ config: { test_mode: false } });
    expect(await send({ type: "SIMULATE_ALERT", source: "whatsapp" })).toMatchObject({ ok: false, error: "Turn on Test mode first." });
    const saved = await send({ type: "UPDATE_TEST_SETTINGS", test_mode: true, test_role: "primary", dry_run: false });
    expect(saved.status.session).toBeTruthy();
    const simulated = await send({ type: "SIMULATE_ALERT", source: "whatsapp" });
    expect(simulated.ok).toBe(true);
    expect(simulated.status.app_state).toBe("ALERTING");
  });

  it("Test tab: saving keeps only known roles", async () => {
    const { chrome, send } = await boot();
    const saved = await send({ type: "UPDATE_TEST_SETTINGS", test_mode: true, test_role: "solo", dry_run: true });
    expect(saved.status).toMatchObject({ test_mode: true, test_role: "solo", dry_run: true, solo: true });
    await send({ type: "UPDATE_TEST_SETTINGS", test_mode: true, test_role: "boss", dry_run: false });
    expect(chrome._store.aog_config.test_role).toBe("primary");
  });

  it("Solo: a simulated WhatsApp message rings as Primary, then the Primary timeout starts a simulated Backup stage", async () => {
    const { chrome, send, alarm, settle } = await boot({ config: { test_role: "solo" } });
    await send({ type: "START_SHIFT" });
    await send({ type: "CONTENT_HEALTH", source: "whatsapp", connected: true, stats: { rows_seen: 2 } });
    alarm("aog:tick"); await settle();
    const simulated = await send({ type: "SIMULATE_ALERT", source: "whatsapp", name: "" });
    expect(simulated.ok).toBe(true);
    const alert = simulated.status.current_alert;
    expect(simulated.status.app_state).toBe("ALERTING");
    expect(alert).toMatchObject({ simulated: true, simulated_target: false, group_name: "Simulated WhatsApp chat" });
    expect(simulated.status.current_role).toBe("primary");

    alarm(`aog:primary_timeout:${alert.alert_id}`); await settle();
    const status = (await send({ type: "GET_STATUS" })).status;
    expect(status.current_alert.backup_stage).toBe(true);
    expect(chrome._sent.some((message) => message.type === "AUDIO_PLAY" && message.mode === "escalate")).toBe(true);
    expect(status.recent_events.some((event) => event.event_type === "SOLO_BACKUP_STAGE")).toBe(true);

    await send({ type: "ACCEPT_CURRENT" }); await settle();
    expect(chrome._tabMessages.some((item) => item.message.type === "OPEN_WHATSAPP_CHAT")).toBe(false);
    expect((await send({ type: "GET_STATUS" })).status.app_state).toBe("IDLE");
  });

  it("a simulated Outlook email rings even when the email filters would skip it", async () => {
    const { send, alarm, settle } = await boot({ config: { subject_keywords: ["NEVER MATCHES"], skip_sender_domains: ["aog-watcher.test"] } });
    await send({ type: "START_SHIFT" });
    alarm("aog:tick"); await settle();
    const simulated = await send({ type: "SIMULATE_ALERT", source: "email", name: "AOG TEST 42" });
    expect(simulated.status.app_state).toBe("ALERTING");
    expect(simulated.status.current_alert).toMatchObject({ source: "email", subject: "AOG TEST 42", simulated: true });
  });

  it("Solo test does not raise Partner machine lost for other machines", async () => {
    const sp = fakeSharePoint();
    const { send, alarm, settle } = await boot({ config: { sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG", test_role: "solo" }, sharepoint: sp });
    sp.rows("AOG_Log").push({
      Id: 950, RecordType: "Machine", MachineId: "ethan", OperatorName: "Ethan", Role: "backup", ShiftId: "s-old",
      At: new Date(Date.now() - 20 * 60_000).toISOString(), Detail: JSON.stringify({ problems: [], shift_slots: [], test_mode: true }),
    });
    await send({ type: "START_SHIFT" });
    alarm("aog:tick"); await settle();
    const status = (await send({ type: "GET_STATUS" })).status;
    expect(status.peers.find((peer) => peer.machine_id === "ethan").status).toBe("lost");
    expect(status.system_alerts.map((item) => item.kind)).not.toContain("peer_lost");
  });

  it("Accept on an email opens that exact email in the Outlook tab that has it", async () => {
    const browserTabs = [{ id: 21, windowId: 5, url: "https://outlook.cloud.microsoft/mail/" }, { id: 22, windowId: 6, url: "https://outlook.office.com/mail/" }];
    const tabResponder = async (message, tabId) => (message.type === "OPEN_OUTLOOK_MESSAGE" ? { ok: true, opened: tabId === 22 } : { ok: true });
    const { chrome, send, alarm, settle } = await boot({ browserTabs, tabResponder });
    await send({ type: "START_SHIFT" });
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { source: "email", sender: "ops@airline.com", subject: "AOG A321 at SGN", message_id: "conv-42" } });

    const accepted = await send({ type: "ACCEPT_CURRENT" }); await settle();
    expect(accepted.ok).not.toBe(false);
    const asked = chrome._tabMessages.filter((item) => item.message.type === "OPEN_OUTLOOK_MESSAGE");
    expect(asked.map((item) => item.tabId)).toEqual([21, 22]);
    expect(asked[0].message).toMatchObject({ message_id: "conv-42", subject: "AOG A321 at SGN", sender: "ops@airline.com" });
    expect(chrome._tabUpdates.at(-1)).toMatchObject({ tabId: 22, options: { active: true } });
  });

  it("Accept on an email still brings Outlook forward when the email is not in the list", async () => {
    const browserTabs = [{ id: 21, windowId: 5, url: "https://outlook.cloud.microsoft/mail/" }];
    const tabResponder = async () => ({ ok: true, opened: false });
    const { chrome, send, alarm, settle } = await boot({ browserTabs, tabResponder });
    await send({ type: "START_SHIFT" });
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { source: "email", sender: "ops@airline.com", subject: "Gone", message_id: "gone" } });
    await send({ type: "ACCEPT_CURRENT" }); await settle();
    expect(chrome._tabUpdates.at(-1)).toMatchObject({ tabId: 21, options: { active: true } });
  });

  it("Accept on a simulated email without a subject still brings Outlook forward", async () => {
    const browserTabs = [{ id: 31, windowId: 7, url: "https://outlook.cloud.microsoft/mail/" }];
    const tabResponder = async () => ({ ok: true, opened: false });
    const { chrome, send, alarm, settle } = await boot({ browserTabs, tabResponder });
    await send({ type: "START_SHIFT" });
    alarm("aog:tick"); await settle();
    await send({ type: "SIMULATE_ALERT", source: "email", name: "" });
    await send({ type: "ACCEPT_CURRENT" }); await settle();
    expect(chrome._tabUpdates.at(-1)).toMatchObject({ tabId: 31, options: { active: true } });
  });

  it("Is it done? appears quietly; only an unanswered question rings", async () => {
    const { chrome, send, alarm, settle } = await boot();
    await send({ type: "START_SHIFT" });
    await send({ type: "ALERT_DETECTED", alert: { source: "email", sender: "ops@airline.com", subject: "AOG A321", message_id: "m1" } });
    await send({ type: "ACCEPT_CURRENT" }); await settle();
    const plays = () => chrome._sent.filter((message) => message.type === "AUDIO_PLAY").length;

    chrome._store.aog_followups = chrome._store.aog_followups.map((item) => ({ ...item, ask_at: Date.now() - 1000 }));
    const before = plays();
    alarm("aog:tick"); await settle();
    const asked = (await send({ type: "GET_STATUS" })).status.system_alerts.find((item) => item.kind === "followup");
    expect(asked).toMatchObject({ title: "Is it done?", ring: false });
    expect(plays()).toBe(before);

    chrome._store.aog_followups = chrome._store.aog_followups.map((item) => ({ ...item, asked_at: Date.now() - 6 * 60_000 }));
    alarm("aog:tick"); await settle();
    const overdue = (await send({ type: "GET_STATUS" })).status.system_alerts.find((item) => item.kind === "followup_overdue");
    expect(overdue.ring).toBe(true);
    expect(plays()).toBeGreaterThan(before);
  });

  it("simulated messages create no Is it done? question", async () => {
    const { send, alarm, settle } = await boot();
    await send({ type: "START_SHIFT" });
    alarm("aog:tick"); await settle();
    await send({ type: "SIMULATE_ALERT", source: "whatsapp", name: "" });
    const accepted = await send({ type: "ACCEPT_CURRENT" });
    expect(accepted.status.followups).toEqual([]);
  });

  it("Test mode writes no roster row and no Event rows, but still sends Machine and Signal rows", async () => {
    const sp = fakeSharePoint();
    sp.rows("AOG_Shifts").push({ Id: 1, Title: "Hoài", ShiftDate: shiftDate(new Date().toISOString()), Email: "hoai@acme.vn" });
    const { send, alarm, settle } = await boot({ config: { sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    await send({ type: "START_SHIFT" });
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { alert_id: "t1", source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    await send({ type: "ACCEPT_CURRENT" });
    alarm("aog:tick"); await settle();
    await send({ type: "END_SHIFT" }); await settle();

    expect(sp.rows("AOG_Shifts")[0].CheckIn).toBeUndefined();
    const log = sp.rows("AOG_Log");
    expect(log.filter((row) => row.RecordType === "Event")).toEqual([]);
    expect(log.some((row) => row.RecordType === "Machine")).toBe(true);
    expect(log.some((row) => row.RecordType === "Signal" && row.EventType === "HANDLED")).toBe(true);
  });

  it("off shift, a detected message is not written to AOG_Log", async () => {
    const sp = fakeSharePoint();
    const { send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    alarm("aog:tick"); await settle();
    expect(sp.rows("AOG_Log").filter((row) => row.RecordType === "Event")).toEqual([]);
  });

  it("roster: the watch starts by itself in your own window, as Primary", async () => {
    const sp = fakeSharePoint();
    addWindow(sp, { from: -30, to: 240 });
    const { send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    alarm("aog:tick"); await settle();
    const status = (await send({ type: "GET_STATUS" })).status;
    expect(status.session).toBeTruthy();
    expect(status.current_role).toBe("primary");
    expect(status.role_source).toBe("roster");
  });

  it("roster: in a partner's window of the same night you are Backup", async () => {
    const sp = fakeSharePoint();
    addWindow(sp, { name: "Julia", email: "julia@acme.vn", from: -30, to: 60 });
    addWindow(sp, { from: 60, to: 300 });
    const { send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    alarm("aog:tick"); await settle();
    const status = (await send({ type: "GET_STATUS" })).status;
    expect(status.session).toBeTruthy();
    expect(status.current_role).toBe("backup");
  });

  it("roster: after the night the watch ends by itself and nothing rings", async () => {
    const sp = fakeSharePoint();
    addWindow(sp, { from: -300, to: -10 });
    const { chrome, send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    alarm("aog:tick"); await settle();
    await send({ type: "ALERT_DETECTED", alert: { source: "whatsapp", group_name: "AOG TEST", unread_count: 1 } });
    const status = (await send({ type: "GET_STATUS" })).status;
    expect(status.session).toBeNull();
    expect(chrome._sent.some((message) => message.type === "AUDIO_PLAY")).toBe(false);
  });

  it("roster: the Backup is told, without a ring, when the person on watch has no live machine", async () => {
    const sp = fakeSharePoint();
    addWindow(sp, { name: "Julia", email: "julia@acme.vn", from: -30, to: 60 });
    addWindow(sp, { from: 60, to: 300 });
    const { chrome, send, alarm, settle } = await boot({ config: { ...REAL_DUTY, sharepoint_site_url: "https://acme.sharepoint.com/sites/AOG" }, sharepoint: sp });
    alarm("aog:tick"); await settle();
    alarm("aog:tick"); await settle();
    alarm("aog:tick"); await settle();
    const offline = (await send({ type: "GET_STATUS" })).status.system_alerts.find((item) => item.kind === "roster_offline");
    expect(offline).toMatchObject({ title: "Julia's AOG Watcher is offline", ring: false });

    sp.rows("AOG_Log").push({ Id: 990, RecordType: "Machine", MachineId: "julia-pc", OperatorName: "Julia", Email: "julia@acme.vn", Role: "primary", ShiftId: "s-j", At: new Date().toISOString(), Detail: JSON.stringify({ problems: [], shift_slots: [], test_mode: false }) });
    alarm("aog:tick"); await settle();
    expect((await send({ type: "GET_STATUS" })).status.system_alerts.map((item) => item.kind)).not.toContain("roster_offline");
  });

  it("Accept is done by default: no Is it done? question", async () => {
    const { DEFAULT_CONFIG } = await import("../lib/constants.js");
    expect(DEFAULT_CONFIG.followup_enabled).toBe(false);
  });
});
