import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const popupHtml = await readFile(new URL("../popup.html", import.meta.url), "utf8");
const popupJs = await readFile(new URL("../popup.js", import.meta.url), "utf8");

describe("popup safety copy", () => {
  it("uses inline End Shift confirmation instead of browser confirm", () => {
    expect(popupHtml).toContain("class=\"end-shift\"");
    expect(popupJs).toContain("Confirm end shift?");
    expect(popupJs).toContain("setTimeout(resetEndShiftConfirm, 5000)");
    expect(popupJs).not.toContain("confirm(");
  });

  it("renders recent event time through the locale-independent clock helper", () => {
    expect(popupJs).toContain("formatClock24(event.timestamp, { seconds: true })");
    expect(popupJs).not.toContain("toLocaleTimeString");
  });

  it("color-codes and truncates recent event context", () => {
    expect(popupJs).toContain("recent-event--ok");
    expect(popupJs).toContain("recent-event--danger");
    expect(popupJs).toContain("recent-event--warn");
    expect(popupJs).toContain("shortText(sentence, 60)");
    expect(popupJs).toContain("title: sentence");
  });
});

describe("popup 5.0", () => {
  it("offers Off for every shift slot", () => {
    const roleSelects = [...popupHtml.matchAll(/<select data-field="role">([\s\S]*?)<\/select>/g)].map((match) => match[1]);
    expect(roleSelects).toHaveLength(2);
    expect(roleSelects.every((html) => html.includes('<option value="off">Off</option>'))).toBe(true);
  });

  it("offers exactly two decisions for unknown chats: add to team list or ignore", () => {
    expect(popupJs).toContain("Add to shared list");
    expect(popupJs).toContain("Ignore");
    expect(popupJs).toContain('decision: "team"');
    expect(popupJs).toContain('decision: "ignore"');
    expect(popupJs).not.toContain('decision: "personal"');
  });

  it("never shows a source as green unless the blind detector says ok", () => {
    expect(popupJs).toContain('value?.status === "ok"');
    expect(popupJs).toContain("BLIND — reload the tab");
  });

  it("has start-of-shift checklist with sound test confirmation and leak report", () => {
    expect(popupHtml).toContain("Pre-shift check");
    expect(popupJs).toContain("SOUND_CONFIRMED");
    expect(popupJs).toContain("REPORT_LEAK");
    expect(popupJs).not.toContain("REPORT_BATTERY");
  });

  it("provides Tonight, Search and Help without connecting shipment search early", () => {
    for (const label of ["Tonight", "Search", "Help", "Shipment list is not connected yet"]) expect(popupHtml).toContain(label);
  });

  it("no longer exports CSV from the popup", () => {
    expect(popupJs).not.toContain("eventsToCsv");
    expect(popupHtml).not.toContain("exportButton");
  });
});
