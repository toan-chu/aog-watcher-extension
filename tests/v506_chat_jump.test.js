import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, MESSAGE } from "../lib/constants.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [content, worker, popup, settingsHtml, settingsJs] = await Promise.all([
  "content_whatsapp.js", "service_worker.js", "popup.js", "settings.html", "settings.js",
].map(read));

describe("V5-06 chat jump safety", () => {
  it("provides the editable default greeting and shared navigation messages", () => {
    expect(DEFAULT_CONFIG.whatsapp_greeting).toBe("Well received. We are checking and will revert shortly.");
    expect(MESSAGE.OPEN_WHATSAPP_CHAT).toBe("OPEN_WHATSAPP_CHAT");
    expect(MESSAGE.GET_ACTIVE_WHATSAPP_CHAT).toBe("GET_ACTIVE_WHATSAPP_CHAT");
    expect(settingsHtml).toContain('id="whatsappGreeting"');
    expect(settingsJs).toContain("config.whatsapp_greeting");
  });

  it("uses one open-and-draft helper that never clicks Send", () => {
    const helper = content.slice(content.indexOf("async function openChatAndDraft"), content.indexOf("async function sendPeerTag"));
    expect(helper).toContain("draftDecision");
    expect(helper).toContain("insertText");
    expect(helper).not.toContain(".click(");
  });

  it("finishes Accept dispatch before attempting source navigation", () => {
    const handler = worker.slice(worker.indexOf("case MESSAGE.ACCEPT_CURRENT"), worker.indexOf("case MESSAGE.START_SHIFT"));
    expect(handler.indexOf('dispatch({ type: "ALERT_ACCEPT" })')).toBeGreaterThan(-1);
    expect(handler.indexOf("openAlertTarget(")).toBeGreaterThan(handler.indexOf('dispatch({ type: "ALERT_ACCEPT" })'));
  });

  it("opens recent events without a greeting and Help at the public README", () => {
    expect(popup).toContain('type: "OPEN_ALERT_TARGET", target: event, draft_text: ""');
    expect(popup).toContain("https://github.com/toan-chu/aog-watcher-extension#readme");
  });
});
