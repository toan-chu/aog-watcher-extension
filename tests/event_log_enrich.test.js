import { describe, expect, it } from "vitest";
import { enrichEventRecord } from "../lib/event_log.js";

describe("event log enrichment", () => {
  it("adds shift and operator context", () => {
    const record = enrichEventRecord(
      { event_type: "DETECTED", alert_id: "a", timestamp: "2026-06-23T10:00:00.000Z" },
      { session: { shift_id: "s1", started_at: "2026-06-23T09:00:00.000Z" }, config: { self_display_name: "Toan", partner_display_name: "Sam" } },
    );
    expect(record).toMatchObject({ shift_id: "s1", operator_name: "Toan", partner_name: "Sam", shift_start: "2026-06-23T09:00:00.000Z" });
  });

  it("calculates ACK response time from detected map", () => {
    const detected = new Map([["a", "2026-06-23T10:00:00.000Z"]]);
    const record = enrichEventRecord({ event_type: "ACK", alert_id: "a", timestamp: "2026-06-23T10:00:42.000Z" }, { detectedById: detected });
    expect(record.response_time_ms).toBe(42000);
  });
});
