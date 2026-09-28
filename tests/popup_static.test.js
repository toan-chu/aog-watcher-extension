import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const popupHtml = await readFile(new URL("../popup.html", import.meta.url), "utf8");
const popupJs = await readFile(new URL("../popup.js", import.meta.url), "utf8");

describe("popup safety copy", () => {
  it("uses inline End Shift confirmation instead of browser confirm", () => {
    expect(popupHtml).toContain("class=\"end-shift\"");
    expect(popupJs).toContain("Xác nhận kết thúc ca?");
    expect(popupJs).toContain("setTimeout(resetEndShiftConfirm, 5000)");
    expect(popupJs).not.toContain("confirm(");
  });

  it("renders recent event time in local Vietnamese time and not raw UTC slice", () => {
    expect(popupJs).toContain("toLocaleTimeString(\"vi-VN\"");
    expect(popupJs).not.toContain("slice(11, 19)");
  });

  it("color-codes and truncates recent event context", () => {
    expect(popupJs).toContain("recent-event--ok");
    expect(popupJs).toContain("recent-event--danger");
    expect(popupJs).toContain("recent-event--warn");
    expect(popupJs).toContain("shortText(text, 60)");
    expect(popupJs).toContain("title: text");
  });
});

describe("popup 5.0", () => {
  it("offers exactly two decisions for unknown chats: add to team list or ignore", () => {
    expect(popupJs).toContain("Thêm vào danh sách chung");
    expect(popupJs).toContain("Bỏ qua");
    expect(popupJs).toContain('decision: "team"');
    expect(popupJs).toContain('decision: "ignore"');
    expect(popupJs).not.toContain('decision: "personal"');
  });

  it("never shows a source as green unless the blind detector says ok", () => {
    expect(popupJs).toContain('value.status === "ok"');
    expect(popupJs).toContain("MÙ — không đọc được");
  });

  it("has start-of-shift checklist with sound test confirmation and leak report", () => {
    expect(popupHtml).toContain("Kiểm tra đầu ca");
    expect(popupJs).toContain("SOUND_CONFIRMED");
    expect(popupJs).toContain("REPORT_LEAK");
    expect(popupJs).toContain("REPORT_BATTERY");
  });

  it("no longer exports CSV from the popup", () => {
    expect(popupJs).not.toContain("eventsToCsv");
    expect(popupHtml).not.toContain("exportButton");
  });
});
