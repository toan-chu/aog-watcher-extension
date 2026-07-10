(() => {
  let alive = true;
  const intervals = new Set();

  function isContextError(error) {
    return /extension context invalidated|context invalidated/i.test(String(error?.message ?? error));
  }

  function runtimeId() {
    try {
      return chrome?.runtime?.id ?? "";
    } catch {
      return "";
    }
  }

  function isAlive() {
    return alive && Boolean(runtimeId());
  }

  function markDead(error) {
    if (error && !isContextError(error)) return false;
    alive = false;
    for (const id of intervals) clearInterval(id);
    intervals.clear();
    return true;
  }

  async function safeSendMessage(message) {
    if (!isAlive()) return null;
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (!markDead(error)) throw error;
      return null;
    }
  }

  async function safeStorageGet(key) {
    if (!isAlive()) return {};
    try {
      return await chrome.storage.local.get(key);
    } catch (error) {
      if (!markDead(error)) throw error;
      return {};
    }
  }

  function addRuntimeMessageListener(listener) {
    if (!isAlive()) return;
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!isAlive()) return false;
        try {
          return listener(message, sender, sendResponse);
        } catch (error) {
          if (!markDead(error)) throw error;
          return false;
        }
      });
    } catch (error) {
      markDead(error);
    }
  }

  function addStorageChangedListener(listener) {
    if (!isAlive()) return;
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (!isAlive()) return;
        try {
          listener(changes, area);
        } catch (error) {
          if (!markDead(error)) throw error;
        }
      });
    } catch (error) {
      markDead(error);
    }
  }

  function setSafeInterval(callback, ms) {
    if (!isAlive()) return null;
    const id = setInterval(() => {
      if (!isAlive()) {
        clearInterval(id);
        intervals.delete(id);
        return;
      }
      try {
        callback();
      } catch (error) {
        if (!markDead(error)) throw error;
      }
    }, ms);
    intervals.add(id);
    return id;
  }

  globalThis.AOG_CONTENT_RUNTIME = Object.freeze({
    addRuntimeMessageListener,
    addStorageChangedListener,
    isAlive,
    markDead,
    safeSendMessage,
    safeStorageGet,
    setSafeInterval,
  });
})();
