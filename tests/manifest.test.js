import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

describe("manifest Outlook coverage", () => {
  it("grants access to Outlook Cloud", () => {
    expect(manifest.host_permissions).toContain("https://outlook.cloud.microsoft/*");
  });

  it("injects the Outlook content script on every Outlook page (not only /mail at load), with the folder counter", () => {
    const outlookEntry = manifest.content_scripts.find((entry) => entry.js.includes("content_outlook.js"));
    expect(outlookEntry.matches).toContain("https://outlook.cloud.microsoft/*");
    expect(outlookEntry.matches).toContain("https://outlook.office.com/*");
    expect(outlookEntry.js).toEqual(["lib/content_runtime.js", "lib/outlook_folder.js", "content_outlook.js"]);
  });

  it("opens in the side panel and can put scripts into tabs that are already open", () => {
    expect(manifest.side_panel.default_path).toBe("popup.html");
    expect(manifest.action.default_popup).toBeUndefined();
    expect(manifest.permissions).toEqual(expect.arrayContaining(["sidePanel", "scripting"]));
  });
});

describe("manifest SharePoint writes", () => {
  it("has the permission for the session rule and no static rule file (tabIds is session-only)", () => {
    expect(manifest.permissions).toContain("declarativeNetRequestWithHostAccess");
    expect(manifest.declarative_net_request).toBeUndefined();
  });
});
