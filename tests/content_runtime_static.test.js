import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const runtime = await readFile(new URL("../lib/content_runtime.js", import.meta.url), "utf8");
const whatsapp = await readFile(new URL("../content_whatsapp.js", import.meta.url), "utf8");
const outlook = await readFile(new URL("../content_outlook.js", import.meta.url), "utf8");

describe("content runtime guard", () => {
  it("handles extension context invalidation and clears intervals", () => {
    expect(runtime).toContain("extension context invalidated");
    expect(runtime).toContain("clearInterval");
    expect(runtime).toContain("safeSendMessage");
  });

  it("routes long-lived content scripts through safe runtime wrappers", () => {
    expect(whatsapp).toContain("AOG_CONTENT_RUNTIME");
    expect(outlook).toContain("AOG_CONTENT_RUNTIME");
    expect(whatsapp).not.toContain("chrome.runtime.sendMessage");
    expect(outlook).not.toContain("chrome.runtime.sendMessage");
  });
});
