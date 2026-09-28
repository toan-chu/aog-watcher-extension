import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const settingsHtml = await readFile(new URL("../settings.html", import.meta.url), "utf8");
const settingsJs = await readFile(new URL("../settings.js", import.meta.url), "utf8");
const settingsCss = await readFile(new URL("../settings.css", import.meta.url), "utf8");

describe("settings 5.0", () => {
  it("onboards with a SharePoint link and a login check instead of preset import", () => {
    expect(settingsHtml).toContain("sharepointSiteUrl");
    expect(settingsHtml).toContain("Đăng nhập &amp; kiểm tra");
    expect(settingsJs).toContain('type: "SP_TEST"');
    expect(settingsJs).not.toMatch(/preset/i);
  });

  it("lets the team lead create lists and publish shared settings", () => {
    expect(settingsJs).toContain('type: "SP_SETUP"');
    expect(settingsJs).toContain('type: "SP_PUBLISH_SETTINGS"');
  });

  it("drops the local HR/analytics exports", () => {
    expect(settingsHtml).not.toContain("exportHr");
    expect(settingsHtml).not.toContain("xlsx");
    expect(settingsJs).not.toContain("report_generator");
  });

  it("keeps busy styling for long-running buttons", () => {
    expect(settingsJs).toContain("button.disabled = true");
    expect(settingsCss).toContain("button:disabled");
    expect(settingsCss).toContain('button[data-busy="true"]::before');
  });

  it("validates the SharePoint URL before saving", () => {
    expect(settingsJs).toContain("normalizeSiteUrl");
    expect(settingsJs).toContain("Link SharePoint không hợp lệ");
  });
});
