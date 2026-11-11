import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ensureSharePointOriginRule, SHAREPOINT_ORIGIN_RULE } from "../lib/sharepoint_origin_rule.js";

describe("SharePoint Origin session rule", () => {
  it("removes Origin only from extension (no-tab) requests to SharePoint", () => {
    expect(SHAREPOINT_ORIGIN_RULE.action).toEqual({ type: "modifyHeaders", requestHeaders: [{ header: "origin", operation: "remove" }] });
    expect(SHAREPOINT_ORIGIN_RULE.condition).toEqual({ urlFilter: "||sharepoint.com/", resourceTypes: ["xmlhttprequest"], tabIds: [-1] });
  });

  it("registers as a session rule, replacing any earlier copy", async () => {
    const calls = [];
    const ok = await ensureSharePointOriginRule({ updateSessionRules: async (arg) => { calls.push(arg); } });
    expect(ok).toBe(true);
    expect(calls).toEqual([{ removeRuleIds: [1], addRules: [SHAREPOINT_ORIGIN_RULE] }]);
  });

  it("does nothing when the API is missing", async () => {
    expect(await ensureSharePointOriginRule(undefined)).toBe(false);
  });

  it("is registered every time the service worker starts", async () => {
    const worker = await readFile(new URL("../service_worker.js", import.meta.url), "utf8");
    expect(worker).toMatch(/^ensureSharePointOriginRule\(\)/m);
  });
});
