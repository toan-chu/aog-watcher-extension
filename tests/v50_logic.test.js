import { describe, expect, it } from "vitest";
import { classifyChat, effectiveGroups, addName, removeName, uniqueNames } from "../lib/groups.js";
import { evaluateSources, problemsOf } from "../lib/blind_detector.js";
import { runPreflight } from "../lib/preflight.js";
import { shiftReminderState } from "../lib/shift_reminder.js";
import { evaluatePeers, findGaps, wasOfflineAt } from "../lib/heartbeat.js";
import { classifyMiss, MISS_CAUSE } from "../lib/miss_cause.js";
import { answerFollowup, createFollowup, tickFollowups } from "../lib/followup.js";
import { completeOp, dueOps, enqueueOp, failOp } from "../lib/outbox.js";
import { applySharedSettings, changedKeys, parseSettingsRows, SHARED_KEYS } from "../lib/shared_settings.js";
import { ackLog, shiftDate, shiftRowFields } from "../lib/shift_row.js";

const MIN = 60_000;

describe("groups", () => {
  const lists = { team: ["Runway ABC"], personal: ["VietJet Ops"], ignored: ["Gia đình"], coord: "AOG Coord" };
  it("classifies chats", () => {
    expect(classifyChat("runway  abc", lists)).toBe("team");
    expect(classifyChat("VietJet Ops", lists)).toBe("personal");
    expect(classifyChat("Gia đình", lists)).toBe("ignored");
    expect(classifyChat("AOG coord", lists)).toBe("coord");
    expect(classifyChat("Runway New Group", lists)).toBe("unknown");
    expect(classifyChat("", lists)).toBeNull();
  });
  it("builds the effective list without ignored/coord and without duplicates", () => {
    expect(effectiveGroups({ ...lists, personal: ["VietJet Ops", "runway abc", "Gia đình"] })).toEqual(["Runway ABC", "VietJet Ops"]);
  });
  it("adds/removes names case-insensitively", () => {
    expect(addName(["A"], " a ")).toEqual(["A"]);
    expect(removeName(["A", "B"], "a")).toEqual(["B"]);
    expect(uniqueNames(["x", "X", " y "])).toEqual(["x", "y"]);
  });
});

describe("blind detector", () => {
  const now = 10 * 60 * MIN;
  it("reports missing tabs", () => {
    const { sources } = evaluateSources({}, { now });
    expect(sources.whatsapp.status).toBe("missing");
    expect(sources.outlook.status).toBe("missing");
  });
  it("flags Outlook outside the AOG folder immediately", () => {
    const records = { outlook: { last_seen: now, stats: { rows_seen: 30, folder_gate: "blocked" } } };
    expect(evaluateSources(records, { now }).sources.outlook.status).toBe("wrong_folder");
  });
  it("becomes BLIND only after rows stay at zero longer than the threshold", () => {
    const records = { whatsapp: { last_seen: now, stats: { rows_seen: 0 } } };
    const first = evaluateSources(records, { now, zeroSince: {} });
    expect(first.sources.whatsapp.status).toBe("ok");
    const later = evaluateSources({ whatsapp: { last_seen: now + 6 * MIN, stats: { rows_seen: 0 } } }, { now: now + 6 * MIN, zeroSince: first.zeroSince });
    expect(later.sources.whatsapp.status).toBe("blind");
    expect(problemsOf(later).map((item) => item.source)).toContain("whatsapp");
  });
  it("recovers when rows come back", () => {
    const result = evaluateSources({ whatsapp: { last_seen: now, stats: { rows_seen: 5 } } }, { now, zeroSince: { whatsapp: now - 20 * MIN } });
    expect(result.sources.whatsapp.status).toBe("ok");
    expect(result.zeroSince.whatsapp).toBeNull();
  });
});

