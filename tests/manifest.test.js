import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

describe("manifest Outlook coverage", () => {
  it("grants access to Outlook Cloud", () => {
    expect(manifest.host_permissions).toContain("https://outlook.cloud.microsoft/*");
  });

  it("injects the Outlook content script on Outlook Cloud mail", () => {
    const outlookEntry = manifest.content_scripts.find((entry) => entry.js.includes("content_outlook.js"));
    expect(outlookEntry.matches).toContain("https://outlook.cloud.microsoft/mail/*");
    expect(outlookEntry.js).toEqual(["lib/content_runtime.js", "lib/outlook_selectors.js", "lib/outlook_message_id.js", "content_outlook.js"]);
  });
});

describe("manifest SharePoint writes", () => {
  it("strips the extension Origin header from its own SharePoint requests (SharePoint answers 403 to extension-origin POSTs)", async () => {
    expect(manifest.permissions).toContain("declarativeNetRequestWithHostAccess");
    const resource = manifest.declarative_net_request.rule_resources.find((rule) => rule.id === "sharepoint_origin");
    expect(resource.enabled).toBe(true);
    const rules = JSON.parse(await readFile(new URL(`../${resource.path}`, import.meta.url), "utf8"));
    expect(rules[0].action).toEqual({ type: "modifyHeaders", requestHeaders: [{ header: "origin", operation: "remove" }] });
    expect(rules[0].condition).toMatchObject({ urlFilter: "||sharepoint.com/", tabIds: [-1] });
  });
});
