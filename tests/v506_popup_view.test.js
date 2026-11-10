import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { eventSentence, formatClock24, popupMode } from "../lib/popup_view.js";

const popupHtml = await readFile(new URL("../popup.html", import.meta.url), "utf8");

describe("V5-06 contextual popup", () => {
  it("selects exactly one Tonight screen from runtime status", () => {
    expect(popupMode({ app_state: "IDLE", session: null })).toBe("off-shift");
    expect(popupMode({ app_state: "IDLE", session: { shift_id: "s1" } })).toBe("watching");
    expect(popupMode({ app_state: "ALERTING", session: { shift_id: "s1" } })).toBe("ringing");
  });

  it("keeps Accept before the ringing details, system alerts and unknown chats", () => {
    const ringing = popupHtml.slice(popupHtml.indexOf('id="ringingScreen"'), popupHtml.indexOf('id="searchPanel"'));
    const positions = ["acceptButton", "alertTitle", "systemAlerts", "unknownChats"].map((id) => ringing.indexOf(`id="${id}"`));
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
    expect(eventSentence({ event_type: "UNMAPPED_CODE" })).toBe("Watcher recorded an update.");
  });
});
