import { describe, expect, it } from "vitest";
import { isTagText, parseTag, serializeTag } from "../lib/peer_protocol.js";

const now = Date.parse("2026-06-22T10:00:00Z");
const payload = { alert_id: "a|1", source: "whatsapp", timestamp: "2026-06-22T10:00:00Z", from_role: "primary", operator: "Nguyen A" };

describe("peer protocol", () => {
  it("serializes escalation", () => expect(serializeTag("ESCALATED", payload)).toContain("[AOG-ESCALATED]|alert_id=a%7C1"));
  it("serializes handled", () => expect(serializeTag("HANDLED", payload)).toContain("[AOG-HANDLED]"));
  it("round trips encoded values", () => expect(parseTag(serializeTag("HANDLED", payload), { now })?.payload.alert_id).toBe("a|1"));
  it("rejects unknown prefix", () => expect(parseTag("hello", { now })).toBeNull());
  it("rejects malformed field", () => expect(parseTag("[AOG-HANDLED]|bad", { now })).toBeNull());
  it("rejects stale tag", () => expect(parseTag(serializeTag("HANDLED", payload), { now: now + 601000 })).toBeNull());
  it("can parse history when stale validation is disabled", () => expect(parseTag(serializeTag("HANDLED", payload), { now: now + 601000, rejectStale: false })).not.toBeNull());
  it("identifies tag text", () => expect(isTagText("[AOG-HANDLED]|x=y")).toBe(true));
  it("requires mandatory fields", () => expect(() => serializeTag("HANDLED", { alert_id: "a" })).toThrow());
});

