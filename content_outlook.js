(() => {
  const selectors = globalThis.AOG_OUTLOOK_SELECTORS;
  const { stableOutlookMessageId } = globalThis.AOG_OUTLOOK_MESSAGE_ID;
  const runtime = globalThis.AOG_CONTENT_RUNTIME;
  const seen = new Set();
  let config = null;
  let scanTimer = null;
  const first = (root, list) => list.map((selector) => root.querySelector(selector)).find(Boolean) ?? null;
  const all = (root, list) => [...new Set(list.flatMap((selector) => [...root.querySelectorAll(selector)]))];

  async function refreshConfig() {
    const stored = await runtime.safeStorageGet("aog_config");
    config = stored.aog_config ?? {};
  }

  function isUnread(row) {
    // Outlook cloud: a row has button[aria-label='Mark as read'] when it's UNREAD
    // (because the action available is "mark as read").
    if (row.querySelector("button[aria-label*='Mark as read' i]")) return true;
    // Legacy fallbacks.
    if (row.matches("[aria-label*='Unread' i], [data-is-unread='true']")) return true;
    if (Boolean(first(row, selectors.unreadRow))) return true;
    if (/unread/i.test(row.getAttribute("aria-label") ?? "")) return true;
    return false;
  }

  function closestMessageRow(element) {
    let current = element;
    for (let depth = 0; current && depth < 10; depth += 1) {
      if (current.matches?.("[role='option'], [role='listitem'], [data-convid], [data-item-id]")) return current;
      if (current.querySelector?.("[role='checkbox'][aria-label*='Select' i]")) return current;
      current = current.parentElement;
    }
    return element.closest?.("[role='option'], [role='listitem'], [data-convid], [data-item-id]") ?? null;
  }

  function candidateRows() {
    const rows = all(document, selectors.messageRows);
    const unreadRows = [...document.querySelectorAll("button[aria-label*='Mark as read' i]")]
      .map(closestMessageRow)
      .filter(Boolean);
    return [...new Set([...unreadRows, ...rows])];
  }

  function textFrom(row, selectorList) { return first(row, selectorList)?.textContent?.trim() ?? ""; }

  function extractSender(row) {
    // Preferred: span with title containing '@' (sender email).
    const emailSpan = row.querySelector("span[title*='@']");
    if (emailSpan) return emailSpan.textContent?.trim() || emailSpan.getAttribute("title") || "";
    // Fallback: avatar aria-label (display name only, no email).
    const avatar = row.querySelector("[role='img'][aria-label]");
    if (avatar) return avatar.getAttribute("aria-label") || "";
    return textFrom(row, selectors.sender);
  }

  function extractSubject(row) {
    // Try legacy stable selectors first.
    const legacy = first(row, selectors.subject);
    if (legacy) return legacy.textContent?.trim() ?? "";
    // Outlook cloud structural fallback: the subject is the first span in the row
    // that does NOT have a title attribute (sender + date both have title attributes).
    const spans = [...row.querySelectorAll("span")];
    const subjectSpan = spans.find((s) => {
      const text = s.textContent?.trim();
      if (!text) return false;
      if (s.hasAttribute("title")) return false;        // skip sender (has title=email) and date (has title=date)
      if (s.getAttribute("role") === "img") return false;
      if (s.children.length > 0) return false;           // leaf text node only
      if (text.length < 3 || text.length > 200) return false;
      return true;
    });
    return subjectSpan?.textContent?.trim() ?? "";
  }

  function extractMessageId(row, sender, subject) {
    return stableOutlookMessageId(row, sender, subject);
  }

  function scan() {
    if (!config) return;
    for (const row of candidateRows()) {
      try {
        if (!isUnread(row)) continue;
        const sender = extractSender(row);
        const subject = extractSubject(row);
        const rawId = extractMessageId(row, sender, subject);
        if (!rawId || seen.has(rawId)) continue;
        seen.add(rawId);
        runtime.safeSendMessage({ type: "ALERT_DETECTED", alert: { source: "email", sender, subject, message_id: rawId, received_at: new Date().toISOString(), detected_at: new Date().toISOString() } }).catch(() => {});
      } catch (error) {
        console.warn("AOG Watcher: Outlook row scan failed", error);
      }
    }
  }

  function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 300); }
  runtime.addStorageChangedListener((changes, area) => { if (area === "local" && changes.aog_config) { config = changes.aog_config.newValue; scheduleScan(); } });
  function sendHealth() {
    runtime.safeSendMessage({ type: "CONTENT_HEALTH", source: "outlook", connected: true }).catch(() => {});
  }
  refreshConfig().then(() => {
    new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "data-is-unread"] });
    scheduleScan();
    sendHealth();
    runtime.setSafeInterval(scheduleScan, 2_000);
    runtime.setSafeInterval(sendHealth, 30_000);
  }).catch((error) => console.error("AOG Watcher: Outlook startup failed", error));
})();
