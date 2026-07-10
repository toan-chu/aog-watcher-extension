import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { shouldSkipEmail } from "../lib/filter.js";
import { deriveHealth, markSourceSeen } from "../lib/source_health.js";

const constants = await readFile(new URL("../lib/constants.js", import.meta.url), "utf8");
const storage = await readFile(new URL("../lib/storage.js", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../service_worker.js", import.meta.url), "utf8");
const whatsapp = await readFile(new URL("../content_whatsapp.js", import.meta.url), "utf8");
const outlook = await readFile(new URL("../content_outlook.js", import.meta.url), "utf8");
const outlookSelectors = await readFile(new URL("../lib/outlook_selectors.js", import.meta.url), "utf8");
const popupHtml = await readFile(new URL("../popup.html", import.meta.url), "utf8");
const popupJs = await readFile(new URL("../popup.js", import.meta.url), "utf8");
const settingsHtml = await readFile(new URL("../settings.html", import.meta.url), "utf8");
const settingsJs = await readFile(new URL("../settings.js", import.meta.url), "utf8");

describe("v4.3 P0 field feedback fixes", () => {
  it("adds persistent shift baseline storage and handshake messages", () => {
    expect(constants).toContain("SHIFT_BASELINE");
    expect(constants).toContain("BASELINE_SYNC");
    expect(constants).toContain("REBASELINE");
    expect(storage).toContain("getShiftBaseline");
    expect(storage).toContain("clearShiftBaseline");
  });

  it("creates baseline once per shift_id and reuses existing source snapshots", () => {
    expect(serviceWorker).toContain("handleBaselineSync");
    expect(serviceWorker).toContain("baseline.shift_id !== shiftId");
    expect(serviceWorker).toContain("baseline.sources");
  });

  it("sends REBASELINE to already-open tabs after START_SHIFT", () => {
    expect(serviceWorker).toContain("sendRebaselineToTabs");
    expect(serviceWorker).toContain("MESSAGE.REBASELINE");
  });

  it("clears the persisted baseline on END_SHIFT", () => {
    expect(serviceWorker).toContain("await clearShiftBaseline()");
  });

  it("seeds WhatsApp unread counts from baseline before alerting", () => {
    expect(whatsapp).toContain("seedBaseline");
    expect(whatsapp).toContain("lastUnreadByGroup.set(name, Number(unread) || 0)");
  });

  it("suppresses WhatsApp first-seen unread rows until baseline is ready", () => {
    expect(whatsapp).toContain("!baselineReady || previousUnread === undefined");
    expect(whatsapp).toContain("stats.suppressed_baseline += 1");
  });

  it("seeds Outlook seen IDs from baseline before alerting", () => {
    expect(outlook).toContain("seedBaseline");
    expect(outlook).toContain("for (const id of baseline.outlook_ids) seen.add(id)");
  });

  it("waits for a stable Outlook unread snapshot before syncing baseline", () => {
    expect(outlook).toContain("async function stableUnreadSnapshot");
    expect(outlook).toContain("await sleep(2000)");
    expect(outlook).toContain("sameSnapshot(firstSnapshot, secondSnapshot)");
    expect(outlook).toContain("if (rows.length === 0) return null");
    expect(outlook).toContain("const outlookIds = await stableUnreadSnapshot()");
  });

  it("blocks Outlook scans when outlook_watch_path does not match the current path", () => {
    expect(outlook).toContain("function folderGatePasses");
    expect(outlook).toContain("stats.folder_gate = gate.mode");
    expect(outlook).toContain("stats.suppressed_gate += 1");
  });

  it("recognizes Vietnamese unread labels for Outlook unread detection", () => {
    expect(outlookSelectors).toContain("đánh dấu là đã đọc");
    expect(outlook).toContain("isUnreadButton");
  });

  it("supports sender whitelist and display-name domain blacklist matching", () => {
    expect(shouldSkipEmail({ sender: "Commercial Trustana.vn", subject: "AOG" }, { skip_sender_domains: ["trustana.vn"] })).toBe(true);
    expect(shouldSkipEmail({ sender: "Vendor A", subject: "AOG" }, { sender_whitelist: ["AOG Vendor"] })).toBe(true);
    expect(shouldSkipEmail({ sender: "AOG Vendor Desk", subject: "hello" }, { sender_whitelist: ["vendor desk"] })).toBe(false);
  });

  it("stores scan stats in source health and exposes them through deriveHealth", () => {
    const health = deriveHealth(markSourceSeen({}, "whatsapp", 1000, { rows_seen: 3, unread_seen: 2, alerts_sent: 0 }), 2000);
    expect(health.whatsapp.stats).toMatchObject({ rows_seen: 3, unread_seen: 2, alerts_sent: 0 });
  });

  it("renders a collapsible diagnostics panel in the popup", () => {
    expect(popupHtml).toContain("Diagnostics");
    expect(popupJs).toContain("diagnosticText");
    expect(popupJs).toContain("diagnosticHint");
  });

  it("adds settings controls for Outlook folder gate and sender whitelist", () => {
    expect(settingsHtml).toContain("outlookWatchPath");
    expect(settingsHtml).toContain("senderWhitelist");
    expect(settingsJs).toContain("outlook_watch_path");
    expect(settingsJs).toContain("sender_whitelist");
  });
});
