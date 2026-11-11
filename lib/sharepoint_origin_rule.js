// SharePoint answers 403 to POSTs (request digest, writes) that carry the extension's Origin header,
// while the same POST from a SharePoint page succeeds. This session rule removes Origin from
// requests that belong to no tab (the extension's own service worker), so a SharePoint tab the
// person has open is never touched. tabIds is only allowed on session rules, not static ones.
export const SHAREPOINT_ORIGIN_RULE_ID = 1;

export const SHAREPOINT_ORIGIN_RULE = Object.freeze({
  id: SHAREPOINT_ORIGIN_RULE_ID,
  priority: 1,
  action: { type: "modifyHeaders", requestHeaders: [{ header: "origin", operation: "remove" }] },
  condition: { urlFilter: "||sharepoint.com/", resourceTypes: ["xmlhttprequest"], tabIds: [-1] },
});

// Session rules disappear when the browser restarts, so this runs every time the service worker starts.
export async function ensureSharePointOriginRule(dnr = globalThis.chrome?.declarativeNetRequest) {
  if (!dnr?.updateSessionRules) return false;
  await dnr.updateSessionRules({ removeRuleIds: [SHAREPOINT_ORIGIN_RULE_ID], addRules: [SHAREPOINT_ORIGIN_RULE] });
  return true;
}
