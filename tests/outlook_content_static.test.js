import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const content = await readFile(new URL("../content_outlook.js", import.meta.url), "utf8");
const selectors = await readFile(new URL("../lib/outlook_selectors.js", import.meta.url), "utf8");

describe("Outlook content scan hardening", () => {
  it("uses wildcard Mark as read matching instead of exact aria-label only", () => {
    expect(content).toContain("button[aria-label*='Mark as read' i]");
  });

  it("derives candidate rows from unread buttons by climbing ancestors", () => {
    expect(content).toContain("function closestMessageRow");
    expect(content).toContain("function candidateRows");
  });

  it("periodically rescans Outlook in case mutation filters miss a row change", () => {
    expect(content).toContain("runtime.setSafeInterval(scheduleScan, 2_000)");
  });

  it("includes listitem and unread button fallbacks in selectors", () => {
    expect(selectors).toContain("[role='main'] [role='listitem']");
    expect(selectors).toContain("[role='main'] button[aria-label*='Mark as read' i]");
  });
});
