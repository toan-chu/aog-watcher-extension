(() => {
  const selectors = globalThis.AOG_WHATSAPP_SELECTORS;
  const { activeConversationName, all, chatRowName, draftDecision, first, isSameGroupName, normalized } = globalThis.AOG_WHATSAPP_DOM;
  const runtime = globalThis.AOG_CONTENT_RUNTIME;
  const lastUnreadByGroup = new Map();
  const zeroUnreadScansByGroup = new Map();
  const seenTags = new Set();
  let config = null;
  let teamGroups = [];
  let scanTimer = null;
  let baselineReady = false;
  let lastStats = emptyStats();

  async function refreshConfig() {
    const stored = await runtime.safeStorageGet(["aog_config", "aog_team_groups"]);
    config = stored.aog_config ?? {};
    teamGroups = Array.isArray(stored.aog_team_groups) ? stored.aog_team_groups : [];
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

  // 5.0: watch list = team groups (SharePoint) ∪ personal groups − ignored chats.
  function inList(list, target) {
    return (list ?? []).some((group) => normalized(group) === target);
  }

  function chatClass(name) {
    const target = normalized(name);
    if (!target) return null;
    if (config?.coord_group && target === normalized(config.coord_group)) return "coord";
    if (inList(config?.ignored_chats, target)) return "ignored";
    if (inList(teamGroups, target) || inList(config?.customer_groups, target)) return "customer";
    return "unknown";
  }

  function isCustomer(name) {
    return chatClass(name) === "customer";
  }

  function emptyStats() {
    return { rows_seen: 0, unread_seen: 0, alerts_sent: 0, unknown_sent: 0, suppressed_baseline: 0, suppressed_gate: 0, last_scan_at: null };
  }

  function currentUnreadSnapshot() {
    const snapshot = {};
    for (const row of all(document, selectors.chatRows)) {
      const name = groupName(row);
      const kind = chatClass(name);
      if (!kind || kind === "coord") continue;
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
    const visibleReadChats = [];
    const visibleChats = new Set();
    let needsReadConfirmation = false;
    stats.last_scan_at = new Date().toISOString();
    for (const row of all(document, selectors.chatRows)) {
      try {
        stats.rows_seen += 1;
        const name = groupName(row);
        const unread = unreadCount(row);
        const kind = chatClass(name);
        if (!kind || kind === "coord" || kind === "ignored") continue;
        visibleChats.add(name);
        if (unread === 0) {
          const zeroScans = (zeroUnreadScansByGroup.get(name) ?? 0) + 1;
          zeroUnreadScansByGroup.set(name, zeroScans);
          if (zeroScans === 1) needsReadConfirmation = true;
          if (zeroScans >= 2) visibleReadChats.push(name);
        } else zeroUnreadScansByGroup.delete(name);
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
        const unknownChat = kind === "unknown";
        if (unknownChat) stats.unknown_sent += 1; else stats.alerts_sent += 1;
        runtime.safeSendMessage({ type: "ALERT_DETECTED", alert: { source: "whatsapp", group_name: name, unknown_chat: unknownChat, unread_count: unread, message_text: "", active_conversation: activeConversationName(document, selectors), detected_at: new Date().toISOString(), raw_id: signature } }).catch(() => {});
      } catch (error) {
        console.warn("AOG Watcher: WhatsApp row scan failed", error);
      }
    }
    for (const name of zeroUnreadScansByGroup.keys()) {
      if (!visibleChats.has(name)) zeroUnreadScansByGroup.delete(name);
    }
    lastStats = stats;
    const focused = document.visibilityState === "visible" && document.hasFocus?.();
    runtime.safeSendMessage({
      type: "WHATSAPP_READ_OBSERVED",
      focused_active_chat: focused ? activeConversationName(document, selectors) : "",
      visible_read_chats: [...new Set(visibleReadChats)],
    }).catch(() => {});
    if (needsReadConfirmation) scheduleScan();
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
  async function searchAndOpenChat(chatName) {
    if (!chatName) throw new Error("WhatsApp chat name is missing");
    const search = first(document, selectors.searchBox);
    if (!search) throw new Error("WhatsApp search box not found");

    // Clear any existing search text + focus.
    search.focus();
    // Select-all + delete to clear contenteditable.
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
    await new Promise((resolve) => setTimeout(resolve, 100));

    document.execCommand("insertText", false, chatName);
    search.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: chatName }));
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Press Enter to open first match.
    const enterInit = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    search.dispatchEvent(new KeyboardEvent("keydown", enterInit));
    search.dispatchEvent(new KeyboardEvent("keyup", enterInit));
  }

  async function waitForChatActive(chatName, timeoutMs = 3000) {
    const start = Date.now();
    let currentName = "";
    while (Date.now() - start < timeoutMs) {
      currentName = activeConversationName(document, selectors);
      if (isSameGroupName(currentName, chatName)) return true;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Timed out waiting for WhatsApp chat "${chatName}" to become active. Currently active: "${currentName || "unknown"}"`);
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

  // WhatsApp's editor already reacts to execCommand("insertText"). Sending an extra synthetic input event
  // on top made it insert the text a second time, so the event is only a fallback when nothing was typed.
  function typeIntoComposer(composer, text) {
    composer.focus();
    const before = composer.textContent ?? "";
    const inserted = document.execCommand("insertText", false, text);
    if (inserted && (composer.textContent ?? "") !== before) return;
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  }

  async function openChatAndDraft(chatName, text = "") {
    await refreshConfig();
    try {
      await searchAndOpenChat(chatName);
      await waitForChatActive(chatName);
      const activeChat = activeConversationName(document, selectors);
      const composer = first(document, selectors.composer);
      const decision = draftDecision({ activeChat, targetChat: chatName, coordGroup: config?.coord_group, text, composerText: composer?.textContent });
      if (!decision.ok) throw new Error(decision.error);
      if (!decision.shouldDraft) return { ok: true, chat: activeChat, drafted: false };
      if (!composer) throw new Error("WhatsApp composer not found");
      typeIntoComposer(composer, text);
      return { ok: true, chat: activeChat, drafted: true };
    } finally {
      clearSearchBox();
    }
  }

  async function sendPeerTag(text) {
    await refreshConfig();
    const coordName = config?.coord_group || "";
    if (!coordName) throw new Error("Coord group not configured");
    try {
      await searchAndOpenChat(coordName);
      await waitForChatActive(coordName);
      if (messageExistsInCoordGroup(text)) return true;
      const composer = first(document, selectors.composer);
      if (!composer) throw new Error("WhatsApp composer not found");
      typeIntoComposer(composer, text);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const send = first(document, selectors.sendButton);
      const clickable = send?.closest("button") ?? send;
      if (!clickable) throw new Error("WhatsApp send button not found");
      clickable.click();
      if (!(await verifyMessageSent(text, 3000))) {
        throw new Error("Peer tag click completed but message did not appear in coord group within 3s. Possible WhatsApp composer desync.");
      }
      return true;
    } finally {
      clearSearchBox();
    }
  }

  runtime.addRuntimeMessageListener((message, _sender, sendResponse) => {
    if (message.type === "REBASELINE") {
      baselineReady = false;
      lastUnreadByGroup.clear();
      zeroUnreadScansByGroup.clear();
      syncBaseline().then(() => { scheduleScan(); sendResponse({ ok: true }); }).catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message.type === "GET_ACTIVE_WHATSAPP_CHAT") {
      sendResponse({ ok: true, chat: activeConversationName(document, selectors) });
      return false;
    }
    if (message.type === "OPEN_WHATSAPP_CHAT") {
      openChatAndDraft(message.chat_name, message.draft_text).then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message.type !== "SEND_PEER_TAG") return false;
    sendPeerTag(message.text).then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });

  runtime.addStorageChangedListener((changes, area) => {
    if (area !== "local") return;
    if (changes.aog_config) config = changes.aog_config.newValue;
    if (changes.aog_team_groups) teamGroups = Array.isArray(changes.aog_team_groups.newValue) ? changes.aog_team_groups.newValue : [];
    if (changes.aog_config || changes.aog_team_groups) scheduleScan();
  });

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
