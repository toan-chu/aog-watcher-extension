import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { evaluatePeers } from "../lib/heartbeat.js";
import { backupCountdownText, peerEvidence } from "../lib/popup_view.js";

const slots = [{ start: "22:00", end: "02:30", role: "primary" }, { start: "02:30", end: "07:00", role: "backup" }];
const afternoon = new Date(2026, 10, 11, 14, 43).getTime();
const row = (role, testMode) => ({
  MachineId: "peer", OperatorName: "Ethan", Role: role, ShiftId: "s1", LastBeat: new Date(afternoon - 30_000).toISOString(),
  Problems: JSON.stringify({ problems: [], shift_slots: slots, test_mode: testMode }),
});

describe("test day: partner machine", () => {
  it("keeps the forced Test role of a partner outside shift hours", () => {
    const [peer] = evaluatePeers([row("backup", true)], { selfId: "me", now: afternoon });
    expect(peer).toMatchObject({ role: "backup", on_shift: true, status: "alive" });
  });

  it("still uses the schedule when the partner is not in Test mode", () => {
    const [peer] = evaluatePeers([row("backup", false)], { selfId: "me", now: afternoon });
    expect(peer.role).toBe("off");
  });

  it("shows the Backup on a Primary machine and the Primary on a Backup machine", () => {
    const base = { sharepoint: { configured: true } };
    const backup = { on_shift: true, role: "backup", status: "alive", name: "Ethan" };
    const primary = { on_shift: true, role: "primary", status: "alive", name: "Ryan" };
    expect(peerEvidence({ ...base, current_role: "primary", peers: [backup] })).toEqual({ tone: "ok", text: "Ethan" });
    expect(peerEvidence({ ...base, current_role: "backup", peers: [primary] })).toEqual({ tone: "ok", text: "Ryan" });
    expect(peerEvidence({ ...base, current_role: "backup", peers: [] })).toEqual({ tone: "warn", text: "No primary on duty" });
  });
});

describe("test day: greeting typed once", () => {
  it("never sends the synthetic input event after execCommand already typed the greeting", async () => {
    const source = await readFile(new URL("../content_whatsapp.js", import.meta.url), "utf8");
    const helper = source.slice(source.indexOf("function typeIntoComposer"), source.indexOf("async function openChatAndDraft"));
    expect(helper).toContain('if (!document.execCommand("insertText", false, text)) {');
    expect(helper).toContain("await sleep(50)");
    expect(source.match(/composer\.dispatchEvent\(new InputEvent/g)).toHaveLength(1);
    expect(source.match(/await typeIntoComposer\(composer, text\);/g)).toHaveLength(2);
  });
});

describe("Test tab in the popup", () => {
  it("is a fourth tab behind a password, and Settings no longer has a Testing section", async () => {
    const [html, js, settings] = await Promise.all(["popup.html", "popup.js", "settings.html"].map((name) => readFile(new URL(`../${name}`, import.meta.url), "utf8")));
    expect(html).toContain('id="testTab"');
    expect(html).toContain('<option value="solo">');
    expect(js).toContain('const TEST_PASSWORD = "deptrai";');
    expect(js).toContain('type: "SIMULATE_ALERT", source: "whatsapp"');
    expect(js).toContain('type: "SIMULATE_ALERT", source: "email"');
    expect(settings).not.toContain('id="testMode"');
    expect(settings).not.toContain('id="dryRun"');
  });

  it("explains Solo on the ringing screen and the partner row", () => {
    const now = 1_000_000;
    expect(backupCountdownText({ solo: true, backup_call_at: now + 65_000 }, now)).toBe("Simulated Backup in 01:05");
    expect(backupCountdownText({ solo: true, current_alert: { backup_stage: true } }, now)).toBe("Backup stage (simulated)");
    expect(peerEvidence({ solo: true })).toEqual({ tone: "ok", text: "Solo test: this machine plays both" });
  });
});

describe("silent machines", () => {
  it("a machine silent for more than 12 hours is off duty, not lost", () => {
    const old = { ...row("primary", true), LastBeat: new Date(afternoon - 13 * 3_600_000).toISOString() };
    const [peer] = evaluatePeers([old], { selfId: "me", now: afternoon });
    expect(peer).toMatchObject({ on_shift: false, status: "off" });
  });

  it("a machine silent for 10 minutes is still lost", () => {
    const recent = { ...row("primary", true), LastBeat: new Date(afternoon - 10 * 60_000).toISOString() };
    const [peer] = evaluatePeers([recent], { selfId: "me", now: afternoon });
    expect(peer).toMatchObject({ on_shift: true, status: "lost" });
  });
});

describe("Outlook: open the email that rang", () => {
  it("the Outlook content script answers OPEN_OUTLOOK_MESSAGE by id, then by subject, and never sends anything", async () => {
    const source = await readFile(new URL("../content_outlook.js", import.meta.url), "utf8");
    expect(source).toContain('message.type !== "OPEN_OUTLOOK_MESSAGE"');
    const finder = source.slice(source.indexOf("function findMessageRow"), source.indexOf("function openMessage"));
    expect(finder.indexOf("=== messageId")).toBeLessThan(finder.indexOf("wantSubject"));
    const opener = source.slice(source.indexOf("function openMessage"), source.indexOf("function scheduleScan"));
    expect(opener).toContain("row.click()");
    expect(opener).not.toMatch(/send|reply/i);
  });
});
