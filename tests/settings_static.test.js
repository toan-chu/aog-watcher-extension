import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const settingsHtml = await readFile(new URL("../settings.html", import.meta.url), "utf8");
const settingsJs = await readFile(new URL("../settings.js", import.meta.url), "utf8");
const settingsCss = await readFile(new URL("../settings.css", import.meta.url), "utf8");

describe("settings report export UX", () => {
  it("explains blank date range defaults to current month", () => {
    expect(settingsHtml).toContain("From/To default to current month if blank.");
  });

  it("uses current month default and timestamped report filenames", () => {
    expect(settingsJs).toContain("currentMonthRange");
    expect(settingsJs).toContain("reportFilename(\"hr\"");
    expect(settingsJs).toContain("reportFilename(\"analytics\"");
  });

  it("disables export buttons while generating and shows busy styling", () => {
    expect(settingsJs).toContain("setExportBusy");
    expect(settingsJs).toContain("button.disabled = busy");
    expect(settingsCss).toContain("button:disabled");
    expect(settingsCss).toContain("button[data-busy=\"true\"]::before");
  });
});
