import { describe, expect, it } from "vitest";
import "../lib/outlook_message_id.js";

function element(attributes = {}, parentElement = null) {
  return {
    nodeType: 1,
    parentElement,
    getAttribute(name) {
      return attributes[name] ?? null;
    },
  };
}

describe("Outlook message ID helper", () => {
  it("prefers stable IDs found on ancestor nodes", () => {
    const parent = element({ "data-item-id": "item-123" });
    const row = element({}, parent);
    expect(globalThis.AOG_OUTLOOK_MESSAGE_ID.stableOutlookMessageId(row, "Ops", "AOG")).toBe("item-123");
  });

  it("ignores unstable display date and normalizes sender plus subject fallback", () => {
    const row = { ...element(), textContent: "Ops AOG TEST Preview 10:07 AM" };
    const first = globalThis.AOG_OUTLOOK_MESSAGE_ID.stableOutlookMessageId(row, " OPS@EXAMPLE.COM ", " AOG   TEST ");
    const second = globalThis.AOG_OUTLOOK_MESSAGE_ID.stableOutlookMessageId({ ...row, textContent: "Ops AOG TEST Preview 10:07 AM" }, "ops@example.com", "AOG TEST");
    expect(first).toBe("email|ops@example.com|aog test|ops aog test preview 10:07 am");
    expect(second).toBe(first);
  });

  it("distinguishes repeated sender and subject when row text differs", () => {
    const first = globalThis.AOG_OUTLOOK_MESSAGE_ID.stableOutlookMessageId({ ...element(), textContent: "Toan Chu aog - test aaaa 10:07 AM" }, "Toan Chu", "aog - test");
    const second = globalThis.AOG_OUTLOOK_MESSAGE_ID.stableOutlookMessageId({ ...element(), textContent: "Toan Chu aog - test bbbb 10:09 AM" }, "Toan Chu", "aog - test");
    expect(first).not.toBe(second);
  });
});
