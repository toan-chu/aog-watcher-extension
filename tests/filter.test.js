import { describe, expect, it } from "vitest";
import { isCoordGroup, shouldAlertWhatsAppGroup, shouldSkipEmail } from "../lib/filter.js";

const config = { skip_sender_domains: ["trustana.vn"], subject_keywords: ["AOG", "urgent"], customer_groups: ["Airline A"], coord_group: "AOG Coord" };

describe("filters", () => {
  it("skips configured sender domains", () => expect(shouldSkipEmail({ sender: "ops@trustana.vn", subject: "AOG" }, config)).toBe(true));
  it("does not confuse domain suffixes", () => expect(shouldSkipEmail({ sender: "ops@nottrustana.vn", subject: "AOG" }, config)).toBe(false));
  it("skips email without required keyword", () => expect(shouldSkipEmail({ sender: "x@example.com", subject: "hello" }, config)).toBe(true));
  it("matches keywords case-insensitively", () => expect(shouldSkipEmail({ sender: "x@example.com", subject: "aog quote" }, config)).toBe(false));
  it("alerts only configured customer group", () => expect(shouldAlertWhatsAppGroup("airline a", config)).toBe(true));
  it("rejects coordination group", () => expect(shouldAlertWhatsAppGroup("AOG Coord", config)).toBe(false));
  it("identifies coordination group", () => expect(isCoordGroup("aog coord", config)).toBe(true));
});

