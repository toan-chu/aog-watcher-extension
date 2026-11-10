import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runPreflight } from "../lib/preflight.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const uiFiles = [
  "popup.html", "popup.js", "settings.html", "settings.js", "service_worker.js",
  "content_outlook.js", "content_whatsapp.js", "lib/preflight.js",
  "lib/blind_detector.js", "lib/miss_cause.js",
];
const uiSources = Object.fromEntries(await Promise.all(uiFiles.map(async (path) => [path, await read(path)])));

describe("V5-03 English user-facing copy", () => {
  it("contains no Vietnamese diacritics in user-facing source files", () => {
    const offenders = Object.entries(uiSources)
      .filter(([, source]) => /[À-ỹ]/u.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("uses Accept everywhere user-facing while preserving internal ACK identifiers", () => {
    expect(uiSources["popup.html"]).toContain("ACCEPT — I'LL HANDLE IT");
    expect(uiSources["popup.html"]).not.toMatch(/\bACK\b/);
    expect(uiSources["settings.html"]).not.toMatch(/\bACK\b/);
    for (const path of ["popup.js", "service_worker.js"]) {
      expect(uiSources[path].replaceAll('"ACK"', "")).not.toMatch(/\bACK\b/);
    }
    expect(uiSources["popup.js"]).toContain('type: "ACK_CURRENT"');
    expect(uiSources["service_worker.js"]).toContain('eventRecord.event_type === "ACK"');
  });

  it("uses English documents and the required vocabulary", () => {
    expect(uiSources["popup.html"]).toContain('<html lang="en">');
    expect(uiSources["settings.html"]).toContain('<html lang="en">');
    for (const copy of ["Start shift", "End shift", "Pre-shift check", "Test ring", "I hear it", "Missed a message?", "Recent events", "Diagnostics"]) {
      expect(uiSources["popup.html"]).toContain(copy);
    }
    for (const copy of ["READY", "OFF SHIFT", "RINGING", "Primary", "Backup", "Unknown chat", "Add to shared list", "Ignore", "Done", "Need more time", "Dismiss"]) {
      expect(uiSources["popup.html"] + uiSources["popup.js"]).toContain(copy);
    }
    for (const copy of ["Setup", "Machine", "Person", "Watcher"]) expect(uiSources["lib/miss_cause.js"]).toContain(copy);
  });
});

describe("V5-03 removes battery checks", () => {
  it("does not include a power item in the pre-shift check", () => {
    const result = runPreflight({
      config: { self_display_name: "Operator" },
      sources: { whatsapp: { status: "ok" }, outlook: { status: "ok" } },
      sharepoint: { configured: false },
      soundConfirmedAt: Date.now(),
      shiftStartedAt: Date.now(),
    });
    expect(result.items.map((item) => item.key)).not.toContain("power");
    expect(result.ready).toBe(true);
  });

  it("removes battery storage, messages and browser reads", async () => {
    const source = [await read("lib/constants.js"), uiSources["lib/preflight.js"], uiSources["popup.js"], uiSources["service_worker.js"]].join("\n");
    expect(source).not.toMatch(/REPORT_BATTERY|K\.BATTERY|navigator\.getBattery|\bbattery\b/i);
  });
});

describe("V5-03 site and clock defaults", () => {
  it("uses the AOG SharePoint site in defaults and Settings guidance", async () => {
    const constants = await read("lib/constants.js");
    expect(constants).toContain('sharepoint_site_url: "https://trustanavn.sharepoint.com/sites/aog"');
    expect(uiSources["settings.html"]).toContain("https://trustanavn.sharepoint.com/sites/aog");
    expect(constants + uiSources["settings.html"]).not.toContain("/sites/cx9");
  });

  it("formats displayed times in 24-hour English independent of Windows locale", () => {
    for (const path of ["popup.js", "settings.js", "service_worker.js"]) {
      expect(uiSources[path]).toContain('"en-GB"');
      expect(uiSources[path]).toContain("hour12: false");
      expect(uiSources[path]).not.toContain('"vi-VN"');
    }
  });
});
