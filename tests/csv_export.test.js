import { describe, expect, it } from "vitest";
import { eventsToCsv } from "../lib/csv_export.js";

describe("eventsToCsv", () => {
  it("adds an Excel-friendly BOM and header", () => expect(eventsToCsv([])).toMatch(/^\uFEFFtimestamp,alert_id,/));
  it("escapes commas, quotes, and newlines", () => {
    const csv = eventsToCsv([{ subject: 'AOG, "urgent"\nline 2' }]);
    expect(csv).toContain('"AOG, ""urgent""\nline 2"');
  });
});

