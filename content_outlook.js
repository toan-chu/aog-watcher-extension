(() => {
  const selectors = globalThis.AOG_OUTLOOK_SELECTORS;
  const { stableOutlookMessageId } = globalThis.AOG_OUTLOOK_MESSAGE_ID;
  const runtime = globalThis.AOG_CONTENT_RUNTIME;
  const seen = new Set();
  let config = null;
  let scanTimer = null;
  let baselineReady = false;
  let lastStats = emptyStats();
  const first = (root, list) => list.map((selector) => root.querySelector(selector)).find(Boolean) ?? null;
  const all = (root, list) => [...new Set(list.flatMap((selector) => [...root.querySelectorAll(selector)]))];
  const normalized = (value) => String(value ?? "").trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  async function refreshConfig() {
    const stored = await runtime.safeStorageGet("aog_config");
    config = stored.aog_config ?? {};
  }

  function isUnread(row) {
    // Outlook cloud: a row has button[aria-label='Mark as read'] when it's UNREAD
    // (because the action available is "mark as read").
    if ([...row.querySelectorAll("button[aria-label]")].some((button) => isUnreadButton(button))) return true;
    // Legacy fallbacks.
    if (row.matches("[aria-label*='Unread' i], [data-is-unread='true']")) return true;
    if (Boolean(first(row, selectors.unreadRow))) return true;
    if (/unread/i.test(row.getAttribute("aria-label") ?? "")) return true;
    return false;
  }

  function emptyStats() {
    return { rows_seen: 0, unread_seen: 0, alerts_sent: 0, suppressed_baseline: 0, suppressed_gate: 0, folder_gate: "off", path: "", last_scan_at: null };
  }

  function isUnreadButton(button) {
    const label = normalized(button.getAttribute("aria-label"));
    return (selectors.unreadButtonLabels ?? ["mark as read"]).some((item) => label.includes(normalized(item)));
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
    const unreadRows = [...document.querySelectorAll("[role='main'] button[aria-label], button[aria-label*='Mark as read' i]")]
      .filter(isUnreadButton)
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

  function folderGatePasses() {
    const watchPath = normalized(config?.outlook_watch_path);
    if (!watchPath) return { pass: true, mode: "off", path: location.pathname };
    const path = normalized(location.pathname);
    return { pass: path.includes(watchPath), mode: path.includes(watchPath) ? "pass" : "blocked", path: location.pathname };
  }

  function currentUnreadSnapshot() {
    const outlook_ids = [];
    if (!folderGatePasses().pass) return outlook_ids;
    for (const row of candidateRows()) {
      if (!isUnread(row)) continue;
      const sender = extractSender(row);
      const subject = extractSubject(row);
      const rawId = extractMessageId(row, sender, subject);
      if (rawId) outlook_ids.push(rawId);
    }
    return outlook_ids;
  }

  function seedBaseline(baseline) {
    baselineReady = Array.isArray(baseline?.outlook_ids);
    if (!baselineReady) return;
    for (const id of baseline.outlook_ids) seen.add(id);
  }

  async function syncBaseline() {
    const response = await runtime.safeSendMessage({ type: "BASELINE_SYNC", source: "outlook", snapshot: { outlook_ids: currentUnreadSnapshot() } }).catch(() => null);
    seedBaseline(response?.baseline ?? null);
  }

  function scan() {
    if (!config) return;
    const stats = emptyStats();
    stats.last_scan_at = new Date().toISOString();
    const gate = folderGatePasses();
    stats.folder_gate = gate.mode;
    stats.path = gate.path;
    if (!gate.pass) {
      stats.suppressed_gate += 1;
      lastStats = stats;
      sendHealth();
      return;
    }
    for (const row of candidateRows()) {
      try {
        stats.rows_seen += 1;
        if (!isUnread(row)) continue;
        stats.unread_seen += 1;
        const sender = extractSender(row);
        const subject = extractSubject(row);
        const rawId = extractMessageId(row, sender, subject);
        if (!rawId || seen.has(rawId)) continue;
        seen.add(rawId);
        if (!baselineReady) {
          stats.suppressed_baseline += 1;
          continue;
        }
        stats.alerts_sent += 1;
        runtime.safeSendMessage({ type: "ALERT_DETECTED", alert: { source: "email", sender, subject, message_id: rawId, received_at: new Date().toISOString(), detected_at: new Date().toISOString() } }).catch(() => {});
      } catch (error) {
        console.warn("AOG Watcher: Outlook row scan failed", error);
      }
    }
    lastStats = stats;
  }

  function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 300); }
  runtime.addStorageChangedListener((changes, area) => { if (area === "local" && changes.aog_config) { config = changes.aog_config.newValue; scheduleScan(); } });
  function sendHealth() {
    runtime.safeSendMessage({ type: "CONTENT_HEALTH", source: "outlook", connected: true, stats: lastStats }).catch(() => {});
  }
  runtime.addRuntimeMessageListener((message, _sender, sendResponse) => {
    if (message.type !== "REBASELINE") return false;
    baselineReady = false;
    seen.clear();
    syncBaseline().then(() => { scheduleScan(); sendResponse({ ok: true }); }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });
  refreshConfig().then(() => {
    syncBaseline().catch(() => {});
    new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "data-is-unread"] });
    scheduleScan();
    sendHealth();
    runtime.setSafeInterval(scheduleScan, 2_000);
    runtime.setSafeInterval(sendHealth, 30_000);
  }).catch((error) => console.error("AOG Watcher: Outlook startup failed", error));
})();
