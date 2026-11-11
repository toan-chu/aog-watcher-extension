import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { evaluatePeers } from "../lib/heartbeat.js";
import { peerEvidence } from "../lib/popup_view.js";

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
