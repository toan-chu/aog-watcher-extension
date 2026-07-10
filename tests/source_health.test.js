import { describe, expect, it } from "vitest";
import { deriveHealth, markAlertSourceSeen, markSourceSeen } from "../lib/source_health.js";

describe("source health", () => {
  it("records a heartbeat", () => {
    expect(markSourceSeen({}, "outlook", 1000)).toEqual({ outlook: { connected: true, last_seen: 1000 } });
  });

  it("ignores unknown sources", () => expect(markSourceSeen({}, "other", 1000)).toEqual({}));

  it("treats an email alert as an implicit Outlook heartbeat", () => {
    expect(markAlertSourceSeen({}, { source: "email" }, 2000)).toEqual({ outlook: { connected: true, last_seen: 2000 } });
  });

  it("reports a recent source connected", () => {
    expect(deriveHealth({ outlook: { last_seen: 1000 } }, 60_999).outlook.connected).toBe(true);
  });

  it("reports a source disconnected at the 60-second boundary", () => {
    expect(deriveHealth({ outlook: { last_seen: 1000 } }, 61_000).outlook.connected).toBe(false);
  });

  it("reports unseen sources disconnected", () => {
    expect(deriveHealth({}, 1000)).toMatchObject({ whatsapp: { connected: false }, outlook: { connected: false } });
  });
});
