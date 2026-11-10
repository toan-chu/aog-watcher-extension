import { describe, expect, it } from "vitest";
import { isDutyRole, isWithinAnyDutySlot, isWithinShift, normalizeSlots, resolveRoleAtTime } from "../lib/shift_engine.js";

const at = (hour, minute = 0) => new Date(2026, 5, 22, hour, minute);

describe("isWithinShift", () => {
  it("accepts a normal daytime shift", () => expect(isWithinShift(at(10), "09:00", "17:00")).toBe(true));
  it("rejects outside a daytime shift", () => expect(isWithinShift(at(18), "09:00", "17:00")).toBe(false));
  it("accepts before midnight in overnight shift", () => expect(isWithinShift(at(23), "22:00", "08:00")).toBe(true));
  it("accepts after midnight in overnight shift", () => expect(isWithinShift(at(2), "22:00", "08:00")).toBe(true));
  it("rejects after overnight shift", () => expect(isWithinShift(at(10), "22:00", "08:00")).toBe(false));
  it("treats equal boundaries as 24 hours", () => expect(isWithinShift(at(10), "00:00", "00:00")).toBe(true));
  it("rejects invalid input", () => expect(() => isWithinShift(at(10), "9", "17:00")).toThrow());
});

describe("duty slots", () => {
  it("keeps Off slots but excludes them from duty time", () => {
    const slots = normalizeSlots([
      { start: "20:00", end: "22:00", role: "off" },
      { start: "22:00", end: "23:00", role: "primary" },
    ]);
    expect(slots).toEqual([
      { start: "20:00", end: "22:00", role: "off" },
      { start: "22:00", end: "23:00", role: "primary" },
    ]);
    expect(resolveRoleAtTime(at(21), slots)?.role).toBe("off");
    expect(isWithinAnyDutySlot(at(21), slots)).toBe(false);
    expect(isWithinAnyDutySlot(at(22, 30), slots)).toBe(true);
    expect(isDutyRole("off")).toBe(false);
    expect(isDutyRole("backup")).toBe(true);
  });
});

