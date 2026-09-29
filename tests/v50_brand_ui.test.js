import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [popupHtml, popupCss, popupJs, settingsHtml, settingsCss, fontsCss] = await Promise.all(["popup.html", "popup.css", "popup.js", "settings.html", "settings.css", "assets/fonts/fonts.css"].map(read));

describe("V5-02 Trustana brand UI", () => {
  it("uses the Trustana purple and orange in both pages", () => {
    for (const css of [popupCss, settingsCss]) {
      expect(css).toContain("#4d148c");
      expect(css).toContain("#ff6200");
    }
    expect(popupCss).not.toContain("#52d68b"); // 4.3 green theme is gone
  });

  it("bundles Montserrat locally with Vietnamese glyphs (no network at night)", () => {
    expect(fontsCss).toContain("montserrat-vietnamese-700-normal.woff2");
    expect(fontsCss).not.toMatch(/https?:\/\//);
    expect(popupHtml).toContain("assets/fonts/fonts.css");
    expect(settingsHtml).toContain("assets/fonts/fonts.css");
    expect(popupCss).toContain("Calibri");
  });

  it("keeps status colours distinct from the brand orange", () => {
    const token = (name) => popupCss.match(new RegExp(`--${name}: (#[0-9a-f]{6})`))[1];
    for (const name of ["ok", "warn", "danger"]) expect(token(name)).not.toBe("#ff6200");
    expect(popupCss).toMatch(/\.ack:not\(:disabled\) \{[^}]*var\(--danger\)/);
  });

  it("keeps every element id the popup script needs", () => {
    const ids = [...popupJs.match(/const ids = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    for (const id of ids) expect(popupHtml).toContain(`id="${id}"`);
  });

  it("orders the popup by urgency: system alerts, current alert, unknown chats, then shift", () => {
    const order = ["systemAlerts", "alertPanel", "unknownChats", "shiftSetup", "preflight"].map((id) => popupHtml.indexOf(`id="${id}"`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
