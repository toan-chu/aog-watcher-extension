import { describe, expect, it } from "vitest";
import { isWithinShift } from "../lib/shift_engine.js";

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

