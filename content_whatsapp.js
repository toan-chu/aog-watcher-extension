(() => {
  const selectors = globalThis.AOG_WHATSAPP_SELECTORS;
  const { activeConversationName, all, chatRowName, first, isSameGroupName, normalized } = globalThis.AOG_WHATSAPP_DOM;
  const runtime = globalThis.AOG_CONTENT_RUNTIME;
  const lastUnreadByGroup = new Map();
  const seenTags = new Set();
  let config = null;
  let scanTimer = null;
  let baselineReady = false;
  let lastStats = emptyStats();

  async function refreshConfig() {
    const stored = await runtime.safeStorageGet("aog_config");
    config = stored.aog_config ?? {};
  }

  function groupName(row) {
    return chatRowName(row, selectors);
  }

  function unreadCount(row) {
    const badge = first(row, selectors.unread);
    if (!badge) return 0;
    const text = `${badge.getAttribute("aria-label") ?? ""} ${badge.textContent ?? ""}`;
    const match = text.match(/\d+/);
    return match ? Number(match[0]) : 1;
  }

  function isCustomer(name) {
    const target = normalized(name);
    return (config?.customer_groups ?? []).some((group) => normalized(group) === target) && target !== normalized(config?.coord_group);
  }

  function emptyStats() {
    return { rows_seen: 0, unread_seen: 0, alerts_sent: 0, suppressed_baseline: 0, suppressed_gate: 0, last_scan_at: null };
  }

  function currentUnreadSnapshot() {
    const snapshot = {};
    for (const row of all(document, selectors.chatRows)) {
      const name = groupName(row);
      if (!name || !isCustomer(name)) continue;
      const unread = unreadCount(row);
      if (unread > 0) snapshot[name] = unread;
    }
    return snapshot;
  }

  function seedBaseline(baseline) {
    baselineReady = Boolean(baseline?.whatsapp_unread);
    if (!baselineReady) return;
    for (const [name, unread] of Object.entries(baseline.whatsapp_unread ?? {})) {
      lastUnreadByGroup.set(name, Number(unread) || 0);
    }
  }

  async function syncBaseline() {
    const response = await runtime.safeSendMessage({ type: "BASELINE_SYNC", source: "whatsapp", snapshot: { whatsapp_unread: currentUnreadSnapshot() } }).catch(() => null);
    seedBaseline(response?.baseline ?? null);
  }

  function scanCustomerGroups() {
    if (!config) return;
    const stats = emptyStats();
    stats.last_scan_at = new Date().toISOString();
    for (const row of all(document, selectors.chatRows)) {
      try {
        stats.rows_seen += 1;
        const name = groupName(row);
        const unread = unreadCount(row);
        if (!name || !isCustomer(name)) continue;
        if (unread > 0) stats.unread_seen += 1;
        const previousUnread = lastUnreadByGroup.get(name);
        lastUnreadByGroup.set(name, unread);
        if (!baselineReady || previousUnread === undefined) {
          if (unread > 0) stats.suppressed_baseline += 1;
          continue;
        }
        if (unread <= 0 || unread <= previousUnread) continue;
        const minute = new Date(); minute.setSeconds(0, 0);
        const signature = `${name}|${unread}|${minute.toISOString()}`;
        stats.alerts_sent += 1;
        runtime.safeSendMessage({ type: "ALERT_DETECTED", alert: { source: "whatsapp", group_name: name, unread_count: unread, message_text: "", active_conversation: activeConversationName(document, selectors), detected_at: new Date().toISOString(), raw_id: signature } }).catch(() => {});
      } catch (error) {
        console.warn("AOG Watcher: WhatsApp row scan failed", error);
      }
    }
    lastStats = stats;
  }

  function scanPeerTags() {
    if (!config?.coord_group) return;
    for (const element of all(document, selectors.messageText).slice(-50)) {
      const text = element.textContent?.trim() ?? "";
      if (!text.startsWith("[AOG-") || seenTags.has(text)) continue;
      seenTags.add(text);
      runtime.safeSendMessage({ type: "PEER_TAG_RECEIVED", text }).catch(() => {});
    }
  }

  function messageExistsInCoordGroup(text) {
    // WhatsApp Web sometimes duplicates the message text inside the row's DOM (e.g. preview + main span).
    // Use `includes` so the verify step does not flake on those duplicates.
    return all(document, selectors.messageText).slice(-50).some((element) => {
      const t = element.textContent?.trim() ?? "";
      return t === text || t.includes(text);
    });
  }

  async function verifyMessageSent(text, timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (messageExistsInCoordGroup(text)) return true;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return false;
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { scanCustomerGroups(); scanPeerTags(); }, 250);
  }

  // WhatsApp Web blocks synthetic click events on sidebar rows (anti-automation).
  // The only reliable way to switch conversation programmatically is via the search box:
  // type the group name, then press Enter to open the first match.
  async function searchAndOpenCoord() {
    const coordName = config?.coord_group || "";
    if (!coordName) throw new Error("Coord group not configured");
    const search = first(document, selectors.searchBox);
    if (!search) throw new Error("WhatsApp search box not found");

    // Clear any existing search text + focus.
    search.focus();
    // Select-all + delete to clear contenteditable.
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
    await new Promise((resolve) => setTimeout(resolve, 100));

    document.execCommand("insertText", false, coordName);
    search.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: coordName }));
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Press Enter to open first match.
    const enterInit = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    search.dispatchEvent(new KeyboardEvent("keydown", enterInit));
    search.dispatchEvent(new KeyboardEvent("keyup", enterInit));
  }

  async function waitForCoordGroupActive(timeoutMs = 6000) {
    const start = Date.now();
    let currentName = "";
    while (Date.now() - start < timeoutMs) {
      currentName = activeConversationName(document, selectors);
      if (isSameGroupName(currentName, config?.coord_group)) return true;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Timed out waiting for coord group "${config?.coord_group || "not configured"}" to become active. Currently active: "${currentName || "unknown"}"`);
  }

  // Clear the search box after we're done so user's UI is not left in search mode.
  function clearSearchBox() {
    const search = first(document, selectors.searchBox);
    if (!search) return;
    try {
      search.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      search.blur();
    } catch { /* ignore */ }
  }

  async function sendPeerTag(text) {
    await refreshConfig();
    await searchAndOpenCoord();
    await waitForCoordGroupActive();
    if (messageExistsInCoordGroup(text)) {
      clearSearchBox();
      return true;
    }
    const composer = first(document, selectors.composer);
    if (!composer) throw new Error("WhatsApp composer not found");
    composer.focus();
    document.execCommand("insertText", false, text);
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    const send = first(document, selectors.sendButton);
    const clickable = send?.closest("button") ?? send;
    if (!clickable) throw new Error("WhatsApp send button not found");
    clickable.click();
    if (!(await verifyMessageSent(text, 3000))) {
      throw new Error("Peer tag click completed but message did not appear in coord group within 3s. Possible WhatsApp composer desync.");
    }
    clearSearchBox();
    return true;
  }

  runtime.addRuntimeMessageListener((message, _sender, sendResponse) => {
    if (message.type === "REBASELINE") {
      baselineReady = false;
      lastUnreadByGroup.clear();
      syncBaseline().then(() => { scheduleScan(); sendResponse({ ok: true }); }).catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message.type !== "SEND_PEER_TAG") return false;
    sendPeerTag(message.text).then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });

  runtime.addStorageChangedListener((changes, area) => { if (area === "local" && changes.aog_config) { config = changes.aog_config.newValue; scheduleScan(); } });

  function sendHealth() {
    runtime.safeSendMessage({ type: "CONTENT_HEALTH", source: "whatsapp", connected: true, stats: lastStats }).catch(() => {});
  }

  refreshConfig().then(() => {
    syncBaseline().catch(() => {});
    new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    scheduleScan();
    sendHealth();
    runtime.setSafeInterval(sendHealth, 30_000);
  }).catch((error) => console.error("AOG Watcher: WhatsApp startup failed", error));
})();
