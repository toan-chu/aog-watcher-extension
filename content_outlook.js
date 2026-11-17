// Outlook on the web: report the unread count of the AOG folder (see lib/outlook_folder.js).
// The service worker rings when the count goes up during a watch. Nothing about single emails
// (sender, subject) is read any more, so old emails can never ring again when the list redraws.
(() => {
  const folder = globalThis.AOG_OUTLOOK_FOLDER;
  const runtime = globalThis.AOG_CONTENT_RUNTIME;
  let config = {};
  let lastReported = undefined;
  let lastStats = { rows_seen: 0, folder_gate: "off", unread: null, last_scan_at: null };
  let scanTimer = null;

  async function refreshConfig() {
    const stored = await runtime.safeStorageGet("aog_config");
    config = stored.aog_config ?? {};
  }

  function scan() {
    const result = folder.readFolder(document, config);
    // rows_seen > 0 tells the service worker this tab is really watching; folder_gate "blocked" = AOG folder not visible.
    const gate = result.found ? "pass" : (result.pane ? "blocked" : "hidden");
    lastStats = { rows_seen: result.found ? 1 : 0, folder_gate: gate, unread: result.count, folder: result.name, last_scan_at: new Date().toISOString() };
    if (!result.found) return;
    if (result.count === lastReported) return;
    lastReported = result.count;
    runtime.safeSendMessage({ type: "OUTLOOK_UNREAD", count: result.count, at: new Date().toISOString() }).catch(() => {});
  }

  function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 300); }
  function sendHealth() { runtime.safeSendMessage({ type: "CONTENT_HEALTH", source: "outlook", connected: true, stats: lastStats }).catch(() => {}); }

  runtime.addStorageChangedListener((changes, area) => {
    if (area === "local" && changes.aog_config) { config = changes.aog_config.newValue ?? {}; lastReported = undefined; scheduleScan(); }
  });
  // Accept on an email alert: open the AOG folder so the operator sees the new mail.
  runtime.addRuntimeMessageListener((message, _sender, sendResponse) => {
    if (message.type !== "OPEN_OUTLOOK_MESSAGE") return false;
    try {
      const node = folder.folderNode(document, config);
      if (node) { node.scrollIntoView?.({ block: "center" }); node.click(); }
      sendResponse({ ok: true, opened: Boolean(node) });
    } catch (error) { sendResponse({ ok: false, error: error.message }); }
    return false;
  });
  // A new watch starts from what is unread now: report the current count again.
  runtime.addRuntimeMessageListener((message, _sender, sendResponse) => {
    if (message.type !== "REBASELINE") return false;
    lastReported = undefined;
    scan();
    sendResponse({ ok: true });
    return false;
  });

  refreshConfig().then(() => {
    new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "title"] });
    scan();
    sendHealth();
    runtime.setSafeInterval(scheduleScan, 2_000);
    runtime.setSafeInterval(sendHealth, 30_000);
  }).catch((error) => console.error("AOG Watcher: Outlook startup failed", error));
})();
