import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const popupHtml = await readFile(new URL("../popup.html", import.meta.url), "utf8");
const popupJs = await readFile(new URL("../popup.js", import.meta.url), "utf8");

describe("popup safety copy", () => {
  it("makes End Shift consequences explicit and confirms before stopping monitoring", () => {
    expect(popupHtml).toContain("End shift (stop monitoring)");
    expect(popupJs).toContain("End shift will stop receiving alerts");
    expect(popupJs).toContain("confirm(");
  });

  it("renders recent event time in local Vietnamese time and not raw UTC slice", () => {
    expect(popupJs).toContain("toLocaleTimeString(\"vi-VN\"");
    expect(popupJs).not.toContain("slice(11, 19)");
  });

  it("color-codes and truncates recent event context", () => {
    expect(popupJs).toContain("recent-event--ok");
    expect(popupJs).toContain("recent-event--danger");
    expect(popupJs).toContain("recent-event--warn");
    expect(popupJs).toContain("shortText(context)");
    expect(popupJs).toContain("item.title");
  });
});
