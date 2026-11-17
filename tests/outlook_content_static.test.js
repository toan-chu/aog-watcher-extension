import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const content = await readFile(new URL("../content_outlook.js", import.meta.url), "utf8");

describe("Outlook content script (5.2: AOG folder unread count)", () => {
  it("reports only the folder count, never single emails", () => {
    expect(content).toContain('type: "OUTLOOK_UNREAD"');
    expect(content).not.toContain("ALERT_DETECTED");
  });

  it("rescans every 2 seconds in case a change is missed, and reports health", () => {
    expect(content).toContain("runtime.setSafeInterval(scheduleScan, 2_000)");
    expect(content).toContain('type: "CONTENT_HEALTH", source: "outlook"');
  });
});
