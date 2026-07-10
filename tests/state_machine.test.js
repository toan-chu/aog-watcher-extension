import { describe, expect, it } from "vitest";
import { createInitialState, reduce } from "../lib/state_machine.js";

const timing = { primary_timeout_seconds: 120, backup_delay_seconds: 180, max_alert_duration_seconds: 540 };
const alert = (id = "a") => ({ alert_id: id, source: "whatsapp", detected_at: "2026-06-22T10:00:00Z", group_name: "AOG test", sender: "Toan Chu", subject: "AOG test subject" });
const detected = (overrides = {}) => ({ type: "ALERT_DETECTED", payload: { alert: alert(), within_shift: true, peer_handled: false, timing, ...overrides } });
const has = (result, type) => result.effects.some((effect) => effect.type === type);

describe("state machine", () => {
  it("primary starts alerting", () => { const result = reduce(createInitialState({ role: "primary" }), detected()); expect(result.state.app_state).toBe("ALERTING"); expect(has(result, "START_WAKE")).toBe(true); });
  it("backup remains silent and schedules delay", () => { const result = reduce(createInitialState({ role: "backup" }), detected()); expect(result.state.app_state).toBe("IDLE"); expect(result.effects).toContainEqual(expect.objectContaining({ type: "SCHEDULE_TIMER", name: "backup_delay" })); });
  it("out-of-shift alert is skipped", () => { const result = reduce(createInitialState({ role: "primary" }), detected({ within_shift: false })); expect(result.state.queue.findById("a").status).toBe("SKIPPED"); expect(has(result, "START_WAKE")).toBe(false); });
  it("deduplicates alert detection", () => { const first = reduce(createInitialState({ role: "backup" }), detected()); const second = reduce(first.state, detected()); expect(second.state.queue.all()).toHaveLength(1); expect(second.effects).toHaveLength(0); });
  it("local ACK stops and sends HANDLED", () => { const active = reduce(createInitialState({ role: "primary" }), detected()).state; const result = reduce(active, { type: "ALERT_ACK" }); expect(result.state.app_state).toBe("IDLE"); expect(has(result, "STOP_WAKE")).toBe(true); expect(result.effects).toContainEqual(expect.objectContaining({ type: "SEND_PEER_TAG", tag: "HANDLED" })); expect(result.effects).toContainEqual(expect.objectContaining({ payload: expect.objectContaining({ handled_by: "self" }) })); });
  it("local ACK log carries alert report context", () => {
    const active = reduce(createInitialState({ role: "primary" }), detected()).state;
    const result = reduce(active, { type: "ALERT_ACK" });
    expect(result.effects).toContainEqual(expect.objectContaining({
      payload: expect.objectContaining({ event_type: "ACK", group_name: "AOG test", sender: "Toan Chu", subject: "AOG test subject" }),
    }));
  });
  it("local ACK emits exactly one peer tag", () => { const active = reduce(createInitialState({ role: "primary" }), detected()).state; const result = reduce(active, { type: "ALERT_ACK" }); expect(result.effects.filter((effect) => effect.type === "SEND_PEER_TAG")).toHaveLength(1); });
  it("local ACK cancels timers only for the active alert", () => { const active = reduce(createInitialState({ role: "primary" }), detected()).state; const result = reduce(active, { type: "ALERT_ACK" }); const cancelled = result.effects.filter((effect) => effect.type === "CANCEL_TIMER"); expect(cancelled).toHaveLength(3); expect(cancelled.every((effect) => effect.alert_id === "a")).toBe(true); });
  it("primary timeout sends escalation without stopping", () => { const active = reduce(createInitialState({ role: "primary" }), detected()).state; const result = reduce(active, { type: "TIMER_PRIMARY_TIMEOUT", payload: { alert_id: "a" } }); expect(result.effects).toContainEqual(expect.objectContaining({ type: "SEND_PEER_TAG", tag: "ESCALATED" })); expect(has(result, "STOP_WAKE")).toBe(false); });
  it("backup delay starts wake", () => { const queued = reduce(createInitialState({ role: "backup" }), detected()).state; const result = reduce(queued, { type: "TIMER_BACKUP_DELAY", payload: { alert_id: "a", timing } }); expect(result.state.app_state).toBe("ALERTING"); expect(has(result, "START_WAKE")).toBe(true); });
  it("peer escalation wakes backup", () => { const queued = reduce(createInitialState({ role: "backup" }), detected()).state; const result = reduce(queued, { type: "PEER_ESCALATED_RECEIVED", payload: { alert_id: "a", source: "whatsapp", timestamp: alert().detected_at, timing } }); expect(result.state.app_state).toBe("ALERTING"); });
  it("peer escalation is ignored by primary", () => { const result = reduce(createInitialState({ role: "primary" }), { type: "PEER_ESCALATED_RECEIVED", payload: { alert_id: "a", timing } }); expect(result.effects).toHaveLength(0); });
  it("peer HANDLED stops matching active wake", () => { const active = reduce(createInitialState({ role: "primary" }), detected()).state; const result = reduce(active, { type: "PEER_HANDLED_RECEIVED", payload: { alert_id: "a", source: "whatsapp", timestamp: alert().detected_at } }); expect(result.state.app_state).toBe("IDLE"); expect(has(result, "STOP_WAKE")).toBe(true); expect(result.effects).toContainEqual(expect.objectContaining({ payload: expect.objectContaining({ handled_by: "partner" }) })); });
  it("peer HANDLED log carries alert report context", () => {
    const active = reduce(createInitialState({ role: "primary" }), detected()).state;
    const result = reduce(active, { type: "PEER_HANDLED_RECEIVED", payload: { alert_id: "a", source: "whatsapp", timestamp: alert().detected_at } });
    expect(result.effects).toContainEqual(expect.objectContaining({
      payload: expect.objectContaining({ event_type: "PEER_HANDLED", group_name: "AOG test", sender: "Toan Chu", subject: "AOG test subject" }),
    }));
  });
  it("peer HANDLED skips queued alert", () => { const queued = reduce(createInitialState({ role: "backup" }), detected()).state; const result = reduce(queued, { type: "PEER_HANDLED_RECEIVED", payload: { alert_id: "a", source: "whatsapp", timestamp: alert().detected_at } }); expect(result.state.queue.findById("a").status).toBe("SKIPPED"); });
  it("max duration records missed", () => { const active = reduce(createInitialState({ role: "primary" }), detected()).state; const result = reduce(active, { type: "TIMER_MAX_DURATION", payload: { alert_id: "a" } }); expect(result.state.queue.findById("a").status).toBe("MISSED"); expect(result.effects).toContainEqual(expect.objectContaining({ payload: expect.objectContaining({ handled_by: "missed" }) })); });
  it("MISSED log carries alert report context", () => {
    const active = reduce(createInitialState({ role: "primary" }), detected()).state;
    const result = reduce(active, { type: "TIMER_MAX_DURATION", payload: { alert_id: "a" } });
    expect(result.effects).toContainEqual(expect.objectContaining({
      payload: expect.objectContaining({ event_type: "MISSED", group_name: "AOG test", sender: "Toan Chu", subject: "AOG test subject" }),
    }));
  });
  it("unmatched peer HANDLED is a logged no-op", () => { const result = reduce(createInitialState({ role: "backup" }), { type: "PEER_HANDLED_RECEIVED", payload: { alert_id: "x", source: "email" } }); expect(result.state.app_state).toBe("IDLE"); expect(result.effects[0].payload.event_type).toBe("PEER_HANDLED_RECEIVED_NO_MATCH"); });
  it("changes role", () => { const result = reduce(createInitialState({ role: "primary" }), { type: "ROLE_CHANGED", payload: { role: "backup" } }); expect(result.state.session.role).toBe("backup"); });
});
