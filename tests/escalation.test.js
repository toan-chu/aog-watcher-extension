import { describe, expect, it } from "vitest";
import { backupShouldWake, shouldTriggerEscalation } from "../lib/escalation.js";

const alert = { detected_at: "2026-06-22T10:00:00Z" };
const now = Date.parse("2026-06-22T10:03:00Z");

describe("escalation", () => {
  it("primary wakes immediately", () => expect(backupShouldWake(alert, { role: "primary" }, 180, { now })).toBe(true));
  it("backup wakes on peer escalation", () => expect(backupShouldWake(alert, { role: "backup" }, 180, { escalated: true, now })).toBe(true));
  it("backup waits before delay", () => expect(backupShouldWake(alert, { role: "backup" }, 181, { now })).toBe(false));
  it("backup wakes at delay", () => expect(backupShouldWake(alert, { role: "backup" }, 180, { now })).toBe(true));
  it("requires a session", () => expect(backupShouldWake(alert, null, 180, { now })).toBe(false));
  it("only primary triggers escalation", () => { expect(shouldTriggerEscalation({ role: "primary" })).toBe(true); expect(shouldTriggerEscalation({ role: "backup" })).toBe(false); });
});