describe("preflight", () => {
  const good = {
    config: { self_display_name: "Hoài" },
    sources: { whatsapp: { status: "ok" }, outlook: { status: "ok" } },
    sharepoint: { configured: true, ok: true },
    groupsSyncedAt: Date.now(),
    battery: { supported: true, charging: true, level: 0.9 },
    soundConfirmedAt: Date.now(),
    shiftStartedAt: Date.now(),
    peers: [{ on_shift: true, status: "alive", name: "Toàn" }],
  };
  it("is ready when every blocking item passes", () => {
    const result = runPreflight(good);
    expect(result.ready).toBe(true);
    expect(result.failed).toEqual([]);
  });
  it("blocks readiness for wrong folder, unplugged charger and unconfirmed sound", () => {
    const result = runPreflight({ ...good, sources: { ...good.sources, outlook: { status: "wrong_folder", message: "Outlook không ở hộp AOG" } }, battery: { supported: true, charging: false, level: 0.4 }, soundConfirmedAt: 0 });
    expect(result.ready).toBe(false);
    expect(result.failed).toEqual(expect.arrayContaining(["outlook", "power", "sound"]));
    expect(result.items.find((item) => item.key === "outlook").hint).toContain("hộp AOG");
  });
  it("only warns when SharePoint is not configured", () => {
    const result = runPreflight({ ...good, sharepoint: { configured: false } });
    expect(result.items.find((item) => item.key === "sharepoint").status).toBe("warn");
    expect(result.ready).toBe(true);
  });
});

describe("shift reminder", () => {
  const slots = [{ start: "22:00", end: "02:30", role: "primary" }];
  const at = (h, m) => { const d = new Date(2026, 8, 28, h, m); return d; };
  it("nudges at shift start and escalates after the grace period", () => {
    expect(shiftReminderState({ slots, now: at(21, 50) }).level).toBe("none");
    expect(shiftReminderState({ slots, now: at(22, 3) }).level).toBe("nudge");
    expect(shiftReminderState({ slots, now: at(22, 11) }).level).toBe("overdue");
  });
  it("stays silent when the shift is already open", () => {
    expect(shiftReminderState({ slots, now: at(22, 30), hasSession: true }).level).toBe("none");
  });
  it("keys reminders by night so they fire once", () => {
    const a = shiftReminderState({ slots, now: at(22, 15) });
    const b = shiftReminderState({ slots, now: new Date(2026, 8, 29, 0, 5) });
    expect(a.key).toBe(b.key);
  });
});

describe("heartbeat", () => {
  const now = Date.parse("2026-09-28T20:00:00Z");
  const rows = [
    { MachineId: "me", ShiftId: "s1", LastBeat: new Date(now).toISOString() },
    { MachineId: "b", OperatorName: "B", ShiftId: "s2", LastBeat: new Date(now - 6 * MIN).toISOString(), Ready: "1" },
    { MachineId: "c", ShiftId: "", LastBeat: new Date(now - 60 * MIN).toISOString() },
  ];
  it("marks peers on shift without recent beats as lost, ignores self and off-shift", () => {
    const peers = evaluatePeers(rows, { selfId: "me", now, lostAfterMinutes: 5 });
    expect(peers.map((peer) => [peer.machine_id, peer.status])).toEqual([["b", "lost"], ["c", "off"]]);
    expect(peers[0].ready).toBe(true);
  });
  it("finds local offline gaps", () => {
    const ticks = [0, MIN, 2 * MIN, 20 * MIN, 21 * MIN];
    expect(findGaps(ticks)).toEqual([{ from: 2 * MIN, to: 20 * MIN }]);
    expect(wasOfflineAt(ticks, 10 * MIN)).toBe(true);
    expect(wasOfflineAt(ticks, MIN + 1)).toBe(false);
  });
});

describe("miss cause", () => {
  it("gives exactly one cause per miss", () => {
    expect(classifyMiss({ kind: "missed" }).cause).toBe(MISS_CAUSE.PERSON);
    expect(classifyMiss({ kind: "missed", audioFailed: true }).cause).toBe(MISS_CAUSE.MACHINE);
    expect(classifyMiss({ kind: "missed", soundConfirmed: false }).cause).toBe(MISS_CAUSE.SETUP);
    expect(classifyMiss({ kind: "leak", shiftActive: false }).cause).toBe(MISS_CAUSE.SETUP);
    expect(classifyMiss({ kind: "leak", machineOffline: true }).cause).toBe(MISS_CAUSE.MACHINE);
    expect(classifyMiss({ kind: "leak", sourceStatus: "wrong_folder" }).cause).toBe(MISS_CAUSE.SETUP);
    expect(classifyMiss({ kind: "leak", sourceStatus: "blind" }).cause).toBe(MISS_CAUSE.WATCHER);
    expect(classifyMiss({ kind: "leak" }).cause).toBe(MISS_CAUSE.WATCHER);
  });
});

