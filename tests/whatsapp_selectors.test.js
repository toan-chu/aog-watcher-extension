import { describe, expect, it } from "vitest";

describe("WhatsApp search box in any language", () => {
  it("finds the search box by Vietnamese label and by position, not only by the English word Search", async () => {
    await import("../lib/whatsapp_selectors.js");
    const list = globalThis.AOG_WHATSAPP_SELECTORS.searchBox;
    expect(list[0]).toContain("Search");
    expect(list.some((selector) => selector.includes("Tìm"))).toBe(true);
    expect(list.some((selector) => selector.startsWith("#side"))).toBe(true);
  });
});
