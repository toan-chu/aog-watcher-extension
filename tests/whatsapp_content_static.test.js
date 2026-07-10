import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const content = await readFile(new URL("../content_whatsapp.js", import.meta.url), "utf8");

describe("WhatsApp content P0 safety regressions", () => {
  it("does not require active coord conversation before scanning peer tags", () => {
    const scanPeerTags = content.slice(content.indexOf("function scanPeerTags"), content.indexOf("function messageExistsInCoordGroup"));
    expect(scanPeerTags).toContain("if (!config?.coord_group) return;");
    expect(scanPeerTags).not.toContain("activeConversationName");
    expect(scanPeerTags).not.toContain("isSameGroupName");
  });

  it("verifies peer tag appears after clicking send", () => {
    expect(content).toContain("async function verifyMessageSent");
    expect(content).toContain("await verifyMessageSent(text, 3000)");
    expect(content).toContain("message did not appear in coord group within 3s");
  });
});