describe("follow-up after ACK", () => {
  const alert = { alert_id: "a1", group_name: "Runway ABC", source: "whatsapp" };
  it("asks after the delay, then goes overdue without an answer", () => {
    let list = [createFollowup(alert, { now: 0, askAfterMinutes: 10 })];
    let tick = tickFollowups(list, { now: 9 * MIN });
    expect(tick.actions).toEqual([]);
    tick = tickFollowups(tick.followups, { now: 10 * MIN });
    expect(tick.actions.map((a) => a.type)).toEqual(["ask"]);
    tick = tickFollowups(tick.followups, { now: 16 * MIN, answerWithinMinutes: 5 });
    expect(tick.actions.map((a) => a.type)).toEqual(["overdue"]);
    expect(tick.followups).toEqual([]);
    list = [createFollowup(alert, { now: 0 })];
  });
  it("done removes it; snooze asks again later", () => {
    const list = [{ ...createFollowup(alert, { now: 0 }), status: "asking", asked_at: 10 * MIN }];
    expect(answerFollowup(list, "a1", "done")).toEqual([]);
    const snoozed = answerFollowup(list, "a1", "snooze", { now: 11 * MIN, snoozeMinutes: 10 });
    expect(snoozed[0].status).toBe("waiting");
    expect(snoozed[0].ask_at).toBe(21 * MIN);
  });
});

describe("outbox", () => {
  it("queues, backs off on failure and completes", () => {
    let queue = enqueueOp([], { kind: "add", list: "AOG_Events", fields: { Title: "x" } }, { now: 0 });
    const id = queue[0].id;
    expect(dueOps(queue, { now: 0 })).toHaveLength(1);
    queue = failOp(queue, id, { now: 0, error: "offline" });
    expect(dueOps(queue, { now: 1000 })).toHaveLength(0);
    expect(dueOps(queue, { now: 31_000 })).toHaveLength(1);
    expect(completeOp(queue, id)).toEqual([]);
  });
});

describe("shared settings", () => {
  it("applies only shared keys from SharePoint and never personal ones", () => {
    const shared = parseSettingsRows([
      { Title: "outlook_watch_path", Value: "\"/mail/aog@x.vn/\"" },
      { Title: "primary_timeout_seconds", Value: "90" },
      { Title: "self_display_name", Value: "\"Hacker\"" },
      { Title: "shift_slots", Value: "[]" },
    ]);
    expect(shared).toEqual({ outlook_watch_path: "/mail/aog@x.vn/", primary_timeout_seconds: 90 });
    const config = applySharedSettings({ self_display_name: "Hoài", primary_timeout_seconds: 120 }, shared);
    expect(config.self_display_name).toBe("Hoài");
    expect(config.primary_timeout_seconds).toBe(90);
    expect(changedKeys({ primary_timeout_seconds: 120 }, config)).toContain("primary_timeout_seconds");
    for (const key of ["self_display_name", "shift_slots", "test_mode", "dry_run", "ignored_chats", "customer_groups", "sharepoint_site_url"]) expect(SHARED_KEYS).not.toContain(key);
  });
});

describe("night shift row", () => {
  it("maps a night to one date even after midnight", () => {
    const evening = new Date(2026, 6, 28, 22, 5).toISOString();
    const early = new Date(2026, 6, 29, 2, 40).toISOString();
    expect(shiftDate(evening)).toBe("2026-07-28");
    expect(shiftDate(early)).toBe("2026-07-28");
  });
  it("writes only the columns of this machine's role", () => {
    const session = { shift_id: "s1", started_at: new Date(2026, 6, 28, 22, 5).toISOString() };
    const events = [
      { shift_id: "s1", event_type: "DETECTED" },
      { shift_id: "s1", event_type: "ACK", group_name: "Runway ABC", timestamp: new Date(2026, 6, 28, 23, 10).toISOString() },
      { shift_id: "other", event_type: "ACK", group_name: "X" },
    ];
    const fields = shiftRowFields({ session, role: "backup", name: "B", email: "b@x.vn", ready: true, events });
    expect(fields.ShiftDate).toBe("2026-07-28");
    expect(fields.BackupName).toBe("B");
    expect(fields.BackupReady).toBe("Sẵn sàng");
    expect(Object.keys(fields).some((key) => key.startsWith("Primary"))).toBe(false);
    expect(fields.AlertCount).toBe("1");
    expect(ackLog(events, "s1")).toMatch(/23:10 Runway ABC/);
  });
});
