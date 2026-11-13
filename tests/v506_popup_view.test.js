import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { acceptAllView, backupCountdownText, eventSentence, formatClock24, peerEvidence, popupMode, slotRoleSummary, statusBadge, watchingSummary } from "../lib/popup_view.js";

const popupHtml = await readFile(new URL("../popup.html", import.meta.url), "utf8");

describe("V5-06 contextual popup", () => {
  it("selects exactly one Tonight screen from runtime status", () => {
    expect(popupMode({ app_state: "IDLE", session: null })).toBe("off-shift");
    expect(popupMode({ app_state: "IDLE", session: { shift_id: "s1" } })).toBe("watching");
    expect(popupMode({ app_state: "ALERTING", session: { shift_id: "s1" } })).toBe("ringing");
  });

  it("keeps Accept before the ringing details, system alerts and unknown chats", () => {
    const ringing = popupHtml.slice(popupHtml.indexOf('id="ringingScreen"'), popupHtml.indexOf('id="searchPanel"'));
    const positions = ["acceptButton", "acceptAllButton", "alertTitle", "systemAlerts", "unknownChats"].map((id) => ringing.indexOf(`id="${id}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it("formats clocks without depending on the Windows locale", () => {
    expect(formatClock24(new Date(2026, 10, 10, 7, 5, 9), { seconds: true })).toBe("07:05:09");
    expect(formatClock24(new Date(2026, 10, 10, 22, 3, 0))).toBe("22:03");
    expect(popupHtml).not.toContain('type="time"');
  });

  it("writes recent events as English sentences instead of event codes", () => {
    expect(eventSentence({ event_type: "ACCEPT", group_name: "AOG CX", operator_name: "Toan" })).toBe("Toan accepted AOG CX.");
    expect(eventSentence({ event_type: "SHIFT_STARTED" })).toBe("Shift started.");
    expect(eventSentence({ event_type: "UNMAPPED_CODE" })).toBe("");
    expect(eventSentence({ event_type: "MUTE_CHANGED", what: "outlook", on: true })).toBe("Outlook ringing turned off.");
  });

  it("marks WATCHING red when either message detector is unhealthy", () => {
    expect(watchingSummary({ sources: { whatsapp: { status: "ok" }, outlook: { status: "blind" } } })).toEqual({
      title: "Watcher needs attention",
      copy: "WhatsApp or Outlook is not watching for AOG messages.",
      tone: "bad",
    });
    expect(watchingSummary({ sources: { whatsapp: { status: "ok" }, outlook: { status: "ok" } } })).toEqual({
      title: "Watching",
      copy: "This machine is actively watching for AOG messages.",
      tone: "ok",
    });
  });

  it("uses a red ATTENTION badge when WATCHING is unhealthy", () => {
    expect(statusBadge({ app_state: "IDLE", session: { shift_id: "s1" }, sources: { whatsapp: { status: "blind" }, outlook: { status: "ok" } } })).toEqual({ text: "ATTENTION", state: "attention" });
    expect(statusBadge({ app_state: "IDLE", session: { shift_id: "s1" }, sources: { whatsapp: { status: "ok" }, outlook: { status: "ok" } } })).toEqual({ text: "WATCHING", state: "watching" });
  });

  it("shows an Off-duty warning and next duty time instead of green Watching", () => {
    const status = {
      app_state: "IDLE", session: { shift_id: "s1" }, within_shift: false,
      next_duty_at: new Date(2026, 10, 11, 22, 0).toISOString(),
      sources: { whatsapp: { status: "ok" }, outlook: { status: "ok" } },
    };
    expect(watchingSummary(status)).toEqual({
      title: "Off duty",
      copy: "This machine will not ring. Next duty starts at 22:00.",
      tone: "warn",
    });
    expect(statusBadge(status)).toEqual({ text: "OFF DUTY", state: "idle" });
  });

  it("shows No backup on duty as information and exposes Accept all from two alerts", () => {
    expect(peerEvidence({ sharepoint: { configured: true }, peers: [] })).toEqual({ tone: "warn", text: "No backup on duty" });
    expect(acceptAllView({ pending_count: 1 })).toEqual({ hidden: true, label: "Accept all (1)", count: "1 pending alert" });
    expect(acceptAllView({ pending_count: 2 })).toEqual({ hidden: false, label: "Accept all (2)", count: "2 pending alerts" });
    expect(acceptAllView({ pending_count: 3 })).toEqual({ hidden: false, label: "Accept all (3)", count: "3 pending alerts" });
  });

  it("does not promise a Backup call when none is on duty", () => {
    const now = new Date(2026, 10, 11, 22, 0).getTime();
    expect(backupCountdownText({ current_role: "primary", peers: [], backup_call_at: now + 82_000 }, now)).toBe("No backup on duty");
    expect(backupCountdownText({ current_role: "primary", peers: [{ role: "backup", on_shift: true, status: "alive" }], backup_call_at: now + 82_000 }, now)).toBe("Calling Backup in 01:22");
  });

  it("describes each configured slot instead of saying the user is Off all night", () => {
    expect(slotRoleSummary([{ role: "off" }, { role: "primary" }])).toBe("Slot 1 Off · Slot 2 Primary");
  });
});
